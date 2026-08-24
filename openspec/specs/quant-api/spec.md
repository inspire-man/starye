# quant-api Specification

## Purpose
定义量化工作台的服务端 API、鉴权、能力响应和同步状态契约。

## Requirements

### Requirement: API 前缀与鉴权

量化 API MUST 挂载在 `/api/quant` 下。观察池、同步、候选快照和日线接口 MUST 使用现有管理员会话校验；Tushare token MUST 不出现在 API 响应、前端构建变量或日志中。

#### Scenario: 未登录访问量化 API

- **WHEN** 请求 `/api/quant/watchlist` 或任一量化写接口且没有管理员会话
- **THEN** API 返回 `401` JSON 错误
- **AND** 不访问 D1 写入逻辑或 Tushare provider

#### Scenario: 非管理员访问量化 API

- **WHEN** 已登录用户没有 `admin`、`super_admin` 或配置的管理员白名单
- **THEN** API 返回 `403` JSON 错误

### Requirement: 能力查询

`GET /api/quant/capabilities` MUST 返回当前积分档位、已启用能力和每项能力的状态原因。默认积分档位 MUST 为 `120`，默认 enabled 集合 MUST 只包含 `daily`。

#### Scenario: 120 积分能力响应

- **WHEN** `TUSHARE_POINTS_TIER` 缺失或为 `120`
- **THEN** 响应包含 `tier: 120`、`enabled: ['daily']`
- **AND** `stock_basic`、`trade_cal`、`daily_basic` 标记为未启用并包含升级原因

#### Scenario: 2000 积分能力响应

- **WHEN** provider 配置为 `2000`
- **THEN** registry 暴露 `daily`、`stock_basic`、`trade_cal`、`daily_basic`
- **AND** 调用方无需修改其能力声明接口

### Requirement: 观察池和数据查询

API MUST 提供观察池 CRUD、候选快照查询和指定股票日线查询。观察池默认最多 50 个唯一股票代码；写入重复代码 MUST 返回幂等成功或稳定冲突，而不能创建重复观察项。

#### Scenario: 创建观察项

- **WHEN** 管理员提交合法 `ts_code` 和可选名称
- **THEN** API 持久化观察项并返回规范化记录
- **AND** 超过 50 个观察项时返回 `409` 且不写入新记录

#### Scenario: 查询个股日线

- **WHEN** 管理员请求指定 `ts_code` 和可选日期范围
- **THEN** API 返回按交易日升序排列的标准化日线
- **AND** 不存在的数据返回空数组而不是伪造数据

### Requirement: 同步状态

同步接口 MUST 使用 capability gate，并返回可读的 `completed`、`partial` 或 `rejected` 状态、请求范围、写入数量和原因。缺少 `daily` 或 provider 配置错误时 MUST fail-closed，不产生成功快照。120 积分 v1 MUST NOT 调用 `trade_cal`：默认日期范围为最近 180 个自然日，provider 返回结果经过日期过滤、去重和排序后，每只股票最多保留最新 120 根日线；这表示 provider 返回的日线条数上限，不承诺精确 120 个交易日。候选结果中的 `return20` MUST 使用 21 根 bar 和 20 个价格间隔，公式为 `close[-1] / close[-21] - 1`，历史不足 21 根时为 `null`。

#### Scenario: 日线同步

- **WHEN** 管理员请求同步观察池，未提供日期时使用最近 180 个自然日
- **THEN** API 按观察池同步 `daily`，每个代码最多写入 provider 返回的最新 120 根日线，并返回写入和跳过数量以及同步状态
- **AND** 节假日、停牌日等缺失日期保持缺失，API 不补造交易日

#### Scenario: 能力不足或配额耗尽

- **WHEN** 请求需要未启用能力，或 Tushare 返回配额耗尽
- **THEN** 响应返回稳定错误码和 `rejected`/`partial` 状态
- **AND** 已有 D1 日线与快照保持不被错误结果覆盖

### Requirement: 同步资源与全局互斥

单次同步 MUST 限制 provider 调用最多 4 个并发、单调用 10 秒超时和 120 秒总时限。总时限到达时，已完成的股票可以落库；仍未完成的股票 MUST 计入跳过/错误范围，至少一只成功时返回 `partial`，一只也没有成功时返回 `rejected`。同一时间全局只允许一个 `daily` 同步持有租约；检测到未过期租约时 MUST 返回 HTTP `409`、稳定错误码 `QUANT_SYNC_IN_PROGRESS`，且不发起 provider 请求或覆盖现有状态/快照。

#### Scenario: 重复同步请求

- **WHEN** 一个 `daily` 同步仍持有有效租约，另一个管理员请求 `POST /api/quant/sync`
- **THEN** 第二个请求返回 `409` 和 `QUANT_SYNC_IN_PROGRESS`
- **AND** 第二个请求不调用 Tushare、不写入新的同步状态和候选快照

#### Scenario: 总时限到达

- **WHEN** provider 调用在 120 秒总时限内未全部完成
- **THEN** 已完成代码的数据按幂等规则持久化，响应状态为 `partial` 或 `rejected`
- **AND** 响应的 `skippedCount`/原因可解释尚未完成的范围，不能返回 `completed`

### Requirement: Research marker API

Quant API MUST expose authenticated research marker read and upsert endpoints under `/api/quant`. The upsert endpoint MUST validate the four research statuses and MUST only accept codes currently present in the watchlist.

#### Scenario: Read watchlist markers

- **WHEN** an administrator requests `GET /api/quant/research`
- **THEN** the API returns one marker per watchlist code
- **AND** a code without a stored marker is returned as `unreviewed`

#### Scenario: Upsert a marker

- **WHEN** an administrator sends `PUT /api/quant/research/:tsCode` with a valid status, note, and optional review date
- **THEN** the API returns the persisted marker
- **AND** repeating the request updates the same marker instead of creating another row

#### Scenario: Reject an unknown code

- **WHEN** an administrator updates a code outside the watchlist
- **THEN** the API returns `404 QUANT_NOT_FOUND`
- **AND** no research marker row is written
