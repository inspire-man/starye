## ADDED Requirements

### Requirement: 女优批量状态查询 API

系统 MUST 提供 `GET /api/admin/actors/batch-status` 端口用于批量查询女优状态，SHALL 接受 `ids` 查询参数（逗号分隔的女优 ID 列表），MUST 返回每个 ID 对应的状态信息（exists, hasDetailsCrawled, crawlFailureCount 等）。

#### Scenario: 批量查询女优存在性
- **WHEN** 调用 `GET /api/admin/actors/batch-status?ids=actor1,actor2,actor3`
- **THEN** 系统返回 JSON 对象 `{ "actor1": { exists: true, hasDetailsCrawled: false, ... }, "actor2": { exists: false }, ... }`

#### Scenario: 高效查询实现
- **WHEN** 查询 100 个女优 ID
- **THEN** 系统使用 `inArray` 条件单次查询数据库，响应时间 <1000ms，避免 N+1 查询问题

#### Scenario: 不存在的女优处理
- **WHEN** 查询的 ID 在数据库中不存在
- **THEN** 返回 `{ exists: false }`，不抛出错误，允许爬虫识别新女优

### Requirement: 女优待爬取列表 API

系统 MUST 提供 `GET /api/admin/actors/pending` 端口用于获取待爬取的女优列表，SHALL 接受 `limit` 查询参数（默认 150），MUST 只返回 `hasDetailsCrawled=false` 且 `sourceUrl` 非空且 `crawlFailureCount < 3` 的记录。

#### Scenario: 获取待爬取女优
- **WHEN** 调用 `GET /api/admin/actors/pending?limit=150`
- **THEN** 系统返回最多 150 个女优记录，每个包含 id, name, sourceUrl, movieCount, crawlFailureCount, lastCrawlAttempt 字段

#### Scenario: 过滤失败记录
- **WHEN** 数据库中有女优 `crawlFailureCount >= 3`
- **THEN** 该女优不出现在待爬取列表中，避免无限重试

#### Scenario: 过滤已完成记录
- **WHEN** 数据库中有女优 `hasDetailsCrawled=true`
- **THEN** 该女优不出现在待爬取列表中，实现增量爬取

#### Scenario: 必须有 sourceUrl
- **WHEN** 数据库中有女优 `sourceUrl IS NULL` 或空字符串
- **THEN** 该女优不出现在待爬取列表中，因为无法爬取详情

### Requirement: 女优详情更新 API

系统 MUST 提供 `POST /api/admin/actors/:id/details` 端口用于更新女优详情，SHALL 接受包含 avatar, bio, birthDate 等字段的 JSON body，MUST 更新数据库记录并设置 `hasDetailsCrawled=true`。

#### Scenario: 更新女优详情
- **WHEN** 调用 `POST /api/admin/actors/actor123/details` 并传入 `{ avatar: 'url', bio: 'text', birthDate: '1990-01-01', ... }`
- **THEN** 系统更新 actors 表的 actor123 记录，设置所有详情字段，设置 `hasDetailsCrawled=true`，更新 `lastCrawlAttempt` 时间戳

#### Scenario: 计算数据完整度
- **WHEN** 更新女优详情时
- **THEN** 系统计算数据完整度分数（根据字段权重），在响应中返回 `dataCompleteness` 字段（如 0.85）

#### Scenario: 头像字段可选
- **WHEN** 请求 body 中 `avatar` 字段为 null 或缺失
- **THEN** 系统不抛出错误，允许部分字段更新，完整度分数相应降低

#### Scenario: 失败计数重置
- **WHEN** 成功更新女优详情后
- **THEN** 系统将 `crawlFailureCount` 重置为 0，允许该女优在未来的补全模式中被再次爬取

### Requirement: 厂商批量状态查询 API

系统 MUST 提供 `GET /api/admin/publishers/batch-status` 端口用于批量查询厂商状态，SHALL 接受 `ids` 查询参数（逗号分隔的厂商 ID 列表），MUST 返回每个 ID 对应的状态信息。

#### Scenario: 批量查询厂商存在性
- **WHEN** 调用 `GET /api/admin/publishers/batch-status?ids=pub1,pub2,pub3`
- **THEN** 系统返回 JSON 对象 `{ "pub1": { exists: true, hasDetailsCrawled: false, ... }, "pub2": { exists: false }, ... }`

