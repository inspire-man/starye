---
status: complete
phase: 04-progress
source: [04-04-PLAN.md]
started: 2026-05-13
updated: 2026-05-13T09:44:47.3707619+08:00
---

## Current Test

[testing complete]

## Automated Gate Before UAT

在执行人工验证前，至少补跑并记录以下命令结果：

```bash
pnpm --filter api test --run src/routes/public/progress/__tests__/progress.test.ts
pnpm --filter @starye/movie-app exec vue-tsc --noEmit
pnpm --filter @starye/comic-app exec vue-tsc --noEmit
```

若环境允许写 `packages/db/dist` 与 Drizzle metadata，还应补跑：

```bash
cd packages/db
node node_modules/drizzle-kit/bin.cjs generate --config=drizzle.config.ts
cd ../../apps/api
pnpm exec wrangler d1 migrations apply starye-db --local
pnpm exec wrangler d1 execute starye-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## Tests

### 1. 标准 movie 中途退出后恢复
expected: 在 `http://localhost:8080/movie/movie/<movieCode>/play` 播放到中段后关闭标签页，再次打开同一影片，播放器自动恢复到上次位置附近（误差不超过 10 秒）；若上次位置小于 30 秒则不恢复。
result: pass

### 2. 标准 movie 的 `pause` / `seeked` / `pagehide` flush
expected: 播放中拖动进度条、暂停、或直接关闭标签页后，重新进入同一影片仍能恢复到最近一次操作后的进度；`pagehide` 触发路径不丢进度。
result: pass

### 3. `streamUrl` / TorrServer 路径纳入统一 progress
expected: 通过 TorrServer / `streamUrl` 进入播放页后，观看超过 30 秒并关闭标签页，再次从相同影片进入播放页时，仍恢复到统一进度；不再出现 `streamUrl` 模式完全不存进度的情况。
result: pass

### 4. movie 完成后再次打开从头开始
expected: 将同一影片观看到结尾或超过 90% 阈值后，progress 被写成 `completed=true`；再次打开同一影片时从 `0` 开始，不再 seek 到结尾附近。
result: pass

### 5. movie 已完成后重新开始会清掉 `completed`
expected: 一部已完成影片再次播放新会话后，继续观看一小段并离开，再进入历史页/个人中心时，该记录应显示为未完成且位置从头重新累计。
result: pass

### 6. comic 中途阅读后恢复页码
expected: 在 `http://localhost:8080/comic/comic/<slug>/read/<chapterId>` 阅读到中段后关闭标签页，再次打开同一章节，恢复到关闭前页码；误差 0 页。
result: pass

### 7. comic 最后一页完成后再次打开回第一页
expected: 读到最后一页后写入 `completed=true`，再次进入同一章节时回到第一页；但该记录仍保留在 Profile 阅读历史中，并标记为“已读完”。
result: pass

### 8. comic 已完成章节重开会清掉 `completed`
expected: 对一个已完成章节重新开始阅读并停留在前几页后离开，再次查看 Profile，记录应显示为未读完，且页码是新的当前位置。
result: pass

### 9. 匿名点击 movie 进度入口跳登录
expected: 未登录时点击 movie 首页“查看全部历史”或直接访问 `http://localhost:8080/movie/history` / `http://localhost:8080/movie/profile`，浏览器直接跳转到 `/auth/login?next=...`，不再只弹 toast。
result: pass

### 10. 匿名点击 comic 进度入口跳登录
expected: 未登录时直接访问 `http://localhost:8080/comic/profile`，或从头部个人中心入口点击进入，浏览器直接跳转到 `/auth/login?next=...`，不再只弹 warning。
result: pass

### 11. migration smoke: unified `progress` 表存在
expected: 本地应用 migration 后，`sqlite_master` 中存在 `progress` 表，且字段包含 `content_type`、`content_id`、`position`、`completed`、`updated_at`。
result: pass

### 12. migration smoke: 旧表已退场
expected: 本地应用 migration 后，`sqlite_master` 中不再存在 `reading_progress` 与 `watching_progress` 表，也不再存在 `idx_reading_progress_user_chapter` / `idx_watching_progress_user_movie` 旧索引。
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
