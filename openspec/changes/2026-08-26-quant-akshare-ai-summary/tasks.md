## 1. Bridge contract and service

- [x] 1.1 Create the independent Python bridge package and `/health`/`/v1/evidence` endpoints; complete when the service starts without importing raw DataFrames into the response.
- [x] 1.2 Implement code/date normalization, AkShare adapter aliases, bounded output and stable error categories; complete when normalizer tests cover ready, partial, unavailable and invalid responses.
- [x] 1.3 Add bridge token authentication and a local README/run command; complete when unauthenticated evidence requests are rejected and health exposes no secret.

## 2. Worker evidence enrichment

- [x] 2.1 Add the TypeScript bridge client, environment bindings and contract validation; complete when timeout, unauthorized, invalid JSON and partial payload tests pass.
- [x] 2.2 Extend the deterministic report with additive AkShare evidence and v1 read compatibility; complete when bridge ready/unavailable tests preserve existing score/action and source provenance.
- [x] 2.3 Add the research summary schema, migration, repository and D1 isolation tests; complete when two users cannot read or write each other's summaries.

## 3. AI explanation runtime

- [x] 3.1 Implement the user-configured OpenAI-compatible summary client with bounded prompt/response, timeout and classified errors; complete when plaintext keys never appear in logs, rows or responses.
- [x] 3.2 Add summary generation/read API routes and evidence-key validation; complete when valid summaries persist and invented evidence references are rejected without a row.
- [x] 3.3 Extend Quant API types/client and the analysis drawer with summary loading, generation, unavailable/error states and cited evidence; complete when the deterministic report remains visible in every state.

## 4. Verification and delivery

- [x] 4.1 Run bridge tests, API/DB/Quant tests, type-check, lint, build and OpenSpec strict validation; complete when all pass.
- [x] 4.2 Run GitNexus impact and detect_changes for bridge client, report builder, summary repository and route symbols; complete when affected flows are reviewed.
- [ ] 4.3 Verify through Gateway and D1 readback, then commit, push, review PR Actions and merge; complete when bridge unavailable and AI unavailable are visibly honest states.
