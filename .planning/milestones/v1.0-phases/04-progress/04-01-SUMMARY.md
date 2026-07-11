---
phase: 04-progress
plan: 01
subsystem: unified-progress-foundation
tags: [db, drizzle, api, progress, contract]
requires:
  - phase: 04-progress
    provides: Phase 4 planning artifacts and locked progress semantics
provides:
  - unified `progress` data model in code
  - `/api/public/progress` route rewritten to single-table contract
  - route regression tests covering `completed` and auth guard
affects: [movie-progress, comic-progress, api-progress, db-schema]
tech-stack:
  added: []
  patterns:
    - "Pattern: 保留既有 route path，内部 hard cutover 到统一表和统一 contract"
key-files:
  modified:
    - packages/db/src/schema.ts
    - apps/api/src/schemas/progress.ts
    - apps/api/src/routes/public/progress/index.ts
    - apps/api/src/routes/public/progress/__tests__/progress.test.ts
    - apps/api/src/routes/public/movies/index.ts
key-decisions:
  - "统一 `progress` 表以 `(userId, contentType, contentId)` 唯一约束作为 upsert conflict target"
  - "保留 `/reading` 与 `/watching` 入口，但底层不再保留双表/双写/双读"
  - "movie/comic progress response 均显式返回 `completed`"
requirements-completed:
  - PROG-01
  - PROG-02
  - PROG-03
completed: 2026-05-13
---

# Phase 4 Plan 01 Summary

## Accomplishments

- 把 `packages/db/src/schema.ts` 中的 `reading_progress` / `watching_progress` 替换为统一 `progress` 表定义，并加入 `(userId, contentType, contentId)` 唯一约束与 `(userId, updatedAt)` 历史索引语义
- 重写 `apps/api/src/schemas/progress.ts`，把 movie/comic progress contract 收口为 `position / duration / completed / updatedAt`
- 重写 `apps/api/src/routes/public/progress/index.ts`，统一走单表读写、`onConflictDoUpdate` upsert、显式 `completed`
- 调整 `apps/api/src/routes/public/movies/index.ts` 的推荐历史来源，使其不再依赖旧 `watching_progress`
- 重建 `progress.test.ts`，锁定 `401`、单条查询、history 列表和 `completed` contract

## Verification

- `pnpm --filter api test --run src/routes/public/progress/__tests__/progress.test.ts` 通过
- `pnpm --filter @starye/db run generate` 未能在当前环境直接执行：根 `.bin` 缺少可调用 `drizzle-kit`，需改为包内入口或补环境
- `pnpm --filter api exec tsc --noEmit` 当前被环境/构建状态阻塞：
  - `packages/db/dist` 无法创建，报 `EPERM`
  - API 项目引用 `packages/db/dist/*.d.ts`，因此出现连锁 `TS6305`

## Issues Encountered

- 当前沙箱/工作区对 `packages/db/dist` 的目录创建被拒绝，阻塞 `db`/`api` 的声明产物构建
- `drizzle-kit` 安装在 `packages/db/node_modules` 中，但未暴露为当前可直接执行的 workspace `.bin` 命令

## Notes

- 代码层面的 hard cutover 已完成，但 migration SQL / snapshot 仍需在可写环境下用正式 Drizzle generate 补齐
- 后续 `04-02` / `04-03` 已基于当前 unified contract 开始对接 movie/comic 端
