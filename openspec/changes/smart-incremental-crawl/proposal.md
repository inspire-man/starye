## Why

当前爬虫存在三个核心问题：

1. **配置 Bug 导致早停**：电影爬虫工作流设置 `MAX_MOVIES=200`，但 `scripts/run-optimized.ts` 中默认值为 `50`，且进度监控硬编码为 100，导致实际只爬取 38 部电影就停止。
2. **无增量能力导致重复劳动**：每次全量爬取，大量已存在内容被跳过（漫画 59/112 处理率），浪费 API 调用和时间。
3. **测试不足导致线上失败**：批量状态查询接口曾返回 401，CI 中无自动化测试覆盖，需手动发现问题。

本次变更目标是实现**智能增量爬取**，通过批量状态查询跳过已存在内容，修复配置传递 Bug，并添加完整的自动化测试覆盖。

## What Changes

- **修复配置传递 Bug**：移除 `scripts/run-optimized.ts` 中的默认值，确保 `MAX_MOVIES` 环境变量正确传递；修复 `ProgressMonitor` 初始化逻辑，使用实际配置值而非硬编码 100
- **实现智能增量爬取**：在 `OptimizedCrawler` 中添加批量状态查询，爬取前过滤已存在内容；漫画爬虫使用相同策略，避免全量检查
- **添加 E2E 测试覆盖**：创建测试套件验证批量状态查询、增量爬取逻辑、配置传递正确性
- **改进进度监控**：实时显示增量命中率、跳过/新增比例，帮助评估爬取效率
- **BREAKING**: 环境变量 `MAX_MOVIES` 现在 **MUST** 在工作流中显式设置（移除代码内默认值）

## Capabilities

### New Capabilities
- `incremental-crawl`: 智能增量爬取能力，包括批量状态查询 API、爬虫端增量逻辑、进度监控增强
- `crawler-e2e-test`: 爬虫端到端测试能力，覆盖批量查询、增量过滤、配置传递

### Modified Capabilities
<!-- 无现有能力变更，这是新增功能 -->

## Impact

- **修改文件**：
  - `packages/crawler/src/scripts/run-optimized.ts`：移除默认值，添加环境变量校验
  - `packages/crawler/src/crawlers/optimized-crawler.ts`：添加批量查询逻辑
  - `packages/crawler/src/crawlers/comic-crawler.ts`：复用批量查询能力
  - `packages/crawler/src/utils/progress.ts`：支持增量统计显示
  - `packages/crawler/src/config.ts`：确保配置正确解析
- **新增测试**：
  - `packages/crawler/src/crawlers/__tests__/optimized-crawler.e2e.test.ts`
  - `packages/crawler/src/crawlers/__tests__/comic-crawler.e2e.test.ts`
- **CI/CD 影响**：
  - `.github/workflows/daily-movie-crawl.yml`：确保 `MAX_MOVIES` 正确设置
  - `.github/workflows/daily-manga-crawl.yml`：确保 `CRAWLER_MAX` 正确设置
- **API 依赖**：批量状态查询接口 `/api/admin/movies/batch-status` 必须可用且已修复（已在前序工作中完成）
