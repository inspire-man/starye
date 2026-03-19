## 1. 修复配置传递 Bug

- [x] 1.1 修改 `packages/crawler/src/scripts/run-optimized.ts`，移除 `process.env.MAX_MOVIES || '50'` 默认值，添加环境变量校验（未设置时抛出错误并退出）
- [x] 1.2 修改 `packages/crawler/src/utils/progress.ts` 中 `ProgressMonitor` 初始化逻辑，使用 `config.limits.maxMovies` 而非硬编码 100
- [x] 1.3 验证 `.github/workflows/daily-movie-crawl.yml` 和 `.github/workflows/daily-manga-crawl.yml` 中 `MAX_MOVIES` 和 `CRAWLER_MAX` 环境变量已正确设置
- [ ] 1.4 本地测试：设置 `MAX_MOVIES=10` 运行电影爬虫，验证进度条显示 "10/10" 而非 "10/100"

## 2. 实现批量状态查询增量逻辑

- [x] 2.1 在 `packages/crawler/src/crawlers/optimized-crawler.ts` 中添加 `filterExistingMovies` 方法，调用 `ApiClient.batchQueryMovieStatus` 并过滤已存在内容
- [x] 2.2 修改 `OptimizedCrawler.run()` 方法，在发现电影列表后调用 `filterExistingMovies`，仅爬取新电影
- [x] 2.3 添加增量统计日志输出：发现数量、已存在数量、新增数量、增量命中率
- [x] 2.4 在 `packages/crawler/src/crawlers/comic-crawler.ts` 中添加类似的批量查询逻辑，过滤已存在漫画
- [x] 2.5 验证批量查询失败时的回退逻辑：API 返回错误时回退到全量爬取模式（不过滤）

## 3. 改进进度监控

- [x] 3.1 修改 `packages/crawler/src/utils/progress.ts` 的 `ProgressMonitor.update()` 方法，支持显示增量统计（已存在/新增比例）
- [x] 3.2 在爬虫启动时输出配置信息：`MAX_MOVIES`、并发数、增量模式状态
- [x] 3.3 在爬虫完成时输出最终统计：总发现、总处理、总跳过、增量命中率、耗时
- [ ] 3.4 本地测试：运行电影爬虫，验证进度输出包含 "已存在: X (Y%), 新增: Z (W%)"

## 4. 添加 E2E 测试覆盖

- [x] 4.1 创建 `packages/crawler/src/crawlers/__tests__/optimized-crawler.e2e.test.ts`，验证批量查询增量逻辑
- [x] 4.2 添加测试场景：过滤已存在内容、全部已存在、无已存在内容
- [x] 4.3 添加测试场景：批量查询 API 返回 401、超时、网络错误时的回退逻辑
- [x] 4.4 创建 `packages/crawler/src/crawlers/__tests__/comic-crawler.e2e.test.ts`，验证漫画爬虫增量逻辑
- [x] 4.5 创建 `packages/crawler/src/scripts/__tests__/run-optimized.test.ts`，验证配置传递逻辑（环境变量正确读取、缺失时错误）
- [x] 4.6 创建 `packages/crawler/src/utils/__tests__/progress.test.ts`，验证 `ProgressMonitor` 使用配置值而非硬编码 100
- [x] 4.7 运行所有测试：`pnpm --filter @starye/crawler test`，验证通过
- [x] 4.8 生成测试覆盖率报告，验证批量查询逻辑覆盖率 ≥ 90%，增量过滤逻辑覆盖率 ≥ 85%

## 5. 集成与验证

- [x] 5.1 运行 `pnpm lint:fix` 修复代码风格问题
- [x] 5.2 运行 `pnpm typecheck` 验证 TypeScript 类型
- [ ] 5.3 本地运行完整电影爬虫（设置 `MAX_MOVIES=10`），验证增量逻辑生效
- [ ] 5.4 本地运行完整漫画爬虫（设置 `CRAWLER_MAX=5`），验证增量逻辑生效
- [ ] 5.5 提交代码变更，触发 CI 工作流，验证测试通过
- [ ] 5.6 观察 GitHub Actions 日志，确认配置传递正确、增量统计输出清晰
- [ ] 5.7 在生产环境运行一次爬取，对比前后爬取时间和内容数量，验证效率提升

## 6. 文档与清理

- [x] 6.1 更新 `packages/crawler/README.md`，说明增量爬取功能和必需的环境变量
- [x] 6.2 创建或更新 `.env.example` 文件，包含 `MAX_MOVIES` 和 `CRAWLER_MAX` 示例
- [x] 6.3 在爬虫代码中添加注释，说明批量查询和增量过滤的逻辑
- [x] 6.4 归档测试文件和临时脚本（如 `scripts/test-batch-status.ts`），如不再需要可删除
