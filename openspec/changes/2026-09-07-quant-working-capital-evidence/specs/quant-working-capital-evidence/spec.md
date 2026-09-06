## Purpose

为 Quant 研究详情补充同报告期资产负债表经营驱动原始字段，帮助用户区分真实缺失、来源异常和仍待接入的经营信息，同时保持这些字段与评分及判断独立。

## ADDED Requirements

### Requirement: Financial reports MUST expose bounded working-capital fields

财务报告快照 MAY 暴露 `accountsReceivable`、`inventory` 和 `contractLiabilities`。字段值 MUST 是对应报告期的原始金额，单位为元；可用值 MUST 为有限数字，缺失或源站没有对应字段时 MUST 保持 `null`。响应 MUST 保留证券代码、报告期和实际 provider，且不得用零值或其他报告期数据填充。

#### Scenario: Eastmoney returns same-period balance-sheet fields

- **WHEN** Eastmoney returns a valid financial report and matching balance-sheet row for `601899.SH` and `2026-06-30`
- **THEN** the financial snapshot exposes the three available raw fields with the same report date and yuan unit
- **AND** existing revenue, profit, margin, cashflow, and industry fields keep their original values

#### Scenario: Auxiliary balance-sheet source is unavailable

- **WHEN** the balance-sheet request fails, returns no matching row, or omits one of the fields
- **THEN** the existing financial report remains readable and each unavailable working-capital field remains `null`
- **AND** the provider chain keeps the source gap observable without fabricating a value or downgrading unrelated fields

### Requirement: AkShare bridge MUST normalize and merge working-capital provenance

The AkShare bridge MUST accept only rows matching the requested security and a valid report date. It MUST normalize balance-sheet aliases for accounts receivable, inventory, and contract liabilities, merge values by the same report date, preserve the actual endpoint in the source list, and retain bounded safe errors for failed or malformed endpoints.

#### Scenario: AkShare balance rows match the requested report

- **WHEN** an AkShare balance-sheet endpoint returns a matching `601899` row with `应收账款`, `存货`, and `合同负债`
- **THEN** the bridge financial row contains normalized finite `accounts_receivable`, `inventory`, and `contract_liabilities` values
- **AND** the response source endpoints identify the endpoint that supplied the fields

#### Scenario: AkShare returns another security or invalid values

- **WHEN** a balance row has another security code, an invalid date, or a non-finite field value
- **THEN** the row or field is excluded from the normalized result and a bounded bridge error is retained
- **AND** known-good financial rows remain available

### Requirement: Research and Quant UI MUST keep operating-driver evidence separate

New working-capital values MUST appear as optional research evidence with report-date and source provenance. The evidence MUST remain outside value-quality scoring, candidate signal calculation, recommendation, and decision judgment. Quant detail MUST show the raw field state and report period, including an explicit missing state when all three fields are unavailable.

#### Scenario: Research report contains working-capital values

- **WHEN** a financial report contains one or more finite working-capital fields
- **THEN** the report exposes independently keyed optional evidence for the available fields with the financial provider source and report date
- **AND** the deterministic score and decision projection remain unchanged

#### Scenario: Legacy or partial report is read

- **WHEN** a persisted or bridge financial payload omits the new fields
- **THEN** API and Quant parsers treat them as `null` while preserving the legacy report
- **AND** the detail view shows the fields as missing instead of displaying zero or a derived estimate

### Requirement: Knowledge catalog MUST distinguish the covered field from remaining gaps

The investment knowledge catalog MUST mark `contractLiabilities` as available for the business-driver factor and MUST retain order backlog, segment, volume, and realized-price fields as gaps until their original sources are implemented. The catalog MUST not imply that working-capital fields prove orders, volume, pricing, or future profit.

#### Scenario: Knowledge view reflects the new source coverage

- **WHEN** the Quant knowledge endpoint is read after this change
- **THEN** business-driver available fields include `contractLiabilities`, `accountsReceivable`, and `inventory`
- **AND** the remaining unsupported operating-driver fields stay in `missingFields` with a partial status
