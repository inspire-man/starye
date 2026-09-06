# quant-evidence-source-health Specification

## Purpose
TBD - created by archiving change 2026-09-05-quant-evidence-source-completion. Update Purpose after archive.

## Requirements

### Requirement: 原始字段覆盖必须独立于阈值结果

Quant 因子数据健康 MUST 以适用 evidence 的有限原始 `value` 和来源健康判定字段是否已读取；`pass`、`caution` 和带有限值的 `fail` 都属于已读取字段。价值质量的 `factor.status`、同业可比样本数量、评分状态或阈值结果 MUST NOT 单独把已读取字段降级为 `partial`、`missing` 或 `unavailable`。阈值未通过 MUST 保留为失败证据和研究风险，但 MUST NOT 单独把字段标记为缺失、来源不可用或要求重试。

#### Scenario: 有值但未通过阈值

- **WHEN** 趋势 evidence 返回有限负收益，来源为本地 Quant 日线库，状态为 `fail`
- **THEN** 因子数据健康计入该字段的覆盖数量
- **AND** 页面继续显示失败证据和风险说明
- **AND** 页面不把该字段列为待补数据或来源重试项

#### Scenario: 字段完整但价值质量不可比

- **WHEN** 一个行业因子的所有适用 evidence 都有有限值，但价值质量因子因为同业样本不足而为 `partial`
- **THEN** 因子数据健康将该因子标记为字段完整
- **AND** 页面单独保留价值质量的不可比或样本不足说明
- **AND** 页面不为已返回字段提供补数据动作

#### Scenario: 没有原始值

- **WHEN** evidence 缺失、状态为 `missing` 或 `value` 为 `null`
- **THEN** 字段进入待补 evidence key
- **AND** 只有仍有其他可用字段时因子标记为 `partial`，全部缺失时标记为 `missing`

### Requirement: 回退来源状态必须可解释

来源描述包含明确回退链、`fallback`、配额回退或等价标记时，系统 MUST 返回 `fallback` 来源健康；包含主源失败但同时存在回退链时 MUST NOT 返回 `unavailable`。没有回退链且来源明确失败或不可用时才返回 `unavailable`。

#### Scenario: 主源失败后回退成功

- **WHEN** 来源描述为 `主源失败 + 回退链` 且证据字段存在
- **THEN** 因子显示字段状态与“来源需复核”并列
- **AND** 下一步允许复核来源与观察时间，不提示配置整个来源

#### Scenario: 没有可用来源

- **WHEN** 来源描述明确不可用或失败，且没有回退链
- **THEN** 因子显示 `unavailable`
- **AND** 下一步提示检查来源配置或重试

### Requirement: 数据动作只针对可恢复缺口

因子数据健康的刷新动作 MUST 针对缺失 evidence、不可用来源、回退来源或已过期数据；有限值但阈值失败的 evidence MUST 只显示风险，不触发相同字段的来源重试。

#### Scenario: 失败证据与缺失证据并存

- **WHEN** 一个因子同时有有限值的 `fail` evidence 和 `missing` evidence
- **THEN** 刷新动作只包含缺失 evidence 对应的数据域
- **AND** 失败 evidence 仍在风险区域显示

### Requirement: provider 空报告必须与 provider 故障分开

Quant provider 收到合法的空报告响应时 MUST 返回空历史或空集合并保留其他字段；只有响应结构非法、请求超时或上游错误才返回 provider error code。空历史 MUST 在股东回报区域显示为数据不足，不得显示为来源不可用。Eastmoney 回购接口返回明确的空结果代码或空 result 时 MUST 按合法空历史处理。

#### Scenario: 现金流报告为空

- **WHEN** Eastmoney 现金流日期接口返回合法 JSON `null` 或明确空列表
- **THEN** 现金流历史为空，状态为 `insufficient_data`
- **AND** 股息、股本和回购证据继续独立计算

#### Scenario: 回购报告为空

- **WHEN** Eastmoney 回购接口返回稳定的空结果代码或 `result: null`，且响应结构仍是可识别的 provider 响应
- **THEN** 回购历史为空，回购证据状态为 `insufficient_data`
- **AND** 页面显示“暂无回购记录/数据不足”，不显示来源不可用或要求检查 provider 配置

#### Scenario: 回购 provider 真正失败

- **WHEN** Eastmoney 回购接口超时、返回非 JSON、响应结构损坏或发生未分类上游错误
- **THEN** 回购证据状态为 `unavailable` 并保留安全错误码
- **AND** 已成功的分红、现金流和股本证据继续返回

### Requirement: 行业不适用字段必须与来源缺失分开

Quant MUST preserve industry-specific financial fields returned by the source and MUST mark generic metrics that are not meaningful for banks, insurers, or other specialized financial industries as not applicable. Not-applicable fields MUST NOT be counted as missing evidence, source failure, or refreshable gaps. 判断就绪度 MUST 使用相同边界，不得因为这些字段的 `status=missing` 表示而阻断完整的行业专用证据链。

