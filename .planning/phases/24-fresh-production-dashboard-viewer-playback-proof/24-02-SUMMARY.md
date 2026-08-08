---
phase: 24-fresh-production-dashboard-viewer-playback-proof
plan: 02
subsystem: api
tags: [playback, evidence, d1, hono, crawler-tasks, idempotency, redaction]

# Dependency graph
requires:
  - phase: 24-fresh-production-dashboard-viewer-playback-proof
    provides: closed playback evidence DTO, redaction contract, and playback verification gate from Plan 01
  - phase: 23-github-actions-production-repair-and-reconciliation
    provides: server-owned provider association, repair receipt, source revision, and current-attempt facts
provides:
  - tuple-bound D1 playback summary and bounded rejection history persistence
  - replay-safe playback evidence repository with CAS and stable outcomes
  - authenticated crawler-task evidence POST and current/history task-detail projection
affects: [24-03-dashboard-evidence-surface, 24-04-viewer-playback-evidence, 24-05-production-proof]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-owned task/run/attempt binding, prepared-statement CAS, bounded current/history projection]

key-files:
  created:
    - packages/db/drizzle/0031_playback_evidence.sql
    - apps/api/src/domain/playback-evidence/repository.ts
  modified:
    - packages/db/src/schema.ts
    - packages/db/src/__tests__/playback-evidence-migration.test.ts
    - apps/api/src/domain/playback-evidence/__tests__/repository.test.ts
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts

key-decisions:
  - "Playback evidence is accepted only through the authenticated crawler-task route after server-owned task/run/attempt ownership and tuple checks; provider and source-revision validation remains repository-owned."
  - "Task detail exposes playback evidence as current plus bounded history so playback never becomes an overall provider or receipt success badge."
  - "D1 stores only bounded summaries, hashes, references, and rejection facts; raw JSON/Markdown artifacts and media remain outside production reads."

patterns-established:
  - "Generate artifact references from the server-read attempt number and bind them to phase24/task/run/attempt paths."
  - "Use stable accepted/duplicate/conflict/stale/late/ignored/checkpoint outcomes without overwriting the first valid playback fact."

requirements-completed: [EVID-01, EVID-02, EVID-03]

coverage:
  - id: D1
    description: "D1 playback summary and bounded rejection history schema/migration with tuple and CAS indexes"
    requirement: EVID-01
    verification:
      - kind: integration
        ref: "packages/db/src/__tests__/playback-evidence-migration.test.ts (schema, indexes, foreign keys, and migration readback)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Replay-safe repository preserving the first valid playback fact and recording duplicate/conflict/stale/late history"
    requirement: EVID-02
    verification:
      - kind: integration
        ref: "apps/api/src/domain/playback-evidence/__tests__/repository.test.ts (accepted-once, duplicate, conflict, tuple mismatch, stale, late, and projection immutability)"
        status: pass
      - kind: other
        ref: "pnpm --filter api type-check"
        status: pass
    human_judgment: false
  - id: D3
    description: "Authenticated crawler-task evidence POST and redacted current/history task-detail projection"
    requirement: EVID-03
    verification:
      - kind: integration
        ref: "apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts (route reachability, auth, ownership, tuple binding, sensitive-field rejection, stable outcomes, and current/history projection)"
        status: pass
      - kind: other
        ref: "pnpm --filter @starye/api-types run build"
        status: pass
      - kind: other
        ref: "git diff --check"
        status: pass
    human_judgment: false

# Metrics
duration: 36min
completed: 2026-08-08
status: complete
---

# Phase 24 Plan 02: Fresh Production Dashboard Viewer Playback Proof Summary

**Authenticated tuple-bound playback evidence persistence with replay-safe D1 CAS and bounded current/history crawler-task projections.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-08-08T05:19:08Z (Task 1 commit start)
- **Completed:** 2026-08-08T05:55:23Z
- **Tasks:** 3 completed
- **Files modified:** 7

## Accomplishments

- Added the D1 schema and migration for immutable playback summary/reference rows and bounded append-only rejection history.
- Implemented prepared-statement replay handling: first valid evidence wins, identical replay is duplicate, conflicting replay is conflict, and stale/late/ignored submissions do not change the current projection.
- Mounted an authenticated `/crawler-tasks/:taskId/runs/:runId/playback-evidence` endpoint and extended task detail with independent playback current/history data while keeping provider, receipt, source, and playback facts separate.
- Kept target, workflow, repository, ref, environment, URL, command, secret, raw runner payload, and media content outside the accepted route contract and response projection.

