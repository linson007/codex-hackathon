import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { app } from "../src/server";

describe("api validation", () => {
  let server = undefined as unknown as Server;
  let baseUrl: string;
  let home: string;
  let previousHome: string | undefined;

  beforeAll(async () => {
    home = mkdtempSync(resolve(tmpdir(), "contextos-api-"));
    previousHome = process.env.CONTEXTOS_HOME;
    process.env.CONTEXTOS_HOME = home;
    await new Promise<void>((resolveListen) => {
      server = app.listen(0, "127.0.0.1", resolveListen);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolveClose, reject) => {
      server.close((error) => (error ? reject(error) : resolveClose()));
    });
    if (previousHome) process.env.CONTEXTOS_HOME = previousHome;
    else delete process.env.CONTEXTOS_HOME;
    rmSync(home, { recursive: true, force: true });
  });

  it("rejects invalid knowledge base names", async () => {
    const response = await fetch(`${baseUrl}/api/kbs/bad.name`);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid knowledge base name. Use letters, numbers, hyphen, or underscore."
    });
  });

  it("rejects invalid ask payloads", async () => {
    const missingQuestion = await fetch(`${baseUrl}/api/kbs/demo/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "   " })
    });
    expect(missingQuestion.status).toBe(400);
    await expect(missingQuestion.json()).resolves.toMatchObject({ error: "question is required." });

    const invalidIncludeDocs = await fetch(`${baseUrl}/api/kbs/demo/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "hello", includeDocs: "yes" })
    });
    expect(invalidIncludeDocs.status).toBe(400);
    await expect(invalidIncludeDocs.json()).resolves.toMatchObject({ error: "includeDocs must be a boolean." });
  });

  it("streams the deterministic ask fallback when OpenAI is not configured", async () => {
    const response = await fetch(`${baseUrl}/api/kbs/demo/ask/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "What handles refunds?", includeDocs: false })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain("event: result");
  });
});
