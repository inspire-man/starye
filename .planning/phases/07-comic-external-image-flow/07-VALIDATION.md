---
phase: 7
slug: comic-external-image-flow
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-13
---

# Phase 7 - Validation Strategy

> Per-phase validation contract for comic chapter external image ingestion, public/admin API stability, and Reader failure UX.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | targeted `vitest` across crawler, api, and comic-app + source assertions + manual Gateway smoke |
| **Config file** | `packages/crawler/package.json`, `apps/api/package.json`, `apps/comic-app/package.json`, `.planning/phases/07-comic-external-image-flow/07-0*-PLAN.md` |
| **Quick run command** | `pnpm --filter @starye/crawler exec vitest run test/site-92hm-chapter-content.test.ts` |
| **Full suite command** | targeted Phase 7 matrix below + `pnpm type-check` |
| **Estimated runtime** | unit/integration checks ~20-90s; manual Gateway smoke depends on local dev stack startup |

## Sampling Rate

- **After every task commit:** run the narrowest package-scoped `vitest` command for the touched file set.
- **After every plan wave:** rerun all targeted commands for that wave plus package-local type checks when crawler/api/comic-app source changed.
- **Before `$gsd-verify-work 7`:** all targeted crawler/api/comic-app checks must pass, and the manual Gateway smoke checklist must be ready.
- **Manual latency tolerance:** local Gateway smoke can exceed the quick loop and must be tracked explicitly.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure / Stable Behavior | Test Type | Automated Command | Output State | Status |
|---------|------|------|-------------|--------------------------|-----------|-------------------|--------------|--------|
| V-07-01A | 07-01 | 1 | COMIC-01 | strategy normalizes chapter image URLs to absolute external URLs, preserves query, filters empties, and deduplicates after normalization | unit | `pnpm --filter @starye/crawler exec vitest run test/site-92hm-chapter-content.test.ts` | planned target | ⬜ pending |
| V-07-01B | 07-01 | 1 | COMIC-01, COMIC-02 | chapter body images never call `ImageProcessor.process()`, while cover uploads require explicit `UPLOAD_COMIC_COVERS_TO_R2=true` wiring from `packages/crawler/src/index.ts` | unit / orchestration | `pnpm --filter @starye/crawler exec vitest run src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts && pnpm --filter @starye/crawler exec tsc --noEmit` | planned target | ⬜ pending |
| V-07-01C | 07-01 | 1 | COMIC-01, COMIC-05 | `syncChapterData()` rejects empty or regressed page sets before delete/replace and keeps old data on failed replacement | integration | `pnpm --filter api exec vitest run src/routes/admin/sync/__tests__/handlers.test.ts` | planned target | ⬜ pending |
| V-07-02A | 07-02 | 2 | COMIC-03 | public chapter route keeps `images: string[]` in page order and returns DB URLs unchanged | integration | `pnpm --filter api exec vitest run src/routes/public/comics/__tests__/public-comics.test.ts` | planned target | ⬜ pending |
| V-07-02B | 07-02 | 2 | COMIC-05 | admin integrity probe performs full-chapter, low-concurrency, short-timeout, read-only probing and rejects SSRF targets | integration | `pnpm --filter api exec vitest run src/routes/admin/chapters/__tests__/integrity-check.test.ts` | planned target | ⬜ pending |
| V-07-03A | 07-03 | 2 | COMIC-04 | Reader shows single-image failure cards, partial-failure summary, all-failed chapter state, and never marks 0-success chapters completed | component | `pnpm --filter @starye/comic-app exec vitest run src/views/__tests__/Reader.test.ts` | planned target | ⬜ pending |
| V-07-ALL | 07-01..03 | 2 | COMIC-01..05 | workspace-level type safety for crawler, api, and comic-app does not regress | typecheck | `pnpm type-check` | planned target | ⬜ pending |

*Status: ⬜ pending · ✅ green · ⚠ manual-only*

## Wave 0 Requirements

- [x] `07-CONTEXT.md`, `07-RESEARCH.md`, `07-PATTERNS.md`, and `07-01/02/03-PLAN.md` all exist and agree on the phase boundary.
- [x] Integrity probe scope is resolved to “full chapter, low concurrency, short timeout, read-only” instead of remaining an open question.
- [x] Explicit cover gate configuration surface is chosen: `packages/crawler/src/index.ts` reads `UPLOAD_COMIC_COVERS_TO_R2` and passes it into `ComicCrawler`.
- [x] Targeted test surfaces are identified for crawler, api, and comic-app.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Gateway 端阅读链路能显示外链图、失败提示和进度保存 | COMIC-03, COMIC-04 | 需要本地多服务联调与真实浏览器渲染 | `pnpm dev:clean` 后访问 `http://localhost:8080/comic/`，验证单图失败、部分失败、整章失败和 progress save |
| 管理端 integrity probe 在真实外链环境下给出可信失败样本 | COMIC-05 | 依赖真实远端图片 host、防盗链行为和本地 admin 会话 | 启动本地 API/Gateway 后，用 admin 身份调用或操作新 integrity route，确认返回失败页码/样本且无 DB 副作用 |

## Validation Sign-Off

- [x] All planned work has an automated or source-assertable verification path
- [x] Manual-only local integration checks are explicitly listed
- [x] Wave 0 dependencies are covered by current phase artifacts and repo entrypoints
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-07-13
