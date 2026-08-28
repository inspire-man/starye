## ADDED Requirements

### Requirement: Authenticated change explanation

The system MUST expose an authenticated endpoint `POST /api/quant/research/runs/:runId/change-explanation` accepting `{ "previous_run_id": string }`, and MUST read both research runs under the current user before generating a response.

#### Scenario: Owned comparable runs

- **WHEN** the current user submits a current run and an owned previous run for the same `tsCode`
- **THEN** the endpoint MUST generate a versioned change explanation from the deterministic evidence difference and return the current and previous run timestamps, bounded explanation items, next checks, and validated current-report evidence keys.

#### Scenario: Missing, foreign, or cross-stock run

- **WHEN** either run does not belong to the current user, the previous run is the same run, or the two runs have different `tsCode` values
- **THEN** the endpoint MUST return a typed client error and MUST NOT call the configured AI provider.

### Requirement: Evidence-grounded AI output

The change explanation MUST accept only a JSON response with the declared fields, MUST reject unknown fields, MUST reject citations that are not keys in the current report, and MUST reject trading instructions, price targets, return forecasts, and unsupported causal claims.

#### Scenario: Valid bounded output

- **WHEN** the provider returns valid JSON
- **THEN** the system MUST return `overview`, at most 8 `changes`, at most 6 `nextChecks`, and `citedEvidenceKeys`, with each change tied to a current-report evidence key and containing an explanation of the observed delta or comparison limitation.

#### Scenario: Invalid or unsafe provider output

- **WHEN** the provider returns malformed JSON, unknown fields, unknown evidence keys, prohibited trading language, or causal certainty not supported by the reports
- **THEN** the system MUST return a typed invalid-response error without exposing the API key or raw provider payload.

### Requirement: Honest client states

The Quant research detail view MUST show the change explanation action only when two research runs and a deterministic comparison are available, and MUST distinguish idle, loading, success, and failure/retry states without changing the deterministic report data.

#### Scenario: Citation navigation

- **WHEN** the user activates a cited current-report evidence key
- **THEN** the view MUST focus or scroll to the authoritative current evidence row and visibly mark it without navigating away.

#### Scenario: Narrow layout

- **WHEN** the view is rendered at 390 CSS pixels wide
- **THEN** the action, explanation items, errors, and citation controls MUST wrap within the viewport and remain keyboard reachable without horizontal overflow.
