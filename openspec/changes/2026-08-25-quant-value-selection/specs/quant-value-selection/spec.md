## Purpose

为中长线、偏价值投资的用户提供一套能解释价格、经营质量、增长稳定性与风险的观察池评分，让用户在扩展股票范围后仍能以统一口径筛选并回到原始数据核对。

## ADDED Requirements

### Requirement: Explainable value-quality score

Quant API MUST provide a protected batch value-quality score for the current watchlist. The score MUST use four explicit dimensions: valuation 35 points, earnings quality 30 points, growth and stability 20 points, and trend and risk 15 points. Every returned item MUST include its formula version, total score or a data-insufficient state, dimension scores, risk deduction, missing fields, observation time, and latest financial report period when available.

#### Scenario: Score a sufficiently complete stock

- **WHEN** a watchlist stock has at least two valid positive valuation metrics, at least three valid quality or growth metrics, and usable daily trend data
- **THEN** the API returns `status=ready`, a total score from 0 to 100, all four dimension scores, and the evidence dates used for the score

#### Scenario: Preserve insufficient data

- **WHEN** a stock is missing a core valuation field, latest financial report, or usable daily trend window
- **THEN** the API returns `status=insufficient_data`, lists the missing dimensions or fields, and does not manufacture a total score from zero-filled values

### Requirement: Peer-relative valuation and quality ranking

The value-quality score MUST calculate comparable metrics using valid samples from the current watchlist, with lower-is-better or higher-is-better direction declared by the metric. Negative PE, negative PEG, non-positive denominators, empty strings, invalid dates, and failed upstream samples MUST be excluded from the peer sample rather than treated as cheap, expensive, or zero. The response MUST include sample counts for scored metrics.

#### Scenario: Compare an expanded watchlist

- **WHEN** the watchlist contains more than the three seeded stocks and at least two valid peer values for a metric
- **THEN** the API calculates that metric's percentile only from the current watchlist sample and returns its sample count

#### Scenario: Insufficient peer sample

- **WHEN** a metric has fewer than two valid comparable values or the target value is invalid
- **THEN** that metric remains unavailable, its dimension reports the missing basis, and other valid dimensions remain readable

### Requirement: Risk and report freshness guardrails

The score MUST treat long-term trend as supporting evidence rather than the dominant factor. It MUST apply a visible risk deduction for a material drawdown, abnormal short-term surge, or profit-growth and operating-cash-flow divergence when the corresponding data exists. Every financial conclusion MUST retain its report period and observation timestamp; stale or failed upstream data MUST be shown as incomplete.

#### Scenario: Strong trend conflicts with valuation or cash flow

- **WHEN** technical structure is strong but valuation is relatively high or net-profit growth is positive while operating cash-flow quality is negative
- **THEN** the response keeps the score bounded, applies the declared risk deduction, and returns a plain-language warning for manual verification

#### Scenario: Financial source partially fails

- **WHEN** one stock's valuation or financial request fails while other watchlist requests succeed
- **THEN** the batch response returns successful items, marks that stock `status=partial` or `insufficient_data`, and exposes the source error category without failing the entire batch

### Requirement: Value-quality workbench presentation

The Quant workbench MUST expose value-quality score, dimension breakdown, data completeness, report period, and risk notes beside the existing technical candidate context. The UI MUST keep source configuration and operations diagnostics outside the selection surface, and MUST make a data-insufficient result visibly different from a low score.

#### Scenario: Review candidates by value quality

- **WHEN** the batch value-quality response is available
- **THEN** the candidate table shows a readable value-quality state and score, and the selected-stock drawer shows the four dimensions, missing fields, sample counts, and risk notes

#### Scenario: Value score unavailable

- **WHEN** the batch endpoint times out or all external sources fail
- **THEN** the workbench preserves technical, watchlist, valuation, and financial areas already loaded, and shows a retryable value-quality state without hiding source details in the selection summary

#### Scenario: Narrow viewport

- **WHEN** the workbench is viewed at 390px wide
- **THEN** the value-quality summary stacks without clipping, page-level horizontal overflow, or overlap with the drawer controls
