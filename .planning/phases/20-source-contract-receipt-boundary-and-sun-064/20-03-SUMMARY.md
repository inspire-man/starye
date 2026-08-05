---
phase: 20-source-contract-receipt-boundary-and-sun-064
plan: 03
subsystem: api-dashboard-movie-playback
tags: [typescript, hono, vue, vitest, readiness, receipt, player-guard]

# Dependency graph
requires:
  - phase: 20-02
    provides: "canonical movie.id receipt readback、source reconciliation 和 SUN-064 no_source projection"
provides:
  - "public MovieDetail、service detail、admin task detail 使用同形状 readiness projection"
  - "Dashboard 与 MovieDetail 的 metadata/source/playback/receipt 分层摘要"
  - "标准 Player 的 eligible-source pre-constructor guard 和 view-tracking guard"
affects: [phase-21-source-repair, phase-22-playback-experience, fresh-production-proof]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "typed allowlist readiness projection with bounded reason codes"
    - "ready/source state and browser playback proof remain independent"
    - "Player requires server-owned ready disposition plus an active non-empty source"

key-files:
  created:
    - apps/api/src/routes/public/movies/__tests__/readiness.test.ts
  modified:
    - apps/api/src/domain/movies/source-contract.ts
    - apps/api/src/schemas/movie.ts
    - apps/api/src/routes/public/movies/index.ts
    - apps/api/src/routes/movies/services/movie.service.ts
    - apps/api/src/__tests__/services/movie.service.test.ts
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/dashboard/src/lib/api.ts
    - apps/dashboard/src/views/Crawlers.vue
    - apps/dashboard/src/views/__test__/Crawlers.test.ts
    - apps/movie-app/src/types.ts
    - apps/movie-app/src/views/MovieDetail.vue
    - apps/movie-app/src/views/Player.vue
    - apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts
    - apps/movie-app/src/views/__tests__/Player.security.test.ts

key-decisions:
  - "MovieDetail 继续以 movie.id 和 primaryContentId 作为同一内容身份，readiness 由 API DTO 提供。"
  - "ready、no_source、source_failed、repairing 与 playback_verified 分块展示；ready/receipt/page load 均不升级 playback proof。"
  - "标准 Player 只在 source disposition=ready、eligibleCount>0 且实际 active source URL 非空时进入 view tracking 和 xgplayer 生命周期。"
  - "MovieDetail 来源摘要只显示 source 类型和 eligibility；原始来源 URL 文本从状态摘要中移除，受控播放动作继续沿用现有路径。"

patterns-established:
  - "metadata.persisted、source readiness、receipt persisted 和 playback status 各自拥有独立 label/区域。"
  - "bounded reason code 映射为受控文案，页面不渲染 raw receipt、runner exception 或 credential-shaped 字段。"

requirements-completed: [SRC-01, SRC-03]

coverage:
  - id: D1
    description: "API public/service/admin detail 返回统一 identity、metadata、source readiness、playback proof 和 validated receipt projection"
    requirement: SRC-01
    verification:
      - kind: unit
        ref: "pnpm --filter api exec vitest run src/routes/public/movies/__tests__/readiness.test.ts src/__tests__/services/movie.service.test.ts src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter api type-check"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dashboard task detail 以固定顺序显示 metadata persisted、source readiness、playback proof 和 receipt/source summary，并保留 bounded actions"
    requirement: SRC-01
    verification:
      - kind: automated_ui
        ref: "apps/dashboard/src/views/__test__/Crawlers.test.ts (10 tests)"
        status: pass
      - kind: other
        ref: "pnpm --filter dashboard type-check"
        status: pass
    human_judgment: false
  - id: D3
    description: "MovieDetail 显示 SUN-064 no_source/repairable 与其他 readiness labels；标准 Player 在 guard 前跳过 view tracking 和 xgplayer constructor"
    requirement: SRC-03
    verification:
      - kind: automated_ui
        ref: "apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts and Player.security.test.ts (13 tests)"
        status: pass
      - kind: other
        ref: "pnpm --filter movie-app exec vue-tsc -b"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 20m
completed: 2026-08-05
status: complete
---

# Phase 20 Plan 03: Admin/MovieDetail DTO、Dashboard And Player Guard Summary

**以同形状 readiness projection 连接 API、Dashboard 和 Movie app，并在 Player 构造器与 view tracking 前落实 SUN-064 no-source guard。**

## Performance

- **Duration:** 1h 20m
- **Started:** 2026-08-05T16:24:11+08:00
- **Completed:** 2026-08-05T17:44:04+08:00
- **Tasks:** 3
- **Files modified:** 15（不含本 Summary）

## Accomplishments

- API public MovieDetail、movie service detail 和 admin crawler task detail 均消费 server-owned readiness projection，并保持 movie.id/primaryContentId 身份一致。
- Dashboard、MovieDetail 分别呈现 Metadata persisted、Source readiness、Playback proof、Receipt/source summary；`ready`、`no_source`、`source_failed`、`repairing`、`playback_verified` 保持独立语义。
- MovieDetail 对 SUN-064 `players=0` 显示 `暂无可用播放源`、eligible count 0、可修复与受控读回动作；source failure 使用 bounded reason 和 alert，repairing 使用 status 并锁定播放主动作。
- Player 标准模式在 view tracking 和 `new Player` 前检查 DTO disposition、eligibleCount 和实际 active source；no-source、全 inactive、source readback failure 均进入返回详情 guard。
- MovieDetail 来源列表的可见摘要改为受控 source 类型与 eligibility，播放器内部仍使用 API 返回的 canonical source action。

## Task Commits

Each task was committed atomically:

