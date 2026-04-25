# ContextOS Agent Demo

Use this flow to demonstrate how Codex, Claude, or another coding agent can use ContextOS as local codebase memory.

## Demo Prompt

Ask the agent:

```text
Use ContextOS to understand what files I should inspect before changing the owner creation flow in spring-petclinic.
```

## Expected Agent Behavior

The skill should lead the agent to:

1. List available knowledge bases.
2. Select `spring-petclinic`.
3. Refresh the graph if needed.
4. Ask ContextOS with docs enabled.
5. Summarize the graph-backed answer and suggested files.

## Commands

Use the absolute ContextOS executable so the demo works from any folder:

```bash
CTX=/Users/linsonkurian/Documents/code/codex-hackathon/bin/contextos.js
$CTX kbs
$CTX ask spring-petclinic "What files should I inspect before changing owner creation flow?" --with-docs --verbose
```

## Expected Answer Themes

- `OwnerController` handles owner creation and owner update routes.
- `OwnerRepository` is the primary data access dependency.
- Owner-related routes include `GET /owners/new`, `POST /owners/new`, `GET /owners`, and `GET /owners/{ownerId}`.
- Related tables/entities include `owners`, `pets`, `types`, and `visits`.
- Suggested files should include:
  - `src/main/java/org/springframework/samples/petclinic/owner/OwnerController.java`
  - `src/main/java/org/springframework/samples/petclinic/owner/OwnerRepository.java`
  - `src/main/java/org/springframework/samples/petclinic/owner/Owner.java`
  - related pet/visit files when the graph finds downstream owner relationships.

## Talk Track

ContextOS is not replacing the agent. It gives the agent local, repo-specific memory. The agent still reasons and edits, but it first asks ContextOS for the relevant graph facts, docs, source files, and impact surface.
