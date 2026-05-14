---
phase: 2
slug: dashboard
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for dashboard access control, public-route gating, and public exposure hardening.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest across API / Gateway / movie-app / comic-app / crawler |
| **Config file** | `apps/api/vitest.config.ts`（implicit via package）, `apps/gateway/vitest.config.ts`, `apps/movie-app/vitest.config.ts`, `apps/comic-app/vitest.config.ts`, `packages/crawler/vitest.config.ts` |
| **Quick run command** | Run the narrowest package-level suite from the Per-Task Verification Map below |
| **Full suite command** | Targeted phase matrix: API auth/public tests + Gateway routing tests + movie/comic auth-guard tests + crawler R18 tagging test |
| **Estimated runtime** | Targeted checks ~1-10s per package; full Phase 2 matrix ~20-40s on current workspace |

---

## Sampling Rate

- **After every task commit:** run the narrowest affected package tests first.
- **After every plan wave:** rerun the relevant package matrix for that wave.
- **Before `$gsd-verify-work`:** all automated checks must be green and manual-only platform checks must be recorded.
- **Max feedback latency:** < 30s for automated checks; platform-level checks may remain manual-only.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure / Stable Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|--------------------------|-----------|-------------------|-------------|--------|
| V-02-01 | 02-01 | 1 | ACCESS-02 | Better Auth session 响应稳定注入 `githubId`，为后续白名单判定提供输入 | unit | `cd apps/api && pnpm test --run src/lib/__tests__/auth.test.ts` | ✅ | ✅ passed |
| V-02-02 | 02-02 | 2 | ACCESS-03, PUBSEC-04 | `requireAuth` 白名单短路与 `/api/docs` / `/api/openapi.json` 鉴权保护可自动验证 | unit | `cd apps/api && pnpm test --run src/middleware/__tests__/guard.test.ts src/__tests__/docs-auth.test.ts` | ✅ | ✅ passed |
| V-02-03 | 02-03 | 2 | ACCESS-01, ACCESS-02, PUBSEC-01, PUBSEC-02 | Gateway 对 `/dashboard/*` 的 302 门控、`/robots.txt`、`X-Robots-Tag` 注入行为可自动验证 | unit | `cd apps/gateway && pnpm test src/__tests__/dashboard-guard.test.ts src/__tests__/routing.test.ts` | ✅ | ✅ passed |
| V-02-04 | 02-04 | 2 | ACCESS-04, ACCESS-07 | 匿名公开路由仍可访问，同时 R18 过滤与 search WHERE 修复保持成立 | unit + source assertion | `cd apps/api && pnpm test --run src/services/__tests__/adult-filter.test.ts src/routes/public/movies/__tests__/genres.test.ts src/routes/public/series/__tests__/series.test.ts` | ✅ | ✅ passed |
| V-02-04B | 02-04 | 2 | ACCESS-07 | search 不再依赖应用层 `.filter(m => !m.isR18)`，而是 WHERE 层 `and(adultCond, searchCond)` | source assertion | `rg -n "and\\(adultCond, searchCond\\)|filter\\(m => !m\\.isR18\\)" apps/api/src/routes/public/search/index.ts` | ✅ | ✅ passed |
| V-02-05 | 02-05 | 2 | ACCESS-05 | movie/comic 收藏入口的匿名访问被重定向到 `/auth/login?next=...` | unit | `cd apps/movie-app && pnpm test --run src/composables/__tests__/useAuthGuard.test.ts` and `cd apps/comic-app && pnpm test --run src/composables/__tests__/useAuthGuard.test.ts` | ✅ | ✅ passed |
| V-02-06 | 02-04, 02-06 | 2-3 | ACCESS-06 | crawler 在源站成人内容页上稳定写出 `isR18=true`，保持 ingest-time 成人标记契约 | unit | `cd packages/crawler && pnpm test --run src/strategies/__tests__/r18-tagging.test.ts` | ✅ | ✅ passed |
| V-02-07 | 02-06 | 3 | PUBSEC-03 | WAF 限速规则在 Cloudflare 平台侧存在并生效 | manual-only | 见 `02-HUMAN-UAT.md` 与 `RUNBOOK.md` | ✅ | ✅ passed |
| V-02-08 | 02-06 | 3 | PUBSEC-05 | live `*.pages.dev` 入口 301 回 `starye.org/<app>/`，且 `_redirects` 静态规则顺序正确 | manual + static assertion | `_redirects` grep/head 检查 + `02-HUMAN-UAT.md` | ✅ | ✅ passed |

*Status: ⬜ pending · ✅ passed · ⚠️ manual-only*

---

## Wave 0 Requirements

- [x] Gateway Vitest infrastructure already exists and is green.
- [x] API route / middleware tests for white-list / docs auth / adult filter already exist and are green.
- [x] movie-app / comic-app auth-guard tests already exist and are green.
- [x] crawler-side `ACCESS-06` gap has been filled with strategy-level R18 tagging tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cloudflare WAF `starye-signin-ratelimit` 规则存在并返回 429 | PUBSEC-03 | 平台资源，不在本地测试进程内 | 见 `RUNBOOK.md` 与 `02-HUMAN-UAT.md` 中的 WAF 检查步骤 |
| `*.pages.dev` 真实浏览器 301 到 `starye.org/<app>/` | PUBSEC-05 | 依赖真实 Cloudflare Pages 域名和浏览器重定向行为 | 见 `02-HUMAN-UAT.md` 与 `_redirects` 文件检查 |

---

## Validation Audit 2026-05-14

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

唯一真实自动化缺口是 `ACCESS-06`。本次已通过新增 `packages/crawler/src/strategies/__tests__/r18-tagging.test.ts` 关闭。其余旧 `pending` 项属于文档陈旧，而非当前代码库缺测。

---

## Validation Sign-Off

- [x] All planned work has automated verification or explicit manual-only coverage
- [x] Previously stale `pending` map has been reconciled with current tests and artifacts
- [x] Manual-only platform checks are explicitly listed and already recorded in `02-HUMAN-UAT.md`
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated coverage complete; manual-only platform checks recorded in `02-HUMAN-UAT.md` on 2026-05-14
