---
phase: 13-full-chain-data-smoke
plan: "05"
subsystem: crawler-evidence
tags: [data-chain, crawler, vitest, target-profile]

requires:
  - phase: 13-04
    provides: selected-target smoke orchestration and checkpoint lifecycle
provides:
  - One target/run-derived primary fixture code and one-row D1 evidence count
  - One bounded non-R18 crawler fixture with one service-auth upsert
  - Wave 4 through Wave 7 validation coverage for count-one, provenance, and controlled checkpoints
affects: [13-06, 13-07, 13-08, data-chain-smoke]

tech-stack:
  added: []
  patterns:
    - One-item target/run correlation contract
    - Fake ApiClient fixture-first transport testing

key-files:
  created:
    - .planning/phases/13-full-chain-data-smoke/13-05-SUMMARY.md
  modified:
    - .planning/phases/13-full-chain-data-smoke/13-VALIDATION.md
    - packages/config/src/deployment-target/data-chain-evidence.ts
    - packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts
    - packages/crawler/src/smoke/data-chain-fixture.ts
    - packages/crawler/src/smoke/__tests__/data-chain-fixture.test.ts
    - packages/config/src/deployment-target/__tests__/mutation-entry.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts

key-decisions:
  - "Phase 13 accepts exactly one target/run-derived primary code and one successful D1 row; no sibling or batch compatibility remains."
  - "The shared ApiClient.syncMovie transport remains unchanged because it has a HIGH blast radius outside the bounded fixture path."
  - "Wave 7 code-2 checkpoints remain non-success terminal evidence and cannot be promoted without receipt-backed execution."

patterns-established:
  - "Bounded fixture: validate one non-R18 movie and one player before the sole syncMovie call."
  - "Evidence correlation: validate every itemCode against the explicit target/run-derived primary code."

requirements-completed: [DATA-03, DATA-04, DATA-07, TEST-05]

coverage:
  - id: D1
    description: "One-item target/run evidence identity and D1 cardinality validation"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-evidence.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "One deterministic non-R18 fixture and one service-auth upsert"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "pnpm --filter @starye/crawler exec vitest run src/smoke/__tests__/data-chain-fixture.test.ts src/utils/__tests__/api-client.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Wave 4 through Wave 7 validation map for provenance and truthful checkpoints"
    requirement: "TEST-05"
    verification:
      - kind: other
        ref: ".planning/phases/13-full-chain-data-smoke/13-VALIDATION.md"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-07-18
status: complete
---

# Phase 13 Plan 05: One-Item Evidence and Fixture Contract Summary

**恢复以 target/run 为唯一来源的单条 non-R18 fixture、单次 service-auth upsert 与单行 D1 证据契约。**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-18T02:33:20Z
- **Completed:** 2026-07-18T02:55:12Z
- **Tasks:** 2/2
- **Files modified:** 8

## Accomplishments

- `DATA_CHAIN_FIXTURE_COUNT`、fixture code 派生和 evidence validator 均只接受一个 primary item。
- 删除 batch fixture 导出与迭代写入，单个经过形状校验的 fixture 只调用一次 `ApiClient.syncMovie()`。
- 将验证地图补全至 13-05 至 13-08，明确 Wave 4 至 7 的 focused commands、provenance 收据和 code-2 checkpoint 规则。

## Task Commits

1. **Task 1: Restore the one-code evidence and correlation contract** - `477a3e1` (feat)
2. **Task 2: Make the crawler fixture perform one bounded service-auth upsert** - `d15588e` (feat)

## Files Created/Modified

- `.planning/phases/13-full-chain-data-smoke/13-VALIDATION.md` - count-one Wave 4-7 verification map and controlled checkpoint rules.
- `packages/config/src/deployment-target/data-chain-evidence.ts` - primary code and successful D1 row validation.
- `packages/crawler/src/smoke/data-chain-fixture.ts` - single-fixture service-auth write adapter.
- `packages/config/src/deployment-target/__tests__/` - count-one evidence, prepared result, and runner fake observations.
- `packages/crawler/src/smoke/__tests__/data-chain-fixture.test.ts` - bounded fixture and pre-transport rejection coverage.

## Decisions Made

- The stale ten-item Context decision is superseded by the canonical 13-02 must-have and verified gap directive: one item is the only accepted contract.
- `ApiClient.syncMovie()` remains untouched because its HIGH blast radius includes the general optimized crawler; the bounded adapter supplies its one payload through the existing transport.
- A code-2 external checkpoint is valid evidence of an unavailable prerequisite, never local or remote success.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Regression] Propagated count-one fake observations into config runner tests**
- **Found during:** Task 2 plan-level config regression run
- **Issue:** Existing fake prepared/local/remote observations still emitted `itemCount: 10`, causing the new shared evidence validator to reject otherwise valid test tuples.
- **Fix:** Updated only the affected test fixture baselines to count one; did not modify mutation, runner, target, or preflight production behavior reserved for 13-06.
- **Files modified:** `packages/config/src/deployment-target/__tests__/mutation-entry.test.ts`, `packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts`, `packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts`
- **Verification:** `pnpm --filter @starye/config test --run` (21 files, 140 tests passed)
- **Committed in:** `d15588e`

---

**Total deviations:** 1 auto-fixed (Rule 1 regression).
**Impact on plan:** The regression fix aligns existing fake observations with the restored shared type without expanding into the later 13-06 production runner work.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for this contract-only plan.

## Next Phase Readiness

- 13-06 can now enforce the same count-one tuple through prepared D1 snapshots and local/remote runners.
- No local or remote smoke was executed; 13-08 remains the authorized external-boundary checkpoint.

## Self-Check: PASSED

- Summary file exists and both task commits (`477a3e1`, `d15588e`) are present in git history.
