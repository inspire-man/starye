---
phase: 13-full-chain-data-smoke
verified: 2026-07-18T19:25:33Z
status: gaps_found
score: 9/13 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/13
  gaps_closed: []
  gaps_remaining:
    - "The standalone local projection/preflight commands pass, but the smoke runner uses a different ambient-environment contract and still cannot produce a fresh terminal local pair."
    - "The selected production target still has no provider-backed D1/API/admin proof for one exact fresh run tuple."
    - "The selected production canonical Dashboard and viewer still have no tuple-bound browser receipts or terminal verifier result."
  regressions: []
gaps:
  - truth: "The currently selected local projection/readiness path can produce a fresh terminal local pair before remote work."
    status: failed
    reason: "Run p13-10-a2917dfa94a74108afd2c6c696dfdbb8 stopped at pre_ingest/local_projection/target_projection_unmet even though the immediately preceding project-local check, target validation, and standalone local preflight all exited 0. Source and a read-only mirror reproduce the discrepancy: target-profile local preflight removes ambient remote credentials, while runDataChainSmoke passes process.env directly; with the current authorized context that produces local-api-token-shadowing, while the sanitized call passes. The persisted artifact collapses the exact issue to target_projection_unmet, so it cannot by itself prove the historical issue code."
    artifacts:
      - path: "scripts/target-profile.ts"
        issue: "runPreflight builds a sanitized local environment through pickRuntimeEnvironment and excludes CLOUDFLARE_API_TOKEN."
      - path: "scripts/data-chain-smoke.ts"
        issue: "runDataChainSmoke passes process.env to local preflight and maps every resolver/projection/preflight failure to the same generic checkpoint."
      - path: "packages/config/src/deployment-target/preflight.ts"
        issue: "Local preflight correctly rejects a non-empty CLOUDFLARE_API_TOKEN as local-api-token-shadowing; the two callers disagree on whether that remote credential is visible."
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-10-a2917dfa94a74108afd2c6c696dfdbb8/local.json"
        issue: "itemId is null and the only observation is local_projection/target_projection_unmet."
    missing:
      - "Use one canonical local-preflight environment builder in both target-profile and the smoke runner so an authorized remote token cannot make the standalone gate green and the runner gate red."
      - "Add a default-dependency runner regression with an ambient CLOUDFLARE_API_TOKEN that proves the CLI and runner agree without weakening the local token-shadowing policy."
      - "Persist or expose the non-secret underlying preflight issue code so target-managed drift and local-api-token-shadowing are distinguishable without reading process state."
      - "After the repair, use a different collision-gated run id to produce a terminal local D1/API/Dashboard/viewer pair through http://localhost:8080."
  - truth: "The selected production target proves the item in provider-backed D1, canonical API, and authorized Dashboard management state."
    status: failed
    reason: "The p13-10 local checkpoint correctly blocked Task 3. No matching remote pair, closed-fixture success, remote_fixture_snapshot receipt, selected-canonical API receipt, or production Dashboard receipt exists."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-10-a2917dfa94a74108afd2c6c696dfdbb8/remote.json"
        issue: "Missing because remote mode was never invoked."
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-7a67b849805e47938e6af160f81cc07a/remote.json"
        issue: "The latest older remote pair remains pre_ingest/checkpoint with itemId null and no provider-backed data receipt."
    missing:
      - "A fresh terminal local prerequisite for the same target/run/code correlation."
      - "A fresh successful official remote live preflight immediately before the bounded mutation."
      - "One successful closed fixture child and count-one remote_fixture_snapshot establishing the remote itemId."
      - "A selected-canonical API receipt and authorized Dashboard receipt matching that remote tuple."
  - truth: "The item is visibly usable through the selected production canonical Dashboard and viewer routes, with captured terminal evidence."
    status: failed
    reason: "No p13-10 remote tuple exists, the persistent-IAB observer was never eligible, and the remote exact verifier reports a missing pair. Attempts D/E prove only local browser routes."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-10-a2917dfa94a74108afd2c6c696dfdbb8/remote.md"
        issue: "Missing; there is no selected-canonical Dashboard or viewer observation for this run."
    missing:
      - "Authorized selected-canonical /dashboard/movies observation for the D1-established remote tuple."
      - "Ordered /movie/<item-code> viewer observation for the same remote itemId."
      - "Both exact local and remote verifiers returning terminal_passed with provesExternalChain true."
