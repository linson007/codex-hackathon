#!/usr/bin/env node
import { Command } from "commander";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { relative, resolve } from "node:path";
import { answerQuestion, generateGraphItemDocumentation, generateRepositoryDocumentation } from "@contextos/ai";
import { scanRepository } from "@contextos/scanner";
import { ensureKbExists, kbRoot, knowledgeBasesRoot, listKnowledgeBases, openKnowledgeBase } from "@contextos/store";

const program = new Command();

program.name("contextos").description("AI knowledge graph for enterprise microservices").version("0.1.0");

program
  .command("init")
  .argument("<knowledge-base-name>")
  .description("Initialize a new knowledge base")
  .action((kb) => {
    ensureKbExists(kb);
    console.log(`Initialized knowledge base '${kb}' at ${kbRoot(kb)}`);
  });

const kbs = program.command("kbs").description("Manage local knowledge bases");

kbs
  .command("list", { isDefault: true })
  .description("List local knowledge bases")
  .action(() => {
    printKnowledgeBases();
  });

kbs
  .command("remove")
  .alias("delete")
  .argument("<knowledge-base-name>")
  .description("Remove a local knowledge base")
  .action((name) => {
    removeKnowledgeBase(name);
  });

program
  .command("repos")
  .description("Manage repositories linked to a knowledge base")
  .option("--all", "List all local knowledge bases")
  .argument("[action]")
  .argument("[kb]")
  .argument("[repo]")
  .action((action, kb, repo, options) => {
    if (options.all) {
      printKnowledgeBases();
      return;
    }
    if (!action || !kb) {
      throw new Error("Usage: contextos repos <add|list|remove> <kb> [repo]");
    }
    const store = openKnowledgeBase(kb);
    try {
      if (action === "add") {
        if (!repo) throw new Error("Repository path is required.");
        if (!existsSync(repo)) throw new Error(`Repository path does not exist: ${repo}`);
        const record = store.addRepository(repo);
        console.log(`Added ${record.name}: ${record.path}`);
      } else if (action === "list") {
        const repos = store.getRepositories();
        if (!repos.length) {
          console.log("No repositories added.");
          return;
        }
        for (const item of repos) {
          console.log(`${item.name}\t${item.path}\tindexed=${item.lastIndexedAt ?? "never"}`);
        }
      } else if (action === "remove") {
        if (!repo) throw new Error("Repository path, name, or id is required.");
        console.log(`Removed ${store.removeRepository(repo)} repository record(s).`);
      } else {
        throw new Error(`Unknown repos action: ${action}`);
      }
    } finally {
      store.close();
    }
  });

program
  .command("update")
  .argument("<knowledge-base-name>")
  .description("Refresh a knowledge base using current repository state")
  .option("--generate-docs", "Generate or refresh cached repository onboarding docs after scanning")
  .action(async (kb, options) => {
    const store = openKnowledgeBase(kb);
    try {
      const repos = store.getRepositories();
      if (!repos.length) throw new Error(`No repositories added to '${kb}'.`);
      for (const repo of repos) {
        const result = scanRepository(repo);
        store.replaceGraphForRepository(repo, result.nodes, result.edges);
        console.log(`Indexed ${repo.name}: ${result.nodes.length} nodes, ${result.edges.length} edges`);
      }
      if (options.generateDocs) {
        await generateDocs(store);
      }
    } finally {
      store.close();
    }
  });

program
  .command("ask")
  .argument("<knowledge-base-name>")
  .argument("<question>")
  .option("--with-docs", "Include generated repository/service/endpoint docs as explanatory context")
  .description("Ask a natural-language question")
  .action(async (kb, question, options) => {
    const store = openKnowledgeBase(kb);
    try {
      const result = await answerQuestion(store.searchEvidence(question, { includeDocs: Boolean(options.withDocs) }));
      console.log(result.answer);
      console.log(`\nmode=${result.mode}${result.model ? ` model=${result.model}` : ""} evidence=${options.withDocs ? "graph+docs" : "graph"}`);
    } finally {
      store.close();
    }
  });

program
  .command("ui")
  .description("Launch the local API and web UI for all knowledge bases")
  .option("-p, --port <port>", "API port", "4317")
  .option("--ui-port <port>", "UI port", "5173")
  .option("--stop", "Stop API and UI processes running on the configured ports")
  .action((options) => {
    const apiPort = String(options.port);
    const uiPort = String(options.uiPort);
    if (options.stop) {
      stopUi(apiPort, uiPort);
      return;
    }
    const api = spawn("npm", ["run", "dev", "-w", "@contextos/api", "--", "--port", apiPort], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, CONTEXTOS_API_PORT: apiPort }
    });
    const ui = spawn("npm", ["run", "dev", "-w", "@contextos/ui", "--", "--port", uiPort], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, VITE_CONTEXTOS_API: `http://localhost:${apiPort}` }
    });
    console.log(`ContextOS API: http://localhost:${apiPort}`);
    console.log(`ContextOS UI:  http://localhost:${uiPort}`);

    const stop = () => {
      api.kill("SIGTERM");
      ui.kill("SIGTERM");
    };
    process.on("SIGINT", () => {
      stop();
      process.exit(130);
    });
    process.on("SIGTERM", () => {
      stop();
      process.exit(143);
    });
    api.on("exit", (code) => {
      ui.kill("SIGTERM");
      process.exit(code ?? 0);
    });
    ui.on("exit", (code) => {
      api.kill("SIGTERM");
      process.exit(code ?? 0);
    });
  });

const docs = program.command("docs").description("Generate and inspect repository onboarding docs");

