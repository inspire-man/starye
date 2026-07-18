---
phase: 13-full-chain-data-smoke
verified: 2026-07-18T21:47:25Z
status: gaps_found
score: 9/13 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/13
  gaps_closed:
    - "Plan 13-11 closed the standalone-versus-runner local-preflight environment mismatch: both callers now use pickRuntimeEnvironment."
    - "Plan 13-11 closed the generic projection diagnostic gap: projection-mismatch and local-api-token-shadowing now round-trip through evidence and verifier output."
  gaps_remaining:
    - "The fresh p13-12 local run stopped at pre_ingest/gateway_auth/gateway_auth_unavailable and did not produce a pending or terminal local tuple."
    - "The selected production target still has no current provenance-valid provider-backed D1/API/admin proof for one exact fresh run."
    - "The selected production Dashboard and viewer still have no current tuple-bound browser receipts or terminal remote verifier result."
    - "The Plan 13-12 pending-handoff wrapper assumes outer pnpm preserves verifier exit 2, but the canonical package script normalizes the nested exit to 1."
  regressions: []
gaps:
  - truth: "The currently selected local path can produce a fresh terminal local pair before remote work."
    status: failed
    reason: "Plan 13-11 repaired and independently regression-tested the earlier preflight caller mismatch, but run p13-12-81b811028cd94b9884f09f6147c6ca84 stopped later at gateway_auth/gateway_auth_unavailable. Current source maps both a fetch exception and an invalid status/redirect to this same checkpoint, and the timed-out runner host retained no auth response diagnostic, so the root cause is not proven."
    artifacts:
      - path: "scripts/data-chain-smoke.ts"
        issue: "observeGatewayAuthDefault performs the canonical http://localhost:8080/auth/ request, while runDataChainSmoke collapses fetch exceptions and invalid Gateway auth responses into gateway_auth_unavailable."
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-12-81b811028cd94b9884f09f6147c6ca84/local.json"
        issue: "Schema-valid pre_ingest/checkpoint artifact with itemId null and only gateway_auth/gateway_auth_unavailable."
      - path: ".planning/phases/13-full-chain-data-smoke/13-12-SUMMARY.md"
        issue: "The sole runner host timed out after 304 seconds after the pair was persisted; no retry occurred and no underlying auth status/exception was retained."
    missing:
      - "Run a scoped gsd-debug diagnosis of the canonical Gateway auth observation without replaying or modifying the immutable p13-12 run."
      - "Determine from reproducible read-only diagnostics whether the failure is fetch reachability, HTTP status, redirect location, or another Gateway/auth condition before planning a fix."
      - "After diagnosis and any verified repair, use a different collision-gated run id to produce a terminal local pair."
  - truth: "The selected production target proves the item in provider-backed D1, canonical API, and authorized Dashboard management state."
    status: failed
    reason: "The p13-12 local checkpoint correctly blocked all remote work. Its remote pair is absent, and the two older remote files labelled resolved/passed are rejected by the current exact verifier because they lack count-one/provenance requirements."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-12-81b811028cd94b9884f09f6147c6ca84/remote.json"
        issue: "Missing because remote mode was never eligible or invoked."
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/local-20260717t050622756z/remote.json"
        issue: "Legacy passed label is rejected by the current validator: missing itemCount 1 and required provenance receipts."
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/local-20260717t084300z/remote.json"
        issue: "Legacy passed label is rejected by the current validator: invalid D1 cardinality semantics and missing required provenance receipts."
    missing:
      - "A different fresh terminal local prerequisite for the same target/run/code correlation."
      - "A successful official remote live preflight immediately before the bounded remote runner."
      - "One closed fixture execution and count-one remote_fixture_snapshot establishing the remote itemId."
      - "Selected-canonical API and authorized Dashboard receipts matching that remote tuple."
  - truth: "The item is visibly usable through the selected production canonical Dashboard and viewer routes, with captured terminal evidence."
    status: failed
    reason: "Plan 13-12 recorded zero IAB and zero remote/provider invocations. No p13-12 remote tuple exists, so repository core could not record selected-canonical Dashboard-before-viewer receipts and no remote exact verifier can return terminal_passed."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-12-81b811028cd94b9884f09f6147c6ca84/remote.md"
        issue: "Missing; there is no selected-canonical Dashboard/viewer observation for this run."
    missing:
      - "Authorized selected-canonical /dashboard/movies observation for the D1-established remote tuple."
      - "Ordered /movie/<item-code> viewer observation for the same remote itemId."
      - "Exact local and remote verifiers both returning terminal_passed with provesExternalChain true."
  - truth: "The pending-handoff verification wrapper can recognize canonical checkpoint exit semantics without a false failure."
    status: failed
    reason: "Plan 13-12 Task 1 asserts that pnpm smoke:data-chain:verify exposes raw exit 2. The verifier process does set exit 2, but the nested pnpm package script emits ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL and the root script returns 1. The wrapper therefore rejects even a future valid pending handoff before checking its machine JSON."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/13-12-PLAN.md"
        issue: "The Task 1 PowerShell wrapper requires $LASTEXITCODE -eq 2 from the root pnpm script."
      - path: "package.json"
        issue: "smoke:data-chain:verify delegates through pnpm --filter ... exec, which normalizes the verifier's exit 2 to the outer lifecycle exit 1."
      - path: "scripts/verify-data-chain-smoke.ts"
        issue: "The exact verifier correctly emits machine JSON and sets process.exitCode=2 for checkpoint/pending evidence; the mismatch is outside this process."
    missing:
      - "Define and test one canonical pending-handoff wrapper contract that does not assume nested pnpm preserves exit 2."
      - "Require the wrapper to validate machine JSON plus the exact artifact state while still failing closed on malformed or terminally incompatible output."
