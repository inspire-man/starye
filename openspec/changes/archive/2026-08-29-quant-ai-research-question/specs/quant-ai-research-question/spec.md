# quant-ai-research-question Specification

## ADDED Requirements

### Requirement: Ask about the current research report

Quant MUST provide an authenticated `POST /api/quant/research/runs/:runId/question` endpoint when the current user owns the research run. The request MUST contain only a non-empty question with a bounded length. The server MUST reload the saved report for the authenticated user and MUST NOT accept report content, model configuration, or API key from the browser.

#### Scenario: Ask a report-grounded question

- **WHEN** the user submits a question for an owned research run
- **THEN** the server sends only bounded report facts and the question to the saved AI configuration
- **AND** returns `research-question-v1` with an answer and evidence key citations
- **AND** does not create or modify a research run, summary, marker, score, or candidate state

#### Scenario: Reject missing or foreign research runs

- **WHEN** the run does not exist or belongs to another user
- **THEN** the API returns `QUANT_NOT_FOUND`
- **AND** no AI request is made

### Requirement: Keep answers evidence-grounded

The question response MUST contain only `answer` and `citedEvidenceKeys` in the model payload. Every cited evidence key MUST exist in the selected report. The server MUST reject unknown fields, unknown evidence keys, overlong output, and direct trading instructions.

#### Scenario: Valid answer with citations

- **WHEN** the model returns bounded JSON and all citations belong to the report
- **THEN** the API returns the validated answer, provider, model, generation time, and deduplicated citations

#### Scenario: Model invents facts or trading advice

- **WHEN** the model returns an unknown evidence key, invalid structure, or a buy/sell/price-target instruction
- **THEN** the API returns `QUANT_AI_QUESTION_INVALID_RESPONSE`
- **AND** no question result is persisted

### Requirement: Show question state honestly in Quant

The Quant detail drawer MUST show the question control only when a current research report is available. It MUST show idle, loading, success, and failure states; prevent duplicate submission; allow retry after failure; and preserve the deterministic report and existing AI summary.

#### Scenario: Ask and retry from the detail drawer

- **WHEN** the user enters a question and submits it
- **THEN** the drawer shows loading and then the answer or an understandable failure
- **AND** a failed request can be retried without changing research data

#### Scenario: No report is available

- **WHEN** research history is loading, failed, or empty
- **THEN** the question control is not executable
- **AND** no question API request is made

### Requirement: Navigate to cited evidence accessibly

Each question citation MUST expose a visible stock/evidence label and an accessible name. Activating a citation MUST focus the corresponding evidence row in the current report without changing the deterministic result. The question area MUST remain readable and free of horizontal overflow at 390px.

#### Scenario: Open a cited evidence item

- **WHEN** the user activates a cited evidence key
- **THEN** the detail view scrolls to and highlights that evidence row
- **AND** the current question answer and report state remain unchanged
