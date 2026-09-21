## ADDED Requirements

### Requirement: Timing walk-forward calibration is optional research evidence
Deterministic research reports MUST include optional walk-forward evidence for the current timing state. Each evaluated window MUST form its directional call from strictly earlier observations, then check that call against the window's realized 20-day return. The evidence MUST be marked optional so missing out-of-sample contrasts do not change required coverage, research action, or the deterministic recommendation.

#### Scenario: Current state has enough directional out-of-sample calls
- **WHEN** a report is generated
- **AND** the current timing state has at least 6 walk-forward directional calls
- **THEN** the report MUST include optional evidence key 	iming-history-walkforward
- **AND** an agreement-rate Wilson interval fully above 50% maps to pass, fully below 50% maps to fail, and coverage of 50% maps to caution
- **AND** required evidence coverage and the deterministic recommendation MUST stay unchanged

#### Scenario: Thin walk-forward samples stay missing
- **WHEN** the current timing state has fewer than 6 directional walk-forward calls
- **THEN** the optional walk-forward evidence MUST be missing
- **AND** the report MUST NOT invent a supported or weaker conclusion
