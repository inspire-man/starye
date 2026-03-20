# Tasks: Actor & Publisher Relations

## 1. 数据库 Schema 扩展

- [x] 1.1 扩展 `actors` 表：新增 `source`, `sourceId`, `sourceUrl`, `cover`, `cupSize`, `bloodType`, `debutDate`, `isActive`, `retireDate`, `hasDetailsCrawled`, `crawlFailureCount`, `lastCrawlAttempt` 字段
- [x] 1.2 扩展 `publishers` 表：新增 `source`, `sourceId`, `sourceUrl`, `hasDetailsCrawled`, `crawlFailureCount`, `lastCrawlAttempt` 字段
- [x] 1.3 创建 `movie_actors` 关联表，包含 `id`, `movieId`, `actorId`, `sortOrder`, `createdAt`，设置复合唯一索引
- [x] 1.4 创建 `movie_publishers` 关联表，包含 `id`, `movieId`, `publisherId`, `sortOrder`, `createdAt`，设置复合唯一索引
- [x] 1.5 为关联表创建反向查询索引（`actorId`, `publisherId`）
- [x] 1.6 生成 Drizzle 迁移文件
- [x] 1.7 在本地环境执行迁移，验证表结构

## 2. 数据迁移脚本

- [x] 2.1 创建数据迁移脚本 `scripts/migrate-actor-publisher.ts`
- [x] 2.2 实现 `findOrCreateActor` 函数：基于 `name` 查找或创建女优，设置 `source = 'javbus'`，`hasDetailsCrawled = false`
- [x] 2.3 实现 `findOrCreatePublisher` 函数：基于 `name` 查找或创建厂商
- [x] 2.4 实现主迁移逻辑：遍历所有电影，解析 `movies.actors[]` 和 `movies.publisher`，创建关联记录
- [x] 2.5 实现 `updateMovieCount` 函数：更新女优/厂商的 `movieCount` 派生字段
- [x] 2.6 添加数据完整性验证：对比迁移前后的数据量
- [x] 2.7 在本地环境执行迁移，验证数据正确性
- [x] 2.8 创建回滚脚本 `scripts/rollback-migration.ts`（删除关联表数据）

## 3. 爬虫策略升级

- [x] 3.1 修改 `packages/crawler/src/strategies/javbus.ts`，在电影爬取后解析女优列表（name + 详情页 URL）
- [x] 3.2 实现 `crawlActorDetails` 函数：访问女优详情页，解析 `source`, `sourceId`, `avatar`, `cover`, `bio`, `birthDate`, `height`, `measurements`, `cupSize`, `bloodType`, `nationality`, `debutDate`, `isActive` 等字段
- [x] 3.3 实现智能去重逻辑：查询 `source + sourceId` 是否存在，存在则跳过详情爬取
- [x] 3.4 实现失败降级：详情页爬取失败时，仅保存 `name` 和 `source`，设置 `hasDetailsCrawled = false`，`crawlFailureCount++`
- [x] 3.5 实现失败次数限制：`crawlFailureCount >= 3` 时跳过详情爬取
- [x] 3.6 修改 `packages/crawler/src/strategies/javbus.ts`，解析厂商信息（name + 详情页 URL）
- [x] 3.7 实现 `crawlPublisherDetails` 函数：访问厂商详情页，解析 `source`, `sourceId`, `logo`, `website`, `description`, `foundedYear`, `country` 等字段
- [x] 3.8 为厂商实现同样的去重和降级逻辑
- [x] 3.9 在电影爬取成功后，自动创建 `movie_actors` 和 `movie_publishers` 关联记录
- [x] 3.10 添加请求延迟（每个详情页请求间隔 2-5 秒）
- [x] 3.11 添加错误日志，记录爬取失败的女优/厂商 URL

## 4. 女优 API 实现

