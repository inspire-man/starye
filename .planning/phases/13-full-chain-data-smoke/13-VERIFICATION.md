---
phase: 13-full-chain-data-smoke
verified: 2026-07-18T10:23:11Z
status: gaps_found
score: 9/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/11
  gaps_closed: []
  gaps_remaining:
    - "The selected production target still has no provider-backed D1/API/admin proof for the exact Attempt E tuple."
    - "The selected production canonical Dashboard and viewer still have no tuple-bound browser receipts."
  regressions: []
gaps:
  - truth: "The selected production target proves the same item in provider-backed D1, canonical API, and authorized Dashboard management state."
    status: failed
    reason: "Attempt E remote is pre_ingest/checkpoint at remote_preflight/target_preflight_unmet. Its exact verifier returns checkpoint with provesExternalChain false, and the pair contains no provider, D1, API, or Dashboard success receipt."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-7a67b849805e47938e6af160f81cc07a/remote.json"
        issue: "itemId is null and the sole observation is remote_preflight/target_preflight_unmet."
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-7a67b849805e47938e6af160f81cc07a/remote.md"
        issue: "Deterministically matches the checkpoint JSON; it documents non-success, not production usability."
    missing:
      - "A passing authorized selected-target preflight/ownership result for this exact local run."
      - "One bounded remote fixture receipt and matching count-one D1 snapshot code/id receipt."
      - "A selected-canonical API receipt and authorized Dashboard receipt for the same remote tuple."
  - truth: "The item is visibly usable through the selected production canonical Dashboard and viewer routes, with captured evidence."
    status: failed
    reason: "Attempt E never resolved a remote item tuple, so no selected-production Dashboard or viewer observation exists. The accepted Codex IAB adapter defines an observation mechanism but grants no provider, mutation, or production-success override."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-7a67b849805e47938e6af160f81cc07a/remote.json"
        issue: "No browser_observer/browser_navigation receipt and no selected-canonical production path are present."
      - path: ".planning/phases/13-full-chain-data-smoke/13-08-PLAN.md"
        issue: "The accepted execution override explicitly grants no provider credential, remote mutation, or authorization bypass."
    missing:
      - "Authorized selected-canonical /dashboard/movies observation for a resolved remote tuple."
      - "Ordered /movie/<item-code> viewer observation and terminal remote resolved/passed evidence."
---

# Phase 13: Full Chain Data Smoke Verification Report

**Phase Goal:** Prove the selected target is actually usable by running the local and production data chain through Gateway/canonical domain.
**Verified:** 2026-07-18T10:23:11Z
**Status:** gaps_found
**Re-verification:** Yes - latest Attempt E evidence

All eight plans have matching summaries on disk. That proves plan execution bookkeeping is complete; it does not prove the phase goal. Attempt E repeats the local success but leaves the production half at a preflight checkpoint.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Local smoke proves API, auth/dashboard, and content through `http://localhost:8080` only. | VERIFIED | Attempt E local is `resolved/passed` with eight tuple-bound receipts. Gateway auth, API, Dashboard, and viewer use only `http://localhost:8080`; the exact verifier returns `terminal_passed` and `provesExternalChain: true`. |
| 2 | Local D1 schema/readiness and minimal deterministic data are verified before production work. | VERIFIED | Attempt E records passed `local_d1_readiness` before D1/API/browser rows and a count-one `local_fixture_snapshot` receipt. |
| 3 | A targeted one-item fixture writes a known item through the service-auth API and records its identity. | VERIFIED | The implementation fixes `DATA_CHAIN_FIXTURE_COUNT = 1`, validates one non-R18 movie with one player, and calls `syncMovie()` once. Attempt E records code `p13-smoke-starye-org-e3851bf2` and UUID `7725fb74-0219-4e21-ad8c-2cc5c1b7cba0`. |
| 4 | Local and selected-production D1/API/admin checks prove the item exists and is manageable after ingest. | FAILED | Local proof exists. Attempt E remote stops at `target_preflight_unmet` with `itemId: null` and no provider/D1/API/admin receipt. |
| 5 | Local and production canonical viewers visibly show the recorded item, with evidence captured. | FAILED | Attempt E local has ordered Dashboard/viewer receipts. Its remote pair has no resolved tuple, canonical path, Dashboard receipt, or viewer receipt. |
| 6 | The selected local projection gate passes without exposing user-managed values. | VERIFIED | Attempt E includes a passed `local_projection` receipt, and its evidence contains no environment or secret values. |
| 7 | Evidence enforces strict lifecycle, tuple, redaction, canonical path, receipt, and browser-order contracts. | VERIFIED | `data-chain-evidence.ts` remains substantive (934 lines), exported, and consumed by runner, observer, and verifier. No phase source change has regressed the previously verified contract. |
| 8 | The only smoke write is exactly one deterministic non-R18 fixture through one `syncMovie()` call. | VERIFIED | `DATA_CHAIN_FIXTURE_COUNT` is one; fixture and D1 code still enforce one code, one payload, one active player, and one snapshot row. |
| 9 | Remote mutation is explicit-target, exact-local-prerequisite, preflight-first, registry-owned, and starts no child after a failed gate. | VERIFIED | Source wiring still performs exact-local validation and live preflight before the two closed entries. The recorded Attempt E artifact proves only that no production-chain success receipt was produced; it is not, by itself, an audit proof of zero remote side effects. |
| 10 | Failures persist honest pre-ingest or tuple-preserving pending evidence and never synthesize success. | VERIFIED | Attempt E remote is the expected `pre_ingest/checkpoint` shape with `itemId: null`; its exact verifier returns `provesExternalChain: false`. |
| 11 | Remote mode preserves the exact local target/run/code and selected-canonical API/browser path contract. | VERIFIED | The remote artifact preserves Attempt E target/run/code, while source wiring derives only fixed API and Dashboard-before-viewer paths. This verifies the contract, not production execution. |

