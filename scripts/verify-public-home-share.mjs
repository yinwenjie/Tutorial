import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const rootDir = process.cwd();
const failures = [];
const shareModule = loadTypeScriptModule("src/domain/public-home-share.ts");

verifyTokens(shareModule);
verifyDatabaseContract();

if (failures.length > 0) {
  console.error("Public home share verification failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Public home share token and database contract verified.");

function verifyTokens(share) {
  const tokens = new Set();

  for (let index = 0; index < 24; index += 1) {
    const token = share.createPublicHomeShareToken();
    tokens.add(token);
    expectEqual(token.length, share.PUBLIC_HOME_SHARE_TOKEN_LENGTH, "tokens should use the v1 Base64URL length");
    expectTrue(share.isPublicHomeShareToken(token), "generated tokens should pass the strict v1 parser");
    expectTrue(/^[A-Za-z0-9_-]+$/.test(token), "generated tokens should be unpadded Base64URL");
  }

  expectEqual(tokens.size, 24, "test tokens should be independently generated");
  expectFalse(share.isPublicHomeShareToken("A".repeat(42)), "short tokens should fail");
  expectFalse(share.isPublicHomeShareToken("A".repeat(44)), "long tokens should fail");
  expectFalse(share.isPublicHomeShareToken(`${"A".repeat(42)}=`), "padding should fail");
  expectFalse(share.isPublicHomeShareToken("not-a-token"), "arbitrary values should fail");
}

function verifyDatabaseContract() {
  const migration = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/017_public_home_shares.sql"),
    "utf8"
  );
  const check = fs.readFileSync(
    path.join(rootDir, "supabase/checks/019_public_home_shares_verify.sql"),
    "utf8"
  );

  for (const fragment of [
    "create table if not exists public.public_home_shares",
    "foreign key (home_space_id, user_id)",
    "references public.home_spaces(id, user_id)",
    "unique (home_space_id)",
    "unique (token_hash)",
    "alter table public.public_home_shares enable row level security",
    "revoke all on table public.public_home_shares from public",
    "create or replace function public.public_home_document_v1_valid",
    "create or replace function public.hash_public_home_share_token",
    "mylinker-public-share-v1:",
    "create or replace function public.upsert_public_home_share",
    "create or replace function public.get_public_home_share_metadata",
    "create or replace function public.revoke_public_home_share",
    "create or replace function public.read_public_home_share",
    "grant execute on function public.read_public_home_share(text) to anon, authenticated"
  ]) {
    expectTrue(migration.includes(fragment), `migration should contain ${fragment}`);
  }

  expectFalse(
    /grant execute on function public\.(upsert_public_home_share|get_public_home_share_metadata|revoke_public_home_share)\([^\n]+\) to [^\n]*\banon\b/i.test(migration),
    "owner RPCs must not grant anon execution"
  );
  expectTrue(check.includes("Optional A/B functional verification"), "check script should contain the rollback A/B verification");
}

function loadTypeScriptModule(relativePath) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const sandbox = {
    Uint8Array,
    crypto: globalThis.crypto,
    btoa: globalThis.btoa,
    module: { exports: {} },
    exports: {}
  };

  vm.runInNewContext(transpiled, sandbox, { filename: relativePath });
  return sandbox.exports;
}

function expectEqual(actual, expected, message) {
  if (actual !== expected) {
    failures.push(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectTrue(value, message) {
  if (!value) {
    failures.push(message);
  }
}

function expectFalse(value, message) {
  if (value) {
    failures.push(message);
  }
}
