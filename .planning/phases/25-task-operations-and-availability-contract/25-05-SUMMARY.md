---
phase: 25-task-operations-and-availability-contract
plan: 25-05
subsystem: crawler-availability
tags: [local-proof, local-runner, availability, gateway, uat]
requires:
  - phase: 25-task-operations-and-availability-contract
    provides: task operations, signed availability observation, D1 current/history projection
provides:
  - local runner duplicate-history sequencing fix
  - focused regression and type-check evidence for the local proof chain
  - canonical Gateway authentication checkpoint for the remaining live proof
affects: [phase-25-closeout, phase-26-video-availability]
tech-stack:
  added: []
  patterns: [reuse the accepted observation event sequence for exact duplicate history]
key-files:
  created: []
  modified:
    - packages/crawler/src/task-runner/local-runner.ts
    - packages/crawler/src/task-runner/__tests__/local-runner.test.ts
key-decisions:
  - "An exact duplicate uses a fresh signed event identity but the original observation event sequence, so the repository can classify it as duplicate instead of conflict."
  - "A missing authenticated Dashboard session remains a checkpoint; no live task is created and no local fixture is promoted to proof."
requirements-completed: []
coverage:
  - id: D1
    description: "Local proof runner retains bounded duplicate, conflict, stale and late observation outcomes without replacing current."
    verification:
      - kind: unit
        ref: packages/crawler/src/task-runner/__tests__/local-runner.test.ts#sends a bounded local-proof availability observation after the ordinary receipt
        status: pass
    human_judgment: false
  - id: D2
    description: "A fresh task completes through the authenticated canonical Gateway proof and Dashboard refresh."
    verification: []
    human_judgment: true
    rationale: "The proof needs a real authenticated Dashboard browser boundary; injected fixtures and anonymous profiles do not establish the live tuple."
duration: 45min
updated: 2026-08-11T11:25:58+08:00
status: human_needed
---

# Phase 25 Plan 25-05 Handoff

The local-proof implementation and automated regression boundary are complete. The remaining acceptance item is the real authenticated Dashboard -> Gateway -> API/D1 readback proof.

## Delivered

- `LocalTaskRunner` reuses the accepted observation sequence for the exact duplicate history request while each signed request still receives a fresh event identity.
- Focused crawler, API availability, proof, type-check, scripts type-check, and service readiness checks pass.
- Supervisor was restarted from the updated source; the new local runner runtime is owned by the supervisor and the stale ignored runtime config for the previous supervisor was removed.

## Live Checkpoint

- Gateway and all seven local service listeners are healthy through `http://localhost:8080`.
- The canonical proof stopped before task creation with `dashboard_gateway_session_missing` for each tested persisted profile. No new proof task/run was allocated by these attempts.
- A live pass remains pending an authenticated browser profile or CDP session. No production provider identity or local fixture result was used as a substitute.

## Verification

- `pnpm --filter @starye/crawler exec vitest run src/task-runner/__tests__/local-runner.test.ts src/task-runner/__tests__/runner-client.test.ts` -> 2 files, 11 tests passed.
- `pnpm exec vitest run scripts/phase25-dashboard-gateway-proof.test.ts` -> 1 file, 8 tests passed.
- Availability repository/integration/route focused suite -> 3 files, 14 tests passed.
- `pnpm --filter @starye/crawler type-check` -> pass.
- `pnpm exec tsc --noEmit -p scripts/tsconfig.json` -> pass.
- `pnpm check:services` -> healthy.
- `git diff --check` -> pass.

## Next Step

Run the canonical Phase 25 proof after an authenticated Dashboard browser profile or CDP session is available, then inspect the redacted matrix and update the phase UAT/verification gate.