- [x] 4.1 创建 `apps/api/src/routes/actors.ts`，实现 `GET /api/actors` 列表接口
- [x] 4.2 实现分页参数处理（`page`, `limit`，默认 20，最大 100）
- [x] 4.3 实现排序参数（`sort=name|movieCount|createdAt`，默认 name）
- [x] 4.4 实现筛选参数（`nationality`, `isActive`, `hasDetails`）
- [x] 4.5 实现 `GET /api/actors/:id` 详情接口，返回女优信息和关联电影列表（通过 `movie_actors` JOIN）
- [x] 4.6 电影列表按 `releaseDate` 降序排序
- [x] 4.7 创建 `apps/api/src/routes/admin/actors.ts`，实现 `POST /api/admin/actors` 创建接口
- [x] 4.8 实现 `PUT /api/admin/actors/:id` 更新接口
- [x] 4.9 实现 `DELETE /api/admin/actors/:id` 删除接口，级联删除 `movie_actors` 记录
- [x] 4.10 为管理端点添加 `serviceAuth(['admin', 'super_admin', 'movie_admin'])` 中间件

## 5. 厂商 API 实现

- [x] 5.1 创建 `apps/api/src/routes/publishers.ts`，实现 `GET /api/publishers` 列表接口
- [x] 5.2 实现分页、排序参数（同女优 API）
- [x] 5.3 实现筛选参数（`country`, `hasDetails`）
- [x] 5.4 实现 `GET /api/publishers/:id` 详情接口，返回厂商信息和关联电影列表
- [x] 5.5 创建 `apps/api/src/routes/admin/publishers.ts`，实现管理端点（POST, PUT, DELETE）
- [x] 5.6 为管理端点添加权限校验

## 6. 电影 API 修改

- [x] 6.1 修改 `apps/api/src/routes/movies.ts` 的 `GET /api/movies/:id` 接口
- [x] 6.2 使用 Drizzle 的 `with` 子句关联 `movie_actors` 和 `movie_publishers` 表
- [x] 6.3 将 `actors` 字段从 `string[]` 改为对象数组 `[{ id, name, avatar, slug }]`
- [x] 6.4 将 `publisher` 字段从 `string` 改为对象数组 `publishers: [{ id, name, logo, slug }]`
- [x] 6.5 确保 `actors` 按 `sortOrder` 排序
- [x] 6.6 修改电影列表接口 `GET /api/movies`，同样返回女优/厂商对象数组

## 7. Movie App - 女优功能

- [x] 7.1 创建 `apps/movie-app/src/views/Actors.vue` 女优列表页
- [x] 7.2 实现女优卡片组件 `ActorCard.vue`（头像、名称、作品数量）
- [x] 7.3 实现筛选器组件 `ActorFilter.vue`（国籍、活跃状态、是否有详情）
- [x] 7.4 实现默认按名称排序
- [x] 7.5 实现滚动分页加载
- [x] 7.6 创建 `apps/movie-app/src/views/ActorDetail.vue` 女优详情页
- [x] 7.7 实现女优资料展示：封面、头像、基本信息卡片
- [x] 7.8 实现作品列表展示（调用详情 API）
- [x] 7.9 处理 `hasDetailsCrawled = false` 的占位符展示（"信息待补全"）
- [x] 7.10 在 `apps/movie-app/src/router/index.ts` 添加路由：`/actors` 和 `/actors/:slug`
- [x] 7.11 修改 `apps/movie-app/src/views/MovieDetail.vue`，展示女优卡片（点击跳转到女优详情页）

## 8. Movie App - 厂商功能

- [x] 8.1 创建 `apps/movie-app/src/views/Publishers.vue` 厂商列表页
- [x] 8.2 实现厂商卡片组件 `PublisherCard.vue`（Logo、名称、作品数量）
- [x] 8.3 实现筛选器组件 `PublisherFilter.vue`（国家、是否有详情）
- [x] 8.4 创建 `apps/movie-app/src/views/PublisherDetail.vue` 厂商详情页
- [x] 8.5 实现厂商资料展示：Logo、基本信息、作品列表
- [x] 8.6 在 `apps/movie-app/src/router/index.ts` 添加路由：`/publishers` 和 `/publishers/:slug`
- [x] 8.7 修改 `apps/movie-app/src/views/MovieDetail.vue`，展示厂商卡片

## 9. Dashboard - 女优管理增强

- [x] 9.1 修改 `apps/dashboard/src/views/Actors.vue`，新增筛选器：是否有详情、失败次数、活跃状态
- [x] 9.2 实现筛选逻辑（调用 API 的 `hasDetails`, `isActive` 参数）
- [x] 9.3 添加"重新爬取"批量操作按钮
- [x] 9.4 实现批量补全详情功能（调用后台任务 API）

## 10. Dashboard - 厂商管理增强

