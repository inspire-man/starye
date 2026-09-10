## Purpose

让 Quant 用户在阅读 AI 解释时直接看到其引用的确定性证据和报告结论，从而用数值、来源、日期与公式口径快速核验摘要，而不把 AI 文本误认为新的事实来源。

## ADDED Requirements

### Requirement: Deterministic conclusion remains visible

The AI research summary surface MUST display the linked report's status, action and score alongside the generated explanation. These fields MUST come from the deterministic report and MUST remain visible in loading, empty, error and successful summary states where the report is available.

#### Scenario: Summary is generated

- **WHEN** a research report and a valid AI summary are present
- **THEN** the panel shows the report status, research action and score separately from the AI overview

#### Scenario: Summary is unavailable

- **WHEN** AI configuration is missing or the model request fails
- **THEN** the report conclusion remains visible and the panel shows the classified empty or error state

### Requirement: Citation details are locally verifiable

For every cited evidence key found in the current report, the AI summary surface MUST show the evidence label, formatted value, status, threshold, source, observation date and formula version. The citation MUST remain linked to the report evidence rather than copying new values from AI text.

#### Scenario: Cited evidence exists

- **WHEN** a summary cites an evidence key present in the report
- **THEN** the panel renders one citation row with the corresponding report value and provenance metadata

#### Scenario: Summary cites an unknown historical key

- **WHEN** a persisted summary contains a key absent from the current report
- **THEN** the panel shows an explicit unavailable citation state with the key name and no fabricated value

### Requirement: Responsive citation readability

The citation surface MUST keep values and status readable at narrow widths by stacking metadata below the primary label/value content. Long source, threshold and formula strings MUST wrap or truncate within their own region without overlapping neighboring content.

#### Scenario: Narrow Quant drawer

- **WHEN** the analysis drawer is rendered on a viewport at or below the mobile breakpoint
- **THEN** each citation row remains readable with no horizontal overlap and the value remains visually distinct from metadata
