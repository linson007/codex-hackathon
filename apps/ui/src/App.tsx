import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import "./styles.css";

type Node = { id: string; kind: string; name: string; repo: string; filePath?: string; metadata?: Record<string, unknown> };
type Edge = { id: string; fromId: string; toId: string; kind: string };
type Repo = { id?: string; name: string; path: string; lastIndexedAt?: string };
type RepoOverview = Repo & {
  endpointCount: number;
  serviceCount: number;
  tableCount: number;
  topicCount: number;
  docSummary?: string;
  docGeneratedAt?: string;
  docMode?: string;
  docStale: boolean;
};
type RepoDoc = {
  repoName: string;
  summary: string;
  markdown: string;
  generatedAt: string;
  mode: string;
  model?: string;
  deterministicSummary?: string;
  deterministicMarkdown?: string;
  deterministicGeneratedAt?: string;
  llmSummary?: string;
  llmMarkdown?: string;
  llmGeneratedAt?: string;
  llmModel?: string;
};
type ItemDocSummary = {
  nodeId: string;
  nodeKind: "Service" | "Endpoint";
  nodeName: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
  docSummary?: string;
  docGeneratedAt?: string;
  docMode?: string;
  docStale: boolean;
};
type ItemDoc = {
  nodeId: string;
  nodeKind: "Service" | "Endpoint";
  nodeName: string;
  summary: string;
  markdown: string;
  generatedAt: string;
  mode: string;
  model?: string;
  deterministicSummary?: string;
  deterministicMarkdown?: string;
  deterministicGeneratedAt?: string;
  llmSummary?: string;
  llmMarkdown?: string;
  llmGeneratedAt?: string;
  llmModel?: string;
};
type KnowledgeBase = {
  name: string;
  root: string;
  createdOn?: string;
  lastUpdatedOn?: string;
  repositoryCount: number;
  nodeCount: number;
  edgeCount: number;
};
type Summary = { name: string; repositories: Repo[]; nodes: Node[]; edges: Edge[] };
type AskResult = {
  answer: string;
  mode: string;
  model?: string;
  evidence: { nodes: Node[]; edges: Edge[]; suggestedFiles: string[]; docs?: Array<{ kind: string; name: string; repoName: string }> };
};
type GraphCategory = "Controller" | "Service" | "Client" | "Repository" | "Endpoint" | "Topic" | "Table" | "External";
type GraphViewNode = Node & { x: number; y: number; category: GraphCategory };
type DocVariant = "llm" | "deterministic";

const apiBase = import.meta.env.VITE_CONTEXTOS_API ?? "http://localhost:4317";
mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base" });

