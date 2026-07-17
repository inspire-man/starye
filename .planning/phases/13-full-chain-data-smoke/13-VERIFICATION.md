---
phase: 13-full-chain-data-smoke
verified: 2026-07-17T10:09:45Z
status: gaps_found
score: 5/11 must-haves verified
behavior_unverified: 5
overrides_applied: 0
gaps:
  - truth: "D-01/D-02: the only write path creates or upserts exactly one deterministic, non-R18 fixture through ApiClient.syncMovie()."
    status: failed
    reason: "The Phase 13 canonical plan still requires one payload and one syncMovie call, but the live implementation now derives and writes exactly ten fixtures. A later quick plan explains the change, but no accepted verification override updates the Phase 13 must-have."
    artifacts:
      - path: "packages/config/src/deployment-target/data-chain-evidence.ts"
        issue: "DATA_CHAIN_FIXTURE_COUNT is 10 and createDataChainFixtureCodes derives nine sibling codes."
      - path: "packages/crawler/src/smoke/data-chain-fixture.ts"
        issue: "createDataChainFixtureBatch builds ten payloads and runDataChainFixture calls syncMovie once per payload."
      - path: ".planning/phases/13-full-chain-data-smoke/13-02-PLAN.md"
        issue: "The canonical must-have and acceptance criteria still require exactly one payload/call."
    missing:
      - "Restore the one-item contract, or add an explicit accepted override/update to the canonical Phase 13 contract for the ten-item batch."
  - truth: "The selected target is proven usable by a completed local and production data chain through Gateway/canonical domain."
    status: partial
    reason: "The tracked Phase 13 evidence and 13-03/13-04 summaries stop at checkpoint with no itemId. Later ignored local/remote files claim resolved/passed and pass schema validation, but there is no independent runner output, provider result, or browser/session provenance. The observer accepts an operator-supplied --status passed and the validator checks only JSON/Markdown shape and tuple consistency, so those files do not independently prove the real external chain."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/13-03-SUMMARY.md"
        issue: "status: checkpoint; the recorded real local run stopped before ingest."
      - path: ".planning/phases/13-full-chain-data-smoke/13-04-SUMMARY.md"
        issue: "status: checkpoint; records that provider/D1/API/Dashboard/viewer work was not attempted."
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/"
        issue: "All tracked JSON records are pre_ingest/checkpoint; later passed records are ignored local artifacts with schema validity but no execution provenance."
      - path: "scripts/data-chain-surface-observation.ts"
        issue: "Dashboard/viewer pass rows are appended from CLI claims without a browser or provider observation binding."
    missing:
      - "A newly authorized, auditable local run proving D1, Gateway API, Dashboard, and viewer for one tuple."
      - "A provider-backed remote run proving selected-target ownership, fixture, D1, canonical API, Dashboard, and viewer for the exact local run."
      - "Human confirmation or independently captured browser/provider evidence for both terminal passed artifacts."
behavior_unverified_items:
  - truth: "Local smoke reaches API, auth/dashboard, and content only through http://localhost:8080."
    test: "Run the canonical local smoke with the stack available, then inspect the same tuple through Gateway auth, Dashboard Movies, and /movie/<code>."
    expected: "One terminal local resolved/passed record contains passed local_projection, local_d1_readiness, service_readiness, gateway_auth, d1, api, dashboard, and viewer rows, all for the same non-empty tuple."
    why_human: "Injected tests prove ordering and URL guards, while current ignored evidence has no browser/session provenance."
  - truth: "Local D1 schema and minimal deterministic data are verified before production work."
    test: "Execute the canonical local runner and retain the read-only D1 command result associated with the run."
    expected: "Required movie/player schema is ready and the exact deterministic fixture set resolves the primary non-empty itemId before remote work."
    why_human: "The focused test replaces D1 with an injected dependency; schema-valid evidence alone cannot prove a real local D1 transition."
  - truth: "The targeted fixture actually writes the selected run's known item through the service-auth API."
    test: "Run the local fixture path with the authorized existing service secret and correlate the API acknowledgement with the read-only D1 snapshot."
    expected: "The deterministic primary code resolves to a real itemId, with no arbitrary corpus or direct-port path."
    why_human: "Tests use fake ApiClient acknowledgements and do not exercise the live write."
  - truth: "The item is proven in selected-target D1, canonical API, and authorized Dashboard management state."
    test: "For the exact local run, execute the remote smoke after ownership preflight and locate its remote tuple in D1, canonical API, and Dashboard Movies."
    expected: "All three surfaces correlate the same target/run/code/id and the remote artifact preserves provider-backed observations."
    why_human: "External Cloudflare integration and the authorized Dashboard session cannot be established from the current JSON schema."
  - truth: "The item is visibly usable through local and production canonical viewer routes."
    test: "Open the local Gateway and selected production canonical /movie/<code> routes for their respective recorded tuples."
    expected: "Both routes visibly render the intended item and match the exact evidence tuple without direct application origins."
    why_human: "Visual rendering and real browser navigation are not exercised by the automated contract tests."
