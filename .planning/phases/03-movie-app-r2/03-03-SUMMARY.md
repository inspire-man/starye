---
phase: 03-movie-app-r2
plan: 03
subsystem: playback-actions
tags: [movie-detail, aria2, torrserver, disabled, title]
requires:
  - phase: 03-movie-app-r2
    provides: Player.vue 已有统一错误卡片和恢复路径
provides:
  - MovieDetail 的 Aria2 / TorrServer 按钮离线时仍可见
  - 离线状态改为 disabled + title 提示，而不是直接消失
  - Player 错误卡片保留条件性 Aria2 补救动作
affects: [movie-app-detail, player-recovery, phase-3-uat]
tech-stack:
  added: []
  patterns:
    - "Pattern: movie-app 未接 i18n 时，按钮级离线提示先用原生 title 收口"
key-files:
  created:
    - .planning/phases/03-movie-app-r2/03-03-SUMMARY.md
  modified:
    - apps/movie-app/src/views/MovieDetail.vue
    - apps/movie-app/src/views/Player.vue
key-decisions:
  - "Aria2 / TorrServer 相关动作保持可见，只有适用性由 magnet 决定，可用性由 disabled 决定"
  - "离线提示采用原生 title，不把 Phase 3 scope 扩成 movie-app i18n 接入"
patterns-established:
  - "Pattern: 连接态提示文案在 view 层计算，不反向塞进 composable"
requirements-completed:
  - VIDEO-05
duration: "~20 min"
completed: 2026-05-12
---

# Phase 3 Plan 03 Summary

**MovieDetail 的 Aria2 / TorrServer 按钮现在在离线时仍然可见，并通过 disabled + title 提示当前不可用原因**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-12T14:46:00+08:00
- **Completed:** 2026-05-12T15:00:46+08:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `MovieDetail.vue` 中 `Aria2` / `在线播放` 按钮从“在线才显示”改为“磁链时始终显示，离线时禁用”
- 离线态分别提供 `aria2 未连接，请先在设置中配置` 和 `TorrServer 未连接，请先在设置中配置` 的原生 `title`
- `Player.vue` 错误卡片中保留“返回详情页”，并在存在 magnet 且 Aria2 已连接时显示“添加到 Aria2”

## Task Commits

本次在当前工作树内执行，尚未创建原子提交。

1. **Task 1: MovieDetail 按钮从条件显示改为条件禁用** — 未提交（working tree）
2. **Task 2: Player 错误卡片补齐条件性补救动作** — 未提交（working tree）

**Plan metadata:** 本 SUMMARY 文件随当前未提交变更一并存在

## Files Created/Modified

- `apps/movie-app/src/views/MovieDetail.vue` - Aria2 / TorrServer 按钮的 disabled + title 逻辑
- `apps/movie-app/src/views/Player.vue` - 错误卡片中的条件性 Aria2 补救动作与回详情页路径

## Decisions Made

- `magnet` 仍然决定“这类按钮是否适用”，但连接态不再决定“按钮是否存在”
- `title` 文案先用中文原生属性交付，避免将 Phase 3 扩展为运行时 i18n 改造

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `03-04` 只需补轻量验证与 human UAT，不需要再改 Aria2 / TorrServer composable
- 按钮反馈与播放器错误卡片已经对齐到同一套补救语义

---
*Phase: 03-movie-app-r2*
*Completed: 2026-05-12*
