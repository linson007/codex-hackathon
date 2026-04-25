# ContextOS

## Tagline
AI knowledge graph for enterprise microservices.

## Problem
Large enterprise codebases have multiple Spring Boot services, many repositories, poor discoverability, slow onboarding, limited AI context windows, and difficult impact analysis. Developers waste hours tracing flows for each task.

## Solution
ContextOS continuously scans repositories and builds live knowledge bases that developers can query from the command line or UI.

A knowledge base can represent:
- one product domain
- one business unit
- one engineering team
- one environment
- one customer implementation

Users can maintain multiple isolated knowledge bases.

## Core CLI Experience

```bash
contextos init retail-platform
contextos repos add retail-platform git@github.com:org/order-service.git
contextos repos add retail-platform git@github.com:org/billing-service.git
contextos update retail-platform
contextos ask retail-platform "Which services handle refunds?"
contextos ui retail-platform
```

## Commands

### init
Initialize a new knowledge base.

```bash
contextos init <knowledge-base-name>
```

Creates metadata, storage, and default settings.

### update
Refresh a knowledge base using current repository state.

```bash
contextos update <knowledge-base-name>
```

Performs incremental scans and graph updates.

### repos
Manage repositories linked to a knowledge base.

```bash
contextos repos add <kb> <repo-url-or-path>
contextos repos list <kb>
contextos repos remove <kb> <repo>
contextos repos --all
```

### ask
Ask natural-language questions.

```bash
contextos ask <kb> "Where is tax calculated?"
contextos ask <kb> "Impact of changing OrderStatus?"
```

### ui
Launch a local web UI for search and graph visualization.

```bash
contextos ui <kb>
```

## What Gets Indexed
- pom.xml / gradle files
- application.yml
- @RestController
- @Service
- @Repository
- @Entity
- @FeignClient
- @KafkaListener
- SQL migrations
- REST/OpenAPI specs

## Knowledge Graph Model

### Nodes
- Repository
- Service
- Endpoint
- Entity
- Topic
- Table
- Team
- Config

### Edges
- calls
- owns
- publishes
- consumes
- depends_on
- reads
- writes
- exposes

## UI Features
- Search bar for natural-language queries
- Interactive service graph
- Dependency explorer
- Impact analysis view
- Repo freshness status
- Suggested files to inspect

## Architecture
Frontend:
- React

Backend:
- Spring Boot CLI + API

Parsing:
- JavaParser / Tree-sitter

Storage:
- Neo4j or SQLite + vectors

LLM:
- Ollama + Qwen Coder

## Demo Scenario
Ticket arrives: Change refund eligibility logic.

ContextOS returns:
- impacted repositories
- impacted services
- endpoints involved
- DB tables involved
- Kafka consumers
- likely source files
- implementation summary

## Why It Wins
- Solves real enterprise pain
- Fits existing developer workflow via CLI
- Supports multiple codebases
- Strong visual graph demo
- Efficient local AI architecture

## Future Roadmap
- Git hooks auto-update
- PR impact summaries
- Jira ticket planning
- onboarding mode
- architecture drift alerts
- incident root-cause graph

## One-line Pitch
Your enterprise codebase now has memory.
