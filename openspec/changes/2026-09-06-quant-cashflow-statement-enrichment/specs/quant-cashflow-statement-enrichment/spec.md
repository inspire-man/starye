## ADDED Requirements

### Requirement: 现金流报告必须保留同报告期的已验证利息和债务分项

AkShare bridge MUST 将利润表的明确利息字段和资产负债表的有息负债分项按同一 `report_date` 补充到 cashflow 记录。利息费用 MUST 只使用 `FE_INTEREST_EXPENSE` 或明确的 `INTEREST_EXPENSE`；有息负债 MUST 只使用已声明的资产负债表分项及其有限合计。未映射字段 MUST 保持 `null`。

#### Scenario: 同报告期补充现金流韧性字段

- **WHEN** 现金流报告为 `2026-06-30`，利润表返回有限 `FE_INTEREST_EXPENSE`，资产负债表返回有限有息负债分项
- **THEN** cashflow 记录包含利息费用、利息来源字段、债务合计和分项
- **AND** 经营现金流、资本开支和报告期保持不变
- **AND** 股利等未验证字段继续为 `null`

### Requirement: API 现金流 provider MUST 只补主源空字段

API cashflow provider chain MUST 在主来源已有报告时，只用同报告期 AkShare 记录填充 `null` 的利息费用、有息负债及其分项。主来源已有有限值、报告期、代码和其它字段 MUST 保持不变；实际补充 MUST 暴露 `supplementalProvider=akshare` 和 `supplementUsed=true`。

#### Scenario: 主源利息为空而 AkShare 有值

- **WHEN** 主现金流报告的利息费用为空，AkShare 同报告期返回有限利息费用
- **THEN** API 返回 AkShare 利息费用并保留主源经营现金流和资本开支
- **AND** 现金流来源元数据标记 AkShare 字段补充

#### Scenario: 主源已有债务值

- **WHEN** 主现金流报告已有有限有息负债，AkShare 同期返回另一债务合计
- **THEN** API 保留主源有息负债
- **AND** 不覆盖主源债务分项已存在的有限值

### Requirement: 代码、报告期和失败状态必须可解释

Bridge normalizer MUST 校验证券代码和合法报告期；代码错配或报告期无效的利润表、资产负债表和现金流行 MUST 被丢弃并记录稳定错误。任一 statement endpoint 失败 MUST 只造成对应字段缺口，不得丢弃其它有效现金流数据或生成零值、上一期值或跨期值。

#### Scenario: 资产负债表端点失败

- **WHEN** 利润表和现金流端点成功但资产负债表端点失败
- **THEN** cashflow 仍返回经营现金流和已映射利息费用
- **AND** 有息负债保持 `null`
- **AND** errors 包含资产负债表端点标识和稳定错误码

#### Scenario: 报告期不匹配

- **WHEN** cashflow 为 `2026-06-30` 而 statement 只有 `2025-12-31`
- **THEN** `2026-06-30` 的利息和债务字段保持 `null`
- **AND** 不跨期填充当前报告

### Requirement: 现金流来源必须按可用性继续探测

AkShare bridge MUST 在首选报表端点返回空结果、异常或缺少核心字段时，按固定顺序继续探测可用的季度、年度和 Sina 财报来源。Eastmoney 指标版财报 MUST 在现有指标来源缺少目标字段时参与财报补全。相同 `report_date` 的记录 MUST 只填充空字段，先返回来源的有限值 MUST 保持不变。

#### Scenario: 首选现金流端点失败后使用季度来源

- **WHEN** 报告期现金流端点失败而季度现金流端点返回两期有效记录
- **THEN** bridge 返回季度来源的标准化现金流记录
- **AND** source endpoints 包含实际使用的季度端点
- **AND** 首选端点失败保留在 errors，未泄漏上游异常正文

#### Scenario: Eastmoney 指标列名被标准化

- **WHEN** `stock_financial_analysis_indicator_em` 返回 `TOTALOPERATEREVE`、`PARENTNETPROFIT`、`ROEJQ`、`LIABILITY` 等列
- **THEN** bridge 将其映射到标准化财报字段
- **AND** 数值为有限值时不再被识别为字段缺失

### Requirement: 已恢复的来源错误不得降级完整响应

Bridge status MUST 表示仍未解决的数据缺口，而不是任一曾经失败的端点。日线、身份、财报或现金流首选来源失败后，备用来源返回满足当前请求所需的标准化数据时，bridge MUST 返回 `ready`，同时 MUST 在 `errors` 和 `source.endpoints` 中保留诊断信息。备用来源也失败或核心字段仍缺失时，bridge MUST 返回 `partial` 或 `unavailable`。

#### Scenario: 日线首选来源失败但 Tencent 来源可用

- **WHEN** `stock_zh_a_hist` 失败而 `stock_zh_a_hist_tx` 返回至少 20 根有效日线
- **THEN** response 包含 Tencent 标准化日线和 `stock_zh_a_hist_tx` endpoint
- **AND** response status 为 `ready`
- **AND** 首选端点错误仍保留在 errors
