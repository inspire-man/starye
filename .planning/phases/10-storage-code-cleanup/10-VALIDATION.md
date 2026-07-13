---
phase: 10
slug: storage-code-cleanup
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-13
---

# Phase 10 - Validation Strategy

> Per-phase validation contract for shared storage helper consolidation, policy-aware heuristics, and legacy script semantics cleanup.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | targeted `vitest` across `packages/api-types`, `apps/api`, `packages/crawler`, and `apps/comic-app` + source assertions for legacy scripts |
| **Config file** | `packages/api-types/src/*.test.ts`, `apps/api/package.json`, `packages/crawler/package.json`, `apps/comic-app/package.json`, `.planning/phases/10-storage-code-cleanup/10-0*-PLAN.md` |
| **Quick run command** | `pnpm --filter @starye/api-types exec vitest run src/storage-purpose-policy.test.ts` |
| **Full suite command** | targeted Phase 10 matrix below + package-scoped type checks |
| **Estimated runtime** | helper/route/seam tests ~20-90s; public comic + Reader regressions ~30-90s |

## Sampling Rate

- **After every task commit:** run the narrowest package-scoped test for the touched files.
- **After Wave 1:** rerun shared helper direct tests + upload route regression.
- **After Wave 2:** rerun crawler seam tests + admin heuristic tests + legacy script source assertions.
- **Before `$gsd-verify-work 10`:** all targeted commands below must pass, including the existing public comic / Reader regression pair.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure / Stable Behavior | Test Type | Automated Command | Output State | Status |
|---------|------|------|-------------|--------------------------|-----------|-------------------|--------------|--------|
| V-10-01A | 10-01 | 1 | CODE-01, CODE-02 | shared helper directly covers manual key builder, crawler namespace helper, and managed-vs-external URL classification | unit | `pnpm --filter @starye/api-types exec vitest run src/storage-purpose-policy.test.ts` | planned target | ⬜ pending |
| V-10-01B | 10-01 | 1 | CODE-01 | upload route uses shared helper without changing approved prefix/key shape | integration | `pnpm --filter api exec vitest run src/routes/upload/__tests__/upload.route.test.ts` | planned target | ⬜ pending |
| V-10-02A | 10-02 | 2 | CODE-01, CODE-02 | `ImageProcessor` still rejects chapter-page uploads and only allows approved namespaces after shared-helper adoption | unit | `pnpm --filter @starye/crawler exec vitest run test/image-processor-purpose-policy.test.ts` | planned target | ⬜ pending |
| V-10-02B | 10-02 | 2 | CODE-02, CODE-03 | actor/publisher pending heuristics no longer treat valid external URLs as missing assets | integration | `pnpm --filter api exec vitest run src/routes/admin/actors/__tests__/pending.test.ts src/routes/admin/publishers/__tests__/pending.test.ts` | planned target | ⬜ pending |
| V-10-03A | 10-03 | 2 | CODE-04 | legacy scripts stop presenting “cover must be R2/CDN URL” as the only success criterion | source assertion | `rg -n "policy-aware|合法外链|R2|CDN|JavBus|coverImage" packages/crawler/scripts/backfill-covers.ts packages/crawler/scripts/test-full-flow.ts packages/crawler/scripts/test-single-movie.ts` | planned target | ⬜ pending |
| V-10-ALLA | 10-01..03 | 2 | CODE-03 | public comic chapter route still returns external URLs unchanged and ordered | integration | `pnpm --filter api exec vitest run src/routes/public/comics/__tests__/public-comics.test.ts` | planned target | ⬜ pending |
| V-10-ALLB | 10-01..03 | 2 | CODE-03 | Reader failure UX still handles external image failures without regressing completed/progress rules | component | `pnpm --filter @starye/comic-app exec vitest run src/views/__tests__/Reader.test.ts` | planned target | ⬜ pending |
| V-10-ALLC | 10-01..03 | 2 | CODE-01..04 | package-level type safety remains intact after helper extraction and script cleanup | typecheck | `pnpm --filter @starye/api-types exec tsc --noEmit && pnpm --filter api exec tsc --noEmit && pnpm --filter @starye/crawler exec tsc --noEmit` | planned target | ⬜ pending |

*Status: ⬜ pending · ✅ green · ⚠ manual-only*

## Wave 0 Requirements

- [x] `10-CONTEXT.md` and `10-DISCUSSION-LOG.md` already lock the helper-only, no-runtime-service boundary.
- [x] Existing Phase 7/8 regression surfaces are known and can be reused instead of re-created.
- [x] Shared helper direct tests have a viable home under `packages/api-types` without introducing a new package boundary.
- [x] The current repo already exposes package-scoped `vitest` / `tsc` entrypoints for all affected runtime consumers.

## Manual-Only Verifications

None required for planning. Phase 10 is expected to close with automated package-scoped checks plus source assertions.

## Validation Sign-Off

- [x] All planned work has an automated or source-assertable verification path
- [x] Existing high-level regressions are explicitly reused instead of duplicated
- [x] Wave 0 dependencies are covered by current phase artifacts and repo entrypoints
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-07-13