#### Scenario: 保险财报没有通用毛利率

- **WHEN** an insurance report returns solvency, net investment return, or new-business-value fields but no generic gross margin
- **THEN** the generic gross-margin evidence is marked not applicable
- **AND** the industry-specific fields remain visible with their source and report date
- **AND** factor health does not offer a generic financial refresh for that field

#### Scenario: 银行财报使用专用资本指标

- **WHEN** a bank report returns core-tier-one capital adequacy or net interest margin while generic debt and interest metrics are not comparable
- **THEN** the bank-specific fields are retained as financial evidence
- **AND** generic non-comparable fields do not reduce raw evidence coverage

#### Scenario: 行业不适用字段不阻断判断就绪度

- **WHEN** 报告的正权重因子完整、必要 evidence 均有值，但银行或保险通用 evidence 被标记为 `not_applicable`
- **THEN** 判断就绪度的数据完整性检查不把这些字段计为缺失或阻断原因
- **AND** 页面继续显示行业口径说明和其他需要人工核对的风险

### Requirement: 财报来源必须支持显式字段补充

Quant 财报读取 MUST keep Eastmoney as the default financial source, and MAY use a configured Tushare `fina_indicator` source as a fallback or same-report-date field supplement. A supplement MUST only fill `null` fields, preserve the primary value and industry classification, and expose `provider`, `supplementalProvider`, `supplementUsed`, `fallbackUsed`, and the safe fallback reason when applicable.

#### Scenario: Eastmoney report has nullable generic fields

- **WHEN** Eastmoney returns a valid report but a supported numeric field is `null` and Tushare returns the same report date with a finite value
- **THEN** the value is filled from Tushare
- **AND** the Eastmoney value and industry-specific fields remain authoritative when present
- **AND** the result records Tushare as a supplemental provider

#### Scenario: Eastmoney financial source is unavailable

- **WHEN** Eastmoney returns an upstream, timeout, or invalid-response error and Tushare is configured with a valid matching report
- **THEN** the API returns the Tushare report with `fallbackUsed=true`
- **AND** the primary error is retained as a safe fallback reason

#### Scenario: Both financial sources are unavailable

- **WHEN** the primary and fallback financial providers fail or return no valid report
- **THEN** the API preserves the existing provider error contract
- **AND** no zero, inferred, or cross-period financial value is created

### Requirement: 现金流核心字段必须支持备用来源

Quant 现金流 provider MUST keep Eastmoney as the default source and MAY use a configured Tushare `cashflow` source when Eastmoney returns an empty history, fails, or omits a core operating-cashflow/capital-expenditure field. Tushare fallback MUST preserve the report date and code, MUST expose its actual provider and fallback reason, and MUST leave dividends, interest expense, and interest-bearing debt `null` unless their source fields have a verified mapping.

#### Scenario: 金融机构 Eastmoney 现金流历史为空

- **WHEN** Eastmoney returns a valid empty cashflow history and configured Tushare returns matching operating cashflow and capital expenditure rows
- **THEN** the cashflow evidence is built from the Tushare rows
- **AND** it is marked with `fallbackUsed=true` and `fallbackReason=QUANT_PROVIDER_EMPTY`
- **AND** unverified dividend, interest, and debt values remain `null`

#### Scenario: 现金流两端都没有报告

- **WHEN** Eastmoney and Tushare both return valid empty histories
- **THEN** the cashflow evidence remains `insufficient_data`
- **AND** it is not promoted to a successful or fabricated cashflow result

### Requirement: 不可比 PEG 必须保留为原始边界

The valuation pipeline MUST preserve a finite but non-positive PEG as an upstream fact while excluding it from positive-valuation comparability. It MUST NOT infer a replacement PEG from growth or another period, and MUST NOT create a refresh action solely for that non-comparable value.

#### Scenario: 源站返回负 PEG

- **WHEN** Eastmoney returns a finite negative `PEG_CAR` because the source growth denominator is not positive
- **THEN** the raw return remains available for research risk context
- **AND** value-quality comparison marks PEG as not comparable rather than missing
- **AND** no PEG refresh action or inferred replacement value is created

### Requirement: 缺失字段补充必须保持来源和空值边界

估值 provider MUST 在主接口返回合法快照但字段为 `null` 时尝试已配置的公开明细接口；补充响应 MUST 校验目标证券代码和有限数值，并且只填充主快照中的 `null` 字段。明细接口仍无值时 MUST 保留 `null`，不得用增长率或上一期值推算 PEG。

#### Scenario: 明细接口补充 PEG

- **WHEN** 主估值快照的 PEG 为 `null`，明细接口返回同一证券的有限 `PEG_CAR`
- **THEN** 标准化估值快照返回该 PEG
- **AND** 主接口已经返回的 PE、PB、PS 和市值保持不变

#### Scenario: 明细接口代码不匹配

- **WHEN** 明细接口返回其他证券代码
- **THEN** 明细结果被拒绝
- **AND** 主快照仍按既有结果返回；若主接口本身失败，则返回现有 provider 错误
