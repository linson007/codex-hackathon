# SQLite Migration Policy

ContextOS stores each knowledge base in `~/.contextos/kbs/<name>/contextos.db` by default. The current MVP schema is created and upgraded by `ContextStore.migrate()`.

## Current Guard

- `schema_meta` stores `schema_version`.
- `CURRENT_SCHEMA_VERSION` in `packages/store/src/index.ts` is the application-supported schema version.
- Opening a KB from a newer ContextOS version fails with a clear error instead of silently corrupting data.
- Older or missing schema metadata is treated as the current MVP schema and then written back to `schema_meta`.

## Adding A Schema Change

1. Increment `CURRENT_SCHEMA_VERSION`.
2. Add an idempotent migration block in `ContextStore.migrate()`.
3. Prefer safe operations:
   - `create table if not exists`
   - `create index if not exists`
   - `addColumnIfMissing(...)`
4. Avoid destructive migrations in the MVP path.
5. Add or update a store test that opens an older KB and verifies the migrated shape.
6. Update this file with the new schema version and purpose.

## Version History

| Version | Purpose                                                                 |
| ------- | ----------------------------------------------------------------------- |
| 1       | Initial MVP schema: repositories, graph nodes/edges, docs, schema_meta. |

## Operational Notes

- Knowledge bases are local developer data, not shared server databases.
- For hackathon demos, the safest reset remains deleting a KB with `contextos kbs remove <name>` and rebuilding it.
- For real usage, future migrations should be additive and covered by fixture-based tests before release.