function App() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKb, setSelectedKb] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [repoOverviews, setRepoOverviews] = useState<RepoOverview[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [repoDoc, setRepoDoc] = useState<RepoDoc | null>(null);
  const [docItems, setDocItems] = useState<ItemDocSummary[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemDoc, setItemDoc] = useState<ItemDoc | null>(null);
  const [docVariant, setDocVariant] = useState<DocVariant>("llm");
  const [askIncludeDocs, setAskIncludeDocs] = useState(false);
  const [question, setQuestion] = useState("What is impacted if I change refund eligibility logic?");
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [itemDocLoading, setItemDocLoading] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/kbs`)
      .then((res) => res.json())
      .then((payload: { knowledgeBases: KnowledgeBase[] }) => {
        setKnowledgeBases(payload.knowledgeBases);
        setSelectedKb((current) => current || payload.knowledgeBases[0]?.name || "");
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedKb) {
      setSummary(null);
      setRepoOverviews([]);
      setSelectedRepo("");
      return;
    }
    setAnswer(null);
    Promise.all([
      fetch(`${apiBase}/api/kbs/${encodeURIComponent(selectedKb)}`).then((res) => res.json()),
      fetch(`${apiBase}/api/kbs/${encodeURIComponent(selectedKb)}/repos`).then((res) => res.json())
    ])
      .then(([kbSummary, repoPayload]: [Summary, { repositories: RepoOverview[] }]) => {
        setSummary(kbSummary);
        setRepoOverviews(repoPayload.repositories);
        setSelectedRepo((current) =>
          repoPayload.repositories.some((repo) => repo.name === current) ? current : repoPayload.repositories[0]?.name || ""
        );
      })
      .catch(console.error);
  }, [selectedKb]);

  useEffect(() => {
    if (!selectedKb || !selectedRepo) {
      setRepoDoc(null);
      setDocItems([]);
      setSelectedItemId("");
      return;
    }
    setDocLoading(true);
    Promise.all([
      fetch(`${apiBase}/api/kbs/${encodeURIComponent(selectedKb)}/repos/${encodeURIComponent(selectedRepo)}/doc`),
      fetch(`${apiBase}/api/kbs/${encodeURIComponent(selectedKb)}/repos/${encodeURIComponent(selectedRepo)}/doc-items`).then((res) => res.json())
    ])
      .then(async ([docResponse, itemsPayload]: [Response, { items: ItemDocSummary[] }]) => {
        setRepoDoc(docResponse.ok ? await docResponse.json() : null);
        setDocItems(itemsPayload.items);
        setSelectedItemId((current) => (itemsPayload.items.some((item) => item.nodeId === current) ? current : itemsPayload.items[0]?.nodeId || ""));
      })
      .catch(console.error)
      .finally(() => setDocLoading(false));
  }, [selectedKb, selectedRepo]);

  useEffect(() => {
    if (!selectedKb || !selectedItemId) {
      setItemDoc(null);
      return;
    }
    setItemDocLoading(true);
    fetch(`${apiBase}/api/kbs/${encodeURIComponent(selectedKb)}/doc-items/${encodeURIComponent(selectedItemId)}`)
      .then(async (res) => (res.ok ? setItemDoc(await res.json()) : setItemDoc(null)))
      .catch(console.error)
      .finally(() => setItemDocLoading(false));
  }, [selectedKb, selectedItemId]);

  const serviceNodes = useMemo(() => summary?.nodes.filter((node) => node.kind === "Service") ?? [], [summary]);
  const controllerNodes = useMemo(() => serviceNodes.filter((node) => node.metadata?.stereotype === "RestController"), [serviceNodes]);
  const businessServiceNodes = useMemo(() => serviceNodes.filter((node) => classifyNode(node) === "Service"), [serviceNodes]);
  const clientNodes = useMemo(() => serviceNodes.filter((node) => classifyNode(node) === "Client"), [serviceNodes]);
  const repositoryNodes = useMemo(() => serviceNodes.filter((node) => classifyNode(node) === "Repository"), [serviceNodes]);
  const endpoints = useMemo(() => summary?.nodes.filter((node) => node.kind === "Endpoint") ?? [], [summary]);
  const tables = useMemo(() => summary?.nodes.filter((node) => node.kind === "Table") ?? [], [summary]);
  const topics = useMemo(() => summary?.nodes.filter((node) => node.kind === "Topic") ?? [], [summary]);
  const serviceDocItems = useMemo(() => docItems.filter((item) => item.nodeKind === "Service"), [docItems]);
  const controllerDocItems = useMemo(() => serviceDocItems.filter((item) => item.metadata?.stereotype === "RestController"), [serviceDocItems]);
  const clientDocItems = useMemo(() => serviceDocItems.filter((item) => item.metadata?.stereotype === "FeignClient"), [serviceDocItems]);
  const repositoryDocItems = useMemo(() => serviceDocItems.filter((item) => item.metadata?.stereotype === "Repository"), [serviceDocItems]);
  const businessServiceDocItems = useMemo(
    () => serviceDocItems.filter((item) => item.metadata?.stereotype === "Service"),
    [serviceDocItems]
  );
  const endpointDocItems = useMemo(() => docItems.filter((item) => item.nodeKind === "Endpoint"), [docItems]);
  const controllerEndpointGroups = useMemo(() => {
    const fallbackController = controllerDocItems[0]?.nodeName;
    return controllerDocItems.map((controller) => ({
      controller,
      endpoints: endpointDocItems.filter((endpoint) => {
        const controllerName = endpoint.metadata?.controller;
        return controllerName === controller.nodeName || (!controllerName && controller.nodeName === fallbackController);
      })
    }));
  }, [controllerDocItems, endpointDocItems]);

  async function ask() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/kbs/${encodeURIComponent(selectedKb)}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, includeDocs: askIncludeDocs })
      });
      setAnswer(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function regenerateDoc() {
    if (!selectedKb || !selectedRepo) return;
    setDocLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/kbs/${encodeURIComponent(selectedKb)}/repos/${encodeURIComponent(selectedRepo)}/doc/regenerate`, {
        method: "POST"
      });
      setRepoDoc(await res.json());
      const repoPayload = await fetch(`${apiBase}/api/kbs/${encodeURIComponent(selectedKb)}/repos`).then((response) => response.json());
      setRepoOverviews(repoPayload.repositories);
    } finally {
      setDocLoading(false);
    }
  }

  async function regenerateItemDoc() {
    if (!selectedKb || !selectedItemId || !selectedRepo) return;
    setItemDocLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/kbs/${encodeURIComponent(selectedKb)}/doc-items/${encodeURIComponent(selectedItemId)}/regenerate`, {
        method: "POST"
      });
      setItemDoc(await res.json());
      const itemsPayload = await fetch(`${apiBase}/api/kbs/${encodeURIComponent(selectedKb)}/repos/${encodeURIComponent(selectedRepo)}/doc-items`).then((response) => response.json());
      setDocItems(itemsPayload.items);
    } finally {
      setItemDocLoading(false);
    }
  }

  return (
    <main>
      <header>
        <div>
          <h1>ContextOS</h1>
          <p>AI knowledge graph for enterprise microservices</p>
        </div>
        <div className="status">{summary ? `${summary.name}: ${summary.nodes.length} nodes / ${summary.edges.length} edges` : "Loading knowledge bases"}</div>
      </header>

      <section className="workspace">
        <div className="ask">
          <div className="kbPicker">
            <label htmlFor="kb">Knowledge base</label>
            <select id="kb" value={selectedKb} onChange={(event) => setSelectedKb(event.target.value)}>
              {knowledgeBases.map((kb) => (
                <option key={kb.name} value={kb.name}>
                  {kb.name} ({kb.repositoryCount} repos, {kb.nodeCount} nodes)
                </option>
              ))}
            </select>
          </div>
          <div className="query">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} />
            <button onClick={ask} disabled={loading || !selectedKb}>{loading ? "Asking..." : "Ask"}</button>
          </div>
          <div className="askMode">
            <span>Evidence</span>
            <div className="docToggle" aria-label="Ask evidence mode">
              <button className={!askIncludeDocs ? "active" : ""} onClick={() => setAskIncludeDocs(false)}>Graph</button>
              <button className={askIncludeDocs ? "active" : ""} onClick={() => setAskIncludeDocs(true)}>Graph + Docs</button>
            </div>
          </div>
          <AnswerPanel text={answer?.answer} emptyText={selectedKb ? "Ask a question to inspect impact across services, endpoints, tables, topics, and files." : "Create or index a knowledge base to begin."} />
          {answer && <div className="mode">mode={answer.mode}{answer.model ? ` model=${answer.model}` : ""} evidence={askIncludeDocs ? `graph+docs (${answer.evidence.docs?.length ?? 0})` : "graph"}</div>}
        </div>

        <aside>
          <h2>Knowledge Bases</h2>
          {knowledgeBases.map((kb) => (
            <button className={kb.name === selectedKb ? "kbRow active" : "kbRow"} key={kb.name} onClick={() => setSelectedKb(kb.name)}>
              <strong>{kb.name}</strong>
              <span>{kb.repositoryCount} repos / {kb.nodeCount} nodes</span>
            </button>
          ))}

          <h2 className="repoTitle">Repositories</h2>
          {(summary?.repositories ?? []).map((repo) => (
            <div className="repo" key={repo.path}>
              <strong>{repo.name}</strong>
              <span>{repo.lastIndexedAt ? "indexed" : "not indexed"}</span>
            </div>
          ))}
        </aside>
      </section>

      <section className="grid">
        <Panel title="Controllers" nodes={controllerNodes} />
        <Panel title="Services" nodes={businessServiceNodes} />
        <Panel title="Clients" nodes={clientNodes} />
        <Panel title="Repositories" nodes={repositoryNodes} />
        <Panel title="Endpoints" nodes={endpoints} />
        <Panel title="Tables" nodes={tables} />
        <Panel title="Kafka Topics" nodes={topics} />
      </section>

      <section className="docsWorkspace">
        <div className="repoDocsList">
          <div className="sectionTitle">
            <h2>Repository Documentation</h2>
            <span>{repoOverviews.length} repos</span>
          </div>
          {repoOverviews.map((repo) => (
            <button className={repo.name === selectedRepo ? "repoCard active" : "repoCard"} key={repo.id} onClick={() => setSelectedRepo(repo.name)}>
              <strong>{repo.name}</strong>
              <span>{summaryPreview(repo.docSummary)}</span>
              <small>
                {repo.endpointCount} APIs / {repo.serviceCount} services / {repo.tableCount} tables / {repo.topicCount} topics
                {repo.docStale ? " / stale docs" : ""}
              </small>
            </button>
          ))}
        </div>

        <div className="repoDocDetail">
          <div className="docHeader">
            <div>
              <h2>{selectedRepo || "Select a repository"}</h2>
              <span>{repoDoc ? docStatus(repoDoc, docVariant) : "No generated onboarding doc yet"}</span>
            </div>
            <div className="docActions">
              <DocVariantToggle value={docVariant} onChange={setDocVariant} doc={repoDoc} />
              <button onClick={regenerateDoc} disabled={!selectedRepo || docLoading}>{docLoading ? "Generating..." : repoDoc ? "Regenerate" : "Generate"}</button>
            </div>
          </div>
          {docLoading ? (
            <div className="answer empty">Generating repository documentation...</div>
          ) : (
            <AnswerPanel text={docMarkdown(repoDoc, docVariant)} emptyText="Generate docs to create a new-joiner overview for this repository." />
          )}
        </div>
      </section>

      <section className="docsWorkspace itemDocsWorkspace">
        <div className="repoDocsList compactDocsList">
          <div className="sectionTitle">
            <h2>Controllers</h2>
            <span>{controllerDocItems.length} / {endpointDocItems.length} APIs</span>
          </div>
          {controllerEndpointGroups.map(({ controller, endpoints }) => (
            <div className="serviceGroup" key={controller.nodeId}>
              <button className={controller.nodeId === selectedItemId ? "repoCard active" : "repoCard"} onClick={() => setSelectedItemId(controller.nodeId)}>
                <strong>{controller.nodeName}</strong>
                <span>{summaryPreview(controller.docSummary)}</span>
                <small>{controller.docStale ? "stale docs" : `${endpoints.length} endpoints`}</small>
              </button>
              {endpoints.length > 0 && (
                <div className="endpointChildren">
                  {endpoints.map((endpoint) => (
                    <button className={endpoint.nodeId === selectedItemId ? "endpointLink active" : "endpointLink"} key={endpoint.nodeId} onClick={() => setSelectedItemId(endpoint.nodeId)}>
                      <strong>{endpoint.nodeName}</strong>
                      <span>{endpoint.docStale ? "stale docs" : "endpoint doc"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="docSubsection">
            <div className="sectionTitle">
              <h2>Services</h2>
              <span>{businessServiceDocItems.length}</span>
            </div>
            {businessServiceDocItems.map((service) => (
              <button className={service.nodeId === selectedItemId ? "repoCard active" : "repoCard"} key={service.nodeId} onClick={() => setSelectedItemId(service.nodeId)}>
                <strong>{service.nodeName}</strong>
                <span>{summaryPreview(service.docSummary)}</span>
                <small>{service.docStale ? "stale docs" : "service doc"}</small>
              </button>
            ))}
          </div>

          <div className="docSubsection">
            <div className="sectionTitle">
              <h2>Clients</h2>
              <span>{clientDocItems.length}</span>
            </div>
            {clientDocItems.map((client) => (
              <button className={client.nodeId === selectedItemId ? "repoCard active" : "repoCard"} key={client.nodeId} onClick={() => setSelectedItemId(client.nodeId)}>
                <strong>{client.nodeName}</strong>
                <span>{summaryPreview(client.docSummary)}</span>
                <small>{client.metadata?.target ? `calls ${String(client.metadata.target)}` : "client doc"}</small>
              </button>
            ))}
          </div>

          <div className="docSubsection">
            <div className="sectionTitle">
              <h2>Repositories</h2>
              <span>{repositoryDocItems.length}</span>
            </div>
            {repositoryDocItems.map((repository) => (
              <button className={repository.nodeId === selectedItemId ? "repoCard active" : "repoCard"} key={repository.nodeId} onClick={() => setSelectedItemId(repository.nodeId)}>
                <strong>{repository.nodeName}</strong>
                <span>{summaryPreview(repository.docSummary)}</span>
                <small>{repository.docStale ? "stale docs" : "repository doc"}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="repoDocDetail">
          <div className="docHeader">
            <div>
              <h2>{itemDoc?.nodeName || docItems.find((item) => item.nodeId === selectedItemId)?.nodeName || "Select a service or endpoint"}</h2>
              <span>{itemDoc ? `${itemDoc.nodeKind} doc: ${docStatus(itemDoc, docVariant)}` : "No generated service/endpoint doc yet"}</span>
            </div>
            <div className="docActions">
              <DocVariantToggle value={docVariant} onChange={setDocVariant} doc={itemDoc} />
              <button onClick={regenerateItemDoc} disabled={!selectedItemId || itemDocLoading}>{itemDocLoading ? "Generating..." : itemDoc ? "Regenerate" : "Generate"}</button>
            </div>
          </div>
          {itemDocLoading ? (
            <div className="answer empty">Generating service or endpoint documentation...</div>
          ) : (
            <AnswerPanel text={docMarkdown(itemDoc, docVariant)} emptyText="Generate docs to create a focused service or endpoint overview." />
          )}
        </div>
      </section>

      <section className="graph">
        <div className="sectionTitle">
          <h2>Dependency Graph</h2>
          <span>controllers, services, clients, APIs, topics, tables, and calls</span>
        </div>
        <DependencyGraph nodes={summary?.nodes ?? []} edges={summary?.edges ?? []} />
      </section>
    </main>
  );
}

function DocVariantToggle({ value, onChange, doc }: { value: DocVariant; onChange: (value: DocVariant) => void; doc: RepoDoc | ItemDoc | null }) {
  const hasLlm = Boolean(doc?.llmMarkdown);
  return (
    <div className="docToggle" aria-label="Documentation variant">
      <button className={value === "llm" ? "active" : ""} onClick={() => onChange("llm")} disabled={!hasLlm}>
        LLM
      </button>
      <button className={value === "deterministic" ? "active" : ""} onClick={() => onChange("deterministic")} disabled={!doc}>
        Facts
      </button>
    </div>
  );
}

function docMarkdown(doc: RepoDoc | ItemDoc | null, variant: DocVariant): string | undefined {
  if (!doc) return undefined;
  if (variant === "deterministic") return doc.deterministicMarkdown ?? doc.markdown;
  return doc.llmMarkdown ?? doc.deterministicMarkdown ?? doc.markdown;
}

function docStatus(doc: RepoDoc | ItemDoc, variant: DocVariant): string {
  if (variant === "deterministic") {
    const generatedAt = doc.deterministicGeneratedAt ?? doc.generatedAt;
    return `Showing deterministic facts generated ${new Date(generatedAt).toLocaleString()}`;
  }
  if (doc.llmMarkdown) {
    const generatedAt = doc.llmGeneratedAt ?? doc.generatedAt;
    const model = doc.llmModel ?? doc.model;
    return `Showing LLM docs generated ${new Date(generatedAt).toLocaleString()}${model ? ` (${model})` : ""}`;
  }
  const generatedAt = doc.deterministicGeneratedAt ?? doc.generatedAt;
  return `LLM docs not generated; showing deterministic facts from ${new Date(generatedAt).toLocaleString()}`;
}

function summaryPreview(value?: string): string {
  if (!value) return "Documentation not generated yet.";
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[>*-]\s*/gm, "")
    .replace(/\|/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function DependencyGraph({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const graph = useMemo(() => buildDependencyGraph(nodes, edges), [nodes, edges]);
  if (!graph.nodes.length) {
    return <div className="graphEmpty">Run update to build graph data.</div>;
  }
  return (
    <div className="graphCanvas">
      <svg className="edgeLayer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#7b8d76" />
          </marker>
        </defs>
        {graph.edges.map((edge) => {
          const from = graph.nodeMap.get(edge.fromId);
          const to = graph.nodeMap.get(edge.toId);
          if (!from || !to) return null;
          return (
            <g key={edge.id}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={`edgeLine edge-${edge.kind}`} markerEnd="url(#arrow)" />
              <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 1} className="edgeLabel">
                {edge.kind}
              </text>
            </g>
          );
        })}
      </svg>
      {graph.nodes.map((node) => (
        <div className={`graphNode ${node.category.toLowerCase()}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} key={node.id}>
          <strong>{node.name}</strong>
          <span>{node.category} / {node.repo}</span>
        </div>
      ))}
      <div className="graphLegend">
        <span><i className="controllerDot" /> Controller</span>
        <span><i className="serviceDot" /> Service</span>
        <span><i className="clientDot" /> Client</span>
        <span><i className="repositoryDot" /> Repository</span>
        <span><i className="endpointDot" /> Endpoint</span>
        <span><i className="topicDot" /> Topic</span>
        <span><i className="tableDot" /> Table</span>
      </div>
    </div>
  );
}

