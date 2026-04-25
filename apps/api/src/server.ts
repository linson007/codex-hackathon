import cors from "cors";
import express from "express";
import { answerQuestion, generateGraphItemDocumentation, generateRepositoryDocumentation } from "@contextos/ai";
import { contextOSHome, listKnowledgeBases, openKnowledgeBase } from "@contextos/store";

const args = new Map(process.argv.slice(2).flatMap((value, index, all) => (value.startsWith("--") ? [[value.slice(2), all[index + 1]]] : [])));
const port = Number(args.get("port") ?? process.env.CONTEXTOS_API_PORT ?? 4317);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/kbs", (_req, res) => {
  res.json({ knowledgeBases: listKnowledgeBases() });
});

app.get("/api/kbs/:kb", (req, res) => {
  const store = openKnowledgeBase(req.params.kb);
  try {
    res.json(store.summary());
  } finally {
    store.close();
  }
});

app.post("/api/kbs/:kb/ask", async (req, res, next) => {
  try {
    const question = String(req.body?.question ?? "");
    if (!question.trim()) {
      res.status(400).json({ error: "question is required" });
      return;
    }
    const includeDocs = Boolean(req.body?.includeDocs);
    const store = openKnowledgeBase(req.params.kb);
    try {
      res.json(await answerQuestion(store.searchEvidence(question, { includeDocs })));
    } finally {
      store.close();
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/kbs/:kb/repos", (req, res) => {
  const store = openKnowledgeBase(req.params.kb);
  try {
    res.json({ repositories: store.getRepositoryOverviews() });
  } finally {
    store.close();
  }
});

app.get("/api/kbs/:kb/repos/:repoName/doc", (req, res) => {
  const store = openKnowledgeBase(req.params.kb);
  try {
    const repoName = decodeURIComponent(req.params.repoName);
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
  const store = openKnowledgeBase(req.params.kb);
  try {
    const repoName = decodeURIComponent(req.params.repoName);
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
  const store = openKnowledgeBase(req.params.kb);
  try {
    const nodeId = decodeURIComponent(req.params.nodeId);
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
    const store = openKnowledgeBase(req.params.kb);
    try {
      const nodeId = decodeURIComponent(req.params.nodeId);
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
    const store = openKnowledgeBase(req.params.kb);
    try {
      const repoName = decodeURIComponent(req.params.repoName);
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
    const question = String(req.body?.question ?? "");
    if (!question.trim()) {
      res.status(400).json({ error: "question is required" });
      return;
    }
    const includeDocs = Boolean(req.body?.includeDocs);
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

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
});

app.listen(port, () => {
  console.log(`ContextOS API listening on http://localhost:${port}`);
  console.log(`ContextOS home: ${contextOSHome()}`);
  console.log("Serving all knowledge bases.");
});