behavior_unverified_items:
  - truth: "Attempts A-E and the Plan 13-09/13-10 evidence remain byte-for-byte immutable since their original creation."
    test: "Compare authoritative manifests captured immediately after each run was first written against the current evidence tree."
    expected: "Every prior-attempt hash equals its original post-creation hash, and each failed run was never reopened."
    why_human: "The Plan 13-12 session proves only that 70 pre-existing files were stable between its session baseline and post-run comparison; it cannot prove history before that baseline."
prohibition_flags:
  - statement: "Plan 13-09 declares five prohibitions as strings without status or verification tier metadata."
    status: unverified
    reason: "The declarations cannot be authoritatively tier-routed; human review recommended."
  - statement: "Plan 13-10 contains five judgment-tier prohibitions."
    status: unverified
    reason: "NON-AUTHORITATIVE LLM judgment: its recorded session supports no supplemental mutation, secret-free checkpoint evidence, no schema work, and time-bounded prior-evidence stability; human review recommended."
  - statement: "Plan 13-11 contains five judgment-tier prohibitions."
    status: unverified
    reason: "NON-AUTHORITATIVE LLM judgment: commit diffs, tests, and current evidence tree support preserved raw-token rejection, closed diagnostics, no live provider/browser action, and no evidence rewrite; human review recommended."
  - statement: "Plan 13-12 contains six judgment-tier prohibitions."
    status: unverified
    reason: "NON-AUTHORITATIVE LLM judgment: the execution log records gates before allocation, one runner, one execution-time verifier, zero IAB/remote/provider calls, secret-free evidence, and 70-file time-bounded hash stability; human review recommended."
---

# Phase 13: Full Chain Data Smoke Verification Report

**Phase Goal:** Prove the selected target is actually usable by running the local and production data chain through Gateway/canonical domain.
**Verified:** 2026-07-18T21:47:25Z
**Status:** gaps_found
**Re-verification:** Yes - after Plans 13-11 and 13-12

All twelve plans have executed. Plan 13-11 closes the prior caller-contract and diagnostic defects, but contract/test success is not full-chain proof. Plan 13-12 produces one honest local Gateway-auth checkpoint and no production evidence. No override exists or was applied.

