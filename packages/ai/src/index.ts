import OpenAI from "openai";
import type { EvidenceBundle, GraphNode } from "@contextos/store";

export type AskResult = {
  answer: string;
  mode: "openai" | "fallback";
  model?: string;
  evidence: EvidenceBundle;
};

export async function answerQuestion(evidence: EvidenceBundle): Promise<AskResult> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackAnswer(evidence, "AI synthesis unavailable: OPENAI_API_KEY is not set.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.2";
  try {
    const client = new OpenAI();
    const response = await client.responses.create({
      model,
      instructions:
        "You are ContextOS, an enterprise codebase assistant. Answer only from the provided evidence. Be concise, name impacted services, endpoints, tables, topics, and files. If evidence is incomplete, say what is missing.",
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

  return [
    `Question: ${evidence.question}`,
    repos.length ? `Impacted repositories: ${repos.join(", ")}` : "No impacted repositories found.",
    services.length ? `Impacted services: ${services.join(", ")}` : "No services matched.",
    endpoints.length ? `Endpoints: ${endpoints.join(", ")}` : "No endpoints matched.",
    tables.length ? `Tables: ${tables.join(", ")}` : "No tables matched.",
    topics.length ? `Kafka topics: ${topics.join(", ")}` : "No topics matched.",
    files.length ? `Suggested files: ${files.join(", ")}` : "No source files matched.",
    "Implementation risk: review matched service logic first, then validate downstream endpoint, database, and messaging impacts."
  ].join("\n");
}

function names(nodes: GraphNode[], kind: GraphNode["kind"]): string[] {
  return [...new Set(nodes.filter((node) => node.kind === kind).map((node) => `${node.name} (${node.repo})`))].slice(0, 12);
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
    suggestedFiles: evidence.suggestedFiles
  };
}
