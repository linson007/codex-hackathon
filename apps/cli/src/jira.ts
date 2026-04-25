import type { EnterpriseExport, ExportNode } from "@contextos/store";

export type JiraPlan = {
  ticket: string;
  summary: string;
  impactedRepositories: string[];
  impactedServices: string[];
  impactedEndpoints: string[];
  impactedTables: string[];
  impactedTopics: string[];
  suggestedSubtasks: string[];
  sourceFiles: string[];
};

export type JiraIssueFields = {
  fields: {
    project: { key: string };
    issuetype: { name: string };
    summary: string;
    labels: string[];
    description: AtlassianDoc;
  };
};

type AtlassianDoc = {
  type: "doc";
  version: 1;
  content: AtlassianBlock[];
};

type AtlassianBlock =
  | { type: "heading"; attrs: { level: number }; content: AtlassianText[] }
  | { type: "paragraph"; content: AtlassianText[] }
  | { type: "bulletList"; content: Array<{ type: "listItem"; content: Array<{ type: "paragraph"; content: AtlassianText[] }> }> };

type AtlassianText = { type: "text"; text: string };

export function buildJiraPlan(exported: EnterpriseExport, ticket: string): JiraPlan {
  const terms = tokenize(ticket);
  const nodes = [
    ...exported.catalog.services,
    ...exported.catalog.controllers,
    ...exported.catalog.clients,
    ...exported.catalog.endpoints,
    ...exported.catalog.tables,
    ...exported.catalog.topics
  ];
  const matched = nodes.filter((node) => scoreNode(node, terms) > 0);
  const matchedIds = new Set(matched.map((node) => node.id));
  const related = exported.relationships
    .filter((edge) => matchedIds.has(edge.fromId) || matchedIds.has(edge.toId))
    .flatMap((edge) => [edge.from, edge.to])
    .filter((node): node is ExportNode => Boolean(node));
  const impacted = uniqueNodes([...matched, ...related]);
  const repos = unique(impacted.map((node) => node.repo));
  const services = impacted.filter((node) => node.kind === "Service" && !node.metadata?.external);
  const endpoints = impacted.filter((node) => node.kind === "Endpoint");
  const tables = impacted.filter((node) => node.kind === "Table");
  const topics = impacted.filter((node) => node.kind === "Topic");

  return {
    ticket,
    summary: `ContextOS impact analysis: ${ticket}`,
    impactedRepositories: repos,
    impactedServices: services.map((node) => `${node.name} (${node.repo})`).slice(0, 12),
    impactedEndpoints: endpoints.map((node) => `${node.name} (${node.repo})`).slice(0, 12),
    impactedTables: tables.map((node) => `${node.name} (${node.repo})`).slice(0, 12),
    impactedTopics: topics.map((node) => `${node.name} (${node.repo})`).slice(0, 12),
    suggestedSubtasks: buildSubtasks(services, endpoints, tables, topics),
    sourceFiles: unique(impacted.map((node) => node.filePath).filter((filePath): filePath is string => Boolean(filePath))).slice(0, 12)
  };
}

export function buildJiraIssueFields(plan: JiraPlan, projectKey: string, issueType: string): JiraIssueFields {
  return {
    fields: {
      project: { key: projectKey },
      issuetype: { name: issueType },
      summary: plan.summary.slice(0, 255),
      labels: ["contextos", "impact-analysis"],
      description: jiraDescription(plan)
    }
  };
}

export function formatJiraPlan(plan: JiraPlan): string {
  return [
    `Jira Planning Context`,
    `Ticket: ${plan.ticket}`,
    "",
    section("Impacted repositories", plan.impactedRepositories),
    section("Impacted services", plan.impactedServices),
    section("Impacted endpoints", plan.impactedEndpoints),
    section("Impacted tables", plan.impactedTables),
    section("Impacted topics", plan.impactedTopics),
    section("Suggested subtasks", plan.suggestedSubtasks),
    section("Source files", plan.sourceFiles)
  ].join("\n");
}

async function createJiraIssue(fields: JiraIssueFields): Promise<{ key: string; self: string }> {
  const baseUrl = requireEnv("JIRA_BASE_URL").replace(/\/$/, "");
  const email = requireEnv("JIRA_EMAIL");
  const apiToken = requireEnv("JIRA_API_TOKEN");
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
  const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(fields)
  });
  const payload = (await response.json()) as { key?: string; self?: string; errorMessages?: string[]; errors?: Record<string, string> };
  if (!response.ok) {
    throw new Error(`Jira issue create failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  if (!payload.key || !payload.self) {
    throw new Error(`Jira issue create returned an unexpected response: ${JSON.stringify(payload)}`);
  }
  return { key: payload.key, self: payload.self };
}

export async function createJiraIssueFromPlan(
  plan: JiraPlan,
  projectKey: string,
  issueType: string
): Promise<{ key: string; self: string }> {
  return createJiraIssue(buildJiraIssueFields(plan, projectKey, issueType));
}

function jiraDescription(plan: JiraPlan): AtlassianDoc {
  return {
    type: "doc",
    version: 1,
    content: [
      heading("ContextOS Impact Analysis"),
      paragraph(`Ticket: ${plan.ticket}`),
      heading("Impacted Repositories", 2),
      bulletList(plan.impactedRepositories),
      heading("Impacted Services", 2),
      bulletList(plan.impactedServices),
      heading("Impacted Endpoints", 2),
      bulletList(plan.impactedEndpoints),
      heading("Data and Messaging", 2),
      bulletList([...plan.impactedTables.map((item) => `Table: ${item}`), ...plan.impactedTopics.map((item) => `Topic: ${item}`)]),
      heading("Suggested Subtasks", 2),
      bulletList(plan.suggestedSubtasks),
      heading("Source Files", 2),
      bulletList(plan.sourceFiles)
    ]
  };
}

function heading(text: string, level = 1): AtlassianBlock {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function paragraph(text: string): AtlassianBlock {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function bulletList(items: string[]): AtlassianBlock {
  return {
    type: "bulletList",
    content: (items.length ? items : ["No matching graph facts found."]).map((item) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: item }] }]
    }))
  };
}

function buildSubtasks(services: ExportNode[], endpoints: ExportNode[], tables: ExportNode[], topics: ExportNode[]): string[] {
  return unique([
    ...services.slice(0, 4).map((node) => `Review and update ${node.name} in ${node.repo}.`),
    ...endpoints.slice(0, 3).map((node) => `Validate API behavior for ${node.name}.`),
    ...tables.slice(0, 3).map((node) => `Check data impact for table ${node.name}.`),
    ...topics.slice(0, 3).map((node) => `Verify publisher/consumer behavior for topic ${node.name}.`)
  ]).slice(0, 10);
}

function section(title: string, items: string[]): string {
  return [`${title}:`, ...(items.length ? items : ["No matching graph facts found."]).map((item) => `- ${item}`), ""].join("\n");
}

function scoreNode(node: ExportNode, terms: string[]): number {
  const haystack = `${node.kind} ${node.name} ${node.repo} ${node.filePath ?? ""} ${JSON.stringify(node.metadata ?? {})}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
    .flatMap((term) => [term, term.replace(/s$/, "")]);
}

function uniqueNodes(nodes: ExportNode[]): ExportNode[] {
  return [...new Map(nodes.map((node) => [node.id, node])).values()];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to create Jira issues.`);
  return value;
}
