---
name: contextos-codebase-analysis
description: Use ContextOS to create, update, query, and inspect local knowledge bases for multi-repo codebases, especially Spring Boot microservices. Trigger for impact analysis, codebase onboarding, service discovery, endpoint/entity/topic/table dependency questions, or when a user asks to use ContextOS.
---

# ContextOS Codebase Analysis

Use ContextOS when a user needs codebase understanding across one or more local repositories: impact analysis, service discovery, onboarding, dependency tracing, or graph-backed answers.

ContextOS stores local knowledge bases under `~/.contextos/kbs` by default. Set `CONTEXTOS_HOME=/custom/path` only when the user asks for a different storage location.

ContextOS has two evidence layers:

- Graph facts: deterministic scanner output in SQLite. This is the source of truth for impact analysis.
- Generated docs: cached Markdown onboarding docs for repositories, services, and endpoints. These prefer LLM docs when available and fall back to deterministic facts.

The primary pattern is shared local context: humans use the web UI for onboarding docs and dependency exploration, while Codex/Claude calls `contextos ask` or `contextos docs view` when it needs project context. The JSON export is optional and mainly useful for external tools such as Jira, Backstage, CI checks, or custom automations.

## Quick Start

Prefer an installed command:

```bash
contextos --version
```

If unavailable and this repo is the current workspace, use:

```bash
./bin/contextos.js --version
```

List knowledge bases before creating a new one:

```bash
contextos kbs
```

If `contextos` is unavailable, replace it with `./bin/contextos.js` in the commands below.

## Workflow

1. List existing KBs with `contextos kbs`.
2. Reuse an existing KB when it matches the user’s target codebase.
3. If code may have changed, run `contextos update <kb>` before answering.
4. For impact or dependency questions, run `contextos ask <kb> "<question>"`.
5. For onboarding-style questions that should use generated docs, run `contextos ask <kb> "<question>" --with-docs`.
6. Generate or refresh onboarding docs with `contextos docs generate <kb> --force` when the user wants richer repo/service/endpoint docs.
7. Start the UI only when the user asks for visual exploration: `contextos ui`.
8. Stop the UI with `contextos stopui` when done or when ports are stuck.
9. Use `contextos export <kb> --format json` only when another tool needs a structured payload.

## Creating A Knowledge Base

```bash
contextos init <kb-name>
contextos repos add <kb-name> <repo-path>
contextos update <kb-name>
```

Add each repository path separately. Do not assume `init` scans repositories; only `update` scans registered repos.

Generate onboarding docs after graph indexing when the user asks for repo/service/endpoint documentation:

```bash
contextos docs generate <kb-name> --force
```

If `OPENAI_API_KEY` is set, docs include an LLM-written variant and a deterministic facts variant. If the key is missing or the API fails, only deterministic docs are generated.

## Answering Questions

Use `ask` for graph-backed answers:

```bash
contextos ask <kb-name> "What is impacted if I change refund eligibility logic?"
```

Use generated docs as additional explanatory context:

```bash
contextos ask <kb-name> "Explain the refund onboarding path" --with-docs
```

Default `ask` uses graph facts only. `--with-docs` sends graph facts plus relevant cached repository/service/endpoint docs. It sends one doc version per matched item, preferring LLM docs, then deterministic docs.

If `OPENAI_API_KEY` is set, ContextOS uses OpenAI for answer synthesis. Without it, ContextOS returns a deterministic graph-backed fallback answer.

## UI Usage

Start API and UI together:

```bash
contextos ui
```

The UI serves all KBs from `~/.contextos/kbs` and lets the user choose one. The ask panel has an Evidence toggle:

- `Graph`: graph facts only, default for impact analysis.
- `Graph + Docs`: graph facts plus cached generated docs, useful for onboarding Q&A.

Repository, service, and endpoint docs have an `LLM` / `Facts` toggle. LLM is shown by default when available.

Never delete a KB unless the user explicitly asks. Remove a KB with:

```bash
contextos kbs remove <kb-name>
```

## References

- For exact commands, read `references/commands.md`.
- For storage details, read `references/kb-storage.md`.
- For the demo flow, read `references/demo-workflow.md`.