behavior_unverified_items:
  - truth: "Attempts A-E and the Plan 13-09/13-10 evidence remain byte-for-byte immutable after creation."
    test: "Compare authoritative manifests captured immediately after each run was first written against the current evidence tree."
    expected: "Every prior-attempt hash equals its original post-creation hash, and each failed run was never reopened."
    why_human: "Plan 13-10 recorded a 68/68 hash-stable execution window, but the evidence is intentionally untracked and no authoritative post-creation baseline exists for the full earlier history."
prohibition_flags:
  - statement: "Plan 13-09 declares five prohibitions as strings without status or verification tier metadata."
    status: unverified
    reason: "The equivalent Plan 13-10 items are structured, but the older declarations still cannot be routed authoritatively; human review recommended."
  - statement: "Attempts A-E, Plan 13-09 evidence, and prior evidence were not modified during Plan 13-10."
    status: unverified
    reason: "NON-AUTHORITATIVE LLM judgment: executor logs report 68/68 baseline hashes stable during the run; historical immutability remains unproven. Human review recommended."
  - statement: "No ad hoc provider/schema/deploy mutation supplemented the official closed commands."
    status: unverified
    reason: "NON-AUTHORITATIVE LLM judgment: the execution log shows only official local gates, one local runner call, reads, and artifact verification. Human review recommended."
  - statement: "No secret, cookie, raw provider context, raw endpoint, or direct application port entered the new evidence."
    status: unverified
    reason: "NON-AUTHORITATIVE LLM judgment: the exact pair contains only allowlisted checkpoint fields and no prohibited value. Human review recommended."
  - statement: "The checkpoint was not represented as success, zero provider side effects, or historical-immutability proof."
    status: unverified
    reason: "NON-AUTHORITATIVE LLM judgment: Summary and evidence accurately retain non-success scope. Human review recommended."
  - statement: "No schema/migration was changed and no schema push was run."
    status: unverified
    reason: "NON-AUTHORITATIVE LLM judgment: Plan 13-10 commits contain planning trackers/Summary only and the executor log has no schema command. Human review recommended."
---

# Phase 13: Full Chain Data Smoke Verification Report

**Phase Goal:** Prove the selected target is actually usable by running the local and production data chain through Gateway/canonical domain.
**Verified:** 2026-07-18T19:25:33Z
**Status:** gaps_found
**Re-verification:** Yes - after Plan 13-10 gap-closure execution

All ten plans have summaries and ROADMAP execution bookkeeping. That proves plan execution, not the selected-production outcome. Plan 13-10 reproduces the local blocker and adds enough source/runtime evidence to isolate the caller-contract mismatch, but it creates no production proof.

