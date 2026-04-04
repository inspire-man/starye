## Context

Dashboard 管理端各页面的实现分化为三代风格。`Movies.vue` 是当前金标准，已完整采用 `@starye/ui` 共享组件体系；其他页面则停留在不同程度的旧实现。

**现有共享组件清单（`@starye/ui`）：**
- `FilterPanel` — 统一筛选面板，接受 `fields` 配置
- `DataTable` — 带列定义、排序、行点击的通用表格
- `BatchOperationMenu` — 批量操作下拉菜单，接受 `operations` 配置
- `ConfirmDialog` — 确认对话框，替代原生 `confirm()`
- `useBatchSelect` — 管理批量选中状态的 composable
- `usePagination` / `useFilters` / `useSorting` — 状态管理 composables
- `SkeletonTable` / `SkeletonCard` / `SkeletonForm` — 骨架屏组件

**后端 API 现状确认：**
- `POST /admin/comics/bulk-operation` — 已存在，接受 `BatchOperationComicsSchema`
- `POST /admin/comics/:comicId/chapters/bulk-delete` — 已存在（`api.ts` 中有 `bulkDeleteChapters`）
- `GET /admin/comics` — 现有 handler 不接受 `sortBy`/`sortOrder`/`crawlStatus` 参数，**需要补充**

## Goals / Non-Goals

**Goals:**
- Comics.vue 达到与 Movies.vue 相同的功能和视觉一致性
- Actors.vue / Publishers.vue 筛选面板统一为 FilterPanel，排序改为服务端
- Crawlers.vue / Actors.vue 的原生 `confirm()` 替换为 ConfirmDialog
- Comics API handler 补充 `sortBy`、`sortOrder`、`crawlStatus` 查询参数支持
- AuditLogs.vue `changes` 字段展示改为 diff 视图

**Non-Goals:**
- Actors/Publishers merge dialog 重写（搜索框选目标，留后续 Change）
- 数据库 schema 变更
- 单元测试补充（现有视图层无测试，保持现状）
- 移动端专项优化

## Decisions

### 决策 1：Comics API handler 扩展范围

**问题**：`getComicList` handler 目前只有 `page`/`limit`，不支持筛选和排序。

**决策**：直接修改 `apps/api/src/routes/admin/comics/handlers.ts` 的 `getComicList`，新增以下查询参数：
- `search` — 标题/作者模糊搜索
- `isR18` — R18 筛选
- `status` — 连载状态筛选
- `region` — 地区筛选
- `crawlStatus` — 爬取状态筛选（**新增**）
- `sortBy` — 排序字段（`updatedAt` | `createdAt` | `title` | `sortOrder`）
- `sortOrder` — `asc` | `desc`

**理由**：现有 Comics.vue 已在前端传递这些参数，但 handler 丢弃了 `crawlStatus` 和排序参数，导致这两个能力完全失效。统一在 handler 侧处理是最清晰的修复点。

**备选方案**：客户端排序（filteredActors 的模式）— 否决，数据量大时性能差且与 Movies 模式不一致。

### 决策 2：Comics.vue 批量操作模式

**决策**：完全复用 Movies.vue 的模式：
```
useBatchSelect(comics) → selected, toggleItem, toggleAll, clearSelection
BatchOperationMenu(:operations, :selected-count, @execute)
ConfirmDialog(:open, ...) → executeBatchOperation()
api.admin.bulkOperationComics(ids, operation)
```

**批量操作列表：**
- `update_r18` — 批量设为 R18
- `lock_metadata` — 批量锁定元数据
- `unlock_metadata` — 批量解锁元数据
- `delete` — 批量删除（使用 Progress Toast，逐条执行，与 Movies 一致）

**理由**：直接复用已验证的模式，降低引入 bug 的概率，保持视觉和行为一致。

### 决策 3：Comics.vue 布局方案

**问题**：Comics 当前是卡片网格布局（`grid-cols-3`），Movies 是 DataTable 布局。批量选择在网格布局下需要单独的复选框层。

**决策**：保留卡片网格布局（与用户体验相符），在每张卡片左上角叠加复选框（绝对定位）。激活批量模式时卡片缩放回缩显示选中效果。不改为 DataTable。

**理由**：卡片布局更适合展示漫画封面，强行改为表格会损失封面视觉体验。Movies 是番号列表，表格更合适。

### 决策 4：Actors/Publishers 排序改为服务端

**决策**：去掉 `filteredActors`/`filteredPublishers` 的 computed 本地排序，改为在 `loadActors()`/`loadPublishers()` 的 API 请求中传入 `sortBy`/`sortOrder` 参数。

**影响**：需要确认 `GET /admin/actors` 和 `GET /admin/publishers` handler 是否已支持排序参数（从已有的 `useSorting` 导入来看，API 端可能已支持，需验证）。

### 决策 5：AuditLogs diff 视图

**决策**：不引入第三方 diff 库。`changes` 字段结构为 `{ before: {...}, after: {...} }`，用 Vue 模板循环 `Object.keys(after)` 渲染 `旧值 → 新值` 行列表。对修改的字段加高亮色（黄色背景），对新增字段加绿色背景，对删除字段加红色背景。

**理由**：数据结构简单，自实现代价低，避免引入依赖。

## Risks / Trade-offs

- **Comics API handler 扩展** → 需要回归测试现有筛选行为（search/isR18/status/region 在前端已传，但 handler 是否有对应接收逻辑不确定，需要阅读 handler 代码确认）
- **网格布局复选框** → 移动端小屏幕复选框点击区域较小，需确保 touch target 足够大（≥ 44px）
- **批量删除无 Undo** → 与 Movies 一致，批量删除不可撤销，通过 ConfirmDialog + "CONFIRM" 文字输入防误操作
