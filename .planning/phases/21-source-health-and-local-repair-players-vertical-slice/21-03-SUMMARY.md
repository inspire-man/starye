---
phase: 21-source-health-and-local-repair-players-vertical-slice
plan: 03
subsystem: api
tags: [crawler-tasks, repair-players, receipt-validation, state-machine, gitnexus]
requires:
  - phase: 21-02
    provides: authoritative source observation persistence and readback for one movie revision
provides:
  - operation-aware repair_players task snapshot creation and fail-closed parsing
  - authoritative repair receipt validation with bounded public source summary
  - repair lifecycle guards for revision conflict, bounded automatic retry, and manual new-task retry
affects: [phase-21-04, phase-21-05, phase-21-06, crawler-runs, local-runner]
tech-stack:
  added: []
  patterns: [server-owned operation snapshot, authoritative repair readback validation, bounded repair retry policy]
key-files:
  created: []
  modified:
    - apps/api/src/domain/crawler-tasks/template-registry.ts
    - apps/api/src/domain/crawler-tasks/receipt-validation.ts
    - apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts
    - apps/api/src/domain/crawler-tasks/repository.ts
    - apps/api/src/domain/crawler-tasks/state-machine.ts
    - apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/state-machine.test.ts
key-decisions:
  - "repair_players snapshot 继续复用 movie templateKey，但 operation、movieId、reason、sourceRevision 和 targetIntent 全部固定在 server-owned immutable snapshot 中。"
  - "repair success 只接受与 authoritative readback 完全一致的 movieId/sourceRevision/observedAt/sourceSummary；普通 movie receipt 在 repair snapshot 上 fail closed。"
  - "automatic retry 仅对 repair_players 的 transient source_read/source_write failure 追加一次同 task attempt；manual retry 永远创建新 task 并重读当前 disposition/revision。"
patterns-established:
  - "Pattern 1: 先用 task.operation + request_snapshot_json 做 fail-closed 解析，再把 normalized snapshot 传给 repository/state-machine。"
  - "Pattern 2: repair receipt 不从 runner 原始 payload 直接出站，永远从 persisted readback 重新投影。"
requirements-completed: [SRC-02, REP-01]
coverage:
  - id: D1
    description: operation-aware repair snapshot registry and authoritative repair receipt validation
    requirement: SRC-02
    verification:
      - kind: unit
        ref: src/domain/crawler-tasks/__tests__/receipt-validation.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: repair task lifecycle guards for CAS, stale conflict, bounded auto retry, and manual new-task retry
    requirement: REP-01
    verification:
      - kind: integration
        ref: src/domain/crawler-tasks/__tests__/repository.test.ts
        status: pass
      - kind: unit
        ref: src/domain/crawler-tasks/__tests__/state-machine.test.ts
        status: pass
    human_judgment: false
duration: 32m
completed: 2026-08-06
status: complete
---

# Phase 21 Plan 03: Operation-Aware repair_players Lifecycle Summary

**repair_players 任务现在拥有 server-owned snapshot、authoritative repair receipt、revision-aware conflict guard，以及一次性自动重试/新 task 人工重试的受控生命周期。**

## Performance

- **Duration:** 32 min
- **Started:** 2026-08-06T07:34:38Z
- **Completed:** 2026-08-06T08:06:46Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `template-registry.ts` 现在能同时创建 ordinary `movie/manga` snapshot 和 `repair_players` immutable snapshot，并在读取 `request_snapshot_json` 时对缺失/错配 operation 做 fail-closed 解析。
- `receipt-validation.ts` 增加了 repair receipt discriminator，只有同一 `movieId/sourceRevision/observedAt` 的 authoritative readback 才能产出 repair receipt；对外只暴露 bounded `sourceSummary`，不会泄漏 raw source/request/runner/signature 字段。
- `repository.ts` 和 `state-machine.ts` 把 repair task 绑定到单 movie/current revision，加入 stale revision rejection、一次性 automatic retry、manual retry 新 task 重读 disposition，以及 ordinary receipt 在 repair snapshot 上的 fail-closed 保护。

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: 建立 repair snapshot / receipt regression** - `676a8e3` (`test`)
2. **Task 1 GREEN: 实现 operation-aware registry 与 repair receipt validation** - `bd0ae09` (`feat`)
3. **Task 2 RED: 建立 repair lifecycle/CAS/retry regression** - `91d32b5` (`test`)
4. **Task 2 GREEN: 实现 repair lifecycle guards** - `3cc5834` (`feat`)
5. **Rule 3 follow-up: 收口 compile-only type gaps** - `942e89f` (`fix`)

