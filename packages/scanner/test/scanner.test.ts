import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

  it("detects Feign clients and links them to their target service", () => {
    const result = scanRepository({
      id: "repo:test",
      name: "order-service",
      path: resolve("samples/retail-platform/order-service"),
      addedAt: new Date().toISOString()
    });

    const client = result.nodes.find((node) => node.name === "BillingClient");
    const target = result.nodes.find((node) => node.name === "billing-service" && node.metadata?.external === true);

    expect(client?.metadata?.stereotype).toBe("FeignClient");
    expect(client?.metadata?.target).toBe("billing-service");
    expect(target).toBeDefined();
    expect(result.edges.some((edge) => edge.fromId === client?.id && edge.toId === target?.id && edge.kind === "calls")).toBe(true);
  });

  it("detects Kafka listener topics and producer topic references", () => {
    const notification = scanRepository({
      id: "repo:notification",
      name: "notification-service",
      path: resolve("samples/retail-platform/notification-service"),
      addedAt: new Date().toISOString()
    });
    const billing = scanRepository({
      id: "repo:billing",
      name: "billing-service",
      path: resolve("samples/retail-platform/billing-service"),
      addedAt: new Date().toISOString()
    });

    const listener = notification.nodes.find((node) => node.name === "RefundNotificationListener");
    const consumedTopic = notification.nodes.find((node) => node.kind === "Topic" && node.name === "refund-events");
    const publisher = billing.nodes.find((node) => node.name === "RefundPaymentService");
    const publishedTopic = billing.nodes.find((node) => node.kind === "Topic" && node.name === "refund-events");

    expect(
      notification.edges.some((edge) => edge.fromId === listener?.id && edge.toId === consumedTopic?.id && edge.kind === "consumes")
    ).toBe(true);
    expect(
      billing.edges.some((edge) => edge.fromId === publisher?.id && edge.toId === publishedTopic?.id && edge.kind === "depends_on")
    ).toBe(true);
  });

  it("detects SQL migration tables and entity-to-table relationships", () => {
    const result = scanRepository({
      id: "repo:test",
      name: "order-service",
      path: resolve("samples/retail-platform/order-service"),
      addedAt: new Date().toISOString()
    });

    const orderEntity = result.nodes.find((node) => node.kind === "Entity" && node.name === "Order");
    const ordersTable = result.nodes.find((node) => node.kind === "Table" && node.name === "orders");
    const refundDecisionsTable = result.nodes.find((node) => node.kind === "Table" && node.name === "refund_decisions");

    expect(orderEntity).toBeDefined();
    expect(ordersTable).toBeDefined();
    expect(refundDecisionsTable).toBeDefined();
    expect(result.edges.some((edge) => edge.fromId === orderEntity?.id && edge.toId === ordersTable?.id && edge.kind === "writes")).toBe(
      true
    );
  });

  it("detects a RestController endpoint in a tiny Java repo", () => {
    const root = mkdtempSync(join(tmpdir(), "contextos-scanner-"));
    try {
      const sourceDir = join(root, "src/main/java/com/example");
      mkdirSync(sourceDir, { recursive: true });
      writeFileSync(
        join(sourceDir, "HelloController.java"),
        `package com.example;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class HelloController {
  @GetMapping("/hello")
  String hello() {
    return "ok";
  }
}
`
      );

      const result = scanRepository({
        id: "repo:tiny",
        name: "tiny-service",
        path: root,
        addedAt: new Date().toISOString()
      });

      expect(result.nodes.some((node) => node.kind === "Service" && node.name === "HelloController")).toBe(true);
      expect(result.nodes.some((node) => node.kind === "Endpoint" && node.name === "GET /hello")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
