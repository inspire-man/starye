---
phase: 19-dashboard-operations-and-end-to-end-proof
plan: 02
subsystem: evidence
tags: [phase19, evidence, tdd, redaction, provider, gateway]
requires:
  - 19-01
provides:
  - phase19-evidence-schema
  - phase19-json-markdown-builder
affects:
  - 19-03
  - 19-04
tech-stack:
  added: []
  patterns:
    - discriminated local_contract/credentialed_provider evidence
    - allowlisted deterministic JSON/Markdown projection
key-files:
  created:
    - scripts/phase19-evidence.ts
    - .planning/phases/19-dashboard-operations-and-end-to-end-proof/19-EVIDENCE-SCHEMA.md
  modified:
    - packages/config/src/deployment-target/data-chain-evidence.ts
    - packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts
decisions:
  - "Keep the Phase 13 local/remote evidence contract intact and add a separate Phase 19 mode-aware contract."
  - "Bind production provider URLs to the server-owned repository and numeric run ID; arbitrary URLs are rejected."
  - "Treat incomplete provider proof as checkpoint/failed evidence and require a literal validated receipt marker for passed records."
metrics:
  duration: 29m
  completed: 2026-08-01
  tasks: 2
  files: 4
status: complete
---

# Phase 19 Plan 02: Run-Bound Evidence Schema Summary

Mode-aware local contract and credentialed provider evidence with deterministic JSON/Markdown output, tuple validation, provider binding, callback facts, validated receipts, CRUD mutation/readback/restore status, and sensitive-field rejection.

## Accomplishments

- Added Phase 19 `local_contract` and `credentialed_provider` discriminated evidence modes with distinct target/workflow/repository/ref/Environment labels.
- Added explicit D1 task/run/attempt tuple, provider run/attempt/SHA/derived URL, callback event IDs/nonces, mode-bound validated receipt, Gateway origin, CRUD statuses, allowlisted command labels, UTC timestamp, and truthful passed/failed/checkpoint status validation.
- Added strict unknown-key and sensitive-field rejection for secrets, tokens, cookies, headers, private keys, raw payloads and arbitrary provider URLs.
- Added `buildPhase19EvidencePair`, read-only JSON input, stable JSON/Markdown serialization, deterministic self-test, and pair file writer in `scripts/phase19-evidence.ts`.
- Added the canonical field/ownership contract in `19-EVIDENCE-SCHEMA.md`.

## Verification

- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-evidence.test.ts` -> 26 passed.
- `pnpm exec tsx scripts/phase19-evidence.ts --self-test` -> `{"selfTest":"passed"}` with local and provider pair byte counts.
- `pnpm exec eslint packages/config/src/deployment-target/data-chain-evidence.ts packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts scripts/phase19-evidence.ts` -> passed.
- `git diff --check` -> passed.

## TDD Gate Compliance

- RED: `21b6566 test(19-02): add Phase 19 evidence contract tests`
- GREEN: `0f2dcf6 feat(19-02): add mode-aware Phase 19 evidence builder`
- REFACTOR: no separate refactor commit; lint formatting was applied before the GREEN commit.

## Files Created/Modified

- `packages/config/src/deployment-target/data-chain-evidence.ts` - Phase 19 schema, builder, validator and serializers.
- `packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts` - local/provider tuple, receipt, CRUD, redaction and checkpoint tests.
- `scripts/phase19-evidence.ts` - typed pair builder, safe input reader, deterministic writer and self-test CLI.
- `.planning/phases/19-dashboard-operations-and-end-to-end-proof/19-EVIDENCE-SCHEMA.md` - canonical field and ownership contract.

## Decisions Made

- Preserve the Phase 13 contract and add a separate Phase 19 schema so existing smoke/observer callers retain their `local`/`remote` behavior.
- Use fixed local labels (`local-gateway`, `local-contract`, `fixture`, `local`) and fixed provider labels (`starye-org`, `main`, `starye-org`) to prevent semantic promotion.
- Derive the GitHub Actions URL from `inspire-man/starye` plus a numeric provider run ID instead of accepting a URL input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Windows CLI entry detection**
- **Found during:** Task 2 (JSON+Markdown evidence pair builder)
- **Issue:** The first `import.meta.url` comparison exited successfully without running `--self-test` on Windows paths.
- **Fix:** Use `pathToFileURL(resolve(process.argv[1])).href` for the executable entry check and verify self-test output.
- **Files modified:** `scripts/phase19-evidence.ts`
- **Verification:** `pnpm exec tsx scripts/phase19-evidence.ts --self-test` emitted `selfTest: passed`.
- **Committed in:** `0f2dcf6`

**2. [Rule 2 - Missing Critical] Added explicit validated receipt marker**
- **Found during:** Task 1 (run-bound evidence schema)
- **Issue:** A receipt-shaped object without an explicit validation fact could be mistaken for an API-validated receipt.
- **Fix:** Passed records now require `validatedReceipt.validated === true`; mode-bound source and template remain required.
- **Files modified:** `packages/config/src/deployment-target/data-chain-evidence.ts`, `packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts`, `.planning/phases/19-dashboard-operations-and-end-to-end-proof/19-EVIDENCE-SCHEMA.md`
- **Verification:** focused suite covers `validated: false` rejection and passed local/provider records.
- **Committed in:** `0f2dcf6`

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both adjustments preserve deterministic, truthful evidence semantics; no additional runtime scope was introduced.

## Issues Encountered

- `pnpm --filter @starye/config type-check` remains red in the pre-existing `src/deployment-target/__tests__/production-workflow.integration.test.ts` with missing `afterEach` and empty tuple index errors. The focused evidence suite, standalone script type-check, ESLint and self-test are green; the unrelated test file is deferred to its owning plan.

## Known Stubs

None found in the files created or modified by this plan.

## Self-Check: PASSED

- `19-EVIDENCE-SCHEMA.md`, `scripts/phase19-evidence.ts`, schema and test files exist.
- Commits `21b6566` and `0f2dcf6` are present in git history.
- Post-commit deletion scan reported no deleted files.

## Next Phase Readiness

Plans 19-03 and 19-04 can consume the typed Phase 19 pair builder. Local movie/manga proof should use `local_contract`; the single production sign-off must supply one exact `credentialed_provider` tuple with provider facts and callback event/nonce pairs.

---
*Phase: 19-dashboard-operations-and-end-to-end-proof*
*Plan: 02*
*Completed: 2026-08-01*
