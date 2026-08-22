---
phase: 26-video-source-and-magnet-availability
plan: 26-01
subsystem: api-domain-testing
tags: [video-availability, contracts, probe-policy, aggregation, tdd]
status: complete

requires:
  - phase: 25
    provides: authoritative availability observation, CAS, and bounded evidence foundations
provides:
  - four independent metadata, direct, magnet, and playback finding contracts
  - immutable video-source-probe/v1 policy with bounded media evidence
  - exhaustive revision-bound action classification and deterministic layer aggregation
affects: [26-02, 26-03, 26-04, 26-05, 26-06, 26-07, 26-08, 26-09, 26-10]

tech-stack:
  added: []
  patterns:
    - closed discriminated reason/action unions
    - determinate status preserved separately from freshness
    - bounded redacted evidence with allowlisted media types

key-files:
  created:
    - apps/api/src/domain/video-availability/types.ts
    - apps/api/src/domain/video-availability/probe-policy.ts
    - apps/api/src/domain/video-availability/aggregate.ts
    - apps/api/src/domain/video-availability/__tests__/contract.test.ts
  modified: []

key-decisions:
  - "Keep metadata, direct, magnet, and playback facts independent; aggregation preserves per-source detail and never replaces determinate status with stale."
  - "Map every abnormal reason explicitly to recheck, repair, or provider configuration with source/movie revision and policy binding."

requirements-completed: [VID-01, VID-02, VID-03, VID-04, VID-05]

metrics:
  tasks: 2
  files: 4
  completed: 2026-08-12
actuals:
  tokens: 3915
  tasks: 2
  commits: 4
---

# Phase 26 Plan 01: Video Availability Contract Summary

Four-layer video findings now use a policy-versioned, bounded contract with deterministic aggregation and exhaustive revision-bound actions.

## Commits

| Commit | Description |
|--------|-------------|
| `79d402e` | Add failing video availability contract tests |
| `7ebf2ec` | Define video availability contracts and probe policy |
| `656c263` | Add failing action aggregation tests |
| `30f9f54` | Classify actions and aggregate layer findings |

## Verification

- `pnpm --filter api exec vitest run src/domain/video-availability/__tests__/contract.test.ts` - 21/21 passed
- `pnpm --filter api type-check` - passed
- `git diff --check` - passed
- GitNexus detect-changes - LOW risk, no affected execution flows

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- All four declared files exist.
- All four task commits exist in git history.
- Focused tests and API type-check passed after implementation.
