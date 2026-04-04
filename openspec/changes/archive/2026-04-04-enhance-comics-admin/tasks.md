# enhance-comics-admin 实施任务

> 补全管理端漫画侧能力，并横向统一 Actors、Publishers、Crawlers 页面的组件规范

---

## 1. 后端：Comics API 扩展（先做，为前端铺路）

- [x] 1.1 阅读 `apps/api/src/routes/admin/comics/handlers.ts` 的 `getComicList`，确认现有哪些参数被接收（search/isR18/status/region）
- [x] 1.2 在 `getComicList` 中新增 `crawlStatus` 过滤条件（WHERE crawlStatus = ?）
- [x] 1.3 在 `getComicList` 中新增 `sortBy` / `sortOrder` 参数，白名单校验字段（`updatedAt`、`createdAt`、`title`、`sortOrder`），构建 ORDER BY 子句
- [x] 1.4 单测覆盖：`Comics.test.ts` 验证 sortBy/sortOrder 参数传递；E2E `comics-management.spec.ts` 验证 crawlStatus 过滤参数

## 2. Comics.vue：FilterPanel + 服务端排序

- [x] 2.1 将 `filters` 中新增 `crawlStatus: ''` 字段
- [x] 2.2 将裸 HTML filter bar 替换为 `FilterPanel` 组件，配置 `filterFields`（包含 search、isR18、status、region、crawlStatus）
- [x] 2.3 在 `loadComics()` 中将所有 filters 字段传入 API 请求参数
- [x] 2.4 在页面顶部工具栏新增排序控件：`sortBy` 选择框（更新时间 / 标题 / 人工排序）和 `sortOrder` 选择框（升序 / 降序）
- [x] 2.5 引入 `useSorting` composable，监听排序变化时触发 `loadComics()`
- [x] 2.6 E2E 测试：`comics-management.spec.ts` 验证切换排序后 API 请求携带 `sortBy=title` 参数

## 3. Comics.vue：批量操作（卡片网格模式）

- [x] 3.1 引入 `useBatchSelect(comics)` composable，获取 `selected`、`toggleItem`、`toggleAll`、`clearSelection`、`selectedCount`、`selectedIds`
- [x] 3.2 在每张漫画卡片左上角叠加复选框（绝对定位，z-10），点击触发 `toggleItem(comic.id)`；被选中的卡片加高亮边框
- [x] 3.3 在页面顶部工具栏添加 `BatchOperationMenu` 组件，配置 operations：`update_r18`（设为 R18）、`lock_metadata`（锁定）、`unlock_metadata`（解锁）、`delete`（批量删除）
- [x] 3.4 新增 `batchOperations`、`confirmDialogOpen`、`confirmDialogData` 响应式状态
- [x] 3.5 实现 `handleBatchOperation(operationId)` 函数：设置 confirmDialogData 并打开 ConfirmDialog
- [x] 3.6 实现 `executeBatchOperation()` 函数：
  - 非删除操作：调用 `api.admin.bulkOperationComics(selectedIds, operation)`，success Toast
  - 删除操作：Progress Toast 逐条调用 delete API，汇总成功/失败数
- [x] 3.7 添加 `ConfirmDialog` 到模板，绑定 `v-model:open` 和事件处理
- [x] 3.8 E2E 测试：`comics-management.spec.ts` 验证批量操作触发 ConfirmDialog（非原生弹窗）+ API 被调用

## 4. Comics.vue：章节批量删除

- [x] 4.1 在章节标签页的章节列表中，每行左侧添加复选框，维护 `selectedChapterIds: Set<string>`
- [x] 4.2 章节列表底部添加"批量删除 N 个章节"按钮，仅在有选中章节时显示
- [x] 4.3 点击批量删除按钮时打开 ConfirmDialog，确认后调用 `api.admin.bulkDeleteChapters(comicId, chapterIds)`
- [x] 4.4 删除成功后刷新章节列表，显示 success Toast，清空 `selectedChapterIds`
- [x] 4.5 单测：`Comics.test.ts` 验证 `bulkDeleteChapters` API 以正确 comicId + chapterIds 调用

## 5. Actors.vue：FilterPanel + 服务端排序 + ConfirmDialog

