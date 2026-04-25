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

Useful inspection commands:

```bash
sqlite3 ~/.contextos/kbs/<kb-name>/contextos.db ".tables"
sqlite3 ~/.contextos/kbs/<kb-name>/contextos.db ".schema"
sqlite3 ~/.contextos/kbs/<kb-name>/contextos.db "select kind, count(*) from nodes group by kind;"
sqlite3 ~/.contextos/kbs/<kb-name>/contextos.db "select kind, count(*) from edges group by kind;"
```
