import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const CURRENT_SCHEMA_VERSION = 1;

export type NodeKind = "Repository" | "Service" | "Endpoint" | "Entity" | "Topic" | "Table" | "Config" | "File";

export type GraphNode = {
  id: string;
  kind: NodeKind;
  name: string;
  repo: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  fromId: string;
  toId: string;
  kind: "exposes" | "calls" | "consumes" | "reads" | "writes" | "contains" | "depends_on";
  metadata?: Record<string, unknown>;
};

export type RepositoryRecord = {
  id: string;
  name: string;
  path: string;
  addedAt: string;
  lastIndexedAt?: string;
};

export type RepositoryDoc = {
  repoId: string;
  repoName: string;
  summary: string;
  markdown: string;
  generatedAt: string;
  sourceFingerprint: string;
  model?: string;
  mode: "openai" | "fallback";
  deterministicSummary?: string;
  deterministicMarkdown?: string;
  deterministicGeneratedAt?: string;
  llmSummary?: string;
  llmMarkdown?: string;
  llmGeneratedAt?: string;
  llmModel?: string;
};

export type GraphItemDoc = {
  nodeId: string;
  repoName: string;
  nodeKind: "Service" | "Endpoint";
  nodeName: string;
  summary: string;
  markdown: string;
  generatedAt: string;
  sourceFingerprint: string;
  model?: string;
  mode: "openai" | "fallback";
  deterministicSummary?: string;
  deterministicMarkdown?: string;
  deterministicGeneratedAt?: string;
  llmSummary?: string;
  llmMarkdown?: string;
  llmGeneratedAt?: string;
  llmModel?: string;
};

export type GraphItemDocEvidence = {
  repository: RepositoryRecord;
  node: GraphNode;
  relatedNodes: GraphNode[];
  relatedEdges: GraphEdge[];
  sourceFingerprint: string;
};

export type RepositoryOverview = RepositoryRecord & {
  endpointCount: number;
  serviceCount: number;
  tableCount: number;
  topicCount: number;
  docSummary?: string;
  docGeneratedAt?: string;
  docMode?: "openai" | "fallback";
  docStale: boolean;
};

export type RepositoryDocEvidence = {
  repository: RepositoryRecord;
  nodes: GraphNode[];
  edges: GraphEdge[];
  sourceFingerprint: string;
};

export type KnowledgeBaseSummary = {
  name: string;
  root: string;
  repositories: RepositoryRecord[];
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type KnowledgeBaseInfo = {
  name: string;
  root: string;
  createdOn?: string;
  lastUpdatedOn?: string;
  repositoryCount: number;
  nodeCount: number;
  edgeCount: number;
};

export function contextOSHome(): string {
  return resolve(process.env.CONTEXTOS_HOME ?? join(homedir(), ".contextos"));
}

export function knowledgeBasesRoot(): string {
  return join(contextOSHome(), "kbs");
}

export function kbRoot(kb: string): string {
  return join(knowledgeBasesRoot(), kb);
}

export function openKnowledgeBase(kb: string): ContextStore {
  return new ContextStore(kb, kbRoot(kb));
}

export function listKnowledgeBases(): KnowledgeBaseInfo[] {
  const root = knowledgeBasesRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const store = openKnowledgeBase(name);
      try {
        const repositories = store.getRepositories();
        const nodes = store.getNodes();
        const edges = store.getEdges();
        return {
          name,
          root: kbRoot(name),
          createdOn: repositories.map((repo) => repo.addedAt).sort()[0] ?? createdFromDbFile(name),
          lastUpdatedOn: repositories
            .map((repo) => repo.lastIndexedAt)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1),
          repositoryCount: repositories.length,
          nodeCount: nodes.length,
          edgeCount: edges.length
        };
      } finally {
        store.close();
      }
    });
}

export class ContextStore {
  readonly dbPath: string;
  private db: Database.Database;

