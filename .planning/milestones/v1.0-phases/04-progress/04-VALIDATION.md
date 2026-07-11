---
phase: 4
slug: progress
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for unified progress table rollout across API, movie-app, and comic-app.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (api / movie-app / comic-app) + Vue TSC (movie-app / comic-app) + source assertions + human UAT |
| **Config file** | `apps/api/package.json` (`vitest` script), `apps/movie-app/package.json`, `apps/comic-app/package.json`, `.planning/phases/04-progress/04-HUMAN-UAT.md` |
| **Quick run command** | Run the narrowest command from the Per-Task Verification Map below |
| **Full suite command** | Targeted phase matrix from the Per-Task Verification Map below + `04-HUMAN-UAT.md` manual checklist |
| **Estimated runtime** | targeted checks ~1-10s per package; full Phase 4 matrix ~20-40s plus browser/migration UAT |

## Sampling Rate

- **After every task commit:** run the narrowest affected package tests first.
- **After every plan wave:** rerun the relevant package matrix plus the matching source assertions.
- **Before `$gsd-verify-work`:** all automated checks must be green and `04-HUMAN-UAT.md` must show the browser/migration checklist passed.
- **Max feedback latency:** < 30s for targeted automated checks; `pagehide` / close-tab / reopen flows remain browser-manual.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure / Stable Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|--------------------------|-----------|-------------------|-------------|--------|
| V-04-01A | 04-01 | 1 | PROG-01, PROG-03 | unified progress route remains auth-scoped, returns explicit `completed`, and writes through single-table upsert | unit | `pnpm --filter api test --run src/routes/public/progress/__tests__/progress.test.ts` | ✅ | ✅ passed |
| V-04-01B | 04-01 | 1 | PROG-01, PROG-02, PROG-03 | schema / migration expose unified key + history index, and old tables are removed in cutover SQL | source assertion | `rg -n "idx_progress_user_content|idx_progress_user_updated_at|DROP TABLE IF EXISTS reading_progress|DROP TABLE IF EXISTS watching_progress" packages/db/src/schema.ts packages/db/drizzle/0026_unified_progress_cutover.sql` | ✅ | ✅ passed |
| V-04-02A | 04-02 | 2 | PROG-04, PROG-05 | movie player/client/auth-guard path stays valid for standard + `streamUrl` progress flows | unit + typecheck | `pnpm --filter @starye/movie-app test --run src/lib/__tests__/api-client.test.ts src/composables/__tests__/useAuthGuard.test.ts src/views/__tests__/Player.security.test.ts && pnpm --filter @starye/movie-app exec vue-tsc --noEmit` | ✅ | ✅ passed |
| V-04-02B | 04-02 | 2 | PROG-04, PROG-05 | player uses 10s checkpoint + `pause` / `seeked` / `pagehide`; history/continue rail consume explicit `completed` | source assertion | `rg -n "PROGRESS_SAVE_INTERVAL_SECONDS|PROGRESS_MIN_SAVE_SECONDS|MOVIE_COMPLETED_THRESHOLD|pagehide|!item\\.completed|return item\\.completed" apps/movie-app/src/views/Player.vue apps/movie-app/src/views/Home.vue apps/movie-app/src/views/History.vue` | ✅ | ✅ passed |
| V-04-03A | 04-03 | 2 | PROG-06, PROG-07, PROG-08 | Reader restores by real chapter id, uses 500ms debounce + `pagehide`, and persists explicit `completed` | source assertion + typecheck | `pnpm --filter @starye/comic-app exec vue-tsc --noEmit && rg -n "response\\.data\\.completed \\? 1 : response\\.data\\.page|saveReadingProgress|pagehide|500\\)|persistProgress\\(1, false\\)" apps/comic-app/src/views/Reader.vue apps/comic-app/src/views/Profile.vue` | ✅ | ✅ passed |
| V-04-04 | 04-04 | 3 | PROG-04..08 supporting gate | anonymous progress entrypoints redirect to `/auth/login?next=...`; real browser reopen / complete / migration flows are recorded in UAT | unit + manual | `pnpm --filter @starye/movie-app test --run src/composables/__tests__/useAuthGuard.test.ts && pnpm --filter @starye/comic-app test --run src/composables/__tests__/useAuthGuard.test.ts` plus `04-HUMAN-UAT.md` | ✅ | ✅ passed |

