# @contextos/store

Purpose: SQLite-backed knowledge-base storage for repositories, graph nodes, graph edges, generated docs, and search evidence.

Entry point: `src/index.ts`

Development:

```bash
npm test -- packages/store/test/repository-docs.test.ts
npm run build
```

Default KB location: `~/.contextos/kbs/<kb-name>/contextos.db`.
