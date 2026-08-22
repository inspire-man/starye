## 1. Contract And Data

- [x] 1.1 Add quant API/data/screening/UI specs and keep OpenSpec validation green
- [x] 1.2 Add Drizzle quant tables and migration with unique daily-bar identity; verify migration test and local D1 schema readback
- [x] 1.3 Add capability registry and provider contracts; verify 120/2000/invalid tier tests and unknown API rejection
- [x] 1.4 Extend `quant_sync_state` with owner/lease CAS metadata and define the 30-snapshot retention query/migration; verify concurrent D1 readback and cleanup boundaries

## 2. Backend Core

- [x] 2.1 Implement Tushare daily provider with timeout, schema normalization, quota errors, and token redaction; verify provider mock tests
- [x] 2.2 Implement watchlist repository and CRUD route with 50-item bound and admin auth; verify route contract tests
- [x] 2.3 Implement daily sync, idempotent upsert, sync state, and authoritative snapshot persistence; verify duplicate and partial-failure tests
- [x] 2.4 Implement v1 momentum factors and candidate snapshot query; verify MA5/MA20/high/continuation/volume-ratio/relative-strength tests
- [x] 2.5 Mount `/api/quant` into the Hono route chain and run API type-check plus focused API tests
- [x] 2.6 Replace serial provider calls with a bounded scheduler: maximum 4 concurrent calls, 10-second per-call timeout, and 120-second total deadline; verify partial/rejected classification for unfinished codes
- [x] 2.7 Enforce one global `daily` sync through D1 lease acquisition and owner `run_id` CAS; return `409 QUANT_SYNC_IN_PROGRESS` for overlapping requests and verify stale-lease takeover cannot be overwritten by the old run
- [x] 2.8 Persist only completed/partial snapshots, retain the latest 30 valid snapshots, prune older rows after authoritative write, and verify rejected runs and daily-bar rows follow the stated retention boundaries
- [x] 2.9 Freeze the complete `momentum-v1` predicate, score, 21-bar/20-interval `return20` contract (`close[-1] / close[-21] - 1`), and deterministic ranking with focused assertions for every threshold and missing-data case

## 3. Gateway And Local Runtime

- [x] 3.1 Run GitNexus impact for Gateway fetch, dashboard auth, and local service orchestration before edits; record callers and risk in implementation notes
- [x] 3.2 Add `/quant` Gateway routing, `QUANT_ORIGIN`, and dashboard-level auth; verify unauthenticated redirect and existing route regression tests
- [x] 3.3 Add quant app package and local `3004` service; verify `pnpm dev` readiness and no collision with Blog `3002`

## 4. Frontend

- [x] 4.1 Implement quant app runtime config, typed API client, layout, and capability panel
- [x] 4.2 Implement watchlist/sync controls and candidate snapshot table with loading/error/partial states
- [x] 4.3 Implement stock daily-bar view and v1 limitations display; verify quant app type-check and component tests

## 5. End To End Verification

- [x] 5.1 Validate all OpenSpec artifacts with `openspec validate --changes --strict --no-interactive`
- [x] 5.2 Run focused API, DB, Gateway, frontend tests plus all affected type-checks
- [x] 5.3 Start local stack with a repeatable local Tushare fixture (fixed `daily` response with more than 120 bars), verify `http://localhost:8080/quant/` through the administrator browser flow, repeat sync for idempotence, and read back page/API results plus `quant_daily_bar`, `quant_scan_snapshot`, and `quant_sync_state` from local D1; keep the existing fail-closed path evidence as a separate assertion
- [x] 5.4 Ensure the new quant files are included in the GitNexus index, run `detect_changes`, and review that only expected quant symbols/flows are affected before closeout; current tracked-only output is insufficient evidence for this task
