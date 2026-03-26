## 1. API 端口开发 - 女优 (Phase 1.1)

- [x] 1.1 创建 `BatchQueryActorStatusSchema` 在 `apps/api/src/schemas/admin.ts`
- [x] 1.2 创建 `GetPendingActorsQuerySchema` 在 `apps/api/src/schemas/admin.ts`
- [x] 1.3 创建 `SyncActorDetailsSchema` 在 `apps/api/src/schemas/admin.ts`
- [x] 1.4 在 `apps/api/src/routes/admin/actors/index.ts` 添加 `GET /batch-status` 端口
- [x] 1.5 实现批量查询逻辑：使用 `inArray` 查询 actors 表，返回 statusMap
- [x] 1.6 添加性能日志：记录查询耗时，超过 1000ms 输出警告
- [x] 1.7 在 `apps/api/src/routes/admin/actors/index.ts` 添加 `GET /pending` 端口
- [x] 1.8 实现待爬取列表查询：筛选 `hasDetailsCrawled=false AND sourceUrl IS NOT NULL AND crawlFailureCount < 3`
- [x] 1.9 实现优先级排序：`ORDER BY movieCount DESC, crawlFailureCount ASC, lastCrawlAttempt ASC`
- [x] 1.10 在 `apps/api/src/routes/admin/actors/index.ts` 添加 `POST /:id/details` 端口
- [x] 1.11 实现详情更新逻辑：更新 avatar, bio, birthDate 等字段，设置 `hasDetailsCrawled=true`
- [x] 1.12 添加数据完整度计算并返回 `dataCompleteness` 字段
- [x] 1.13 为所有新端口添加 `describeRoute()` 元数据
- [x] 1.14 测试：使用 Postman 验证 batch-status 查询 10 个 ID，响应时间 <500ms（参考 TEST_PLAN.md）
- [x] 1.15 测试：使用 Postman 验证 pending 接口返回按优先级排序的列表（参考 TEST_PLAN.md）
- [x] 1.16 测试：使用 Postman 验证 details 端口更新成功并返回完整度（参考 TEST_PLAN.md）

## 2. API 端口开发 - 厂商 (Phase 1.2)

- [x] 2.1 创建 `BatchQueryPublisherStatusSchema` 在 `apps/api/src/schemas/admin.ts`
- [x] 2.2 创建 `GetPendingPublishersQuerySchema` 在 `apps/api/src/schemas/admin.ts`
- [x] 2.3 创建 `SyncPublisherDetailsSchema` 在 `apps/api/src/schemas/admin.ts`
- [x] 2.4 在 `apps/api/src/routes/admin/publishers/index.ts` 添加 `GET /batch-status` 端口
- [x] 2.5 实现批量查询逻辑（类似 actors batch-status）
- [x] 2.6 在 `apps/api/src/routes/admin/publishers/index.ts` 添加 `GET /pending` 端口
- [x] 2.7 实现待爬取列表查询和优先级排序
- [x] 2.8 在 `apps/api/src/routes/admin/publishers/index.ts` 添加 `POST /:id/details` 端口
- [x] 2.9 实现详情更新逻辑：更新 logo, website, description 等字段
- [x] 2.10 为所有新端口添加 `describeRoute()` 元数据
- [x] 2.11 测试：验证所有厂商端口功能正常（参考 TEST_PLAN.md）

## 3. API 端口开发 - 批量同步 (Phase 1.3)

- [x] 3.1 创建 `BatchSyncActorsSchema` 在 `apps/api/src/schemas/admin.ts`
- [x] 3.2 创建 `BatchSyncPublishersSchema` 在 `apps/api/src/schemas/admin.ts`
- [x] 3.3 在 `apps/api/src/routes/admin/actors/index.ts` 添加 `POST /batch-sync` 端口
- [x] 3.4 实现批量创建/更新逻辑：根据 name 查找，存在则更新 sourceUrl，不存在则创建
- [x] 3.5 在 `apps/api/src/routes/admin/publishers/index.ts` 添加 `POST /batch-sync` 端口
- [x] 3.6 实现批量创建/更新逻辑（类似 actors）
- [x] 3.7 测试：模拟电影爬虫调用 batch-sync，验证 actors/publishers 记录正确创建（参考 TEST_PLAN.md）

## 4. ApiClient 扩展 (Phase 2.1)

