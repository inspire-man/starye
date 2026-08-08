---
phase: 24-fresh-production-dashboard-viewer-playback-proof
plan: 01
subsystem: api
tags: [playback, evidence, valibot, redaction, projection]

# Dependency graph
requires:
  - phase: 23-github-actions-production-repair-and-reconciliation
    provides: server-owned provider association, repair receipt, and source revision facts
provides:
  - closed tuple-bound playback evidence DTO and Valibot request/response schemas
  - allowlist redaction with deterministic JSON/Markdown pair construction
  - conservative playback_verified projection requiring complete media progress evidence
affects: [24-02-playback-evidence-persistence, 24-03-dashboard-evidence-surface, 24-04-viewer-playback-evidence, 24-05-production-proof]

# Tech tracking
tech-stack:
  added: []
  patterns: [strict Valibot objects, allowlist artifact projection, tuple/content/source-revision playback gate]

key-files:
  created:
    - apps/api/src/domain/playback-evidence/types.ts
    - apps/api/src/domain/playback-evidence/redaction.ts
    - apps/api/src/domain/playback-evidence/__tests__/contract.test.ts
    - apps/api/src/schemas/playback-evidence.ts
  modified:
    - apps/api/src/schemas/index.ts
    - apps/api/src/domain/movies/source-contract.ts
    - apps/api/src/domain/movies/__tests__/source-contract.test.ts
    - apps/api/src/routes/public/movies/__tests__/readiness.test.ts

key-decisions:
  - "Playback evidence uses one closed tuple with github-actions provider, bounded attempt number, explicit media-event observations, and finite progress samples."
  - "Artifact output is built from an allowlist after schema and forbidden key/value scans; redaction failure remains checkpoint state."
  - "playback_verified requires matching content/source revision, successful provider and repair readback, canplay plus playing, no terminal error, and delta >= 1 second; source and receipt projections remain independent."

patterns-established:
  - "All five playback events are represented exactly once, including explicit not-observed entries."
  - "The same redacted object is the source for deterministic JSON and Markdown evidence pair output."

requirements-completed: [EVID-01, EVID-02, EVID-03]

coverage:
  - id: D1
    description: "Closed tuple-bound playback evidence DTO and bounded Valibot request/response schemas"
    requirement: EVID-01
    verification:
      - kind: unit
        ref: "apps/api/src/domain/playback-evidence/__tests__/contract.test.ts (schema closure and bounds)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Redacted canonical evidence object with deterministic JSON/Markdown pair and checkpoint failures"
    requirement: EVID-02
    verification:
      - kind: unit
        ref: "apps/api/src/domain/playback-evidence/__tests__/contract.test.ts (redaction and pair stability)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Conservative playback_verified projection gated by tuple, revision, media events, and one-second progress"
    requirement: EVID-03
    verification:
      - kind: unit
        ref: "apps/api/src/domain/movies/__tests__/source-contract.test.ts (complete playback gate and mismatch rejection)"
        status: pass
      - kind: unit
        ref: "apps/api/src/routes/public/movies/__tests__/readiness.test.ts (public projection independence)"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-08-08
status: complete
---

# Phase 24 Plan 01: Fresh Production Dashboard Viewer Playback Proof Summary

**Tuple-bound playback evidence with strict Valibot validation, fail-closed redaction, deterministic artifacts, and a complete browser progress gate.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-08T04:42:00Z (approximate)
- **Completed:** 2026-08-08T04:56:23Z
- **Tasks:** 3 completed
- **Files modified:** 8

## Accomplishments

- Added closed DTOs for tuple identity, provider/repair/source/playback layers, viewer path, event timeline, progress, artifacts, outcomes, and rejection history.
- Added strict Valibot schemas with bounded identifiers, attempts, revisions, timestamps, paths, event allowlist, finite progress, and server-owned field rejection.
- Added allowlist redaction, forbidden key/value scanning, deterministic JSON/Markdown pair generation, and checkpoint-preserving failure results.
- Tightened `derivePlaybackProof` so actual verification requires matching identity/revision facts, successful terminal layers, `canplay` and `playing`, no terminal error, and honest one-second progress.

## Task Commits

Each task was committed atomically:

1. **Task 1: 定义闭合 playback evidence DTO 与 Valibot schema** - `ab510b7` (`feat`)
2. **Task 2: 实现 artifact 输入的脱敏与确定性字段校验** - `466a517` (`feat`)
3. **Task 3: 收紧 public playback_verified projection** - `e9957a9` (`fix`)

Additional verified Task 2 correction:

4. **Fail-closed redaction assertion** - `c213786` (`fix`)

## Verification

