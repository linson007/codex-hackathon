#!/usr/bin/env node
import { Command, Option } from "commander";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { relative, resolve } from "node:path";
import ora from "ora";
import { answerQuestion, generateGraphItemDocumentation, generateRepositoryDocumentation } from "@contextos/ai";
import { scanRepository } from "@contextos/scanner";
import { ensureKbExists, kbRoot, knowledgeBasesRoot, listKnowledgeBases, openKnowledgeBase } from "@contextos/store";
import { buildJiraIssueFields, buildJiraPlan, createJiraIssueFromPlan, formatJiraPlan } from "./jira.js";

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
  .option("--verbose", "Print extra command details")
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
    validateChoice(action, ["add", "list", "remove"], "repos action");
    if (options.verbose) console.log(`Opening knowledge base '${kb}' at ${kbRoot(kb)}`);
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
  .option("--verbose", "Print each indexing step and disable spinner")
  .action(async (kb, options) => {
    const store = openKnowledgeBase(kb);
    try {
      const repos = store.getRepositories();
      if (!repos.length) throw new Error(`No repositories added to '${kb}'.`);
      await withSpinner(`Indexing ${repos.length} repositories`, Boolean(options.verbose), async () => {
        for (const repo of repos) {
          if (options.verbose) console.log(`Scanning ${repo.name}: ${repo.path}`);
          const result = scanRepository(repo);
          store.replaceGraphForRepository(repo, result.nodes, result.edges);
          console.log(`Indexed ${repo.name}: ${result.nodes.length} nodes, ${result.edges.length} edges`);
        }
      });
      if (options.generateDocs) await generateDocs(store, undefined, false, Boolean(options.verbose));
    } finally {
      store.close();
    }
  });

program
  .command("ask")
  .argument("<knowledge-base-name>")
  .argument("<question>")
  .option("--with-docs", "Include generated repository/service/endpoint docs as explanatory context")
  .option("--verbose", "Print evidence counts")
  .description("Ask a natural-language question")
  .action(async (kb, question, options) => {
    if (!question.trim()) throw new Error("Question must not be empty.");
    const store = openKnowledgeBase(kb);
    try {
      const result = await answerQuestion(store.searchEvidence(question, { includeDocs: Boolean(options.withDocs) }));
      if (options.verbose) {
        console.log(
          `evidence nodes=${result.evidence.nodes.length} edges=${result.evidence.edges.length} files=${result.evidence.suggestedFiles.length} docs=${result.evidence.docs?.length ?? 0}`
        );
      }
      console.log(result.answer);
      console.log(
        `\nmode=${result.mode}${result.model ? ` model=${result.model}` : ""} evidence=${options.withDocs ? "graph+docs" : "graph"}`
      );
    } finally {
      store.close();
    }
  });

program
  .command("export")
  .argument("<knowledge-base-name>")
  .addOption(new Option("--format <format>", "Export format").choices(["json"]).default("json"))
  .option("--no-pretty", "Print compact JSON")
  .description("Export a knowledge base for enterprise integrations")
  .action((kb, options) => {
    const store = openKnowledgeBase(kb);
    try {
      if (options.format !== "json") throw new Error("Only json export is supported.");
      console.log(JSON.stringify(store.enterpriseExport(), null, options.pretty === false ? 0 : 2));
    } finally {
      store.close();
    }
  });