**Score:** 9/11 truths verified (0 present-but-behavior-unverified)

The two failures share one root cause: the selected-target external preflight did not pass. They remain separate because provider/D1/API/admin correlation and canonical browser usability are distinct goal outcomes.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/config/src/deployment-target/data-chain-evidence.ts` | One-item identity, lifecycle, provenance, redaction, and canonical-path contract | VERIFIED | Exists (934 lines), exported from the deployment-target barrel, and used by all smoke tools. |
| `packages/crawler/src/smoke/data-chain-fixture.ts` | One deterministic service-auth upsert | VERIFIED | One validated movie, one player, one `syncMovie()` call, count one. |
| `packages/config/src/deployment-target/mutation-entry.ts` | Closed prepared fixture/D1 operations | VERIFIED | Only fixed smoke fixture and D1 snapshot entries accept the count-one prepared result. |
| `packages/db/scripts/target-d1-mutation.ts` | Read-only one-row D1 snapshot | VERIFIED | Fixed prepared code query with strict non-R18 movie/active-player cardinality checks. |
| `scripts/data-chain-smoke.ts` | Local and remote orchestration | VERIFIED | Attempt E proves the local branch; the remote branch persists the honest preflight checkpoint. |
| `scripts/data-chain-surface-observation.ts` | Controlled Dashboard/viewer observation | VERIFIED | Core derives tuple and order; callers cannot supply a passed status. |
| `scripts/verify-data-chain-smoke.ts` | Artifact-only exact verifier | VERIFIED | Reads existing JSON/Markdown without rerunning the smoke and distinguishes terminal proof from checkpoint. |
| Attempt E local pair | Auditable local full-chain proof | VERIFIED | `local.json` and `local.md` are deterministic peers; exact verifier exits 0 with terminal proof. |
| Attempt E remote pair | Auditable selected-production full-chain proof | FAILED AS PROOF / VERIFIED AS CHECKPOINT | Deterministic peers, but only `remote_preflight/target_preflight_unmet`; no production-chain success receipt. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Target/run | One fixture | candidate -> fixture -> `syncMovie()` | WIRED | Deterministic code and count one. |
| Local readiness | Local D1/API | projection -> D1 -> service/auth -> fixture/snapshot -> Gateway API | WIRED AND PROVEN | Attempt E receipts preserve the exact tuple and sequence. |
| Local pending tuple | Dashboard/viewer | repository observer -> live adapter -> repository receipts | WIRED AND PROVEN | Attempt E has Dashboard then viewer receipts under the local Gateway. |
| Terminal local pair | Remote preflight | exact pair load -> explicit target/credential/live ownership gate | WIRED AND PROVEN FAIL-CLOSED | Attempt E reaches this link and persists `target_preflight_unmet`. |
| Remote preflight | Provider fixture/D1/API | closed prepared entries -> snapshot -> canonical API | WIRED, NOT PROVEN IN PRODUCTION | No Attempt E provider, D1, or API receipt exists. |
| Remote pending tuple | Canonical Dashboard/viewer | controlled observer | NOT REACHED | No remote item id or pending tuple exists. |
| Evidence pair | Exact verifier | schema + deterministic Markdown + tuple/outcome | WIRED | Local returns terminal proof; remote returns checkpoint/non-proof. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Attempt E local runner | `snapshotResult.itemId` | Local fixture plus read-only D1 snapshot | Yes: UUID `7725fb74-0219-4e21-ad8c-2cc5c1b7cba0` | FLOWING |
| Attempt E local API | code/id response | Gateway `/api/public/movies/p13-smoke-starye-org-e3851bf2` | Yes: exact tuple | FLOWING |
| Attempt E local Dashboard/viewer | code/id DOM tuple | Accepted live Codex IAB adapter with repository-owned receipt writing | Yes: ordered receipt-backed observations | FLOWING |
| Attempt E remote runner | remote item id | Provider fixture/D1 after preflight | No: `itemId` is null | DISCONNECTED BY CHECKPOINT |
| Attempt E remote Dashboard/viewer | remote pending tuple | Selected canonical browser session | No tuple/source exists | NOT REACHED |

### Attempt E Evidence

The exact evidence paths are:

- `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-7a67b849805e47938e6af160f81cc07a/local.json`
- `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-7a67b849805e47938e6af160f81cc07a/local.md`
- `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-7a67b849805e47938e6af160f81cc07a/remote.json`
- `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-7a67b849805e47938e6af160f81cc07a/remote.md`

The original local session record at `C:/Users/11407/.codex/sessions/2026/07/18/rollout-2026-07-18T10-23-28-019f7309-16cd-72b1-83c1-4c52906f1eb9.jsonl:3945` records the official read-only command:

`pnpm target-profile preflight --target starye-org --scope remote --command smoke --ci-environment starye-org --live`

It reports exactly two failed live checks: R2 `starye-media` and gateway-worker `starye-gateway`. This sharpens the external blocker but does not upgrade the generic remote checkpoint into production proof.

Evidence boundary: the Attempt E remote pair proves that it contains no production-chain success receipt and that the exact verifier does not accept it as external-chain proof. It does not contain provider activity logs or a side-effect ledger, so it must not be described as independently proving zero remote mutation.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Exact Attempt E local artifact | `pnpm smoke:data-chain:verify -- --mode local --target starye-org --run-id p13-08-7a67b849805e47938e6af160f81cc07a --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence` | Exit 0; `resolved/passed`, `terminal_passed`, `provesExternalChain: true` | PASS |
| Exact Attempt E remote artifact | Same command with `--mode remote` | Internal exit 2 (pnpm outer exit 1); `pre_ingest/checkpoint`, `provesExternalChain: false` | PASS AS HONEST CHECKPOINT / GOAL NOT MET |
| Official live selected-target preflight | Historical primary tool output cited above | Only R2 `starye-media` and gateway-worker `starye-gateway` read checks failed | BLOCKED |

No full suite was rerun in this re-verification. Previously passed code truths received the required quick regression sanity check; the new evidence-dependent truths were checked through the exact artifact verifier.

### Probe Execution

No Phase 13 `probe-*.sh` is declared or present. Step 7c is skipped.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| DATA-01 | 13-03, 13-06, 13-07, 13-08 | SATISFIED | Attempt E proves API, auth, Dashboard, and viewer only through `http://localhost:8080`. |
| DATA-02 | 13-01, 13-03, 13-06, 13-08 | SATISFIED | Attempt E local D1 readiness precedes the fixture and production attempt. |
| DATA-03 | 13-01, 13-02, 13-05, 13-06, 13-08 | SATISFIED | One deterministic local fixture records the exact Attempt E code/UUID. |
| DATA-04 | 13-02 through 13-08 | PARTIAL - BLOCKER | Local D1/API/admin correlation passed; selected-production D1/API/admin correlation is absent. |
| DATA-05 | 13-03, 13-04, 13-07, 13-08 | PARTIAL - BLOCKER | Local Dashboard passed; selected-production Dashboard was never reached. |
| DATA-06 | 13-03, 13-04, 13-07, 13-08 | PARTIAL - BLOCKER | Local Gateway viewer passed; selected-production canonical viewer was never reached. |
| DATA-07 | 13-01 through 13-08 | PARTIAL - BLOCKER | Local proof and an honest remote checkpoint exist, but production smoke proof does not. |
| TEST-05 | 13-01 through 13-08 | SATISFIED | Exact verifier deterministically distinguishes Attempt E terminal local proof from remote checkpoint output. |

