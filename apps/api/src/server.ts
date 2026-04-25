import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { answerQuestion } from "@contextos/ai";
import { openKnowledgeBase } from "@contextos/store";

const args = new Map(process.argv.slice(2).flatMap((value, index, all) => (value.startsWith("--") ? [[value.slice(2), all[index + 1]]] : [])));
const kb = args.get("kb") ?? process.env.CONTEXTOS_KB ?? "retail-platform";
const port = Number(args.get("port") ?? process.env.CONTEXTOS_API_PORT ?? 4317);
const workspaceRoot = process.env.CONTEXTOS_WORKSPACE_ROOT ?? findWorkspaceRoot(process.cwd());

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/kb", (_req, res) => {
  const store = openKnowledgeBase(kb, workspaceRoot);
  try {
    res.json(store.summary());
  } finally {
    store.close();
  }
});

app.post("/api/ask", async (req, res, next) => {
  try {
    const question = String(req.body?.question ?? "");
    if (!question.trim()) {
      res.status(400).json({ error: "question is required" });
      return;
    }
    const store = openKnowledgeBase(kb, workspaceRoot);
    try {
      res.json(await answerQuestion(store.searchEvidence(question)));
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
  console.log(`ContextOS API for '${kb}' listening on http://localhost:${port}`);
  console.log(`Workspace root: ${workspaceRoot}`);
  console.log("Run the UI with: npm run dev -w @contextos/ui");
});

function findWorkspaceRoot(start: string): string {
  let current = resolve(start);
  for (;;) {
    if (existsSync(resolve(current, "product.md")) || existsSync(resolve(current, "samples/retail-platform"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}
