# ContextOS Commands

Use this command path for reliable demos from any folder:

```bash
CTX=/Users/linsonkurian/Documents/code/codex-hackathon/bin/contextos.js
```

If `contextos` is globally installed, it is also acceptable, but prefer `$CTX` in agent demos.

## Knowledge Bases

```bash
$CTX kbs
$CTX kbs list
$CTX kbs remove <kb-name>
$CTX kbs delete <kb-name>
```

## Repositories

```bash
$CTX repos add <kb-name> <repo-path>
$CTX repos list <kb-name>
$CTX repos remove <kb-name> <repo-path-or-name>
$CTX repos --all
```

## Indexing

```bash
$CTX init <kb-name>
$CTX update <kb-name>
$CTX update <kb-name> --generate-docs
```

`init` creates an empty KB. `update` scans all registered repos and refreshes graph nodes and edges. `--generate-docs` also refreshes cached onboarding docs after scanning.

## Documentation

```bash
$CTX docs generate <kb-name>
$CTX docs generate <kb-name> --force
$CTX docs generate <kb-name> --repo <repo-name>
$CTX docs view <kb-name> <repo-name>
$CTX docs view <kb-name> <repo-name> --variant llm
$CTX docs view <kb-name> <repo-name> --variant deterministic
$CTX docs view-node <kb-name> <node-id>
$CTX docs view-node <kb-name> <node-id> --variant llm
$CTX docs view-node <kb-name> <node-id> --variant deterministic
```

Docs are cached in SQLite. LLM docs are generated when `OPENAI_API_KEY` is set; deterministic docs are generated as fallback.

## Asking

```bash
$CTX ask <kb-name> "<question>"
$CTX ask <kb-name> "<question>" --with-docs
```

Examples:

```bash
$CTX ask retail-platform "What is impacted if I change refund eligibility logic?"
$CTX ask retail-platform "What is impacted if I change refund eligibility logic?" --with-docs
$CTX ask retail-platform "Which services consume refund-events?"
$CTX ask retail-platform "Which endpoints touch the orders table?"
```

Default ask uses graph facts only. `--with-docs` includes relevant cached repo/service/endpoint docs as explanatory context.

## UI

```bash
$CTX ui
$CTX ui --port 4317 --ui-port 5173
$CTX stopui
$CTX ui --stop
```

The UI serves all local KBs and lets the user choose one in the browser.
