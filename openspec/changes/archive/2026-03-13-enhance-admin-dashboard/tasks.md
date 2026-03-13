# 管理后台增强 - 实施任务清单

## 1. 数据库 Schema 扩展

- [x] 1.1 在 `packages/db/src/schema.ts` 中为 `movies` 表添加管理字段（`metadataLocked`, `sortOrder`, `crawlStatus`, `lastCrawledAt`, `totalPlayers`, `crawledPlayers`）
- [x] 1.2 创建 `auditLogs` 表定义（包含所有必需字段和索引）
- [x] 1.3 为 `movies` 表添加必要的索引（`code`, `releaseDate`, `createdAt`, `sortOrder`, `crawlStatus`）
- [x] 1.4 为 `auditLogs` 表添加索引（`userId`, `resourceType`, `createdAt`，组合索引 `(resourceType, resourceId)`）
- [x] 1.5 生成 Drizzle 数据库迁移文件（`pnpm --filter @starye/db generate`）
- [x] 1.6 创建数据迁移脚本，为现有 movies 记录设置默认值
- [x] 1.7 创建数据迁移脚本，计算并填充 `totalPlayers` 字段（COUNT players）
- [x] 1.8 在本地开发环境应用迁移并验证
- [x] 1.9 更新 `packages/db/README.md` 说明新增字段的用途

## 2. 权限中间件增强

- [x] 2.1 在 `apps/api/src/middleware/` 创建 `resource-guard.ts`，实现 `requireResource(resource: 'comic' | 'movie' | 'global')` 中间件
- [x] 2.2 更新 `apps/api/src/middleware/service-auth.ts`，支持资源级权限检查
- [x] 2.3 创建权限检查工具函数 `hasPermission(user, resource, action)` 在 `apps/api/src/lib/permissions.ts`
- [x] 2.4 定义权限矩阵常量 `PERMISSION_MATRIX` 在 `permissions.ts`
- [x] 2.5 为权限中间件添加单元测试（覆盖所有角色和资源组合）

## 3. 审计日志系统

- [x] 3.1 在 `apps/api/src/middleware/` 创建 `audit-logger.ts` 中间件
- [x] 3.2 实现 `createAuditLog()` 工具函数，记录操作到数据库
- [x] 3.3 实现 `captureResourceState()` 函数，在操作前捕获资源状态
- [x] 3.4 实现变更计算逻辑（before/after diff）
- [x] 3.5 为敏感字段添加脱敏逻辑（密码、token 等）
- [x] 3.6 将审计日志中间件应用到所有 admin API 路由
- [x] 3.7 测试审计日志记录（CREATE, UPDATE, DELETE, BULK 操作）

## 4. 电影管理 API（优先级 [1]）

- [x] 4.1 在 `apps/api/src/routes/` 创建或扩展 `admin-movies.ts` 路由文件
- [x] 4.2 实现 `GET /api/admin/movies` - 列表查询（支持分页、筛选、排序）
- [x] 4.3 实现筛选参数解析和验证（zod schema）
- [x] 4.4 实现动态 SQL WHERE 子句构建函数 `buildMovieFilters()`
- [x] 4.5 实现动态排序构建函数 `buildOrderBy()`
- [x] 4.6 实现 `GET /api/admin/movies/:id` - 电影详情查询
- [x] 4.7 实现 `PATCH /api/admin/movies/:id` - 更新电影元数据
- [x] 4.8 实现 `POST /api/admin/movies/:id/cover` - 上传封面到 R2
- [x] 4.9 实现 `DELETE /api/admin/movies/:id` - 删除电影（级联删除 players）
- [x] 4.10 为所有路由添加 `requireResource('movie')` 中间件
- [x] 4.11 测试 API 端点（使用 admin, movie_admin, comic_admin 角色）

## 5. 批量操作 API（优先级 [4]）

- [x] 5.1 实现 `POST /api/admin/movies/bulk-operation` - 批量操作端点
- [x] 5.2 支持操作类型：`update_r18`, `lock_metadata`, `unlock_metadata`, `update_sort_order`, `delete`
- [x] 5.3 实现分批执行逻辑（每批 20 条，避免超时）
- [x] 5.4 实现批量操作结果汇总（success/failed 统计）
- [x] 5.5 为批量操作添加数量限制（最多 100 项）
- [x] 5.6 实现 `POST /api/admin/comics/bulk-operation` - 漫画批量操作
- [x] 5.7 为批量删除章节实现 `POST /api/admin/comics/:id/chapters/bulk-delete`
- [x] 5.8 测试批量操作的事务性和错误处理

## 6. 爬虫监控 API（优先级 [2]）

