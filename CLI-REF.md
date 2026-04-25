# ContextOS CLI Reference

Generated from Commander help output.

## contextos

```text
Usage: contextos [options] [command]

AI knowledge graph for enterprise microservices

Options:
  -V, --version                                   output the version number
  -h, --help                                      display help for command

Commands:
  init <knowledge-base-name>                      Initialize a new knowledge base
  kbs                                             Manage local knowledge bases
  repos [options] [action] [kb] [repo]            Manage repositories linked to a knowledge base
  update [options] <knowledge-base-name>          Refresh a knowledge base using current repository state
  ask [options] <knowledge-base-name> <question>  Ask a natural-language question
  export [options] <knowledge-base-name>          Export a knowledge base for enterprise integrations
  jira-plan [options] <knowledge-base-name>       Build or create a Jira planning issue from ContextOS graph facts
  ui [options]                                    Launch the local API and web UI for all knowledge bases
  docs                                            Generate and inspect repository onboarding docs
  stopui [options]                                Stop the local ContextOS API and UI
  help [command]                                  display help for command
```

## contextos kbs

```text
Usage: contextos kbs [options] [command]

Manage local knowledge bases

Options:
  -h, --help                           display help for command

Commands:
  list                                 List local knowledge bases
  remove|delete <knowledge-base-name>  Remove a local knowledge base
  help [command]                       display help for command
```

## contextos repos

```text
Usage: contextos repos [options] [action] [kb] [repo]

Manage repositories linked to a knowledge base

Options:
  --all       List all local knowledge bases
  --verbose   Print extra command details
  -h, --help  display help for command
```

## contextos update

```text
Usage: contextos update [options] <knowledge-base-name>

Refresh a knowledge base using current repository state

Options:
  --generate-docs  Generate or refresh cached repository onboarding docs after
                   scanning
  --verbose        Print each indexing step and disable spinner
  -h, --help       display help for command
```

## contextos ask

```text
Usage: contextos ask [options] <knowledge-base-name> <question>

Ask a natural-language question

Options:
  --with-docs  Include generated repository/service/endpoint docs as
               explanatory context
  --verbose    Print evidence counts
  -h, --help   display help for command
```

## contextos docs

```text
Usage: contextos docs [options] [command]

Generate and inspect repository onboarding docs

Options:
  -h, --help                                           display help for command

Commands:
  generate [options] <knowledge-base-name>             Generate cached repository onboarding docs
  view [options] <knowledge-base-name> <repo-name>     Print cached repository onboarding docs
  view-node [options] <knowledge-base-name> <node-id>  Print cached service or endpoint onboarding docs
  help [command]                                       display help for command
```

## contextos docs generate

```text
Usage: contextos docs generate [options] <knowledge-base-name>

Generate cached repository onboarding docs

Options:
  --repo <repo-name>  Generate docs for one repository
  --force             Regenerate even when cached docs are fresh
  --verbose           Print skipped fresh docs and evidence details
  -h, --help          display help for command
```

## contextos docs view

```text
Usage: contextos docs view [options] <knowledge-base-name> <repo-name>

Print cached repository onboarding docs

Options:
  --variant <variant>  Doc variant to print (choices: "llm", "deterministic",
                       default: "llm")
  -h, --help           display help for command
```

## contextos docs view-node

```text
Usage: contextos docs view-node [options] <knowledge-base-name> <node-id>

Print cached service or endpoint onboarding docs

Options:
  --variant <variant>  Doc variant to print (choices: "llm", "deterministic",
                       default: "llm")
  -h, --help           display help for command
```

## contextos ui

```text
Usage: contextos ui [options]

Launch the local API and web UI for all knowledge bases

Options:
  -p, --port <port>  API port (default: "4317")
  --ui-port <port>   UI port (default: "5173")
  --stop             Stop API and UI processes running on the configured ports
  --verbose          Print launch details
  -h, --help         display help for command
```

## contextos stopui

```text
Usage: contextos stopui [options]

Stop the local ContextOS API and UI

Options:
  -p, --port <port>  API port (default: "4317")
  --ui-port <port>   UI port (default: "5173")
  --verbose          Print port details
  -h, --help         display help for command
```
