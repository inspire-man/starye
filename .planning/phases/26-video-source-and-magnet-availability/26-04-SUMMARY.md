---
phase: 26-video-source-and-magnet-availability
plan: 26-04
subsystem: crawler-direct-video-probe
tags: [direct-video, ssrf, range, browser-probe, bounded-evidence]
status: complete

requires:
  - phase: 26-02
    provides: signed video snapshots and runner observation boundary
provides:
  - per-hop validated and byte-bounded direct media probing
  - controlled browser escalation for challenge and inconclusive evidence
  - redacted multi-source direct availability observations
affects: [26-05, 26-09]

tech-stack:
  added: []
  patterns:
    - manual redirects with per-hop DNS and address validation
    - Range request plus 64 KiB response budget
    - browser evidence upgrades only after successful media load

key-files:
  created:
    - packages/crawler/src/video-availability/direct-probe.ts
    - packages/crawler/src/video-availability/browser-probe.ts
    - packages/crawler/src/task-runner/video-availability-adapter.ts
  modified:
    - packages/crawler/src/video-availability/__tests__/direct-probe.test.ts
    - packages/crawler/src/task-runner/__tests__/video-availability-adapter.test.ts

key-decisions:
  - "Treat DNS, timeout, invalid partial responses, and unresolved browser evidence conservatively without promoting availability."
  - "Keep direct-source summaries limited to counts and reason codes; URLs, headers, bodies, and signed query material are never returned."

requirements-completed: [VID-02, VID-04]

metrics:
  tasks: 2
  files: 5
  completed: 2026-08-13
actuals:
  tasks: 2
  commits: 2
---

# Phase 26 Plan 04: Direct Video Probe Summary

Direct sources now use a staged, SSRF-resistant probe with bounded redirects, Range reads, explicit media evidence, controlled browser escalation, and revision-bound redacted runner observations.

## Commits

| Commit | Description |
|--------|-------------|
| `e8d1367` | Add failing direct probe and adapter tests |
| `8168096` | Implement bounded direct video probing and expanded acceptance regressions |

## Verification

- focused direct probe and adapter tests - 10/10 passed
- `pnpm --filter @starye/crawler type-check` - passed
- target-file ESLint - passed
- `git diff --check` - passed
- GitNexus detect-changes - LOW with no indexed affected flows; newly created probe symbols were not yet present in the index

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved exact runner snapshot reason types in test fixtures**
- **Found during:** Task 2 type-check
- **Issue:** Negative fixture object spread widened `reason` to `string`.
- **Fix:** Bound the fixture to `VideoRunnerSnapshot` and retained the literal negative reason.
- **Files modified:** `packages/crawler/src/task-runner/__tests__/video-availability-adapter.test.ts`
- **Commit:** `8168096`

**2. [Rule 2 - Missing Critical] Added executable evidence for declared probe boundaries**
- **Found during:** Plan closeout review
- **Issue:** Initial RED tests did not exercise public cross-origin header stripping, 64 KiB ignored-Range capping, invalid 206, 416, browser success, or empty/mixed aggregation.
- **Fix:** Added focused regressions for each declared D-05 through D-08 and D-16 boundary.
- **Files modified:** direct probe and adapter tests
- **Commit:** `8168096`

## Known Stubs

Real local and production runner construction remains intentionally owned by Plan 26-09.

## Self-Check: PASSED

- All five declared implementation/test files exist.
- Both commits exist in git history.
- Focused tests, crawler type-check, ESLint, and whitespace validation passed.
