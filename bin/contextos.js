#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(root, "apps", "cli", "src", "index.ts");
const require = createRequire(import.meta.url);

let tsxCli;
try {
  tsxCli = require.resolve("tsx/cli");
} catch {
  console.error("Unable to resolve the tsx runtime. Run `npm install` from the repository root and try again.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [tsxCli, cli, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
