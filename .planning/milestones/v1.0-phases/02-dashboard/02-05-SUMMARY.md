---
phase: 02-dashboard
plan: 05
subsystem: frontend-auth-guard
tags: [auth-guard, composable, open-redirect, login, movie-app, comic-app]
dependency_graph:
  requires: [02-01]
  provides: [useAuthGuard-movie-app, useAuthGuard-comic-app, login-next-param]
  affects: [apps/movie-app, apps/comic-app, apps/auth]
tech_stack:
  added: [vitest (comic-app)]
  patterns: [composable-auth-guard, same-origin-validation, window.location-redirect]
key_files:
  created:
    - apps/movie-app/src/composables/useAuthGuard.ts
    - apps/comic-app/src/composables/useAuthGuard.ts
    - apps/movie-app/src/composables/__tests__/useAuthGuard.test.ts
    - apps/comic-app/src/composables/__tests__/useAuthGuard.test.ts
    - apps/comic-app/vitest.config.ts
  modified:
    - apps/movie-app/src/views/MovieDetail.vue
    - apps/comic-app/src/composables/useFavorites.ts
    - apps/auth/app/pages/login.vue
    - apps/comic-app/package.json
    - pnpm-lock.yaml
decisions:
  - "useAuthGuard 放各 app 本地（D-12），两 app 的 user store 路径相同但独立维护"
  - "requireLogin() 使用 window.location.href 跳转（D-11），不用 Vue Router（跨 app 跳转需完整页面导航）"
  - "MovieCard.vue 不存在于 movie-app/src/components/，收藏按钮仅在 MovieDetail.vue，跳过 MovieCard 修改"
  - "login.vue 同源校验使用 new URL(raw, origin).origin === origin，跨域 URL 回退到 /（D-14）"
metrics:
  duration: "~15 min"
  completed: "2026-05-11"
  tasks_completed: 3
  files_changed: 10
---

# Phase 02 Plan 05: 前台登录门控 + login.vue 安全加固 Summary

前台收藏按钮登录门控链路完整落地：`useAuthGuard` composable 在 movie-app 和 comic-app 各自新建，`toggleFavorite` 插入 `requireLogin()` 检查，`login.vue` 支持 `next` 参数并加同源校验防止 open redirect。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 新建 useAuthGuard composable（movie-app + comic-app） | 6687a49 | useAuthGuard.ts × 2, tests × 2, vitest.config.ts |
| 2 | 前台收藏拦截 — MovieDetail.vue + comic useFavorites | 66f0eef | MovieDetail.vue, useFavorites.ts |
| 3 | login.vue 安全加固 — next 参数 + 同源校验 | 49574c8 | login.vue |

## Decisions Made

- `useAuthGuard` 放各 app 本地（D-12）：两个 app 的 user store 路径虽然相同，但独立维护更安全，避免 packages/ui 引入 Pinia 依赖。
- `requireLogin()` 使用 `window.location.href` 跳转（D-11）：跨 app 跳转需要完整页面导航，Vue Router push 无法跨应用。
- `login.vue` 同源校验使用 `new URL(raw, origin).origin === origin`（D-14）：跨域 URL 回退到 `/`，防止 open redirect 攻击。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] comic-app 缺少 vitest 测试基础设施**
- **Found during:** Task 1
- **Issue:** `apps/comic-app/package.json` 无 vitest 依赖，无 `vitest.config.ts`，无法运行测试
- **Fix:** 新增 vitest、@vitest/coverage-v8、@vue/test-utils、happy-dom 到 devDependencies；新建 `vitest.config.ts`；更新 pnpm-lock.yaml
- **Files modified:** `apps/comic-app/package.json`, `apps/comic-app/vitest.config.ts`, `pnpm-lock.yaml`
- **Commit:** 6687a49

### Plan Scope Adjustments

**2. apps/movie-app/src/components/MovieCard.vue 不存在**
- **Issue:** 计划要求修改 `apps/movie-app/src/components/MovieCard.vue`，但该文件不存在。`packages/ui/src/components/MovieCard.vue` 是纯展示组件，无收藏按钮。movie-app 中收藏按钮仅在 `MovieDetail.vue`。
- **Action:** 跳过 MovieCard 修改，仅修改 `MovieDetail.vue`（D-13 "仅收藏按钮落地"）。
- **Impact:** 收藏门控覆盖了所有实际存在的收藏入口，功能完整。

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: open-redirect-mitigated | apps/auth/app/pages/login.vue | `next` 参数同源校验已实现（T-02-03 mitigate 完成） |

## Known Stubs

None — 所有功能均已完整实现，无占位符或硬编码空值。

## Self-Check: PASSED

- `apps/movie-app/src/composables/useAuthGuard.ts` — FOUND
- `apps/comic-app/src/composables/useAuthGuard.ts` — FOUND
- `apps/movie-app/src/composables/__tests__/useAuthGuard.test.ts` — FOUND
- `apps/comic-app/src/composables/__tests__/useAuthGuard.test.ts` — FOUND
- `apps/comic-app/vitest.config.ts` — FOUND
- Commits 6687a49, 66f0eef, 49574c8 — FOUND
- movie-app tests: 164 passed — PASSED
- comic-app tests: 3 passed — PASSED
- TypeScript (movie-app, comic-app, auth) — PASSED
