# ContextOS Commands

Use `contextos` when globally installed. In this repo, `./bin/contextos.js` is the local fallback.

## Knowledge Bases

```bash
contextos kbs
contextos kbs list
contextos kbs remove <kb-name>
contextos kbs delete <kb-name>
```

## Repositories

```bash
contextos repos add <kb-name> <repo-path>
contextos repos list <kb-name>
contextos repos remove <kb-name> <repo-path-or-name>
contextos repos --all
```

## Indexing

```bash
contextos init <kb-name>
contextos update <kb-name>
contextos update <kb-name> --generate-docs
```

`init` creates an empty KB. `update` scans all registered repos and refreshes graph nodes and edges. `--generate-docs` also refreshes cached onboarding docs after scanning.

## Documentation

```bash
contextos docs generate <kb-name>
contextos docs generate <kb-name> --force
contextos docs generate <kb-name> --repo <repo-name>
contextos docs view <kb-name> <repo-name>
contextos docs view <kb-name> <repo-name> --variant llm
contextos docs view <kb-name> <repo-name> --variant deterministic
contextos docs view-node <kb-name> <node-id>
contextos docs view-node <kb-name> <node-id> --variant llm
contextos docs view-node <kb-name> <node-id> --variant deterministic
```

Docs are cached in SQLite. LLM docs are generated when `OPENAI_API_KEY` is set; deterministic docs are generated as fallback.

## Asking

```bash
contextos ask <kb-name> "<question>"
contextos ask <kb-name> "<question>" --with-docs
```

Examples:

```bash
contextos ask retail-platform "What is impacted if I change refund eligibility logic?"
contextos ask retail-platform "What is impacted if I change refund eligibility logic?" --with-docs
contextos ask retail-platform "Which services consume refund-events?"
contextos ask retail-platform "Which endpoints touch the orders table?"
```

Default ask uses graph facts only. `--with-docs` includes relevant cached repo/service/endpoint docs as explanatory context.

## UI

```bash
contextos ui
contextos ui --port 4317 --ui-port 5173
contextos stopui
contextos ui --stop
```

The UI serves all local KBs and lets the user choose one in the browser.
