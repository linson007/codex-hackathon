import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import type { GraphEdge, GraphNode, RepositoryRecord } from "@contextos/store";
import { stableId } from "@contextos/store";

export type ScanResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export function scanRepository(repo: RepositoryRecord): ScanResult {
  const files = walk(repo.path).filter(isInterestingFile);
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const repoNode = addNode(nodes, {
    kind: "Repository",
    name: repo.name,
    repo: repo.name,
    filePath: repo.path,
    metadata: { path: repo.path }
  });

  for (const absolutePath of files) {
    const relPath = relative(repo.path, absolutePath);
    const text = readFileSync(absolutePath, "utf8");
    const fileNode = addNode(nodes, {
      kind: "File",
      name: relPath,
      repo: repo.name,
      filePath: absolutePath,
      metadata: { relativePath: relPath }
    });
    addEdge(edges, repoNode.id, fileNode.id, "contains", repo.name);

    if (/pom\.xml$|build\.gradle/.test(relPath)) {
      const config = addNode(nodes, { kind: "Config", name: basename(relPath), repo: repo.name, filePath: absolutePath });
      addEdge(edges, fileNode.id, config.id, "contains", repo.name);
    }
    if (/application\.(ya?ml|properties)$/.test(relPath)) {
      const appName = match(text, /application:\s*\n\s*name:\s*([A-Za-z0-9_-]+)/) ?? repo.name;
      const service = addNode(nodes, { kind: "Service", name: appName, repo: repo.name, filePath: absolutePath });
      addEdge(edges, repoNode.id, service.id, "contains", repo.name);
    }
    if (/V\d+__.*\.sql$/.test(relPath)) {
      for (const table of extractTables(text)) {
        const tableNode = addNode(nodes, { kind: "Table", name: table, repo: repo.name, filePath: absolutePath });
        addEdge(edges, fileNode.id, tableNode.id, "writes", repo.name);
      }
    }
    if (absolutePath.endsWith(".java")) {
      scanJavaFile(repo, absolutePath, relPath, text, nodes, edges, fileNode.id);
    }
  }

  linkCrossReferences(repo.name, nodes, edges);
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

function scanJavaFile(
  repo: RepositoryRecord,
  absolutePath: string,
  relPath: string,
  text: string,
  nodes: Map<string, GraphNode>,
  edges: Map<string, GraphEdge>,
  fileNodeId: string
): void {
  const className = match(text, /\b(class|interface|enum)\s+([A-Z][A-Za-z0-9_]*)/, 2) ?? basename(relPath, ".java");
  let classNode: GraphNode | undefined;
  if (/@RestController/.test(text)) {
    classNode = addNode(nodes, { kind: "Service", name: className, repo: repo.name, filePath: absolutePath, metadata: { stereotype: "RestController" } });
    addEdge(edges, fileNodeId, classNode.id, "contains", repo.name);
    const basePath = match(text, /@RequestMapping\("([^"]+)"/) ?? "";
    for (const endpoint of extractEndpoints(text, basePath)) {
      const endpointNode = addNode(nodes, {
        kind: "Endpoint",
        name: `${endpoint.method} ${endpoint.path}`,
        repo: repo.name,
        filePath: absolutePath,
        metadata: { controller: className, method: endpoint.method, path: endpoint.path }
      });
      addEdge(edges, classNode.id, endpointNode.id, "exposes", repo.name);
    }
  }
  if (/@Service/.test(text)) {
    classNode = addNode(nodes, { kind: "Service", name: className, repo: repo.name, filePath: absolutePath, metadata: { stereotype: "Service" } });
    addEdge(edges, fileNodeId, classNode.id, "contains", repo.name);
  }
  if (/@Repository/.test(text)) {
    classNode = addNode(nodes, { kind: "Service", name: className, repo: repo.name, filePath: absolutePath, metadata: { stereotype: "Repository" } });
    addEdge(edges, fileNodeId, classNode.id, "contains", repo.name);
  }
  if (/@Entity/.test(text)) {
    const entity = addNode(nodes, { kind: "Entity", name: className, repo: repo.name, filePath: absolutePath });
    addEdge(edges, fileNodeId, entity.id, "contains", repo.name);
    const table = match(text, /@Table\(name\s*=\s*"([^"]+)"/);
    if (table) {
      const tableNode = addNode(nodes, { kind: "Table", name: table, repo: repo.name, filePath: absolutePath });
      addEdge(edges, entity.id, tableNode.id, "writes", repo.name);
    }
  }
  const feign = match(text, /@FeignClient\(name\s*=\s*"([^"]+)"/);
  if (feign) {
    const client = addNode(nodes, { kind: "Service", name: className, repo: repo.name, filePath: absolutePath, metadata: { stereotype: "FeignClient", target: feign } });
    const target = addNode(nodes, { kind: "Service", name: feign, repo: repo.name, metadata: { external: true } });
    addEdge(edges, client.id, target.id, "calls", repo.name, { via: "FeignClient" });
  }
  for (const topic of matches(text, /@KafkaListener\(topics\s*=\s*"([^"]+)"/g)) {
    const service = classNode ?? addNode(nodes, { kind: "Service", name: className, repo: repo.name, filePath: absolutePath });
    const topicNode = addNode(nodes, { kind: "Topic", name: topic, repo: repo.name, filePath: absolutePath });
    addEdge(edges, service.id, topicNode.id, "consumes", repo.name);
  }
  for (const topic of matches(text, /send\("([^"]+)"/g)) {
    const service = classNode ?? addNode(nodes, { kind: "Service", name: className, repo: repo.name, filePath: absolutePath });
    const topicNode = addNode(nodes, { kind: "Topic", name: topic, repo: repo.name, filePath: absolutePath });
    addEdge(edges, service.id, topicNode.id, "depends_on", repo.name, { via: "KafkaTemplate" });
  }
  for (const symbol of ["refund", "eligibility", "order", "billing", "notification"]) {
    if (text.toLowerCase().includes(symbol) && classNode) {
      classNode.metadata = { ...(classNode.metadata ?? {}), keywords: unique([...(classNode.metadata?.keywords as string[] | undefined ?? []), symbol]) };
    }
  }
}

function linkCrossReferences(repoName: string, nodes: Map<string, GraphNode>, edges: Map<string, GraphEdge>): void {
  const topics = [...nodes.values()].filter((node) => node.kind === "Topic");
  for (const publisher of topics) {
    for (const consumer of topics) {
      if (publisher.id !== consumer.id && publisher.name === consumer.name) {
        addEdge(edges, publisher.id, consumer.id, "depends_on", repoName, { reason: "same topic" });
      }
    }
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory() && !["node_modules", ".git", "target", "dist", "build"].includes(entry)) {
      return walk(path);
    }
    return stat.isFile() ? [path] : [];
  });
}

