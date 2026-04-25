import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("../..", import.meta.url).pathname);
const diagramsDir = join(root, "docs", "architecture", "diagrams");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const mermaidScript = join(root, "node_modules", "mermaid", "dist", "mermaid.min.js");
const files = process.argv.slice(2);
const inputs = files.length ? files : [
  "component-diagram.mmd",
  "update-flow.mmd",
  "docs-generation-flow.mmd",
  "ask-flow.mmd",
  "ask-with-docs-flow.mmd",
  "ui-flow.mmd"
];

for (const file of inputs) {
  const inputPath = join(diagramsDir, file);
  const outputPath = inputPath.replace(/\.mmd$/, ".svg");
  const source = readFileSync(inputPath, "utf8");
  const htmlPath = join(mkdtempSync(join(tmpdir(), "contextos-mermaid-")), "render.html");
  writeFileSync(
    htmlPath,
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="file://${mermaidScript}"></script>
  </head>
  <body>
    <div class="mermaid">${escapeHtml(source)}</div>
    <script>
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        flowchart: { htmlLabels: false }
      });
      mermaid.run().then(() => {
        document.body.setAttribute("data-rendered", "true");
      }).catch((error) => {
        document.body.setAttribute("data-error", String(error && error.message || error));
      });
    </script>
  </body>
</html>`
  );
  const result = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--allow-file-access-from-files",
      "--virtual-time-budget=5000",
      "--dump-dom",
      `file://${htmlPath}`
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`Chrome failed for ${file}: ${result.stderr || result.stdout}`);
  }
  const svg = extractSvg(result.stdout);
  writeFileSync(outputPath, svg);
  console.log(`Rendered ${basename(outputPath)}`);
}

function extractSvg(html) {
  const match = html.match(/<svg[\s\S]*<\/svg>/);
  if (!match) {
    throw new Error(`No SVG found in rendered HTML:\n${html.slice(0, 1000)}`);
  }
  return `${match[0]}\n`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
