## Why

爬虫爬取的所有电影数据，播放源（players）始终为空。根因分析发现存在两层断层：（1）主力爬虫 JavBus 是纯元数据站，`getMovieInfo()` 硬编码返回 `players: []`；（2）即便 JavDB/AvSox 策略正确爬取了磁力链接，爬虫调用的同步端点 `POST /api/movies/sync` 对应的 `syncMovieData()` 服务从未处理 `players` 字段，导致数据被静默丢弃。现有的 admin sync 端点（`/api/admin/sync`）已正确实现 players 写入，但爬虫根本未调用它。

## What Changes

- **修复同步服务**：`apps/api/src/routes/movies/services/sync.service.ts` 中的 `SyncMovieDataOptions` 类型 MUST 添加 `players` 字段，并在服务逻辑中写入 `players` 表
- **JavDB 补充爬虫**：新增一个独立脚本 `packages/crawler/src/scripts/enrich-players.ts`，从 JavDB 按影片 code 批量查找并补充磁力链接
- **爬虫 API 客户端**：`apiClient.syncMovie()` 发送的 payload SHALL 包含 `players` 数组（现已传递但同步服务丢弃）

## Capabilities

### New Capabilities

- `movie-player-sync`: 电影播放源同步 — 爬虫侧的 players 数据能够通过 `/api/movies/sync` 完整写入数据库
- `player-enrich-script`: 播放源补充脚本 — 对已入库但无播放源的影片，从 JavDB 批量补爬磁力链接

### Modified Capabilities

（无现有 spec 级别的行为变更）

## Impact

- **API 服务**: `apps/api/src/routes/movies/services/sync.service.ts` — 扩展类型与写入逻辑
- **爬虫脚本**: `packages/crawler/src/scripts/enrich-players.ts` — 新增补充脚本
- **爬虫策略**: `packages/crawler/src/strategies/javbus.ts` — 确认 `players: []` 说明（元数据站，播放源来源另行处理）
- **范围外**: Admin 端播放源管理 UI、播放源评分系统、爬虫主流程架构变更
