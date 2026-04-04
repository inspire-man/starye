## Why

Dashboard 各管理页面存在明显的实现风格断层：`Movies.vue` 已采用统一共享组件体系（`FilterPanel`、`DataTable`、`BatchOperationMenu`、`ConfirmDialog`、`useBatchSelect`），而 `Comics.vue`、`Actors.vue`、`Publishers.vue`、`Crawlers.vue` 仍使用裸 HTML `<input>`/`<select>` 和原生 `confirm()` 弹窗。这导致管理员体验不一致，且批量操作、排序等能力在漫画侧完全缺失——尽管后端 API（`bulkOperationComics`、`bulkDeleteChapters`）和前端 api.ts 方法均已就绪。

## What Changes

### Comics 管理（主体）
- **Comics.vue** 替换裸 HTML filter bar 为 `FilterPanel` 组件，新增 `crawlStatus` 筛选字段
- **Comics.vue** 新增服务端排序控件（`sortBy` / `sortOrder`）
- **Comics.vue** 接入 `useBatchSelect` + `BatchOperationMenu`，支持批量设为 R18、批量锁定元数据、批量删除
- **Comics.vue** 章节列表加入批量删除功能，使用 `ConfirmDialog` 替代原有逐条删除

### 横向清理（其他模块）
- **Actors.vue** 替换裸 HTML filter bar 为 `FilterPanel`，将 `confirm()` 替换为 `ConfirmDialog`，排序改为服务端
- **Publishers.vue** 同 Actors.vue，保持两者一致
- **Crawlers.vue** 的 `handleClearFailed` 中的原生 `confirm()` 替换为 `ConfirmDialog`

### 体验细节
- **AuditLogs.vue** 中 `changes` 字段从裸 JSON `<pre>` 升级为 before/after diff 视图

## Capabilities

### New Capabilities
- `comics-batch-operations`: 漫画列表的批量操作能力（批量 R18、批量锁定、批量删除）及章节批量删除
- `comics-admin-filter-sort`: 漫画管理的筛选（含 crawlStatus）与服务端排序能力

### Modified Capabilities
- `admin-comic-management`: 原 spec 已描述批量操作和排序需求（Purpose 为 TBD），此次补全前端实现，spec 内容本身无变化
- `admin-crawler-monitoring`: Crawlers 页面的清空操作改用 ConfirmDialog，提升操作安全性（spec 无变化）
- `admin-actor-publisher-management`: Actors/Publishers 筛选改用 FilterPanel，排序改为服务端

## Impact

### 前端代码
- **修改文件**：
  - `apps/dashboard/src/views/Comics.vue` — 主体改动（FilterPanel、排序、批量操作、章节批删）
  - `apps/dashboard/src/views/Actors.vue` — FilterPanel 替换、ConfirmDialog、服务端排序
  - `apps/dashboard/src/views/Publishers.vue` — 同 Actors.vue
  - `apps/dashboard/src/views/Crawlers.vue` — ConfirmDialog 替换
  - `apps/dashboard/src/views/AuditLogs.vue` — diff 视图美化

### 后端 API
- 无新增 API，所有接口均已存在
- Comics 列表接口 `GET /admin/comics` 需支持 `sortBy` / `sortOrder` / `crawlStatus` 查询参数（**SHALL** 验证 handler 是否已接受这些参数）

### 依赖
- 无新增外部依赖
- 完全复用 `@starye/ui` 中已有的共享组件

### 非目标
- 不涉及 Actors/Publishers 的 merge dialog 重写（搜索框选目标演员，留待后续 Change）
- 不涉及任何数据库 schema 变更
- 不涉及移动端专项适配