No verification override exists or was applied.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Local smoke proves API, auth/dashboard, and content through `http://localhost:8080` only. | VERIFIED | Attempt E local independently re-verifies as `terminal_passed`, `provesExternalChain: true`; its browser origins are the local Gateway. |
| 2 | Local D1 schema/readiness and minimal deterministic data are verified before production work. | VERIFIED | Attempt E retains passed `local_d1_readiness` before count-one D1/API/browser receipts. |
| 3 | A targeted one-item fixture writes a known item through the service-auth API and records identity. | VERIFIED | The fixture remains one non-R18 movie/one player and one `syncMovie()` call; Attempt E records a D1-owned UUID. |
| 4 | Local and selected-production D1/API/admin checks prove the item exists and is manageable after ingest. | FAILED | Local proof exists; no selected-production D1/API/admin receipt exists. |
| 5 | Local and production canonical viewers visibly show the item, with evidence captured. | FAILED | Local receipts exist for Attempts D/E; no production Dashboard/viewer tuple or terminal remote evidence exists. |
| 6 | The current selected local projection/readiness path can produce a fresh terminal local pair before remote work. | FAILED | Standalone gates pass, but p13-10 checkpoints immediately. The CLI sanitizes remote credentials; the runner passes ambient `process.env`, reproducing `local-api-token-shadowing`. |
| 7 | Evidence enforces lifecycle, tuple, parity, redaction, canonical paths, receipts, and browser order. | VERIFIED | The p13-10 pair is a valid honest checkpoint; exact verification does not promote it. |
| 8 | The only smoke write is one deterministic non-R18 fixture through one `syncMovie()` call and one count-one D1 snapshot. | VERIFIED | `DATA_CHAIN_FIXTURE_COUNT = 1`; fixture, prepared result, snapshot, and runner checks remain wired. |
| 9 | Remote work is exact-local-prerequisite, explicit-target, official-preflight-first, registry-owned, and fail-closed. | VERIFIED | The failed fresh local pair prevented remote preflight/mutation/browser work, as required. This proves ordering, not provider usability. |
| 10 | Failures persist honest non-success evidence and never synthesize success. | VERIFIED | p13-10 is `pre_ingest/checkpoint`, `itemId: null`; exact verifier returns `provesExternalChain: false`. |
| 11 | Local/remote correlation shares target/run/code while each environment's D1 owns its internally consistent itemId. | VERIFIED AS CONTRACT | Source/tests enforce per-mode IDs; no remote execution is claimed. |
| 12 | Prior attempts and new evidence remain immutable and untracked. | PRESENT_BEHAVIOR_UNVERIFIED | Plan 13-10 proves only a time-bounded 68/68 stable baseline; no authoritative historical creation baseline exists. |
| 13 | Phase 14 literal cleanup, RUNBOOK stabilization, and final evidence mapping remain deferred. | VERIFIED | Plan 13-10 changed execution evidence/planning metadata only; Phase 14 does not replace the missing provider chain. |

**Score:** 9/13 truths verified (1 present-but-behavior-unverified, 3 failed)

### Plan 13-10 Execution Facts

| Fact | Status | Independent evidence |
|---|---|---|
| Official projection check | VERIFIED | Executor session lines 789-790: exact command, exit 0, `Target-managed projection check passed`. |
| Target validation and standalone local preflight | VERIFIED | Session lines 793-798: both exact commands exit 0; preflight says `Target preflight passed`. |
| Focused projection/preflight tests | VERIFIED | Session lines 801-802 and verifier rerun: 3 files, 31/31 tests passed. |
| Fresh run collision gate | VERIFIED | Session lines 842-843 and 902-903: exact run id, `EXISTS=False` before the only local invocation. |
| Local runner outcome | VERIFIED AS CHECKPOINT / FAILED AS PROOF | Session lines 906-911 and exact pair: `pre_ingest/checkpoint`, `itemId: null`, only `local_projection/target_projection_unmet`. |
| Exact local verifier | VERIFIED AS NON-SUCCESS | Independent rerun returns `outcome: checkpoint`, `provesExternalChain: false`. |
| Remote pair/verifier | VERIFIED ABSENT / FAILED AS PROOF | `remote.json` and `.md` are absent; exact remote verifier reports `Data-chain evidence pair is missing.` |
| Browser and provider work | VERIFIED NOT REACHED | No pending local tuple existed; no IAB receipt, remote runner, provider D1, API, Dashboard, or viewer receipt exists. |
| Caller discrepancy | REPRODUCED | Projection issues are empty. Ambient-token local preflight returns only `local-api-token-shadowing`; the sanitized local environment passes. |

The exact executor artifact records only the generic checkpoint category, so retrospective issue-code attribution is not self-contained in the evidence. The implementation mismatch itself is observable and reproducible in current code.

### Required Artifacts

