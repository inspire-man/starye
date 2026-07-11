---
phase: 05-migration
plan: 03
subsystem: worker-observability
tags: [sentry, workers, hono, player]
requirements-completed:
  - OBS-01
  - OBS-03
  - OBS-04
completed: 2026-05-13
---

# Phase 5 Plan 03 Summary

## Accomplishments

- `apps/api` / `apps/gateway` 声明 `@sentry/cloudflare`
- 两个 Worker 入口都通过 `Sentry.withSentry(...)` 在 bootstrap 层集中初始化
- Worker 配置显式挂上 `honoIntegration()`
- `beforeSend` 第一轮过滤 `AbortError` / `NetworkError` / 超时 / fetch 失败类噪音
- `movie-app/src/views/Player.vue` 增加 video failure message telemetry，不改变现有错误卡片 UX

## Verification

- `pnpm --filter @starye/movie-app exec vue-tsc --noEmit` 通过
- `rg -n "@sentry/cloudflare|honoIntegration|beforeSend|AbortError|NetworkError" apps/api apps/gateway`
- `rg -n "captureMessage|video failure|userAgent|streamUrl|sourceUrl" apps/movie-app/src/views/Player.vue`

## Known Blockers

- `pnpm --filter api exec tsc --noEmit` 仍被仓库既有 `packages/db/dist` 缺失链路阻塞
- 同一次 `api tsc` 中还暴露出大量既有 `implicit any` 噪音，不是本 plan 新增

## Notes

- Worker observability 采用入口集中接入，不把 Sentry 调用散落到 route handler
- video failure 走 message/event 上报，不通过抛 crash exception 替代