  constructor(
    readonly name: string,
    readonly root: string
  ) {
    this.dbPath = join(root, "contextos.db");
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  addRepository(inputPath: string): RepositoryRecord {
    const absolute = resolve(inputPath);
    const name = absolute.split(/[\\/]/).filter(Boolean).at(-1) ?? absolute;
    const now = new Date().toISOString();
    const id = stableId("repo", absolute);
    const record = { id, name, path: absolute, addedAt: now };
    this.db
      .prepare(
        `insert into repositories (id, name, path, added_at)
         values (@id, @name, @path, @addedAt)
         on conflict(path) do update set name = excluded.name`
      )
      .run(record);
    return this.getRepositories().find((repo) => repo.path === absolute) ?? record;
  }

  removeRepository(pathOrName: string): number {
    const result = this.db
      .prepare("delete from repositories where path = ? or name = ? or id = ?")
      .run(resolve(pathOrName), pathOrName, pathOrName);
    return Number(result.changes);
  }

  getRepositories(): RepositoryRecord[] {
    return this.db
      .prepare("select id, name, path, added_at as addedAt, last_indexed_at as lastIndexedAt from repositories order by name")
      .all() as RepositoryRecord[];
  }

  getRepositoryOverviews(): RepositoryOverview[] {
    const repositories = this.getRepositories();
    const nodes = this.getNodes();
    const docs = new Map(this.getRepositoryDocs().map((doc) => [doc.repoName, doc]));
    return repositories.map((repo) => {
      const repoNodes = nodes.filter((node) => node.repo === repo.name);
      const doc = docs.get(repo.name);
      const sourceFingerprint = this.repositoryFingerprint(repo.name);
      return {
        ...repo,
        endpointCount: unique(repoNodes.filter((node) => node.kind === "Endpoint").map((node) => node.name)).length,
        serviceCount: unique(repoNodes.filter((node) => node.kind === "Service").map((node) => node.name)).length,
        tableCount: unique(repoNodes.filter((node) => node.kind === "Table").map((node) => node.name)).length,
        topicCount: unique(repoNodes.filter((node) => node.kind === "Topic").map((node) => node.name)).length,
        docSummary: doc?.summary,
        docGeneratedAt: doc?.generatedAt,
        docMode: doc?.mode,
        docStale: Boolean(doc && doc.sourceFingerprint !== sourceFingerprint)
      };
    });
  }

  replaceGraphForRepository(repo: RepositoryRecord, nodes: GraphNode[], edges: GraphEdge[]): void {
    const tx = this.db.transaction(() => {
      this.db.prepare("delete from edges where repo = ?").run(repo.name);
      this.db.prepare("delete from nodes where repo = ?").run(repo.name);
      const insertNode = this.db.prepare("insert into nodes (id, kind, name, repo, file_path, metadata) values (?, ?, ?, ?, ?, ?)");
      for (const node of nodes) {
        insertNode.run(node.id, node.kind, node.name, node.repo, node.filePath ?? null, JSON.stringify(node.metadata ?? {}));
      }
      const insertEdge = this.db.prepare("insert into edges (id, from_id, to_id, kind, repo, metadata) values (?, ?, ?, ?, ?, ?)");
      for (const edge of edges) {
        insertEdge.run(edge.id, edge.fromId, edge.toId, edge.kind, repo.name, JSON.stringify(edge.metadata ?? {}));
      }
      this.db.prepare("update repositories set last_indexed_at = ? where id = ?").run(new Date().toISOString(), repo.id);
    });
    tx();
  }

  getNodes(): GraphNode[] {
    return (
      this.db.prepare("select id, kind, name, repo, file_path as filePath, metadata from nodes order by repo, kind, name").all() as DbNode[]
    ).map(hydrateNode);
  }

  getEdges(): GraphEdge[] {
    return (this.db.prepare("select id, from_id as fromId, to_id as toId, kind, metadata from edges order by kind").all() as DbEdge[]).map(
      hydrateEdge
    );
  }

  getRepositoryEvidence(repoName: string): RepositoryDocEvidence {
    const repository = this.getRepositories().find((repo) => repo.name === repoName);
    if (!repository) {
      throw new Error(`Repository '${repoName}' is not registered.`);
    }
    const nodes = this.getNodes().filter((node) => node.repo === repoName);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = this.getEdges().filter((edge) => nodeIds.has(edge.fromId) || nodeIds.has(edge.toId));
    return {
      repository,
      nodes,
      edges,
      sourceFingerprint: this.repositoryFingerprint(repoName)
    };
  }

  getRepositoryDoc(repoName: string): RepositoryDoc | undefined {
    const row = this.db
      .prepare(
        `select repo_id as repoId, repo_name as repoName, summary, markdown, generated_at as generatedAt,
                source_fingerprint as sourceFingerprint, model, mode,
                deterministic_summary as deterministicSummary,
                deterministic_markdown as deterministicMarkdown,
                deterministic_generated_at as deterministicGeneratedAt,
                llm_summary as llmSummary,
                llm_markdown as llmMarkdown,
                llm_generated_at as llmGeneratedAt,
                llm_model as llmModel
         from repository_docs where repo_name = ?`
      )
      .get(repoName) as DbRepositoryDoc | undefined;
    return row ? hydrateRepositoryDoc(row) : undefined;
  }

  getRepositoryDocs(): RepositoryDoc[] {
    return (
      this.db
        .prepare(
          `select repo_id as repoId, repo_name as repoName, summary, markdown, generated_at as generatedAt,
                source_fingerprint as sourceFingerprint, model, mode,
                deterministic_summary as deterministicSummary,
                deterministic_markdown as deterministicMarkdown,
                deterministic_generated_at as deterministicGeneratedAt,
                llm_summary as llmSummary,
                llm_markdown as llmMarkdown,
                llm_generated_at as llmGeneratedAt,
                llm_model as llmModel
         from repository_docs order by repo_name`
        )
        .all() as DbRepositoryDoc[]
    ).map(hydrateRepositoryDoc);
  }

  saveRepositoryDoc(doc: RepositoryDoc): void {
    const record = repositoryDocRecord(doc);
    this.db
      .prepare(
        `insert into repository_docs (
           repo_id, repo_name, summary, markdown, generated_at, source_fingerprint, model, mode,
           deterministic_summary, deterministic_markdown, deterministic_generated_at,
           llm_summary, llm_markdown, llm_generated_at, llm_model
         )
         values (
           @repoId, @repoName, @summary, @markdown, @generatedAt, @sourceFingerprint, @model, @mode,
           @deterministicSummary, @deterministicMarkdown, @deterministicGeneratedAt,
           @llmSummary, @llmMarkdown, @llmGeneratedAt, @llmModel
         )
         on conflict(repo_name) do update set
           repo_id = excluded.repo_id,
           summary = excluded.summary,
           markdown = excluded.markdown,
           generated_at = excluded.generated_at,
           source_fingerprint = excluded.source_fingerprint,
           model = excluded.model,
           mode = excluded.mode,
           deterministic_summary = excluded.deterministic_summary,
           deterministic_markdown = excluded.deterministic_markdown,
           deterministic_generated_at = excluded.deterministic_generated_at,
           llm_summary = excluded.llm_summary,
           llm_markdown = excluded.llm_markdown,
           llm_generated_at = excluded.llm_generated_at,
           llm_model = excluded.llm_model`
      )
      .run(record);
  }

  getDocTargets(repoName: string): GraphNode[] {
    return this.getNodes()
      .filter((node) => node.repo === repoName && (node.kind === "Service" || node.kind === "Endpoint"))
      .filter((node) => !(node.kind === "Service" && node.metadata?.external))
      .filter((node) => node.kind === "Endpoint" || Boolean(node.metadata?.stereotype))
      .sort((a, b) => `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`));
  }

