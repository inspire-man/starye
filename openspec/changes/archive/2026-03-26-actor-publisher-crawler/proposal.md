## Why

当前电影爬虫只采集女优和厂商的基本名称，导致数据库中 actors 和 publishers 表存在大量记录，但缺失头像、简介、生日、官网等详细信息。这限制了用户体验和内容展示能力。通过建立独立的女优和厂商爬虫，我们能够系统性地补全这些数据，提升内容质量和数据完整度。MUST 实现独立的女优爬虫和厂商爬虫，SHALL 支持增量爬取和失败恢复机制。

## What Changes

- **新增爬虫**：创建 `ActorCrawler` 和 `PublisherCrawler` 类，基于现有 `OptimizedCrawler` 模式
- **API 端口**：新增批量状态查询接口 (`/api/admin/actors/batch-status`, `/api/admin/publishers/batch-status`)
- **API 端口**：新增待爬取列表接口 (`/api/admin/actors/pending`, `/api/admin/publishers/pending`)
- **API 端口**：新增详情更新接口 (`/api/admin/actors/:id/details`, `/api/admin/publishers/:id/details`)
- **电影爬虫改造**：在 `JavBusCrawler` 中同步女优和厂商 URL 到数据库
- **Strategy 扩展**：利用 `JavBusStrategy` 已实现的 `crawlActorDetails()` 和 `crawlPublisherDetails()` 方法
- **ApiClient 扩展**：新增 `fetchPendingActors()`, `batchQueryActorStatus()`, `syncActorDetails()` 等方法
- **GitHub Actions**：新增 `daily-actor-crawl.yml` 和 `daily-publisher-crawl.yml` 定时任务
- **启动脚本**：创建 `run-actor.ts` 和 `run-publisher.ts` 脚本
- **失败恢复**：复用 `FailedTaskRecorder` 机制，分别保存到 `.actor-failed-tasks.json` 和 `.publisher-failed-tasks.json`

## Capabilities

### New Capabilities

- `actor-detail-crawling`: 女优详情页批量爬取，包括头像、简介、生日、身高、三围、国籍等信息
- `publisher-detail-crawling`: 厂商详情页批量爬取，包括 Logo、官网、简介、成立年份、国家等信息
- `actor-publisher-batch-query`: API 批量状态查询，支持增量爬取优化
- `actor-publisher-priority-sorting`: 基于作品数量和失败次数的优先级排序

### Modified Capabilities

- `movie-crawling`: 电影爬虫新增女优和厂商 URL 同步功能

## Impact

**影响范围：**
- **新增文件**：`packages/crawler/src/crawlers/actor-crawler.ts`, `publisher-crawler.ts`
- **新增文件**：`packages/crawler/scripts/run-actor.ts`, `run-publisher.ts`
- **新增文件**：`.github/workflows/daily-actor-crawl.yml`, `daily-publisher-crawl.yml`
- **修改文件**：`packages/crawler/src/crawlers/javbus.ts`（新增 URL 同步逻辑）
- **修改文件**：`packages/crawler/src/utils/api-client.ts`（新增 API 方法）
- **修改文件**：`apps/api/src/routes/admin/actors/index.ts`（新增 batch-status, pending, details 端口）
- **修改文件**：`apps/api/src/routes/admin/publishers/index.ts`（新增 batch-status, pending, details 端口）

**破坏性变更：**
- 无（完全新增功能，不影响现有接口）

**新增端点：**
- `GET /api/admin/actors/batch-status?ids=id1,id2,id3`
- `GET /api/admin/publishers/batch-status?ids=id1,id2,id3`
- `GET /api/admin/actors/pending?limit=150`
- `GET /api/admin/publishers/pending?limit=100`
- `POST /api/admin/actors/:id/details`
- `POST /api/admin/publishers/:id/details`

**定时任务调度：**
- 电影爬虫：每天 00:00 UTC (08:00 UTC+8)
- 女优爬虫：每天 00:00 UTC (08:00 UTC+8)，电影爬虫结束后触发
- 厂商爬虫：每天 08:00 UTC (16:00 UTC+8)

**数据完整度目标：**
- 女优头像覆盖率：>95%
- 女优简介覆盖率：>85%
- 厂商 Logo 覆盖率：>90%
- 平均数据完整度：>80%

**性能指标：**
- 女优爬虫：150 个/天，成功率 >90%
- 厂商爬虫：100 个/天，成功率 >90%
- 批量查询响应时间：<1000ms