function buildDependencyGraph(nodes: Node[], edges: Edge[]) {
  const visibleKinds = new Set(["Service", "Endpoint", "Topic", "Table"]);
  const visibleEdges = edges.filter((edge) => ["calls", "consumes", "depends_on", "exposes", "writes"].includes(edge.kind));
  const referencedIds = new Set<string>();
  visibleEdges.forEach((edge) => {
    referencedIds.add(edge.fromId);
    referencedIds.add(edge.toId);
  });
  const candidates = nodes.filter((node) => {
    if (!visibleKinds.has(node.kind)) return false;
    if (referencedIds.has(node.id)) return true;
    const category = classifyNode(node);
    return ["Controller", "Client", "Repository"].includes(category) || (category === "Service" && node.metadata?.stereotype === "Service");
  });
  const byKind = [
    { category: "Controller" as const, x: 10 },
    { category: "Endpoint" as const, x: 26 },
    { category: "Service" as const, x: 42 },
    { category: "Client" as const, x: 58 },
    { category: "External" as const, x: 72 },
    { category: "Topic" as const, x: 84 },
    { category: "Table" as const, x: 94 }
  ];
  const graphNodes: GraphViewNode[] = [];
  for (const group of byKind) {
    const groupNodes = candidates.filter((node) => classifyNode(node) === group.category).slice(0, 10);
    const step = 76 / Math.max(1, groupNodes.length);
    groupNodes.forEach((node, index) => {
      graphNodes.push({ ...node, category: group.category, x: group.x, y: 12 + step * index + step / 2 });
    });
  }
  const nodeMap = new Map(graphNodes.map((node) => [node.id, node]));
  return {
    nodes: graphNodes,
    edges: visibleEdges.filter((edge) => nodeMap.has(edge.fromId) && nodeMap.has(edge.toId)).slice(0, 40),
    nodeMap
  };
}