docs
  .command("generate")
  .argument("<knowledge-base-name>")
  .option("--repo <repo-name>", "Generate docs for one repository")
  .option("--force", "Regenerate even when cached docs are fresh")
  .description("Generate cached repository onboarding docs")
  .action(async (kb, options) => {
    const store = openKnowledgeBase(kb);
    try {
      await generateDocs(store, options.repo, Boolean(options.force));
    } finally {
      store.close();
    }
  });

docs
  .command("view")
  .argument("<knowledge-base-name>")
  .argument("<repo-name>")
  .option("--variant <variant>", "Doc variant to print: llm or deterministic", "llm")
  .description("Print cached repository onboarding docs")
  .action((kb, repoName, options) => {
    const store = openKnowledgeBase(kb);
    try {
      const doc = store.getRepositoryDoc(repoName);
      if (!doc) throw new Error(`No docs found for '${repoName}'. Run: contextos docs generate ${kb} --repo ${repoName}`);
      console.log(selectDocMarkdown(doc, options.variant));
    } finally {
      store.close();
    }
  });

docs
  .command("view-node")
  .argument("<knowledge-base-name>")
  .argument("<node-id>")
  .option("--variant <variant>", "Doc variant to print: llm or deterministic", "llm")
  .description("Print cached service or endpoint onboarding docs")
  .action((kb, nodeId, options) => {
    const store = openKnowledgeBase(kb);
    try {
      const doc = store.getGraphItemDoc(nodeId);
      if (!doc) throw new Error(`No docs found for node '${nodeId}'. Run: contextos docs generate ${kb}`);
      console.log(selectDocMarkdown(doc, options.variant));
    } finally {
      store.close();
    }
  });

program
  .command("stopui")
  .description("Stop the local ContextOS API and UI")
  .option("-p, --port <port>", "API port", "4317")
  .option("--ui-port <port>", "UI port", "5173")
  .action((options) => {
    stopUi(String(options.port), String(options.uiPort));
  });

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function printKnowledgeBases(): void {
  const kbs = listKnowledgeBases();
  if (!kbs.length) {
    console.log("No knowledge bases found.");
    return;
  }
  printTable(
    ["Knowledge Base", "Repos", "Nodes", "Edges", "Created On", "Last Updated On"],
    kbs.map((kb) => [
      kb.name,
      String(kb.repositoryCount),
      String(kb.nodeCount),
      String(kb.edgeCount),
      formatDate(kb.createdOn),
      formatDate(kb.lastUpdatedOn)
    ])
  );
}

function selectDocMarkdown(doc: { markdown: string; deterministicMarkdown?: string; llmMarkdown?: string }, variant: string): string {
  if (variant === "deterministic") return doc.deterministicMarkdown ?? doc.markdown;
  if (variant === "llm") return doc.llmMarkdown ?? doc.markdown;
  throw new Error("--variant must be 'llm' or 'deterministic'");
}

async function generateDocs(store: ReturnType<typeof openKnowledgeBase>, repoName?: string, force = false): Promise<void> {
  const repos = repoName ? store.getRepositories().filter((repo) => repo.name === repoName) : store.getRepositories();
  if (repoName && !repos.length) throw new Error(`Repository '${repoName}' is not registered.`);
  if (!repos.length) throw new Error("No repositories added.");

  for (const repo of repos) {
    const evidence = store.getRepositoryEvidence(repo.name);
    const existing = store.getRepositoryDoc(repo.name);
    if (!force && existing?.sourceFingerprint === evidence.sourceFingerprint) {
      console.log(`Docs fresh for ${repo.name}`);
    } else {
      const doc = await generateRepositoryDocumentation(evidence);
      store.saveRepositoryDoc(doc);
      console.log(`Generated docs for ${repo.name}: mode=${doc.mode}${doc.model ? ` model=${doc.model}` : ""}`);
    }

    for (const target of store.getDocTargets(repo.name)) {
      const itemEvidence = store.getGraphItemEvidence(target.id);
      const existingItem = store.getGraphItemDoc(target.id);
      if (!force && existingItem?.sourceFingerprint === itemEvidence.sourceFingerprint) continue;
      const itemDoc = await generateGraphItemDocumentation(itemEvidence);
      store.saveGraphItemDoc(itemDoc);
      console.log(`Generated ${itemDoc.nodeKind.toLowerCase()} docs for ${repo.name}/${itemDoc.nodeName}: mode=${itemDoc.mode}`);
    }
  }
}

function removeKnowledgeBase(name: string): void {
  const root = resolve(knowledgeBasesRoot());
  const target = resolve(kbRoot(name));
  const rel = relative(root, target);
  if (rel.startsWith("..") || rel === "" || rel.includes(":")) {
    throw new Error(`Refusing to remove path outside knowledge base root: ${target}`);
  }
  if (!existsSync(target)) {
    console.log(`Knowledge base '${name}' does not exist.`);
    return;
  }
  rmSync(target, { recursive: true, force: true });
  console.log(`Removed knowledge base '${name}' from ${target}`);
}

function formatDate(value: string | undefined): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index].length)));
  const formatRow = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index])).join("  ");
  console.log(formatRow(headers));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

function stopUi(apiPort: string, uiPort: string): void {
  const apiStopped = stopPort(apiPort);
  const uiStopped = stopPort(uiPort);
  console.log(`${apiStopped ? "Stopped" : "No process found on"} API port ${apiPort}`);
  console.log(`${uiStopped ? "Stopped" : "No process found on"} UI port ${uiPort}`);
}

function stopPort(port: string): boolean {
  const result = spawnSync("lsof", ["-ti", `:${port}`], { encoding: "utf8" });
  const pids = result.stdout
    .split(/\s+/)
    .map((pid) => Number(pid))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process may already be gone.
    }
  }
  return pids.length > 0;
}
