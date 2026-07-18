---
phase: 13-full-chain-data-smoke
plan: "08"
subsystem: data-chain-smoke
tags: [execution, gateway, provenance, codex-iab, local-proof, remote-checkpoint, fail-closed]

requires:
  - phase: 13-07
    provides: tuple-bound runner, provider, and browser provenance receipts plus artifact-only verification
provides:
  - terminal local one-item proof through local D1, Gateway API, authorized Dashboard, and Gateway viewer
  - repository-core-owned Dashboard/viewer receipts captured through the accepted live Codex IAB observeSurface adapter
  - immutable selected-target remote target_preflight_unmet checkpoint recorded before any remote mutation
affects: [13-verification, phase-14, selected-target-smoke]

tech-stack:
  added: []
  patterns: [repository-core-owned IAB observation, exact local-to-remote tuple gating, fail-closed remote preflight]

key-files:
  created:
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-0b30d5c722be483d67f65305/local.json
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-0b30d5c722be483d67f65305/local.md
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-50bd5b54f177491fa01e46c7908cd1bd/local.json
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-50bd5b54f177491fa01e46c7908cd1bd/local.md
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-13fe3c66290d40eeaf294b4259afe411/local.json
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-13fe3c66290d40eeaf294b4259afe411/local.md
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-9c808cff04cc438d997beeaa8ecabafe/local.json
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-9c808cff04cc438d997beeaa8ecabafe/local.md
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-9c808cff04cc438d997beeaa8ecabafe/remote.json
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-9c808cff04cc438d997beeaa8ecabafe/remote.md
  modified:
    - .planning/phases/13-full-chain-data-smoke/13-08-SUMMARY.md
    - .planning/STATE.md

key-decisions:
  - "Preserve Attempts A, B, C, and D as immutable, intentionally untracked evidence; never append receipts to or rewrite an earlier run."
  - "Accept Attempt D local proof only because repository observeDataChainSurfaces core retained evidence validation, ordering, receipt construction, rendering, and writes while the Codex IAB adapter supplied live navigation only."
  - "Allow Task 2 to start only from Attempt D's exact terminal local pair, then stop at target_preflight_unmet before any remote mutation."
  - "Keep Phase 13 and every remote-dependent requirement pending because the selected-target external chain is not proven."

patterns-established:
  - "Terminal local proof can authorize a remote attempt without implying production proof."
  - "A selected-target preflight checkpoint with itemId null is an auditable non-success result and proves no remote mutation."

requirements-completed: []
requirements-pending: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, TEST-05]

coverage:
  - id: D1
    description: Attempt D proves one exact local tuple through local D1, canonical Gateway API, authorized Dashboard, and Gateway viewer with ordered provenance receipts.
    requirement: DATA-07
    verification:
      - kind: e2e
        ref: pnpm smoke:data-chain:verify -- --mode local --target starye-org --run-id p13-08-9c808cff04cc438d997beeaa8ecabafe --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence
        status: pass
      - kind: manual_procedural
        ref: Human inspection of the authorized Codex IAB Dashboard-before-viewer observation
        status: pass
    human_judgment: false
  - id: D2
    description: Attempt D remote execution stopped at selected-target target_preflight_unmet before provider mutation and therefore does not prove the production external chain.
    requirement: DATA-07
    verification:
      - kind: other
        ref: pnpm smoke:data-chain:verify -- --mode remote --target starye-org --run-id p13-08-9c808cff04cc438d997beeaa8ecabafe --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence
        status: fail
    human_judgment: true
    rationale: The verifier correctly reports checkpoint with provesExternalChain false; provider ownership, remote D1/API, and canonical remote browser surfaces remain unproven.

duration: multi-session
completed: 2026-07-18
status: checkpoint
---

# Phase 13 Plan 08: Authorized Smoke Execution Checkpoint Summary

**Attempt D produced terminal, provenance-backed local proof for one exact tuple, then the matching selected-target run stopped fail-closed at `remote_preflight/target_preflight_unmet` before any remote mutation.**

## Performance

