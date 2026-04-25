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
```

`init` creates an empty KB. `update` scans all registered repos and refreshes graph nodes and edges.

## Asking

```bash
contextos ask <kb-name> "<question>"
```

Examples:

```bash
contextos ask retail-platform "What is impacted if I change refund eligibility logic?"
contextos ask retail-platform "Which services consume refund-events?"
contextos ask retail-platform "Which endpoints touch the orders table?"
```

## UI

```bash
contextos ui
contextos ui --port 4317 --ui-port 5173
contextos stopui
contextos ui --stop
```

The UI serves all local KBs and lets the user choose one in the browser.