All eight Phase 13 requirement IDs appear in plan frontmatter; none is orphaned. The checked boxes in `REQUIREMENTS.md` are planning metadata and do not override missing runtime proof.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| Phase implementation files | - | No unreferenced `TBD`, `FIXME`, or `XXX` marker | INFO | No debt-marker blocker. |
| `packages/config/src/deployment-target/mutation-entry.ts` | 481 | `return {}` | INFO | Existing result for non-smoke prepared entries; not a smoke-path stub. |

### Human Verification Required

None for this verdict. Local browser proof is already represented by tuple-bound receipts. Production evidence is observably absent, so the result is FAILED rather than uncertain visual behavior.

### Deferred Items

None. Phase 14 covers literal cleanup, RUNBOOK procedures, and final evidence mapping. It does not perform or replace the missing selected-target provider/data/browser chain.

### Gaps Summary

Attempt E confirms that the local Phase 13 chain remains usable: one item flows through local D1, Gateway API, authorized Dashboard, and Gateway viewer with matching receipts. It closes no previous production gap.

The phase goal still fails at the selected target. Remote evidence stops at `target_preflight_unmet`; the official read-only preflight identifies R2 and gateway-worker access as the current blocker, but no provider-backed fixture, remote D1 row, canonical API result, Dashboard management receipt, or viewer receipt exists. The checkpoint is valid fail-closed evidence, not proof that the production target is usable. Phase 13 must remain pending.

---

_Verified: 2026-07-18T10:23:11Z_
_Verifier: the agent (gsd-verifier)_
