#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const commands = [
  ["supabase", ["db", "start"]],
  ["supabase", ["db", "reset"]],
  ["supabase", ["db", "lint", "--level", "error"]],
  ["supabase", ["test", "db"]],
  ["deno", ["fmt", "--check", "--config", "supabase/functions/deno.json", "supabase/functions"]],
  ["deno", ["lint", "--config", "supabase/functions/deno.json", "supabase/functions"]],
  ["deno", ["task", "--config", "supabase/functions/deno.json", "check"]],
  ["deno", ["task", "--config", "supabase/functions/deno.json", "test"]]
];

for (const [command, args] of commands) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(`Unable to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nSupabase preparation checks passed.");
