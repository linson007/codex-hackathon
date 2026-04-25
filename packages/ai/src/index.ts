import OpenAI from "openai";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import type {
  EvidenceBundle,
  GraphEdge,
  GraphItemDoc,
  GraphItemDocEvidence,
  GraphNode,
  RepositoryDoc,
  RepositoryDocEvidence
} from "@contextos/store";

export type AskResult = {
  answer: string;
  mode: "openai" | "fallback";
  model?: string;
  evidence: EvidenceBundle;
};

export type AskStreamEvent = { type: "status"; message: string } | { type: "delta"; delta: string } | { type: "result"; result: AskResult };

export async function answerQuestion(evidence: EvidenceBundle): Promise<AskResult> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackAnswer(evidence, "AI synthesis unavailable: OPENAI_API_KEY is not set.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.2";
  try {
    const client = new OpenAI();
    const response = await client.responses.create({
      model,
      instructions: askInstructions(),
      input: JSON.stringify(toCompactEvidence(evidence), null, 2)
    });
    return {
      answer: response.output_text?.trim() || deterministicText(evidence),
      mode: "openai",
      model,
      evidence
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fallbackAnswer(evidence, `AI synthesis unavailable: ${message}`);
  }
}

export async function answerQuestionStream(
  evidence: EvidenceBundle,
  onEvent: (event: AskStreamEvent) => void | Promise<void>
): Promise<AskResult> {
  if (!process.env.OPENAI_API_KEY) {
    const result = fallbackAnswer(evidence, "AI synthesis unavailable: OPENAI_API_KEY is not set.");
    await onEvent({ type: "status", message: "OpenAI key missing; using deterministic graph fallback." });
    await onEvent({ type: "result", result });
    return result;
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.2";
  try {
    const client = new OpenAI();
    const stream = client.responses.stream({
      model,
      instructions: askInstructions(),
      input: JSON.stringify(toCompactEvidence(evidence), null, 2)
    });
    let answer = "";
    await onEvent({ type: "status", message: "Streaming OpenAI synthesis from graph evidence." });
    for await (const event of stream) {
      if (isTextDelta(event)) {
        answer += event.delta;
        await onEvent({ type: "delta", delta: event.delta });
      }
      if (event.type === "error") {
        throw new Error(event.message);
      }
      if (event.type === "response.failed") {
        throw new Error(event.response.error?.message ?? "OpenAI response failed.");
      }
    }
    const result = {
      answer: answer.trim() || deterministicText(evidence),
      mode: "openai" as const,
      model,
      evidence
    };
    await onEvent({ type: "result", result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = fallbackAnswer(evidence, `AI synthesis unavailable: ${message}`);
    await onEvent({ type: "status", message: "OpenAI streaming failed; using deterministic graph fallback." });
    await onEvent({ type: "result", result });
    return result;
  }
}

function askInstructions(): string {
  return [
    "You are ContextOS, an enterprise codebase assistant. Answer only from the provided evidence.",
    "Graph nodes, edges, repositories, and suggested files are authoritative.",
    "Generated docs, when present, may be used for explanatory context and onboarding wording, but do not override graph facts.",
    "Be concise, name impacted services, endpoints, tables, topics, and files. If evidence is incomplete, say what is missing."
  ].join(" ");
}

function isTextDelta(event: ResponseStreamEvent): event is ResponseStreamEvent & { type: "response.output_text.delta"; delta: string } {
  return event.type === "response.output_text.delta";
}

export async function generateRepositoryDocumentation(evidence: RepositoryDocEvidence): Promise<RepositoryDoc> {
  const fallback = fallbackRepositoryDoc(evidence, "fallback");
  const deterministic = withRepositoryDeterministicFields(fallback);
  if (!process.env.OPENAI_API_KEY) return deterministic;

  const model = process.env.OPENAI_MODEL ?? "gpt-5.2";
  try {
    const client = new OpenAI();
    const response = await client.responses.create({
      model,
      instructions: [
        "You are ContextOS, generating onboarding documentation for a new engineer.",
        "Use only the provided graph evidence. Do not invent behavior.",
        "Return Markdown with these exact sections: Overview, Business Functionality, APIs, Internal Services, Data Model, Messaging, External Dependencies, Key Files, New Joiner Reading Path.",
        "Write explanatory onboarding prose, not just bullet lists. Explain what the repository appears to own, how requests move through it, where business rules are likely to live, and what a new engineer should read first.",
        "Use compact tables or bullets for inventories, but add paragraphs that connect the facts. Mention gaps when evidence is incomplete."
      ].join(" "),
      input: JSON.stringify(toRepoDocEvidence(evidence), null, 2)
    });
    const markdown = response.output_text?.trim() || fallback.markdown;
    return {
      repoId: evidence.repository.id,
      repoName: evidence.repository.name,
      summary: firstContentLine(markdown) ?? fallback.summary,
      markdown,
      generatedAt: new Date().toISOString(),
      sourceFingerprint: evidence.sourceFingerprint,
      model,
      mode: "openai",
      deterministicSummary: deterministic.deterministicSummary,
      deterministicMarkdown: deterministic.deterministicMarkdown,
      deterministicGeneratedAt: deterministic.deterministicGeneratedAt,
      llmSummary: firstContentLine(markdown) ?? fallback.summary,
      llmMarkdown: markdown,
      llmGeneratedAt: new Date().toISOString(),
      llmModel: model
    };
  } catch {
    return deterministic;
  }
}

export async function generateGraphItemDocumentation(evidence: GraphItemDocEvidence): Promise<GraphItemDoc> {
  const fallback = fallbackGraphItemDoc(evidence, "fallback");
  const deterministic = withGraphItemDeterministicFields(fallback);
  if (!process.env.OPENAI_API_KEY) return deterministic;

  const model = process.env.OPENAI_MODEL ?? "gpt-5.2";
  try {
    const client = new OpenAI();
    const response = await client.responses.create({
      model,
      instructions: [
        "You are ContextOS, generating onboarding documentation for one code artifact.",
        "Use only the provided graph evidence. Do not invent behavior.",
        "For Service docs use sections: Overview, Responsibilities, APIs or Callers, Data and Messaging, Dependencies, Key File, How To Read This Service.",
        "For Endpoint docs use sections: Overview, Sequence Diagram, Request Flow, Business Behavior, Data and Messaging, Dependencies, Key File, How To Test or Trace.",
        "For Endpoint docs, include one fenced mermaid sequenceDiagram block under Sequence Diagram.",
        "Write explanatory onboarding prose, not just bullet lists. Explain the role of this artifact, how it participates in request flow, and what code a new engineer should inspect first."
      ].join(" "),
      input: JSON.stringify(toGraphItemEvidence(evidence), null, 2)
    });
    const markdown = response.output_text?.trim() || fallback.markdown;
    return {
      nodeId: evidence.node.id,
      repoName: evidence.node.repo,
      nodeKind: evidence.node.kind as "Service" | "Endpoint",
      nodeName: evidence.node.name,
      summary: firstContentLine(markdown) ?? fallback.summary,
      markdown,
      generatedAt: new Date().toISOString(),
      sourceFingerprint: evidence.sourceFingerprint,
      model,
      mode: "openai",
      deterministicSummary: deterministic.deterministicSummary,
      deterministicMarkdown: deterministic.deterministicMarkdown,
      deterministicGeneratedAt: deterministic.deterministicGeneratedAt,
      llmSummary: firstContentLine(markdown) ?? fallback.summary,
      llmMarkdown: markdown,
      llmGeneratedAt: new Date().toISOString(),
      llmModel: model
    };
  } catch {
    return deterministic;
  }
}

export function fallbackAnswer(evidence: EvidenceBundle, reason: string): AskResult {
  return {
    answer: `${reason}\n\n${deterministicText(evidence)}`,
    mode: "fallback",
    evidence
  };
}

function deterministicText(evidence: EvidenceBundle): string {
  const services = names(evidence.nodes, "Service");
  const endpoints = names(evidence.nodes, "Endpoint");
  const tables = names(evidence.nodes, "Table");
  const topics = names(evidence.nodes, "Topic");
  const repos = [...new Set(evidence.nodes.map((node) => node.repo))];
  const files = evidence.suggestedFiles;
  const docs = evidence.docs ?? [];

  return [
    `Question: ${evidence.question}`,
    repos.length ? `Impacted repositories: ${repos.join(", ")}` : "No impacted repositories found.",
    services.length ? `Impacted services: ${services.join(", ")}` : "No services matched.",
    endpoints.length ? `Endpoints: ${endpoints.join(", ")}` : "No endpoints matched.",
    tables.length ? `Tables: ${tables.join(", ")}` : "No tables matched.",
    topics.length ? `Kafka topics: ${topics.join(", ")}` : "No topics matched.",
    files.length ? `Suggested files: ${files.join(", ")}` : "No source files matched.",
    docs.length
      ? `Generated docs used: ${docs.map((doc) => `${doc.kind}:${doc.name} (${doc.repoName})`).join(", ")}`
      : "Generated docs used: none.",
    "Implementation risk: review matched service logic first, then validate downstream endpoint, database, and messaging impacts."
  ].join("\n");
}

function names(nodes: GraphNode[], kind: GraphNode["kind"]): string[] {
  return [...new Set(nodes.filter((node) => node.kind === kind).map((node) => `${node.name} (${node.repo})`))].slice(0, 12);
}

function withRepositoryDeterministicFields(doc: RepositoryDoc): RepositoryDoc {
  return {
    ...doc,
    deterministicSummary: doc.summary,
    deterministicMarkdown: doc.markdown,
    deterministicGeneratedAt: doc.generatedAt
  };
}

function withGraphItemDeterministicFields(doc: GraphItemDoc): GraphItemDoc {
  return {
    ...doc,
    deterministicSummary: doc.summary,
    deterministicMarkdown: doc.markdown,
    deterministicGeneratedAt: doc.generatedAt
  };
}

function fallbackRepositoryDoc(evidence: RepositoryDocEvidence, mode: RepositoryDoc["mode"]): RepositoryDoc {
  const repo = evidence.repository;
  const endpoints = uniqueNodes(evidence.nodes.filter((node) => node.kind === "Endpoint"));
  const services = uniqueNodes(evidence.nodes.filter((node) => node.kind === "Service"));
  const internalServices = services.filter((node) => !node.metadata?.external);
  const entities = uniqueNodes(evidence.nodes.filter((node) => node.kind === "Entity"));
  const tables = uniqueNodes(evidence.nodes.filter((node) => node.kind === "Table"));
  const topics = uniqueNodes(evidence.nodes.filter((node) => node.kind === "Topic"));
  const configs = evidence.nodes.filter((node) => node.kind === "Config");
  const files = evidence.nodes.filter((node) => node.kind === "File");
  const feignTargets = services.map((node) => node.metadata?.target).filter((target): target is string => typeof target === "string");
  const summary = buildSummary(repo.name, endpoints, internalServices, tables, topics);
  const markdown = [
    `# ${repo.name}`,
    "",
    "## Overview",
    summary,
    "",
    "## Business Functionality",
    internalServices.length
      ? bulletList(
          internalServices.map(
            (node) => `${node.name}${node.metadata?.stereotype ? ` (${node.metadata.stereotype})` : ""}${keywordsText(node)}`
          )
        )
      : "No business service classes were detected.",
    "",
    "## APIs",
    endpoints.length
      ? bulletList(endpoints.map((node) => `${node.name}${node.metadata?.controller ? ` via ${node.metadata.controller}` : ""}`))
      : "No REST APIs were detected.",
    "",
    "## Internal Services",
    internalServices.length ? bulletList(internalServices.map((node) => fileLine(node))) : "No Spring services were detected.",
    "",
    "## Data Model",
    [...entities, ...tables].length
      ? bulletList([...entities.map((node) => `Entity: ${fileLine(node)}`), ...tables.map((node) => `Table: ${fileLine(node)}`)])
      : "No entities or database tables were detected.",
    "",
    "## Messaging",
    topics.length
      ? bulletList(topics.map((node) => `${node.name} (${node.filePath ?? "source file unavailable"})`))
      : "No Kafka topics were detected.",
    "",
    "## External Dependencies",
    feignTargets.length
      ? bulletList([...new Set(feignTargets)].map((target) => `Calls ${target} via Feign client`))
      : "No Feign clients or external service calls were detected.",
    "",
    "## Key Files",
    bulletList(
      unique([...configs, ...files].map((node) => node.filePath).filter((filePath): filePath is string => Boolean(filePath))).slice(0, 12)
    ),
    "",
    "## New Joiner Reading Path",
    bulletList(readingPath(evidence.nodes, evidence.edges))
  ].join("\n");

  return {
    repoId: repo.id,
    repoName: repo.name,
    summary,
    markdown,
    generatedAt: new Date().toISOString(),
    sourceFingerprint: evidence.sourceFingerprint,
    mode
  };
}

function fallbackGraphItemDoc(evidence: GraphItemDocEvidence, mode: GraphItemDoc["mode"]): GraphItemDoc {
  const node = evidence.node;
  const endpoints = uniqueNodes(evidence.relatedNodes.filter((item) => item.kind === "Endpoint"));
  const services = uniqueNodes(evidence.relatedNodes.filter((item) => item.kind === "Service" && !item.metadata?.external));
  const tables = uniqueNodes(evidence.relatedNodes.filter((item) => item.kind === "Table"));
  const topics = uniqueNodes(evidence.relatedNodes.filter((item) => item.kind === "Topic"));
  const summary =
    node.kind === "Endpoint"
      ? `${node.name} is an API endpoint in ${node.repo}${node.metadata?.controller ? ` handled by ${node.metadata.controller}` : ""}.`
      : `${node.name} is a ${String(node.metadata?.stereotype ?? "service component")} in ${node.repo}.`;
  const markdown =
    node.kind === "Endpoint"
      ? [
          `# ${node.name}`,
          "",
          "## Overview",
          summary,
          "",
          "## Sequence Diagram",
          endpointSequenceDiagram(node, services, tables, topics),
          "",
          "## Request Flow",
          node.metadata?.controller ? `- Controller: ${node.metadata.controller}` : "- Controller was not detected.",
          node.filePath ? `- Source: ${node.filePath}` : "- Source file was not detected.",
          "",
          "## Business Behavior",
          keywordsText(node) || "Behavior is inferred from controller and nearby graph facts.",
          "",
          "## Data and Messaging",
          bulletList([...tables.map((item) => `Table: ${fileLine(item)}`), ...topics.map((item) => `Topic: ${fileLine(item)}`)]),
          "",
          "## Dependencies",
          services.length ? bulletList(services.map((item) => fileLine(item))) : "No related services were detected.",
          "",
          "## Key File",
          node.filePath ?? "Source file unavailable.",
          "",
          "## How To Test or Trace",
          bulletList([
            `Start at ${node.name}.`,
            node.filePath ? `Open ${node.filePath}.` : "",
            "Follow service calls, table usage, and messaging topics listed above."
          ])
        ].join("\n")
      : [
          `# ${node.name}`,
          "",
          "## Overview",
          summary,
          "",
          "## Responsibilities",
          keywordsText(node) || "Responsibilities are inferred from Spring stereotype, name, and related graph facts.",
          "",
          "## APIs or Callers",
          endpoints.length ? bulletList(endpoints.map((item) => fileLine(item))) : "No directly related APIs were detected.",
          "",
          "## Data and Messaging",
          bulletList([...tables.map((item) => `Table: ${fileLine(item)}`), ...topics.map((item) => `Topic: ${fileLine(item)}`)]),
          "",
          "## Dependencies",
          bulletList(evidence.relatedEdges.map((edge) => `${edge.kind}: ${edge.fromId} -> ${edge.toId}`)),
          "",
          "## Key File",
          node.filePath ?? "Source file unavailable.",
          "",
          "## How To Read This Service",
          bulletList([
            node.filePath ? `Open ${node.filePath}.` : "",
            "Identify public methods and injected dependencies.",
            "Trace related APIs, tables, and topics from the sections above."
          ])
        ].join("\n");

  return {
    nodeId: node.id,
    repoName: node.repo,
    nodeKind: node.kind as "Service" | "Endpoint",
    nodeName: node.name,
    summary,
    markdown,
    generatedAt: new Date().toISOString(),
    sourceFingerprint: evidence.sourceFingerprint,
    mode
  };
}

function buildSummary(repoName: string, endpoints: GraphNode[], services: GraphNode[], tables: GraphNode[], topics: GraphNode[]): string {
  const hints = [repoName, ...services.map((node) => node.name), ...endpoints.map((node) => node.name)].join(" ").toLowerCase();
  const domain = hints.includes("refund")
    ? "refund-related workflows"
    : hints.includes("billing")
      ? "billing workflows"
      : hints.includes("notification")
        ? "customer notification workflows"
        : hints.includes("order")
          ? "order workflows"
          : "application workflows";
  return `${repoName} supports ${domain}. The current graph shows ${endpoints.length} APIs, ${services.length} service components, ${tables.length} database tables, and ${topics.length} Kafka topics.`;
}

function bulletList(items: string[]): string {
  const clean = items.filter(Boolean);
  return clean.length ? clean.map((item) => `- ${item}`).join("\n") : "- No entries detected.";
}

function fileLine(node: GraphNode): string {
  return `${node.name}${node.filePath ? ` - ${node.filePath}` : ""}`;
}

function keywordsText(node: GraphNode): string {
  const keywords = node.metadata?.keywords;
  return Array.isArray(keywords) && keywords.length ? `; keywords: ${keywords.join(", ")}` : "";
}

function endpointSequenceDiagram(endpoint: GraphNode, services: GraphNode[], tables: GraphNode[], topics: GraphNode[]): string {
  const controller = String(endpoint.metadata?.controller ?? "Controller");
  const service = services.find((node) => node.metadata?.stereotype === "Service");
  const repository = services.find((node) => node.metadata?.stereotype === "Repository");
  const client = services.find((node) => node.metadata?.stereotype === "FeignClient");
  const table = tables[0];
  const topic = topics[0];
  const lines = [
    "```mermaid",
    "sequenceDiagram",
    "  actor User",
    `  participant Controller as ${sanitizeMermaidLabel(controller)}`,
    `  User->>Controller: ${sanitizeMermaidLabel(endpoint.name)}`
  ];
  if (service) {
    lines.push(`  participant Service as ${sanitizeMermaidLabel(service.name)}`);
    lines.push("  Controller->>Service: delegate request");
  }
  if (repository) {
    lines.push(`  participant Repository as ${sanitizeMermaidLabel(repository.name)}`);
    lines.push(`  ${service ? "Service" : "Controller"}->>Repository: load or persist data`);
  }
  if (table) {
    lines.push(`  participant DB as ${sanitizeMermaidLabel(table.name)}`);
    lines.push(`  ${repository ? "Repository" : service ? "Service" : "Controller"}->>DB: read/write`);
  }
  if (client) {
    lines.push(`  participant Client as ${sanitizeMermaidLabel(client.name)}`);
    lines.push(`  ${service ? "Service" : "Controller"}->>Client: call downstream service`);
  }
  if (topic) {
    lines.push(`  participant Topic as ${sanitizeMermaidLabel(topic.name)}`);
    lines.push(`  ${service ? "Service" : "Controller"}-->>Topic: publish or consume event`);
  }
  lines.push(`  ${service ? "Service" : "Controller"}-->>Controller: result`);
  lines.push("  Controller-->>User: response");
  lines.push("```");
  return lines.join("\n");
}

function sanitizeMermaidLabel(value: string): string {
  return value.replace(/[^\w\s/{}:-]/g, "").slice(0, 60);
}

function readingPath(nodes: GraphNode[], _edges: GraphEdge[]): string[] {
  const controllers = uniqueNodes(nodes.filter((node) => node.kind === "Service" && isControllerNode(node)));
  const services = uniqueNodes(nodes.filter((node) => node.kind === "Service" && node.metadata?.stereotype === "Service"));
  const repositories = uniqueNodes(nodes.filter((node) => node.kind === "Service" && node.metadata?.stereotype === "Repository"));
  const data = uniqueNodes(nodes.filter((node) => node.kind === "Entity" || node.kind === "Table"));
  return [
    ...controllers.slice(0, 4).map((node) => `Start with API entrypoint ${fileLine(node)}.`),
    ...services.slice(0, 6).map((node) => `Read business logic in ${fileLine(node)}.`),
    ...repositories.slice(0, 4).map((node) => `Check data access in ${fileLine(node)}.`),
    ...data.slice(0, 6).map((node) => `Review data model ${fileLine(node)}.`)
  ].slice(0, 12);
}

function isControllerNode(node: GraphNode): boolean {
  return node.metadata?.stereotype === "RestController" || node.metadata?.stereotype === "Controller";
}

function uniqueNodes(nodes: GraphNode[]): GraphNode[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    const key = `${node.kind}:${node.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function firstContentLine(markdown: string): string | undefined {
  const line = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("```"))
    .filter((line) => !line.match(/^[-:| ]+$/))
    .map(stripMarkdownInline)
    .find((line) => line && !["Overview", "Business Functionality", "Responsibilities", "Sequence Diagram"].includes(line));
  return line;
}

function stripMarkdownInline(value: string): string {
  return value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[>*-]\s*/, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toCompactEvidence(evidence: EvidenceBundle) {
  return {
    question: evidence.question,
    repositories: evidence.repositories.map((repo) => ({ name: repo.name, path: repo.path, lastIndexedAt: repo.lastIndexedAt })),
    nodes: evidence.nodes.map((node) => ({
      kind: node.kind,
      name: node.name,
      repo: node.repo,
      filePath: node.filePath,
      metadata: node.metadata
    })),
    edges: evidence.edges.map((edge) => ({
      kind: edge.kind,
      fromId: edge.fromId,
      toId: edge.toId,
      metadata: edge.metadata
    })),
    suggestedFiles: evidence.suggestedFiles,
    generatedDocs: (evidence.docs ?? []).map((doc) => ({
      kind: doc.kind,
      name: doc.name,
      repoName: doc.repoName,
      summary: doc.summary,
      mode: doc.mode,
      model: doc.model,
      markdown: doc.markdown
    }))
  };
}

function toRepoDocEvidence(evidence: RepositoryDocEvidence) {
  return {
    repository: evidence.repository,
    sourceFingerprint: evidence.sourceFingerprint,
    nodes: evidence.nodes.map((node) => ({
      kind: node.kind,
      name: node.name,
      filePath: node.filePath,
      metadata: node.metadata
    })),
    edges: evidence.edges.map((edge) => ({
      kind: edge.kind,
      fromId: edge.fromId,
      toId: edge.toId,
      metadata: edge.metadata
    }))
  };
}

function toGraphItemEvidence(evidence: GraphItemDocEvidence) {
  return {
    repository: evidence.repository,
    node: evidence.node,
    sourceFingerprint: evidence.sourceFingerprint,
    relatedNodes: evidence.relatedNodes.map((node) => ({
      kind: node.kind,
      name: node.name,
      filePath: node.filePath,
      metadata: node.metadata
    })),
    relatedEdges: evidence.relatedEdges
  };
}
