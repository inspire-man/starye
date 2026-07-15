---
phase: 13
slug: full-chain-data-smoke
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-16
---

# Phase 13 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The typed lifecycle is `pre_ingest` -> `resolved_pending_observation` -> terminal `resolved`: only the first may have `itemId: null`; the second preserves the authoritative tuple after fixture plus D1 snapshot while waiting for Dashboard then viewer; only the final state can be aggregate `passed`. `CHECKPOINT_EXIT_CODE = 2` is a truthful non-success result: the runner must write schema-valid, redacted evidence before returning it. The single `smoke:data-chain:verify` wrapper accepts only runner `0|2`, deterministically validates the exact target/run/mode JSON and Markdown pair, requires `0 => terminal resolved/aggregate passed`, and preserves `2 => persisted pre-ingest or resolved-pending non-success`. A schema-validation command returns `0` for a valid pending/checkpoint artifact; it never promotes that artifact to `passed`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 across config, crawler, DB, API, and movie-app workspaces |
| **Config file** | Package-level `vitest.config.*` plus existing `__tests__/` conventions |
| **Quick run command** | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-evidence.test.ts src/deployment-target/__tests__/data-chain-smoke-local.test.ts src/deployment-target/__tests__/data-chain-smoke-remote.test.ts` |
| **Full suite command** | `pnpm --filter @starye/config test --run && pnpm --filter @starye/crawler test --run && pnpm --filter @starye/db test --run && pnpm --filter api test --run && pnpm --filter @starye/movie-app test --run` |
| **Estimated runtime** | ~90 seconds for focused workspace suites; real browser/provider checks are bounded checkpoints |

---

## Sampling Rate

- **After every task commit:** Run the exact focused command in the map plus `git diff --check`.
- **After Wave 1:** Run config, crawler, and DB focused suites; verify deterministic one-item fixture, evidence redaction, all three lifecycle states, tuple preservation after snapshot, ordered observer append grammar, and no-mutation gates.
- **After Wave 2:** Run the full suite and type checks; execute local smoke only through the single wrapper and `http://localhost:8080/...`. Confirm its preflight is exactly local `validate` with the selected Wrangler profile and no live executor. The wrapper accepts terminal passed exit 0 or a persisted code-2 pending/checkpoint result, never promotes the latter to pass.
- **After Wave 3:** Run the remote contract suite before the selected-target attempt through the same wrapper using the explicit local run id; the remote branch must inspect only terminal passed `<target>/<run>/local.json|.md`, never a latest-by-target or pending artifact. Provider/browser absence must finish with evidence plus code 2, never a simulated pass.
- **Before `$gsd-verify-work`:** Revalidate the exact local/remote JSON and Markdown pairs with the shared typed schema, ensure the requested local record is terminal passed with projection/auth/readiness/D1/API/Dashboard/viewer rows before any remote pass claim, and run the full suite.
- **Max feedback latency:** 90 seconds for unit/contract suites; authorized browser and provider steps are explicit, narrow checkpoints.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command Or Controlled Checkpoint | Expected Checkpoint Exit | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|--------------------------------------------|--------------------------|-------------|--------|
| 13-01-01 | 01 | 1 | DATA-02 | T-13-01 | Selected local projection is the first readiness gate and never serializes user-managed values. | command/contract | `pnpm target-profile project-local --target starye-org --check && pnpm target-profile validate --target starye-org` | A failing projection is a hard local prerequisite failure; no fixture, evidence success, or remote attempt may follow. | existing command | planned |
| 13-01-02 | 01 | 1 | DATA-03, DATA-07, TEST-05 | T-13-02, T-13-03, T-13-04 | Deterministic tuple, pre-ingest/pending/resolved lifecycle, D1/service/auth/data surfaces, redaction, canonical-path policy, and typed non-success semantics are enforced. | unit/contract | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-evidence.test.ts` | Contract tests assert `CHECKPOINT_EXIT_CODE = 2`; only a failed/checkpoint pre-ingest record may have `itemId: null`; fixture-plus-snapshot creates tuple-preserving `resolved_pending_observation`; Dashboard then viewer is the only promotion path; the pure validator accepts persisted pending/checkpoint evidence with exit 0. | add in task | planned |
| 13-02-01 | 02 | 1 | DATA-03, TEST-05 | T-13-05, T-13-06, T-13-08 | Only registry-owned prepared fixture/snapshot operations can cross a selected-target boundary. | unit/contract | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/mutation-entry.test.ts` | Failed preflight/ownership returns a redacted checkpoint before materialization or child execution. | extend in task | planned |
| 13-02-02 | 02 | 1 | DATA-03, DATA-04, TEST-05 | T-13-07, T-13-08, T-13-09 | The fixture has one non-R18 movie plus one player; snapshot is read-only and returns only the correlation tuple. | unit/contract | `pnpm --filter @starye/crawler exec vitest run src/smoke/__tests__/data-chain-fixture.test.ts src/utils/__tests__/api-client.test.ts && pnpm --filter @starye/db exec vitest run scripts/__tests__/target-d1-mutation.test.ts` | Invalid prepared context or fixture/snapshot gate blocks before API/D1 child work; no pass can be emitted. | add in task | planned |
| 13-03-01 | 03 | 2 | DATA-01, DATA-02, DATA-04, DATA-06, DATA-07, TEST-05 | T-13-10, T-13-12, T-13-13, T-13-14 | Exact local `validate` preflight, fixed D1 table/column/index and fresh-or-rerun seed contract, typed service probe, Gateway-only auth, D1/API tuple, and typed pending local evidence are all prerequisites. | unit/integration | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-smoke-local.test.ts src/deployment-target/__tests__/data-chain-evidence.test.ts` then `pnpm smoke:data-chain:verify -- --mode local --target starye-org --run-id <run-id> --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence` | Tests prove local `scope: local, command: validate` uses the selected Wrangler profile with no live executor and does not emit `missing-live-resource-check`; a profile/projection/service failure writes a `pre_ingest` checkpoint with `itemId: null` and makes zero fixture/child calls. Fixture-plus-snapshot creates a tuple-preserving pending artifact; the wrapper accepts only `0 => terminal passed` or `2 => persisted pending/checkpoint non-success`. | add in task | planned |
| 13-03-02 | 03 | 2 | DATA-01, DATA-05, DATA-06, DATA-07 | T-13-11, T-13-13 | Real local Gateway Dashboard then viewer observations append only to the existing pending tuple; Dashboard session never substitutes for independent `/auth/` row. | browser checkpoint | Open `http://localhost:8080/dashboard/movies`, append Dashboard, then only after it passes open `/movie/<item-code>` and append viewer; validate only with `pnpm smoke:data-chain-observe -- --validate --target starye-org --run-id <run-id> --item-code <item-code> --item-id <item-id>`. | Dashboard pass remains pending/exit 2; viewer pass promotes terminal pass/exit 0. Redirect, missing role/session, or viewer absence persists the matching checkpoint/exit 2; duplicate, skip, out-of-order, mismatched, and mixed CLI forms reject. | controlled runtime | planned |
| 13-04-01 | 04 | 3 | DATA-04, DATA-05, DATA-06, DATA-07, TEST-05 | T-13-15, T-13-16, T-13-17, T-13-18 | Remote work requires the explicit requested terminal-passed local tuple, explicit selected target, live preflight, credential/account/ownership gates, closed prepared children, post-snapshot pending tuple preservation, and selected-canonical API correlation. | unit/provider checkpoint | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-smoke-remote.test.ts src/deployment-target/__tests__/mutation-entry.test.ts` then `pnpm smoke:data-chain:verify -- --mode remote --target starye-org --run-id <run-id> --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence` | A missing/stale/different-run, pre-ingest, or pending local pair, or missing/not-passed `local_projection`, writes `pre_ingest/local_projection/local_prerequisite_unmet`, exits 2, and makes zero preflight/provider/fixture/D1-child calls. Missing credentials, ownership, or provider access writes `pre_ingest/remote_preflight` with `itemId: null` and zero fixture/D1 child calls. After snapshot, the fixed `/api/public/movies/<code>` must match tuple code/id; direct-port, mismatch, or unavailable API persists `canonical_api_unavailable` while retaining the pending tuple. | add in task | planned |
| 13-04-02 | 04 | 3 | DATA-05, DATA-06, DATA-07 | T-13-19 | Selected-canonical Dashboard then viewer observations use the same remote pending tuple and cannot be substituted by an API response or direct app origin. | browser/provider checkpoint | Open the selected canonical Dashboard, append Dashboard, then only after it passes open `/movie/<item-code>` and append viewer; run the mode-free exact `--validate` command. | Dashboard pass remains pending/exit 2; viewer pass promotes terminal pass/exit 0. Browser/provider/session/viewer absence uses the matching checkpoint/exit 2; duplicate, skip, out-of-order, and mismatched append are rejected. | controlled runtime | planned |

*Status: planned -> green / red / flaky / checkpoint. `checkpoint` is evidence of an unavailable external prerequisite, never a success state.*

---

## Wave 0 Requirements

Existing Vitest, typed deployment-target tests, fake prepared executors, and import-safe TypeScript script patterns are the Phase 13 Wave 0 harness. No framework installation is required.

- [x] Evidence tests cover deterministic identity, discriminated pre-ingest/pending/resolved lifecycle, tuple preservation after snapshot, redaction, fixed projection/D1/service/auth/data surfaces, direct-port rejection, Dashboard-then-viewer append/validate grammar, and non-success exit semantics.
- [x] Prepared-entry/crawler/DB tests cover one-item one-player fixture scope, read-only snapshot, no mutation after failed gate, and secret-free child output.
- [x] Local runner tests cover local `validate` preflight with selected Wrangler profile/no live executor, the precise `movie`/`player` schema and fresh-or-rerun seed contract, zero-exit `[!!]` service rejection, Gateway-only `/auth/`, direct-port auth rejection, pre-ingest `itemId: null` checkpoints before snapshot, tuple-preserving pending evidence after snapshot, ordered Dashboard/viewer transition, wrapper `0|2` semantics, and no fixture before checkpoint.
- [x] Remote runner tests cover exact `<target>/<run>/local.json|.md` lookup, stale-run/pending/missing-projection rejection before provider preflight, required terminal passed local D1/service/auth/browser evidence, live ownership gates, no-mutation pre-ingest checkpoints, post-snapshot tuple preservation and canonical API code/id correlation, ordered browser transition, direct-port/mismatch checkpoints, wrapper `0|2` semantics, and canonical-only paths.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Controlled Instructions | Checkpoint Handling |
|----------|-------------|------------|-------------------------|---------------------|
| Authorized local Dashboard management state and viewer. | DATA-05, DATA-06 | The existing browser session and admin role cannot be fabricated in a unit test. | Use only `http://localhost:8080/dashboard/movies`, append Dashboard to the exact pending tuple, then only after its passed row use `http://localhost:8080/movie/<item-code>` to append viewer; validate through the exact Plan 13-03 task-2 command. | `dashboard_auth_unavailable` or `canonical_viewer_unavailable` is persisted and returns 2; it preserves the post-snapshot tuple, blocks terminal local pass, and blocks remote eligibility. |
| Selected-target Dashboard and canonical movie viewer. | DATA-05, DATA-06, DATA-07 | Requires the real selected provider target, authorized browser session, and deployed Gateway surface. | Use only selected-canonical `/dashboard/movies` then `/movie/<item-code>` in that order; append and validate through the exact Plan 13-04 task-2 commands. | `dashboard_auth_unavailable` or `canonical_viewer_unavailable` is persisted and returns 2; no production success claim or later synthetic promotion is allowed. |

---

## Validation Sign-Off

- [x] All eight planned tasks have a focused automated command or a justified, typed browser/provider checkpoint.
- [x] Every requirement in `DATA-01..DATA-07` and `TEST-05` maps to one or more tasks above.
- [x] Sampling continuity has no three implementation tasks without focused automated verification.
- [x] Wave 0 covers all new runner, evidence, D1 readiness, Gateway auth, prepared-entry, and browser-handoff seams.
- [x] No watch-mode flags are used; all Vitest commands use `vitest run` semantics.
- [x] Pending/checkpoint evidence and exit code 2 are explicitly distinguished from schema validation and terminal passed execution; the one wrapper rejects every runner code other than 0 or 2 and verifies the matching artifact before preserving either outcome.
- [x] Revised plan frontmatter and structures passed; `nyquist_compliant: true` and `wave_0_complete: true` are set only after that static verification.

**Approval:** lifecycle revision static verification passed on 2026-07-16: all Plan frontmatter/structures valid and decision coverage 7/7.