- **Execution:** Four immutable attempts across the authorized 2026-07-18 session
- **Attempt D evidence window:** 2026-07-18T09:07:46.515Z to 2026-07-18T09:10:28.105Z
- **Tasks:** Task 1 terminal local proof; Task 2 honest selected-target preflight checkpoint
- **Tracked closeout files:** Summary and minimal STATE checkpoint fields
- **Evidence policy:** All A/B/C/D JSON and Markdown pairs remain intentionally untracked and unchanged

## Accomplishments

- Resolved the local workerd network route outside the evidence artifacts: the Windows system proxy did not cover workerd, while Clash TUN restored the required route.
- Added stable UUID-backed Dashboard and viewer DOM markers without weakening the observer's required code-plus-id predicate (`7f797bc`), then recorded the diagnosis (`d779481`).
- Captured ordered Attempt D Dashboard and viewer `browser_observer` receipts through the explicitly accepted Codex IAB adapter and validated the local pair as `terminal_passed` with `provesExternalChain: true`.
- Started the matching remote task only after that exact local pass, then retained `target_preflight_unmet` as a non-terminal checkpoint with no provider child, fixture, D1, API, browser, or other remote mutation.

## Task And Support Commits

| Commit | Purpose |
| --- | --- |
| `a0cf93c` | Record Attempt A target-projection checkpoint |
| `26b7936` | Record Attempt B Dashboard-session checkpoint |
| `7f797bc` | Expose stable item UUID markers in Dashboard/viewer DOM and cover the tuple contract |
| `d779481` | Record resolution of the observer DOM tuple mismatch |
| `dd8c900` | Authorize the constrained Codex IAB `observeSurface` execution override in the plan |

Generated evidence is not part of these commits and remains intentionally untracked. This closeout does not stage debug artifacts, evidence, AGENTS.md, CLAUDE.md, or unrelated changes.

## Evidence

| Attempt | Run ID | Mode | Lifecycle / outcome | Key fact |
| --- | --- | --- | --- | --- |
| A | `p13-08-0b30d5c722be483d67f65305` | local | `pre_ingest/checkpoint` | `local_projection/target_projection_unmet` |
| B | `p13-08-50bd5b54f177491fa01e46c7908cd1bd` | local | `resolved_pending_observation/checkpoint` | Dashboard session unavailable after the local runner reached one item |
| C | `p13-08-13fe3c66290d40eeaf294b4259afe411` | local | `resolved_pending_observation/pending` | Runner tuple retained unchanged; no browser observer receipt was appended |
| D | `p13-08-9c808cff04cc438d997beeaa8ecabafe` | local | `resolved/passed` | Terminal local proof with runner plus ordered Dashboard/viewer receipts |
| D | `p13-08-9c808cff04cc438d997beeaa8ecabafe` | remote | `pre_ingest/checkpoint` | `remote_preflight/target_preflight_unmet`, `itemId: null`, no remote mutation |

Attempt C's tuple is `p13-smoke-starye-org-b96f927b` / `545b4ace-7f97-423c-bfa2-5d0338539c73`. Its six local-runner observations stop at the canonical API; there is no Dashboard/viewer receipt and no remote pair. It remains a pending historical run, not evidence of terminal local success.

Attempt D's exact local tuple is `p13-smoke-starye-org-aa106c3d` / `78ba8f4d-bbf6-4c8e-b9db-92ae1ba28d78`. It contains count-one D1 evidence, canonical `http://localhost:8080` Gateway API evidence, then Dashboard `/dashboard/movies` and viewer `/movie/p13-smoke-starye-org-aa106c3d` receipts in that order.

The matching remote checkpoint retains the local-derived item code but has `itemId: null`, as required for a pre-ingest failure. It contains only the `remote_preflight` checkpoint observation; it does not contain a provider, D1, API, Dashboard, or viewer receipt.

## Accepted Codex IAB Provenance

- Plan override `dd8c900` allowed the Browser plugin's persistent Node runtime to call exported repository core `observeDataChainSurfaces()` with exactly one injected dependency: `observeSurface`.
- Repository core retained ownership of evidence loading and validation, target/base resolution, Dashboard-before-viewer ordering, receipt construction, deterministic rendering, and JSON/Markdown writes.
- The adapter performed live navigation in the already-authorized Codex in-app browser, required the exact canonical origin/path, rejected direct application ports, and required exactly one item-id marker whose settled DOM contained both the expected code and UUID.
- The resulting evidence identifies both observations as repository-rendered `browser_observer/browser_navigation` receipts. No caller-provided status, tuple, order, receipt, screenshot-only claim, cookie copy, or manual evidence edit was accepted.

