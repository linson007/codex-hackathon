# ContextOS Architecture

ContextOS is a local-first knowledge graph for codebase onboarding and impact analysis. The scanner builds deterministic graph facts first, optional documentation generation turns those facts into Markdown onboarding docs, and ask flows use graph evidence with optional generated-doc context.

Knowledge bases are stored under `~/.contextos/kbs/<name>` by default. Set `CONTEXTOS_HOME=/custom/path` to store them elsewhere.

Diagram sources live in `docs/architecture/diagrams/*.mmd`, and rendered SVG images live beside them. Regenerate images after editing Mermaid sources with:

```bash
node docs/architecture/render-mermaid.mjs
```

## Component Diagram

![ContextOS component diagram](architecture/diagrams/component-diagram.svg)

Source: [component-diagram.mmd](architecture/diagrams/component-diagram.mmd)

## SQLite Contents

Each KB has a `contextos.db` file. The main data groups are:

- `repositories`: registered local repo paths and freshness timestamps.
- `nodes`: graph facts such as repositories, controllers, services, endpoints, entities, tables, topics, config files, and source files.
- `edges`: relationships such as `exposes`, `calls`, `consumes`, `writes`, `reads`, `contains`, and `depends_on`.
- `repository_docs`: cached repo onboarding docs in Markdown, storing both deterministic and LLM variants when available.
- `graph_item_docs`: cached service and endpoint docs in Markdown, also storing both deterministic and LLM variants.

For generated docs, ContextOS keeps deterministic facts and LLM docs side by side. UI docs default to the LLM version if present, and fall back to deterministic docs if not.

## Update Flow

`contextos update <kb>` refreshes graph facts only. It does not call OpenAI unless `--generate-docs` is passed.

![ContextOS update flow](architecture/diagrams/update-flow.svg)

Source: [update-flow.mmd](architecture/diagrams/update-flow.mmd)

## Documentation Generation Flow

`contextos docs generate <kb> --force` regenerates repository, service, and endpoint docs from the current graph. This is the preferred demo command after setting `OPENAI_API_KEY`.

![ContextOS documentation generation flow](architecture/diagrams/docs-generation-flow.svg)

Source: [docs-generation-flow.mmd](architecture/diagrams/docs-generation-flow.mmd)

## Ask Flow

The default ask path uses graph evidence only. This is best for impact analysis because graph facts are the source of truth.

![ContextOS ask flow](architecture/diagrams/ask-flow.svg)

Source: [ask-flow.mmd](architecture/diagrams/ask-flow.mmd)

## Ask With Docs Flow

`contextos ask <kb> "<question>" --with-docs` and the UI `Graph + Docs` toggle include generated docs as additional explanatory context.

The evidence priority is:

1. Graph facts from nodes, edges, files, and repositories.
2. LLM docs for matched repositories, services, and endpoints, if available.
3. Deterministic docs for matched items when LLM docs are missing.

ContextOS sends one doc variant per matched item. It prefers `llmMarkdown`, then falls back to `deterministicMarkdown`, then `markdown`.

![ContextOS ask with docs flow](architecture/diagrams/ask-with-docs-flow.svg)

Source: [ask-with-docs-flow.mmd](architecture/diagrams/ask-with-docs-flow.mmd)

## UI Flow

![ContextOS UI flow](architecture/diagrams/ui-flow.svg)

Source: [ui-flow.mmd](architecture/diagrams/ui-flow.mmd)

## Fallback Behavior

- Scanning and graph storage never require OpenAI.
- `ask` works without OpenAI by returning a deterministic graph-backed answer.
- `docs generate` works without OpenAI by generating deterministic Markdown docs.
- If OpenAI succeeds, generated docs store both variants and the UI defaults to LLM docs.
- If OpenAI fails, existing graph data remains usable and deterministic docs/answers are still available.

## Current Tradeoffs

- Parsing is heuristic and optimized for Spring Boot-style Java services.
- Retrieval uses keyword and symbol matching, not embeddings.
- Docs are cached Markdown, not source-of-truth facts.
- Graph facts remain authoritative; LLM docs are explanatory context for onboarding and richer Q&A.
