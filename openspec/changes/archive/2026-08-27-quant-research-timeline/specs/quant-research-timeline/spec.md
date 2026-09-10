## ADDED Requirements

### Requirement: Research history is shown as a timeline

The research detail surface MUST show the latest bounded research-run timeline for the selected stock using the persisted run history already loaded by the Quant app. Each point MUST retain the original run timestamp, report status, research action and score without changing the underlying report.

#### Scenario: Multiple runs are available

- **WHEN** the selected stock has two or more research runs
- **THEN** the surface shows the newest points first, displays the latest score and shows the adjacent score delta when both scores are finite

#### Scenario: History is bounded

- **WHEN** the selected stock has more runs than the configured display limit
- **THEN** the surface shows only the bounded newest set and keeps the current report and evidence detail available

### Requirement: Score comparisons remain honest

The timeline MUST calculate score direction only from two finite numeric scores. It MUST preserve points with missing scores and MUST NOT treat a missing score as zero.

#### Scenario: A score is missing

- **WHEN** either side of an adjacent score comparison has no finite score
- **THEN** the timeline shows no numeric delta for that pair and retains its status and action labels

#### Scenario: Scores are equal or change

- **WHEN** both adjacent scores are finite
- **THEN** the timeline labels the pair as up, down or flat according to the numeric delta

### Requirement: Timeline is research context

The timeline MUST present historical score and workflow changes as research context only. It MUST keep the latest deterministic report action and score independent and MUST NOT render a direct buy or sell instruction.

#### Scenario: Status or action changes

- **WHEN** status or research action differs between adjacent runs
- **THEN** the timeline counts and displays the change while retaining the latest report's own action and evidence conclusion
