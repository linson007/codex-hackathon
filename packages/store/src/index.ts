import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type NodeKind =
  | "Repository"
  | "Service"
  | "Endpoint"
  | "Entity"
  | "Topic"
  | "Table"
  | "Config"
  | "File";

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

export type KnowledgeBaseSummary = {
  name: string;
  root: string;
  repositories: RepositoryRecord[];
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export function workspaceRoot(cwd = process.cwd()): string {
  return resolve(cwd);
}

export function kbRoot(kb: string, cwd = process.cwd()): string {
  return join(workspaceRoot(cwd), ".contextos", "kbs", kb);
}

export function openKnowledgeBase(kb: string, cwd = process.cwd()): ContextStore {
  return new ContextStore(kb, kbRoot(kb, cwd));
}

export class ContextStore {
  readonly dbPath: string;
  private db: Database.Database;

  constructor(readonly name: string, readonly root: string) {
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

  replaceGraphForRepository(repo: RepositoryRecord, nodes: GraphNode[], edges: GraphEdge[]): void {
    const tx = this.db.transaction(() => {
      this.db.prepare("delete from edges where repo = ?").run(repo.name);
      this.db.prepare("delete from nodes where repo = ?").run(repo.name);
      const insertNode = this.db.prepare(
        "insert into nodes (id, kind, name, repo, file_path, metadata) values (?, ?, ?, ?, ?, ?)"
      );
      for (const node of nodes) {
        insertNode.run(node.id, node.kind, node.name, node.repo, node.filePath ?? null, JSON.stringify(node.metadata ?? {}));
      }
      const insertEdge = this.db.prepare(
        "insert into edges (id, from_id, to_id, kind, repo, metadata) values (?, ?, ?, ?, ?, ?)"
      );
      for (const edge of edges) {
        insertEdge.run(edge.id, edge.fromId, edge.toId, edge.kind, repo.name, JSON.stringify(edge.metadata ?? {}));
      }
      this.db.prepare("update repositories set last_indexed_at = ? where id = ?").run(new Date().toISOString(), repo.id);
    });
    tx();
  }

  getNodes(): GraphNode[] {
    return (this.db.prepare("select id, kind, name, repo, file_path as filePath, metadata from nodes order by repo, kind, name").all() as DbNode[]).map(
      hydrateNode
    );
  }

  getEdges(): GraphEdge[] {
    return (this.db.prepare("select id, from_id as fromId, to_id as toId, kind, metadata from edges order by kind").all() as DbEdge[]).map(
      hydrateEdge
    );
  }

  searchEvidence(question: string): EvidenceBundle {
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
      relatedNodes
        .map((node) => node.filePath)
        .filter((filePath): filePath is string => Boolean(filePath))
    ).slice(0, 12);

    return {
      question,
      nodes: relatedNodes,
      edges: relatedEdges.slice(0, 80),
      suggestedFiles,
      repositories: this.getRepositories()
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
    `);
  }
}

export type EvidenceBundle = {
  question: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  suggestedFiles: string[];
  repositories: RepositoryRecord[];
};

type DbNode = Omit<GraphNode, "metadata"> & { metadata: string };
type DbEdge = Omit<GraphEdge, "metadata"> & { metadata: string };

function hydrateNode(row: DbNode): GraphNode {
  return { ...row, metadata: safeJson(row.metadata) };
}

function hydrateEdge(row: DbEdge): GraphEdge {
  return { ...row, metadata: safeJson(row.metadata) };
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

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function stableId(prefix: string, value: string): string {
  const hash = [...value].reduce((acc, char) => (Math.imul(31, acc) + char.charCodeAt(0)) >>> 0, 7).toString(16);
  return `${prefix}:${hash}`;
}

export function ensureKbExists(kb: string, cwd = process.cwd()): void {
  const root = kbRoot(kb, cwd);
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  openKnowledgeBase(kb, cwd).close();
}