1. **Task 1: 发布 typed MovieDetail/admin readiness DTO 并保持两条 API 读取路径一致** - `ee9867f`（RED）→ `9766377`（GREEN）
2. **Task 2: 实现 Dashboard task detail 的三层状态 focal point** - `41ef5f2`（RED）→ `ad070c5`（GREEN）
3. **Task 3: 添加 MovieDetail readiness summary 与 Player no-source pre-constructor guard** - `c13542f`（RED）→ `c82373c`（GREEN）

TDD gate sequence verified: each task has a test commit followed by a feature commit.

## Files Created/Modified

- `apps/api/src/domain/movies/source-contract.ts`、`apps/api/src/schemas/movie.ts` - 暴露 typed readiness/source/playback/receipt projection。
- `apps/api/src/routes/public/movies/index.ts`、`apps/api/src/routes/movies/services/movie.service.ts` - public code/slug 读取路径使用同一 server-owned readiness shape。
- `apps/api/src/routes/admin/crawler-tasks/index.ts`、`apps/dashboard/src/lib/api.ts` - validated receipt allowlist 与 admin typed DTO。
- `apps/dashboard/src/views/Crawlers.vue` - task detail focal summary、bounded reason 和受控 readback actions。
- `apps/movie-app/src/types.ts`、`apps/movie-app/src/views/MovieDetail.vue` - public client DTO、五态 readiness summary 和受控来源摘要。
- `apps/movie-app/src/views/Player.vue` - standard mode pre-constructor/pre-tracking source guard。
- `apps/api/src/routes/public/movies/__tests__/readiness.test.ts`、`apps/api/src/__tests__/services/movie.service.test.ts`、`apps/dashboard/src/views/__test__/Crawlers.test.ts`、`apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts`、`apps/movie-app/src/views/__tests__/Player.security.test.ts` - contract、DOM 和 security regression coverage。

## Decisions Made

- 复用既有 Movie CRUD、route 和 player lifecycle；本计划只增加 DTO consumption、状态摘要和前置 guard。
- `playback_verified` 只呈现 API 提供的独立 browser evidence；本地 focused tests 未把 ready 或 page load 当成播放 proof。
- MovieDetail 的 `查看修复意图` 仅展示受控 repairable 状态；实际 `repair_players` mutation 留给 Phase 21 的受控修复纵向链路。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Information Disclosure] 收紧 MovieDetail 来源可见摘要**

- **Found during:** Task 3 GREEN implementation
- **Issue:** 既有来源列表把 raw source URL 作为可见文本，和本计划的 bounded source summary/threat mitigation 不一致。
- **Fix:** 改为显示受控 source 类型（磁力/直连）与 eligibility；既有受控播放、复制、TorrServer、Aria2 action 仍沿用内部 source value。
- **Files modified:** `apps/movie-app/src/views/MovieDetail.vue`
- **Verification:** Movie focused DOM/security tests 13/13、eslint、source summary scan 通过。
- **Committed in:** `c82373c`

**2. [Rule 3 - Blocking] 使用 movie-app 的实际类型检查入口**

- **Found during:** Plan-level verification
- **Issue:** 计划命令 `pnpm --filter movie-app type-check` 对当前 package 没有对应 script。
- **Fix:** 使用 package 已配置的 `vue-tsc` 入口执行 `pnpm --filter movie-app exec vue-tsc -b`。
- **Files modified:** None
- **Verification:** 命令通过；API、Dashboard 类型检查也通过。
- **Committed in:** N/A（verification-only deviation）

---

**Total deviations:** 2 auto-fixed/handled (Rule 2: 1, Rule 3: 1)
**Impact on plan:** 均为安全与验证入口的必要调整，未扩大 API、provider、repair mutation 或 production proof scope。

## Issues Encountered

- GitNexus 初始索引落后于已有 Task 2 commit；已运行 `npx gitnexus analyze` 刷新到当前代码。Analyzer 报告两个既有 dashboard test scope extraction warning，但索引完成且 focused verification 通过。
- staged detect-changes 在 Task 3 GREEN 提交前报告 3 files、17 symbols、4 个 Player loading flows、MEDIUM risk；范围与预期文件/流程一致。MovieDetail interface 预分析为 HIGH，保持了既有 import contract。
- 未启动 Gateway、未执行浏览器 smoke、远程或生产 proof；这些范围留给后续授权的 fresh production 任务，当前结果仅代表本地自动验证。

## Known Stubs

- `apps/movie-app/src/views/MovieDetail.vue` 的 `查看修复意图` 是 bounded informational action，当前只反馈 server-owned repairable 状态；Phase 21 提供实际受控 `repair_players` mutation。

## Threat Surface Scan

本计划未新增 endpoint、auth path、provider dispatch 或任意 source input。新增浏览器边界只接受 typed readiness projection，并在标准 Player 的 view tracking/constructor 前执行 active non-empty source check；receipt/source UI 只渲染 validated projection。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 20 的 API、Dashboard 和 Movie app 本地 readiness contract 已具备，Phase 21 可在同一 `primaryContentId` 上接入受控 repair_players vertical slice。
- 继续保留 `ready` 与独立 playback proof 的边界；实际 browser `playing` + `currentTime` 和 production tuple proof 仍待后续阶段完成。

---
*Phase: 20-source-contract-receipt-boundary-and-sun-064*
*Plan: 20-03*
*Completed: 2026-08-05*

## Self-Check: PASSED

- Summary 文件已创建。
- Task commits `ee9867f`、`9766377`、`41ef5f2`、`ad070c5`、`c13542f`、`c82373c` 均存在。
- 15 个实现/测试文件已检查存在；无 task commit 删除 tracked file。
- `git diff --check` 和计划级 focused verification 均通过。