---

# Phase 13: Full Chain Data Smoke Verification Report

**Phase Goal:** Prove the selected target is actually usable by running the local and production data chain through Gateway/canonical domain.
**Verified:** 2026-07-17T10:09:45Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Local smoke proves API, auth/dashboard, and content through `http://localhost:8080` only. | PRESENT_BEHAVIOR_UNVERIFIED | Default code uses the Gateway at `scripts/data-chain-smoke.ts:288-321,407-415`; focused tests pass, but tracked evidence is checkpoint-only and ignored passed artifacts have no browser provenance. |
| 2 | Local D1 schema and minimal data setup are actually verified before production. | PRESENT_BEHAVIOR_UNVERIFIED | Real default D1 inspection exists at `scripts/data-chain-smoke.ts:210-264`; focused tests inject the result, and no auditable command output is tied to a terminal tracked run. |
| 3 | A targeted fixture writes a known item to the selected API target and records its identity. | PRESENT_BEHAVIOR_UNVERIFIED | The live path calls `ApiClient.syncMovie()` at `packages/crawler/src/smoke/data-chain-fixture.ts:128-141`; tests use fake acknowledgements and ignored artifacts do not establish execution provenance. |
| 4 | D1, canonical API, and admin checks prove the item exists and is manageable after ingest. | PRESENT_BEHAVIOR_UNVERIFIED | Local/remote code correlates snapshot and API tuples, but the Dashboard row is an operator-supplied append rather than a browser-bound observation. |
| 5 | Local and production canonical viewers visibly show the same recorded item, with evidence captured. | PRESENT_BEHAVIOR_UNVERIFIED | Two ignored local/remote pairs are schema-valid and marked passed; `appendBrowserObservation` can create those rows from CLI status alone (`data-chain-evidence.ts:539-627`). |
| 6 | The selected local projection gate passes without exposing user-managed values. | VERIFIED | `pnpm target-profile project-local --target starye-org --check` and `target-profile validate` both passed; secret inspection printed presence booleans only. |
| 7 | Evidence has a strict lifecycle, non-secret allowlist, tuple checks, canonical URL policy, and ordered browser grammar. | VERIFIED | `data-chain-evidence.ts` is 697 substantive lines, exported by the deployment-target barrel, and the focused config suite passed 32/32. |
| 8 | The only smoke write is exactly one deterministic non-R18 fixture through one `syncMovie()` call. | FAILED | `DATA_CHAIN_FIXTURE_COUNT = 10`; the batch loop invokes `syncMovie()` ten times, contradicting `13-02-PLAN.md:24,127-138`. No override exists. |
| 9 | Remote mutation is explicit-target, preflight-first, registry-owned, and starts no child after a failed gate. | VERIFIED | `runRemoteDataChainSmoke` gates exact local evidence and provider preflight before prepared children (`data-chain-smoke.ts:633-703`); remote contract tests passed. |
| 10 | Local failures persist honest pre-ingest/pending evidence and preserve the tuple after snapshot. | VERIFIED | Local orchestration at `data-chain-smoke.ts:734-852` plus lifecycle tests exercise projection, D1, service, auth, fixture, snapshot, and API failure paths. |
| 11 | Remote mode uses only the exact terminal local pair and selected canonical API path, preserving checkpoints. | VERIFIED | Exact pair validation is wired at `data-chain-smoke.ts:472-530`; remote canonical fetch and pending evidence are wired at `605-731`; tests pass. |

