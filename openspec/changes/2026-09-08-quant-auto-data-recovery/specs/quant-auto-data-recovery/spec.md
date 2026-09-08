## ADDED Requirements

### Requirement: Expired daily data is actionable
The Quant data-health view MUST expose an action that invokes the existing daily sync for an expired or missing daily-data domain.

#### Scenario: Daily data is stale
- **WHEN** the daily domain is stale, partial, or missing
- **THEN** the action MUST run the existing daily sync and refresh watchlist-dependent research data
- **AND** a rejected or partial sync MUST remain visible as rejected or partial

### Requirement: Insufficient research data remains explicit
The Quant data-health view MUST expose domain-specific refresh actions for value-quality and shareholder-return gaps.

#### Scenario: A research domain is incomplete
- **WHEN** a domain has missing or partial samples
- **THEN** its existing loader MUST be invoked
- **AND** missing values MUST remain data gaps rather than zero-valued evidence
