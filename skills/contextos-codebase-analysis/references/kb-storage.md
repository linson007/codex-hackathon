# ContextOS Knowledge Base Storage

Default location:

```text
~/.contextos/kbs/<kb-name>/contextos.db
```

Override location:

```bash
export CONTEXTOS_HOME="/path/to/contextos-data"
```

Then KBs live under:

```text
/path/to/contextos-data/kbs/<kb-name>/contextos.db
```

The KB database is SQLite. Main tables:

- `repositories`: registered repo paths and freshness timestamps.
- `nodes`: graph nodes such as Repository, Service, Endpoint, Entity, Topic, Table, Config, File.
- `edges`: graph relationships such as exposes, calls, consumes, depends_on, contains, writes.
- `repository_docs`: cached repository onboarding Markdown docs, with deterministic and LLM variants when available.
- `graph_item_docs`: cached service and endpoint Markdown docs, with deterministic and LLM variants when available.

Docs are not the source of truth. The graph tables remain authoritative. Ask with `--with-docs` uses generated docs only as explanatory context and prefers `llmMarkdown`, then `deterministicMarkdown`, then the compatibility `markdown` field.

Useful inspection commands:

```bash
sqlite3 ~/.contextos/kbs/<kb-name>/contextos.db ".tables"
sqlite3 ~/.contextos/kbs/<kb-name>/contextos.db ".schema"
sqlite3 ~/.contextos/kbs/<kb-name>/contextos.db "select kind, count(*) from nodes group by kind;"
sqlite3 ~/.contextos/kbs/<kb-name>/contextos.db "select kind, count(*) from edges group by kind;"
sqlite3 ~/.contextos/kbs/<kb-name>/contextos.db "select repo_name, mode, generated_at from repository_docs;"
sqlite3 ~/.contextos/kbs/<kb-name>/contextos.db "select repo_name, node_kind, node_name, mode from graph_item_docs order by repo_name, node_kind, node_name;"
```