## Verification

- Focused provenance suite: 4 files / 49 tests passed after the DOM marker fix and accepted plan override.
- Attempt D local exact verifier: exit `0`, `outcome: terminal_passed`, `provesExternalChain: true`.
- Attempt D authorized browser human verification: passed for ordered Dashboard and viewer tuple visibility through the local Gateway.
- Attempt D remote exact verifier: expected non-success, `outcome: checkpoint`, `provesExternalChain: false`.
- Attempt C inspection: runner-only pending evidence, zero browser observer receipts, and no later append.
- Closeout scope: no runner, observer, browser, provider command, or remote mutation was executed while updating this summary.

## Decisions Made

- Treat Attempt D as terminal local proof only. It satisfies the local prerequisite for starting Task 2 but cannot satisfy selected-target or production-chain requirements.
- Preserve Attempt C exactly as a pending, no-receipt run rather than attaching Attempt D observations to it.
- Stop Task 2 at `target_preflight_unmet`; do not issue ad hoc provider, Wrangler, SQL, crawler, deploy, rollback, Dashboard, or browser mutation commands.
- Keep Phase 13 executing and every listed requirement pending until an authorized selected-target run independently proves provider, D1, canonical API, Dashboard, and viewer receipts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored workerd network reachability**
- **Found during:** Task 1 before Attempt D
- **Issue:** Windows system proxy routing did not cover workerd, preventing the local OAuth/network path from completing.
- **Fix:** The authorized operator environment restored the route with Clash TUN; no evidence pair was rewritten.
- **Closeout scope:** Debug artifacts remain outside this commit and were not staged or modified here.

**2. [Rule 1 - Bug] Exposed the full tuple identity in settled DOM**
- **Found during:** Task 1 browser observation
- **Issue:** The rendered surfaces did not expose the stable UUID required by the unchanged code-plus-id observation predicate.
- **Fix:** Added UUID-backed markers to Dashboard and viewer without weakening tuple validation, plus regression coverage.
- **Committed in:** `7f797bc`; diagnosis closeout `d779481`

The Codex IAB path is not an unapproved deviation: its constrained adapter contract was added to the plan and committed as `dd8c900` before Attempt D.

## Issues Encountered

- Attempts A and B retained their original fail-closed local checkpoints.
- Attempt C reached a real pending tuple before the DOM fix but received no browser receipts; it was intentionally left unchanged.
- Attempt D cleared the local boundary, but the selected-target environment failed `remote_preflight` before an item id or any mutation existed.

## Authentication Gates

The local Gateway browser gate is resolved for Attempt D. The remaining external gate is the authorized selected-target preflight/ownership environment; its absence is recorded as `target_preflight_unmet`, not production success.

## Known Stubs

None. Attempt A and Attempt D remote `itemId: null` values are required pre-ingest checkpoint shapes, not UI or implementation stubs. Attempt C's missing browser receipts are explicitly preserved as a non-terminal run.

## User Setup Required

An authorized selected-target operator environment must satisfy the existing explicit credential-key, account/resource ownership, and read-only live preflight contract before another matching remote run may proceed. No secret value belongs in Git or evidence.

## Next Phase Readiness

- Phase 13 remains incomplete and must not be marked passed or complete.
- Local proof is available from Attempt D, but selected-target provider/D1/API/Dashboard/viewer proof is absent.
- DATA-01 through DATA-07 and TEST-05 remain pending for phase closeout; no production external-chain proof is claimed.

## Self-Check: PASSED

- Attempts A/B/C/D evidence files exist and remained untracked and unchanged during this closeout.
- Attempt D local evidence is terminal `resolved/passed`; its remote evidence is non-terminal `pre_ingest/checkpoint` at `target_preflight_unmet`.
- Support commits `7f797bc`, `d779481`, and `dd8c900` exist.
- Summary frontmatter remains `status: checkpoint`, with `requirements-completed: []`.
- No new trust boundary or code symbol was introduced by this closeout.

---
*Phase: 13-full-chain-data-smoke*
*Plan: 08*
*Checkpoint updated: 2026-07-18*