## Files Created/Modified

- `apps/api/src/domain/crawler-tasks/template-registry.ts` - repair snapshot builder、operation parser 和 fail-closed snapshot reader。
- `apps/api/src/domain/crawler-tasks/receipt-validation.ts` - authoritative repair receipt validator、repair candidate narrowing 和 redacted projection。
- `apps/api/src/domain/crawler-tasks/repository.ts` - repair task creation、snapshot binding、revision conflict rejection、auto/manual retry orchestration。
- `apps/api/src/domain/crawler-tasks/state-machine.ts` - repair receipt acceptance branch和 ordinary/repair receipt shape split。
- `apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts` - repair snapshot / authoritative readback / masquerading / redaction regressions。
- `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts` - repair task creation、stale revision、automatic retry cap、manual new-task retry regressions。
- `apps/api/src/domain/crawler-tasks/__tests__/state-machine.test.ts` - repair receipt transition acceptance regression。

## Decisions Made

- 保持 `templateKey: 'movie'` 的兼容读模型边界，但把 `operation` 作为 repository/state-machine 的独立 discriminator；ordinary snapshot 缺失 operation 时仍按 templateKey 归一化，repair snapshot 缺失 operation 直接 fail closed。
- repair success 的 canonical payload 使用 `RepairPlayersReceipt`，并把 `receipt_primary_content_id` 固定为 `movieId`、`receipt_source_revision` 固定为 authoritative `sourceRevision`，让 persisted receipt 与 current movie revision 对齐。
- `processRunnerEvent` 对 repair success 先做 snapshot/movie/revision guard，再做 authoritative receipt validation；stale revision 作为 `repair_source_revision_conflict` 受控拒绝，不把当前 run 强行写成 success。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Type Fix] 收口 repair receipt/type narrowing 的 compile-only gap**
- **Found during:** Task 2 closeout verification
- **Issue:** `api type-check` 暴露 `receipt-validation.ts`、`repository.ts` 和 `state-machine.ts` 的 repair candidate narrowing / transition receipt typing 不够严格，导致 build 前阻塞。
- **Fix:** 改为显式结构 narrowing、`unknown` 过桥 cast 和 repair receipt 专用 union，确保 authoritative readback 与 transition storage 的类型一致。
- **Files modified:** `apps/api/src/domain/crawler-tasks/receipt-validation.ts`, `apps/api/src/domain/crawler-tasks/repository.ts`, `apps/api/src/domain/crawler-tasks/state-machine.ts`
- **Verification:** `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/receipt-validation.test.ts src/domain/crawler-tasks/__tests__/repository.test.ts src/domain/crawler-tasks/__tests__/state-machine.test.ts`, `pnpm --filter api type-check`, `pnpm --filter api build`
- **Committed in:** `942e89f`

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** 所有额外修正都属于完成 21-03 所必需的类型闭环，没有扩展到 21-04 route、21-05 adapter、21-06 UI 或 21-07 E2E。

## Issues Encountered

- `state-machine.ts` 的 blast radius 在 GitNexus pre-commit `--scope all` 中被评为 `CRITICAL`，因为它位于 `ClaimDispatch / ProcessRunnerEvent / ExpireProviderReconciliation / ScheduleRegister` 等核心执行流中心。实现中只增加了 repair 专用分支，普通 provider/movie/manga focused tests 保持通过。
- `lint-staged` 两次在提交前拦住真实问题：一次是 `receipt-validation.ts` 里残留未使用类型，一次是 `repository.ts` 里废弃的 `getTemplateKey`。两处都在提交前清掉，没有污染用户已有脏文件。
- 最终 `npx gitnexus detect-changes --repo starye --scope all` 只看到用户预置的 `AGENTS.md` / `CLAUDE.md` 未暂存修改，风险 `low`、受影响流程 `0`；这些文件未被本计划暂存或提交。

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None.

## Next Phase Readiness

- 21-04 现在可以在 admin repair command / signed runner callback routes 上直接消费 operation-aware snapshot、repair receipt validator 和 revision-aware repository guards。
- 21-05 的 local repair adapter 可以把 transient `source_read_failed` / `source_write_failed` 明确编码为当前 repository 已识别的一次性 automatic retry 入口。
- 21-06 UI 只需要消费 bounded repair receipt/source summary，不需要再接触 raw runner/source materials。

## Self-Check: PASSED
