---
phase: 23-github-actions-production-repair-and-reconciliation
plan: 03
subsystem: crawler-control-plane
tags: [retry, reconciliation, lease, receipt, source-cas]
requires:
  - phase: 23-01
    provides: server-owned provider contract and bounded GitHub Actions readback
  - phase: 23-02
    provides: signed runner lifecycle, repair adapter binding, and provider callbacks
provides:
  - bounded task-level automatic retry with fresh run, attempt, lease, and provider association
  - immediate versus reconciliation-window retry classification and provider observation separation
  - current-attempt and source-revision CAS protection for repair source projection
affects: [23-04, 23-05, production-repair]
requirements-completed: [REP-02, REP-03]
---

# Phase 23 Plan 03 Summary

## Accomplishments

- Added bounded automatic retry projection and lifecycle: eligible failure creates at most one new queued run with a fresh application attempt, lease, provider association, and immutable historical predecessor.
- Added immediate transport retry and windowed provider-lost/lease-expiry recovery while keeping provider success as an observation pending receipt validation.
- Added task-level retry read models for list/detail projections and guarded duplicate retry creation with latest-run and attempt CAS.
- Guarded repair source projection writes by expected source revision, run state/sequence, and `crawler_task.latest_run_id`; late observations from older attempts remain stale history and cannot overwrite the current projection.
- Kept authoritative receipt/readback and reconciliation suites passing without exposing raw provider or source material.

## Verification

- `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/state-machine.test.ts src/domain/crawler-tasks/__tests__/repository.test.ts src/domain/crawler-tasks/__tests__/production-orchestration.integration.test.ts src/domain/crawler-tasks/__tests__/reconciliation.test.ts src/domain/crawler-tasks/__tests__/receipt-validation.test.ts src/domain/movies/__tests__/source-reconciliation.integration.test.ts`
  - 6 files, 43 tests passed
- `pnpm --filter api type-check` passed.
- `git diff --check` passed.
- GitNexus staged detect completed; staged scope is limited to the four plan files and expected retry/source execution flows.

## Known Boundary

- The repair adapter still requires explicit source discovery injection; this plan does not claim live production repair or playback proof. Phase 24 remains the fresh production tuple and Viewer/playback evidence boundary.

## Status

Complete.
