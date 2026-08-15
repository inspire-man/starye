---
quick: 260815-kzr-dashboard
date: 2026-08-15
status: complete
---

# Dashboard 列表 UI 精修

## Delivered

- `DataTable` 与 `SkeletonTable` 使用受限高度的双向滚动容器，移除稳定滚动槽造成的右侧白边，并固定表头与统一 `actions` 操作列。
- `DetailDrawer` 统一 Teleport 层级、视口高度、边距、圆角、滚动条与加载骨架；抽屉不会被 Dashboard 侧栏遮挡。
- `FilterPanel`、`Pagination`、共享主题 token 和 Dashboard 主题覆盖统一控件高度、间距、边框、圆角及语义状态色；超过三个筛选项进入“高级筛选”。
- 爬虫、漫画、电影、审计、文章、用户、收藏列表的状态标签使用 success/info/warning/danger/neutral 语义配色。
- 演员与电影页 Skeleton 列数和选择列与真实表格对齐；审计日志的“操作类型”不会误被识别为 sticky 操作列。
- 新增共享 `DataTable` sticky/高度回归测试，并扩展 SkeletonTable 结构断言。

## Scope

本 quick task 只修改 Dashboard 与 `@starye/ui` 的 UI、测试和 GSD 记录；未修改 API、数据库、爬虫业务逻辑或已有无关未跟踪文件。

## Residual

- Dashboard production build 保留既有的单 chunk 大于 500 kB warning，产物已成功生成。
- Gateway 的登录态浏览器访问在本轮被本地 GitHub 登录页拦截；已有 Dashboard Vite mock session 的桌面/移动检查用于验证滚动、sticky 操作列、抽屉层级与筛选折叠。
