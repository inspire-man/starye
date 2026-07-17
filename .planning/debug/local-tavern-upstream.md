---
status: resolved
trigger: Local Gateway sends /tavern/ to an unavailable port 3004 while the user-managed SillyTavern service is listening on 127.0.0.1:8000.
created: 2026-07-17
updated: 2026-07-17
---

# Debug: Local Tavern Upstream

## Symptoms

- Expected behavior: `http://localhost:8080/tavern/` loads the running local SillyTavern UI through Gateway.
- Actual behavior: Gateway returns 502 for `http://localhost:3004`.
- Reproduction: SillyTavern returns 200 at `http://127.0.0.1:8000/`, then Gateway returns 502 for `/tavern/`.

## Current Focus

- hypothesis: Gateway and the local startup script retain an obsolete Tavern SPA port default.
- next_action: Align the local upstream default and injected origin with the running SillyTavern service, then rerun the Gateway path.

## Evidence

- timestamp: 2026-07-17
  observation: SillyTavern responds 200 with its own page title on 127.0.0.1:8000.
- timestamp: 2026-07-17
  observation: Gateway reports a failed connection to localhost:3004 for /tavern/.

## Eliminated

- hypothesis: SillyTavern is not running.
  evidence: Direct HTTP request returned 200.

## Resolution

- root_cause: The Gateway and local startup script retained the removed Tavern SPA port 3004 and preserved the /tavern prefix, while the user-managed SillyTavern service listens at 127.0.0.1:8000 and serves from its root path.
- fix: Route the local service through TAVERN_ORIGIN with a 127.0.0.1:8000 fallback and always strip the Gateway /tavern prefix; inject the same local origin when starting Gateway.
- verification: Gateway routing tests passed 46/46, affected-file lint passed, Gateway HTTP returned SillyTavern HTML 200, and the browser loaded the full Tavern UI through http://localhost:8080/tavern/ without console errors.
- files_changed: apps/gateway/src/index.ts, apps/gateway/src/__tests__/routing.test.ts, scripts/local-dev.ts
