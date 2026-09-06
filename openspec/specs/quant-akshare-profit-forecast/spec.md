# quant-akshare-profit-forecast Specification

## Purpose
TBD - created by archiving change 2026-09-07-quant-akshare-profit-forecast. Update Purpose after archive.

## Requirements

### Requirement: Bridge MUST normalize forecast EPS without changing profit semantics

AkShare bridge MUST expose optional `profit_forecasts` records from `stock_profit_forecast_ths` or its Eastmoney fallback. Each record MUST preserve the requested security code, forecast year, finite forecast EPS fields, analyst count when present, industry average EPS when present, and source endpoint. The bridge MUST NOT convert EPS into net profit or overwrite financial statement values.

#### Scenario: THS returns annual forecast EPS

- **WHEN** THS returns 601899 annual forecast rows with average, low, high, analyst count, and industry average
- **THEN** bridge returns normalized `profit_forecasts` rows ordered by forecast year
- **AND** finite values and the source endpoint `stock_profit_forecast_ths` remain visible

#### Scenario: Eastmoney fallback returns dynamic year columns

- **WHEN** THS is empty or fails and Eastmoney returns a matching stock row with `YYYY预测每股收益` columns
- **THEN** bridge filters the requested security and emits one normalized row per recognized forecast year
- **AND** the response keeps a safe fallback error/source record without exposing upstream text

### Requirement: Research report MUST keep forecast EPS optional and separate

Quant research reports MUST expose valid forecast EPS as optional evidence with source provenance and forecast year. Forecast evidence MUST remain separate from actual financial reports, value-quality scoring, recommendation, and decision judgment. A legacy bridge response without `profit_forecasts` MUST remain valid.

#### Scenario: Forecast EPS appears in research detail

- **WHEN** a configured AkShare bridge returns a valid forecast EPS record
- **THEN** the research report includes an `akshare-profit-forecast-*` optional evidence item and an AkShare forecast source
- **AND** the evidence detail identifies the forecast year and available analyst/range metadata

#### Scenario: Forecast source is unavailable

- **WHEN** both forecast endpoints fail or return no usable row
- **THEN** the deterministic report remains available with a safe optional source error evidence
- **AND** no zero, inferred profit, or replacement financial report is created
