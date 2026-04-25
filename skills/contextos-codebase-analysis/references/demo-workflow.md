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
```

Ask the main demo question:

```bash
./bin/contextos.js ask retail-platform "What is impacted if I change refund eligibility logic?"
```

Start UI:

```bash
./bin/contextos.js ui
```

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
