## ADDED Requirements

### Requirement: Seeded starter watchlist

The Quant database migration MUST insert the three requested A-share symbols with their names exactly once and MUST be safe to re-run.

#### Scenario: First migration

- **WHEN** the Quant seed migration runs against a database containing no starter rows
- **THEN** `601899.SH`/`紫金矿业`, `600089.SH`/`特变电工`, and `600938.SH`/`中国海油` exist in `quant_watchlist`

#### Scenario: Repeated migration

- **WHEN** the same migration runs again
- **THEN** it does not create duplicate watchlist rows or overwrite a user's later name edit

### Requirement: Free daily provider

The API MUST support a server-side Eastmoney daily provider without requiring a user-visible token, while preserving explicit Tushare selection.

#### Scenario: Eastmoney selected

- **WHEN** `QUANT_DATA_PROVIDER=eastmoney`
- **THEN** daily sync requests Eastmoney history K-lines and returns normalized `DailyBar` rows

#### Scenario: Provider auto selection

- **WHEN** no provider is specified and `TUSHARE_TOKEN` is absent
- **THEN** the API selects Eastmoney and reports that source in the capability response

#### Scenario: Invalid upstream payload

- **WHEN** Eastmoney returns an empty, malformed, or non-success payload
- **THEN** sync records a provider error without writing malformed bars

### Requirement: Selection cockpit

The Quant UI MUST expose enough persisted signal context to compare the watchlist without opening each row individually.

#### Scenario: Watchlist comparison

- **WHEN** the watchlist has daily data
- **THEN** each row shows latest close and percentage change alongside code, name, and data freshness

#### Scenario: Candidate filtering

- **WHEN** a candidate snapshot is available
- **THEN** the UI can switch between all candidates, ready candidates, and candidates with matched signals

#### Scenario: Signal explanation

- **WHEN** a candidate is selected
- **THEN** the UI shows its score, data quality, matched signals, and missing factors using the existing status language