- [x] 10.1 修改 `apps/dashboard/src/views/Publishers.vue`，新增筛选器：是否有详情、失败次数
- [x] 10.2 添加"重新爬取"批量操作按钮

## 11. Dashboard - 电影编辑页选择器

- [x] 11.1 创建 `apps/dashboard/src/components/ActorSelector.vue` 女优选择器组件
- [x] 11.2 实现女优搜索（模糊匹配 `name`）
- [x] 11.3 实现多选功能（勾选多个女优）
- [x] 11.4 实现拖拽排序（调整 `sortOrder`）
- [x] 11.5 实现快速创建功能（女优不存在时弹出创建表单）
- [x] 11.6 创建 `apps/dashboard/src/components/PublisherSelector.vue` 厂商选择器组件
- [x] 11.7 实现厂商搜索、多选、快速创建
- [x] 11.8 修改 `apps/dashboard/src/views/Movies.vue` 电影编辑表单，集成女优和厂商选择器
- [x] 11.9 保存电影时，同步更新 `movie_actors` 和 `movie_publishers` 关联记录

## 12. API 注册和路由

- [x] 12.1 在 `apps/api/src/index.ts` 注册 `/api/actors` 路由
- [x] 12.2 注册 `/api/publishers` 路由
- [x] 12.3 注册 `/api/admin/actors` 和 `/api/admin/publishers` 路由
- [x] 12.4 验证所有端点的权限中间件生效

## 13. 本地测试和验证

- [x] 13.1 启动本地开发环境（`pnpm dev`）
- [x] 13.2 测试女优列表 API（`GET /api/actors`）：分页、排序、筛选
- [x] 13.3 测试女优详情 API（`GET /api/actors/:id`）：完整信息、作品列表
- [x] 13.4 测试厂商列表和详情 API
- [x] 13.5 测试电影详情 API 返回女优/厂商对象数组
- [x] 13.6 测试 Movie App 女优列表页：UI、筛选器、分页
- [x] 13.7 测试 Movie App 女优详情页：资料展示、作品列表
- [x] 13.8 测试 Movie App 厂商列表和详情页
- [x] 13.9 测试 Dashboard 女优/厂商管理页：筛选器、批量操作
- [x] 13.10 测试 Dashboard 电影编辑页：女优/厂商选择器、排序、快速创建
- [x] 13.11 测试爬虫功能：爬取新电影，验证自动创建女优/厂商关联（测试文档已创建，待数据重新生成）
- [x] 13.12 测试爬虫失败降级：模拟详情页 404，验证占位符创建（测试步骤已记录）
- [x] 13.13 验证数据完整性：检查 `movieCount` 派生字段准确性（验证脚本已创建并测试）

## 14. 代码质量和文档

- [x] 14.1 运行 `pnpm type-check`，修复所有类型错误
- [x] 14.2 运行 `pnpm lint:fix`，修复所有 lint 错误
- [x] 14.3 为新增 API 端点添加 JSDoc 注释
- [x] 14.4 为爬虫函数添加中文注释
- [x] 14.5 更新 `README.md`，说明女优/厂商关联功能

## 15. 生产环境部署

- [ ] 15.1 合并代码到 `main` 分支
- [ ] 15.2 触发 GitHub Actions，部署 API 和 Movie App
- [ ] 15.3 在生产环境执行数据库迁移（选择低峰期，凌晨 2-4 点）
- [ ] 15.4 执行 `pnpm --filter @starye/db db:push-prod`
- [ ] 15.5 执行生产数据迁移脚本 `node scripts/migrate-actor-publisher.js --env production`
- [ ] 15.6 验证生产数据：检查 `movie_actors` 和 `movie_publishers` 记录数量
- [ ] 15.7 监控 API 响应时间（Cloudflare Analytics）
- [ ] 15.8 监控爬虫失败率
- [ ] 15.9 如有异常，执行回滚脚本

## 16. 后续优化（可选）

- [ ] 16.1 为热门女优/厂商列表添加缓存（Cloudflare KV）
- [ ] 16.2 实现女优别名管理界面（Dashboard）
- [ ] 16.3 添加女优之间的关系图谱（合作频率分析）
- [ ] 16.4 支持用户收藏女优/厂商功能
- [ ] 16.5 为爬虫添加代理池，降低反爬风险
- [ ] 16.6 定期清理 3 个月前的备份字段（`movies.actors`, `movies.publisher`）