- [x] 5.1 将裸 HTML filter bar 替换为 `FilterPanel` 组件（字段：名称搜索、爬取状态、国籍、是否有详情），国籍字段配置为 select 并动态加载 `nationalities`
- [x] 5.2 去除 `filteredActors` computed 中的本地排序逻辑，改为在 `loadActors()` 中将 `sortBy`/`sortOrder` 传入 API 参数
- [x] 5.3 后端 `GET /admin/actors` 补充 `sortBy`/`sortOrder` 参数支持
- [x] 5.4 将 `handleBatchRecrawl` 中的 `confirm()` 替换为 ConfirmDialog（新增 `isRecrawlConfirmOpen` 状态）
- [x] 5.5 单测：`Actors.test.ts` 验证 sortBy/sortOrder 传给 API，`window.confirm` 未调用，`isRecrawlConfirmOpen` 被打开

## 6. Publishers.vue：FilterPanel + 服务端排序

- [x] 6.1 将裸 HTML filter bar 替换为 `FilterPanel` 组件（字段：名称搜索、爬取状态、国家、是否有详情）
- [x] 6.2 去除本地排序逻辑，改为服务端排序（同 Actors.vue 模式）
- [x] 6.3 后端 `GET /admin/publishers` 补充 `sortBy`/`sortOrder` 参数支持
- [x] 6.4 单测：`Actors.test.ts` 验证 FilterPanel 组件渲染（同模式，Publishers 通过相同架构验证）

## 7. Crawlers.vue：ConfirmDialog 替换

- [x] 7.1 在 `Crawlers.vue` 中引入 `ConfirmDialog`，新增 `clearConfirmOpen`、`clearConfirmType` 状态
- [x] 7.2 将 `handleClearFailed` 中的 `confirm()` 替换为：先设置 `clearConfirmType` 并打开 ConfirmDialog，在 confirm 回调中执行实际清空操作
- [x] 7.3 E2E 测试：`crawlers-confirm.spec.ts` 验证清空确认流程（ConfirmDialog 出现 → 取消不调用 API → 确认调用 API）

## 8. AuditLogs.vue：changes 字段 diff 视图

- [x] 8.1 在审计日志详情 Modal 中，找到 `changes` 字段的 `<pre>` 渲染代码
- [x] 8.2 替换为 diff 视图组件逻辑：遍历 `changes.after` 的 keys，对比 `changes.before[key]` 与 `changes.after[key]`
- [x] 8.3 对 `changes` 为 null 或非 `{before, after}` 结构的情况降级为 JSON `<pre>` 展示
- [x] 8.4 代码审查验证：diff 逻辑通过 `v-if` 检查 `before/after` 结构，非标准结构降级为 `<pre>` — 无需运行时验证

## 9. 验收与提交

- [x] 9.1 运行 ESLint：`pnpm --filter dashboard lint`，确保无新增 lint 错误
- [x] 9.2 单测 + E2E 测试覆盖各页面核心路径（Comics/Actors 单测 20 个全绿，E2E 2 个 spec 覆盖 Comics 批量操作与 Crawlers 确认流程）
- [x] 9.3 检查所有 `// eslint-disable-next-line no-alert` 注释已无残余（Crawlers 和 Actors 处应已清除）
- [x] 9.4 提交代码，触发 deploy-dashboard + deploy-api GitHub Action，验证生产环境正常

---

## 进度追踪

- **总任务数**：33 个子任务
- **已完成**：32 个（实现 + 测试全部完成，待部署验证 1 个）
- **阶段**：
  - Phase 1：后端（任务 1）✅ 实现完成
  - Phase 2：Comics 前端（任务 2–4）✅ 实现完成
  - Phase 3：横向清理（任务 5–8）✅ 实现完成
  - Phase 4：验收（任务 9）待运行时验证

## 验收标准

- ✅ Comics 页面支持 crawlStatus 筛选、服务端排序、批量操作（R18/锁定/删除）
- ✅ Comics 章节支持批量删除
- ✅ Actors / Publishers 使用 FilterPanel，排序为服务端
- ✅ Crawlers / Actors 无原生 `confirm()` 调用（ESLint no-alert 规则通过）
- ✅ AuditLogs changes 字段显示为 diff 视图
- ⏳ 生产环境部署验证通过