program
  .command("jira-plan")
  .argument("<knowledge-base-name>")
  .option("--ticket <text>", "Ticket text to analyze", "Change refund eligibility logic")
  .option("--project <key>", "Jira project key, defaults to JIRA_PROJECT_KEY")
  .option("--issue-type <name>", "Jira issue type", process.env.JIRA_ISSUE_TYPE ?? "Task")
  .option("--create", "Create a real Jira Cloud issue using JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN")
  .option("--json", "Print Jira issue JSON payload instead of human-readable plan")
  .description("Build or create a Jira planning issue from ContextOS graph facts")
  .action(async (kb, options) => {
    const store = openKnowledgeBase(kb);
    try {
      const plan = buildJiraPlan(store.enterpriseExport(), options.ticket);
      const projectKey = options.project ?? process.env.JIRA_PROJECT_KEY ?? "CTX";
      if (options.json) {
        console.log(JSON.stringify(buildJiraIssueFields(plan, projectKey, options.issueType), null, 2));
        return;
      }
      console.log(formatJiraPlan(plan));
      if (!options.create) {
        console.log("Dry run only. Add --create and set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY to create it.");
        return;
      }
      const issue = await createJiraIssueFromPlan(plan, projectKey, options.issueType);
      console.log(`Created Jira issue ${issue.key}: ${issue.self}`);
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
  .option("--verbose", "Print launch details")
  .action((options) => {
    const apiPort = validatePort(options.port, "API port");
    const uiPort = validatePort(options.uiPort, "UI port");
    if (options.stop) {
      stopUi(apiPort, uiPort);
      return;
    }
    if (options.verbose) console.log(`Using ContextOS home: ${knowledgeBasesRoot()}`);
    const api = spawn("npm", ["run", "dev", "-w", "@contextos/api", "--", "--port", apiPort], {
      stdio: "inherit",
      shell: true,
      detached: process.platform !== "win32",
      env: { ...process.env, CONTEXTOS_API_PORT: apiPort }
    });
    const ui = spawn("npm", ["run", "dev", "-w", "@contextos/ui", "--", "--port", uiPort], {
      stdio: "inherit",
      shell: true,
      detached: process.platform !== "win32",
      env: { ...process.env, VITE_CONTEXTOS_API: `http://localhost:${apiPort}` }
    });
    console.log(`ContextOS API: http://localhost:${apiPort}`);
    console.log(`ContextOS UI:  http://localhost:${uiPort}`);

    superviseUiProcesses([
      { name: "API", child: api },
      { name: "UI", child: ui }
    ]);
  });

const docs = program.command("docs").description("Generate and inspect repository onboarding docs");

docs
  .command("generate")
  .argument("<knowledge-base-name>")
  .option("--repo <repo-name>", "Generate docs for one repository")
  .option("--force", "Regenerate even when cached docs are fresh")
  .option("--verbose", "Print skipped fresh docs and evidence details")
  .description("Generate cached repository onboarding docs")
  .action(async (kb, options) => {
    const store = openKnowledgeBase(kb);
    try {
      await generateDocs(store, options.repo, Boolean(options.force), Boolean(options.verbose));
    } finally {
      store.close();
    }
  });

docs
  .command("view")
  .argument("<knowledge-base-name>")
  .argument("<repo-name>")
  .addOption(new Option("--variant <variant>", "Doc variant to print").choices(["llm", "deterministic"]).default("llm"))
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
  .addOption(new Option("--variant <variant>", "Doc variant to print").choices(["llm", "deterministic"]).default("llm"))
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
  .option("--verbose", "Print port details")
  .action((options) => {
    const apiPort = validatePort(options.port, "API port");
    const uiPort = validatePort(options.uiPort, "UI port");
    if (options.verbose) console.log(`Stopping API port ${apiPort} and UI port ${uiPort}`);
    stopUi(apiPort, uiPort);
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

async function generateDocs(store: ReturnType<typeof openKnowledgeBase>, repoName?: string, force = false, verbose = false): Promise<void> {
  const repos = repoName ? store.getRepositories().filter((repo) => repo.name === repoName) : store.getRepositories();
  if (repoName && !repos.length) throw new Error(`Repository '${repoName}' is not registered.`);
  if (!repos.length) throw new Error("No repositories added.");

  for (const repo of repos) {
    const evidence = store.getRepositoryEvidence(repo.name);
    const existing = store.getRepositoryDoc(repo.name);
    if (!force && existing?.sourceFingerprint === evidence.sourceFingerprint) {
      if (verbose) console.log(`Docs fresh for ${repo.name}`);
    } else {
      const doc = await generateRepositoryDocumentation(evidence);
      store.saveRepositoryDoc(doc);
      console.log(`Generated docs for ${repo.name}: mode=${doc.mode}${doc.model ? ` model=${doc.model}` : ""}`);
    }

    for (const target of store.getDocTargets(repo.name)) {
      const itemEvidence = store.getGraphItemEvidence(target.id);
      const existingItem = store.getGraphItemDoc(target.id);
      if (!force && existingItem?.sourceFingerprint === itemEvidence.sourceFingerprint) {
        if (verbose) console.log(`Docs fresh for ${repo.name}/${target.name}`);
        continue;
      }
      const itemDoc = await generateGraphItemDocumentation(itemEvidence);
      store.saveGraphItemDoc(itemDoc);
      console.log(`Generated ${itemDoc.nodeKind.toLowerCase()} docs for ${repo.name}/${itemDoc.nodeName}: mode=${itemDoc.mode}`);
    }
  }
}

async function withSpinner<T>(text: string, verbose: boolean, task: () => Promise<T>): Promise<T> {
  if (verbose || !process.stderr.isTTY) return task();
  const spinner = ora(text).start();
  try {
    const result = await task();
    spinner.succeed(text);
    return result;
  } catch (error) {
    spinner.fail(text);
    throw error;
  }
}

function validateChoice(value: string, choices: string[], label: string): void {
  if (!choices.includes(value)) {
    throw new Error(`Invalid ${label}: ${value}. Expected one of: ${choices.join(", ")}`);
  }
}

function validatePort(value: string, label: string): string {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be an integer between 1 and 65535.`);
  }
  return String(port);
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

type ManagedChild = {
  name: string;
  child: ChildProcess;
};

function superviseUiProcesses(children: ManagedChild[]): void {
  let shuttingDown = false;
  const shutdown = (exitCode: number, reason: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Stopping ContextOS UI processes: ${reason}`);
    for (const item of children) {
      terminateChildTree(item.child, "SIGTERM");
    }
    const forceTimer = setTimeout(() => {
      for (const item of children) {
        terminateChildTree(item.child, "SIGKILL");
      }
      process.exit(exitCode);
    }, 2500);
    forceTimer.unref();

    let remaining = children.length;
    for (const item of children) {
      item.child.once("exit", () => {
        remaining -= 1;
        if (remaining === 0) {
          clearTimeout(forceTimer);
          process.exit(exitCode);
        }
      });
    }
  };

  process.once("SIGINT", () => shutdown(130, "received SIGINT"));
  process.once("SIGTERM", () => shutdown(143, "received SIGTERM"));
  for (const item of children) {
    item.child.once("exit", (code, signal) => {
      if (shuttingDown) return;
      const exitCode = code ?? (signal ? 1 : 0);
      const reason = `${item.name} process exited${code === null ? "" : ` with code ${code}`}${signal ? ` from ${signal}` : ""}`;
      shutdown(exitCode, reason);
    });
  }
}

function terminateChildTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid || child.killed) return;
  try {
    if (process.platform === "win32") {
      child.kill(signal);
      return;
    }
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Process may already be gone.
    }
  }
}
