#!/usr/bin/env node
import { Command } from "commander";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { answerQuestion } from "@contextos/ai";
import { scanRepository } from "@contextos/scanner";
import { ensureKbExists, openKnowledgeBase } from "@contextos/store";

const program = new Command();

program.name("contextos").description("AI knowledge graph for enterprise microservices").version("0.1.0");

program
  .command("init")
  .argument("<knowledge-base-name>")
  .description("Initialize a new knowledge base")
  .action((kb) => {
    ensureKbExists(kb);
    console.log(`Initialized knowledge base '${kb}' at .contextos/kbs/${kb}`);
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
      console.log(".contextos/kbs");
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
  .action((kb) => {
    const store = openKnowledgeBase(kb);
    try {
      const repos = store.getRepositories();
      if (!repos.length) throw new Error(`No repositories added to '${kb}'.`);
      for (const repo of repos) {
        const result = scanRepository(repo);
        store.replaceGraphForRepository(repo, result.nodes, result.edges);
        console.log(`Indexed ${repo.name}: ${result.nodes.length} nodes, ${result.edges.length} edges`);
      }
    } finally {
      store.close();
    }
  });

program
  .command("ask")
  .argument("<knowledge-base-name>")
  .argument("<question>")
  .description("Ask a natural-language question")
  .action(async (kb, question) => {
    const store = openKnowledgeBase(kb);
    try {
      const result = await answerQuestion(store.searchEvidence(question));
      console.log(result.answer);
      console.log(`\nmode=${result.mode}${result.model ? ` model=${result.model}` : ""}`);
    } finally {
      store.close();
    }
  });

program
  .command("ui")
  .argument("<knowledge-base-name>")
  .description("Launch the local web UI")
  .option("-p, --port <port>", "API port", "4317")
  .action((kb, options) => {
    const child = spawn("npm", ["run", "dev", "-w", "@contextos/api", "--", "--kb", kb, "--port", options.port], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, CONTEXTOS_KB: kb, CONTEXTOS_API_PORT: options.port }
    });
    child.on("exit", (code) => process.exit(code ?? 0));
  });

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