- [x] 6.1 在 `apps/api/src/routes/` 创建 `admin-crawlers.ts`
- [x] 6.2 实现 `GET /api/admin/crawlers/stats` - 爬虫统计（按角色过滤）
- [x] 6.3 实现统计计算：total, pending, partial, complete counts
- [x] 6.4 实现 `GET /api/admin/crawlers/failed-tasks` - 失败任务列表
- [x] 6.5 读取 `.crawler-failed-tasks.json` 和 `.javbus-failed-tasks.json` 文件
- [x] 6.6 按错误类型分组失败任务
- [x] 6.7 根据用户角色过滤失败任务（comic vs movie）
- [x] 6.8 实现 `POST /api/admin/crawlers/recover` - 返回恢复指令
- [x] 6.9 实现 `POST /api/admin/crawlers/clear-failed` - 清空失败任务记录
- [x] 6.10 测试统计准确性和权限隔离

## 7. 播放源管理 API（优先级 [5]）

- [x] 7.1 实现 `GET /api/admin/movies/:id/players` - 查询电影的所有播放源
- [x] 7.2 实现 `POST /api/admin/movies/:id/players` - 手动添加播放源
- [x] 7.3 实现播放源 URL 去重检查
- [x] 7.4 实现 `PATCH /api/admin/players/:id` - 编辑播放源
- [x] 7.5 实现 `DELETE /api/admin/players/:id` - 删除播放源（更新 totalPlayers）
- [x] 7.6 实现 `POST /api/admin/movies/:id/players/batch-import` - 批量导入播放源（JSON）
- [x] 7.7 验证导入数据格式和错误处理
- [x] 7.8 测试播放源 CRUD 操作

## 8. 演员/厂商管理 API（优先级 [6]）

- [x] 8.1 在 `apps/api/src/routes/` 创建 `admin-actors.ts`
- [x] 8.2 实现 `GET /api/admin/actors` - 演员列表（按作品数排序，支持搜索）
- [x] 8.3 实现 `GET /api/admin/actors/:id` - 演员详情（包含关联电影列表）
- [x] 8.4 实现 `PATCH /api/admin/actors/:id` - 编辑演员信息（bio, social links）
- [x] 8.5 实现 `POST /api/admin/actors/:id/avatar` - 上传演员头像到 R2
- [x] 8.6 实现 `POST /api/admin/actors/merge` - 合并重复演员
- [x] 8.7 在 merge 逻辑中更新所有关联电影的 actors 数组
- [x] 8.8 在 `apps/api/src/routes/` 创建 `admin-publishers.ts`
- [x] 8.9 实现 `GET /api/admin/publishers` - 厂商列表
- [x] 8.10 实现 `GET /api/admin/publishers/:id` - 厂商详情
- [x] 8.11 实现 `PATCH /api/admin/publishers/:id` - 编辑厂商信息
- [x] 8.12 实现 `POST /api/admin/publishers/:id/logo` - 上传厂商 logo
- [x] 8.13 实现 `POST /api/admin/publishers/merge` - 合并重复厂商
- [x] 8.14 为所有演员/厂商路由添加 `requireResource('movie')` 中间件
- [x] 8.15 测试演员和厂商的 CRUD 和合并功能

## 9. 审计日志查询 API（优先级 [7]）

- [x] 9.1 在 `apps/api/src/routes/` 创建 `admin-audit-logs.ts`
- [x] 9.2 实现 `GET /api/admin/audit-logs` - 查询审计日志（支持筛选）
- [x] 9.3 支持筛选参数：userId, resourceType, action, dateRange
- [x] 9.4 实现分页（默认 50 条/页）
- [x] 9.5 实现 `GET /api/admin/audit-logs/export` - 导出日志为 CSV/JSON
- [x] 9.6 添加速率限制（最多 10 次/分钟）
- [x] 9.7 仅允许 `admin` 角色访问审计日志 API
- [x] 9.8 测试日志查询性能和权限

## 10. Dashboard 可复用组件（优先级 [3]）

- [x] 10.1 在 `apps/dashboard/src/components/` 创建 `DataTable.vue` 通用表格组件
- [x] 10.2 DataTable 支持：多选、排序、分页、加载状态
- [x] 10.3 创建 `FilterPanel.vue` 筛选器面板组件
- [x] 10.4 FilterPanel 支持：文本输入、下拉选择、多选框、日期范围选择器
- [x] 10.5 创建 `BatchOperationMenu.vue` 批量操作菜单组件
- [x] 10.6 创建 `ConfirmDialog.vue` 确认对话框组件（支持文本输入确认）
- [x] 10.7 创建 `StatusBadge.vue` 状态徽章组件（pending/partial/complete）
- [x] 10.8 创建 `ProgressIndicator.vue` 进度指示器组件（用于 partial 状态）
- [x] 10.9 创建 `ImageUpload.vue` 图片上传组件（用于封面、头像）
- [x] 10.10 为所有组件添加 TypeScript 类型定义和 props 验证

