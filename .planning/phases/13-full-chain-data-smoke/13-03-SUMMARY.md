---
phase: 13-full-chain-data-smoke
plan: "03"
subsystem: local-data-chain-smoke
tags: [gateway, local-d1, evidence, checkpoint, vitest]

requires:
  - phase: 13-full-chain-data-smoke
    plan: "01"
    provides: deterministic typed evidence lifecycle and browser observation grammar
  - phase: 13-full-chain-data-smoke
    plan: "02"
    provides: bounded one-item fixture and typed D1 snapshot contracts
provides:
  - Gateway-first local smoke CLI, strict Dashboard/viewer append CLI, and deterministic outcome wrapper
  - typed local projection/D1/service/Gateway prerequisite handling with non-secret JSON and Markdown evidence
  - a persisted truthful local pre-ingest checkpoint when local user-managed prerequisites are unavailable
affects: [13-04, smoke:data-chain, local-smoke-evidence]

key-files:
  created:
    - scripts/data-chain-smoke.ts
    - scripts/data-chain-surface-observation.ts
    - scripts/verify-data-chain-smoke.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/local-20260716t034500z/local.json
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/local-20260716t034500z/local.md
  modified:
    - package.json
    - packages/config/src/deployment-target/data-chain-evidence.ts

requirements-completed: []
requirements-pending: [DATA-01, DATA-02, DATA-04, DATA-05, DATA-06, DATA-07, TEST-05]
completed: 2026-07-16
status: checkpoint
---

# Phase 13 Plan 03: Gateway-First Local Data-Chain Smoke Summary

**The local smoke commands and typed evidence contract are implemented and tested. The real local run stopped truthfully before any ingest because canonical local `validate` preflight found missing user-managed secret presence prerequisites.**

## Accomplishments

- Added root `smoke:data-chain`, `smoke:data-chain-observe`, and `smoke:data-chain:verify` commands backed by import-safe strict CLIs.
- Added local runner coverage for local-safe `validate` preflight, D1 readiness, zero-exit `[!!]` service output, Gateway-only `/auth/`, tuple preservation, ordered observation commands, and wrapper `0|2` semantics.
- Extended the Phase 13 evidence allowlist to represent precise local D1 seed/readiness and local prerequisite checkpoints, and to record only fixed Gateway `/auth/` and public API paths.
- Persisted a schema-validated local checkpoint pair at the deterministic fixed evidence path. It contains no secret value, cookie, header, direct application origin, fixture result, or fabricated item id.

## Task Commit

1. **Task 1: Implement and run the Gateway-first local data-chain smoke** - `6aea88c` (`feat(13-03): add Gateway-first local data smoke runner`)

## Local Checkpoint

| Field | Value |
| --- | --- |
| Target | `starye-org` |
| Run ID | `local-20260716t034500z` |
| Item code | `p13-smoke-starye-org-8aa00139` |
| Artifact | `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/local-20260716t034500z/local.json` and `.md` |
| Lifecycle | `pre_ingest` / `checkpoint` |
| Observation | `local_projection` / `target_projection_unmet` |
| Item ID | `null` |
| Runner result | internal exit `2`; the outer pnpm wrapper reports a nonzero lifecycle exit as `1` |

`pnpm target-profile project-local --target starye-org --check` passed. The subsequent canonical local `validate` preflight returned only non-secret `projection-mismatch` issues for missing user-managed secret presence in the local consumer files. This is not a target-managed projection drift, a wrong Wrangler profile, or local `CLOUDFLARE_API_TOKEN` shadowing. The runner therefore wrote the permitted pre-ingest checkpoint before invoking fixture, local D1 snapshot, Gateway API, Dashboard, viewer, or any remote/provider command.

## Verification

- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-smoke-local.test.ts src/deployment-target/__tests__/data-chain-evidence.test.ts` - passed, 19 tests.
- `pnpm --filter @starye/config type-check` - passed.
- `pnpm --filter @starye/config test --run` - passed, 19 files / 116 tests.
- `pnpm --filter @starye/crawler test --run` - passed, 15 files / 81 tests.
- `pnpm --filter api test --run` - passed, 49 files / 332 tests.
- `pnpm --filter @starye/movie-app test --run` - 16 files / 163 tests passed; two pre-existing suites could not load because `__STARYE_MOVIE_PUBLIC_RUNTIME__` was absent and their local dependencies on ports `8090` and `19999` were unavailable. No movie-app file was changed for this plan.
- `pnpm lint-staged`, focused ESLint, `git diff --check`, and typed JSON/Markdown checkpoint-pair validation - passed.
- GitNexus `detect_changes` on the staged Task 1 files - LOW risk, no indexed affected execution flow. The new root scripts are not yet represented in the current index; focused tests and staged-file review covered that gap.

## Deviations From Plan

### Auto-fixed Issues

**1. [Rule 1 - CLI boundary] Resolved the fixed evidence directory against the repository root.**
- **Found during:** Task 1 local wrapper invocation.
- **Issue:** pnpm runs filtered `tsx` commands from `packages/crawler`, so the canonical relative evidence directory initially resolved under that package rather than the fixed Phase 13 root.
- **Fix:** Resolve the accepted CLI directory relative to the root script and reject every other output root.
- **Verification:** focused tests, config typecheck, and the persisted fixed-path checkpoint pair passed.
- **Committed in:** `6aea88c`.

**2. [Rule 1 - Evidence contract alignment] Added the exact local readiness checkpoint and Gateway route vocabulary required by the Phase 13 plan.**
- **Found during:** Task 1 contract implementation.
- **Issue:** the Wave 1 allowlist could not serialize `fixture_seed_incomplete`, `local_prerequisite_unmet`, or fixed Gateway auth/API observations demanded by the local runner.
- **Fix:** Extended only the existing typed evidence allowlist and canonical-path validator; direct ports and arbitrary URLs remain rejected.
- **Verification:** evidence and local runner contract tests passed.
- **Committed in:** `6aea88c`.

**Total deviations:** 2 auto-fixed contract/boundary corrections.
**Impact:** No scope expansion to API routes, browser authentication, raw D1 clients, crawler corpus, deployment, or Phase 14 documentation.

## Checkpoint And Next Action

Task 2 was not run. It requires a `resolved_pending_observation` artifact with a non-empty item tuple and passed D1/API rows, while this run is legitimately `pre_ingest` with `itemId: null`.

Before retrying the same local command, the operator must make the required local user-managed secret presence available to the existing local consumer files and rerun the canonical preflight. Do not edit evidence by hand, mint a Dashboard cookie, substitute direct app ports, or attempt remote smoke. Once a new local run reaches `resolved_pending_observation`, the real authorized Dashboard then viewer checkpoint command can append the two ordered observations.

## Self-Check: CHECKPOINT RECORDED

- Task 1 commit exists and contains only the planned smoke implementation, tests, and generated non-secret evidence pair.
- The exact artifact pair validates through the typed parser and has the expected pre-ingest tuple.
- The three user-owned dirty files remain unstaged and unmodified by this plan.
- No fixture, D1 snapshot, Gateway API, Dashboard, viewer, Cloudflare, R2, production D1, deployment, or remote crawler operation was run.

---
*Phase: 13-full-chain-data-smoke*
*Plan: 03*
*Completed: 2026-07-16*
