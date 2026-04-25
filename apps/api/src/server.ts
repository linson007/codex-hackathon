import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answerQuestion, answerQuestionStream, generateGraphItemDocumentation, generateRepositoryDocumentation } from "@contextos/ai";
import { contextOSHome, listKnowledgeBases, openKnowledgeBase } from "@contextos/store";

const args = new Map(
  process.argv.slice(2).flatMap((value, index, all) => (value.startsWith("--") ? [[value.slice(2), all[index + 1]]] : []))
);
const port = Number(args.get("port") ?? process.env.CONTEXTOS_API_PORT ?? 4317);
const __dirname = dirname(fileURLToPath(import.meta.url));
const uiDist = resolve(__dirname, "../../ui/dist");

export const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const requestId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : randomUUID();
  const startedAt = Date.now();
  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt
      })
    );
  });
  next();
});

app.get("/api/kbs", (_req, res) => {
  res.json({ knowledgeBases: listKnowledgeBases() });
});

app.get("/api/kbs/:kb", (req, res) => {
  const kb = requireKbName(req.params.kb);
  const store = openKnowledgeBase(kb);
  try {
    res.json(store.summary());
  } finally {
    store.close();
  }
});

app.get("/api/kbs/:kb/export", (req, res) => {
  const kb = requireKbName(req.params.kb);
  const store = openKnowledgeBase(kb);
  try {
    res.json(store.enterpriseExport());
  } finally {
    store.close();
  }
});

app.post("/api/kbs/:kb/ask", async (req, res, next) => {
  try {
    const kb = requireKbName(req.params.kb);
    const question = requireQuestion(req.body?.question);
    const includeDocs = optionalBoolean(req.body?.includeDocs, "includeDocs");
    const store = openKnowledgeBase(kb);
    try {
      res.json(await answerQuestion(store.searchEvidence(question, { includeDocs })));
    } finally {
      store.close();
    }
  } catch (error) {
    next(error);
  }
});

app.post("/api/kbs/:kb/ask/stream", async (req, res, next) => {
  try {
    const kb = requireKbName(req.params.kb);
    const question = requireQuestion(req.body?.question);
    const includeDocs = optionalBoolean(req.body?.includeDocs, "includeDocs");
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.flushHeaders?.();
    const store = openKnowledgeBase(kb);
    try {
      await answerQuestionStream(store.searchEvidence(question, { includeDocs }), async (event) => {
        writeSse(res, event.type, event);
      });
      res.end();
    } finally {
      store.close();
    }
  } catch (error) {
    if (res.headersSent) {
      writeSse(res, "error", { type: "error", error: error instanceof Error ? error.message : String(error) });
      res.end();
      return;
    }
    next(error);
  }
});

app.get("/api/kbs/:kb/repos", (req, res) => {
  const kb = requireKbName(req.params.kb);
  const store = openKnowledgeBase(kb);
  try {
    res.json({ repositories: store.getRepositoryOverviews() });
  } finally {
    store.close();
  }
});

app.get("/api/kbs/:kb/repos/:repoName/doc", (req, res) => {
  const kb = requireKbName(req.params.kb);
  const repoName = requireRepoName(req.params.repoName);
  const store = openKnowledgeBase(kb);
  try {
    const doc = store.getRepositoryDoc(repoName);
    if (!doc) {
      res.status(404).json({ error: `No docs found for '${repoName}'.` });
      return;
    }
    res.json(doc);
  } finally {
    store.close();
  }
});

app.get("/api/kbs/:kb/repos/:repoName/doc-items", (req, res) => {
  const kb = requireKbName(req.params.kb);
  const repoName = requireRepoName(req.params.repoName);
  const store = openKnowledgeBase(kb);
  try {
    const docs = new Map(store.getGraphItemDocs(repoName).map((doc) => [doc.nodeId, doc]));
    const items = store.getDocTargets(repoName).map((node) => {
      const doc = docs.get(node.id);
      const fingerprint = store.getGraphItemEvidence(node.id).sourceFingerprint;
      return {
        nodeId: node.id,
        nodeKind: node.kind,
        nodeName: node.name,
        filePath: node.filePath,
        metadata: node.metadata,
        docSummary: doc?.summary,
        docGeneratedAt: doc?.generatedAt,
        docMode: doc?.mode,
        docStale: Boolean(doc && doc.sourceFingerprint !== fingerprint)
      };
    });
    res.json({ items });
  } finally {
    store.close();
  }
});

