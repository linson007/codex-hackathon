# @contextos/api

Purpose: local Express API used by the React UI and compatibility API clients.

Entry point: `src/server.ts`

Development:

```bash
npm run dev:api
```

The API serves JSON routes under `/api/*`. After the UI is built, it also serves `apps/ui/dist` as static assets.
