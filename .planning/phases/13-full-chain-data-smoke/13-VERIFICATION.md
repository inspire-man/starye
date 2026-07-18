---
phase: 13-full-chain-data-smoke
verified: 2026-07-18T09:37:12Z
status: gaps_found
score: 9/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/11
  gaps_closed:
    - "The canonical one-item contract is restored across evidence, fixture, prepared children, D1 snapshot, and both runners."
    - "Attempt D supplies terminal, receipt-backed local D1/Gateway/API/Dashboard/viewer proof for one exact tuple under the accepted Codex IAB execution adapter."
  gaps_remaining:
    - "The selected production target has no provider/D1/API/admin/browser proof; the exact remote pair remains a pre-ingest target_preflight_unmet checkpoint."
  regressions: []
gaps:
  - truth: "The selected production target proves the same item in provider-backed D1, canonical API, and authorized Dashboard management state."
    status: failed
    reason: "Attempt D remote stopped at remote_preflight/target_preflight_unmet before any provider child, fixture, D1 snapshot, canonical API request, or Dashboard observation. The remote exact verifier reports checkpoint and provesExternalChain false."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-9c808cff04cc438d997beeaa8ecabafe/remote.json"
        issue: "pre_ingest/checkpoint, itemId null, and only one remote_preflight observation; no production data-surface receipt exists."
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-9c808cff04cc438d997beeaa8ecabafe/remote.md"
        issue: "Deterministically matches the checkpoint JSON and therefore documents non-success rather than production usability."
    missing:
      - "An authorized selected-target preflight/ownership pass for the exact terminal local run."
      - "One bounded remote fixture receipt and matching count-one D1 snapshot/code/id receipt."
      - "A selected-canonical API receipt for the same remote tuple."
  - truth: "The item is visibly usable through the selected production canonical Dashboard and viewer routes, with captured evidence."
    status: failed
    reason: "This is the browser half of the same external-preflight blocker: no remote tuple was resolved, so no production Dashboard or viewer observation could run. The accepted Codex IAB adapter authorizes an observation mechanism but grants no provider credentials, remote mutation, or production-success override."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-9c808cff04cc438d997beeaa8ecabafe/remote.json"
        issue: "Contains no browser_observer/browser_navigation receipt and no canonical production path."
      - path: ".planning/phases/13-full-chain-data-smoke/13-08-PLAN.md"
        issue: "The accepted execution override explicitly states that it grants no provider credential, remote mutation, or authorization bypass."
    missing:
      - "Authorized Dashboard observation at the selected target canonical /dashboard/movies route for the resolved remote tuple."
      - "Ordered canonical /movie/<item-code> viewer observation and terminal remote resolved/passed evidence."
---

# Phase 13: Full Chain Data Smoke Verification Report

