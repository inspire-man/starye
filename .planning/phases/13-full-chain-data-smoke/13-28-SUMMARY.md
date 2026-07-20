---
phase: 13-full-chain-data-smoke
plan: "28"
subsystem: local-runtime
status: complete
runtime_eligibility: released
runtime_lifecycle: cleaned
post_cleanup_fixed_ports: all_free
---

# Phase 13 Plan 28: Basic Local Lifecycle Smoke

The repaired root `pnpm dev` command completed one basic local lifecycle run.

- Pre-launch fixed ports `8080, 8787, 5173, 3002, 3003, 3000, 3001` were free.
- After a 45-second Nuxt cold-start allowance, every fixed port was listening.
- `pnpm check:services` passed with all seven listeners healthy and canonical Gateway `robots`, `auth`, and `authSlash` accepted through `http://localhost:8080`.
- The seven listener PIDs observed after the empty-port gate were stopped, and the same fixed-port set was empty afterward.

## Repair

The local supervisor now keeps materialized Pages build inputs available through the readiness window and allows 40 seconds for initial service startup. Windows wrapper exit/error signals only trigger cleanup after readiness, while a missing fixed port still closes the startup as failed.

## Scope

No data-chain run, fixture, D1/API write, browser, provider, remote, migration, or deployment action occurred. Plan 13-27 remains a historical blocked observation. Plan 13-17 must consume this Summary's three lifecycle fields before allocating a local handoff.