  getGraphItemDoc(nodeId: string): GraphItemDoc | undefined {
    const row = this.db
      .prepare(
        `select node_id as nodeId, repo_name as repoName, node_kind as nodeKind, node_name as nodeName,
                summary, markdown, generated_at as generatedAt, source_fingerprint as sourceFingerprint,
                model, mode,
                deterministic_summary as deterministicSummary,
                deterministic_markdown as deterministicMarkdown,
                deterministic_generated_at as deterministicGeneratedAt,
                llm_summary as llmSummary,
                llm_markdown as llmMarkdown,
                llm_generated_at as llmGeneratedAt,
                llm_model as llmModel
         from graph_item_docs where node_id = ?`
      )
      .get(nodeId) as DbGraphItemDoc | undefined;
    return row ? hydrateGraphItemDoc(row) : undefined;
  }

  getGraphItemDocs(repoName: string): GraphItemDoc[] {
    return (
      this.db
        .prepare(
          `select node_id as nodeId, repo_name as repoName, node_kind as nodeKind, node_name as nodeName,
                summary, markdown, generated_at as generatedAt, source_fingerprint as sourceFingerprint,
                model, mode,
                deterministic_summary as deterministicSummary,
                deterministic_markdown as deterministicMarkdown,
                deterministic_generated_at as deterministicGeneratedAt,
                llm_summary as llmSummary,
                llm_markdown as llmMarkdown,
                llm_generated_at as llmGeneratedAt,
                llm_model as llmModel
         from graph_item_docs where repo_name = ? order by node_kind, node_name`
        )
        .all(repoName) as DbGraphItemDoc[]
    ).map(hydrateGraphItemDoc);
  }