**Phase Goal:** Prove the selected target is actually usable by running the local and production data chain through Gateway/canonical domain.
**Verified:** 2026-07-18T09:37:12Z
**Status:** gaps_found
**Re-verification:** Yes - after Plans 13-05 through 13-08

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Local smoke proves API, auth/dashboard, and content through `http://localhost:8080` only. | VERIFIED | Attempt D local is `resolved/passed`; its eight ordered rows use the local runner and browser observer, and every browser/API origin is `http://localhost:8080`. The fresh exact verifier returned `terminal_passed`, `provesExternalChain: true`. |
| 2 | Local D1 schema/readiness and minimal deterministic data are verified before production work. | VERIFIED | Attempt D records passed `local_d1_readiness` before D1/API/browser rows and a count-one `local_fixture_snapshot`; local orchestration and the fresh 49-test provenance suite enforce this order. |
| 3 | A targeted one-item fixture writes a known item through the service-auth API and records its identity. | VERIFIED | `DATA_CHAIN_FIXTURE_COUNT = 1`; `runDataChainFixture()` validates one non-R18 payload with one player and calls `ApiClient.syncMovie()` once. Attempt D correlates code `p13-smoke-starye-org-aa106c3d` to UUID `78ba8f4d-bbf6-4c8e-b9db-92ae1ba28d78`. |
| 4 | Local and selected-production D1/API/admin checks prove the item exists and is manageable after ingest. | FAILED | Local D1/API/Dashboard proof exists. Remote stopped at `target_preflight_unmet` before mutation, D1, API, or admin observation, so the production half is absent. |
| 5 | Local and production canonical viewers visibly show the recorded item, with evidence captured. | FAILED | Local Dashboard then viewer receipts are present and accepted. Remote has no resolved tuple, canonical path, Dashboard receipt, or viewer receipt. |
| 6 | The selected local projection gate passes without exposing user-managed values. | VERIFIED | Local evidence contains a passed `local_projection` receipt; the runner checks projection before D1/service/fixture work, and no evidence field contains environment or secret values. |
| 7 | Evidence enforces strict lifecycle, tuple, redaction, canonical path, receipt, and browser-order contracts. | VERIFIED | `data-chain-evidence.ts` is substantive (934 lines), exported and consumed by runner/observer/verifier. Fresh focused config run passed 49/49, including anti-fabrication and checkpoint cases. |
| 8 | The only smoke write is exactly one deterministic non-R18 fixture through one `syncMovie()` call. | VERIFIED | The previous ten-item drift is closed: constant is one, candidate contains one movie, fixture has one player/no batch fields, and fresh crawler tests passed 9/9 including `toHaveBeenCalledOnce()` and batch rejection. |
| 9 | Remote mutation is explicit-target, exact-local-prerequisite, preflight-first, registry-owned, and starts no child after a failed gate. | VERIFIED | `runRemoteDataChainSmoke()` loads the exact local pair, checks credential presence and live preflight before prepared children. Tests assert no fixture/snapshot call on local, credential, or preflight failure; Attempt D stopped with no remote mutation. |
| 10 | Failures persist honest pre-ingest or tuple-preserving pending evidence and never synthesize success. | VERIFIED | The remote artifact is the expected `pre_ingest/checkpoint` shape with `itemId: null`; its exact verifier reports `provesExternalChain: false`. Lifecycle/checkpoint tests pass. |
| 11 | Remote mode preserves the exact local tuple and selected canonical API/browser path contract. | VERIFIED | Source and tests bind remote target/run/code to the exact terminal local pair, require count one, build only `/api/public/movies/<code>`, and derive Dashboard before viewer paths. This verifies the contract, not production execution. |

**Score:** 9/11 truths verified (0 present-but-behavior-unverified)

