import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const cli = resolve(root, "bin", "contextos.js");
const commands = [
  [],
  ["kbs", "--help"],
  ["repos", "--help"],
  ["update", "--help"],
  ["ask", "--help"],
  ["docs", "--help"],
  ["docs", "generate", "--help"],
  ["docs", "view", "--help"],
  ["docs", "view-node", "--help"],
  ["ui", "--help"],
  ["stopui", "--help"]
];

const sections = commands.map((args) => {
  const title = args.length ? `contextos ${args.filter((arg) => arg !== "--help").join(" ")}` : "contextos";
  const result = spawnSync(process.execPath, [cli, ...args, ...(args.includes("--help") ? [] : ["--help"])], {
    cwd: root,
    encoding: "utf8",
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`Failed to generate help for ${title}: ${result.stderr || result.stdout}`);
  }
  return `## ${title}\n\n\`\`\`text\n${result.stdout.trim()}\n\`\`\``;
});

writeFileSync(
  resolve(root, "CLI-REF.md"),
  `# ContextOS CLI Reference\n\nGenerated from Commander help output.\n\n${sections.join("\n\n")}\n`
);
console.log("Generated CLI-REF.md");
