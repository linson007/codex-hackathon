# @contextos/ai

Purpose: OpenAI answer/doc synthesis plus deterministic fallback answers and docs.

Entry point: `src/index.ts`

Development:

```bash
npm run build
npm test
```

Set `OPENAI_API_KEY` for LLM synthesis. Missing keys fall back to deterministic graph-backed output.
