---
phase: 13-full-chain-data-smoke
plan: "04"
subsystem: deployment-target
tags: [remote-smoke, checkpoint-evidence, target-preflight, canonical-gateway, vitest]

requires:
  - phase: 13-full-chain-data-smoke
    plan: "03"
    provides: exact local target/run evidence and Gateway-first local smoke boundary
  - phase: 13-full-chain-data-smoke
    plan: "02"
    provides: closed prepared fixture and D1 snapshot entries
provides:
  - exact local-run-gated remote smoke orchestration with fail-closed pre-ingest checkpoints
  - selected-canonical API tuple correlation path after authorized prepared operations
  - persisted remote checkpoint for the current unavailable local prerequisite
affects: [13-verify-work, phase-14, remote-smoke-evidence]

tech-stack:
  added: []
  patterns: [exact evidence-pair lookup, local-prerequisite-before-provider, canonical-path-only remote API, tuple-preserving pending evidence]

key-files:
  created:
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts
  modified:
    - scripts/data-chain-smoke.ts
    - packages/config/src/deployment-target/data-chain-evidence.ts
    - packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts

key-decisions:
  - "Remote pre-ingest evidence may contain local_projection only for the single local_prerequisite_unmet checkpoint shape; every other local row remains invalid in remote evidence."
  - "The current remote attempt is stopped by the requested local run before credential, ownership, fixture, D1, API, Dashboard, or viewer work."
  - "A remote provider/browser attempt remains unavailable until a new exact local run reaches terminal resolved/passed with a non-empty tuple."

patterns-established:
  - "Remote smoke reads exactly evidence/<target>/<run>/local.json and local.md; it cannot select a latest, target-only, or old run."
  - "Remote success-path API reads derive the selected profile Gateway base and fixed /api/public/movies/<code> path internally."

requirements-completed: [TEST-05]
requirements-pending: [DATA-04, DATA-05, DATA-06, DATA-07]

coverage:
  - id: D1
    description: Remote runner rejects missing, pending, incomplete, and stale local evidence before provider preflight or prepared children.
    requirement: TEST-05
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts
        status: pass
      - kind: integration
        ref: pnpm smoke:data-chain:verify -- --mode remote --target starye-org --run-id local-20260716t041000z --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence
        status: pass
    human_judgment: false
  - id: D2
    description: Selected-target D1, canonical API, Dashboard, and viewer proof for one remote tuple.
    requirement: DATA-04
    verification: []
    human_judgment: true
    rationale: Current local evidence has no terminal passed tuple, and provider credentials plus an authorized selected-target Dashboard session are unavailable.

duration: 27min
completed: 2026-07-15
status: checkpoint
---

# Phase 13 Plan 04: Remote Smoke Checkpoint Summary

**Remote smoke now fails closed on one explicit terminal local evidence pair, and the current exact run truthfully persists a pre-ingest checkpoint before any provider or data mutation path.**

## Performance

- **Duration:** 27 min
- **Completed:** 2026-07-15T20:29:10Z
- **Tasks:** 1 automated task completed; 1 external checkpoint retained
- **Files modified:** 4 tracked implementation/test files; 2 untracked non-secret checkpoint evidence files

## Accomplishments

- Added remote `--mode remote --target --run-id` execution to the strict smoke runner. It reads only the requested `<target>/<run>/local.json|.md` pair, validates the typed JSON/Markdown pair and the full terminal local surface set, and blocks all fallback selection.
- Added fail-closed remote preflight, credential-presence, account/ownership, prepared-fixture/snapshot, selected-canonical API, and tuple-preservation behavior behind injected test seams. Neither an API mismatch nor unavailable canonical API can manufacture Dashboard/viewer proof.
- Generated and verified the current exact remote checkpoint at `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/local-20260716t041000z/remote.json` and `.md`: `pre_ingest`, `local_projection`, `local_prerequisite_unmet`, `itemId: null`, internal runner exit `2`.

## Task Commits

1. **Task 1: Add explicit remote smoke preflight, ownership gates, and checkpoint evidence** - `a71d676` (`feat(13-04): add fail-closed remote smoke checkpoint`)
2. **Task 2: Complete selected-target Dashboard and canonical viewer proof after automated gates pass** - not executed; exact local run is pre-ingest and has no item tuple.

## Verification

- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-smoke-remote.test.ts src/deployment-target/__tests__/mutation-entry.test.ts` - passed, 16 tests.
- `pnpm --filter @starye/config exec tsc --noEmit` - passed.
- `pnpm --filter @starye/config test --run` - passed, 20 files / 125 tests.
- `pnpm --filter @starye/crawler test --run` - passed, 15 files / 81 tests.
- `pnpm smoke:data-chain:verify -- --mode remote --target starye-org --run-id local-20260716t041000z --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence` - validated and persisted the expected internal checkpoint exit `2`; pnpm reports the non-success lifecycle as outer exit `1`.
- `git diff --check` - passed.
- GitNexus `detect_changes` on the staged Task 1 files - LOW risk, 0 indexed changed symbols / affected execution flows. The new root runner remains absent from the current index; focused contract tests cover that index gap.

## Decisions Made

- Allow precisely one remote local-prerequisite evidence shape: `pre_ingest` with a `local_projection/local_prerequisite_unmet` checkpoint. Remote evidence still rejects every other local prerequisite row and all local origins.
- Derive the remote public API request from the selected target's canonical Gateway URL and fixed target-relative path; no CLI host, origin, direct port, or endpoint option exists.
- Preserve a remote snapshot tuple in `resolved_pending_observation` after canonical API mismatch/unavailability; only the existing typed Dashboard-then-viewer observer can promote it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Evidence contract alignment] Narrowed remote evidence validation for the required local prerequisite checkpoint.**
- **Found during:** Task 1 RED test and complete config suite.
- **Issue:** The existing typed validator rejected the plan-required remote `local_projection/local_prerequisite_unmet` pre-ingest record.
- **Fix:** Allowed only that exact remote pre-ingest checkpoint form; added regression coverage while retaining rejection for all other remote local-prerequisite rows and local origins.
- **Files modified:** `packages/config/src/deployment-target/data-chain-evidence.ts`, `packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts`.
- **Verification:** remote contract tests, config 125/125, and exact checkpoint wrapper validation passed.
- **Committed in:** `a71d676`.

---

**Total deviations:** 1 auto-fixed (1 evidence contract alignment).
**Impact on plan:** Required to serialize the plan's fail-closed checkpoint without weakening remote canonical-origin or no-success rules.

## Issues Encountered

- The current exact local pair remains `pre_ingest/local_projection/target_projection_unmet` because user-managed secret presence is unavailable. It has no item tuple, so remote preflight, ownership checks, fixture, D1 snapshot, provider API, Dashboard, viewer, and browser session work were not attempted.
- The GSD commit wrapper returns `commit_failed` after roughly 10 seconds while `lint-staged` completes shortly afterwards. Git confirmed the Task 1 commit and its one import-order lint change; the final commit hash is `a71d676`.

## User Setup Required

The operator must first make the required user-managed secret keys present in the existing local consumer files, without placing values in Git or evidence, then run a new local smoke to terminal `resolved`/`passed` with the same non-empty tuple across local projection, D1 readiness, service readiness, Gateway auth, D1, API, Dashboard, and viewer.

Only then can an authorized selected-target environment provide `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CRAWLER_SECRET` plus read-only resource ownership access. After the remote runner produces a matching `resolved_pending_observation` with a passed API row, Task 2 requires a real selected-canonical Dashboard session followed by the canonical viewer observation in that order.

## Next Phase Readiness

- The remote runner and its redacted checkpoint path are ready for a future exact terminal local tuple.
- The current blocker is explicit: the requested local run lacks required user-managed secret presence and therefore cannot create an item code/id tuple. No production proof exists.
- Task 2 remains an external provider/session checkpoint and must not be simulated, retried into success, or replaced with local/direct-port/API-only evidence.

## Self-Check: PASSED

- Task 1 commit exists and contains only the planned runner/evidence/test implementation.
- The current remote checkpoint JSON/Markdown pair is schema-validated by the shared wrapper and contains no secret, token, header, cookie, raw endpoint, prepared context, or direct service port.
- The user-owned `.planning/config.json`, `AGENTS.md`, and `CLAUDE.md` changes remain unstaged and untouched. Generated remote evidence remains untracked by design.

---
*Phase: 13-full-chain-data-smoke*
*Plan: 04*
*Completed: 2026-07-15*
