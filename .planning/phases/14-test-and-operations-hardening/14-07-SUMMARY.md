---
phase: 14-test-and-operations-hardening
plan: "07"
subsystem: testing
tags: [evidence-matrix, vitest, cli, verification, traceability]
requires:
  - phase: 14-05
    provides: TEST-01 strict tracked-file audit evidence
  - phase: 14-06
    provides: TEST-06 target-first RUNBOOK contract evidence
provides:
  - Pure ordered requirement-to-evidence validator
  - Read-only final evidence matrix CLI
  - Canonical JSON matrix and deterministic Markdown projection for all 30 v1.2 requirements
affects: [TEST-07, Phase 14 verification, v1.2 milestone closeout]
tech-stack:
  added: []
  patterns:
    - Evidence rows are repository-relative, anchor-verified, and status-reconciled against canonical verifier reports.
    - Final validation reads fixed local artifacts and has no provider, credential, or child-process path.
key-files:
  created:
    - packages/config/src/deployment-target/requirement-evidence-matrix.ts
    - scripts/verify-v12-evidence-matrix.ts
    - .planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.json
    - .planning/phases/14-test-and-operations-hardening/14-EVIDENCE-MATRIX.md
  modified:
    - packages/config/src/deployment-target/__tests__/requirement-evidence-matrix.test.ts
key-decisions:
  - "Phase 13 DATA-01 through DATA-06 remain blocked; DATA-07 and TEST-05 remain partial."
  - "JSON is canonical and Markdown must equal the deterministic renderer byte-for-byte."
requirements-completed: [TEST-07]
coverage:
  - id: D1
    description: Validator rejects order, duplicate, status, path, anchor, recovery, and rendering violations.
    requirement: TEST-07
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/requirement-evidence-matrix.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Fixed-path CLI validates the full 30-row canonical matrix without external operations.
    requirement: TEST-07
    verification:
      - kind: other
        ref: pnpm --filter @starye/crawler exec node --import tsx ../../scripts/verify-v12-evidence-matrix.ts --final
        status: pass
    human_judgment: false
duration: 25m 51s
completed: 2026-07-21
status: complete
---

# Phase 14 Plan 07: Requirement Evidence Matrix Summary

**Canonical 30-row v1.2 evidence JSON and its deterministic Markdown projection now validate locally without promoting Phase 13 blocked or partial outcomes.**

## Performance

- **Duration:** 25m 51s
- **Started:** 2026-07-21T06:25:40Z
- **Completed:** 2026-07-21T06:51:30Z
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments

- Added a pure validator for exact requirement order, local evidence paths/anchors, recovery fields, status reconciliation, and Markdown identity.
- Added a fixed-path, read-only CLI that emits deterministic JSON and never invokes provider, credential, deploy, migration, crawl, smoke, or rollback behavior.
- Added the 30-row JSON matrix and derived Markdown projection, preserving all Phase 13 DATA-01..06 BLOCKED and DATA-07/TEST-05 PARTIAL facts.

## Task Commits

1. **Task 1: Define the strict evidence matrix schema and reconciliation rules** - `102b213` (test RED), `8736780` (feat GREEN)
2. **Task 2: Add the read-only final matrix CLI** - `0a82966` (test RED), `1bd1834` (feat GREEN), `b8564d4` (fix)
3. **Task 3: Populate the 30-row canonical matrix and derived Markdown** - `9bb4ba9` (docs)

## Decisions Made

- The canonical Phase 13 Requirements Coverage table overrides checkbox state, tests, plans, and summaries for DATA/TEST status.
- Each non-verified row carries its missing artifact/checkpoint, prerequisite, and `$gsd-plan-phase 13 --gaps` recovery route.
- Matrix evidence paths are local repository paths only, and renderer equality prevents review Markdown from diverging from JSON.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Normalized CLI repository-root containment before local reads**
- **Found during:** Task 3 final CLI verification
- **Issue:** URL-derived root retained a trailing separator and rejected valid repository-relative paths.
- **Fix:** Normalized the root with `path.resolve()` before containment checks.
- **Files modified:** `scripts/verify-v12-evidence-matrix.ts`
- **Verification:** Final CLI returned `{"valid":true,"issues":[]}`.
- **Committed in:** `b8564d4`

**2. [Rule 1 - Bug] Escaped table delimiters in rendered evidence anchors**
- **Found during:** Task 3 Markdown derivation
- **Issue:** Canonical report anchors contain `|`, which would break Markdown table cells.
- **Fix:** Renderer deterministically escapes anchor delimiters before projection.
- **Files modified:** `packages/config/src/deployment-target/requirement-evidence-matrix.ts`
- **Verification:** Final JSON/Markdown identity check passed.
- **Committed in:** `9bb4ba9`

**Total deviations:** 2 Rule 1 fixes.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-07 has a deterministic local evidence gate.
- Phase 13 provider and selected-production evidence remains explicitly blocked/partial and is routed only through its gaps workflow.

## Self-Check: PASSED

- Confirmed validator, CLI, JSON, Markdown, and all Task 1/2/3 commits exist on disk.