The GSD artifact query returns `0/0` for Plans 13-01 through 13-09 because their frontmatter uses strings. Plan 13-10 returns `1/5` because its four evidence paths contain the literal `<p13-10-run-id>` placeholder. Manual exact-run verification follows.

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/config/src/deployment-target/data-chain-evidence.ts` | Tuple/lifecycle/provenance/redaction contract | VERIFIED | Exists (934 lines), substantive, exported, and consumed by runner/observer/verifier. |
| `packages/crawler/src/smoke/data-chain-fixture.ts` | One deterministic service-auth upsert | VERIFIED | Exists (105 lines); the sole `syncMovie()` call remains at line 98. |
| `packages/config/src/deployment-target/mutation-entry.ts` | Closed prepared fixture/D1 operations | VERIFIED | Exists (490 lines); strict count-one prepared results remain wired. |
| `packages/db/scripts/target-d1-mutation.ts` | Read-only one-row D1 snapshot | VERIFIED | Exists (348 lines); fixed code/cardinality parser remains wired. |
| `scripts/data-chain-smoke.ts` | Local and remote orchestration | PARTIAL / BLOCKER | Substantive and wired, but local default preflight uses ambient `process.env`, unlike the standalone CLI. |
| `scripts/data-chain-surface-observation.ts` | Repository-owned Dashboard/viewer observation | VERIFIED IN CODE / NOT REACHED | Exists (428 lines); no p13-10 browser call or receipt exists. |
| `scripts/verify-data-chain-smoke.ts` | Artifact-only exact verifier | VERIFIED | Exists (141 lines); independently classifies terminal, checkpoint, and missing-pair states. |
| Attempt E local pair | Accepted terminal local proof | VERIFIED | Independent exact verifier returns terminal proof. |
| p13-10 local pair | Fresh exact local evidence | VALID CHECKPOINT / FAILED AS PROOF | JSON/Markdown peers contain only the generic local projection checkpoint. |
| p13-10 remote pair | Provider/D1/API/browser proof | MISSING | Correctly not created after local failure, but required for the Phase goal. |
| `13-10-SUMMARY.md` | Accurate closeout | VERIFIED | Correctly distinguishes standalone green gates from runner checkpoint and leaves Phase 13 open. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Official local checks | Fresh run allocation | All gates exit 0 before run id | PROVEN | Recorded command order and collision checks satisfy the plan. |
| Standalone local preflight | Smoke runner local preflight | Shared projection/environment semantics | BROKEN | CLI strips remote token; runner passes ambient environment and fails token-shadowing. |
| Local projection/preflight | D1/fixture/API | Ordered local readiness gates | BROKEN AT RUNTIME | p13-10 stops before D1, fixture, API, or browser work. |
| Terminal fresh local pair | Remote runner | Exact target/run/code eligibility | NOT REACHED | No terminal fresh local pair exists. |
| Remote fixture/D1 tuple | Canonical API/Dashboard/viewer | Closed child then persistent IAB | NOT REACHED | No remote pair or itemId exists. |
| Exact evidence pair | Artifact verifier | Schema/parity/receipt/lifecycle checks | PARTIAL | Local is correctly checkpointed; remote pair is missing. |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| Attempt E local | `itemId` and eight observations | Local fixture, D1 snapshot, Gateway API, authorized browser receipts | Yes | FLOWING |
| Attempt E remote | remote `itemId` | Provider fixture/D1 after remote preflight | No; checkpoint has null id | DISCONNECTED BY CHECKPOINT |
| p13-10 local | fresh `itemId` | Local preflight then D1/fixture | No; ambient-environment preflight fails first | DISCONNECTED BY CHECKPOINT |
| p13-10 remote | remote tuple | Terminal p13-10 local pair then provider D1 | No pair/source exists | NOT REACHED |

### Behavioral Spot-Checks

| Behavior | Command/result | Status |
|---|---|---|
| p13-10 exact local artifact | Exact verifier returns checkpoint and `provesExternalChain: false` | PASS AS HONEST CHECKPOINT / GOAL FAIL |
| p13-10 exact remote artifact | Exact verifier reports missing pair | FAIL / REQUIRED PROOF MISSING |
| Attempt E local regression | Exact verifier returns `terminal_passed`, `provesExternalChain: true` | PASS |
| Projection/preflight regression suite | 3 files, 31/31 tests | PASS |
| Default local environment contract | Empty projection issues + ambient remote token => `local-api-token-shadowing`; sanitized environment => pass | REPRODUCED BLOCKER |

No local or remote smoke was rerun during verification.

### Probe Execution

No Phase 13 `probe-*.sh` file or declared probe exists. Step 7c is skipped.

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| DATA-01 | 13-03, 13-06, 13-07, 13-08 | SATISFIED WITH CURRENT REGRESSION | Attempt E proves the local Gateway chain; the default runner currently diverges under an authorized remote-token context. |
| DATA-02 | 13-01, 13-03, 13-06, 13-08 | SATISFIED | Attempt E contains ordered local schema/readiness and count-one D1 receipts. |
| DATA-03 | 13-01, 13-02, 13-05, 13-06, 13-08 | SATISFIED | One deterministic fixture/code/id is proven locally. |
| DATA-04 | 13-02 through 13-10 | PARTIAL - BLOCKER | Local D1/API/admin proof exists; selected-production correlation is absent. |
| DATA-05 | 13-03, 13-04, 13-07 through 13-10 | PARTIAL - BLOCKER | Local Dashboard receipts exist; production Dashboard was never reached. |
| DATA-06 | 13-03, 13-04, 13-07 through 13-10 | PARTIAL - BLOCKER | Local Gateway viewer passed; production viewer was never reached. |
| DATA-07 | 13-01 through 13-10 except 13-06 | PARTIAL - BLOCKER | Local terminal evidence and honest checkpoints exist; terminal production evidence does not. |
| TEST-05 | 13-01 through 13-10 | SATISFIED AT TOOLING LEVEL | Exact verifier deterministically distinguishes terminal, checkpoint, and missing pair; required production output is absent. |

All eight Phase 13 requirement IDs are claimed by at least one plan; none is orphaned. Checked boxes in REQUIREMENTS.md are planning metadata, not runtime proof.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `scripts/data-chain-smoke.ts` | 831 | Local runner passes ambient `process.env` | BLOCKER | Authorized remote credentials make runner semantics differ from the green standalone local preflight. |
| `scripts/data-chain-smoke.ts` | 821 | Resolver/projection/preflight failures collapse into one checkpoint | WARNING | The exact artifact cannot distinguish drift from token shadowing without external diagnosis. |
| Phase source and p13-10 artifact set | - | No unreferenced `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or placeholder implementation | INFO | No debt-marker blocker. |
| Plan 13-10 frontmatter | - | Literal run-id placeholders and non-path key-link sources | WARNING | Automated artifact/key-link queries cannot validate exact generated files; manual verification is required. |

