# Quant AkShare 现金流来源覆盖 Specification

## ADDED Requirements

### Requirement: Bridge MUST provide a same-period cashflow fallback

AkShare bridge MUST 在标准现金流端点没有达到两期核心字段覆盖时尝试 `stock_financial_cash_new_ths`，并按报告期返回标准化现金流行。有效原始 `value` MUST 保留，未知指标 MUST 被忽略，缺失或非有限值 MUST 为 `null`。

#### Scenario: 同花顺现金流端点补齐历史

- **WHEN** 报告期、季度、年度和 Sina 现金流端点没有提供两期 `operating_cashflow`、`capital_expenditure`、`net_profit`
- **THEN** bridge 尝试 `stock_financial_cash_new_ths`
- **AND** `act_cash_flow_net`、`pay_fixed_assets_etc_cash`、`cash_net_profit` 和 `pay_dividends_profits_interest_cash` 分别映射到已有现金流字段
- **AND** response source endpoints 保留实际调用的同花顺端点

#### Scenario: 同花顺季度单期值不改变累计口径

- **WHEN** 同花顺行同时包含 `value` 和 `single`
- **THEN** bridge 使用报告期累计 `value`
- **AND** 不使用 `single` 替代缺失的累计值

### Requirement: Bridge MUST enrich net profit from the same report period

当现金流行的 `net_profit` 为空且同报告期标准化利润表存在有限 `net_profit` 时，bridge MUST 补入该原始利润表值；其他现金流字段 MUST 保持原值或 `null`。

#### Scenario: 季度现金流缺少净利润

- **WHEN** 现金流 `REPORT_DATE=2026-03-31` 的 `NETPROFIT` 为空，利润表同报告期 `net_profit=25165728674`
- **THEN** 现金流行返回 `net_profit=25165728674`
- **AND** 不根据经营现金流、资本开支或现金分红推导净利润

### Requirement: Existing Quant contracts MUST remain stable

API MUST 继续返回已有 `QuantCashflowReport`/`cashflowEvidence` 字段和来源元数据；自由现金流、覆盖倍数、利息后自由现金流、年度支付率、推荐和 D1 行为 MUST 保持不变。来源端点失败仍 MUST 保留安全错误码。

#### Scenario: 备用源成功但标准端点失败

- **WHEN** 一个标准 AkShare 现金流端点失败且同花顺备用源返回有效历史
- **THEN** bridge status 可以保持 `ready`，errors 仍记录该端点失败
- **AND** API/研究报告继续显示可用数据与实际 provider，不渲染上游异常文本
