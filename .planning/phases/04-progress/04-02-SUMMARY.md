---
phase: 04-progress
plan: 02
subsystem: movie-progress
tags: [movie-app, progress, player, history, torrserver]
requires:
  - phase: 04-progress
    provides: unified progress API contract
provides:
  - movie player restore/save/completed semantics aligned to unified progress
  - `streamUrl` / TorrServer path participates in the same progress model
  - Home / History / Profile stop guessing completion locally
affects: [movie-player, continue-watching, movie-history, movie-profile]
key-files:
  modified:
    - apps/movie-app/src/types.ts
    - apps/movie-app/src/lib/api-client.ts
    - apps/movie-app/src/lib/__tests__/api-client.test.ts
    - apps/movie-app/src/views/Player.vue
    - apps/movie-app/src/views/Home.vue
    - apps/movie-app/src/views/History.vue
    - apps/movie-app/src/views/Profile.vue
requirements-completed:
  - PROG-04
  - PROG-05
completed: 2026-05-13
---

# Phase 4 Plan 02 Summary

## Accomplishments

- `WatchingProgress` / `WatchingHistoryItem` 类型切到 unified contract，显式包含 `contentType`、`contentId`、`position`、`completed`
- `progressApi.saveWatchingProgress()` 支持向 API 发送显式 `completed`
- `Player.vue` 改为统一 movie progress 语义：
  - 标准源与 `streamUrl` 路径都读取统一 progress
  - `<30s` 不恢复也不写入
  - 10 秒 checkpoint + `pause` / `seeked` / `pagehide` / `ended` flush
  - 完成阈值固定 `>=90%`
  - 已完成重开从头，并尝试立即清掉 `completed`
- `Home.vue`、`History.vue`、`Profile.vue` 全部改为读取显式 `completed`，删除本地 `90% / 3600 秒` 猜测逻辑

## Verification

- `pnpm --filter @starye/movie-app exec vue-tsc --noEmit` 通过
- `pnpm --filter @starye/movie-app test --run src/lib/__tests__/api-client.test.ts` 受当前环境写 `apps/movie-app/node_modules/.vite-temp` 限制，报 `EPERM`

## Notes

- `streamUrl` 现在也会读取并写回统一 progress，但真实浏览器验证仍需按 `04-HUMAN-UAT.md` 执行
- 由于当前环境限制，Vitest 没法在 `movie-app` 侧落本地临时配置文件，需在可写环境重新跑一遍 client test / e2e
