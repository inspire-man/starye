# quant-shareholder-interest-evidence Specification

## ADDED Requirements

### Requirement: Align interest and debt fields to the cashflow report period

Quant 现金流 provider MUST 以现金流量表报告期为主记录，并将同一 `reportDate` 的利润表和资产负债表字段合并到该记录。利息支出 MUST 优先读取 Eastmoney 利润表的 `FE_INTEREST_EXPENSE`，当该字段没有可靠值时再读取 `INTEREST_EXPENSE`；provider MUST 保留采用的来源字段。缺少可靠值时对应字段 MUST 为 `null`。

#### Scenario: Normalize a general-company interest expense

- **WHEN** 同一报告期的利润表返回有限 `FE_INTEREST_EXPENSE`
- **THEN** 现金流报告的 `interestExpense` 使用该值
- **AND** 来源字段标记为 `FE_INTEREST_EXPENSE`

#### Scenario: Use the financial-company interest field only when needed

- **WHEN** `FE_INTEREST_EXPENSE` 为空而 `INTEREST_EXPENSE` 为有限数值
- **THEN** `interestExpense` 使用 `INTEREST_EXPENSE`
- **AND** 不把两个字段相加或把空字段当成零

#### Scenario: Do not mix report periods

- **WHEN** 利润表或资产负债表没有与现金流报告相同的 `REPORT_DATE`
- **THEN** 该报告的对应利息或债务字段保持为 `null`
- **AND** 其他同报告期现金流字段继续返回

### Requirement: Calculate transparent interest and debt coverage

系统 MUST 只使用同一报告期的有限值计算 `freeCashflowAfterInterest = operatingCashflow - capitalExpenditure - interestExpense`；结果 MUST 保留负值，不得截断为零。`interestBearingDebt` MUST 等于明确借款、融资负债、债券、租赁和一年内到期非流动负债行项目中有限值的合计，并 MUST 同时返回这些组件；没有任何有限组件时合计 MUST 为 `null`。

#### Scenario: Calculate post-interest free cashflow

- **WHEN** 经营现金流、资本开支和利息支出均为有限数值
- **THEN** 系统返回按同一报告期计算的 `freeCashflowAfterInterest`
- **AND** 负的利息后自由现金流保持为负数

#### Scenario: Preserve debt components

- **WHEN** 资产负债表返回短期借款、长期借款、应付债券、租赁负债或一年内到期非流动负债
- **THEN** `interestBearingDebt` 等于所有已返回的明确有息组件之和
- **AND** 每个未返回的组件保留为 `null`，页面不显示伪造零值

### Requirement: Isolate auxiliary statement failures

现金流量表请求成功而利润表或资产负债表辅助请求失败时，provider MUST 保留现金流量表的原始字段，并通过安全的来源错误码和 `missingFields` 标识对应利息或债务缺口。现金流 evidence 的 `ready` 状态继续表示经营现金流和资本开支已完整，不代表利息和有息负债字段全部可用；现金流量表自身失败仍 MUST 返回 `unavailable`。

#### Scenario: Keep core cashflow after income failure

- **WHEN** 利润表请求超时或返回坏响应，但现金流量表有合法报告
- **THEN** `operatingCashflow`、`capitalExpenditure` 和 `freeCashflow` 继续返回
- **AND** `interestExpense` 为 `null`，错误码和缺口可见，利息后自由现金流为 `null`

#### Scenario: Keep existing evidence boundaries

- **WHEN** 利息或债务证据可用、部分可用或辅助来源失败
- **THEN** 分红记录、自由现金流覆盖、支付率和既有股东回报状态继续按原公式返回
- **AND** 新字段不参与价值质量分、因子权重、研究动作、推荐或决策助手

### Requirement: Expose the evidence through API, research, and workbench

受保护的 `GET /api/quant/shareholder-returns` MUST 在新生成的现金流 evidence 中返回利息支出来源、有息负债组件、利息后自由现金流及安全错误码；前端 MUST 同时支持 camelCase/snake_case 和缺少新增字段的历史 payload。研究报告 MUST 将利息支出、有息负债和利息后自由现金流作为 optional shareholder-return evidence，投资知识目录 MUST 将 `operatingCashflow`、`capitalExpenditure`、`interestExpense`、`interestBearingDebt` 标记为可用。

#### Scenario: Render complete and partial interest evidence

- **WHEN** 现金流 evidence 包含完整或部分利息/债务字段
- **THEN** 详情页显示报告期、利息支出、利息后自由现金流和有息负债
- **AND** 缺失字段、来源时间和错误码按现有证据样式显示

#### Scenario: Read a legacy cashflow payload

- **WHEN** 历史 payload 的 `cashflowEvidence` 没有新增字段
- **THEN** client 将新增数值和组件归一化为 `null`
- **AND** 旧股东回报与研究详情继续正常渲染
