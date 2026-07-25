---
phase: 13-full-chain-data-smoke
plan: "51"
subsystem: local-data-chain-observation
tags: [observer, gateway, auth, gap-closure]
requires:
  - phase: 13-50
    provides: immutable local dashboard_auth_unavailable history motivating the shared fix
provides:
  - repaired default observer session-cookie path and auth-login fail-closed detection
  - regression coverage for cookie material and /auth/login short-circuit
affects: [13-52, local-data-chain]
tech-stack:
  added: []
  patterns:
    - optional untracked STARYE_DATA_CHAIN_SESSION_COOKIE(_FILE) for default puppeteer observer
    - auth login path short-circuit before SPA tuple wait
key-files:
  created:
    - .planning/phases/13-full-chain-data-smoke/13-51-SUMMARY.md
  modified:
    - scripts/data-chain-surface-observation.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
key-decisions:
  - "Closed evidence vocabulary still maps Dashboard non-pass to dashboard_auth_unavailable; no new tuple-miss checkpoint was added."
  - "Default observer can inject starye.session_token from untracked env/file without logging the value."
  - "No p13-51 smoke run, handoff, remote, or production browser was allocated."
requirements-completed: []
coverage:
  - deliverable: observer choke-point repair
    verification:
      - kind: command
        ref: pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-smoke-local.test.ts
        status: pass
      - kind: command
        ref: pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-smoke-remote.test.ts
        status: pass
    human_judgment: false
duration: 25m
completed: 2026-07-25
status: complete
---

# Phase 13 Plan 51: Local Observer Choke-Point Repair

**Repaired the shared Dashboard observation path so signed-session default observation and exact-tuple adapters are honest, without allocating any new smoke run.**

## GitNexus

| Symbol | Direction | Risk | Notes |
| --- | --- | --- | --- |
| `observeDataChainSurfaces` | upstream | **LOW** | direct caller: `runDataChainSurfaceObservationCli` only |
| `observeSurfaceDefault` | upstream | **LOW** | no external direct callers in index |
| `captureSurface` | (internal) | n/a | private helper in same file |

Pre-edit impact was LOW. `gitnexus detect-changes --scope all` later reported high because the dirty tree also includes unrelated `AGENTS.md`/`CLAUDE.md`; those files were **not** staged for this commit.

## Diagnosis (p13-49 / p13-50)

| Cause class | Source | Applied? |
| --- | --- | --- |
| Isolated puppeteer profile not signed-in → `/auth/login` | `observeSurfaceDefault` `userDataDir` under `.target-runs/phase13-browser-profile/{targetId}` | **Primary** — no session cookie injection existed |
| All Dashboard non-pass → `dashboard_auth_unavailable` | `captureSurface` closed mapping | Confirmed; vocabulary has no distinct tuple-miss code |
| Controlled adapter mismatch / unavailable | `normalizeBrowserResult` + exact itemCode/itemId check | Still fail-closed; exact passed adapter path unchanged and green in tests |
| baseUrl/target resolution hard-code path | `observeDataChainSurfaces` catch → dashboard checkpoint | Unchanged |

Live p13-50 `local.json` remained immutable and was not rewritten.

## Changes

1. **`scripts/data-chain-surface-observation.ts`**
   - Export `DATA_CHAIN_SESSION_COOKIE_NAME` (`starye.session_token`)
   - Export `isAuthLoginPath()` for `/auth/login` detection
   - Export `resolveObserverSessionCookie()` from `STARYE_DATA_CHAIN_SESSION_COOKIE` or untracked `STARYE_DATA_CHAIN_SESSION_COOKIE_FILE` (value never logged)
   - `observeSurfaceDefault` optionally `setCookie` before navigation
   - Local mode requires `LOCAL_GATEWAY_ORIGIN` only
   - Auth login final URL returns `unavailable` before SPA tuple wait
   - `waitForFunction` timeout → `unavailable` (still maps to closed Dashboard/Viewer checkpoints)

2. **Tests** in `data-chain-smoke-local.test.ts`
   - cookie material resolution
   - immediate unavailable + setCookie on `/auth/login`
   - existing passed-adapter and mismatch cases remain green

## Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-smoke-local.test.ts` | exit 0; **22/22** passed |
| `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-smoke-remote.test.ts` | exit 0; **16/16** passed |

## Scope Boundary

- No `p13-51-*` run id, evidence directory, handoff, exact smoke verify, remote, production, D1, or Wrangler
- p13-49 / p13-50 / p13-45 / p13-41 evidence untouched
- Unrelated dirty `AGENTS.md` / `CLAUDE.md` / historical exit files not staged

## Next Phase Readiness

Wave 47 / **13-52** may allocate a fresh local `p13-52-*` run using the repaired observer (provide signed session via untracked cookie env/file or injected adapter).

## Self-Check: PASSED

- Observer repair landed with focused regressions green
- No smoke run allocated
- Historical evidence immutable