## 11. Dashboard Composables（优先级 [3]）

- [x] 11.1 在 `apps/dashboard/src/composables/` 创建 `useFilters.ts`
- [x] 11.2 实现筛选器状态管理和 URL 同步
- [x] 11.3 创建 `usePagination.ts` 实现分页逻辑
- [x] 11.4 创建 `useBatchSelect.ts` 实现批量选择逻辑
- [x] 11.5 创建 `useResourceGuard.ts` 实现前端权限检查
- [x] 11.6 创建 `useSorting.ts` 实现排序状态管理
- [x] 11.7 测试所有 composables 的状态同步和 URL 持久化

## 12. 电影管理 UI（优先级 [1]）

- [x] 12.1 在 `apps/dashboard/src/views/` 创建 `Movies.vue` 页面
- [x] 12.2 实现电影列表展示（使用 DataTable 组件）
- [x] 12.3 集成筛选器（R18, crawlStatus, actor, publisher, genre, dateRange）
- [x] 12.4 集成排序（releaseDate, updatedAt, sortOrder）
- [x] 12.5 集成批量选择和批量操作菜单
- [x] 12.6 实现电影详情对话框或页面
- [x] 12.7 实现元数据编辑表单（title, description, isR18, metadataLocked, sortOrder）
- [x] 12.8 实现封面上传功能（使用 ImageUpload 组件）
- [x] 12.9 实现删除确认对话框
- [x] 12.10 实现批量操作确认对话框（带预览和 CONFIRM 输入）
- [x] 12.11 添加加载状态和错误处理
- [x] 12.12 添加成功/失败提示（toast notifications）
- [x] 12.13 测试电影管理的所有 CRUD 操作

## 13. 漫画管理 UI 增强（优先级 [3]）

- [x] 13.1 更新 `apps/dashboard/src/views/Comics.vue` 以使用新的 DataTable 组件
- [x] 13.2 添加筛选器（author, region, status, crawlStatus）
- [x] 13.3 添加排序选项（updatedAt, sortOrder）
- [x] 13.4 添加批量选择和批量操作功能
- [x] 13.5 实现批量操作（update R18, lock metadata, delete）
- [x] 13.6 为章节列表添加批量选择和批量删除功能
- [x] 13.7 添加爬取状态可视化（badge 和 progress indicator）
- [x] 13.8 测试增强后的漫画管理功能

## 14. 爬虫监控 UI（优先级 [2]）

- [x] 14.1 在 `apps/dashboard/src/views/` 创建 `Crawlers.vue` 页面
- [x] 14.2 实现统计卡片展示（漫画和电影爬虫的 total, pending, partial, complete）
- [x] 14.3 根据用户角色显示/隐藏统计卡片（comic_admin 只看漫画，movie_admin 只看电影）
- [x] 14.4 实现失败任务列表展示（按错误类型分组）
- [x] 14.5 实现筛选器（按错误类型、资源类型）
- [x] 14.6 添加"导出失败任务"按钮（下载 JSON）
- [x] 14.7 添加"清空失败任务"按钮（带确认）
- [x] 14.8 显示恢复任务指令（GitHub Actions 命令）
- [x] 14.9 实现自动刷新（每 30 秒）和手动刷新按钮
- [x] 14.10 测试爬虫监控页面的数据展示和权限隔离

## 15. 播放源管理 UI（优先级 [5]）

- [x] 15.1 在电影详情页中添加"播放源"标签页
- [x] 15.2 实现播放源列表展示（source, playerName, URL）
- [x] 15.3 添加"添加播放源"按钮和表单
- [x] 15.4 实现播放源编辑功能（内联编辑或对话框）
- [x] 15.5 实现播放源删除（带确认）
- [x] 15.6 添加"测试"按钮（在新标签页打开播放源 URL）
- [x] 15.7 添加批量导入功能（上传 JSON 文件）
- [x] 15.8 显示导入结果（成功/失败/重复统计）
- [x] 15.9 测试播放源管理的所有操作

## 16. 演员/厂商管理 UI（优先级 [6]）

- [x] 16.1 在 `apps/dashboard/src/views/` 创建 `Actors.vue` 页面
- [x] 16.2 实现演员列表（按作品数排序，显示 name, avatar, movieCount）
- [x] 16.3 实现搜索功能
- [x] 16.4 实现演员详情对话框或页面
- [x] 16.5 实现编辑表单（name, bio, social links）
- [x] 16.6 实现头像上传
- [x] 16.7 显示演员的关联电影列表（带链接）
- [x] 16.8 实现合并功能 UI（选择两个演员 → 确认合并 → 显示影响数量）
- [x] 16.9 在 `apps/dashboard/src/views/` 创建 `Publishers.vue` 页面
- [x] 16.10 实现厂商列表、搜索、详情、编辑功能（类似演员）
- [x] 16.11 实现厂商合并功能
- [x] 16.12 为演员和厂商页面添加权限守卫（仅 admin 和 movie_admin）
- [x] 16.13 测试演员和厂商管理的所有功能