  saveGraphItemDoc(doc: GraphItemDoc): void {
    const record = graphItemDocRecord(doc);
    this.db
      .prepare(
        `insert into graph_item_docs (
           node_id, repo_name, node_kind, node_name, summary, markdown, generated_at, source_fingerprint, model, mode,
           deterministic_summary, deterministic_markdown, deterministic_generated_at,
           llm_summary, llm_markdown, llm_generated_at, llm_model
         )
         values (
           @nodeId, @repoName, @nodeKind, @nodeName, @summary, @markdown, @generatedAt, @sourceFingerprint, @model, @mode,
           @deterministicSummary, @deterministicMarkdown, @deterministicGeneratedAt,
           @llmSummary, @llmMarkdown, @llmGeneratedAt, @llmModel
         )
         on conflict(node_id) do update set
           repo_name = excluded.repo_name,
           node_kind = excluded.node_kind,
           node_name = excluded.node_name,
           summary = excluded.summary,
           markdown = excluded.markdown,
           generated_at = excluded.generated_at,
           source_fingerprint = excluded.source_fingerprint,
           model = excluded.model,
           mode = excluded.mode,
           deterministic_summary = excluded.deterministic_summary,
           deterministic_markdown = excluded.deterministic_markdown,
           deterministic_generated_at = excluded.deterministic_generated_at,
           llm_summary = excluded.llm_summary,
           llm_markdown = excluded.llm_markdown,
           llm_generated_at = excluded.llm_generated_at,
           llm_model = excluded.llm_model`
      )
      .run(record);
  }

  getGraphItemEvidence(nodeId: string): GraphItemDocEvidence {
    const node = this.getNodes().find((item) => item.id === nodeId);
    if (!node || (node.kind !== "Service" && node.kind !== "Endpoint")) {
      throw new Error(`Documentation target '${nodeId}' is not a service or endpoint.`);
    }
    const repository = this.getRepositories().find((repo) => repo.name === node.repo);
    if (!repository) throw new Error(`Repository '${node.repo}' is not registered.`);
    const edges = this.getEdges().filter((edge) => edge.fromId === node.id || edge.toId === node.id);
    const relatedIds = new Set<string>([node.id]);
    edges.forEach((edge) => {
      relatedIds.add(edge.fromId);
      relatedIds.add(edge.toId);
    });
    const repoNodes = this.getNodes().filter((item) => item.repo === node.repo);
    const terms = tokenize(node.name);
    const relatedNodes = repoNodes.filter((item) => {
      if (relatedIds.has(item.id) || item.filePath === node.filePath) return true;
      if (node.kind !== "Endpoint") return false;
      if (!["Service", "Table", "Topic"].includes(item.kind)) return false;
      return scoreNode(item, terms) > 0;
    });
    const sourceFingerprint = stableId("fingerprint", JSON.stringify({ node, relatedNodes, edges }));
    return { repository, node, relatedNodes, relatedEdges: edges, sourceFingerprint };
  }

