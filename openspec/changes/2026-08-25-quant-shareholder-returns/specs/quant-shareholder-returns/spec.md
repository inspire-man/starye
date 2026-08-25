## Purpose

为中长线价值投资研究提供可追溯的现金流韧性和股东现金回报上下文，并在数据源权限不足时保持缺失态，不把未知数据变成评分或收益结论。

## ADDED Requirements

### Requirement: 财务韧性字段可追溯

系统 MUST 在财务报告存在对应 Eastmoney 字段时返回经营现金流/股、FCFF、利息覆盖率、带息负债率、现金比率和负债规模，并保留原始报告期与观察时间。

#### Scenario: 字段存在

- **WHEN** Eastmoney 财报包含对应数值
- **THEN** API 和分析抽屉展示数值及报告期
- **AND** 这些字段不改变 `value-quality-v1` 的总分和权重

#### Scenario: 字段缺失

- **WHEN** 财报字段为空、非数字或上游未返回
- **THEN** 对应值为 `null`
- **AND** UI 显示数据缺口，不以零值代替

### Requirement: 股东回报接口受保护

`GET /api/quant/shareholder-returns` MUST 使用 Quant 现有认证边界，仅向已登录用户返回观察池股东回报数据；Tushare token MUST 只在服务端请求中使用。

#### Scenario: 未认证请求

- **WHEN** 请求没有有效会话
- **THEN** 返回现有认证错误状态
- **AND** 不发出 Tushare 请求

#### Scenario: 认证请求

- **WHEN** 请求通过认证
- **THEN** 返回观察池范围内的版本化批量结果
- **AND** 每个结果包含 `tsCode`、`name`、`status`、`observedAt`、数据源状态和 `missingFields`

### Requirement: 只使用已实施分红计算股息率

股东回报服务 MUST 只使用 Tushare `div_proc=实施` 且具有有效除权日或支付日的记录；近 12 个月现金股息 MUST 按实施记录的现金分红/股计算，股息率仅在最新本地日线收盘价为正时计算。

#### Scenario: 有完整实施记录和价格

- **WHEN** 股票有近 12 个月有效实施记录且观察池存在正的最新收盘价
- **THEN** 返回近 12 个月每股现金分红和股息率
- **AND** 返回实施记录及其报告期、除权日或支付日

#### Scenario: 只有预案或没有价格

- **WHEN** 只有预案/通过记录，或没有正的本地收盘价
- **THEN** 股息率为 `null`
- **AND** `missingFields` 说明缺少已实施分红或价格

### Requirement: 单只数据失败不阻断整批

批量接口 MUST 对单只 Tushare 超时、权限不足、空响应或代码不匹配返回 `partial` 或 `insufficient_data`，不得用零值补齐，并继续处理其他观察池股票。

#### Scenario: Tushare 不可用

- **WHEN** token 未配置、接口无权限或请求失败
- **THEN** 接口仍返回 200 的业务结果 envelope
- **AND** 受影响股票标记缺失原因，其他股票结果保持独立

### Requirement: 工作台提供可理解的研究上下文

分析抽屉 MUST 展示现金流韧性和股东回报上下文，并明确“未进入价值质量总分”的边界；首页统计区和现有价值质量分不得因本变更增加运管积分或数据能力卡片。

#### Scenario: 读取分析详情

- **WHEN** 用户打开观察池股票分析抽屉
- **THEN** 可以看到报告期、现金流/负债指标、近 12 个月现金分红和股息率状态
- **AND** 资本开支逐项数据、回购和支付率仍显示为数据缺口或未接通说明
