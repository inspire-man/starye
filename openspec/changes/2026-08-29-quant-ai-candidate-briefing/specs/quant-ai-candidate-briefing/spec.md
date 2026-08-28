## ADDED Requirements

### Requirement: Authenticated candidate briefing

The system MUST expose an authenticated endpoint `POST /api/quant/candidates/ai-briefing` that reads the current user's candidate snapshot and deterministic research-priority facts on the server before calling the configured AI provider.

#### Scenario: Current candidate snapshot

- **WHEN** the current user requests a briefing with an available candidate snapshot
- **THEN** the endpoint MUST return a versioned briefing containing an overview, at most 5 candidate focus items, at most 6 next checks, and candidate code references derived from the server-read candidate data.

#### Scenario: Empty or unavailable candidate data

- **WHEN** no candidate snapshot is available or the candidate input cannot be read
- **THEN** the endpoint MUST return an honest typed state/error and MUST NOT call the AI provider with forged client data.

### Requirement: Deterministic and evidence-grounded output

The briefing MUST preserve each candidate's server-derived priority level, score, action and reasons as facts, MUST reject unknown output fields or candidate codes, and MUST reject trading instructions, price targets, return forecasts and unsupported causal claims.

#### Scenario: Valid bounded response

- **WHEN** the provider returns valid JSON
- **THEN** each focus item MUST reference a server-known candidate code and contain a bounded explanation tied to its deterministic reasons; the response MUST keep the candidate priority values separate from AI prose.

#### Scenario: Unsafe or malformed response

- **WHEN** the provider returns malformed JSON, unknown candidate codes, unknown fields, prohibited trading language or unsupported causal claims
- **THEN** the endpoint MUST return a typed invalid-response error without exposing the API key or raw provider payload.

### Requirement: Candidate-page interaction

The Quant candidate page MUST expose the briefing action only when candidate data is available, MUST distinguish idle, loading, success and retryable failure states, and MUST leave the deterministic candidate table unchanged.

#### Scenario: Focus navigation

- **WHEN** the user activates a briefing focus item or candidate reference
- **THEN** the page MUST open the existing detail drawer for that candidate through the established selection flow.

#### Scenario: Narrow layout

- **WHEN** the candidate page is rendered at 390 CSS pixels wide
- **THEN** the briefing panel, focus items and error text MUST wrap within the viewport and remain keyboard reachable.
