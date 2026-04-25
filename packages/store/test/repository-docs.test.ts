import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { CURRENT_SCHEMA_VERSION, ensureKbExists, openKnowledgeBase, stableId, type GraphNode } from "../src/index";

describe("repository docs storage", () => {
  it("stores docs and marks them stale when the graph fingerprint changes", () => {
    const home = mkdtempSync(resolve(tmpdir(), "contextos-store-"));
    const previousHome = process.env.CONTEXTOS_HOME;
    process.env.CONTEXTOS_HOME = home;
    try {
      ensureKbExists("docs-test");
      const store = openKnowledgeBase("docs-test");
      const repo = store.addRepository(resolve("samples/retail-platform/order-service"));
      const node = graphNode("Endpoint", "GET /orders", repo.name);
      store.replaceGraphForRepository(repo, [node], []);
      const evidence = store.getRepositoryEvidence(repo.name);
      store.saveRepositoryDoc({
        repoId: repo.id,
        repoName: repo.name,
        summary: "LLM order service summary",
        markdown: "# LLM order-service",
        generatedAt: new Date().toISOString(),
        sourceFingerprint: evidence.sourceFingerprint,
        model: "gpt-5.2",
        mode: "openai",
        deterministicSummary: "Order service summary",
        deterministicMarkdown: "# order-service",
        deterministicGeneratedAt: new Date().toISOString(),
        llmSummary: "LLM order service summary",
        llmMarkdown: "# LLM order-service",
        llmGeneratedAt: new Date().toISOString(),
        llmModel: "gpt-5.2"
      });

      const doc = store.getRepositoryDoc(repo.name);
      expect(doc?.summary).toBe("LLM order service summary");
      expect(doc?.markdown).toBe("# LLM order-service");
      expect(doc?.deterministicSummary).toBe("Order service summary");
      expect(doc?.deterministicMarkdown).toBe("# order-service");
      expect(doc?.llmMarkdown).toBe("# LLM order-service");
      expect(store.getRepositoryOverviews()[0].docStale).toBe(false);

      store.replaceGraphForRepository(repo, [node, graphNode("Table", "orders", repo.name)], []);
      expect(store.getRepositoryOverviews()[0].docStale).toBe(true);
      store.close();
    } finally {
      if (previousHome) process.env.CONTEXTOS_HOME = previousHome;
      else delete process.env.CONTEXTOS_HOME;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("records the SQLite schema version and rejects newer schemas", () => {
    const home = mkdtempSync(resolve(tmpdir(), "contextos-store-"));
    const previousHome = process.env.CONTEXTOS_HOME;
    process.env.CONTEXTOS_HOME = home;
    try {
      ensureKbExists("schema-test");
      const store = openKnowledgeBase("schema-test");
      const dbPath = store.dbPath;
      store.close();

      const db = new Database(dbPath);
      try {
        expect(db.prepare("select value from schema_meta where key = 'schema_version'").get()).toMatchObject({
          value: String(CURRENT_SCHEMA_VERSION)
        });
        db.prepare("update schema_meta set value = ? where key = 'schema_version'").run(String(CURRENT_SCHEMA_VERSION + 1));
      } finally {
        db.close();
      }

      expect(() => openKnowledgeBase("schema-test")).toThrow(/newer than this app supports/);
    } finally {
      if (previousHome) process.env.CONTEXTOS_HOME = previousHome;
      else delete process.env.CONTEXTOS_HOME;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("exports an enterprise integration payload", () => {
    const home = mkdtempSync(resolve(tmpdir(), "contextos-store-"));
    const previousHome = process.env.CONTEXTOS_HOME;
    process.env.CONTEXTOS_HOME = home;
    try {
      ensureKbExists("export-test");
      const store = openKnowledgeBase("export-test");
      const repo = store.addRepository(resolve("samples/retail-platform/order-service"));
      const service = graphNode("Service", "RefundEligibilityService", repo.name);
      const endpoint = graphNode("Endpoint", "POST /orders/{orderId}/refund-eligibility", repo.name);
      const edge = {
        id: stableId("edge", `${service.id}:exposes:${endpoint.id}`),
        fromId: service.id,
        toId: endpoint.id,
        kind: "exposes" as const,
        metadata: {}
      };
      store.replaceGraphForRepository(repo, [service, endpoint], [edge]);

      const exported = store.enterpriseExport();

      expect(exported.knowledgeBase.name).toBe("export-test");
      expect(exported.repositories).toHaveLength(1);
      expect(exported.catalog.services.some((node) => node.name === "RefundEligibilityService")).toBe(true);
      expect(exported.catalog.endpoints.some((node) => node.name.includes("refund-eligibility"))).toBe(true);
      expect(exported.relationships[0].from?.name).toBe("RefundEligibilityService");
      expect(exported.integrationHints.backstage[0]).toContain("order-service");
      store.close();
    } finally {
      if (previousHome) process.env.CONTEXTOS_HOME = previousHome;
      else delete process.env.CONTEXTOS_HOME;
      rmSync(home, { recursive: true, force: true });
    }
  });
});

function graphNode(kind: GraphNode["kind"], name: string, repo: string): GraphNode {
  return {
    id: stableId("node", `${kind}:${repo}:${name}`),
    kind,
    name,
    repo,
    metadata: {}
  };
}
