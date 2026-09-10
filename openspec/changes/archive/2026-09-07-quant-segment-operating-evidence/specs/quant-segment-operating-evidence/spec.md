## Purpose

为 Quant 研究详情补充同报告期主营构成原始字段，帮助用户区分分部收入/毛利的真实披露、字段缺失和来源异常，同时保持这些信息与评分及判断独立。

## ADDED Requirements

### Requirement: Financial reports MUST expose bounded business segment fields

财务报告快照 MAY 暴露 `businessSegments`。每个分部行 MUST 包含匹配证券代码、报告期、分类和分部名称；主营收入、收入比例和毛利率 MUST 是有限数字或 `null`。分部行 MUST 属于该财务报告的同一报告期，不得用其他报告期或推导值填充。

#### Scenario: Eastmoney returns same-period segment rows

- **WHEN** Eastmoney returns a valid `zygcfx` row for `601899.SH` and `2026-06-30`
- **THEN** the financial snapshot exposes the matching segment name, raw revenue, revenue ratio and any finite gross margin
- **AND** the report date, existing financial metrics and primary provider remain unchanged

#### Scenario: Segment fields are partial or unavailable

- **WHEN** a segment row omits gross margin, contains a non-finite number, or the segment endpoint fails
- **THEN** the available fields remain readable and each unavailable field remains `null`
- **AND** a bounded `businessSegmentErrorCode` is retained only when the source gap remains unresolved

### Requirement: Eastmoney and AkShare MUST preserve segment provenance

Eastmoney MUST read the `zygcfx` data from `BusinessAnalysis/PageAjax`; AkShare MUST read `stock_zygc_em`. The bridge and provider MUST preserve the actual endpoint/source metadata, filter mismatched securities and invalid report dates, and keep known-good financial rows when segment collection fails.

#### Scenario: AkShare segment rows match the requested security

- **WHEN** `stock_zygc_em` returns product, industry or region rows for the requested security
- **THEN** the bridge returns normalized rows grouped by report date and includes `stock_zygc_em` in the source endpoints
- **AND** rows for another security are excluded without leaking their values

### Requirement: Segment evidence MUST remain independent from investment judgment

New segment values MUST appear only as optional research evidence and raw Quant detail context. They MUST remain outside value-quality scoring, candidate evidence score, deterministic recommendation, AI decision projection and outcome judgment.

#### Scenario: A report contains segment revenue and gross margin

- **WHEN** a financial report contains finite segment values
- **THEN** the report exposes independently keyed optional segment evidence with report date and source provenance
- **AND** the deterministic score, candidate signal and decision evidence keys remain unchanged

#### Scenario: A legacy report omits segment data

- **WHEN** a persisted or bridge financial payload has no `businessSegments`
- **THEN** API and Quant parsers preserve the report and treat segment data as missing
- **AND** the detail view shows an explicit missing state instead of zero or a derived estimate

### Requirement: Knowledge catalog MUST retain unsupported operating-driver gaps

The investment knowledge catalog MUST mark `segmentRevenue` and `segmentGrossMargin` as available for the business-driver factor while retaining order backlog, volume and realized-price fields as missing. The catalog MUST not imply that segment revenue or gross margin proves orders, volume, pricing or future profit.

#### Scenario: Knowledge view reflects segment coverage

- **WHEN** the Quant knowledge endpoint is read after this change
- **THEN** business-driver available fields include `segmentRevenue` and `segmentGrossMargin`
- **AND** order backlog, volume and realized price remain in `missingFields` with a partial status