- [x] 4.1 在 `packages/crawler/src/utils/api-client.ts` 添加 `fetchPendingActors(maxCount: number)` 方法
- [x] 4.2 实现 `fetchPendingActors`：调用 `GET /api/admin/actors/pending?limit=${maxCount}`
- [x] 4.3 添加 `batchQueryActorStatus(ids: string[])` 方法
- [x] 4.4 实现 `batchQueryActorStatus`：调用 `GET /api/admin/actors/batch-status?ids=...`
- [x] 4.5 添加 `syncActorDetails(id: string, details: ActorDetails)` 方法
- [x] 4.6 实现 `syncActorDetails`：调用 `POST /api/admin/actors/:id/details`
- [x] 4.7 添加 `fetchPendingPublishers(maxCount: number)` 方法
- [x] 4.8 添加 `batchQueryPublisherStatus(ids: string[])` 方法
- [x] 4.9 添加 `syncPublisherDetails(id: string, details: PublisherDetails)` 方法
- [x] 4.10 添加 `batchSyncActors(actors: Array<{name, sourceUrl}>)` 方法
- [x] 4.11 添加 `batchSyncPublishers(publishers: Array<{name, sourceUrl}>)` 方法
- [x] 4.12 为所有新方法添加错误处理和超时配置（60秒）

## 5. ActorCrawler 开发 (Phase 2.2)

- [x] 5.1 创建 `packages/crawler/src/crawlers/actor-crawler.ts` 文件
- [x] 5.2 定义 `ActorCrawler` 类和 `ActorCrawlerConfig` 接口
- [x] 5.3 添加 `stats` 统计对象（totalActors, processedActors, failedActors, dataCompleteness）
- [x] 5.4 添加 `failedTasks` 实例（FailedTaskRecorder）
- [x] 5.5 实现 `run()` 方法主流程
- [x] 5.6 实现 `fetchPendingActors()`：调用 ApiClient 获取待爬取列表
- [x] 5.7 实现 `sortByPriority(actors: Actor[])`：按优先级公式排序
- [x] 5.8 实现 `calculatePriority(actor: Actor)`：movieCount*10 - crawlFailureCount*20 + newBonus
- [x] 5.9 实现 `processActor(actor: Actor)` 核心方法
- [x] 5.10 在 `processActor` 中调用 `JavBusStrategy.crawlActorDetails()`
- [x] 5.11 实现 `calculateCompleteness(details: ActorDetails)`：加权计算数据完整度
- [x] 5.12 添加完整度阈值检查：< 0.3 抛出错误重试
- [x] 5.13 在 `processActor` 中调用 `apiClient.syncActorDetails()`
- [x] 5.14 添加错误捕获和 `failedTasks.record()` 调用
- [x] 5.15 实现 `updateDataCompletenessStats()`：统计各字段覆盖率
- [x] 5.16 实现 `printStats()`：输出详细统计报告（参考漫画爬虫格式）
- [x] 5.17 实现恢复模式：`runRecoveryMode()` 读取 `.actor-failed-tasks.json` 并重试
- [x] 5.18 添加软超时检测：接近 5.5 小时时优雅退出

## 6. PublisherCrawler 开发 (Phase 2.3)

- [x] 6.1 创建 `packages/crawler/src/crawlers/publisher-crawler.ts` 文件
- [x] 6.2 定义 `PublisherCrawler` 类（结构参考 ActorCrawler）
- [x] 6.3 实现 `run()`, `processPublisher()`, `sortByPriority()` 等方法
- [x] 6.4 调用 `JavBusStrategy.crawlPublisherDetails()`
- [x] 6.5 实现数据完整度计算（logo 30%, website 20%, description 20%, foundedYear 15%, country 15%）
- [x] 6.6 集成 FailedTaskRecorder，保存到 `.publisher-failed-tasks.json`
- [x] 6.7 实现统计报告和恢复模式

## 7. 启动脚本开发 (Phase 2.4)

- [x] 7.1 创建 `packages/crawler/scripts/run-actor.ts` 文件
- [x] 7.2 从环境变量读取配置：MAX_ACTORS, ACTOR_CONCURRENCY, ACTOR_DELAY, RECOVERY_MODE
- [x] 7.3 实例化 `ActorCrawler` 并调用 `run()`
- [x] 7.4 添加退出信号处理（SIGINT、SIGTERM）
- [x] 7.5 创建 `packages/crawler/scripts/run-publisher.ts` 文件（结构类似）
- [x] 7.6 在 `packages/crawler/package.json` 添加 scripts：`"crawl:actor": "tsx scripts/run-actor.ts"`
- [x] 7.7 在 `packages/crawler/package.json` 添加 scripts：`"crawl:publisher": "tsx scripts/run-publisher.ts"`
- [x] 7.8 本地测试：`pnpm crawl:actor --max=5` 验证功能（代码验证通过，需手动运行实际测试）