## 17. 审计日志 UI（优先级 [7]）

- [x] 17.1 在 `apps/dashboard/src/views/` 创建 `AuditLogs.vue` 页面
- [x] 17.2 实现日志时间线展示（使用 `AuditTimeline.vue` 组件）
- [x] 17.3 实现筛选器（userId, resourceType, action, dateRange）
- [x] 17.4 实现日志详情展开（显示 changes diff）
- [x] 17.5 实现变更详情格式化（before/after 对比）
- [x] 17.6 添加"导出日志"按钮（CSV 或 JSON）
- [x] 17.7 实现分页（每页 50 条）
- [x] 17.8 添加权限守卫（仅 admin 可访问）
- [x] 17.9 测试日志查询和展示

## 18. 路由和权限配置

- [x] 18.1 在 `apps/dashboard/src/router/index.ts` 添加新路由：`/movies`, `/crawlers`, `/actors`, `/publishers`, `/audit-logs`
- [x] 18.2 为每个路由配置 `meta.requiredRoles`
- [x] 18.3 更新 `router.beforeEach` 守卫，实现资源级权限检查
- [x] 18.4 实现 `/unauthorized` 错误页面
- [x] 18.5 在侧边栏导航中根据角色动态显示菜单项
- [x] 18.6 测试路由守卫（尝试不同角色访问各页面）

## 19. API 客户端扩展

- [x] 19.1 在 `apps/dashboard/src/lib/api.ts` 添加电影管理相关 API 方法
- [x] 19.2 添加批量操作 API 方法
- [x] 19.3 添加爬虫监控 API 方法
- [x] 19.4 添加播放源管理 API 方法
- [x] 19.5 添加演员/厂商管理 API 方法
- [x] 19.6 添加审计日志 API 方法
- [x] 19.7 为所有 API 方法添加 TypeScript 类型定义
- [x] 19.8 实现统一的错误处理和 toast 提示

## 20. 电影爬虫适配

- [x] 20.1 更新 `packages/crawler/src/crawlers/javbus.ts` 以使用新的 `movies` schema 字段
- [x] 20.2 在创建电影时设置 `crawlStatus`, `lastCrawledAt`, `totalPlayers`, `crawledPlayers`
- [x] 20.3 实现 `metadataLocked` 检查逻辑（跳过元数据更新但继续添加播放源）
- [x] 20.4 更新电影爬虫的进度计算（基于 `crawledPlayers/totalPlayers`）
- [x] 20.5 测试爬虫对新字段的正确处理

## 21. 漫画爬虫适配

- [x] 21.1 更新 `packages/crawler/src/crawlers/comic-crawler.ts` 以正确处理 `metadataLocked` 字段
- [x] 21.2 确保爬虫跳过已锁定的漫画元数据更新
- [x] 21.3 测试元数据锁定功能

## 22. 文档和部署

- [x] 22.1 更新 `apps/dashboard/README.md` 说明新增的管理功能
- [x] 22.2 创建权限矩阵文档（已在 design.md 中详细说明）
- [x] 22.3 编写数据库迁移运行指南（已创建 MIGRATION.md）
- [x] 22.4 更新 `.env.example` 添加审计日志相关配置（如需要）
- [x] 22.5 在开发环境运行完整测试流程
- [x] 22.6 准备生产环境部署清单（迁移步骤、配置更新）

## 23. 集成测试与验证

- [x] 23.1 测试 admin 角色的完整访问权限
- [x] 23.2 测试 comic_admin 的隔离（只能访问漫画，不能访问电影）
- [x] 23.3 测试 movie_admin 的隔离（只能访问电影，不能访问漫画）
- [x] 23.4 测试批量操作的确认和错误处理
- [x] 23.5 测试审计日志的完整性（所有操作都被记录）
- [x] 23.6 测试爬虫监控的数据准确性
- [x] 23.7 测试演员/厂商合并功能的数据一致性
- [x] 23.8 测试元数据锁定功能（手动编辑 → 锁定 → 爬虫不覆盖）
- [x] 23.9 性能测试：大数据量下的筛选和排序（模拟 10000+ 电影）
- [x] 23.10 UI 测试：所有页面的响应式布局和交互

## 24. Linter 和代码质量

- [x] 24.1 运行 ESLint 检查所有修改的文件
- [x] 24.2 修复所有 linter 错误和警告
- [x] 24.3 确保所有 TypeScript 类型检查通过
- [x] 24.4 移除所有调试用的 console.log（保留必要的 warn 和 error）
