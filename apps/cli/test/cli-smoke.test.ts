import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ensureKbExists, openKnowledgeBase } from "@contextos/store";
import { scanRepository } from "@contextos/scanner";
import { answerQuestion } from "@contextos/ai";

describe("ContextOS smoke flow", () => {
  it("indexes samples and returns fallback answer without OpenAI", async () => {
    const cwd = mkdtempSync(resolve(tmpdir(), "contextos-"));
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      ensureKbExists("retail-platform", cwd);
      const store = openKnowledgeBase("retail-platform", cwd);
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
      store.close();
    } finally {
      if (previousKey) process.env.OPENAI_API_KEY = previousKey;
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
