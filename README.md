# ContextOS

Local codebase knowledge for developers and AI agents.

ContextOS scans local multi-repo Spring-style services into a SQLite knowledge graph. Humans can use the web UI for onboarding docs, service/API details, sequence diagrams, and dependency exploration. Codex, Claude, or another coding agent can use the bundled `SKILL.md` to query the same local context from the CLI.

## What It Demonstrates

- Local knowledge bases stored under `~/.contextos/kbs`.
- Deterministic graph facts for controllers, endpoints, services, repositories, entities, Feign clients, Kafka listeners, SQL tables, config, and source files.
- OpenAI-powered answer and documentation synthesis when `OPENAI_API_KEY` is available.
- Deterministic fallback answers and docs when OpenAI is not configured.
- React web UI for ask, repository docs, service/endpoint docs, and React Flow dependency graph.
- `SKILL.md` workflow for Codex/Claude to retrieve codebase context before answering or editing.
- Optional JSON/Jira export paths for tool integration demos.

Product notes: [product.md](product.md)

Pitch deck: [docs/pitch-deck.html](docs/pitch-deck.html) and [docs/PITCH_DECK.md](docs/PITCH_DECK.md)

## Quick Start

```bash
npm install
npm run build
npm test
```

Run the full sample demo setup:

```bash
npm run demo
```

This initializes the `retail-platform` KB, adds the three sample repositories, updates the graph, generates docs with `--force`, and prints the main refund-impact answer.

## Manual Demo Commands

Use the local CLI during development:

```bash
./bin/contextos.js --version
```

Create and index the sample KB:

```bash
./bin/contextos.js init retail-platform
./bin/contextos.js repos add retail-platform samples/retail-platform/order-service
./bin/contextos.js repos add retail-platform samples/retail-platform/billing-service
./bin/contextos.js repos add retail-platform samples/retail-platform/notification-service
./bin/contextos.js update retail-platform
./bin/contextos.js docs generate retail-platform --force
```

Ask the demo question:

```bash
./bin/contextos.js ask retail-platform "What is impacted if I change refund eligibility logic?" --with-docs
```

Start the local API and UI together:

```bash
./bin/contextos.js ui
```

Open `http://localhost:5173`. Stop both servers with:

```bash
./bin/contextos.js stopui
```

## OpenAI Setup

OpenAI is optional. Without a key, ContextOS still scans, stores graph facts, generates deterministic docs, and answers with a deterministic fallback.

To enable AI synthesis:

```bash
export OPENAI_API_KEY="your_api_key_here"
export OPENAI_MODEL="gpt-5.2"
```

Then regenerate docs:

```bash
./bin/contextos.js docs generate retail-platform --force
```

## Human Workflow

Use the web UI for new-joiner onboarding:

- Ask impact or discovery questions.
- Toggle `Graph` / `Graph + Docs` evidence.
- Read repository onboarding documentation.
- Inspect service and endpoint docs.
- View sequence diagrams for endpoint flows.
- Explore the dependency graph.
- Use `Export JSON` only when showing optional tool integration payloads.

## AI Agent Workflow

The skill lives at:

```text
skills/contextos-codebase-analysis/SKILL.md
```

The intended agent flow is:

```bash
contextos kbs
contextos update <kb>
contextos ask <kb> "What should I inspect before changing refund eligibility?" --with-docs
contextos docs view <kb> order-service
```

If `contextos` is not globally linked, use `./bin/contextos.js` from this repo.

## Core Commands

```bash
./bin/contextos.js kbs
./bin/contextos.js repos list retail-platform
./bin/contextos.js update retail-platform --verbose
./bin/contextos.js docs generate retail-platform --force
./bin/contextos.js docs view retail-platform order-service
./bin/contextos.js ask retail-platform "Which services handle refunds?" --with-docs
./bin/contextos.js export retail-platform --format json
./bin/contextos.js jira-plan retail-platform --ticket "Change refund eligibility logic"
```

Full CLI reference: [CLI-REF.md](CLI-REF.md)

## Project Structure

```text
apps/cli       Commander-based contextos CLI
apps/api       Express API for KB, ask, docs, graph, and export endpoints
apps/ui        Vite React UI
packages/ai    OpenAI synthesis and deterministic fallback
packages/store SQLite knowledge-base storage
packages/scanner Spring-style repository scanner
samples/retail-platform Demo microservice repositories
skills/contextos-codebase-analysis Codex/Claude skill
docs           Architecture, demo, pitch, roadmap, and integration notes
```

## Development

```bash
npm run dev:api
npm run dev:ui
npm run lint
npm run format:check
npm test
npm run build
```

Generate the CLI reference after command changes:

```bash
npm run cli:ref
```

## Useful Docs

- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/FUTURE_ROADMAP.md](docs/FUTURE_ROADMAP.md)
- [docs/JIRA_INTEGRATION.md](docs/JIRA_INTEGRATION.md)
- [docs/SQLITE_MIGRATIONS.md](docs/SQLITE_MIGRATIONS.md)