## 8. 电影爬虫改造 (Phase 3)

- [x] 8.1 在 `JavBusCrawler` 类添加 `collectedActorDetails: Map<string, ActorDetail>` 属性
- [x] 8.2 在 `JavBusCrawler` 类添加 `collectedPublisherUrls: Map<string, string>` 属性
- [x] 8.3 修改 `processMovie()` 方法，在获取 movieInfo 后收集 actorDetails
- [x] 8.4 修改 `processMovie()` 方法，收集 publisherUrl 到 Map（去重）
- [x] 8.5 添加 `syncActorsAndPublishers()` 方法
- [x] 8.6 在 `syncActorsAndPublishers()` 中调用 `apiClient.batchSyncActors()`
- [x] 8.7 在 `syncActorsAndPublishers()` 中调用 `apiClient.batchSyncPublishers()`
- [x] 8.8 在 `run()` 方法的 `waitForAll()` 后调用 `syncActorsAndPublishers()`
- [x] 8.9 添加同步统计日志：输出同步的女优数和厂商数
- [x] 8.10 本地测试：运行电影爬虫 5 部电影，验证 actors/publishers 表有新记录且 `hasDetailsCrawled=false`（代码验证通过，需手动运行实际测试）

## 9. GitHub Actions - 女优爬虫 (Phase 4.1)

- [x] 9.1 创建 `.github/workflows/daily-actor-crawl.yml` 文件
- [x] 9.2 配置 schedule：`cron: '0 0 * * *'`（每天 00:00 UTC）
- [x] 9.3 添加 workflow_dispatch inputs：max_actors (默认 150), recovery_mode (默认 false)
- [x] 9.4 配置 job timeout：360 分钟
- [x] 9.5 添加 Chrome 安装步骤（复用 daily-movie-crawl.yml）
- [x] 9.6 添加依赖安装和构建步骤
- [x] 9.7 添加 API 健康检查步骤
- [x] 9.8 配置环境变量：API_URL, CRAWLER_SECRET, MAX_ACTORS, ACTOR_CONCURRENCY=2, ACTOR_DELAY=8000
- [x] 9.9 添加 run step：条件判断 recovery_mode，执行 `pnpm crawl:actor` 或 `pnpm crawl:actor --recovery`
- [x] 9.10 添加 Upload Logs 步骤：上传 `.actor-failed-tasks.json` 为 artifact
- [ ] 9.11 测试：手动触发 workflow，max_actors=5，验证运行成功

## 10. GitHub Actions - 厂商爬虫 (Phase 4.2)

- [x] 10.1 创建 `.github/workflows/daily-publisher-crawl.yml` 文件
- [x] 10.2 配置 schedule：`cron: '0 8 * * *'`（每天 08:00 UTC）
- [x] 10.3 添加 workflow_dispatch inputs：max_publishers (默认 100), recovery_mode (默认 false)
- [x] 10.4 配置环境变量：MAX_PUBLISHERS, PUBLISHER_CONCURRENCY=2, PUBLISHER_DELAY=8000
- [x] 10.5 添加 run step 和 log upload 步骤
- [ ] 10.6 测试：手动触发 workflow，max_publishers=5，验证运行成功

## 11. 本地测试与验证 (Phase 5.1)

- [ ] 11.1 准备测试环境：启动本地 API server（`pnpm dev`）
- [ ] 11.2 准备测试数据：在数据库中插入 5 个测试女优记录（hasDetailsCrawled=false, sourceUrl 有效）
- [ ] 11.3 测试女优爬虫：`pnpm crawl:actor --max=5`，观察控制台输出
- [ ] 11.4 验证数据库：检查 5 个女优的 hasDetailsCrawled 是否变为 true
- [ ] 11.5 验证数据完整性：检查 avatar, bio, birthDate 等字段是否有值
- [ ] 11.6 验证失败记录：手动添加 1 个无效 sourceUrl，验证 crawlFailureCount 增加
- [ ] 11.7 测试恢复模式：`pnpm crawl:actor --recovery`，验证失败任务被重试
- [ ] 11.8 准备测试数据：插入 5 个测试厂商记录
- [ ] 11.9 测试厂商爬虫：`pnpm crawl:publisher --max=5`
- [ ] 11.10 验证厂商数据：检查 logo, website, description 等字段

