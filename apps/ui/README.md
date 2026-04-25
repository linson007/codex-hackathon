# @contextos/ui

Purpose: React UI for asking questions, inspecting repository documentation, and exploring the dependency graph.

Entry point: `src/App.tsx`

Development:

```bash
npm run dev:ui
npm run build -w @contextos/ui
```

The UI talks to `VITE_CONTEXTOS_API` when set, otherwise `http://localhost:4317`.
