# ContextOS Demo Workflow

From the ContextOS repo:

```bash
npm install
npm run build
npm test
```

Create the sample KB:

```bash
./bin/contextos.js init retail-platform
./bin/contextos.js repos add retail-platform samples/retail-platform/order-service
./bin/contextos.js repos add retail-platform samples/retail-platform/billing-service
./bin/contextos.js repos add retail-platform samples/retail-platform/notification-service
./bin/contextos.js update retail-platform
./bin/contextos.js docs generate retail-platform --force
```

`docs generate --force` creates repository, service, and endpoint onboarding docs. With `OPENAI_API_KEY`, the LLM-written docs are generated and shown by default. Without a key, deterministic docs are still generated.

Ask the main demo question:

```bash
./bin/contextos.js ask retail-platform "What is impacted if I change refund eligibility logic?"
```

Ask with generated docs as additional onboarding context:

```bash
./bin/contextos.js ask retail-platform "What is impacted if I change refund eligibility logic?" --with-docs
```

Start UI:

```bash
./bin/contextos.js ui
```

In the UI, use the Evidence toggle in the ask panel:

- `Graph`: graph-only impact analysis.
- `Graph + Docs`: graph facts plus relevant cached docs.

Repository/service/endpoint docs also have an `LLM` / `Facts` toggle.

Stop UI:

```bash
./bin/contextos.js stopui
```

Expected answer themes:

- `order-service` owns refund eligibility logic.
- `billing-service` is called for refund preview/payment.
- `notification-service` consumes `refund-events`.
- Tables include `orders`, `refund_decisions`, `payments`, and `refunds`.
- Suggested files include controllers, services, entities, repositories, migrations, and listeners.
