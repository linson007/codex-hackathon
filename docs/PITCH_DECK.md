# ContextOS Hackathon Pitch Deck

Use this with `docs/pitch-deck.html` for the interview. Keep the live demo short: CLI ask, web UI docs, dependency graph, and the skill story.

## 1. Title

ContextOS: Local codebase knowledge for developers and AI agents.

## 2. Problem

Large codebases are hard to understand. New joiners struggle to find APIs, business flows, tables, events, owners, and implementation risks. AI agents also lose context because repositories are too large for prompt windows.

## 3. Solution

ContextOS scans local repositories into a knowledge graph, generates onboarding docs, and lets humans or agents ask grounded questions.

## 4. Demo Scenario

Question: `What is impacted if I change refund eligibility logic?`

The answer should identify services, endpoints, tables, Kafka topics, source files, and implementation risks across `order-service`, `billing-service`, and `notification-service`.

## 5. What We Built

- CLI for KB lifecycle, scanning, docs, ask, UI, export, and Jira planning.
- SQLite graph store under the user directory.
- Spring-style scanner for controllers, endpoints, services, repositories, entities, Feign clients, Kafka listeners, config, and SQL tables.
- React UI for ask, docs, and graph exploration.
- OpenAI answer/doc synthesis with deterministic fallback.
- `SKILL.md` for Codex/Claude agent usage.

## 6. Architecture

Local repos go through the scanner into SQLite. CLI, API, UI, and skills retrieve graph facts and docs. OpenAI is optional and receives compact evidence, not whole repositories.

## 7. Human Workflow

Developers open the web UI, choose a KB, read repository docs, inspect services/endpoints, view sequence diagrams, and explore the dependency graph.

## 8. AI Agent Workflow

Codex or Claude loads `skills/contextos-codebase-analysis/SKILL.md`, runs `contextos update`, calls `contextos ask --with-docs`, and uses the result as local codebase memory.

## 9. Differentiators

- Local-first and source controlled.
- Graph facts are deterministic.
- LLM output is grounded and optional.
- Same KB serves humans and agents.
- Works without remote Git cloning or enterprise setup.

## 10. Ask / Next Steps

Pilot this against one real team codebase. Next steps: richer Java parsing, embeddings, PR impact summaries, Jira planning workflow, Backstage export, and architecture drift checks.
