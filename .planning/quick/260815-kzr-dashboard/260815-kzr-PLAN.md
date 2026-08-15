---
quick_id: 260815-kzr
slug: dashboard
status: in_progress
---

# Dashboard UI 密度与状态视觉统一

## 目标

修复 Dashboard 列表中表格右侧空白、滚动高度无上限、操作列未固定和内容间距过大的问题，并统一抽屉、筛选、分页、Skeleton 与状态标签的主题表现。

## Must Haves

- 表格滚动容器同时支持横向和纵向滚动，默认有 viewport-relative 最大高度，不产生稳定滚动槽白边。
- 操作列自动 sticky 到右侧，表头和 sticky 单元格在滚动、悬停和 Skeleton 状态下都有不透明背景与层级。
- 抽屉、筛选栏、分页和表格使用紧凑且一致的间距、圆角、控件高度和滚动条策略。
- 爬虫最新状态/生命周期/可用性、漫画/电影状态与审计操作标签使用语义主题色，不再依赖分散的硬编码色值。
- 骨架屏与真实表格的表头、正文、操作列、最大高度和横向滚动结构一致。

## Implementation Tasks

1. 更新 `packages/ui` 的 `DataTable`、`SkeletonTable`、`DetailDrawer`、`FilterPanel`、`Pagination` 和共享 token。
   - Action: 加入 `maxHeight`、sticky action/header、双向滚动、紧凑 spacing、可访问的图标和 Skeleton 对齐。
   - Verify: UI type-check、组件测试、DOM class/inline style 断言。
2. 更新 Dashboard 主题 token、状态徽章和列表调用方。
   - Action: 统一 semantic status tokens，覆盖爬虫、电影、漫画、审计和文章状态；收紧旧的局部硬编码样式。
   - Verify: Dashboard lint/type-check/build、定向测试、Gateway 桌面/移动端检查。

## Scope

不修改 API、数据库、爬虫业务逻辑或现有未跟踪文件。
