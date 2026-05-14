---
phase: 1
slug: auth-gateway
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for auth/session continuity, Gateway cache bypass, and sign-out invalidation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (API / Gateway) + Playwright (blog / dashboard E2E) + manual smoke checklist |
| **Config file** | `apps/gateway/vitest.config.ts`, `apps/api/vitest.config.ts`, `apps/blog/playwright.config.ts`, `apps/dashboard/playwright.config.ts` |
| **Quick run command** | `cd apps/gateway && pnpm test src/__tests__/cache-middleware.test.ts` or `cd apps/api && pnpm test --run src/routes/auth/__tests__/signout.test.ts` |
| **Full suite command** | `pnpm -r test && pnpm --filter blog test:e2e && pnpm --filter dashboard test:e2e` |
| **Estimated runtime** | targeted unit ~1-5s; full Phase 1 matrix ~4-6 min including E2E + manual gate |

---

## Sampling Rate

- **After every task commit:** run the narrowest affected package tests first.
- **After every plan wave:** rerun the related package matrix for that wave.
- **Before `$gsd-verify-work`:** all automated checks must be green and D-19 six-step smoke checklist must be signed off.
- **Max feedback latency:** < 30s for targeted unit checks; E2E and manual OAuth smoke may exceed.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure / Stable Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|--------------------------|-----------|-------------------|-------------|--------|
| V-01-01A | 01-02 | 1 | AUTH-06, AUTH-07 | `/api/auth/*` 与带 `Cookie` / `Authorization` 的请求一律 BYPASS，且不写 KV | unit | `cd apps/gateway && pnpm test src/__tests__/cache-middleware.test.ts` | ✅ | ✅ passed |
| V-01-01B | 01-02 | 1 | AUTH-05 | Gateway 透传上游 Cookie / Set-Cookie 语义不回退 | source assertion + unit | `cd apps/gateway && pnpm test src/__tests__/routing.test.ts` and cache bypass assertions in `cache-middleware.test.ts` | ✅ | ✅ passed |
| V-01-02 | 01-03 | 2 | AUTH-01, AUTH-02 | blog/auth SSR 在首屏即读取 session，Hydrate 不重复拉取 | E2E | `pnpm --filter blog test:e2e -- session.spec.ts` | ✅ | ✅ passed (see `01-VERIFICATION.md`) |
| V-01-03 | 01-06 | 3 | AUTH-01 | dashboard 跨路径读取同一 session，`sessionRequests` 计数器真实递增 | E2E | `pnpm --filter dashboard test:e2e -- auth-crosspath.spec.ts` | ✅ | ✅ passed (see `01-VERIFICATION.md`) |
| V-01-04 | 01-04 | 2 | AUTH-04 | 四个前端/API package 全部解析到 `better-auth ^1.6.10`，lockfile 一致 | source / CI assertion | `rg -n '"better-auth": "\\^1\\.6\\.10"' apps/api/package.json apps/auth/package.json apps/blog/package.json apps/dashboard/package.json` and `rg -n 'better-auth@1\\.6\\.10' pnpm-lock.yaml` | ✅ | ✅ passed |
| V-01-05 | 01-05 | 2 | AUTH-08 | `sign-out` 后 session 被服务端失效，响应带清除 cookie 头 | unit | `cd apps/api && pnpm test --run src/routes/auth/__tests__/signout.test.ts` | ✅ | ✅ passed |
| V-01-06 | 01-06 | 3 | AUTH-03 | cookie domain / SameSite / Secure / Path 属性符合目标行为（接受 `starye.org` 无前导点等价实现） | manual-only | see `01-SMOKE-CHECKLIST.md` step 2 | ✅ | ✅ passed |

*Status: ⬜ pending · ✅ passed · ⚠️ manual-only*

---

## Wave 0 Requirements

- [x] `apps/gateway/src/__tests__/cache-middleware.test.ts` 已存在并覆盖 D-11 BYPASS 核心矩阵
- [x] `apps/blog/e2e/session.spec.ts` 已存在且为活用例，不是占位/skip
- [x] `apps/dashboard/e2e/auth-crosspath.spec.ts` 已存在且为活用例，使用 `sessionRequests` 计数器
- [x] `apps/api/src/routes/auth/__tests__/signout.test.ts` 已存在并覆盖 D-15 sign-out 行为
- [x] `01-SMOKE-CHECKLIST.md` 已存在并记录 D-19 六步人工冒烟签字

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub OAuth 完整往返 | AUTH-01, AUTH-03 | 依赖真实 GitHub 第三方交互，不适合在本地单测中替身 | 见 `01-SMOKE-CHECKLIST.md` step 2 |
| Nuxt SSR 首屏无登录态闪烁的真实体感 | AUTH-02 | 视觉与浏览器行为确认 | 见 `01-SMOKE-CHECKLIST.md` step 5 |
| 跨 tab 登出自然回收 | AUTH-08 | 真实浏览器多 tab 行为 | 见 `01-SMOKE-CHECKLIST.md` step 6 |

---

## Validation Audit 2026-05-14

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

本次没有发现新的 Nyquist 覆盖缺口。原文档中的所有 `pending / W0` 条目都已被当前代码与 `01-VERIFICATION.md` 证据覆盖；它们属于文档陈旧，而非当前缺测。

已重新确认的关键证据：

- `cd apps/gateway && pnpm test src/__tests__/cache-middleware.test.ts` → `9/9 passed`
- `cd apps/api && pnpm test --run src/routes/auth/__tests__/signout.test.ts` → `3/3 passed`
- `apps/blog/e2e/session.spec.ts` 为 3 条活用例，包含 SSR、超时降级、hydrate request 计数
- `apps/dashboard/e2e/auth-crosspath.spec.ts` 为 1 条活用例，使用 `sessionRequests` 计数器而非恒真断言
- `01-VERIFICATION.md` 已将 AUTH-01..08 标记为全部 `SATISFIED`

---

## Validation Sign-Off

- [x] All planned work has automated verification or explicit manual-only coverage
- [x] No Wave 0 placeholder remains unresolved
- [x] Manual-only behaviors are explicitly listed and already signed off in `01-SMOKE-CHECKLIST.md`
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated coverage complete; manual smoke gate signed in `01-SMOKE-CHECKLIST.md` on 2026-05-11
