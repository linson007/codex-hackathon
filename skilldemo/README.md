# ContextOS Skill Demo

Open a new Codex or Claude CLI session from this folder:

```bash
cd /Users/linsonkurian/Documents/code/codex-hackathon/skilldemo
```

Then ask:

```text
Use ContextOS to understand what files I should inspect before changing owner creation flow in spring-petclinic.
```

The agent should discover `.skills/contextos-codebase-analysis/SKILL.md`, then use ContextOS as local codebase memory.

Expected commands:

```bash
/Users/linsonkurian/Documents/code/codex-hackathon/bin/contextos.js kbs
/Users/linsonkurian/Documents/code/codex-hackathon/bin/contextos.js ask spring-petclinic "What files should I inspect before changing owner creation flow?" --with-docs --verbose
```

Expected answer themes:

- `OwnerController`
- `OwnerRepository`
- owner endpoints such as `GET /owners/new` and `POST /owners/new`
- tables/entities such as `owners`, `pets`, and `visits`
- suggested files under `src/main/java/org/springframework/samples/petclinic/owner`
