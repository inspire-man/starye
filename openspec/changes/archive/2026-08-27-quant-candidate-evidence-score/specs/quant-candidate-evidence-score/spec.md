## ADDED Requirements

### Requirement: Candidate evidence readiness is explainable

The candidate research surface MUST show an evidence-readiness result derived from the five existing value-quality dimensions and their raw metric availability. It MUST expose covered fields, total fields and dimension-level status without changing the existing signal score or value-quality score.

#### Scenario: Evidence is sufficiently covered

- **WHEN** a candidate has finite raw metrics across the five research dimensions
- **THEN** the surface shows a bounded readiness percentage and the covered/total field counts for the candidate

#### Scenario: Evidence has gaps

- **WHEN** one or more dimensions have partial or missing raw metrics
- **THEN** the surface labels the candidate as partial or missing and identifies the dimension-level gap without using favorable percentile as a coverage substitute

### Requirement: Loading and missing results remain distinct

The evidence-readiness model MUST distinguish an unloaded batch result from a loaded result with no usable stock result. It MUST NOT convert an unloaded result into a zero score.

#### Scenario: Batch result is still loading

- **WHEN** value-quality results have not completed loading
- **THEN** the candidate surface shows a loading/unavailable state and keeps existing candidate rows visible

#### Scenario: Stock result is absent after loading

- **WHEN** the batch completed but a candidate has no corresponding value-quality item
- **THEN** the surface shows a missing-data state and an explicit gap explanation

### Requirement: Readiness is a research aid, not a recommendation

The evidence-readiness result MUST be presented as research-data coverage only. Sorting by it MUST NOT alter deterministic signals, value-quality scores, research priorities, research actions or render a direct trading instruction.

#### Scenario: User sorts by evidence readiness

- **WHEN** the user chooses the evidence-readiness sort
- **THEN** candidates are ordered by the bounded coverage result with unavailable values last, while all existing scores and actions remain unchanged
