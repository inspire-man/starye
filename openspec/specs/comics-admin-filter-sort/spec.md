# comics-admin-filter-sort Specification

## Purpose
为漫画管理页面提供与电影管理一致的筛选（含爬取状态）和服务端排序能力，替换现有的裸 HTML 筛选控件，并补全后端 handler 对排序和 crawlStatus 参数的支持。

## ADDED Requirements

### Requirement: Admin SHALL filter comics by crawl status

管理员 **SHALL** 能够通过爬取状态筛选漫画列表。

#### Scenario: Filter by pending status
- **WHEN** 管理员在筛选面板选择"爬取状态: 等待中"
- **THEN** 系统仅显示 `crawlStatus = 'pending'` 的漫画

#### Scenario: Filter by partial status
- **WHEN** 管理员选择"爬取状态: 部分完成"
- **THEN** 系统仅显示 `crawlStatus = 'partial'` 的漫画，卡片显示章节进度

#### Scenario: Filter by complete status
- **WHEN** 管理员选择"爬取状态: 已完成"
- **THEN** 系统仅显示 `crawlStatus = 'complete'` 的漫画

#### Scenario: Combined filters
- **WHEN** 管理员同时设置 `isR18=true` 和 `crawlStatus=partial`
- **THEN** 系统显示同时满足两个条件的漫画（AND 逻辑）

### Requirement: Admin SHALL sort comics by various fields server-side

管理员 **SHALL** 能够按不同字段对漫画列表进行服务端排序。

#### Scenario: Sort by update time descending
- **WHEN** 管理员选择"排序: 更新时间 / 降序"
- **THEN** 系统返回按 `updatedAt` 降序排列的漫画，最近更新在前

#### Scenario: Sort by title ascending
- **WHEN** 管理员选择"排序: 标题 / 升序"
- **THEN** 系统返回按 `title` 字母升序排列的漫画

#### Scenario: Sort by manual order
- **WHEN** 管理员选择"排序: 人工排序"
- **THEN** 系统返回按 `sortOrder` 降序排列的漫画

#### Scenario: Sort parameter passed to server
- **WHEN** 管理员切换排序方式
- **THEN** 前端将 `sortBy` 和 `sortOrder` 参数传入 API 请求，**不在客户端**重新排序

### Requirement: Comics admin filter panel SHALL use FilterPanel component

漫画管理页面的筛选区域 **SHALL** 使用 `@starye/ui` 的 `FilterPanel` 组件，保持与电影管理页一致的视觉风格。

#### Scenario: Filter panel renders with configured fields
- **WHEN** 管理员打开漫画管理页
- **THEN** 页面顶部显示 FilterPanel，包含以下字段：搜索（文本）、R18（下拉）、连载状态（下拉）、地区（文本）、爬取状态（下拉）

#### Scenario: Filter panel apply and reset
- **WHEN** 管理员点击 FilterPanel 的"应用"按钮
- **THEN** 列表根据当前筛选条件重新加载，页码重置为 1

#### Scenario: Filter reset clears all conditions
- **WHEN** 管理员点击 FilterPanel 的"重置"按钮
- **THEN** 所有筛选字段清空，列表显示全部漫画

### Requirement: Comics API handler SHALL support sorting and crawlStatus filtering

后端 `GET /admin/comics` 接口 **SHALL** 支持 `sortBy`、`sortOrder`、`crawlStatus` 查询参数。

#### Scenario: Sort by updatedAt
- **WHEN** 请求携带 `sortBy=updatedAt&sortOrder=desc`
- **THEN** SQL 查询添加 `ORDER BY updatedAt DESC`

#### Scenario: Filter by crawlStatus
- **WHEN** 请求携带 `crawlStatus=partial`
- **THEN** SQL 查询添加 `WHERE crawlStatus = 'partial'`

#### Scenario: Invalid sortBy rejected
- **WHEN** 请求携带非白名单的 `sortBy` 值（如 SQL 注入尝试）
- **THEN** 系统使用默认排序（`updatedAt DESC`），不抛出错误
