## Why

当前女优和厂商爬虫使用 JavBus 作为数据源，但数据极其有限（女优仅有名字和头像，厂商仅有名字和Logo）。经过调研发现，SeesaaWiki 素人系総合站点包含 33,000+ 详细条目，提供丰富的女优别名、出道信息、社交链接以及厂商系列关系等 JavBus 完全缺失的核心数据。切换到 SeesaaWiki 作为详情补全的主数据源，可以显著提升数据完整度和质量。本变更 MUST 保留 JavBus 用于影片基础信息爬取，仅替换女优和厂商的详情数据源。

## What Changes

- 创建 `SeesaaWikiStrategy` 爬虫策略类，实现 SeesaaWiki 页面解析
- 实现名字匹配系统，建立 JavBus 女优名到 SeesaaWiki 女优名的映射
- 重写 `ActorCrawler` 使用 SeesaaWiki 作为主数据源
- 重写 `PublisherCrawler` 使用 SeesaaWiki 作为主数据源
- 更新数据库 schema，新增别名、社交链接、系列关系等字段
- 调整 GitHub Actions workflows（`daily-actor-crawl.yml` 和 `daily-publisher-crawl.yml`）
- 保留 JavBus 影片爬虫不变

## Capabilities

### New Capabilities
- `seesaawiki-crawler`: SeesaaWiki 数据源爬取能力，包括索引页爬取、详情页解析、名字匹配系统、别名管理
- `actor-name-mapping`: 女优名字映射能力，建立 JavBus 名到 SeesaaWiki 名的双向映射缓存
- `publisher-series-relation`: 厂商系列关系管理能力，追踪厂商之间的母子关系和品牌系列

### Modified Capabilities
- `actor-details-crawl`: 女优详情爬取的数据源从 JavBus 切换到 SeesaaWiki，新增别名、出道日期、社交链接字段
- `publisher-details-crawl`: 厂商详情爬取的数据源从 JavBus 切换到 SeesaaWiki，新增官网、社交媒体、系列关系字段

## Impact

- **爬虫模块** (`packages/crawler/`):
  - 新增 `src/strategies/seesaawiki.ts` 和 `src/strategies/seesaawiki-parser.ts`
  - 重构 `src/crawlers/actor-crawler.ts` 和 `src/crawlers/publisher-crawler.ts`
  - 新增名字映射模块 `src/lib/name-mapper.ts`
  
- **数据库 schema** (`packages/db/src/schema.ts`):
  - `actors` 表新增字段：`aliases`, `socialLinks`, `blog`
  - `publishers` 表新增字段：`twitter`, `instagram`, `parentPublisher`, `brandSeries`
  
- **API 端点** (`apps/api/`):
  - 修改女优和厂商同步端点，支持新增字段
  - 可能需要新增别名查询端点
  
- **GitHub Actions**:
  - `.github/workflows/daily-actor-crawl.yml` - 调整配置参数
  - `.github/workflows/daily-publisher-crawl.yml` - 调整配置参数
  
- **反爬虫策略**: 需要针对 SeesaaWiki 调整延迟和请求频率配置

**风险**:
- 名字匹配准确率（预估可达 80-85%，需要实测验证）
- SeesaaWiki 可能有反爬虫限制（需要合理延迟策略）
- Wiki 页面格式可能不完全统一（需要容错解析）
