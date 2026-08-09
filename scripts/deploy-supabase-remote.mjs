#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const manifestPath = resolve(rootDir, "supabase/remote-deploy.json");
const checksDir = resolve(rootDir, "supabase/checks");
const migrationsDir = resolve(rootDir, "supabase/migrations");
const allowedModes = new Set(["dry-run", "verify", "apply"]);

function fail(message) {
  console.error(`Supabase remote deployment configuration error: ${message}`);
  process.exit(1);
}

function optionValue(name) {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) {
    return process.argv[exactIndex + 1];
  }

  const prefix = `${name}=`;
  const item = process.argv.find((value) => value.startsWith(prefix));
  return item?.slice(prefix.length);
}

function readManifest() {
  if (!existsSync(manifestPath)) {
    fail("supabase/remote-deploy.json is missing.");
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`unable to parse supabase/remote-deploy.json: ${error.message}`);
  }

  if (manifest.schemaVersion !== 1) {
    fail("remote deployment manifest schemaVersion must be 1.");
  }

  if (!/^\d+\.\d+\.\d+$/.test(String(manifest.supabaseCliVersion ?? ""))) {
    fail("supabaseCliVersion must be an exact semantic version.");
  }

  if (!Array.isArray(manifest.requiredRemoteHistory)
    || manifest.requiredRemoteHistory.length === 0
    || manifest.requiredRemoteHistory.some((version) => !/^\d+$/.test(version))) {
    fail("requiredRemoteHistory must be a non-empty list of numeric migration versions.");
  }

  if (new Set(manifest.requiredRemoteHistory).size !== manifest.requiredRemoteHistory.length) {
    fail("requiredRemoteHistory contains duplicate versions.");
  }

  const localMigrationVersions = new Set(
    readdirSync(migrationsDir)
      .map((name) => name.match(/^(\d+)_.*\.sql$/)?.[1])
      .filter(Boolean)
  );

  for (const version of manifest.requiredRemoteHistory) {
    if (!localMigrationVersions.has(version)) {
      fail(`required remote migration ${version} has no local migration file.`);
    }
  }

  if (!localMigrationVersions.has("019")) {
    fail("Phase 1.18.1 migration 019 is missing.");
  }

  validateCheckList(manifest.preflightChecks, "preflightChecks", false);
  validateCheckList(manifest.postMigrationChecks, "postMigrationChecks", true);

  for (const workflowFile of [
    ".github/workflows/verify-supabase.yml",
    ".github/workflows/deploy-supabase.yml"
  ]) {
    const workflowPath = resolve(rootDir, workflowFile);
    if (!existsSync(workflowPath)) {
      fail(`${workflowFile} is missing.`);
    }
    const workflow = readFileSync(workflowPath, "utf8");
    if (!workflow.includes(`version: ${manifest.supabaseCliVersion}`)) {
      fail(`${workflowFile} must pin Supabase CLI ${manifest.supabaseCliVersion}.`);
    }
  }

  const deploymentWorkflow = readFileSync(
    resolve(rootDir, ".github/workflows/deploy-supabase.yml"),
    "utf8"
  );
  for (const requiredWorkflowBoundary of [
    "workflow_dispatch:",
    "group: supabase-production",
    "name: supabase-production",
    "github.ref != 'refs/heads/master'",
    "SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}",
    "SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}",
    "SUPABASE_PROJECT_ID: ${{ vars.SUPABASE_PROJECT_ID }}"
  ]) {
    if (!deploymentWorkflow.includes(requiredWorkflowBoundary)) {
      fail(`deploy-supabase.yml is missing boundary: ${requiredWorkflowBoundary}`);
    }
  }

  const baselineSql = manifest.preflightChecks
    .map((entry) => readFileSync(resolve(rootDir, entry.file), "utf8"))
    .join("\n");

  for (const version of manifest.requiredRemoteHistory) {
    if (!baselineSql.includes(`'${version}'`)) {
      fail(`remote history preflight does not assert required version ${version}.`);
    }
  }

  return manifest;
}

