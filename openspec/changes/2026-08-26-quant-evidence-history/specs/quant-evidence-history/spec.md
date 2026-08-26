## Purpose

让 Quant 用户快速回看同一股票相邻研究快照之间的证据变化，理解哪些因素正在改善、转弱或仍缺失，同时保持当前确定性报告的分数和研究动作独立且权威。

## ADDED Requirements

### Requirement: Evidence changes are comparable

The research detail surface MUST compare the newest research report with the immediately preceding report for the same stock by stable evidence key. It MUST show the current and previous report timestamps and MUST retain the original evidence status and values for each comparable item.

#### Scenario: Two reports are available

- **WHEN** the selected stock has at least two persisted research runs
- **THEN** the surface shows evidence changes keyed by the latest and previous reports, including both report dates

#### Scenario: Only one report is available

- **WHEN** the selected stock has fewer than two research runs
- **THEN** the surface shows a history-insufficient state and keeps the current report unchanged

### Requirement: Direction labels are honest

The comparison MUST classify changes using status and numeric direction only when both values are finite and comparable. It MUST distinguish improvement, weakening, newly missing, restored, persistent missing and unchanged states, and MUST NOT infer a numeric change from a missing value.

#### Scenario: Metric improves or weakens

- **WHEN** a current evidence value moves relative to the previous value or its status changes
- **THEN** the surface labels the direction and shows the before/after values without changing the report score or action

#### Scenario: Evidence remains unavailable

- **WHEN** an evidence key is missing in both reports or has no finite comparable values
- **THEN** the surface identifies the missing comparison and shows no fabricated delta

### Requirement: Historical comparison does not become a recommendation

The history surface MUST present changes as research context only. It MUST keep the latest deterministic status, score and action visible and MUST NOT generate a direct trading instruction from a change label.

#### Scenario: A factor turns positive

- **WHEN** a previously failed or missing factor improves in the latest report
- **THEN** the surface shows the improvement as a research change while retaining the latest report's independent action and score