The two failed truths share one root cause: selected-target external preflight did not pass. They remain separate because one covers provider/D1/API/admin correlation and the other covers canonical browser usability.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/config/src/deployment-target/data-chain-evidence.ts` | One-item identity, lifecycle, receipt, redaction, and canonical-path contract | VERIFIED | Exists, substantive, exported, wired into all smoke tools, and covered by fresh 49/49 config tests. |
| `packages/crawler/src/smoke/data-chain-fixture.ts` | One deterministic service-auth upsert | VERIFIED | One validated non-R18 movie, one player, one `syncMovie()` call; fresh tests 9/9. |
| `packages/config/src/deployment-target/mutation-entry.ts` | Closed prepared fixture/D1 operations | VERIFIED | Registry recognizes only fixed smoke entries and validates exact code/count-one child output. |
| `packages/db/scripts/target-d1-mutation.ts` | Read-only one-row D1 snapshot | VERIFIED | Parses only the prepared code and returns a matching non-R18 movie/player row; fresh tests 14/14. |
| `scripts/data-chain-smoke.ts` | Local and remote orchestration | VERIFIED | Local proof is real and terminal. Remote wiring is fail-closed and produced an honest checkpoint before children. |
| `scripts/data-chain-surface-observation.ts` | Controlled Dashboard/viewer observation | VERIFIED | CLI accepts only mode/target/run-id; caller-provided status is unsupported. Core owns load/order/receipts/render/write and permits only injected `observeSurface`. |
| `scripts/verify-data-chain-smoke.ts` | Artifact-only exact verifier | VERIFIED | Reads without running or rewriting evidence, checks JSON/Markdown parity and tuple, and distinguishes terminal proof from checkpoint. |
| Dashboard/movie DOM marker files and tests | Exact code+UUID browser predicate | VERIFIED | Dashboard named DOM test passed 1/1; movie DOM contract passed 1/1. Both views render `data-phase13-item-id` with the code as marker text. |
| Attempt D local evidence pair | Auditable local full-chain proof | VERIFIED | Exact verifier exit 0; same code/id across eight ordered receipts through Gateway. |
| Attempt D remote evidence pair | Auditable selected-production full-chain proof | FAILED AS PROOF / VERIFIED AS CHECKPOINT | Pair is structurally valid and immutable, but contains only `remote_preflight/target_preflight_unmet`; it explicitly does not prove the external chain. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Target/run | One fixture | `createDataChainCandidate` -> `createDataChainFixture` -> `syncMovie` | WIRED | Deterministic code, count one, one service-auth call. |
| Local readiness | Local D1/API | projection -> D1 -> service/auth -> fixture/snapshot -> Gateway API | WIRED AND PROVEN | Attempt D receipts preserve this order and tuple. |
| Local pending tuple | Dashboard/viewer | `observeDataChainSurfaces` -> injected live `observeSurface` -> repository receipts | WIRED AND PROVEN | Accepted Plan 13-08 adapter retained core ownership; local receipts are Dashboard then viewer. |
| Terminal local pair | Remote preflight | exact JSON/Markdown load -> explicit target/credential/live ownership gate | WIRED AND PROVEN FAIL-CLOSED | Attempt D reached this link and stopped at `target_preflight_unmet` before children. |
| Remote preflight | Provider fixture/D1/API | closed prepared entries -> snapshot -> canonical API | WIRED, NOT EXECUTED | Tests prove ordering, but Attempt D contains no provider receipt or remote item id. |
| Remote pending tuple | Canonical Dashboard/viewer | controlled observer | NOT REACHED | No remote pending tuple exists, so production browser evidence is absent. |
| Evidence pair | Exact verifier | artifact-only load + schema + deterministic Markdown + tuple/outcome | WIRED | Local returns terminal proof; remote returns checkpoint/non-proof. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Local runner | `snapshotResult.itemId` | Actual local fixture plus read-only D1 snapshot | Yes: Attempt D UUID | FLOWING |
| Local API row | code/id response | Gateway `/api/public/movies/<code>` | Yes: exact Attempt D tuple | FLOWING |
| Local Dashboard/viewer | code/id DOM tuple | Authorized Codex IAB live navigation under accepted adapter | Yes: receipt-backed ordered observations | FLOWING |
| Remote runner | remote `snapshot.itemId` | Provider fixture/D1 after preflight | No: preflight stopped first | DISCONNECTED BY CHECKPOINT |
| Remote Dashboard/viewer | remote pending tuple | Selected canonical browser session | No tuple/source exists | NOT REACHED |

### Accepted Execution Override

Commit `dd8c900` adds a Plan 13-08 execution override for the persistent Codex in-app browser. It permits only repository `observeDataChainSurfaces()` with one injected `observeSurface`; repository core retains evidence loading, tuple validation, target/base resolution, Dashboard-before-viewer order, receipt construction, deterministic rendering, and writes. The adapter may report passed only after exact canonical origin/path plus code-and-UUID DOM checks.

This is not a `VERIFICATION.md` must-have override, so `overrides_applied` remains zero. The plan explicitly grants no provider credential, remote mutation, authorization bypass, or production-success waiver.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Exact Attempt D local artifact | `pnpm smoke:data-chain:verify -- --mode local ...` | `resolved/passed`, `terminal_passed`, `provesExternalChain: true` | PASS |
| Exact Attempt D remote artifact | `pnpm smoke:data-chain:verify -- --mode remote ...` | `pre_ingest/checkpoint`, `provesExternalChain: false`; wrapper exits non-success | PASS AS HONEST CHECKPOINT / GOAL NOT MET |
| Provenance/lifecycle/runner/verifier contracts | Config Vitest, four named files | 4 files, 49 tests passed | PASS |
| One-item fixture | Crawler focused Vitest | 1 file, 9 tests passed | PASS |
| One-row D1 snapshot | DB focused Vitest | 1 file, 14 tests passed | PASS |
| Dashboard tuple marker | Dashboard named Vitest test | 1 passed, 9 skipped | PASS |
| Movie viewer tuple marker | Movie-app focused Vitest | 1 file, 1 test passed | PASS |

The initial unfiltered Dashboard single-file command exceeded the 30-second verifier limit without output. The one named marker behavior then passed in 6.01 seconds; the timeout is retained as a test-runner warning, not counted as production evidence.

### Probe Execution

No Phase 13 `probe-*.sh` is declared or present. Step 7c is skipped.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| DATA-01 | 13-03, 13-06, 13-07, 13-08 | SATISFIED | Attempt D local proves API, auth, Dashboard, and viewer only through `http://localhost:8080`. |
| DATA-02 | 13-01, 13-03, 13-06, 13-08 | SATISFIED | Passed local D1 readiness precedes fixture and production attempt; count-one snapshot is retained. |
| DATA-03 | 13-01, 13-02, 13-05, 13-06, 13-08 | SATISFIED | One deterministic targeted fixture was written locally and its exact code/UUID identity recorded. |
| DATA-04 | 13-02 through 13-08 | PARTIAL - BLOCKER | Local D1/API/admin correlation passed; selected-production D1/API/admin correlation is absent. |
| DATA-05 | 13-03, 13-04, 13-07, 13-08 | PARTIAL - BLOCKER | Authorized local Dashboard observation passed; selected-production Dashboard was never reached. |
| DATA-06 | 13-03, 13-04, 13-07, 13-08 | PARTIAL - BLOCKER | Local Gateway viewer passed; selected production canonical viewer was never reached. |
| DATA-07 | 13-01 through 13-08 | PARTIAL - BLOCKER | Local proof and an honest remote checkpoint are captured, but production smoke proof is not. |
| TEST-05 | 13-01 through 13-08 | SATISFIED | Scripts produce deterministic local proof or remote checkpoint output; fresh 49-test contract suite and both exact artifact checks agree. |

