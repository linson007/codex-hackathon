import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ensureKbExists, openKnowledgeBase } from "@contextos/store";
import { scanRepository } from "@contextos/scanner";
import { answerQuestion, generateGraphItemDocumentation, generateRepositoryDocumentation } from "@contextos/ai";

describe("ContextOS smoke flow", () => {
  it("indexes samples and returns fallback answer without OpenAI", async () => {
    const cwd = mkdtempSync(resolve(tmpdir(), "contextos-"));
    const previousKey = process.env.OPENAI_API_KEY;
    const previousHome = process.env.CONTEXTOS_HOME;
    delete process.env.OPENAI_API_KEY;
    process.env.CONTEXTOS_HOME = cwd;
    try {
      ensureKbExists("retail-platform");
      const store = openKnowledgeBase("retail-platform");
      const repos = ["order-service", "billing-service", "notification-service"].map((name) =>
        store.addRepository(resolve("samples/retail-platform", name))
      );
      for (const repo of repos) {
        store.replaceGraphForRepository(repo, scanRepository(repo).nodes, scanRepository(repo).edges);
      }
      const result = await answerQuestion(store.searchEvidence("What is impacted if I change refund eligibility logic?"));
      expect(result.mode).toBe("fallback");
      expect(result.answer).toContain("order-service");
      expect(result.answer).toContain("refund-events");
      const doc = await generateRepositoryDocumentation(store.getRepositoryEvidence("order-service"));
      store.saveRepositoryDoc(doc);
      const itemTarget = store.getDocTargets("order-service").find((node) => node.kind === "Endpoint");
      expect(itemTarget).toBeTruthy();
      const itemDoc = await generateGraphItemDocumentation(store.getGraphItemEvidence(itemTarget!.id));
      store.saveGraphItemDoc(itemDoc);
      expect(itemDoc.markdown).toContain("## Request Flow");
      expect(doc.mode).toBe("fallback");
      expect(doc.markdown).toContain("## APIs");
      expect(store.getRepositoryOverviews().find((repo) => repo.name === "order-service")?.docSummary).toBeTruthy();
      store.close();
    } finally {
      if (previousKey) process.env.OPENAI_API_KEY = previousKey;
      if (previousHome) process.env.CONTEXTOS_HOME = previousHome;
      else delete process.env.CONTEXTOS_HOME;
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
