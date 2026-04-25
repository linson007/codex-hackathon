# ContextOS Architecture

## MVP Flow
1. CLI creates a knowledge base under `.contextos/kbs/<name>`.
2. Repositories are registered by local path.
3. `update` scans Spring-style files and writes graph nodes/edges to SQLite.
4. `ask` retrieves relevant graph evidence from SQLite.
5. The evidence bundle is sent to OpenAI for synthesis when `OPENAI_API_KEY` is set.
6. If OpenAI is unavailable, ContextOS returns a deterministic graph-backed fallback answer.

## Components
- `apps/cli`: developer workflow entrypoint.
- `apps/api`: local HTTP API for the UI.
- `apps/ui`: React interface for search, graph, repo freshness, and impact views.
- `packages/scanner`: Spring annotation and SQL migration scanner.
- `packages/store`: SQLite knowledge-base storage.
- `packages/ai`: OpenAI Responses API integration and fallback answer generation.