**Score:** 5/11 truths verified (5 present, behavior-unverified; 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/config/src/deployment-target/data-chain-evidence.ts` | Typed lifecycle, tuple, redaction, canonical-path contract | VERIFIED | Exists, substantive, exported, used by runner/observer/verifier, and covered by focused tests. |
| `packages/crawler/src/smoke/data-chain-fixture.ts` | Bounded deterministic service-auth fixture | VERIFIED WITH CONTRACT DRIFT | Substantive and wired, but now writes ten fixtures rather than the Phase 13 plan's one. |
| `packages/config/src/deployment-target/mutation-entry.ts` | Closed prepared fixture/D1 registry | VERIFIED | Registry owns `crawler-smoke-fixture` and `d1-smoke-snapshot`; required-secret forwarding and child output parsing are allowlisted. |
| `packages/crawler/scripts/target-crawl-mutation.ts` | Prepared crawler child | VERIFIED | Requires registry-owned context and `CRAWLER_SECRET`, then calls the bounded fixture adapter. |
| `packages/db/scripts/target-d1-mutation.ts` | Read-only selected D1 snapshot | VERIFIED | Uses fixed `wrangler d1 execute --remote` invocation and validates exact deterministic rows. |
| `scripts/data-chain-smoke.ts` | Local and remote orchestration | VERIFIED | Wired from `package.json`; real default D1/API/provider paths exist and fail closed. |
| `scripts/data-chain-surface-observation.ts` | Constrained Dashboard/viewer append | PARTIAL | Ordering and tuple validation are substantive, but `status: passed` is a CLI claim with no real browser binding. |
| `scripts/verify-data-chain-smoke.ts` | Deterministic runner/artifact consistency check | PARTIAL | Validates schema, Markdown parity, tuple, and runner exit; it does not validate provider/browser provenance. |
| `.planning/phases/13-full-chain-data-smoke/evidence/` | Auditable local and production proof | HOLLOW/UNVERIFIED | Tracked artifacts are checkpoint-only. Ignored passed pairs validate structurally but are not authoritative behavioral evidence. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Target/run | Fixture identity | `createDataChainCandidate` / fixture codes | WIRED | Deterministic primary tuple is shared; current implementation additionally derives nine siblings. |
| Local projection | Local smoke | projected env validation before D1/service work | WIRED | Current projection and target validation commands pass. |
| Local runner | D1 and Gateway API | Wrangler local query, service-auth fixture, Gateway fetch | WIRED, RUNTIME UNVERIFIED | Real implementations exist; live execution provenance is absent. |
| Remote local pair | Provider preflight/children | exact JSON+Markdown load, `runTargetPreflight`, prepared registry | WIRED, RUNTIME UNVERIFIED | Injected tests prove ordering; ignored remote evidence does not prove provider execution. |
| Pending tuple | Dashboard/viewer | typed CLI append | PARTIAL | Tuple/order is enforced; visual observation is not. |
| Evidence pair | Validator | JSON schema + regenerated Markdown | WIRED | Latest ignored pairs pass this structural validation only. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Local runner | `snapshotResult.itemId` | Local D1 query after service-auth fixture writes | Yes when actually run | FLOWING IN CODE; BEHAVIOR UNVERIFIED |
| Remote runner | `snapshot.itemId` | Prepared remote D1 snapshot after provider preflight/fixture | Yes when actually run | FLOWING IN CODE; BEHAVIOR UNVERIFIED |
| Canonical API row | code/id response | Local Gateway or selected HTTPS canonical API | Yes when actually run | FLOWING IN CODE; BEHAVIOR UNVERIFIED |
| Dashboard/viewer rows | operator status | CLI flags passed to append writer | No independent browser data | HOLLOW PROVENANCE |
| Verification result | parsed JSON/Markdown | Existing evidence files | Structural data only | STATIC VALIDATION |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Selected local projection | `pnpm target-profile project-local --target starye-org --check` | Target-managed projection check passed | PASS |
| Target profile | `pnpm target-profile validate --target starye-org` | Target/profile/resources validated | PASS |
| Evidence/local/remote contract | focused config Vitest command | 3 files, 32 tests passed | PASS |
| Fixture contract | focused crawler Vitest command | 1 file, 8 tests passed | PASS |
| D1 snapshot contract | focused DB Vitest command | 1 file, 6 tests passed | PASS |
| Latest ignored local pair | `smoke:data-chain-observe --validate ...local-20260717t084300z...` | Exit 0 | PASS (schema only) |
| Latest ignored remote pair | `smoke:data-chain-observe --validate ...local-20260717t084300z...` | Exit 0 | PASS (schema only) |
| Crawler regression gate | `pnpm --filter @starye/crawler test --run` | Provided gate: 15 files / 82 tests passed | PASS |
| Config regression gate | config main suite plus isolated TypeChecker test | Provided gate: 138/139 initially; the sole default 30s TypeChecker timeout passed 2/2 with `--testTimeout=90000` | PASS; timeout is not a behavior failure |

### Probe Execution

No Phase 13 probe script is declared or present. Step 7c is skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DATA-01 | 13-03 | Local Gateway smoke for API/auth/dashboard/content | NEEDS HUMAN | Code and contract tests exist; real browser/runtime provenance is absent. |
| DATA-02 | 13-01, 13-03 | Local D1 schema/minimal data readiness | NEEDS HUMAN | Real query path exists; no authoritative terminal run output is retained. |
| DATA-03 | 13-01, 13-02 | Targeted fixture and item identity | NEEDS HUMAN | Live write is unproven; the original one-item plan also drifted to ten items. |
| DATA-04 | 13-02, 13-03, 13-04 | Item exists in D1/API/admin | NEEDS HUMAN | D1/API code is wired, but real selected-target/admin correlation is not independently evidenced. |
| DATA-05 | 13-03, 13-04 | Manage/validate through Dashboard | NEEDS HUMAN | CLI append cannot prove an authorized Dashboard observation. |
| DATA-06 | 13-03, 13-04 | View through selected canonical Gateway | NEEDS HUMAN | No independent local/production browser proof. |
| DATA-07 | 13-01..13-04 | Capture local and production smoke evidence | BLOCKED | Tracked evidence is checkpoint-only; ignored passed artifacts have no auditable origin. |
| TEST-05 | 13-01..13-04 | Repeatable smoke script output | SATISFIED | Strict scripts, structural validators, and focused/full regression gates pass. |

No Phase 13 requirement is orphaned: all eight ROADMAP requirement IDs appear in at least one Phase 13 plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| Phase implementation files | - | No unreferenced TBD/FIXME/XXX markers found | INFO | No debt-marker blocker. |
| `scripts/data-chain-smoke.ts` | 858 | `console.log` | INFO | Expected redacted CLI result output, not a console-only implementation. |
| `packages/config/src/deployment-target/mutation-entry.ts` | 477 | `return {}` | INFO | Expected empty result for successful non-smoke prepared entries, not a Phase 13 stub. |
| Ignored passed evidence | - | Self-attested external/browser status | WARNING | Structural validity cannot establish provider/browser execution. |

### Human Verification Required

1. **Local full-chain provenance**
   - Test: Run one new canonical local smoke with the existing local stack and authorized Dashboard session, then retain the command result and ordered Dashboard/viewer observation for the exact tuple.
   - Expected: Terminal `resolved/passed` through `http://localhost:8080` with all eight required surfaces.
   - Why human: Real D1/service state and browser authorization are outside injected tests.

2. **Provider-backed production provenance**
   - Test: Use the exact terminal local run to execute remote preflight, bounded fixture, remote D1 snapshot, canonical API, Dashboard, and viewer checks.
   - Expected: One terminal remote `resolved/passed` artifact for the same target/run/code and its remote itemId, with independently reviewable provider/browser provenance.
   - Why human: External Cloudflare account access and authorized browser state cannot be inferred from JSON shape.

3. **Ten-item contract decision**
   - Test: Decide whether the newer quick-plan ten-item batch replaces the canonical 13-02 one-item requirement.
   - Expected: Either restore exactly one fixture or record an accepted override/canonical contract update.
   - Why human: Both implementations are intentional-looking, but only the developer can accept the scope change.

### Deferred Items

None. Phase 14 covers literal cleanup, RUNBOOK procedures, and final evidence mapping; it does not explicitly perform or replace the missing Phase 13 real local/production chain.

### Gaps Summary

The implementation is substantial, wired, and well tested, but the goal is to **prove actual usability**, not merely provide a runner. Canonical Phase 13 state remains checkpointed, while later ignored passed artifacts are structurally valid self-attestations with no independent provider/browser provenance. The live workspace now has the required key presence and both local projection commands pass, so the old prerequisite description is stale; that makes a fresh auditable run possible, not already proven.

Separately, the current ten-item fixture contradicts the canonical 13-02 exactly-one must-have. The later quick plan documents the intent but does not supply the accepted override required by the verifier contract.

---

_Verified: 2026-07-17T10:09:45Z_
_Verifier: the agent (gsd-verifier)_
