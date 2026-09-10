# Quant AI Historical Candidate Navigation

## ADDED Requirements

### Requirement: Historical candidate references expose current navigation state

The Quant AI candidate briefing MUST compare every historical candidate reference with the current candidate snapshot before rendering an interaction.

#### Scenario: Current historical code is actionable

- **GIVEN** a selected historical session contains candidate code `601899.SH`
- **AND** the current candidate snapshot contains `601899.SH`
- **WHEN** the historical session detail is visible
- **THEN** the code is rendered as a native button
- **AND** activating it emits `focusCandidate` with `601899.SH`

#### Scenario: Historical code absent from the current snapshot is read-only

- **GIVEN** a selected historical session contains candidate code `000001.SZ`
- **AND** the current candidate snapshot does not contain `000001.SZ`
- **WHEN** the historical session detail is visible
- **THEN** the code remains visible as a non-interactive historical reference
- **AND** no `focusCandidate` event is emitted for that code

### Requirement: All historical reference surfaces use the same availability rule

The component MUST apply the current-snapshot membership rule to historical session candidate codes, historical briefing focus items, historical briefing citations, and historical question citations.

#### Scenario: Historical focus and citation references remain consistent

- **GIVEN** a historical session contains both current and absent candidate codes across its briefing and questions
- **WHEN** the detail is rendered
- **THEN** current codes are actionable in each relevant surface
- **AND** absent codes are read-only in each relevant surface

### Requirement: Navigation preserves read-only history boundaries

Activating a current historical reference MUST emit only the existing candidate-focus event and MUST NOT alter historical session content or current deterministic candidate values.

#### Scenario: Historical navigation delegates to the parent

- **GIVEN** a current historical reference is activated
- **WHEN** the component emits `focusCandidate`
- **THEN** the parent owns opening the current candidate detail
- **AND** the historical session remains displayed without mutation