#### Scenario: 高效查询实现
- **WHEN** 查询 100 个厂商 ID
- **THEN** 系统使用 `inArray` 条件单次查询数据库，响应时间 <1000ms

### Requirement: 厂商待爬取列表 API

系统 MUST 提供 `GET /api/admin/publishers/pending` 端口用于获取待爬取的厂商列表，SHALL 接受 `limit` 查询参数（默认 100），MUST 只返回 `hasDetailsCrawled=false` 且 `sourceUrl` 非空且 `crawlFailureCount < 3` 的记录。

#### Scenario: 获取待爬取厂商
- **WHEN** 调用 `GET /api/admin/publishers/pending?limit=100`
- **THEN** 系统返回最多 100 个厂商记录，每个包含 id, name, sourceUrl, movieCount, crawlFailureCount, lastCrawlAttempt 字段

#### Scenario: 应用相同的过滤规则
- **WHEN** 查询待爬取厂商时
- **THEN** 系统应用与女优相同的过滤规则（未爬取、有 URL、失败次数 < 3）

### Requirement: 厂商详情更新 API

系统 MUST 提供 `POST /api/admin/publishers/:id/details` 端口用于更新厂商详情，SHALL 接受包含 logo, website, description 等字段的 JSON body，MUST 更新数据库记录并设置 `hasDetailsCrawled=true`。

#### Scenario: 更新厂商详情
- **WHEN** 调用 `POST /api/admin/publishers/pub123/details` 并传入 `{ logo: 'url', website: 'https://...', description: 'text', ... }`
- **THEN** 系统更新 publishers 表的 pub123 记录，设置所有详情字段，设置 `hasDetailsCrawled=true`

#### Scenario: 计算数据完整度
- **WHEN** 更新厂商详情时
- **THEN** 系统计算数据完整度分数（logo 30%, website 20%, description 20%, foundedYear 15%, country 15%），在响应中返回

### Requirement: 女优和厂商批量同步 API

系统 MUST 提供 `POST /api/admin/actors/batch-sync` 和 `POST /api/admin/publishers/batch-sync` 端口，SHALL 用于电影爬虫批量创建或更新女优/厂商基础记录，MUST 根据 name 查找已存在记录并更新 sourceUrl。

#### Scenario: 批量同步女优
- **WHEN** 电影爬虫调用 `POST /api/admin/actors/batch-sync` 并传入 `{ actors: [{ name: '女优A', sourceUrl: 'url1' }, ...] }`
- **THEN** 系统对每个女优：如果 name 已存在则更新 sourceUrl 和 movieCount，如果不存在则创建新记录（hasDetailsCrawled=false）

#### Scenario: 批量同步厂商
- **WHEN** 电影爬虫调用 `POST /api/admin/publishers/batch-sync` 并传入 `{ publishers: [{ name: '厂商A', sourceUrl: 'url1' }, ...] }`
- **THEN** 系统对每个厂商执行相同的创建或更新逻辑

#### Scenario: 性能优化
- **WHEN** 批量同步 50 个女优/厂商
- **THEN** 系统使用批量查询和批量插入/更新，总响应时间 <3000ms

#### Scenario: 幂等性保证
- **WHEN** 同一个女优/厂商多次出现在同步请求中
- **THEN** 系统只更新一次，不创建重复记录

### Requirement: API 认证与权限

系统 MUST 对所有女优和厂商管理端口应用 `serviceAuth(['admin'])` 中间件，SHALL 验证请求中的 `x-crawler-secret` 或 admin session token，MUST 拒绝未授权的请求并返回 401 或 403 错误。

#### Scenario: 爬虫调用验证
- **WHEN** 爬虫调用 API 时在请求头中包含 `x-crawler-secret: <secret>`
- **THEN** 如果 secret 匹配环境变量 `CRAWLER_SECRET`，允许请求通过

#### Scenario: 未授权请求拒绝
- **WHEN** 请求缺少认证头或 secret 不匹配
- **THEN** 系统返回 401 Unauthorized，拒绝执行操作
