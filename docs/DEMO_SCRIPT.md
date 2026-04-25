# ContextOS Demo Script

## Setup
```bash
npm install
npm run contextos -- init retail-platform
npm run contextos -- repos add retail-platform samples/retail-platform/order-service
npm run contextos -- repos add retail-platform samples/retail-platform/billing-service
npm run contextos -- repos add retail-platform samples/retail-platform/notification-service
npm run contextos -- update retail-platform
```

## CLI Demo
```bash
npm run contextos -- ask retail-platform "What is impacted if I change refund eligibility logic?"
```

Expected themes:
- `order-service` owns refund eligibility.
- `billing-service` is called for refund preview/payment.
- `notification-service` consumes `refund-events`.
- Tables include `orders`, `refund_decisions`, `payments`, and `refunds`.
- Suggested files include controller, service, entity, repository, migration, and listener classes.

## UI Demo
```bash
npm run dev -w @contextos/api -- --kb retail-platform
npm run dev -w @contextos/ui
```

Open the Vite URL and ask the same refund eligibility question.
