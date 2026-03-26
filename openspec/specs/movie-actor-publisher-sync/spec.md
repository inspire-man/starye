## MODIFIED Requirements

### Requirement: 电影爬虫收集女优详情页 URL

系统 MUST 在电影爬虫（JavBusCrawler）中收集女优详情页 URL，SHALL 在 `processMovie()` 方法中从 `movieInfo.actorDetails` 提取女优信息，MUST 将女优名称和 sourceUrl 存储到 Map 中进行去重。

#### Scenario: 收集女优 URL
- **WHEN** 电影爬虫解析电影详情页并获取 `movieInfo.actorDetails`
- **THEN** 系统遍历 actorDetails 数组，对每个女优将 `{ name, sourceUrl }` 存储到 `collectedActorDetails` Map 中（key 为 name）

#### Scenario: 去重处理
- **WHEN** 多部电影包含同一个女优
- **THEN** 系统使用 Map 的 key 唯一性自动去重，每个女优只保留一条记录

#### Scenario: 缺失 sourceUrl 处理
- **WHEN** 某个女优的 sourceUrl 为 null 或空字符串
- **THEN** 系统跳过该女优，不添加到 Map 中

### Requirement: 电影爬虫收集厂商详情页 URL

系统 MUST 在电影爬虫中收集厂商详情页 URL，SHALL 在 `processMovie()` 方法中从 `movieInfo.publisherUrl` 提取厂商信息，MUST 将厂商名称和 URL 存储到 Map 中。

#### Scenario: 收集厂商 URL
- **WHEN** 电影爬虫解析电影详情页并获取 `movieInfo.publisher` 和 `movieInfo.publisherUrl`
- **THEN** 系统将 `{ name: movieInfo.publisher, sourceUrl: movieInfo.publisherUrl }` 存储到 `collectedPublisherUrls` Map 中（key 为 name）

#### Scenario: 厂商去重
- **WHEN** 多部电影属于同一个厂商
- **THEN** 系统自动去重，每个厂商只保留一条记录

### Requirement: 批量同步女优和厂商到 API

系统 MUST 在电影爬虫运行结束后批量同步女优和厂商数据到 API，SHALL 调用新的 `syncActorsAndPublishers()` 方法，MUST 使用 `apiClient.batchSyncActors()` 和 `apiClient.batchSyncPublishers()` 批量创建或更新记录。

#### Scenario: 同步时机
- **WHEN** 电影爬虫的 `run()` 方法中所有电影处理完成（`waitForAll()` 后）
- **THEN** 系统调用 `syncActorsAndPublishers()` 进行批量同步

#### Scenario: 批量同步女优
- **WHEN** `syncActorsAndPublishers()` 被调用
- **THEN** 系统将 `collectedActorDetails` Map 转换为数组，调用 `POST /api/admin/actors/batch-sync`

#### Scenario: 批量同步厂商
- **WHEN** `syncActorsAndPublishers()` 被调用
- **THEN** 系统将 `collectedPublisherUrls` Map 转换为数组，调用 `POST /api/admin/publishers/batch-sync`

#### Scenario: 同步失败处理
- **WHEN** 批量同步 API 调用失败
- **THEN** 系统记录错误日志但不中断爬虫运行，下次爬虫运行时会再次收集和同步

### Requirement: 同步统计日志

系统 MUST 在同步完成后输出统计日志，SHALL 包含同步的女优数量和厂商数量，MUST 使用清晰的格式便于监控。

#### Scenario: 输出同步统计
- **WHEN** `syncActorsAndPublishers()` 完成后
- **THEN** 系统输出日志 "✅ 女优: X 个" 和 "✅ 厂商: Y 个"

#### Scenario: 空数据处理
- **WHEN** 电影爬虫未收集到任何女优或厂商（如只爬取了已处理的电影）
- **THEN** 系统输出 "✅ 女优: 0 个"，不调用 API

### Requirement: ApiClient 扩展方法

系统 MUST 在 ApiClient 类中添加 `batchSyncActors()` 和 `batchSyncPublishers()` 方法，SHALL 调用对应的批量同步 API 端口，MUST 处理超时和错误。

#### Scenario: batchSyncActors 实现
- **WHEN** 调用 `apiClient.batchSyncActors([{ name, sourceUrl }, ...])`
- **THEN** 系统发送 `POST /api/admin/actors/batch-sync` 请求，超时时间 60 秒

#### Scenario: batchSyncPublishers 实现
- **WHEN** 调用 `apiClient.batchSyncPublishers([{ name, sourceUrl }, ...])`
- **THEN** 系统发送 `POST /api/admin/publishers/batch-sync` 请求，超时时间 60 秒

#### Scenario: 错误重试
- **WHEN** 批量同步请求失败（网络错误、超时等）
- **THEN** 系统不进行自动重试，记录错误并继续（下次爬虫运行时会再次尝试）

### Requirement: 保持电影爬虫核心逻辑不变

系统 MUST 确保添加女优/厂商收集逻辑不影响电影爬虫的核心功能，SHALL 将收集逻辑设计为附加操作，MUST 确保即使收集或同步失败也不影响电影数据入库。

#### Scenario: 电影数据优先
- **WHEN** 电影爬虫处理每部电影时
- **THEN** 系统先完成电影数据的爬取、图片下载、API 同步，然后才收集女优/厂商 URL

#### Scenario: 收集失败不影响电影
- **WHEN** 从 movieInfo 提取 actorDetails 或 publisherUrl 时出错
- **THEN** 系统捕获错误并继续，电影数据正常入库

#### Scenario: 同步失败不影响统计
- **WHEN** `syncActorsAndPublishers()` 失败
- **THEN** 电影爬虫的统计报告（成功数、失败数）不受影响，正常输出