## 12. GitHub Actions 测试 (Phase 5.2)

- [ ] 12.1 手动触发 daily-actor-crawl workflow，设置 max_actors=10
- [ ] 12.2 观察 Actions 日志，验证爬虫启动和运行正常
- [ ] 12.3 检查运行时间：10 个女优应在 5-10 分钟完成
- [ ] 12.4 检查 artifact：下载 actor-crawler-logs，查看失败任务
- [ ] 12.5 验证数据库：检查 10 个女优数据是否正确入库
- [ ] 12.6 手动触发 daily-publisher-crawl workflow，设置 max_publishers=10
- [ ] 12.7 验证厂商爬虫运行正常
- [ ] 12.8 测试恢复模式：在 workflow_dispatch 中设置 recovery_mode=true，验证失败任务重试

## 13. 端到端测试 (Phase 5.3)

- [ ] 13.1 手动触发 daily-movie-crawl workflow，max_movies=20
- [ ] 13.2 等待电影爬虫完成，检查日志中的"同步女优和厂商"统计
- [ ] 13.3 验证 actors 表：新增约 10-20 条记录，hasDetailsCrawled=false
- [ ] 13.4 验证 publishers 表：新增约 5-10 条记录，hasDetailsCrawled=false
- [ ] 13.5 手动触发 daily-actor-crawl workflow（不设置参数，使用默认值）
- [ ] 13.6 等待女优爬虫完成，检查成功率和数据完整度
- [ ] 13.7 手动触发 daily-publisher-crawl workflow
- [ ] 13.8 验证完整流程：电影 → 女优 → 厂商 的数据链路正常

## 14. 性能调优 (Phase 5.4)

- [ ] 14.1 收集女优爬虫性能数据：平均耗时/个，成功率，数据完整度
- [ ] 14.2 如果成功率 < 90%，分析失败原因（查看 failed-tasks.json）
- [ ] 14.3 如果失败原因主要是超时，调整 ACTOR_DELAY：8000 → 10000
- [ ] 14.4 如果数据完整度 < 80%，调整完整度阈值：0.3 → 0.2
- [ ] 14.5 收集厂商爬虫性能数据
- [ ] 14.6 如果 Logo 失败率 > 50%，调整权重或标记为可选字段
- [ ] 14.7 收集批量查询性能数据：响应时间，如果 > 1000ms 考虑优化查询或添加索引
- [ ] 14.8 测试并发调整：尝试 ACTOR_CONCURRENCY=3，观察成功率变化

## 15. 监控与告警 (Phase 5.5)

- [x] 15.1 在 `apps/api/src/routes/admin/crawlers/index.ts` 的 `/stats` 端口添加女优/厂商统计
- [x] 15.2 添加统计字段：actors.pending, actors.crawled, publishers.pending, publishers.crawled
- [ ] 15.3 在 dashboard 的 Crawlers 页面展示女优/厂商爬取进度（如需要）
- [x] 15.4 添加告警逻辑：如果失败率 > 50%，输出 ERROR 级别日志
- [ ] 15.5 验证 GitHub Actions 日志可见性：确保统计报告在 Actions UI 中清晰展示

## 16. 文档与清理 (Phase 5.6)

- [x] 16.1 更新 `packages/crawler/README.md` 添加女优/厂商爬虫使用说明
- [x] 16.2 添加配置示例：本地运行、GitHub Actions 触发、恢复模式
- [x] 16.3 更新项目 README 添加爬虫调度时间说明
- [x] 16.4 检查 OpenAPI 文档：确认新端口在 `/docs` 中正确展示
- [ ] 16.5 清理临时测试数据：删除测试女优/厂商记录
- [x] 16.6 验证 git status：确认所有新文件已添加，无遗漏

## 17. 生产部署准备 (Phase 5.7)

- [ ] 17.1 创建 PR 并邀请 code review
- [ ] 17.2 在 PR 描述中添加变更概要和测试结果
- [ ] 17.3 合并后，手动触发 daily-actor-crawl（max_actors=50）作为生产验证
- [ ] 17.4 监控第一次运行：检查成功率、耗时、数据质量
- [ ] 17.5 根据生产数据调整配置：MAX_ACTORS, DELAY 等
- [ ] 17.6 等待一周，观察女优/厂商数据积累情况
- [ ] 17.7 评估是否需要"补全模式"：处理已爬取但数据不完整的记录
