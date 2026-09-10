# quant-ai-comparison-assistant Specification

## ADDED Requirements

### Requirement: Provide a user-triggered comparison assistant

Quant API MUST provide an authenticated `POST /api/quant/research/comparison` endpoint. The request MUST contain only 2 to 3 unique current-user research run IDs. The server MUST reload those runs by the authenticated user, reject missing or foreign runs before any model request, and use the saved user AI configuration. Page load, comparison drawer open, research history read, and AI configuration save MUST NOT call this endpoint automatically.

#### Scenario: Compare completed research runs

- **WHEN** the user has two or three completed research runs and explicitly starts comparison analysis
- **THEN** the server reads the corresponding reports for that user
- **AND** sends only bounded allowlisted report facts to the configured AI endpoint
- **AND** returns a structured comparison with overview, common ground, differences, risks, next checks, and evidence citations
- **AND** does not create or modify a research run or deterministic report

#### Scenario: Reject invalid or foreign run selection

- **WHEN** the request has fewer than two runs, more than three runs, duplicate IDs, a missing run, or a run owned by another user
- **THEN** the API returns a classified validation/not-found error
- **AND** no AI endpoint request is made

### Requirement: Keep comparison conclusions evidence-grounded

The comparison response MUST use version `research-comparison-v1`. Every difference and citation MUST identify a `tsCode`; every citation MUST reference an evidence key that exists in that run's report. The server MUST reject unknown symbols, unknown evidence keys, empty/overlong fields, and direct buy/sell/price-target instructions.

#### Scenario: Valid comparison response

- **WHEN** the model returns bounded JSON with citations matching the supplied reports
- **THEN** the API returns provider, model, generation time, overview, common ground, differences, risks, next checks, and validated citations
- **AND** each citation can be mapped back to one exact report and evidence key

#### Scenario: Model invents a citation or trading instruction

- **WHEN** the model returns a citation for an unknown evidence key or includes a buy/sell instruction
- **THEN** the API returns `QUANT_AI_COMPARISON_INVALID_RESPONSE`
- **AND** no comparison result is returned to the browser

### Requirement: Show comparison analysis directly in Quant

The Quant comparison drawer MUST show a clearly labeled AI comparison action only when at least two selected research runs are completed. The action MUST display loading, success, and failure states; prevent duplicate submissions; preserve the existing comparison table and research states; and allow retry after failure.

#### Scenario: Render a successful comparison

- **WHEN** the user starts comparison analysis and the API returns a valid result
- **THEN** the drawer shows the overview, common ground, per-stock differences, risks, next checks, and cited evidence labels
- **AND** the deterministic comparison values and research run status remain unchanged

#### Scenario: API or configuration failure

- **WHEN** the saved AI configuration is missing or the comparison endpoint fails
- **THEN** the drawer shows an understandable failure state
- **AND** the user can retry without changing selected candidates or research reports

### Requirement: Keep evidence navigation and narrow layout usable

Each comparison citation MUST have an accessible label identifying its stock and evidence key. Activating a citation MUST close the comparison drawer and use the existing detail loader for that stock. The comparison assistant MUST remain readable and free of horizontal overflow at 390px.

#### Scenario: Navigate from a citation

- **WHEN** the user activates a cited evidence item for one stock
- **THEN** the comparison drawer closes
- **AND** that stock's detail drawer opens and reloads authoritative research history
