# Quant AI 追问快捷提示

## ADDED Requirements

### Requirement: Current briefing checks can be reused as question prompts

Quant MUST provide an accessible action for each visible current briefing next-check item. Activating the action MUST fill the current question input with a bounded question prompt and focus the input without submitting it.

#### Scenario: Fill a prompt from a current next check

- **GIVEN** the current candidate snapshot is available and a briefing contains a next-check item
- **WHEN** the user activates that item's quick prompt action
- **THEN** the question input is set to a question about the next-check item within the 500-character limit
- **AND** the question input receives focus
- **AND** no `askQuestion` event is emitted

### Requirement: Historical questions can be reused without mutating history

Quant MUST provide an accessible reuse action for each visible historical question. Activating the action MUST copy the saved question text into the current question input and MUST leave the historical question and answer unchanged.

#### Scenario: Reuse a historical question

- **GIVEN** a historical session detail contains a saved question
- **WHEN** the user activates the reuse action
- **THEN** the current question input contains the saved question text bounded to 500 characters
- **AND** the historical question and answer remain unchanged
- **AND** no AI request is sent until the user submits the current question form

### Requirement: Quick prompts respect the current question availability boundary

Quick prompt actions MUST be disabled while the current snapshot is unavailable, no current briefing candidates exist, or another question is loading.

#### Scenario: Quick prompt is unavailable

- **GIVEN** the current question flow is unavailable or loading
- **WHEN** a next-check or historical-question quick prompt is rendered
- **THEN** its action is disabled
- **AND** the current question input state is unchanged by activation
