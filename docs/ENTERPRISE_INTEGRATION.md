# Agent And Tool Integration

The most important integration path for this MVP is local usage by humans and agents:

1. Keep ContextOS installed and running against local repositories.
2. Let humans use the web UI for onboarding docs, service/API details, and dependency exploration.
3. Package `skills/contextos-codebase-analysis/SKILL.md` with Codex, Claude, or another coding agent.
4. Let the agent call `contextos update`, `contextos ask`, and `contextos docs view` from the terminal to get graph-backed context.

The JSON export is a secondary interface. Use it when another system needs structured data, for example Jira planning, Backstage catalog enrichment, CI checks, or custom automation. Agents usually do not need the export because `contextos ask <kb> "<question>" --with-docs` already retrieves the right evidence.

## Export Interfaces

CLI:

```bash
./bin/contextos.js export retail-platform --format json
./bin/contextos.js export retail-platform --format json --no-pretty
```

API:

```bash
curl http://localhost:4317/api/kbs/retail-platform/export
```

UI:

- Open `contextos ui`.
- Use the `Export JSON` button in the header.
- Review the compact export summary and copy the JSON payload.

## Payload Contents

The export contains:

- KB metadata and schema version.
- Repository status and documentation freshness.
- Catalog groups for services, controllers, clients, endpoints, tables, and topics.
- Relationships with resolved `from` and `to` node details.
- Repository/service/endpoint documentation summaries.
- Integration hints for Backstage, Jira, Git/PR workflows, and observability.

## Integration Patterns

### Backstage

Use `repositories` and `catalog` to create or enrich catalog entities. Repository docs can become onboarding tabs, while endpoints, topics, and tables can become dependency cards.

### Jira / ServiceNow / Azure Boards

Use the export as planning context. A ticket assistant can match ticket text to services, APIs, tables, topics, and source files, then create implementation subtasks and testing notes.

The MVP includes a Jira Cloud dry-run/create command. See [JIRA_INTEGRATION.md](JIRA_INTEGRATION.md).

### GitHub / GitLab / Bitbucket

Compare exports before and after a change to generate PR impact summaries. Newly added endpoints, tables, topics, or service-call edges can be highlighted in code review.

### CI/CD

Run `contextos update` after merge or nightly, then publish the export as a build artifact. Future checks can fail on architecture drift, missing docs, or unreviewed dependency changes.

### Observability

Map runtime signals to graph facts:

- HTTP route to endpoint node.
- Kafka topic to publisher/consumer edges.
- Table name to repository/data-model nodes.
- Service class to traces, logs, dashboards, and alerts.

## Security Notes

- Keep the graph export scoped to repositories the user or team can access.
- Do not send whole repositories to LLMs. ContextOS should send compact graph evidence and selected docs/snippets only.
- Enterprise deployments should add SSO, RBAC, and audit logging before sharing KBs across teams.
