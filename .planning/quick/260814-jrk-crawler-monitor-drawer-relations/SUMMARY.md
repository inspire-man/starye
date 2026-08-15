---
quick: 260814-jrk-crawler-monitor-drawer-relations
date: 2026-08-14
status: complete
---

# 爬虫监控与关联入库优化

## Delivered

- 清理本地 D1 中确认属于 Phase 13/20/21 历史 fixture 的 34 条无封面电影；电影数 `93 -> 59`，无封面电影 `34 -> 0`，女优关联 `81`、厂商关联 `160` 保持有效。
- 为厂商同步补充真实写入、`movie_publisher` 关联、`movieCount`、幂等同步和反查覆盖；关联同步测试 13/13 通过。
- 新增 `@starye/ui` 共享 `DetailDrawer`，接入爬虫、电影、漫画、女优、厂商、审计日志和用户列表；详情在选中列表行后以右侧抽屉显示，支持 Teleport、Esc、遮罩关闭、关闭按钮聚焦和移动端宽度。
- 爬虫历史改为视频/漫画两个权限感知 tabs；每个 tab 使用 table 和右侧图标操作栏，终态任务提供“删除任务（归档）”入口。
- Dashboard 抽屉、爬虫任务、漫画上传回归覆盖已适配 Teleport 查询，并补充共享抽屉测试和终态归档操作测试。

## Verification

- `pnpm --filter @starye/ui type-check`
- `pnpm --filter dashboard type-check`
- Dashboard focused tests: 40/40 passed；Crawlers focused suite: 23/23 passed
- Dashboard full suite: 12 test files、147/147 passed
- `pnpm --filter api test -- --run src/routes/movies/__tests__/services/sync-actor-integration.test.ts`: 13/13 passed
- GitNexus index up-to-date；impact analysis 已完成，无 HIGH/CRITICAL；`npx gitnexus detect-changes --repo starye`：14 tracked files、22 symbols、3 flows、medium risk。
- Gateway 浏览器入口 `http://localhost:8080/dashboard/crawlers` 已发起检查；当前本地浏览器未登录，被重定向到 `/auth/login`，未伪造生产登录状态。

## Local Evidence

`apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/eee80aed4f600740bcd15afbe1c1bdaceff2e35620774760a6f69991cc385e66.sqlite`

当前计数：`movie 59`、无封面 `0`、`player 0`、`movie_actor 81`、`movie_publisher 160`、`actor 52`、`publisher 35`。
