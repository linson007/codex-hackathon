# ContextOS

ContextOS is a local-first codebase knowledge graph for multi-repo Spring-style services. It scans local repositories into SQLite, answers impact questions from graph evidence, and generates onboarding docs with optional OpenAI synthesis.

Product notes: [product.md](product.md)

## Quick Start

```bash
npm install
npm run build
npm test
```

Use the local CLI:

```bash
./bin/contextos.js --version
```

Create and index the sample KB:

```bash
./bin/contextos.js init retail-platform
./bin/contextos.js repos add retail-platform samples/retail-platform/order-service
./bin/contextos.js repos add retail-platform samples/retail-platform/billing-service
./bin/contextos.js repos add retail-platform samples/retail-platform/notification-service
./bin/contextos.js update retail-platform
./bin/contextos.js docs generate retail-platform --force
```

Ask the demo question:

```bash
./bin/contextos.js ask retail-platform "What is impacted if I change refund eligibility logic?" --with-docs
```

Start the UI:

```bash
./bin/contextos.js ui
```

## Development

```bash
npm run dev:api
npm run dev:ui
npm run lint
npm run test
npm run build
```

Generate the CLI reference:

```bash
npm run cli:ref
```

Run the full demo scenario:

```bash
npm run demo
```