*Status: ⬜ pending · ✅ passed · ⚠️ manual-only*

## Wave 0 Requirements

- [x] API progress route regression suite exists and passed on 2026-05-14.
- [x] movie-app targeted Vitest suites and Vue TSC passed on 2026-05-14.
- [x] comic-app auth-guard test and Vue TSC passed on 2026-05-14.
- [x] `04-HUMAN-UAT.md` exists and records 12/12 pass for browser-close / reopen / completed / migration flows.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 关闭 movie 标签页后再进同片，自动从上次位置恢复 | PROG-04, PROG-05 | 依赖真实 browser `pagehide`、媒体缓冲与重进播放器行为 | 已在 `04-HUMAN-UAT.md` 第 1-4 项记录通过 |
| `streamUrl` / TorrServer 路径也能保存并恢复进度 | PROG-04, PROG-05 | 需要真实 Player + query param path | 已在 `04-HUMAN-UAT.md` 第 3 项记录通过 |
| comic 中途关闭与最后一页完成后重开语义 | PROG-06, PROG-07, PROG-08 | 依赖真实滚动、章节图片加载与重入行为 | 已在 `04-HUMAN-UAT.md` 第 6-8 项记录通过 |
| 本地 D1 migration smoke：`progress` 表存在且旧表退场 | PROG-01, PROG-02, PROG-03 supporting gate | 依赖真实本地 D1 schema 状态，不适合靠 mock 替代 | 已在 `04-HUMAN-UAT.md` 第 11-12 项记录通过 |
| 匿名访问 progress 页面与入口跳 `/auth/login?next=...` | PROG-04..08 supporting gate | 单元测试只能验证 composable；真实路由跳转仍需浏览器确认 | 已在 `04-HUMAN-UAT.md` 第 9-10 项记录通过 |

---

## Validation Audit 2026-05-14

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

本次没有发现新的 Nyquist 覆盖缺口。原文档中的 `pending` 状态与 `@starye/api` 过滤命令属于验证文档陈旧，不是当前代码库缺测。

已重新确认的关键证据：

- `pnpm --filter api test --run src/routes/public/progress/__tests__/progress.test.ts` -> `6/6 passed`
- `pnpm --filter @starye/movie-app test --run src/lib/__tests__/api-client.test.ts src/composables/__tests__/useAuthGuard.test.ts src/views/__tests__/Player.security.test.ts` -> `17/17 passed`
- `pnpm --filter @starye/movie-app exec vue-tsc --noEmit` -> passed
- `pnpm --filter @starye/comic-app test --run src/composables/__tests__/useAuthGuard.test.ts` -> `3/3 passed`
- `pnpm --filter @starye/comic-app exec vue-tsc --noEmit` -> passed
- `packages/db/src/schema.ts` 与 `packages/db/drizzle/0026_unified_progress_cutover.sql` 满足 `PROG-01/02/03` 的 unified schema / index / old-table removal 源码断言

**非 Nyquist 门禁残留：** `pnpm --filter api exec tsc --noEmit` 仍然失败，但失败面主要是 `packages/db/dist` 未构建导致的 `TS6305` 以及 API 包内既有的广域 TypeScript debt；这没有阻断本次 Phase 4 的 targeted regression evidence，因此不计入本 phase 的 Nyquist gap。

## Validation Sign-Off

- [x] All planned work has automated verification or explicit manual-only coverage
- [x] Previously stale `pending` map and invalid API package filter have been reconciled
- [x] `04-HUMAN-UAT.md` already records 12/12 pass for browser / migration manual checks
- [x] `nyquist_compliant: true` retained in frontmatter

**Approval:** automated coverage complete; manual-only browser and migration checks recorded in `04-HUMAN-UAT.md` on 2026-05-13
