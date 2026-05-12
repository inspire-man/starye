---
phase: 4
slug: progress
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for unified progress table rollout across API, movie-app, and comic-app.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + app-local type checks + Playwright (existing movie-app e2e mocks) |
| **Config file** | `apps/api/vitest.config.ts`（implicit via package）、`apps/movie-app/vitest.config.ts`、comic-app local TS config |
| **Quick run command** | `pnpm --filter @starye/api test --run src/routes/public/progress/__tests__/progress.test.ts` |
| **Full suite command** | `pnpm --filter @starye/api test --run && pnpm --filter @starye/movie-app test --run && pnpm --filter @starye/movie-app exec vue-tsc --noEmit && pnpm --filter @starye/comic-app exec vue-tsc --noEmit` |
| **Estimated runtime** | targeted unit ~10-30s; full suite ~1-3 min depending on workspace state |

## Sampling Rate

- **After every task commit:** Run the narrowest affected suite first.
- **After every plan wave:** Run API progress tests + affected app typechecks.
- **Before `$gsd-verify-work`:** Full suite green + progress-specific human UAT complete.
- **Max feedback latency:** < 30s for targeted checks; pagehide / playback / reader verification requires human steps.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure / Stable Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|--------------------------|-----------|-------------------|-------------|--------|
| V-04-01A | 04-01 | 1 | PROG-01, PROG-02, PROG-03 | unified `progress` schema replaces dual-table model and history query remains auth-scoped | route/unit + grep | `pnpm --filter @starye/api test --run src/routes/public/progress/__tests__/progress.test.ts` | ✅ | ⬜ pending |
| V-04-01B | 04-01 | 1 | PROG-01, PROG-03 | migration removes old tables and adds new conflict/index contract | source assertion | `rg -n "progress|reading_progress|watching_progress|ON CONFLICT|updated_at" packages/db/src/schema.ts packages/db/drizzle/*.sql` | ✅ | ⬜ pending |
| V-04-02A | 04-02 | 2 | PROG-04, PROG-05 | movie seek/periodic save/completed semantics consistent across standard + `streamUrl` paths | unit + typecheck | `pnpm --filter @starye/movie-app test --run && pnpm --filter @starye/movie-app exec vue-tsc --noEmit` | ✅ | ⬜ pending |
| V-04-02B | 04-02 | 2 | PROG-04 | history/home/profile all consume explicit `completed` rather than guessing | source assertion | `rg -n "completed|progress >= 3600|0\\.9" apps/movie-app/src/views/Home.vue apps/movie-app/src/views/History.vue apps/movie-app/src/views/Profile.vue` | ✅ | ⬜ pending |
| V-04-03A | 04-03 | 2 | PROG-06, PROG-07, PROG-08 | Reader uses real chapter identity, 500ms debounce, pagehide flush, final-page complete | typecheck + targeted review | `pnpm --filter @starye/comic-app exec vue-tsc --noEmit` | ✅ | ⬜ pending |
| V-04-03B | 04-03 | 2 | PROG-08 | completed chapter reopens from page 1 while preserving stored last page | human + source assertion | `rg -n "completed|last page|pagehide|500" apps/comic-app/src/views/Reader.vue` | ✅ | ⬜ pending |
| V-04-04 | 04-04 | 3 | PROG-04..08 | auth gates redirect to `/auth/login?next=...`, migration verified, human restore flows pass | human + smoke | see `04-HUMAN-UAT.md` to be created in execution | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [x] Existing infrastructure already covers API route tests and app-local type checks.
- [x] No new framework install needed for this phase.
- [x] Human UAT will be required for pagehide / playback / reader reopen semantics.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 关闭 movie 标签页后再进同片，自动从上次位置恢复 | PROG-04, PROG-05 | 依赖真实 browser `pagehide` 和媒体事件 | 在执行阶段的 `04-HUMAN-UAT.md` 中用真实浏览器关闭/重开验证 |
| `streamUrl` / TorrServer 路径也能保存并恢复进度 | PROG-04, PROG-05 | 需要真实 Player + query param path | 通过 movie detail → TorrServer 播放路径验证 |
| comic 读到最后一页后再次打开回第一页 | PROG-06, PROG-08 | 依赖真实滚动与页面恢复行为 | 用真实 chapter 逐页滚到最后，关闭后重开验证 |
| 匿名访问 `/history` / comic 进度入口跳登录页并带 `next` | PROG-04..08 supporting gate | 需要真实 router navigation / window redirect | 浏览器中直接访问受保护路由及点击入口验证 |

## Validation Sign-Off

- [x] All planned work has an automated or source-assertable verification path
- [x] Manual-only behaviors are explicitly listed
- [x] Wave 0 dependencies are covered by existing test infrastructure
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