The gap-repair budget is now 2/2 as process context only. It neither weakens the roadmap goal nor changes this verdict.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Local smoke has proven API, auth/dashboard, and content through `http://localhost:8080` only. | VERIFIED AS REGRESSION BASELINE | Attempt E independently re-verifies as `terminal_passed`, `provesExternalChain: true`; it does not prove the current p13-12 path. |
| 2 | Local D1 schema/readiness and minimal deterministic data are verified before production work. | VERIFIED AS REGRESSION BASELINE | Attempt E's current exact verifier accepts the required local projection/D1/service/auth/D1/API/browser receipt set. |
| 3 | A targeted one-item fixture writes a known item through the service-auth API and records identity. | VERIFIED | Count-one fixture/evidence contracts are substantive and covered by the 77-test focused suite; Attempt E records a D1-owned UUID. |
| 4 | Local and selected-production D1/API/admin checks prove the item exists and is manageable after ingest. | FAILED | Local proof exists; no current provenance-valid selected-production D1/API/admin pair exists. |
| 5 | Local and production canonical viewers visibly show the item, with evidence captured. | FAILED | Attempt E proves local routes only; p13-12 has no production Dashboard/viewer receipts. |
| 6 | The current selected local path can produce a fresh terminal local pair before remote work. | FAILED | p13-12 stops at `gateway_auth/gateway_auth_unavailable` with `itemId: null`; root cause is not established by current evidence. |
| 7 | Evidence enforces lifecycle, tuple, parity, redaction, canonical paths, receipts, and browser order. | VERIFIED | p13-12 is accepted only as checkpoint; both legacy remote passed labels are rejected by the current provenance-aware validator. |
| 8 | The only smoke write is one deterministic non-R18 fixture through one `syncMovie()` call and count-one D1 snapshot. | VERIFIED | Current source and the 77-test suite retain the one-item contract. |
| 9 | Remote work is exact-local-prerequisite, explicit-target, official-preflight-first, registry-owned, and fail-closed. | VERIFIED | The p13-12 local checkpoint prevents every remote/provider/IAB action; remote tests remain green. |
| 10 | Failures persist honest non-success evidence and never synthesize success. | VERIFIED | Exact p13-12 JSON/Markdown is `pre_ingest/checkpoint`, `itemId: null`; verifier reports `provesExternalChain: false`. |
| 11 | Local/remote correlation shares target/run/code while each environment's D1 owns its internally consistent itemId. | VERIFIED AS CONTRACT | Source/tests enforce mode-owned IDs; no p13-12 remote execution is claimed. |
| 12 | Prior attempts and new evidence remain immutable and untracked. | PRESENT_BEHAVIOR_UNVERIFIED | The 70-file Plan 13-12 baseline is stable only for its recorded session window; original creation baselines are unavailable. |
| 13 | Phase 14 literal cleanup, RUNBOOK stabilization, and final evidence mapping remain deferred. | VERIFIED | Phase 14 does not execute or replace the missing provider/data/browser chain. |

**Score:** 9/13 truths verified (1 present-but-behavior-unverified, 3 roadmap truths failed)

### Plan 13-11 Repair Facts

| Fact | Status | Independent evidence |
|---|---|---|
| Shared local environment owner | VERIFIED | `target-profile.ts:pickRuntimeEnvironment` is exported; both CLI `runPreflight` and local `runDataChainSmoke` call it. |
| Direct raw-token policy | VERIFIED | `runTargetPreflight` still emits blocking `local-api-token-shadowing`; the named regression passes. |
| Closed diagnostics | VERIFIED | Only `projection-mismatch` and `local-api-token-shadowing` are added to the closed checkpoint vocabulary; generic failures remain `target_projection_unmet`. |
| Verifier observability | VERIFIED | Machine output derives the optional checkpoint only from the validated persisted observation. |
| Focused regression and typecheck | VERIFIED | Independent rerun: 6 files, 77/77 tests; `@starye/config` typecheck passed. |
| Live/provider/browser mutation | NOT PERFORMED | Commit scope and execution log show code/tests/read-only local commands only; this remains a judgment-tier human-review flag. |

### Plan 13-12 Execution Facts

