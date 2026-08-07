---
phase: 23-github-actions-production-repair-and-reconciliation
plan: 04
subsystem: signed-callbacks
tags: [hmac, callbacks, replay, stale, conflict, receipt]
requires:
  - phase: 23-03
    provides: bounded retry, receipt validation, provider reconciliation, and current-attempt source CAS
provides:
  - shared strict repair source observation callback schema
  - signed callback route binding for provider, lifecycle, source, attempt, sequence, event, and nonce facts
  - bounded duplicate, stale, conflict, and receipt/readback outcomes
affects: [23-05, production-repair]
requirements-completed: [REP-02, REP-03]
---

# Phase 23 Plan 04 Summary

## Accomplishments

- Promoted the strict `repair_players` source-observation envelope into the shared crawler-run schema so callback clients and routes use one bounded contract.
- Kept raw-body HMAC verification, key rotation validity, request age, URL run binding, application attempt, event identity, nonce, sequence, provider snapshot, and source revision checks ahead of repository mutation.
- Preserved stable replay behavior: identical signed event bodies return the stored bounded outcome, body or identity drift returns conflict, and stale/out-of-sequence callbacks are rejected without current projection mutation.
- Kept provider completion, source observation, receipt validation, repair success, and playback proof as separate fact layers; callback responses expose bounded provider/source/readback fields only.

## Verification

- `pnpm --filter api exec vitest run src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts`
  - 2 files, 18 tests passed
- `pnpm --filter api type-check` passed.
- `git diff --check` passed.
- GitNexus staged detect covered only the callback route and shared schema; affected flows are the expected signed crawler callback paths.

## Status

Complete.
