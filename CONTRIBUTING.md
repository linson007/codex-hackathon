# Contributing

## Install

```bash
npm install
```

## Local Development

Run API and UI separately:

```bash
npm run dev:api
npm run dev:ui
```

Or run both through the ContextOS CLI:

```bash
./bin/contextos.js ui
```

## Quality Checks

Run these before handing off changes:

```bash
npm run lint
npm test
npm run build
```

Format files with:

```bash
npm run format
```

## Knowledge Bases

Knowledge bases are stored under `~/.contextos/kbs` unless `CONTEXTOS_HOME` is set. Do not delete a user KB unless explicitly asked.

## OpenAI

Set `OPENAI_API_KEY` to enable LLM answer synthesis and LLM onboarding docs. Without it, graph scans, UI, deterministic docs, and fallback answers still work.
