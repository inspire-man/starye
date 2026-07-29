---
phase: 13-full-chain-data-smoke
plan: "36"
subsystem: local-runtime
status: complete
gap_closure: true
requirements-completed: []
completed: 2026-07-23
---

# Phase 13 Plan 36: Local-Dev Pages Profile Wiring

Committed the one-line fix that passes `profile: resolution.profile` into `materializeTargetDeployConfig` from `materializeLocalInputs`, unblocking `pnpm dev` Pages materialization after the post-p13-17 gap replan.

## GitNexus Impact

| Symbol | Direction | Risk | Notes |
| --- | --- | --- | --- |
| `materializeLocalInputs` | upstream | **LOW** | impactedCount 0; no affected processes/modules |
| `materializeTargetDeployConfig` | not edited | HIGH if changed | Intentionally untouched |

## Change

- File: `scripts/local-dev.ts`
- Commit: `73dda49`
- Diff: add `profile: resolution.profile` adjacent to `deploy` in the Pages materialization call.

## Verification

- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/local-dev.test.ts` — **6/6 passed**

## Scope Boundary

- No smoke run allocation, remote handoff, evidence mutation, or VERIFICATION rewrite.
- Does not authorize 13-37 remote work; only enables a fresh local lifecycle start.

## Self-Check: PASSED
