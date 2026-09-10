## Context

Quant already persists `quant_research_run.report_json` as a deterministic report containing trend, valuation, quality, shareholder-return and risk evidence. `quant_ai_config` is user-scoped and stores only an encrypted API key. Cloudflare Workers cannot run Python or pandas, while AkShare is a Python library that returns DataFrames. The bridge and Worker therefore need a narrow HTTP boundary.

## Goals / Non-Goals

**Goals:**

- Provide a separately deployable AkShare service with a stable contract and testable normalizers.
- Enrich the existing report without making bridge availability a hard dependency.
- Generate structured, beginner-friendly AI explanations that remain traceable to evidence keys.
- Keep all summaries and model metadata isolated by user and research run.

**Non-Goals:**

- No automated orders, portfolio execution, price targets, return forecasts or direct buy/sell instructions.
- No raw pandas DataFrame, AkShare object or arbitrary provider response in D1 or the browser.
- No SSE multi-agent orchestration in this change; summary generation is one bounded request.
- No migration of old AI providers or OAuth `account` records.

## Decisions

### 1. Separate Python service

`apps/quant-akshare-bridge` owns the AkShare import, endpoint calls, field alias mapping and contract tests. The service uses a small Python standard-library HTTP server and can be run independently; the Worker only sees JSON over HTTP. This keeps health checks and contract tests runnable before the optional AkShare dependency is installed.

### 2. Stable contract and fail-soft enrichment

The contract uses `quant-akshare-v1`, bounded daily bars and a normalized evidence list. The API client validates required fields and maps transport, timeout, authentication and invalid-response failures to Quant errors. Research generation uses `Promise.allSettled` semantics so existing evidence survives a bridge outage.

### 3. Report v2 with v1 read compatibility

The deterministic builder emits `research-report-v2` when bridge evidence is part of the run. The persisted report reader accepts both `research-report-v1` and `research-report-v2`; no historical report is rewritten. The v2 delta is additive: sources and evidence may include AkShare items, while the deterministic score/action remain the authority.

### 4. AI gateway in the Worker

The Worker decrypts the current user's key only for the outbound model request. Providers use an OpenAI-compatible `/chat/completions` shape, with provider defaults and an explicit `base_url` override. The prompt contains the report's status, action, score, sources and evidence only. The response is schema-checked, length-bounded and checked against the report evidence-key set before persistence.

### 5. Immutable run linkage

`quant_research_summary` stores `research_run_id`, `user_id`, report version, provider, model, summary version, cited evidence keys, generated time and the structured summary JSON. A new generation creates a new row; reads return the newest row for the scoped run with bounded retention.

## Data Flow

```text
Quant UI -> Worker research run -> existing providers
                              -> AkShare bridge -> normalized evidence
                              -> deterministic report v2 -> quant_research_run
Quant UI -> Worker summary -> decrypt user key -> model endpoint
                           -> validate evidence keys -> quant_research_summary
```

## Risks / Trade-offs

- [AkShare field drift] -> adapter aliases and partial status; optional fields remain null.
- [Bridge outage] -> report stays usable and exposes a source gap instead of silently using stale values.
- [Model hallucination] -> strict JSON, cited-key validation, no new numeric fields, and a visible deterministic report beside the summary.
- [Worker outbound endpoint] -> bounded timeout, no response logging, and user-configured base URL remains an operational responsibility.

## Migration Plan

1. Add `0043_quant_research_summary.sql`, apply locally, and verify schema plus user/run isolation through D1 readback.
2. Deploy bridge independently and configure the Worker bridge URL/token; leave it unset for an existing-provider-only mode.
3. Deploy API and Quant app; verify bridge ready/partial/unavailable and AI configured/missing/invalid states.
4. Keep old v1 report rows readable. Rollback code leaves summary rows intact and does not delete user data.
