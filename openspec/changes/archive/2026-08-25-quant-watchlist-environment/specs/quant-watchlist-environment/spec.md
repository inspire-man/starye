# quant-watchlist-environment Specification

## ADDED Requirements

### Requirement: Explainable watchlist environment

The Quant workbench MUST calculate a versioned watchlist environment summary from the current watchlist and latest candidate snapshot without making a new API request.

The summary MUST expose data coverage, positive price breadth, scored-signal breadth, risk breadth, numerator/denominator counts, and a human-readable status.

#### Scenario: Summarize a sufficiently sized sample

- **WHEN** the watchlist has at least 3 priced stocks and the candidate snapshot has at least 3 scored stocks
- **THEN** the workbench calculates coverage, positive breadth, signal breadth and risk breadth from the available counts

#### Scenario: Exclude pending candidates

- **WHEN** a candidate is marked `pendingSync`
- **THEN** it is excluded from scored-signal and risk-breadth denominators until its data is updated

### Requirement: Fail closed on insufficient data

The environment summary MUST return an `insufficient` status when the watchlist is empty, fewer than 3 stocks have current price changes, or fewer than 3 candidates have scores.

Missing values MUST remain missing in the metric ratio and MUST NOT be converted to zero for classification.

#### Scenario: Show insufficient status

- **WHEN** the sample does not meet the minimum priced and scored counts
- **THEN** the summary shows `样本不足` and instructs the user to complete data before judging the environment

### Requirement: Beginner-readable scope

The workbench MUST display the environment status, headline, metric ratios and a scope note stating that the calculation only describes the current watchlist sample and does not represent the broader market.

#### Scenario: Review the overview environment

- **WHEN** the user opens the Quant overview after data loads
- **THEN** the user can see whether the sample is relatively stable, mixed, defensive or insufficient, the four supporting ratios, and any cautions
