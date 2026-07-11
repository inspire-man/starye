---
phase: 04-progress
plan: 04
subsystem: progress-gate-and-uat
tags: [movie-app, comic-app, auth-gate, uat, migration]
requires:
  - phase: 04-progress
    provides: movie/comic progress implementation landed
provides:
  - movie/comic progress route guarding uses login redirect semantics
  - Phase 4 human UAT and migration smoke checklist exists
affects: [movie-router, comic-router, phase-4-uat]
key-files:
  modified:
    - apps/movie-app/src/router.ts
    - apps/comic-app/src/router.ts
    - apps/movie-app/src/views/Home.vue
    - .planning/phases/04-progress/04-HUMAN-UAT.md
requirements-completed:
  - PROG-04
  - PROG-05
  - PROG-06
  - PROG-07
  - PROG-08
completed: 2026-05-13
---

# Phase 4 Plan 04 Summary

## Accomplishments

- `movie-app` / `comic-app` 的受保护 progress 页面改为未登录直接跳 `/auth/login?next=...`，不再只做 toast/warning 阻断
- movie 首页“查看全部历史”入口改为匿名点击即走 `useAuthGuard(nextPath?)`
- 新建 `04-HUMAN-UAT.md`，覆盖：
  - movie 标准源恢复
  - `streamUrl` / TorrServer 进度
  - `pause` / `seeked` / `pagehide`
  - movie/comic 完成后重开语义
  - 匿名门控
  - migration smoke（`progress` 存在、旧表退场）

## Verification

- `pnpm --filter @starye/movie-app exec vue-tsc --noEmit` 通过
- `pnpm --filter @starye/comic-app exec vue-tsc --noEmit` 通过

## Notes

- 本 plan 的最终通过依赖 `04-HUMAN-UAT.md` 中的人工回归与 migration smoke 执行
- 由于当前环境无法创建 `packages/db/dist`，数据库 migration generate/apply 仍需在可写环境补跑并记录
