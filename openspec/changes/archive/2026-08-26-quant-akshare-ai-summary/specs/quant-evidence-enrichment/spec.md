## Purpose

把 AkShare bridge 的标准结果接入现有确定性研究报告，同时保留已有 provider 和报告可读性。

## ADDED Requirements

### Requirement: Optional evidence enrichment

Quant research generation MUST call the configured bridge at most once for the target stock, validate its contract, and append only normalized evidence and source metadata. A bridge failure MUST NOT erase or replace existing local, valuation, financial or shareholder evidence.

#### Scenario: Bridge ready

- **WHEN** the bridge returns a valid ready or partial contract
- **THEN** the research report includes the AkShare source, bounded evidence items, observed time and adapter formula version

#### Scenario: Bridge unavailable

- **WHEN** bridge configuration is absent, the request times out, or the contract is invalid
- **THEN** report generation succeeds using existing evidence, records a classified data gap, and preserves the deterministic action and score

### Requirement: Report version compatibility

The API MUST persist the enriched report as `research-report-v2` and MUST continue to read previously persisted `research-report-v1` reports without rewriting their evidence.

#### Scenario: Read historical v1 report

- **WHEN** a user reads a research run generated before this change
- **THEN** the API returns the original v1 report and does not require AkShare or AI configuration
