---
name: starye-hono-rpc
description: End-to-end framework for defining OpenAPI routed Hono endpoints connected to Vue frontends.
metadata:
  author: AI
  version: "1.0"
---

# Starye API Route Sync Toolkit

Hono RPC offers immense type safety, but only if its chain is rigidly respected. When implementing a new Backend endpoint, follow this sequence exactly.

## 1. Schema Definition (`apps/api/src/schemas/`)

- Always define Request (query/json) and Response payloads using Valibot.
- Export them clearly.

## 2. Route Declaration (`apps/api/src/routes/`)

- Use `@hono/zod-openapi`'s `createRoute` to attach the Valibot/Zod schemas.
- Implement the route logic logic (`app.openapi(route, c => { ... })`).
- If protecting routes, insert the appropriate Auth middleware (e.g. `R18` or `AuthGuard`).

## 3. Export Verification

- Ensure the newly exported router is mounted inside `apps/api/src/app.ts` so the `AppType` inference merges it into the global RPC Type tree.
- Validate: `pnpm --filter api type-check`

## 4. Frontend Client (`apps/*/src/lib/api-client.ts`)

- Extend the relevant app's `api-client.ts` with a wrapper method that invokes `client.api.your.route.$get({ query: ... })`.
- This ensures UI Vue components don't interact with raw `fetch` and strictly rely on the typed RPC wrapper.