- `pnpm --filter api exec vitest run src/domain/playback-evidence/__tests__/contract.test.ts src/domain/movies/__tests__/source-contract.test.ts src/routes/public/movies/__tests__/readiness.test.ts` -> PASS, 3 files and 43 tests.
- `pnpm --filter api type-check` -> PASS.
- `git diff --check` -> PASS.
- The plan's `-x` test commands were first attempted verbatim and rejected by installed Vitest `4.1.4` as `Unknown option '-x'`; the equivalent file-scoped command without `-x` passed.
- GitNexus upstream impact for `derivePlaybackProof`: HIGH, 2 direct callers, 8 impacted symbols, 3 modules; the warning was surfaced before the change. Pre-commit `detect_changes` reported low risk and 0 affected processes for the intended changes; the index did not include newly created files and reported the pre-existing AGENTS/CLAUDE touches separately.

## Files Created/Modified

- `apps/api/src/domain/playback-evidence/types.ts` - Closed domain unions and tuple-bound evidence interfaces.
- `apps/api/src/schemas/playback-evidence.ts` - Strict request, summary, response, and rejection-history schemas.
- `apps/api/src/domain/playback-evidence/redaction.ts` - Fail-closed safe object and deterministic evidence pair builders.
- `apps/api/src/domain/playback-evidence/__tests__/contract.test.ts` - Schema, redaction, forbidden material, and pair stability tests.
- `apps/api/src/schemas/index.ts` - Public schema barrel export.
- `apps/api/src/domain/movies/source-contract.ts` - Complete playback verification gate and binding checks.
- `apps/api/src/domain/movies/__tests__/source-contract.test.ts` - Event, progress, binding, window, and independence regressions.
- `apps/api/src/routes/public/movies/__tests__/readiness.test.ts` - Updated explicit full-evidence projection fixture.

## Decisions Made

- The public projection accepts only the persisted closed summary shape; legacy minimal `{ playing, currentTime }` input remains `unverified`.
- `direct`, `TorrServer`, and `Aria2` are the only playback source types in this evidence contract; source URLs never enter the DTO.
- Production Dashboard/Viewer playback proof was not claimed here. This plan establishes the contract and projection gate; selected target, signed session, fresh run allocation, Gateway browser proof, and real media progress remain downstream Phase 24 work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated incompatible Vitest verification invocation**

- **Found during:** Task 1
- **Issue:** Installed Vitest `4.1.4` rejects the plan's `-x` option.
- **Fix:** Re-ran the same file-scoped verification without the unsupported option.
- **Files modified:** None
- **Verification:** Contract and final focused suites passed.
- **Committed in:** No code change; command compatibility only.

**2. [Rule 1 - Bug] Synchronized existing readiness assertions with the complete evidence gate**

- **Found during:** Task 3
- **Issue:** Existing tests treated minimal `{ playing, currentTime }` as verified and therefore contradicted the new D-06 gate.
- **Fix:** Replaced the minimal fixture with a complete tuple-bound evidence summary and added negative gate cases.
- **Files modified:** `apps/api/src/domain/movies/__tests__/source-contract.test.ts`, `apps/api/src/routes/public/movies/__tests__/readiness.test.ts`
- **Verification:** Focused suite passed with 43 tests.
- **Committed in:** `e9957a9`

**3. [Rule 2 - Missing Critical] Made the redaction assertion fail closed**

- **Found during:** Task 2 follow-up verification
- **Issue:** The scanner result alone was easy for a future caller to ignore when constructing an artifact.
- **Fix:** Added a throwing `assertSafePlaybackEvidence` and reused it inside the canonical builder; unsafe input remains `checkpoint` through the try helper.
- **Files modified:** `apps/api/src/domain/playback-evidence/redaction.ts`
- **Verification:** Redaction negative tests and type-check passed.
- **Committed in:** `c213786`

---

**Total deviations:** 3 (one verification-command adjustment, one behavior-aligned test repair, one fail-closed redaction hardening).
**Impact on plan:** No scope expansion beyond the contract/projection boundary; all changes are required to make the planned gate executable and honest.

## Issues Encountered

- The GitNexus index predates the newly created playback-evidence files, so `detect_changes` could not map those new symbols; it did report the modified existing source-contract symbols and no affected processes. This is recorded as an index freshness limitation, not a production verification result.

## User Setup Required

None - no external service configuration required for this contract-only plan.

## Next Phase Readiness

Plan 02 can consume the closed summary/request types, redacted artifact reference, stable outcome vocabulary, and conservative projection gate. Phase 24 production playback remains explicitly unproven until its selected target/session/fresh tuple and canonical Gateway browser evidence are available.

## Self-Check: PASSED

- SUMMARY file exists at the canonical phase path.
- Task commits `ab510b7`, `466a517`, `e9957a9`, and `c213786` exist in git history.
- All files listed under Files Created/Modified exist and are included in the corresponding task commits.
- Final focused tests, API type-check, and diff check passed.
- No plan-related files remain dirty; only pre-existing `.planning/STATE.md`, `AGENTS.md`, and `CLAUDE.md` remain modified.

---
*Phase: 24-fresh-production-dashboard-viewer-playback-proof*
*Plan: 01*
*Completed: 2026-08-08*
