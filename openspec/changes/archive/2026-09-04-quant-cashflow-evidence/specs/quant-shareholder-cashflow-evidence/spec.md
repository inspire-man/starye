# quant-shareholder-cashflow-evidence Specification

## ADDED Requirements

### Requirement: Cashflow evidence uses disclosed report fields

Quant 股东回报结果 MUST 为观察池中的每只股票提供可选的 `cashflowEvidence`。当 Eastmoney 返回合法现金流量表时，结果 MUST 保留报告期、报告类型、公告日期、经营活动净现金流、购建长期资产支出、净利润和已分配股利；金额单位 MUST 为人民币元，缺少可靠值时 MUST 返回 `null`。

#### Scenario: Normalize a disclosed cashflow report

- **WHEN** Eastmoney 返回与请求股票代码匹配的现金流量表报告
- **THEN** `cashflowEvidence` 包含规范化的 `reportDate`、`reportType`、`noticeDate` 和原始金额字段
- **AND** 经营现金流和资本开支均为有限数值时，状态至少为 `ready`

#### Scenario: Preserve empty statement fields

- **WHEN** 报告中的经营现金流、资本开支、净利润或已分配股利为空、`-` 或 `--`
- **THEN** 对应字段返回 `null`
- **AND** 其他字段继续按有限数值返回，结果状态降为 `partial` 或 `insufficient_data`

### Requirement: Derived coverage formulas stay period-bound

系统 MUST 只使用同一现金流量表报告期内的原始字段计算自由现金流：`freeCashflow = operatingCashflow - capitalExpenditure`。当同一报告期的已分配股利为正数时，系统 MUST 计算 `freeCashflowCoverage = freeCashflow / cashDividendsPaid`；否则覆盖倍数 MUST 为 `null`。分红支付率 MUST 只使用最近完整年度报告，并按 `cashDividendsPaid / netProfit * 100` 计算，分母缺失或小于等于零时返回 `null`。

#### Scenario: Calculate free cashflow and distribution coverage

- **WHEN** 现金流报告包含经营现金流、资本开支和正的已分配股利
- **THEN** 自由现金流等于经营现金流减资本开支
- **AND** 覆盖倍数保留负值或小于 1 的事实，不截断为零或正数

#### Scenario: Do not mix interim profit with annual payout

- **WHEN** 最新报告是季度或中期报告且存在更近的完整年度报告
- **THEN** 最新报告只用于现金流和覆盖倍数
- **AND** 分红支付率使用最近完整年度报告的净利润与已分配股利

### Requirement: Field gaps and provider failures remain visible

每个 `cashflowEvidence` MUST 返回 `ready`、`partial`、`insufficient_data` 或 `unavailable` 状态，并通过 `missingFields` 明确列出缺失原始字段和当前数据源范围之外的回购金额、股本变化、利息支出。未接通字段 MUST 保持为 `null`，不得用现金流量表中的其他回购语义字段或推算值代替。单只 provider 失败 MUST 只影响该股票的现金流证据，不得覆盖同一结果中已成功的分红数据。

#### Scenario: Isolate an upstream failure

- **WHEN** 现金流量表请求超时、返回坏 JSON、代码错位或上游拒绝请求
- **THEN** 该股票的 `cashflowEvidence.status` 为 `unavailable`
- **AND** 股息率、分红记录和来源链继续按已成功的分红 provider 返回

#### Scenario: Report unsupported shareholder fields

- **WHEN** 当前 provider 没有稳定的回购金额、股本变化或利息支出绝对值字段
- **THEN** `missingFields` 明确列出这些字段
- **AND** `ready` 状态只表示已接通的现金流原始字段完整，不表示全部股东回报字段完整

### Requirement: API and workbench preserve compatibility

受保护的 `GET /api/quant/shareholder-returns` MUST 在每个新生成的 item 中返回 `cashflowEvidence`，并继续使用 `{ success: true, data }` envelope、观察池用户隔离和按股票的局部结果。前端 MUST 归一化 camelCase 与 snake_case，并在详情页展示报告期、金额、覆盖倍数、支付率、来源和缺口；历史没有该字段的结果 MUST 仍可读取。

#### Scenario: Render a partial cashflow result

- **WHEN** 股息数据成功、现金流报告只有部分字段或现金流 provider 失败
- **THEN** 详情页保留已成功的股息率和分红记录
- **AND** 现金流区域显示状态、可用字段和可重试的缺口说明，不显示伪造零值

#### Scenario: Keep scoring and recommendation unchanged

- **WHEN** 新的现金流证据加载完成或处于缺口状态
- **THEN** `value-quality` 分数、研究因子权重、研究动作和决策推荐的结果保持现有口径
- **AND** 现金流证据只作为可引用的研究上下文