### Prohibition Audit

Plan 13-10 marks all five prohibitions as judgment-tier. Automated verification therefore cannot silently pass them. The non-authoritative judgments are: prior evidence was stable during the recorded Plan 13-10 baseline; only official commands were observed; the new pair is allowlisted and secret-free; the checkpoint is accurately described; and no schema/migration command or file appears. Each remains flagged for human review. Plan 13-09's older string-only prohibition block remains malformed for tier routing.

### Human Verification Required

#### Historical evidence immutability

**Test:** Compare separately retained post-creation hash manifests for Attempts A-E and Plans 13-09/13-10 against the current files.

**Expected:** Every prior hash is unchanged and no failed run was reopened.

**Why human:** The files are intentionally untracked. Plan 13-10's session baseline proves only its own execution window, not the full prior history.

Judgment-tier prohibitions listed in frontmatter also remain human-review flags. They do not change the overall status because concrete blockers already require `gaps_found`.

### Deferred Items

None of the failed truths is deferred. Phase 14 covers literal cleanup, RUNBOOK hardening, and final evidence mapping; it does not execute or replace the missing selected-production data/browser chain.

### Gaps Summary

Plan 13-10 confirms that projection files and standalone local preflight are green, then reproduces a runner-only failure before D1. Current source and a read-only mirror isolate a real caller-contract mismatch: the CLI removes ambient remote credentials for local validation, while the runner exposes them and triggers the fail-closed token-shadowing policy. The generic checkpoint does not retain that issue code, so the repair must both unify the environment boundary and make future failures diagnosable.

Until a new run reaches terminal local proof, the selected-target remote fixture, D1 snapshot, canonical API, authorized Dashboard, viewer, and remote terminal verifier remain absent. These are Phase 13 blockers and cannot be deferred to Phase 14.

**Next action:** Plan one focused gap closure for the shared local-preflight environment contract and diagnostic issue code, followed by one new immutable local-to-production proof run.

**Canonical next command:** `$gsd-plan-phase 13 --gaps`

---

_Verified: 2026-07-18T19:25:33Z_
_Verifier: the agent (gsd-verifier)_
