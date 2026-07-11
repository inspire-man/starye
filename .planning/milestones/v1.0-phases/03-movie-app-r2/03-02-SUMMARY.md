---
phase: 03-movie-app-r2
plan: 02
subsystem: player-ui
tags: [movie-app, xgplayer, retry, buffering, error-overlay]
requires:
  - phase: 03-movie-app-r2
    provides: Phase 3 文档范围已收敛为 VIDEO-04/05
provides:
  - Player.vue 统一 loading / error 状态机
  - waiting 超时进入可见错误态
  - 同源重试保留 currentTime，且重复失败升级文案
affects: [movie-app-playback, phase-3-uat]
tech-stack:
  added: []
  patterns:
    - "Pattern: xgplayer 恢复优先 destroy + re-init + startTime 回填，而不是隐式切换源"
key-files:
  created:
    - .planning/phases/03-movie-app-r2/03-02-SUMMARY.md
  modified:
    - apps/movie-app/src/views/Player.vue
key-decisions:
  - "统一错误卡片覆盖标准播放源与 TorrServer 流，不再保留分裂的 TorrServer 专用错误 UI"
  - "重试语义锁定为同源重建播放器，并尽量回到上次位置"
patterns-established:
  - "Pattern: waiting 事件只负责进入 loading，真正的失败由超时门槛转为 recoverable error"
requirements-completed:
  - VIDEO-04
  - VIDEO-05
duration: "~45 min"
completed: 2026-05-12
---

# Phase 3 Plan 02 Summary

**`Player.vue` 现在用统一错误卡片承接普通源与 TorrServer 的播放异常，并支持 waiting 超时和保守的同源重试**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-12T14:35:00+08:00
- **Completed:** 2026-05-12T15:00:46+08:00
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- 新增统一 `playerLoading` / `errorState` 状态，覆盖标准播放源与 TorrServer 两条路径
- `waiting` 超过 10 秒会转成明确错误态，不再无限停留在“正在缓冲”
- “重试当前源”会记录当前时间、销毁旧播放器、重建同一 URL，并在短时间内连续失败时升级为“多次失败”提示
- 系列导航或播放器路由参数变化时会重新拉取详情并重建播放器，避免 Vue 复用组件后页面不刷新

## Task Commits

本次在当前工作树内执行，尚未创建原子提交。

1. **Task 1: 合并 TorrServer 专用 overlay 为统一 player 状态** — 未提交（working tree）
2. **Task 2: 实现 waiting 超时与同源重试** — 未提交（working tree）

**Plan metadata:** 本 SUMMARY 文件随当前未提交变更一并存在

## Files Created/Modified

- `apps/movie-app/src/views/Player.vue` - 统一错误卡片、waiting 超时、destroy+reinit 重试、路由变化重载

## Decisions Made

- 采用 `destroy() + new Player({ startTime })` 的保守重试路径
- 对 `magnet:` 普通源直接给出“返回详情页改用 TorrServer / Aria2”的不可恢复提示，不在播放器页做隐式切换

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Behavioral Regression] Player 路由复用时不会自动重载**
- **Found during:** Task 2（同源重试完成后的回归检查）
- **Issue:** `/movie/:code/play` 组件在系列导航或 query 切换时会被 Vue Router 复用，若不监听路由变化，播放器不会重新初始化
- **Fix:** 在 `Player.vue` 增加对 `route.params.code`、`route.query.player`、`route.query.streamUrl` 的 `watch`，变化时重新执行 `fetchMovieAndPlay()`
- **Files modified:** `apps/movie-app/src/views/Player.vue`
- **Verification:** `pnpm --filter @starye/movie-app exec vue-tsc --noEmit`；`pnpm --filter @starye/movie-app test --run`
- **Committed in:** 未提交（working tree）

---

**Total deviations:** 1 auto-fixed（1 behavioral regression）
**Impact on plan:** 修正直接影响播放器页切源/连播可用性，属于 Phase 3 范围内的必要收口，无额外 scope creep。

## Issues Encountered

- 初次验证时发现本地未安装依赖，`vue-tsc` / `vitest` 都不可执行；已在仓库根执行 `pnpm install` 后完成验证

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `Player.vue` 已具备统一错误入口，`03-03` 可以在此基础上只补连接态反馈，不需要再重构播放状态机
- 自动化层面 `vue-tsc` 与 movie-app 单测已通过，剩余主要验证转向 human UAT

---
*Phase: 03-movie-app-r2*
*Completed: 2026-05-12*
