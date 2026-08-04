---
phase: 19-dashboard-operations-and-end-to-end-proof
plan: 01
subsystem: api-crawler-task-read-model
tags: [crawler-tasks, dashboard, keyset-pagination, provider-redaction, receipt]
requires: [DASH-01, DASH-02, DASH-03]
provides: [stable-task-history-cursor, complete-attempt-detail, provider-safe-projection, sequence-log-page]
affects: [admin-crawler-routes, local-runner-read-model, dashboard-crawler-client]
tech-stack:
  added: []
  patterns: [opaque-base64url-keyset-cursor, repository-read-model-projection, provider-owned-url-derivation]
key-files:
  created: []
  modified:
    - apps/api/src/schemas/crawler-tasks.ts
    - apps/api/src/domain/crawler-tasks/types.ts
    - apps/api/src/domain/crawler-tasks/provider-association.ts
    - apps/api/src/domain/crawler-tasks/repository.ts
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts
    - apps/api/src/domain/crawler-tasks/__tests__/provider-association.test.ts
decisions:
  - "Task history uses opaque base64url (updatedAt,id) keyset tuples aligned with updated_at DESC, id DESC."
  - "Provider detail is allowlisted and derives GitHub Actions URL from fixed repository plus numeric run ID."
  - "Legacy or malformed provider association rows project as unavailable while task history remains readable."
metrics:
  duration: "29m"
  completed: "2026-08-01"
  tasks: 3
status: complete
---

# Phase 19 Plan 01 Summary

API crawler task history now provides a stable, complete, permission-safe read model for Dashboard operations. List pages use an opaque `(updated_at,id)` cursor, detail returns every attempt with validated receipt and redacted provider metadata, and logs retain descending sequence pagination while cancel/retry remain owned by the existing CAS state machine.

## Tasks Completed

| Task | Name | Commit |
| --- | --- | --- |
| 1 | 固化历史/详情/日志 DTO 与稳定游标 | 6cb7bb6 |
| 2 | 完整 task history、attempt detail 与 provider-safe repository read model | 5bb8fce |
| 3 | 接通 routes 的权限与 read model | 5bb8fce |

## Verification

- `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/repository.test.ts src/domain/crawler-tasks/__tests__/provider-association.test.ts src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` — 28 tests passed.
- `pnpm --filter api type-check` — passed.
- `git diff --check` — passed.
- GitNexus staged detect-changes before implementation commit reported CRITICAL due shared repository/provider symbols; final clean-tree detect-changes reports no changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced unstable ID-only list cursor**
- **Found during:** Task 1
- **Issue:** Existing list compared `id < cursor` while ordering by `created_at`, allowing skips/repeats.
- **Fix:** Added bounded opaque base64url `(updatedAt,id)` cursor decoding and tuple-aligned SQL ordering.
- **Files modified:** `apps/api/src/domain/crawler-tasks/repository.ts`, `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/api/src/schemas/crawler-tasks.ts`
- **Commit:** 5bb8fce

**2. [Rule 2 - Missing critical functionality] Provider-safe task detail projection**
- **Found during:** Task 2
- **Issue:** Detail exposed only raw runs and omitted provider association/derived run URL.
- **Fix:** Added allowlisted provider summary, server-owned GitHub run URL derivation, and unavailable fallback for legacy schemas.
- **Files modified:** `apps/api/src/domain/crawler-tasks/provider-association.ts`, `apps/api/src/domain/crawler-tasks/repository.ts`, `apps/api/src/domain/crawler-tasks/types.ts`
- **Commit:** 5bb8fce

**3. [Rule 3 - Blocking issue] Commit hook line-length failure**
- **Found during:** Task 3 commit
- **Issue:** Conventional commit body exceeded 100 characters and hook rejected it.
- **Fix:** Recommitted with a concise single-line summary; no source changes required.
- **Commit:** 5bb8fce

## Threat Surface

- Cursor input is bounded and decoded fail-closed before SQL.
- Provider URL is derived only from server-owned fixed repository and numeric run ID.
- Raw provider payloads, credentials, token-shaped fields, and arbitrary URLs are rejected or omitted.
- Session/template/task/run ownership checks remain on every route.

## Self-Check: PASSED

- [x] Summary file exists.
- [x] Commits 6cb7bb6 and 5bb8fce exist.
- [x] All plan-owned files are clean and committed.

