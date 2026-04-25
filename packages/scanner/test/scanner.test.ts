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

  it("links controllers to referenced service classes", () => {
    const result = scanRepository({
      id: "repo:test",
      name: "order-service",
      path: resolve("samples/retail-platform/order-service"),
      addedAt: new Date().toISOString()
    });

    const controller = result.nodes.find((node) => node.name === "OrderController");
    const service = result.nodes.find((node) => node.name === "RefundEligibilityService");

    expect(controller?.metadata?.stereotype).toBe("RestController");
    expect(service?.metadata?.stereotype).toBe("Service");
    expect(result.edges.some((edge) => edge.fromId === controller?.id && edge.toId === service?.id && edge.kind === "calls")).toBe(true);
  });

  it("links service components to referenced service collaborators", () => {
    const result = scanRepository({
      id: "repo:notification",
      name: "notification-service",
      path: resolve("samples/retail-platform/notification-service"),
      addedAt: new Date().toISOString()
    });

    const listener = result.nodes.find((node) => node.name === "RefundNotificationListener");
    const notificationService = result.nodes.find((node) => node.name === "CustomerNotificationService");
    const topic = result.nodes.find((node) => node.kind === "Topic" && node.name === "refund-events");

    expect(
      result.edges.some((edge) => edge.fromId === listener?.id && edge.toId === notificationService?.id && edge.kind === "calls")
    ).toBe(true);
    expect(result.edges.some((edge) => edge.fromId === topic?.id && edge.toId === listener?.id && edge.kind === "depends_on")).toBe(true);
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

  it("detects request mapping methods, array paths, and array Kafka topics", () => {
    const root = mkdtempSync(join(tmpdir(), "contextos-scanner-"));
    try {
      const sourceDir = join(root, "src/main/java/com/example");
      mkdirSync(sourceDir, { recursive: true });
      writeFileSync(
        join(sourceDir, "AccountController.java"),
        `package com.example;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = {"/accounts", "/v2/accounts"})
class AccountController {
  @RequestMapping(method = RequestMethod.GET, value = "/{accountId}")
  String getAccount() {
    return "ok";
  }

  @GetMapping({"/active", "/enabled"})
  String activeAccounts() {
    return "ok";
  }

  @KafkaListener(topics = {"account-events", "customer-events"})
  void listen(String event) {
  }
}
`
      );

      const result = scanRepository({
        id: "repo:mapping",
        name: "mapping-service",
        path: root,
        addedAt: new Date().toISOString()
      });

      expect(result.nodes.some((node) => node.kind === "Endpoint" && node.name === "GET /accounts/{accountId}")).toBe(true);
      expect(result.nodes.some((node) => node.kind === "Endpoint" && node.name === "GET /v2/accounts/{accountId}")).toBe(true);
      expect(result.nodes.some((node) => node.kind === "Endpoint" && node.name === "GET /accounts/active")).toBe(true);
      expect(result.nodes.some((node) => node.kind === "Endpoint" && node.name === "GET /accounts/enabled")).toBe(true);
      expect(result.nodes.some((node) => node.kind === "Topic" && node.name === "account-events")).toBe(true);
      expect(result.nodes.some((node) => node.kind === "Topic" && node.name === "customer-events")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
