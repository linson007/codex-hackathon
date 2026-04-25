import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { scanRepository } from "../src/index";

describe("scanRepository", () => {
  it("extracts Spring services, endpoints, topics, entities, and tables", () => {
    const result = scanRepository({
      id: "repo:test",
      name: "order-service",
      path: resolve("samples/retail-platform/order-service"),
      addedAt: new Date().toISOString()
    });

    expect(result.nodes.some((node) => node.kind === "Endpoint" && node.name.includes("/orders"))).toBe(true);
    expect(result.nodes.some((node) => node.kind === "Service" && node.name === "RefundEligibilityService")).toBe(true);
    expect(result.nodes.some((node) => node.kind === "Entity" && node.name === "Order")).toBe(true);
    expect(result.nodes.some((node) => node.kind === "Table" && node.name === "orders")).toBe(true);
    expect(result.nodes.some((node) => node.kind === "Topic" && node.name === "refund-events")).toBe(true);
  });
});
