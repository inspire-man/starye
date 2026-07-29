---
phase: 15-reconcile-v1-2-evidence-matrix-with-phase-13-closeout
plan: "01"
subsystem: testing
tags: [evidence-matrix, phase-13, vitest, typescript, local-validation]
requires:
  - phase: 13-full-chain-data-smoke
    provides: Canonical raw requirement statuses and the frozen p13-66 Viewer checkpoint.
  - phase: 14-test-and-operations-hardening
    provides: The 30-row derived evidence matrix and its local final CLI.
provides:
  - Typed raw-status reconciliation from the Phase 13 verifier to four public matrix states.
  - A current 30-row JSON and Markdown evidence matrix with raw source status preserved.
  - A bounded non-sensitive closeout and manual Phase 13 handoff.
affects: [phase-13-closeout, v1.2-milestone-audit, evidence-matrix-validation]
tech-stack:
  added: []
  patterns:
    - Exact canonical-verifier parsing with raw-label-to-public-state mapping.
    - Renderer-only Markdown projection and fixed injected-read local CLI validation.
key-files:
  created:
    - .planning/phases/15-reconcile-v1-2-evidence-matrix-with-phase-13-closeout/15-RECONCILIATION.md
  modified:
    - packages/config/src/deployment-target/requirement-evidence-matrix.ts
    - packages/config/src/deployment-target/__tests__/requirement-evidence-matrix.test.ts
    - .planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.json
    - .planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.md
key-decisions:
  - "Phase 13 SATISFIED, PARTIAL, and FAILED/CHECKPOINT map to verified, partial, and blocked while retaining the raw source label."
  - "The first local reconciliation is complete; a second round is manual, run-bound, and limited to one later terminal Phase 13 artifact."
  - "Phase 15 does not promote Phase 13 or v1.2 completion and does not use traceability checkboxes as runtime proof."
patterns-established:
  - "Phase 13 rows must anchor current verifier raw labels, rather than historical BLOCKED/PARTIAL labels."
  - "Derived Markdown is written only by renderRequirementEvidenceMatrixMarkdown."
requirements-completed: []
coverage: []
duration: 20 min
completed: 2026-07-29
status: complete
---

# Phase 15 Plan 01: Evidence Matrix Reconciliation Summary

**Typed reconciliation now derives the 30-row v1.2 matrix from Phase 13's current raw verifier labels while retaining the frozen Viewer checkpoint and a bounded local-only handoff.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-29T18:00:00+08:00
- **Completed:** 2026-07-29T18:20:00+08:00
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- Replaced the historical `BLOCKED`/`PARTIAL` extractor with an exact typed
  Phase 13 parser: `SATISFIED → verified`, `PARTIAL → partial`, and
  `FAILED/CHECKPOINT → blocked`.
- Added 12 focused Vitest cases for raw labels, duplicate/missing/unknown rows,
  stale anchors and recovery narratives, Markdown projection, and injected
  read-only CLI validation.
- Updated the complete 30-row matrix and renderer-derived Markdown; DATA-06
  remains blocked at `canonical_viewer_unavailable` and DATA-05/DATA-07/TEST-05
  remain partial.
- Recorded the completed first local reconciliation, explicit authorization
  boundary, and the sole run-bound condition for a manually opened second round.

## Task Commits

1. **Task 1: Test and implement canonical Phase 13 raw-status reconciliation** - `dd7d9c6` (feat)
2. **Task 2: Populate the first-round 30-row reconciliation and derived evidence matrix** - `2fce0a2` (docs)
3. **Task 3: Record bounded local validation and the conditional second-round gate** - `7ffcb2a` (docs)

## Files Created/Modified

- `packages/config/src/deployment-target/requirement-evidence-matrix.ts` - Exact
  Phase 13 parser, public-state mapping, raw-status retention, and stale-source
  validation.
- `packages/config/src/deployment-target/__tests__/requirement-evidence-matrix.test.ts` - Focused regression coverage.
- `scripts/verify-v12-evidence-matrix.ts` - Retained its fixed local,
  injected-read-only CLI boundary.
- `.planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.json` - Current derived 30-row evidence state.
- `.planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.md` - Byte-identical renderer projection.
- `.planning/phases/15-reconcile-v1-2-evidence-matrix-with-phase-13-closeout/15-RECONCILIATION.md` - First-round ledger, validation receipt, and bounded handoff.

## Validation

- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/requirement-evidence-matrix.test.ts` - pass (1 file, 12 tests).
- `pnpm --filter @starye/config type-check` - pass.
- `pnpm --filter @starye/crawler exec node --import tsx ../../scripts/verify-v12-evidence-matrix.ts --final` - pass (`{"valid":true,"issues":[]}`).
- `git diff --check` - pass.
- GitNexus impact: LOW blast radius for `canonicalPhase13Statuses` (3 symbols), `validateRequirementEvidenceMatrix` (3), and `verifyV12EvidenceMatrix` (2); no affected execution flows.
- GitNexus `detect-changes --scope all` before each task commit: LOW risk and no affected execution flows for the planned validator/matrix work. User-owned `AGENTS.md`, `CLAUDE.md`, and `.planning/config.json` changes remained unstaged.

## Decisions Made

- Current canonical Phase 13 verifier labels are source truth; the matrix cannot
  accept stale historical anchors.
- First-round reconciliation is local and read-only. No new Phase 13 run-bound
  terminal artifact is recorded in the canonical verifier, so round two was not
  triggered.
- `REQUIREMENTS.md` remains untouched and no phase or milestone completion was
  inferred from this reconciliation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected the renderer invocation's package-relative path**
- **Found during:** Task 2
- **Issue:** `pnpm --filter @starye/crawler exec` changes the working directory,
  so the first renderer invocation resolved `packages/config` below the crawler
  package and could not import the typed renderer.
- **Fix:** Used the repository-relative `../../packages/config/...` and
  `../../.planning/...` paths in the renderer-only mechanical generation command.
- **Files modified:** No additional source files; the intended renderer output is
  `14-EVIDENCE-MATRIX.md`.
- **Verification:** Fixed final CLI returned `{"valid":true,"issues":[]}`.
- **Committed in:** `2fce0a2` (Task 2)

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking issue).
**Impact on plan:** The correction only fixed a local renderer path; it added no
remote or credentialed behavior and did not widen scope.

## Known Stubs

None - the matrix is derived from live repository verifier text, and the
non-verified rows deliberately carry their concrete checkpoint and recovery
fields rather than placeholder values.

## Threat Flags

None - the phase added no network endpoint, credential path, file-access trust
boundary, schema change, or operational execution branch.

## Self-Check

PASSED - all listed implementation, matrix, reconciliation, and Summary files
exist; task commits `dd7d9c6`, `2fce0a2`, and `7ffcb2a` are present in history.

## Next Phase Readiness

The evidence-matrix contract is current and locally validated. Phase 13 remains
`gaps_found`: the frozen p13-66 Viewer checkpoint requires an explicitly
authorized later Phase 13 canonical run and terminal verifier result before a
separately opened, at-most-once second reconciliation round. v1.2 is not marked
complete by this plan.

---
*Phase: 15-reconcile-v1-2-evidence-matrix-with-phase-13-closeout*
*Completed: 2026-07-29*
