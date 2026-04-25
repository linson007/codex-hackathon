import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Node = { id: string; kind: string; name: string; repo: string; filePath?: string; metadata?: Record<string, unknown> };
type Edge = { id: string; fromId: string; toId: string; kind: string };
type Repo = { name: string; path: string; lastIndexedAt?: string };
type Summary = { name: string; repositories: Repo[]; nodes: Node[]; edges: Edge[] };
type AskResult = { answer: string; mode: string; model?: string; evidence: { nodes: Node[]; edges: Edge[]; suggestedFiles: string[] } };

const apiBase = import.meta.env.VITE_CONTEXTOS_API ?? "http://localhost:4317";

function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [question, setQuestion] = useState("What is impacted if I change refund eligibility logic?");
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/kb`).then((res) => res.json()).then(setSummary).catch(console.error);
  }, []);

  const services = useMemo(() => summary?.nodes.filter((node) => node.kind === "Service") ?? [], [summary]);
  const endpoints = useMemo(() => summary?.nodes.filter((node) => node.kind === "Endpoint") ?? [], [summary]);
  const tables = useMemo(() => summary?.nodes.filter((node) => node.kind === "Table") ?? [], [summary]);
  const topics = useMemo(() => summary?.nodes.filter((node) => node.kind === "Topic") ?? [], [summary]);

  async function ask() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question })
      });
      setAnswer(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header>
        <div>
          <h1>ContextOS</h1>
          <p>AI knowledge graph for enterprise microservices</p>
        </div>
        <div className="status">{summary ? `${summary.nodes.length} nodes / ${summary.edges.length} edges` : "Loading graph"}</div>
      </header>

      <section className="workspace">
        <div className="ask">
          <div className="query">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} />
            <button onClick={ask} disabled={loading}>{loading ? "Asking..." : "Ask"}</button>
          </div>
          <pre>{answer?.answer ?? "Ask a question to inspect impact across services, endpoints, tables, topics, and files."}</pre>
          {answer && <div className="mode">mode={answer.mode}{answer.model ? ` model=${answer.model}` : ""}</div>}
        </div>

        <aside>
          <h2>Repositories</h2>
          {(summary?.repositories ?? []).map((repo) => (
            <div className="repo" key={repo.path}>
              <strong>{repo.name}</strong>
              <span>{repo.lastIndexedAt ? "indexed" : "not indexed"}</span>
            </div>
          ))}
        </aside>
      </section>

      <section className="grid">
        <Panel title="Services" nodes={services} />
        <Panel title="Endpoints" nodes={endpoints} />
        <Panel title="Tables" nodes={tables} />
        <Panel title="Kafka Topics" nodes={topics} />
      </section>

      <section className="graph">
        <h2>Service Graph</h2>
        <div className="graphCanvas">
          {services.slice(0, 12).map((node, index) => (
            <div className="bubble" style={{ left: `${8 + (index % 4) * 23}%`, top: `${12 + Math.floor(index / 4) * 30}%` }} key={node.id}>
              <strong>{node.name}</strong>
              <span>{node.repo}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Panel({ title, nodes }: { title: string; nodes: Node[] }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      {nodes.slice(0, 8).map((node) => (
        <div className="item" key={node.id}>
          <strong>{node.name}</strong>
          <span>{node.repo}</span>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
