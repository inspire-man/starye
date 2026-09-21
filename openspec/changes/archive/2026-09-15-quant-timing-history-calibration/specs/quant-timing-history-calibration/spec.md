## ADDED Requirements

### Requirement: Timing history calibration is optional research evidence
Deterministic research reports MUST include optional leave-one-state calibration evidence for the current timing state. The calibration MUST compare the current state's Wilson interval with the complement of other states, and MUST be marked optional so missing contrasts do not change required coverage, research action, or the deterministic recommendation.

#### Scenario: Current state has a usable contrast
- **WHEN** a report is generated
- **AND** the current timing state has at least 6 samples
- **AND** all other states together have at least 6 samples
- **THEN** the report MUST include optional evidence key 	iming-history-calibration
- **AND** supported maps to pass, weaker maps to fail, and overlapping intervals map to caution
- **AND** required evidence coverage and the deterministic recommendation MUST stay unchanged

#### Scenario: Missing contrast stays missing
- **WHEN** the current timing state has fewer than 6 samples
- **OR** the complement of other states has fewer than 6 samples
- **THEN** the optional calibration evidence MUST be missing
- **AND** the report MUST NOT invent a supported or weaker conclusion
