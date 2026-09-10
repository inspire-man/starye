## ADDED Requirements

### Requirement: Financial snapshots MUST expose optional raw segment profitability fields

`QuantFinancialQualitySnapshot` MAY expose `businessSegments`. Each segment MUST preserve matching report date, security code, category and name, and MAY include `cost`, `costRatio`, `profit` and `profitRatio`. Each numeric field MUST be finite or explicit `null`; omitted fields remain compatible with payloads produced before this change.

#### Scenario: A source returns segment cost and profit

- **WHEN** Eastmoney or AkShare returns finite same-period `MAIN_BUSINESS_COST`, `MBC_RATIO`, `MAIN_BUSINESS_RPOFIT` and `MBR_RATIO`
- **THEN** the financial snapshot exposes the four raw values on the matching segment without changing revenue, revenue ratio or source-reported gross margin

#### Scenario: A source omits one profitability field

- **WHEN** a segment row omits a cost, cost ratio, profit or profit ratio value
- **THEN** only that field is `null` and the other raw fields remain available; the implementation MUST NOT derive a missing value from revenue, ratio or another field

### Requirement: Providers MUST preserve profitability provenance and matching boundaries

Eastmoney MUST read profitability fields from `BusinessAnalysis/PageAjax.zygcfx`, and AkShare MUST read the corresponding `stock_zygc_em` columns. Providers MUST filter mismatched securities and report dates, retain actual source/endpoint metadata, and preserve valid financial rows when the optional segment endpoint is empty or fails.

#### Scenario: A segment endpoint fails

- **WHEN** the optional segment endpoint times out, returns an invalid response, or has no matching report row
- **THEN** known-good financial fields remain usable, the bounded segment error/source metadata is retained, and no zero or inferred profitability value is emitted

### Requirement: Research evidence MUST keep segment profitability outside judgment

Research reports MUST emit segment cost and profit only as optional evidence and raw context; these values MUST remain outside every investment judgment path.

#### Scenario: A report contains segment cost and profit

- **WHEN** a report contains finite segment cost or profit values
- **THEN** the report emits independently keyed optional segment cost/profit evidence with report date and source provenance
- **AND** the values MUST remain outside value-quality numeric fields, candidate evidence score, deterministic recommendation, AI decision projection and outcome judgment

#### Scenario: A legacy report omits profitability fields

- **WHEN** a persisted legacy report or bridge payload has no segment profitability fields
- **THEN** API and Quant parsers preserve the report and show the fields as missing without rejecting the report

### Requirement: Quant detail and knowledge MUST show the coverage boundary

The Quant financial detail MUST show segment cost, cost ratio, segment profit and profit ratio independently, using an explicit missing marker for `null` and an explicit source-unavailable state for endpoint errors. The investment knowledge catalog MUST include segment cost and profit as available business-driver fields while keeping order backlog, volume and realized price missing. The UI MUST NOT imply that segment cost or profit proves orders, volume or realized price.

#### Scenario: Detail view renders mixed source coverage

- **WHEN** a segment has revenue and profit but no gross margin or cost ratio
- **THEN** the detail view shows each available raw value and a separate missing marker for each absent field, with the source and boundary note visible
