## ADDED Requirements

### Requirement: 批量状态查询

爬虫 SHALL 在开始爬取前调用批量状态查询 API，获取指定代码列表的已存在状态。该接口必须支持服务令牌认证，并返回已存在内容的代码列表。

#### Scenario: 成功查询已存在内容

- **WHEN** 爬虫携带有效 `CRAWLER_SECRET` 调用 `/api/admin/movies/batch-status?codes=code1,code2,code3`
- **THEN** API 返回 200 状态码和 JSON `{ "existingCodes": ["code1", "code3"] }`

#### Scenario: 查询空列表

- **WHEN** 爬虫调用批量状态查询接口，参数 `codes` 为空字符串
- **THEN** API 返回 400 状态码和错误信息 `"codes parameter is required"`

#### Scenario: 无效服务令牌

- **WHEN** 爬虫使用无效或缺失的 `x-service-token` 调用批量状态查询
- **THEN** API 返回 401 状态码

### Requirement: 增量过滤逻辑

爬虫 SHALL 在获取批量状态查询结果后，从待爬取列表中过滤掉已存在的内容，仅爬取新内容。过滤操作必须在爬取循环之前完成。

#### Scenario: 过滤已存在电影

- **WHEN** 爬虫发现待爬取列表 `[{ code: 'A' }, { code: 'B' }, { code: 'C' }]`，且批量查询返回 `existingCodes: ['A', 'C']`
- **THEN** 爬虫仅处理 `{ code: 'B' }`，跳过 A 和 C

#### Scenario: 无已存在内容

- **WHEN** 批量查询返回空的 `existingCodes` 列表
- **THEN** 爬虫处理所有待爬取内容

#### Scenario: 全部已存在

- **WHEN** 批量查询返回的 `existingCodes` 包含所有待爬取代码
- **THEN** 爬虫输出 "所有内容已存在，跳过爬取" 并正常退出（退出码 0）

### Requirement: 配置正确传递

爬虫启动脚本 SHALL 从环境变量读取 `MAX_MOVIES` 和 `CRAWLER_MAX` 配置，不得使用代码内默认值。如果环境变量未设置，脚本必须抛出错误并退出。

#### Scenario: 缺失 MAX_MOVIES 环境变量

- **WHEN** 电影爬虫启动时 `MAX_MOVIES` 环境变量未设置
- **THEN** 脚本输出 "Error: MAX_MOVIES environment variable is required" 并以退出码 1 退出

#### Scenario: 正确读取配置

- **WHEN** 工作流设置 `MAX_MOVIES=200`
- **THEN** 爬虫配置的 `limits.maxMovies` 值为 200，且 `ProgressMonitor` 初始化时使用 200 作为总数

### Requirement: 进度监控增强

爬虫 SHALL 在进度输出中显示增量统计信息，包括：已存在数量、跳过数量、新增数量、增量命中率（已存在 / 总发现）。

#### Scenario: 显示增量统计

- **WHEN** 爬虫发现 100 部电影，其中 60 部已存在，处理 40 部新电影
- **THEN** 进度输出包含 "已存在: 60 (60.0%), 新增: 40 (40.0%)"

#### Scenario: 无增量命中

- **WHEN** 所有发现的内容都是新内容
- **THEN** 进度输出显示 "已存在: 0 (0.0%), 新增: 100 (100.0%)"