function classifyNode(node: Node): GraphCategory {
  if (node.kind === "Endpoint") return "Endpoint";
  if (node.kind === "Topic") return "Topic";
  if (node.kind === "Table") return "Table";
  if (node.kind === "Service" && node.metadata?.external) return "External";
  if (node.kind === "Service" && node.metadata?.stereotype === "RestController") return "Controller";
  if (node.kind === "Service" && node.metadata?.stereotype === "FeignClient") return "Client";
  if (node.kind === "Service" && node.metadata?.stereotype === "Repository") return "Repository";
  return "Service";
}

function AnswerPanel({ text, emptyText }: { text?: string; emptyText: string }) {
  if (!text) {
    return <div className="answer empty">{emptyText}</div>;
  }
  return (
    <div className="answer">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: MarkdownCode }}>{text}</ReactMarkdown>
    </div>
  );
}

function MarkdownCode(props: React.ComponentProps<"code"> & { inline?: boolean }) {
  const className = props.className ?? "";
  const content = String(props.children ?? "").trim();
  if (!props.inline && /language-mermaid/.test(className)) {
    return <MermaidDiagram source={content} />;
  }
  return <code className={className}>{props.children}</code>;
}

function MermaidDiagram({ source }: { source: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const id = `mermaid-${Math.abs(hashText(source))}`;
    mermaid
      .render(id, source)
      .then((result) => {
        setSvg(result.svg);
        setError("");
      })
      .catch((err) => {
        setSvg("");
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [source]);
  if (error) {
    return <pre className="mermaidError">{source}</pre>;
  }
  return <div className="mermaidDiagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function hashText(value: string): number {
  return [...value].reduce((acc, char) => (Math.imul(31, acc) + char.charCodeAt(0)) | 0, 7);
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
