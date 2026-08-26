## Purpose

把独立 AkShare bridge 返回的公开行情与财务数据转换为可回溯、可理解、可供 AI 引用的 Quant 研究因子证据，同时保持确定性报告和用户判断边界清晰。

## ADDED Requirements

### Requirement: Granular AkShare evidence

AkShare bridge MUST expose normalized evidence for each available metric rather than only sample counts. Every factor MUST include a stable key, dimension, numeric value or `null`, threshold, source endpoint, observation date, formula version and a plain-language detail. Missing or invalid fields MUST remain `missing` and MUST NOT be replaced with zero.

#### Scenario: Financial factor is available

- **WHEN** the latest normalized financial row contains ROE, revenue growth, net profit growth, gross margin, net margin or debt-to-asset ratio
- **THEN** the bridge returns a corresponding evidence item with the metric value, its threshold and the financial report date

#### Scenario: Financial factor is absent

- **WHEN** a normalized financial row or one of its optional fields is absent
- **THEN** the bridge returns a `missing` item for that factor with a `null` value and an honest data-gap detail

#### Scenario: Daily window is usable

- **WHEN** the bridge has at least 20 ordered valid daily closes
- **THEN** it returns a bounded daily return evidence item calculated from the requested window and identifies the last trade date

### Requirement: Cross-source transparency

The research report MUST preserve AkShare factor evidence as optional evidence and MUST keep the existing deterministic score and action unchanged. When an AkShare factor corresponds to an existing financial factor, the report MAY add a cross-source detail, while retaining each provider value, date and source separately.

#### Scenario: Sources agree within tolerance

- **WHEN** AkShare and the latest existing financial provider value are available for the same metric and their difference is within the configured tolerance
- **THEN** the report shows an explicit cross-source agreement detail while preserving both evidence items

#### Scenario: Sources differ or report periods differ

- **WHEN** the values differ beyond tolerance or the report dates do not match
- **THEN** the report marks the cross-check as a caution or explains that the values are not directly comparable, without selecting one silently

### Requirement: Beginner-readable evidence surface

The Quant research detail drawer MUST show granular evidence grouped by dimension, with status, formatted value, threshold, source and observation date. The drawer MUST keep the deterministic headline, score and action visible when AkShare is unavailable or a factor is missing.

#### Scenario: Granular evidence is ready

- **WHEN** a research run contains AkShare factor evidence
- **THEN** the drawer renders the factors with a readable value and a concise explanation, while allowing the user to inspect source and formula metadata

#### Scenario: Bridge has a data gap

- **WHEN** the report contains missing or unavailable AkShare evidence
- **THEN** the drawer identifies the gap and continues to render all existing local, valuation, financial and shareholder evidence

### Requirement: Grounded AI explanation

The AI summary prompt MUST instruct the model to use granular factor evidence only as cited facts, preserve the report's deterministic status, score and action, and mention source/date differences as uncertainty. A valid summary MUST continue to cite only evidence keys present in the report.

#### Scenario: AI explains a bridge factor

- **WHEN** the report includes a cited AkShare factor with a value and observation date
- **THEN** the generated summary explains the factor in plain language and keeps its evidence key in `citedEvidenceKeys`

#### Scenario: AI overstates a cross-source difference

- **WHEN** the model presents an unverified provider difference as a definitive conclusion
- **THEN** the summary validation rejects the output or the prompt contract prevents it from being accepted as a grounded explanation
