## Purpose

为 Quant 股东回报提供可解释的公开数据源回退，同时让用户和研究报告知道每个结果实际来自哪个 provider。

## ADDED Requirements

### Requirement: 分红 provider 链必须可解释

股东回报读取 MUST 按当前 Quant provider 配置确定主源和回退顺序。默认配置在存在服务端 Tushare token 时以 Tushare 为主、Eastmoney 为回退；没有 token 时直接使用 Eastmoney。主源未配置、配额耗尽、超时、上游失败或响应无效时，若回退源已配置，系统 MUST 最多尝试一次回退源，并在成功结果中返回实际 `provider`、`fallbackUsed`、`fallbackReason` 和 `providerChain`。

#### Scenario: Tushare 配额耗尽后回退

- **WHEN** Tushare `dividend` 返回配额耗尽，Eastmoney 返回目标股票的合法分红响应
- **THEN** 股东回报结果使用 Eastmoney 的记录计算
- **AND** 单股结果标记 `provider=eastmoney`、`fallbackUsed=true`、`fallbackReason=QUANT_PROVIDER_QUOTA`
- **AND** 不把 Tushare 的失败响应当作空分红记录

#### Scenario: 主源和回退源均失败

- **WHEN** 主源和回退源都超时、失败或返回无效数据
- **THEN** 该股票返回 `partial` 或 `insufficient_data`
- **AND** 股息金额、股息率保持 `null`
- **AND** 返回主源和回退源的错误类别，其他股票继续独立处理

#### Scenario: 无 Tushare token

- **WHEN** 服务端没有 Tushare token 且没有强制选择无效 provider
- **THEN** 系统直接使用 Eastmoney，不发出 Tushare 请求
- **AND** 批量响应仍返回可用的 provider 链状态

### Requirement: Eastmoney 分红记录必须 fail-closed

Eastmoney dividend provider MUST 只接受目标证券代码匹配、响应结构合法、`ASSIGN_PROGRESS` 表示已实施分配、`PRETAX_BONUS_RMB` 为有限数值且除以 10 后得到每股现金分红的记录。报告期、公告日和除息日 MUST 经过日期校验；预披露、预案、空值、错误证券代码和非数值字段 MUST 被丢弃或令本次 provider 失败，不得生成猜测分红。

#### Scenario: 读取已实施记录

- **WHEN** Eastmoney 返回 `SECURITY_CODE` 与请求代码一致、`ASSIGN_PROGRESS=实施分配`、每十股税前现金红利为 `4.2`
- **THEN** 标准化记录包含 `cashDiv=0.42`、报告期、公告日和除息日
- **AND** 该记录可参与近 12 个月股息率计算

#### Scenario: 只有预披露或预案

- **WHEN** Eastmoney 只返回未实施分配状态或现金红利为空
- **THEN** provider 结果不包含可计算的实施记录
- **AND** 股息率保持 `null` 并列出数据缺口

### Requirement: 来源元数据必须贯穿研究结果

股东回报单项和批量 API MUST 返回实际来源状态；研究报告的股东回报 evidence、source 和因子模型来源描述 MUST 与实际命中的 provider 一致。回退成功不得改变股息率公式、观察池最新本地收盘价分母或数据完整度规则。

#### Scenario: 回退来源进入研究报告

- **WHEN** 研究报告使用 Eastmoney 回退得到的股东回报
- **THEN** 报告来源显示 Eastmoney 分红实施记录并保留回退原因
- **AND** `shareholder-yield` 和连续分红证据仍只使用已实施记录
- **AND** 未达到完整覆盖度时最终推荐仍可收敛为观望

### Requirement: 接口和前端保持认证及缺失边界

`GET /api/quant/shareholder-returns` MUST 继续使用现有 Quant 管理员认证；Tushare token MUST 只在服务端请求中使用。Quant 工作台 MUST 展示当前股票的实际分红来源和回退状态，源失败或缺失时显示可解释的缺口，不把缺失字段渲染为零。

#### Scenario: 未认证访问

- **WHEN** 未登录用户请求股东回报接口
- **THEN** 返回现有认证错误
- **AND** 不调用 Tushare 或 Eastmoney provider

#### Scenario: 窄屏展示

- **WHEN** 在 390px 宽度打开研究详情
- **THEN** 来源、回退原因和数据缺口可以换行展示
- **AND** 不产生页面横向溢出或遮挡研究抽屉控件
