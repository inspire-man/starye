## Why

当前漫画爬虫存在严重的性能瓶颈：**42 分钟只能处理 2 个漫画**，完全串行的架构导致处理 28 个漫画需要约 67 小时。在 GitHub Actions 环境下（6 小时超时限制），这使得每日增量爬取无法正常工作。

核心问题：
1. **完全串行处理**：漫画、章节、图片全部串行，无并发
2. **缺少增量策略**：每次都重新爬取所有漫画，没有去重检查
3. **资源利用率低**：GitHub Actions 提供 2 核 7GB 内存，但只使用单线程

**MUST** 在 6 小时内完成每日增量爬取，确保漫画数据能够持续更新。

## What Changes

- **引入批量并发处理**：图片、章节、漫画三级并发控制
- **实现增量爬取策略**：漫画级别去重、章节级别跳过、优先级队列
- **添加爬取状态管理**：数据库记录爬取进度，支持断点续传
- **优化 API 调用**：批量查询状态，减少网络往返
- **自适应资源控制**：基于 GitHub Actions 环境的保守并发策略
- **新增配置系统**：可配置的并发参数、限流策略、超时控制

**性能目标**：
- 首次全量爬取：< 6 小时（分批处理）
- 每日增量爬取：< 1 小时
- 图片处理速度：20x 提升（串行 → 批量并发）

## Capabilities

### New Capabilities

- `crawler-concurrency-control`: 爬虫的三级并发控制系统（漫画/章节/图片），包括并发限制、队列管理、资源监控
- `crawler-incremental-strategy`: 增量爬取策略，包括漫画去重、章节跳过、优先级排序、断点续传
- `crawler-state-management`: 爬取状态管理，数据库记录爬取进度、失败重试、状态同步
- `crawler-config-system`: 可配置的爬虫参数系统，支持环境检测、策略切换、动态调整

### Modified Capabilities

- `crawler-api-integration`: API 调用方式从单个请求改为批量请求，新增批量状态查询、进度更新等端点

## Impact

**影响的代码**：
- `packages/crawler/src/crawlers/comic-crawler.ts` - 核心爬虫逻辑重构
- `packages/crawler/src/lib/image-processor.ts` - 图片处理并发化
- `packages/crawler/src/strategies/site-92hm.ts` - 增量检查集成
- `apps/api/src/routes/comics.ts` - 新增批量查询端点
- `apps/api/src/routes/admin.ts` - 新增状态管理端点
- `.github/workflows/daily-manga-crawl.yml` - 环境变量和配置调整

**数据库变更**：
- `comics` 表新增字段：`crawl_status`, `last_crawled_at`, `total_chapters`, `crawled_chapters`
- 可能新增 `crawl_logs` 表记录每次运行的统计信息

**外部依赖**：
- 新增 `p-map` 或 `p-limit` 用于并发控制
- GitHub Actions 资源限制（2 核、7GB 内存、6 小时超时）

**向后兼容性**：
- 保留原有串行模式作为 fallback
- 配置文件向后兼容，默认值保持原有行为
- API 端点为新增，不影响现有调用

**风险**：
- 并发增加可能触发源站反爬机制（通过保守策略缓解）
- 内存使用增加需要监控（设置合理的并发上限）
- 断点续传逻辑复杂度增加（通过充分测试保证）
