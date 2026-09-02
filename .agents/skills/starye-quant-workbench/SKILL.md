---
name: starye-quant-workbench
description: Build or change Starye Quant research, candidate evidence, AI trust, decision, outcome, or research-history workflows across the API, Quant Vue app, D1, Gateway, and AkShare bridge.
metadata:
  author: AI
  version: "1.0"
---

# Starye Quant Workbench

Use this skill for work that changes Quant candidates, watchlists, factors, research runs, evidence, AI summaries/questions, decision records, outcome calibration, or the authenticated Quant entry.

## Read the current contract

- Start with .planning/STATE.md and the relevant OpenSpec spec/change. Cross API, D1, Gateway, bridge, and Vue changes require the repository OpenSpec workflow.
- The main boundaries are apps/api/src/routes/quant/index.ts, apps/api/src/domain/quant/, apps/quant-app/src/lib/, apps/quant-app/src/components/, packages/db/src/schema.ts, the relevant quant migrations, and apps/quant-akshare-bridge/.
- Route tests live in apps/api/src/routes/quant/__tests__; domain tests live beside apps/api/src/domain/quant; Quant client and UI tests live under apps/quant-app/src/**/__test__.
- Gateway authentication for /quant and /api/quant is a separate boundary from Dashboard administrator access. Preserve both session behaviors.

## Data and evidence invariants

1. Scope private Quant workspace rows by the authenticated Better Auth user.id. Request path, query, and body values never decide ownership. quant_daily_bar remains shared by ts_code and trade date.
2. A research report keeps evidence status as pass, caution, fail, or missing. Each item retains source, observedAt, threshold, formulaVersion, raw value or explicit null, and explanatory detail. Provider failure and an empty sample remain visible gaps.
3. Keep candidate evidence coverage separate from value-quality percentile, factor signal, research priority/action, recommendation, decision readiness, and investment judgment. Candidate evidence scoring reads finite raw metric.value fields, requires a ready source, and limits pendingSync impact to the trend dimension.
4. AI output is advisory and structured. Preserve provider/model, response mode, factor review coverage, accepted state, rationale, cited evidence keys, and error classification. A failed or unaccepted AI result never becomes a successful deterministic result.
5. AI configuration is user-scoped. Store only encrypted API key material server-side, return metadata and hasApiKey state, and keep plaintext keys out of logs, payloads, tests, and docs.
6. Trust and outcome views distinguish aligned, opposed, flat, pending, unavailable, not-accepted, and inactive states. Agreement statistics require the implementation's minimum directional sample and must not treat pending or unavailable observations as outcomes.
7. Optional AkShare enrichment is additive: validate the quant-akshare-v1 contract, call the bridge within the configured bound, append normalized evidence, and preserve local evidence and deterministic action when the bridge fails. The bridge must not log tokens, API keys, request bodies, or upstream stack traces.

## Implementation shape

- Keep route validation and error codes in the API boundary, domain formulas in apps/api/src/domain/quant, persistence in the Quant repository and D1 schema, and response normalization in apps/quant-app/src/lib/api-client.ts.
- Keep versioned payload parsers strict enough to reject malformed research reports, decision snapshots, audits, and candidate sessions. Support only compatibility shapes already exercised by tests.
- Research generation, AI summary/stream, question, comparison, candidate briefing, decision assistant, journal, and outcome calibration are separate states. Preserve request identity and ignore stale client responses.
- Use the existing Quant shell tokens and shared UI components. Show source/time/gap evidence beside conclusions, and design loading, streaming, cancellation, error, empty, and old-report states together.

## Verification ladder

Run the narrowest relevant checks first:

    pnpm --filter api exec vitest run src/routes/quant/__tests__/route.test.ts
    pnpm --filter api exec vitest run src/routes/quant/__tests__/crud.integration.test.ts
    pnpm --filter api run type-check
    pnpm --filter quant-app test
    pnpm --filter quant-app run type-check
    pnpm --filter @starye/db run type-check

Add pnpm --filter @starye/api-types run build when AppType changes, pnpm --filter quant-app build when app wiring changes, and the focused AkShare bridge unittest suite when the Python bridge changes.

## Acceptance evidence

- Start with pnpm dev:clean and use http://localhost:8080/quant/ plus /api/quant/... for browser/request acceptance. Direct ports are diagnostic.
- Cover anonymous, authenticated ordinary-user, and administrator sessions where the change touches auth. Verify that two users cannot read or mutate each other's workspace rows.
- For every persistent mutation, compare the API response with D1 authoritative readback, including user_id, report/decision version, evidence keys, timestamps, and audit status.
- A successful UI state, HTTP 200, or generated fixture is not enough for research claims. Preserve source availability, raw evidence, freshness, AI acceptance, decision readiness, and observed outcome as separate facts.
