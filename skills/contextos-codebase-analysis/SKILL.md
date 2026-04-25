---
name: contextos-codebase-analysis
description: Use ContextOS to create, update, query, and inspect local knowledge bases for multi-repo codebases, especially Spring Boot microservices. Trigger for impact analysis, codebase onboarding, service discovery, endpoint/entity/topic/table dependency questions, or when a user asks to use ContextOS.
---

# ContextOS Codebase Analysis

Use ContextOS when a user needs codebase understanding across one or more repositories: impact analysis, service discovery, onboarding, dependency tracing, or graph-backed answers.

ContextOS stores local knowledge bases under `~/.contextos/kbs` by default. Set `CONTEXTOS_HOME=/custom/path` only when the user asks for a different storage location.

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
5. Start the UI only when the user asks for visual exploration: `contextos ui`.
6. Stop the UI with `contextos stopui` when done or when ports are stuck.

## Creating A Knowledge Base

```bash
contextos init <kb-name>
contextos repos add <kb-name> <repo-path>
contextos update <kb-name>
```

Add each repository path separately. Do not assume `init` scans repositories; only `update` scans registered repos.

## Answering Questions

Use `ask` for graph-backed answers:

```bash
contextos ask <kb-name> "What is impacted if I change refund eligibility logic?"
```

If `OPENAI_API_KEY` is set, ContextOS uses OpenAI for answer synthesis. Without it, ContextOS returns a deterministic graph-backed fallback answer.

Never delete a KB unless the user explicitly asks. Remove a KB with:

```bash
contextos kbs remove <kb-name>
```

## References

- For exact commands, read `references/commands.md`.
- For storage details, read `references/kb-storage.md`.
- For the demo flow, read `references/demo-workflow.md`.
