## ADDED Requirements

### Requirement: Timing history is optional research evidence
Deterministic research reports MUST include optional evidence for the current timing state's historical sample and Wilson edge assessment. The evidence MUST be marked optional so missing or overlapping intervals do not change required coverage, research action, or the deterministic recommendation.

#### Scenario: Current state has a usable historical edge
- **WHEN** a report is generated with enough daily bars to evaluate non-overlapping 20-day windows
- **AND** the current timing state's sample size is at least 6
- **THEN** the report MUST include optional evidence keys for evaluated windows and the current state's edge assessment
- **AND** supported maps to pass, weaker maps to fail, and overlapping intervals map to caution
- **AND** required evidence coverage and the deterministic recommendation MUST stay unchanged from the same inputs without these optional keys

#### Scenario: Small samples stay missing
- **WHEN** the current timing state has fewer than 6 historical samples or daily bars are insufficient
- **THEN** the optional timing-history edge evidence MUST be missing
- **AND** the report MUST NOT invent a supported or weaker conclusion
