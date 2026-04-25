import { describe, expect, it } from "vitest";
import type { EnterpriseExport } from "@contextos/store";
import { buildJiraIssueFields, buildJiraPlan } from "../src/jira";

describe("Jira planning", () => {
  it("builds a Jira issue payload from enterprise export facts", () => {
    const exported: EnterpriseExport = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      knowledgeBase: {
        name: "retail-platform",
        root: "/tmp/kb",
        repositoryCount: 1,
        nodeCount: 4,
        edgeCount: 2
      },
      repositories: [],
      catalog: {
        controllers: [],
        clients: [],
        services: [
          {
            id: "service:refund",
            kind: "Service",
            name: "RefundEligibilityService",
            repo: "order-service",
            filePath: "/repo/RefundEligibilityService.java",
            metadata: { stereotype: "Service" }
          }
        ],
        endpoints: [
          {
            id: "endpoint:refund",
            kind: "Endpoint",
            name: "POST /orders/{orderId}/refund-eligibility",
            repo: "order-service"
          }
        ],
        tables: [{ id: "table:orders", kind: "Table", name: "orders", repo: "order-service" }],
        topics: [{ id: "topic:refund-events", kind: "Topic", name: "refund-events", repo: "order-service" }]
      },
      relationships: [
        {
          id: "edge:1",
          fromId: "service:refund",
          toId: "endpoint:refund",
          kind: "exposes",
          from: {
            id: "service:refund",
            kind: "Service",
            name: "RefundEligibilityService",
            repo: "order-service",
            filePath: "/repo/RefundEligibilityService.java",
            metadata: { stereotype: "Service" }
          },
          to: {
            id: "endpoint:refund",
            kind: "Endpoint",
            name: "POST /orders/{orderId}/refund-eligibility",
            repo: "order-service"
          }
        }
      ],
      docs: { repositories: [], items: [] },
      integrationHints: { backstage: [], jira: [], git: [], observability: [] }
    };

    const plan = buildJiraPlan(exported, "Change refund eligibility logic");
    const payload = buildJiraIssueFields(plan, "CTX", "Task");

    expect(plan.impactedServices).toContain("RefundEligibilityService (order-service)");
    expect(plan.impactedEndpoints).toContain("POST /orders/{orderId}/refund-eligibility (order-service)");
    expect(payload.fields.project.key).toBe("CTX");
    expect(payload.fields.description.type).toBe("doc");
  });
});