## Task Commits

Each task was committed atomically:

1. **Task 1: 建立 playback evidence D1 schema 与本地 migration** - `1097e82` (feat)
2. **Task 2: 实现 replay-safe evidence repository** - `bfd9495` (feat)
3. **Task 3: 挂载 authenticated evidence endpoint 与 task detail projection** - `e481c3d` (feat)

## Verification

- `pnpm --filter @starye/db exec vitest run src/__tests__/playback-evidence-migration.test.ts` -> PASS, 2 tests.
- `pnpm --filter api exec vitest run src/domain/playback-evidence/__tests__/repository.test.ts` -> PASS, 2 tests.
- `pnpm --filter api exec vitest run src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` -> PASS, 25 tests.
- `pnpm --filter @starye/api-types run build` -> PASS.
- `pnpm --filter api type-check` -> PASS.
- `git diff --check` -> PASS.
- GitNexus staged `detect-changes` reported 2 intended files, 0 affected processes, LOW risk.

## Decisions Made

- The route owns task/run/attempt identity from authenticated path and server D1 readback; the repository remains the authority for provider, source revision, repair readback, evidence window, redaction, idempotency, and CAS.
- Task detail returns `playbackEvidence.current` for the server-selected latest run and bounded `playbackEvidence.history` for prior runs/rejections; no aggregate success field is introduced.
- Artifact references are generated from the server-read tuple and D1 stores references/hashes and bounded summaries only. Production application reads do not load raw JSON/Markdown artifacts or media.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved current-attempt playback evidence in detail projection**

- **Found during:** Task 3 focused route verification
- **Issue:** The projection treated a valid current run as history when the task detail fixture exposed a different identifier shape.
- **Fix:** Added camelCase/snake_case current-run resolution with a bounded first-run fallback and reset the route mock's one-shot detail implementation between tests.
- **Files modified:** `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts`
- **Verification:** Route suite passes with 25 tests.
- **Committed in:** `e481c3d`

**2. [Rule 2 - Missing Critical] Enforced route-level server-owned tuple identity**

- **Found during:** Task 3 implementation
- **Issue:** Repository validation alone would allow a mismatched client tuple to reach rejection persistence under the path task/run.
- **Fix:** Read attempt number from the owned D1 run and reject task/run/attempt tuple mismatches before artifact creation or repository persistence.
- **Files modified:** `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts`
- **Verification:** Tuple mismatch and ownership regressions pass.
- **Committed in:** `e481c3d`

**3. [Rule 3 - Blocking] Added explicit TypeScript narrowing for the server attempt readback**

- **Found during:** Task 3 type-check
- **Issue:** `Number.isSafeInteger` alone did not narrow an optional D1 result to `number` under the repository compiler settings.
- **Fix:** Added an explicit `typeof attemptNumber === 'number'` guard.
- **Files modified:** `apps/api/src/routes/admin/crawler-tasks/index.ts`
- **Verification:** `pnpm --filter api type-check` passes.
- **Committed in:** `e481c3d`

**4. [Rule 3 - Blocking] Used Vitest-compatible commands without the unsupported `-x` flag**

- **Found during:** Plan-level verification
- **Issue:** Installed Vitest 4.1.4 rejects the plan's legacy `-x` option.
- **Fix:** Ran the same file-scoped tests without `-x`.
- **Files modified:** None
- **Verification:** All required migration, repository, and route tests pass.
- **Committed in:** None; command compatibility only.

**Total deviations:** 4 auto-fixed (1 Rule 1, 1 Rule 2, 2 Rule 3)
**Impact on plan:** All changes remain within the planned route/test boundary and strengthen correctness or verification fidelity.

## Issues Encountered

None. No authentication gate or external service setup was required.

## Known Stubs

None found in the files created or modified by this plan. The production artifact write and browser playback proof remain intentionally downstream phase work; this plan exposes only D1 bounded references and projections.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 can consume the authenticated crawler-task detail contract at the canonical Gateway origin `http://localhost:8080`, using the independent provider, repair/receipt, source, and playback evidence blocks. The tests above are local/API proof only and do not claim production browser playback.

---
*Phase: 24-fresh-production-dashboard-viewer-playback-proof*
*Plan: 02*
*Completed: 2026-08-08*

## Self-Check: PASSED

- Summary file exists on disk.
- Task commits `1097e82`, `bfd9495`, and `e481c3d` exist in git history.
- `git diff --check` passes.
