# ContextOS

## Tagline

Local codebase knowledge for developers and AI agents.

## Problem

Large enterprise codebases have multiple Spring Boot services, many repositories, poor discoverability, slow onboarding, limited AI context windows, and difficult impact analysis. Developers waste hours tracing flows for each task.

## Solution

ContextOS continuously scans repositories and builds live local knowledge bases. Developers can read onboarding docs and dependency views in the web UI, while Codex, Claude, or other coding agents can query the same context from the CLI through `SKILL.md`.

A knowledge base can represent:

- one product domain
- one business unit
- one engineering team
- one environment
- one customer implementation

Users can maintain multiple isolated knowledge bases.

## Core CLI Experience

```bash
contextos init retail-platform
contextos repos add retail-platform samples/retail-platform/order-service
contextos repos add retail-platform samples/retail-platform/billing-service
contextos update retail-platform
contextos docs generate retail-platform --force
contextos ask retail-platform "Which services handle refunds?"
contextos ask retail-platform "What is impacted if I change refund eligibility logic?" --with-docs
contextos jira-plan retail-platform --ticket "Change refund eligibility logic"
contextos ui
```

The MVP supports local repository paths first. Remote Git cloning is a future capability.

## Commands

### init

Initialize a new knowledge base.

```bash
contextos init <knowledge-base-name>
```

Creates metadata, storage, and default settings.

Knowledge bases are stored under `~/.contextos/kbs/<name>` by default. Set `CONTEXTOS_HOME=/custom/path` to store them elsewhere.

### update

Refresh a knowledge base using current repository state.

```bash
contextos update <knowledge-base-name>
contextos update <knowledge-base-name> --generate-docs
contextos update <knowledge-base-name> --verbose
```

Refreshes deterministic graph facts. By default this does not call OpenAI. `--generate-docs` also regenerates onboarding docs after scanning.

### repos

Manage repositories linked to a knowledge base.

```bash
contextos repos add <kb> <local-repo-path>
contextos repos list <kb>
contextos repos remove <kb> <repo>
```

### kbs

List and remove local knowledge bases.

```bash
contextos kbs
contextos kbs remove <knowledge-base-name>
```

The list view shows KB name, repo count, node count, edge count, created time, and last updated time.

### ask

Ask natural-language questions.

```bash
contextos ask <kb> "Where is tax calculated?"
contextos ask <kb> "Impact of changing OrderStatus?"
contextos ask <kb> "What is impacted if I change refund eligibility logic?" --with-docs
```

The default ask flow retrieves graph evidence and sends the compact evidence bundle to OpenAI when `OPENAI_API_KEY` is available. Without a key, it returns a deterministic graph-backed fallback answer. `--with-docs` also includes cached repository, service, and endpoint docs as explanatory context.

The web UI uses the streaming ask endpoint so OpenAI answer text appears incrementally. The CLI keeps the stable request/response ask command.

### docs

Generate onboarding documentation for repositories, services, and endpoints.

```bash
contextos docs generate <kb>
contextos docs generate <kb> --repo order-service
contextos docs generate <kb> --force
contextos docs view <kb> order-service
```

Docs are cached Markdown. ContextOS stores deterministic and LLM-generated variants side by side; the UI defaults to LLM docs when present and falls back to deterministic docs.

### ui

Launch a local web UI for all local knowledge bases.

```bash
contextos ui
contextos ui --port 4317 --ui-port 5173
contextos stopui
```

The UI starts the local API and Vite UI together. `stopui` stops both from the CLI.

### export

Export a knowledge base for external tools.

```bash
contextos export <kb> --format json
```

The export includes repository status, services, controllers, clients, endpoints, tables, topics, relationships, docs summaries, and integration hints for tools such as Jira, Backstage, CI, or custom automations. This is optional for agent usage; Codex or Claude should normally use the local skill and call `contextos ask` directly.

### jira-plan

Build or create Jira planning context from ContextOS graph facts.

```bash
contextos jira-plan <kb> --ticket "Change refund eligibility logic"
contextos jira-plan <kb> --ticket "Change refund eligibility logic" --json
contextos jira-plan <kb> --ticket "Change refund eligibility logic" --create
```

Dry-run mode prints impact analysis and suggested subtasks. `--create` calls Jira Cloud using `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_PROJECT_KEY`.

## What Gets Indexed

- pom.xml / gradle files
- application.yml
- `@RestController`
- `@Service`
- `@Repository`
- `@Entity`
- `@FeignClient`
- `@KafkaListener`
- SQL migrations
- source files and likely entry/config files

## Knowledge Graph Model

### Nodes

- Repository
- Controller
- Service
- Endpoint
- Entity
- Repository/Class
- Client
- Topic
- Table
- Config
- File

### Edges

- calls
- owns
- publishes
- consumes
- depends_on
- reads
- writes
- exposes

## UI Features

- Search bar for natural-language queries
- Ask panel with graph-only and graph-plus-docs context options
- Streaming ask response in the UI
- Interactive React Flow dependency graph
- Dependency explorer
- Impact analysis view
- Repo freshness status
- Repository onboarding documentation
- Service and endpoint documentation
- Enterprise integration JSON preview and copy action
- Dark mode toggle
- Suggested files to inspect

## Architecture

Monorepo:

- TypeScript npm workspaces

CLI:

- Node.js, TypeScript, Commander

API:

- Express

Frontend:

- React, Vite, React Flow, Markdown rendering

Parsing:

- Heuristic Spring Boot-style scanner optimized for Java annotations and SQL migrations

Storage:

- SQLite under `~/.contextos/kbs/<name>/contextos.db`

LLM:

- OpenAI Responses API through the official `openai` TypeScript SDK
- Default model: `gpt-5.2`, override with `OPENAI_MODEL`
- Deterministic fallback when `OPENAI_API_KEY` is missing or an API call fails

## Demo Scenario

Ticket arrives: Change refund eligibility logic.

ContextOS returns:

- impacted repositories
- impacted services
- endpoints involved
- DB tables involved
- Kafka consumers
- likely source files
- implementation summary
- onboarding docs for each repository, service, and endpoint

## Why It Wins

- Solves real enterprise pain
- Fits existing developer workflow via CLI
- Supports multiple codebases
- Strong visual graph demo
- Local-first graph with optional OpenAI synthesis
- Useful onboarding documentation for new joiners

## Future Roadmap

- Git hooks auto-update
- PR impact summaries
- Jira ticket planning
- onboarding mode
- architecture drift alerts
- incident root-cause graph

## One-line Pitch

Your enterprise codebase now has memory.
