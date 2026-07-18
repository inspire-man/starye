---
phase: 13-full-chain-data-smoke
plan: "06"
subsystem: data-chain-smoke
tags: [d1, smoke-runner, target-profile, vitest, fail-closed]

requires:
  - phase: 13-05
    provides: one target/run-derived primary code with count-one fixture observations
provides:
  - Prepared child output validation bound to the exact target/run primary code and count one
  - Read-only D1 snapshots that accept exactly one non-R18 movie with one active player
  - Local and remote runner checkpoints for count, code, and id mismatches before API evidence
affects: [13-07, 13-08, data-chain-smoke, selected-target]

tech-stack:
  added: []
  patterns:
    - One-item prepared observation validation
    - Fixed single-code D1 snapshot queries with fail-closed cardinality parsing
    - Checkpoint-first runner handling for invalid injected tuples

key-files:
  created:
    - .planning/phases/13-full-chain-data-smoke/13-06-SUMMARY.md
  modified:
    - packages/config/src/deployment-target/mutation-entry.ts
    - packages/config/src/deployment-target/__tests__/mutation-entry.test.ts
    - packages/db/scripts/target-d1-mutation.ts
    - packages/db/scripts/__tests__/target-d1-mutation.test.ts
    - scripts/data-chain-smoke.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts

key-decisions:
  - "Prepared smoke children must return the prepared target/run primary code literally; a sibling code is never a compatible observation."
  - "D1 snapshots use one bound primary-code query and reject any non-single-row, R18, inactive-player, or malformed provider result."
  - "Remote snapshot id validity is checked before canonical API evidence so invalid tuples become checkpoint artifacts rather than schema exceptions."

patterns-established:
  - "Use a dedicated strict snapshot parser instead of changing shared local D1 readiness parsing."
  - "Treat injected dependency results as untrusted at every local and remote runner boundary."

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, TEST-05]

coverage:
  - id: D1
    description: Prepared fixture and read-only D1 boundaries accept only one matching primary-code observation.
    requirement: DATA-04
    verification:
      - kind: unit
        ref: pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/mutation-entry.test.ts
        status: pass
      - kind: unit
        ref: pnpm --filter @starye/db exec vitest run scripts/__tests__/target-d1-mutation.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Local and remote runners checkpoint count, code, and id mismatches before API evidence.
    requirement: TEST-05
    verification:
      - kind: unit
        ref: pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-smoke-local.test.ts src/deployment-target/__tests__/data-chain-smoke-remote.test.ts
        status: pass
      - kind: unit
        ref: pnpm --filter @starye/config test --run
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-07-18
status: complete
---

# Phase 13 Plan 06: One-Item Snapshot and Runner Gate Summary

**Prepared fixture, read-only D1 snapshot, and local/remote runners now require one matching target/run code, one id, and count-one evidence before API observation.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-07-18T03:00:00Z
- **Completed:** 2026-07-18T03:27:10Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Bound prepared crawler and D1 child observations to the prepared primary code, count one, and allowlisted fields.
- Replaced the D1 batch/pattern query with a fixed one-code, one-row read-only snapshot contract.
- Preserved local-first and remote preflight-first ordering while turning count/code/id mismatches into checkpoint evidence before canonical API observation.

## Task Commits

1. **Task 1: Constrain prepared registry results and the selected D1 snapshot to one row** - `b857d69` (feat)
2. **Task 2: Require count-one results in both local and remote smoke orchestration** - `812474f` (feat)

## Files Created/Modified

- `packages/config/src/deployment-target/mutation-entry.ts` - validates exact primary-code prepared child observations.
- `packages/db/scripts/target-d1-mutation.ts` - executes and parses the single-code, one-row D1 snapshot.
- `scripts/data-chain-smoke.ts` - keeps local/remote runners fail-closed for invalid tuples and preserves Gateway/canonical flow order.
- `packages/config/src/deployment-target/__tests__/` and `packages/db/scripts/__tests__/` - cover one-item happy paths and malformed, batch, sibling, R18, player, count, code, and id failures.

## Decisions Made

- Reused the 13-05 target/run-derived primary code as the only acceptable child result identity.
- Added a snapshot-specific strict parser rather than changing `d1Rows`, whose HIGH blast radius includes local D1 readiness behavior.
- Retained code-2 checkpoint lifecycle for every invalid tuple; no mismatch can create an item id or advance browser evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Replaced the local crawler-secret line parser's backtracking-prone regular expression**
- **Found during:** Task 2 pre-commit hook
- **Issue:** ESLint rejected the existing regular expression for potential super-linear backtracking, blocking the required normal commit.
- **Fix:** Used an equivalent line matcher and retained the existing `trim()` normalization for the captured value.
- **Files modified:** `scripts/data-chain-smoke.ts`
- **Verification:** `pnpm exec eslint scripts/data-chain-smoke.ts`; focused runner tests; Config typecheck
- **Committed in:** `812474f`

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking issue).
**Impact on plan:** The change was limited to the committed script and removed a hook blocker without changing secret sources, target identity, or provider execution.

## Issues Encountered

- The first Task 2 commit attempt was rejected by the repository's ESLint hook. The focused Rule 3 correction passed lint and the normal hook on retry.

## User Setup Required

None - no external service configuration or credentialed execution was performed.

## Next Phase Readiness

- 13-07 can add receipt-backed runner/provider/browser provenance on top of the now fail-closed one-item tuple.
- 13-08 remains the only authorized plan for local or selected-target credentialed smoke execution; it must retain truthful checkpoints when prerequisites are unavailable.

## Self-Check: PASSED

- Summary file exists and both task commits (`b857d69`, `812474f`) are present in git history.

---
*Phase: 13-full-chain-data-smoke*
*Completed: 2026-07-18*