All eight Phase 13 requirement IDs appear in plan frontmatter; none is orphaned. The `[x]` markers currently present in `REQUIREMENTS.md` are planning metadata, not evidence, and do not override the partial runtime findings above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| Phase implementation files | - | No unreferenced `TBD`, `FIXME`, or `XXX` markers | INFO | No debt-marker blocker. |
| `packages/config/src/deployment-target/mutation-entry.ts` | 481 | `return {}` | INFO | Existing success result for non-smoke prepared entries; not a Phase 13 stub and not on the smoke observation path. |
| Dashboard test command | - | Full single-file run exceeded 30 seconds; named marker test passed | WARNING | Test harness/runtime issue only; does not supply or invalidate remote production proof. |

### Human Verification Required

None for the current verdict. Local browser verification is represented by accepted, tuple-bound live receipts. The production result is observably absent, so it is a failed must-have rather than an uncertain item awaiting visual judgment.

### Deferred Items

None. Phase 14 covers literal cleanup, RUNBOOK procedures, and final evidence mapping; its goal and success criteria do not perform or replace the missing selected-target provider/data/browser chain.

### Gaps Summary

The previous one-item and self-attestation gaps are closed. Attempt D is credible local proof: one deterministic item flows through local D1, Gateway API, authorized Dashboard, and Gateway viewer with receipt-bound code/UUID evidence. The accepted Codex IAB adapter changes only how live navigation is supplied; it does not weaken repository ownership of the evidence transition.

Phase 13 still misses its defining production outcome. The matching remote run stopped before mutation at `target_preflight_unmet`; consequently there is no provider-backed fixture, remote D1 row, selected-canonical API result, Dashboard management observation, or viewer observation. The checkpoint is structurally valid evidence of fail-closed behavior, not proof that the selected production target is usable. Phase 13 must remain pending.

---

_Verified: 2026-07-18T09:37:12Z_
_Verifier: the agent (gsd-verifier)_
