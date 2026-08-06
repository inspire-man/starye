---
phase: 21-source-health-and-local-repair-players-vertical-slice
plan: 05
subsystem: local-runner
tags: [repair-players, local-runner, signed-envelope, source-observation, receipt-readback]
requires:
  - phase: 21-04
    provides: signed source-observation callback and repair task lifecycle boundary
provides:
  - operation-first local adapter registry with dedicated repair_players adapter
  - signed runner observation and repair receipt envelope with bounded terminal payload
  - repair terminal readback validation and task-detail receipt projection
affects: [21-06-dashboard-movie-detail, 21-07-local-gateway-proof]
tech-stack:
  added: []
  patterns: [operation-discriminated adapter selection, bounded receipt gate, authoritative revision readback]
key-files:
  created:
    - packages/crawler/src/task-runner/repair-adapter.ts
    - .planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-05-SUMMARY.md
  modified:
    - packages/crawler/src/task-runner/runner-client.ts
    - packages/crawler/src/task-runner/template-adapters.ts
    - packages/crawler/src/task-runner/local-runner.ts
    - scripts/local-task-runner.ts
    - apps/api/src/domain/crawler-tasks/repository.ts
    - apps/api/src/domain/crawler-tasks/types.ts
    - apps/api/src/schemas/crawler-run-events.ts
    - apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts
key-decisions:
  - "repair_players is selected by operation before template fallback; ordinary movie/manga adapters retain their existing selection and missing operation fails closed."
  - "The adapter sends source candidates only to the signed controlled observation endpoint and returns a sanitized receipt only after readback identity and summary equality."
  - "Repair terminal validation compares the receipt revision with the immutable snapshot and the current persisted revision; current state may already be ready after a successful observation."
  - "Task-detail read models parse repair receipts as a bounded receipt union instead of silently dropping them as ordinary receipts."
requirements-completed: [SRC-02, REP-01]
coverage:
  - id: D1
    description: "Local runner selects a dedicated repair_players adapter and never lets a repair snapshot fall through to the movie adapter."
    requirement: REP-01
    verification:
      - kind: unit
        ref: "packages/crawler/src/task-runner/__tests__/template-adapters.test.ts"
        status: pass
      - kind: unit
        ref: "packages/crawler/src/task-runner/__tests__/local-runner.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Signed repair observation and terminal envelopes carry bounded operation identity, and success is gated by authoritative readback."
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "packages/crawler/src/task-runner/__tests__/runner-client.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts"
        status: pass
    human_judgment: false
verification:
  - "pnpm --filter @starye/crawler exec vitest run src/task-runner/__tests__/local-runner.test.ts src/task-runner/__tests__/template-adapters.test.ts src/task-runner/__tests__/runner-client.test.ts (3 files, 11 tests passed)"
  - "pnpm --filter api exec vitest run src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts src/domain/crawler-tasks/__tests__/repository.test.ts src/domain/crawler-tasks/__tests__/receipt-validation.test.ts (3 files, 43 tests passed)"
  - "pnpm --filter @starye/crawler type-check and pnpm --filter api type-check passed"
  - "Target-file ESLint and git diff --check passed"
status: complete
completed: 2026-08-06
---

# Phase 21 Plan 05: Local repair_players Adapter And Signed Runner Envelope Summary

**Operation-aware local repair execution with authoritative observation/readback gating.**

## Accomplishments

- Added a dedicated `repair_players` adapter and operation-first registry. Ordinary movie/manga templates remain separate, while missing or mismatched repair operation data fails closed.
- Extended `RunnerClient` with validated repair snapshots, signed source-observation requests, sanitized repair receipts, and bounded failure codes. The local runner now requires a repair receipt before terminal success and preserves source read/write failures for lifecycle retry classification.
- Added local script registration for the repair adapter and expanded the API poll/lifecycle schemas to accept the repair snapshot and receipt unions.
- Fixed repair terminal lifecycle validation to compare against the current source revision after observation, and exposed the persisted repair receipt through task-detail read models without raw source or signature fields.

## Scope Boundary

This plan proves the local runner/API execution seam only. Dashboard confirmation, source-health presentation, MovieDetail handoff, and canonical Gateway evidence remain in 21-06 and 21-07. No provider, production, or playback proof is claimed.

## Self-Check: PASSED

- Repair operation selection, missing receipt, cancellation, readback mismatch and raw-field exclusion have focused regression coverage.
- API terminal route and repository tests prove repair receipt parsing, current revision binding and task-detail projection.
- Callback secrets and raw source material remain outside terminal receipts and public read models.