function isInterestingFile(path: string): boolean {
  return /\.(java|xml|ya?ml|properties|sql)$/.test(path) || /build\.gradle$/.test(path);
}

function extractEndpoints(text: string, basePath: string): Array<{ method: string; path: string }> {
  const endpoints: Array<{ method: string; path: string }> = [];
  const pattern = /@(Get|Post|Put|Delete|Patch|Request)Mapping(?:\((?:value\s*=\s*)?"([^"]*)")?/g;
  let current: RegExpExecArray | null;
  while ((current = pattern.exec(text))) {
    if (current[0].includes("@RequestMapping") && current.index < text.indexOf("class ")) continue;
    const method = current[1] === "Request" ? "ANY" : current[1].toUpperCase();
    const path = `${basePath}${current[2] ?? ""}`.replace(/\/+/g, "/") || "/";
    endpoints.push({ method, path });
  }
  return endpoints;
}

function extractTables(text: string): string[] {
  return unique([
    ...matches(text, /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_]+)/gi),
    ...matches(text, /alter\s+table\s+([a-zA-Z0-9_]+)/gi)
  ]);
}

function addNode(nodes: Map<string, GraphNode>, node: Omit<GraphNode, "id">): GraphNode {
  const id = stableId("node", `${node.kind}:${node.repo}:${node.name}:${node.filePath ?? ""}`);
  const existing = nodes.get(id);
  if (existing) return existing;
  const full = { ...node, id };
  nodes.set(id, full);
  return full;
}

function addEdge(edges: Map<string, GraphEdge>, fromId: string, toId: string, kind: GraphEdge["kind"], repo: string, metadata: Record<string, unknown> = {}): GraphEdge {
  const id = stableId("edge", `${fromId}:${kind}:${toId}:${JSON.stringify(metadata)}`);
  const edge = { id, fromId, toId, kind, metadata };
  edges.set(id, edge);
  return edge;
}

function match(text: string, pattern: RegExp, group = 1): string | undefined {
  return pattern.exec(text)?.[group];
}

function matches(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((item) => item[1]).filter(Boolean);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
