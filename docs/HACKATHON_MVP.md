# ContextOS Hackathon MVP

## Goal

Ship a convincing local demo in 10 hours: scan multiple Spring Boot-style services, build a graph, ask an impact question, and inspect the result in a UI.

## Time Boxes

- Hour 1: Monorepo scaffold, CLI shell, sample projects.
- Hours 2-3: Scanner for Spring annotations, SQL migrations, config, topics.
- Hours 4-5: SQLite store and update/search flow.
- Hour 6: OpenAI answer synthesis with deterministic fallback.
- Hours 7-8: React UI for ask, repo status, graph, and impact panels.
- Hour 9: Tests and demo script hardening.
- Hour 10: Polish, smoke run, and backup fallback path.

## Demo Success Criteria

- `contextos init retail-platform` creates a KB.
- Three local sample repos can be added and indexed.
- `contextos ask retail-platform "What is impacted if I change refund eligibility logic?"` returns impacted services, files, tables, endpoints, and topics.
- UI shows graph data and an ask result.
