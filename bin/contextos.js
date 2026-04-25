#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsxBin = resolve(root, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const cli = resolve(root, "apps", "cli", "src", "index.ts");

const result = spawnSync(tsxBin, [cli, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
