---
quick: 260814-okh-200-ui
date: 2026-08-15
status: complete
---

# 清理非 200 封面、关系重建与后台列表体验优化

## Delivered

- 按真实 HTTP 状态清理本地与生产中的非 200 封面电影数据，删除无电影关联的女优/厂商，并重算关系计数；生产电影 `4493 -> 3683`、女优 `2080 -> 1938`、厂商 `441 -> 432`。
- 完成女优/厂商与影片关系重建和重同步，关联完整性、重复关联、孤儿记录、`movie_count` 不一致均为 `0`。
- 保留生产清理前备份与可审计重同步 SQL：
  - `.temp/data-cleanup/20260814-production-before-relation-resync.sql`
  - `.temp/data-cleanup/20260814-production-relation-resync.sql`
- 新增共享 `DetailDrawer`，通过 `Teleport` 到 `body`、高层级 fixed overlay、滚动锁定、Esc/遮罩关闭和移动端底部抽屉，统一接入后台列表详情。
- 新增统一 `Pagination`、`DataTable` 与 `FilterPanel` 方案：所有列表页与爬虫历史 tab 支持分页、右侧操作栏、统一密度和对齐；筛选项超过 3 个时收起为“高级筛选”。全部 11 个后台列表页均支持行点击详情抽屉。
- 爬虫监控保留视频/漫画两个 tab，终态任务提供归档删除操作；用户列表 API 增加可选分页响应并保持旧数组响应兼容。

## Verification

- `pnpm --filter @starye/ui type-check`
- `pnpm --filter dashboard type-check`
- `pnpm --filter api type-check`
- `pnpm --filter dashboard lint`
- `pnpm --filter dashboard build`（使用生成的 `STARYE_PAGES_BUILD_ENV_PATH`）
- Dashboard 全量测试：`12` 个文件、`147/147` 通过；DetailDrawer/Comics/Crawlers 定向测试 `41/41` 通过。
- API 女优/厂商同步测试：`13/13` 通过。
- `git diff --check` 通过。
- GitNexus `detect_changes({ scope: "all", repo: "starye" })`：`27` 个文件、`93` 个符号、`12` 条受影响执行流；总体风险为 `HIGH`，集中在共享分页/筛选组件、爬虫详情链路和电影同步链路，未出现 `CRITICAL`。新增 4 个列表加载函数的 upstream impact 均为 `LOW`。

## Runtime Notes

- `/api/health` 已验证返回 `200`。
- 本地 Gateway 的鉴权链路仍按项目约定工作；页面路由需要有效登录会话后再做交互验收。
- 构建产生的 chunk 大小提示为既有构建告警，不影响产物生成。