function validateCheckList(entries, label, requireRollbackDeclaration) {
  if (!Array.isArray(entries) || entries.length === 0) {
    fail(`${label} must be a non-empty list.`);
  }

  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.file !== "string" || !entry.file.endsWith(".sql")) {
      fail(`${label} contains an invalid SQL file entry.`);
    }

    if (isAbsolute(entry.file)) {
      fail(`${entry.file} must be repository-relative.`);
    }

    const absolutePath = resolve(rootDir, entry.file);
    const relativeToChecks = relative(checksDir, absolutePath);
    if (relativeToChecks.startsWith(`..${sep}`) || relativeToChecks === "..") {
      fail(`${entry.file} must stay inside supabase/checks/.`);
    }

    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      fail(`${entry.file} does not exist.`);
    }

    if (seen.has(entry.file)) {
      fail(`${label} contains duplicate file ${entry.file}.`);
    }
    seen.add(entry.file);

    if (typeof entry.purpose !== "string" || entry.purpose.trim().length < 12) {
      fail(`${entry.file} must document its remote verification purpose.`);
    }

    if (requireRollbackDeclaration) {
      if (entry.requiresRollback !== true) {
        fail(`${entry.file} must explicitly declare requiresRollback=true.`);
      }

      const sql = readFileSync(absolutePath, "utf8");
      if (!/\brollback\s*;/i.test(sql)) {
        fail(`${entry.file} declares rollback safety but contains no ROLLBACK statement.`);
      }
      if (/\bcommit\s*;/i.test(sql)) {
        fail(`${entry.file} is a remote verification file and must not contain COMMIT.`);
      }
    }
  }
}

function runCommand(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    fail(`unable to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function installedSupabaseVersion() {
  const result = spawnSync("supabase", ["--version"], {
    cwd: rootDir,
    env: process.env,
    encoding: "utf8"
  });

  if (result.error) {
    fail(`unable to run supabase --version: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail("supabase --version failed.");
  }

  const version = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.match(/\d+\.\d+\.\d+/)?.[0];
  if (!version) {
    fail("unable to parse the installed Supabase CLI version.");
  }
  return version;
}

const manifest = readManifest();

if (process.argv.includes("--validate-config")) {
  console.log(
    `Supabase remote deployment manifest verified: ${manifest.preflightChecks.length} preflight check(s), `
      + `${manifest.postMigrationChecks.length} post-migration check(s).`
  );
  process.exit(0);
}

const mode = optionValue("--mode") ?? process.env.SUPABASE_REMOTE_MODE ?? "dry-run";
if (!allowedModes.has(mode)) {
  fail(`mode must be one of: ${[...allowedModes].join(", ")}.`);
}

const projectRef = String(process.env.SUPABASE_PROJECT_ID ?? "").trim();
const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
const databasePassword = String(process.env.SUPABASE_DB_PASSWORD ?? "");
const confirmation = optionValue("--confirm-project-ref")
  ?? process.env.SUPABASE_REMOTE_CONFIRM_PROJECT_REF
  ?? "";

if (!/^[a-z0-9]{20}$/.test(projectRef)) {
  fail("SUPABASE_PROJECT_ID must be the exact 20-character hosted project ref.");
}
if (!accessToken) {
  fail("SUPABASE_ACCESS_TOKEN is required and must be provided through the environment.");
}
if (!databasePassword) {
  fail("SUPABASE_DB_PASSWORD is required and must be provided through the environment.");
}
if (mode === "apply" && confirmation !== projectRef) {
  fail("apply mode requires SUPABASE_REMOTE_CONFIRM_PROJECT_REF to exactly match the target project ref.");
}

const cliVersion = installedSupabaseVersion();
if (cliVersion !== manifest.supabaseCliVersion) {
  fail(
    `Supabase CLI ${cliVersion} does not match the pinned remote deployment version `
      + `${manifest.supabaseCliVersion}.`
  );
}

console.log(`Remote deployment mode: ${mode}`);
console.log(`Target project ref: ${projectRef}`);
console.log("Migration repair and --include-all are intentionally unavailable in this workflow.");

runCommand("supabase", ["link", "--project-ref", projectRef, "--yes"]);
runCommand("supabase", ["migration", "list", "--linked"]);

for (const check of manifest.preflightChecks) {
  runCommand("supabase", ["db", "query", "--linked", "--file", check.file]);
}

runCommand("supabase", ["db", "push", "--linked", "--dry-run"]);

if (mode === "dry-run") {
  console.log("\nDry run completed. No remote migration or post-migration check was applied.");
  process.exit(0);
}

if (mode === "apply") {
  runCommand("supabase", ["db", "push", "--linked", "--yes"]);
}

for (const check of manifest.postMigrationChecks) {
  runCommand("supabase", ["db", "query", "--linked", "--file", check.file]);
}

runCommand("supabase", ["migration", "list", "--linked"]);
console.log(`\nSupabase remote ${mode} workflow completed successfully.`);
