# Proposal: Actor & Publisher Relations

## Why

当前系统中，电影(Movie)与女优(Actor)、厂商(Publisher)的关系以纯文本数组(`movies.actors: string[]`)或单字段(`movies.publisher: string`)存储，导致：

1. **无法关联查询**：用户无法通过女优/厂商反向查询其参演/发行的所有电影
2. **数据不完整**：缺失女优/厂商的详细资料（头像、生日、身高、作品数量等），影响用户体验
3. **爬虫效率低**：无去重机制，重复爬取同一女优/厂商的信息
4. **客户端功能缺失**：Movie App 无法提供女优列表、厂商列表等核心功能，参考 javdb561.com 的体验差距明显

本变更旨在建立规范化的女优/厂商数据模型与关联关系，实现双向检索、详情展示、智能去重等能力，为用户提供完整的 AV 电影信息检索体验。MUST 在实施过程中确保现有电影数据的完整迁移，且不破坏生产环境的正常运行。

## What Changes

- **新增数据表**：
  - `movie_actors`（N:M 关联表）：电影-女优关联，支持排序
  - `movie_publishers`（N:M 关联表）：电影-厂商关联，支持排序
  
- **扩展现有表结构**：
  - `actors` 表新增字段：`source`, `sourceId`, `sourceUrl`, `cover`, `cupSize`, `bloodType`, `debutDate`, `isActive`, `retireDate`, `hasDetailsCrawled`, `crawlFailureCount`, `lastCrawlAttempt`
  - `publishers` 表新增字段：`source`, `sourceId`, `sourceUrl`, `hasDetailsCrawled`, `crawlFailureCount`, `lastCrawlAttempt`

- **爬虫策略升级**：
  - JavBus 爬虫在爬取电影时，自动触发女优/厂商详情页爬取
  - 基于 `sourceId`（原站 ID）实现智能去重
  - 失败时降级保存（仅保存名称，标记为待补全）

- **API 增强**：
  - 女优管理：列表、详情、筛选（按名称/国籍/活跃状态）、作品统计
  - 厂商管理：列表、详情、筛选、作品统计
  - 电影详情接口返回关联的女优/厂商完整信息

- **UI 功能新增**：
  - **Movie App**（优先级高）：
    - 女优列表页（默认按名称排序，支持多维度筛选）
    - 厂商列表页
    - 女优详情页（头像、封面、资料卡片、作品列表）
    - 厂商详情页（Logo、简介、作品列表）
    - 电影详情页展示女优/厂商可点击卡片
  - **Dashboard**：
    - 电影编辑页支持选择/添加女优/厂商
    - 女优管理页（已有）扩展筛选器
    - 厂商管理页（已有）扩展筛选器

- **数据迁移**：
  - 将现有 `movies.actors` 字符串数组迁移至 `movie_actors` 关联表，创建 `actors` 实体
  - 将现有 `movies.publisher` 字符串迁移至 `movie_publishers` 关联表，创建 `publishers` 实体
  - 保留原字段 3 个月作为备份，确保回滚安全

## Capabilities

### New Capabilities

- `actor-relations`: 女优与电影的 N:M 关联管理，包括数据模型、爬虫策略、API 接口、客户端展示
- `publisher-relations`: 厂商与电影的 N:M 关联管理，包括数据模型、爬虫策略、API 接口、客户端展示

### Modified Capabilities

- `javbus-crawler`: 从仅爬取电影基础信息，扩展为同步爬取女优/厂商详情页，实现智能去重与失败降级

## Impact

**数据库**：
- 新增 2 张关联表，扩展 2 张实体表字段
- 需执行数据迁移脚本，预计影响现有全部电影数据（约 1000+ 条）

**后端 API**（`apps/api`）：
- 新增女优/厂商 CRUD 接口（6-8 个端点）
- 修改电影详情/列表接口，返回关联的女优/厂商信息
- 修改爬虫任务逻辑，增加详情页爬取与去重

**前端客户端**（`apps/movie-app`）：
- 新增女优列表页、女优详情页
- 新增厂商列表页、厂商详情页
- 修改电影详情页布局，展示女优/厂商卡片

**管理后台**（`apps/dashboard`）：
- 电影编辑页新增女优/厂商选择器组件
- 女优/厂商管理页增强筛选器

**依赖**：
- 无新增外部依赖
- 需升级 Drizzle ORM 迁移脚本

**部署**：
- 需在生产环境执行数据库迁移（约 5-10 分钟停机窗口）
- Cloudflare Workers 代码更新（API 与 Gateway 无需重启）

**风险**：
- 数据迁移失败可能导致电影-女优关联丢失（已设计回滚方案）
- 爬虫频率增加可能触发反爬机制（需控制并发与延迟）
- 新增关联表可能影响电影列表查询性能（需验证索引效果）