  searchEvidence(question: string, options: { includeDocs?: boolean } = {}): EvidenceBundle {
    const nodes = this.getNodes();
    const edges = this.getEdges();
    const terms = tokenize(question);
    const scored = nodes
      .map((node) => ({ node, score: scoreNode(node, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const seeds = scored.slice(0, 24).map((item) => item.node);
    const seedIds = new Set(seeds.map((node) => node.id));
    const relatedEdges = edges.filter((edge) => seedIds.has(edge.fromId) || seedIds.has(edge.toId));
    const relatedIds = new Set<string>(seedIds);
    relatedEdges.forEach((edge) => {
      relatedIds.add(edge.fromId);
      relatedIds.add(edge.toId);
    });
    const matchedRepos = new Set(seeds.map((node) => node.repo));
    const relatedNodes = nodes.filter((node) => relatedIds.has(node.id) || matchedRepos.has(node.repo)).slice(0, 90);
    const suggestedFiles = unique(
      relatedNodes.map((node) => node.filePath).filter((filePath): filePath is string => Boolean(filePath))
    ).slice(0, 12);

    return {
      question,
      nodes: relatedNodes,
      edges: relatedEdges.slice(0, 80),
      suggestedFiles,
      repositories: this.getRepositories(),
      docs: options.includeDocs ? this.searchGeneratedDocs(terms, relatedNodes, matchedRepos) : []
    };
  }

  summary(): KnowledgeBaseSummary {
    return {
      name: this.name,
      root: this.root,
      repositories: this.getRepositories(),
      nodes: this.getNodes(),
      edges: this.getEdges()
    };
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists schema_meta (
        key text primary key,
        value text not null,
        updated_at text not null
      );
      create table if not exists repositories (
        id text primary key,
        name text not null,
        path text not null unique,
        added_at text not null,
        last_indexed_at text
      );
      create table if not exists nodes (
        id text primary key,
        kind text not null,
        name text not null,
        repo text not null,
        file_path text,
        metadata text not null
      );
      create index if not exists idx_nodes_repo on nodes(repo);
      create index if not exists idx_nodes_kind on nodes(kind);
      create table if not exists edges (
        id text primary key,
        from_id text not null,
        to_id text not null,
        kind text not null,
        repo text not null,
        metadata text not null
      );
      create index if not exists idx_edges_repo on edges(repo);
      create index if not exists idx_edges_from on edges(from_id);
      create index if not exists idx_edges_to on edges(to_id);
      create table if not exists repository_docs (
        repo_id text not null,
        repo_name text primary key,
        summary text not null,
        markdown text not null,
        generated_at text not null,
        source_fingerprint text not null,
        model text,
        mode text not null
      );
      create table if not exists graph_item_docs (
        node_id text primary key,
        repo_name text not null,
        node_kind text not null,
        node_name text not null,
        summary text not null,
        markdown text not null,
        generated_at text not null,
        source_fingerprint text not null,
        model text,
        mode text not null
      );
      create index if not exists idx_graph_item_docs_repo on graph_item_docs(repo_name);
      create index if not exists idx_graph_item_docs_kind on graph_item_docs(node_kind);
    `);
    this.addColumnIfMissing("repository_docs", "deterministic_summary", "deterministic_summary text");
    this.addColumnIfMissing("repository_docs", "deterministic_markdown", "deterministic_markdown text");
    this.addColumnIfMissing("repository_docs", "deterministic_generated_at", "deterministic_generated_at text");
    this.addColumnIfMissing("repository_docs", "llm_summary", "llm_summary text");
    this.addColumnIfMissing("repository_docs", "llm_markdown", "llm_markdown text");
    this.addColumnIfMissing("repository_docs", "llm_generated_at", "llm_generated_at text");
    this.addColumnIfMissing("repository_docs", "llm_model", "llm_model text");
    this.addColumnIfMissing("graph_item_docs", "deterministic_summary", "deterministic_summary text");
    this.addColumnIfMissing("graph_item_docs", "deterministic_markdown", "deterministic_markdown text");
    this.addColumnIfMissing("graph_item_docs", "deterministic_generated_at", "deterministic_generated_at text");
    this.addColumnIfMissing("graph_item_docs", "llm_summary", "llm_summary text");
    this.addColumnIfMissing("graph_item_docs", "llm_markdown", "llm_markdown text");
    this.addColumnIfMissing("graph_item_docs", "llm_generated_at", "llm_generated_at text");
    this.addColumnIfMissing("graph_item_docs", "llm_model", "llm_model text");
    this.assertCompatibleSchemaVersion();
    this.setSchemaVersion(CURRENT_SCHEMA_VERSION);
  }

  private addColumnIfMissing(table: string, column: string, ddl: string): void {
    const columns = this.db.prepare(`pragma table_info(${table})`).all() as { name: string }[];
    if (!columns.some((item) => item.name === column)) {
      this.db.exec(`alter table ${table} add column ${ddl}`);
    }
  }

  private assertCompatibleSchemaVersion(): void {
    const row = this.db.prepare("select value from schema_meta where key = 'schema_version'").get() as { value: string } | undefined;
    const version = Number(row?.value ?? CURRENT_SCHEMA_VERSION);
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`Invalid ContextOS schema version '${row?.value ?? ""}' in ${this.dbPath}.`);
    }
    if (version > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `ContextOS database schema version ${version} is newer than this app supports (${CURRENT_SCHEMA_VERSION}). Please update ContextOS.`
      );
    }
  }

  private setSchemaVersion(version: number): void {
    this.db
      .prepare(
        `insert into schema_meta (key, value, updated_at)
         values ('schema_version', ?, ?)
         on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(String(version), new Date().toISOString());
  }

  private repositoryFingerprint(repoName: string): string {
    const nodes = this.getNodes()
      .filter((node) => node.repo === repoName)
      .map((node) => ({
        id: node.id,
        kind: node.kind,
        name: node.name,
        filePath: node.filePath,
        metadata: node.metadata
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = this.getEdges()
      .filter((edge) => nodeIds.has(edge.fromId) || nodeIds.has(edge.toId))
      .map((edge) => ({
        id: edge.id,
        kind: edge.kind,
        fromId: edge.fromId,
        toId: edge.toId,
        metadata: edge.metadata
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return stableId("fingerprint", JSON.stringify({ nodes, edges }));
  }

  private searchGeneratedDocs(terms: string[], relatedNodes: GraphNode[], matchedRepos: Set<string>): EvidenceDoc[] {
    const relatedNodeIds = new Set(relatedNodes.map((node) => node.id));
    const repoDocs = this.getRepositoryDocs()
      .filter((doc) => matchedRepos.has(doc.repoName) || scoreText(doc.repoName, terms) > 0 || scoreText(doc.summary, terms) > 0)
      .map((doc) => ({
        doc: {
          kind: "Repository" as const,
          name: doc.repoName,
          repoName: doc.repoName,
          summary: doc.summary,
          markdown: compactMarkdown(doc.llmMarkdown ?? doc.deterministicMarkdown ?? doc.markdown),
          mode: doc.mode,
          model: doc.model
        },
        score: scoreText(`${doc.repoName} ${doc.summary} ${doc.llmMarkdown ?? doc.deterministicMarkdown ?? doc.markdown}`, terms)
      }));
    const itemDocs = unique(relatedNodes.map((node) => node.repo))
      .flatMap((repoName) => this.getGraphItemDocs(repoName))
      .filter((doc) => relatedNodeIds.has(doc.nodeId) || scoreText(`${doc.nodeName} ${doc.summary}`, terms) > 0)
      .map((doc) => ({
        doc: {
          kind: doc.nodeKind,
          name: doc.nodeName,
          repoName: doc.repoName,
          summary: doc.summary,
          markdown: compactMarkdown(doc.llmMarkdown ?? doc.deterministicMarkdown ?? doc.markdown),
          mode: doc.mode,
          model: doc.model
        },
        score:
          scoreText(`${doc.nodeName} ${doc.summary} ${doc.llmMarkdown ?? doc.deterministicMarkdown ?? doc.markdown}`, terms) +
          (relatedNodeIds.has(doc.nodeId) ? 2 : 0)
      }));
    return [...repoDocs, ...itemDocs]
      .sort((a, b) => b.score - a.score)
      .map((item) => item.doc)
      .slice(0, 12);
  }
}

export type EvidenceBundle = {
  question: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  suggestedFiles: string[];
  repositories: RepositoryRecord[];
  docs?: EvidenceDoc[];
};

export type EvidenceDoc = {
  kind: "Repository" | "Service" | "Endpoint";
  name: string;
  repoName: string;
  summary: string;
  markdown: string;
  mode: "openai" | "fallback";
  model?: string;
};

type DbNode = Omit<GraphNode, "metadata"> & { metadata: string };
type DbEdge = Omit<GraphEdge, "metadata"> & { metadata: string };
type DbRepositoryDoc = RepositoryDoc & {
  deterministicSummary?: string | null;
  deterministicMarkdown?: string | null;
  deterministicGeneratedAt?: string | null;
  llmSummary?: string | null;
  llmMarkdown?: string | null;
  llmGeneratedAt?: string | null;
  llmModel?: string | null;
};
type DbGraphItemDoc = GraphItemDoc & {
  deterministicSummary?: string | null;
  deterministicMarkdown?: string | null;
  deterministicGeneratedAt?: string | null;
  llmSummary?: string | null;
  llmMarkdown?: string | null;
  llmGeneratedAt?: string | null;
  llmModel?: string | null;
};

function hydrateNode(row: DbNode): GraphNode {
  return { ...row, metadata: safeJson(row.metadata) };
}

function hydrateEdge(row: DbEdge): GraphEdge {
  return { ...row, metadata: safeJson(row.metadata) };
}

function hydrateRepositoryDoc(row: DbRepositoryDoc): RepositoryDoc {
  const deterministicSummary = row.deterministicSummary ?? (row.mode === "fallback" ? row.summary : row.summary);
  const deterministicMarkdown = row.deterministicMarkdown ?? (row.mode === "fallback" ? row.markdown : row.markdown);
  const deterministicGeneratedAt = row.deterministicGeneratedAt ?? row.generatedAt;
  const llmSummary = row.llmSummary ?? (row.mode === "openai" ? row.summary : undefined);
  const llmMarkdown = row.llmMarkdown ?? (row.mode === "openai" ? row.markdown : undefined);
  const llmGeneratedAt = row.llmGeneratedAt ?? (row.mode === "openai" ? row.generatedAt : undefined);
  const llmModel = row.llmModel ?? (row.mode === "openai" ? row.model : undefined);
  const hasLlm = Boolean(llmMarkdown);
  return {
    ...row,
    summary: hasLlm ? (llmSummary ?? row.summary) : deterministicSummary,
    markdown: hasLlm ? (llmMarkdown ?? row.markdown) : deterministicMarkdown,
    generatedAt: hasLlm ? (llmGeneratedAt ?? row.generatedAt) : deterministicGeneratedAt,
    model: hasLlm ? (llmModel ?? undefined) : undefined,
    mode: hasLlm ? "openai" : "fallback",
    deterministicSummary,
    deterministicMarkdown,
    deterministicGeneratedAt,
    llmSummary: llmSummary ?? undefined,
    llmMarkdown: llmMarkdown ?? undefined,
    llmGeneratedAt: llmGeneratedAt ?? undefined,
    llmModel: llmModel ?? undefined
  };
}

function hydrateGraphItemDoc(row: DbGraphItemDoc): GraphItemDoc {
  const deterministicSummary = row.deterministicSummary ?? (row.mode === "fallback" ? row.summary : row.summary);
  const deterministicMarkdown = row.deterministicMarkdown ?? (row.mode === "fallback" ? row.markdown : row.markdown);
  const deterministicGeneratedAt = row.deterministicGeneratedAt ?? row.generatedAt;
  const llmSummary = row.llmSummary ?? (row.mode === "openai" ? row.summary : undefined);
  const llmMarkdown = row.llmMarkdown ?? (row.mode === "openai" ? row.markdown : undefined);
  const llmGeneratedAt = row.llmGeneratedAt ?? (row.mode === "openai" ? row.generatedAt : undefined);
  const llmModel = row.llmModel ?? (row.mode === "openai" ? row.model : undefined);
  const hasLlm = Boolean(llmMarkdown);
  return {
    ...row,
    summary: hasLlm ? (llmSummary ?? row.summary) : deterministicSummary,
    markdown: hasLlm ? (llmMarkdown ?? row.markdown) : deterministicMarkdown,
    generatedAt: hasLlm ? (llmGeneratedAt ?? row.generatedAt) : deterministicGeneratedAt,
    model: hasLlm ? (llmModel ?? undefined) : undefined,
    mode: hasLlm ? "openai" : "fallback",
    deterministicSummary,
    deterministicMarkdown,
    deterministicGeneratedAt,
    llmSummary: llmSummary ?? undefined,
    llmMarkdown: llmMarkdown ?? undefined,
    llmGeneratedAt: llmGeneratedAt ?? undefined,
    llmModel: llmModel ?? undefined
  };
}

function repositoryDocRecord(doc: RepositoryDoc): Record<string, string | null> {
  const deterministicSummary = doc.deterministicSummary ?? (doc.mode === "fallback" ? doc.summary : doc.summary);
  const deterministicMarkdown = doc.deterministicMarkdown ?? (doc.mode === "fallback" ? doc.markdown : doc.markdown);
  const deterministicGeneratedAt = doc.deterministicGeneratedAt ?? doc.generatedAt;
  const llmSummary = doc.llmSummary ?? (doc.mode === "openai" ? doc.summary : undefined);
  const llmMarkdown = doc.llmMarkdown ?? (doc.mode === "openai" ? doc.markdown : undefined);
  const llmGeneratedAt = doc.llmGeneratedAt ?? (doc.mode === "openai" ? doc.generatedAt : undefined);
  const llmModel = doc.llmModel ?? (doc.mode === "openai" ? doc.model : undefined);
  const hasLlm = Boolean(llmMarkdown);
  return {
    repoId: doc.repoId,
    repoName: doc.repoName,
    summary: hasLlm ? (llmSummary ?? doc.summary) : deterministicSummary,
    markdown: hasLlm ? (llmMarkdown ?? doc.markdown) : deterministicMarkdown,
    generatedAt: hasLlm ? (llmGeneratedAt ?? doc.generatedAt) : deterministicGeneratedAt,
    sourceFingerprint: doc.sourceFingerprint,
    model: hasLlm ? (llmModel ?? null) : null,
    mode: hasLlm ? "openai" : "fallback",
    deterministicSummary,
    deterministicMarkdown,
    deterministicGeneratedAt,
    llmSummary: llmSummary ?? null,
    llmMarkdown: llmMarkdown ?? null,
    llmGeneratedAt: llmGeneratedAt ?? null,
    llmModel: llmModel ?? null
  };
}

function graphItemDocRecord(doc: GraphItemDoc): Record<string, string | null> {
  const deterministicSummary = doc.deterministicSummary ?? (doc.mode === "fallback" ? doc.summary : doc.summary);
  const deterministicMarkdown = doc.deterministicMarkdown ?? (doc.mode === "fallback" ? doc.markdown : doc.markdown);
  const deterministicGeneratedAt = doc.deterministicGeneratedAt ?? doc.generatedAt;
  const llmSummary = doc.llmSummary ?? (doc.mode === "openai" ? doc.summary : undefined);
  const llmMarkdown = doc.llmMarkdown ?? (doc.mode === "openai" ? doc.markdown : undefined);
  const llmGeneratedAt = doc.llmGeneratedAt ?? (doc.mode === "openai" ? doc.generatedAt : undefined);
  const llmModel = doc.llmModel ?? (doc.mode === "openai" ? doc.model : undefined);
  const hasLlm = Boolean(llmMarkdown);
  return {
    nodeId: doc.nodeId,
    repoName: doc.repoName,
    nodeKind: doc.nodeKind,
    nodeName: doc.nodeName,
    summary: hasLlm ? (llmSummary ?? doc.summary) : deterministicSummary,
    markdown: hasLlm ? (llmMarkdown ?? doc.markdown) : deterministicMarkdown,
    generatedAt: hasLlm ? (llmGeneratedAt ?? doc.generatedAt) : deterministicGeneratedAt,
    sourceFingerprint: doc.sourceFingerprint,
    model: hasLlm ? (llmModel ?? null) : null,
    mode: hasLlm ? "openai" : "fallback",
    deterministicSummary,
    deterministicMarkdown,
    deterministicGeneratedAt,
    llmSummary: llmSummary ?? null,
    llmMarkdown: llmMarkdown ?? null,
    llmGeneratedAt: llmGeneratedAt ?? null,
    llmModel: llmModel ?? null
  };
}

function safeJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
    .flatMap((term) => [term, term.replace(/s$/, "")]);
}

function scoreNode(node: GraphNode, terms: string[]): number {
  const haystack = `${node.kind} ${node.name} ${node.repo} ${node.filePath ?? ""} ${JSON.stringify(node.metadata ?? {})}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function scoreText(value: string, terms: string[]): number {
  const haystack = value.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function compactMarkdown(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .join("\n")
    .slice(0, 6000);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function stableId(prefix: string, value: string): string {
  const hash = [...value].reduce((acc, char) => (Math.imul(31, acc) + char.charCodeAt(0)) >>> 0, 7).toString(16);
  return `${prefix}:${hash}`;
}

export function ensureKbExists(kb: string): void {
  const root = kbRoot(kb);
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  openKnowledgeBase(kb).close();
}

function createdFromDbFile(kb: string): string | undefined {
  const dbPath = join(kbRoot(kb), "contextos.db");
  if (!existsSync(dbPath)) return undefined;
  return statSync(dbPath).birthtime.toISOString();
}