app.get("/api/kbs/:kb/doc-items/:nodeId", (req, res) => {
  const kb = requireKbName(req.params.kb);
  const nodeId = requireNodeId(req.params.nodeId);
  const store = openKnowledgeBase(kb);
  try {
    const doc = store.getGraphItemDoc(nodeId);
    if (!doc) {
      res.status(404).json({ error: `No docs found for node '${nodeId}'.` });
      return;
    }
    res.json(doc);
  } finally {
    store.close();
  }
});

app.post("/api/kbs/:kb/doc-items/:nodeId/regenerate", async (req, res, next) => {
  try {
    const kb = requireKbName(req.params.kb);
    const nodeId = requireNodeId(req.params.nodeId);
    const store = openKnowledgeBase(kb);
    try {
      const doc = await generateGraphItemDocumentation(store.getGraphItemEvidence(nodeId));
      store.saveGraphItemDoc(doc);
      res.json(doc);
    } finally {
      store.close();
    }
  } catch (error) {
    next(error);
  }
});

app.post("/api/kbs/:kb/repos/:repoName/doc/regenerate", async (req, res, next) => {
  try {
    const kb = requireKbName(req.params.kb);
    const repoName = requireRepoName(req.params.repoName);
    const store = openKnowledgeBase(kb);
    try {
      const doc = await generateRepositoryDocumentation(store.getRepositoryEvidence(repoName));
      store.saveRepositoryDoc(doc);
      res.json(doc);
    } finally {
      store.close();
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/kb", (_req, res) => {
  const first = listKnowledgeBases()[0];
  if (!first) {
    res.status(404).json({ error: "No knowledge bases found." });
    return;
  }
  const store = openKnowledgeBase(first.name);
  try {
    res.json(store.summary());
  } finally {
    store.close();
  }
});

app.post("/api/ask", async (req, res, next) => {
  try {
    const first = listKnowledgeBases()[0];
    if (!first) {
      res.status(404).json({ error: "No knowledge bases found." });
      return;
    }
    const question = requireQuestion(req.body?.question);
    const includeDocs = optionalBoolean(req.body?.includeDocs, "includeDocs");
    const store = openKnowledgeBase(first.name);
    try {
      res.json(await answerQuestion(store.searchEvidence(question, { includeDocs })));
    } finally {
      store.close();
    }
  } catch (error) {
    next(error);
  }
});

app.post("/api/ask/stream", async (req, res, next) => {
  try {
    const first = listKnowledgeBases()[0];
    if (!first) {
      res.status(404).json({ error: "No knowledge bases found." });
      return;
    }
    const question = requireQuestion(req.body?.question);
    const includeDocs = optionalBoolean(req.body?.includeDocs, "includeDocs");
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.flushHeaders?.();
    const store = openKnowledgeBase(first.name);
    try {
      await answerQuestionStream(store.searchEvidence(question, { includeDocs }), async (event) => {
        writeSse(res, event.type, event);
      });
      res.end();
    } finally {
      store.close();
    }
  } catch (error) {
    if (res.headersSent) {
      writeSse(res, "error", { type: "error", error: error instanceof Error ? error.message : String(error) });
      res.end();
      return;
    }
    next(error);
  }
});

if (existsSync(uiDist)) {
  app.use(express.static(uiDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(resolve(uiDist, "index.html"));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error instanceof ApiError ? error.status : 500;
  res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
});

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const server = app.listen(port, () => {
    console.log(`ContextOS API listening on http://localhost:${port}`);
    console.log(`ContextOS home: ${contextOSHome()}`);
    console.log("Serving all knowledge bases.");
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      console.log(`Received ${signal}; shutting down ContextOS API.`);
      server.close(() => process.exit(0));
    });
  }
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function requireKbName(value: string): string {
  const kb = decodeURIComponent(value ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(kb)) {
    throw new ApiError(400, "Invalid knowledge base name. Use letters, numbers, hyphen, or underscore.");
  }
  return kb;
}

function requireRepoName(value: string): string {
  const repoName = decodeURIComponent(value ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(repoName)) {
    throw new ApiError(400, "Invalid repository name.");
  }
  return repoName;
}

function requireNodeId(value: string): string {
  const nodeId = decodeURIComponent(value ?? "").trim();
  if (!/^[A-Za-z0-9:_-]{3,120}$/.test(nodeId)) {
    throw new ApiError(400, "Invalid documentation node id.");
  }
  return nodeId;
}

function requireQuestion(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError(400, "question must be a string.");
  }
  const question = value.trim();
  if (!question) {
    throw new ApiError(400, "question is required.");
  }
  if (question.length > 2000) {
    throw new ApiError(400, "question must be 2000 characters or fewer.");
  }
  return question;
}

function optionalBoolean(value: unknown, name: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") {
    throw new ApiError(400, `${name} must be a boolean.`);
  }
  return value;
}

function writeSse(res: express.Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}