| Fact | Status | Independent evidence |
|---|---|---|
| Gates before allocation | VERIFIED | Session order shows project-local check, target validation, local preflight, then 77/77 tests all exited 0 before the SHA256 baseline and run generation. |
| Fresh run allocation | VERIFIED | Run id matches `p13-12-[0-9a-f]{32}`; the command loops until exact `Test-Path -LiteralPath` is false, and the 70-file baseline contains no p13-12 path. |
| Local invocation count | VERIFIED | One runner command was issued. Its host timed out after 304 seconds; the pair was later found persisted and the run was not retried. |
| Exact local pair | VERIFIED AS CHECKPOINT / FAILED AS PROOF | JSON/Markdown peers contain only `gateway_auth/gateway_auth_unavailable`, `itemId: null`. |
| Exact verifier | VERIFIED AS NON-SUCCESS | Execution-time verifier ran once; this re-verification independently reports checkpoint, `provesExternalChain: false`, and outer pnpm exit 1. |
| Browser/remote/provider work | VERIFIED NOT REACHED | Execution log records zero IAB and zero remote/provider invocations after the local checkpoint; no remote pair exists. |
| Prior evidence hashes | VERIFIED ONLY FOR SESSION WINDOW | 70/70 files matched baseline hash `a85fb364...ad8fd10`; this is not historical immutability proof. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/target-profile.ts` | Shared sanitized local runtime environment | VERIFIED | Exists, substantive, and wired to CLI preflight, Pages build, and the smoke runner import. |
| `scripts/data-chain-smoke.ts` | Local/remote one-item orchestration | PARTIAL FOR GOAL | Plan 13-11 wiring is correct; current runtime stops at the canonical Gateway auth gate before fixture/API/browser work. |
| `packages/config/src/deployment-target/data-chain-evidence.ts` | Closed lifecycle/provenance/checkpoint contract | VERIFIED | GSD artifact query passes; current tests and exact verifier exercise it. |
| `scripts/verify-data-chain-smoke.ts` | Artifact-only exact verifier | VERIFIED | Correctly validates pair parity and emits checkpoint without promotion. |
| Plan 13-11 local runner test | Default caller parity and diagnostics | VERIFIED | GSD artifact query passes; focused suite is 77/77. |
| Attempt E local pair | Accepted terminal local baseline | VERIFIED | Current exact verifier returns `terminal_passed`, `provesExternalChain: true`. |
| p13-12 local pair | Fresh exact local evidence | VALID CHECKPOINT / FAILED AS PROOF | Pair is schema-valid, deterministic, and non-terminal. |
| p13-12 remote pair | Provider/D1/API/browser proof | MISSING | Correctly absent after local failure, but required by the Phase goal. |
| `13-12-SUMMARY.md` | Accurate execution closeout | VERIFIED | Matches exact pair and session log, including timeout and wrapper normalization. |
| Plan 13-12 Task 1 wrapper | Pending IAB handoff gate | BROKEN | Raw outer-exit-2 assertion is incompatible with the canonical nested pnpm script. |

The automated Plan 13-12 artifact query reports placeholder paths as missing. Manual verification uses the exact run id above; this does not change the missing remote result.

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `pickRuntimeEnvironment` | CLI and local smoke preflight | Shared sanitized input | WIRED | Both current callers use the same owner. |
| Raw local preflight input | `local-api-token-shadowing` | Direct `runTargetPreflight` policy | WIRED | Remains blocking and tested. |
| Preflight issue code | JSON/Markdown/verifier checkpoint | Closed allowlist | WIRED | Exact codes round-trip; free-form messages do not. |
| Green local preflight | D1/fixture/API | Ordered local gates | BROKEN AT RUNTIME LATER | p13-12 passes projection/D1/service gates but stops at Gateway auth before fixture. |
| Terminal fresh local pair | Remote runner | Exact target/run/code eligibility | NOT REACHED | p13-12 has no terminal local pair. |
| Remote fixture/D1 tuple | Canonical API/Dashboard/viewer | Closed child then persistent IAB | NOT REACHED | No p13-12 remote pair or remote itemId exists. |
| Exact verifier exit 2 | Plan 13-12 PowerShell wrapper | Nested root pnpm package script | BROKEN | Inner verifier exit 2 becomes outer exit 1 before artifact assertions. |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| Attempt E local | `itemId` and required receipts | Local fixture, D1 snapshot, Gateway API, authorized browser | Yes | FLOWING REGRESSION BASELINE |
| p13-12 local | candidate `itemCode`, null `itemId` | Projection/D1/service gates then Gateway auth probe | No post-ingest data | DISCONNECTED BY GATEWAY CHECKPOINT |
| p13-12 remote | remote tuple | Terminal p13-12 local pair then provider D1 | No pair/source exists | NOT REACHED |

### Behavioral Spot-Checks

| Behavior | Command/result | Status |
|---|---|---|
| Plan 13-11 focused contracts | 6 files, 77/77 tests | PASS |
| Config type safety | `pnpm --filter @starye/config type-check` | PASS |
| p13-12 exact local artifact | Machine result is `pre_ingest/checkpoint`, `gateway_auth_unavailable`, `provesExternalChain: false`; outer pnpm exit 1 | PASS AS HONEST CHECKPOINT / GOAL FAIL |
| Attempt E local regression | Exact verifier returns `terminal_passed`, `provesExternalChain: true` | PASS |
| Two legacy remote passed labels | Current exact verifier rejects missing count-one/provenance semantics | PASS AS REJECTION / NOT PROOF |

No local or remote smoke, browser navigation, or provider command was run during verification.

### Probe Execution

No Phase 13 `probe-*.sh` file or declared probe exists. Step 7c is skipped.

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| DATA-01 | 13-03, 13-06 through 13-08, 13-11, 13-12 | PARTIAL - BLOCKER | Attempt E proves the historical local Gateway chain; the fresh p13-12 path stops at Gateway auth. |
| DATA-02 | 13-01, 13-03, 13-06, 13-08, 13-12 | SATISFIED AS BASELINE/CONTRACT | Local readiness is ordered and previously terminal, but p13-12 does not persist passed readiness receipts before its pre-ingest checkpoint. |
| DATA-03 | 13-01, 13-02, 13-05, 13-06, 13-08, 13-12 | SATISFIED LOCALLY | One deterministic fixture/code/id is proven locally; p13-12 stops before ingest. |
| DATA-04 | 13-02 through 13-12 | PARTIAL - BLOCKER | Local D1/API/admin proof exists; no accepted selected-production tuple exists. |
| DATA-05 | 13-03, 13-04, 13-07 through 13-12 | PARTIAL - BLOCKER | Local Dashboard receipts exist; production Dashboard was not reached. |
| DATA-06 | 13-03, 13-04, 13-07 through 13-12 | PARTIAL - BLOCKER | Local Gateway viewer passed historically; production viewer was not reached. |
| DATA-07 | 13-01 through 13-12 | PARTIAL - BLOCKER | Honest local evidence exists; current terminal production evidence does not. |
| TEST-05 | 13-01 through 13-12 | PARTIAL - BLOCKER | Source/tests and exact machine output are deterministic, but Plan 13-12's canonical pending-handoff wrapper cannot observe inner exit 2 through nested pnpm. |

All eight Phase 13 requirement IDs are claimed by plans; none is orphaned. Checked boxes in REQUIREMENTS.md are stale planning metadata, not runtime proof.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `scripts/data-chain-smoke.ts` | 348-366, 867-876 | Gateway auth exception and invalid-response paths collapse into one checkpoint | WARNING | Current artifact cannot identify the p13-12 root cause; diagnose before fixing. |
| `13-12-PLAN.md` | Task 1 wrapper | Assumes nested pnpm preserves child exit 2 | BLOCKER | A valid future pending tuple would still fail the handoff wrapper. |
| Plan 13-12 artifact paths | Frontmatter | Literal `<p13-12-run-id>` placeholders | WARNING | Automated artifact query cannot resolve generated exact paths; manual exact-run verification is required. |
| Phase 13 source/test files | - | No unreferenced TBD/FIXME/XXX/TODO/HACK/placeholder markers | INFO | No debt-marker blocker. |

### Prohibition Audit

Plans 13-10 through 13-12 mark their prohibitions as judgment-tier, and Plan 13-09 uses malformed string-only declarations. Automated verification cannot silently pass them. Current commits, artifacts, and the execution session support the intended boundaries, but every grouped frontmatter flag remains a non-authoritative LLM judgment requiring human review. Concrete roadmap blockers already determine `gaps_found`.

### Human Verification Required

#### Historical evidence immutability

**Test:** Compare separately retained post-creation manifests for Attempts A-E and Plans 13-09/13-10 against current files.

**Expected:** Every prior hash is unchanged and no failed run was reopened.

**Why human:** Plan 13-12 proves only a 70-file session window, not the earlier creation history.

### Deferred Items

None of the failed truths is deferred. Phase 14 covers source literals, RUNBOOK procedures, and final evidence mapping; it does not execute the missing selected-production chain or repair the Phase 13 handoff wrapper.

### Gaps Summary

Plan 13-11 succeeds as a code-contract repair: both local callers share `pickRuntimeEnvironment`, direct token shadowing remains fail closed, diagnostics are closed and visible, and 77/77 focused tests plus typecheck pass.

Plan 13-12 still does not achieve the roadmap goal. Its sole fresh run ends at the canonical Gateway auth gate before fixture ingest, has no itemId, receives no IAB observation, and authorizes no remote/provider action. The evidence does not distinguish fetch failure from an invalid status/redirect, so a new implementation plan would be speculative until a scoped debug session proves the cause. Independently, the Plan 13-12 wrapper's raw-exit-2 assumption is invalid and must be accounted for in any later handoff plan.

**Canonical next command:** `$gsd-debug "Phase 13: diagnose p13-12 gateway_auth_unavailable at http://localhost:8080/auth/ and the 300-second runner timeout without replaying the immutable run"`

After the debug report identifies a reproducible cause and verified repair boundary, route the concrete findings through `$gsd-plan-phase 13 --gaps`.

---

_Verified: 2026-07-18T21:47:25Z_
_Verifier: the agent (gsd-verifier)_
