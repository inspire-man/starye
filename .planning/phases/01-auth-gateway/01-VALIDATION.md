---
phase: 1
slug: auth-gateway
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 源自 `01-RESEARCH.md` §Validation Architecture（L393-453）。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4（各 app 独立配置） + Playwright ^1.59.1（E2E） |
| **Config file** | `apps/gateway/vitest.config.ts`、`apps/api/vitest.config.ts`、`apps/blog/playwright.config.ts`、`apps/dashboard/playwright.config.ts` |
| **Quick run command** | `pnpm --filter <affected> test`（单包 Vitest） |
| **Full suite command** | `pnpm -r test && pnpm --filter blog test:e2e && pnpm --filter dashboard test:e2e` |
| **Estimated runtime** | 快速 ~15s；全套 ~4-6 min（含 E2E） |

---

## Sampling Rate

- **After every task commit:** 运行受影响 package 的 `pnpm --filter <pkg> test`
- **After every plan wave:** `pnpm -r test`
- **Before `/gsd-verify-work`:** 全套必须绿 + 手动冒烟 6 步（D-19）全通过
- **Max feedback latency:** 单包快速 < 30s；全套 < 6 min

---

## Per-Task Verification Map

> 任务 ID 由 planner 在 PLAN.md 中分配；本表按需求 → 不变量 → 命令做锚定，planner 按 plan 拆出具体 task 时填入 Task ID 列。

| Requirement | Invariant | Test Type | Automated Command | File Exists | Status |
|-------------|-----------|-----------|-------------------|-------------|--------|
| AUTH-01 | 同 cookie 跨 5 个 app 读到同一 `user.id` | E2E | `pnpm --filter dashboard test:e2e -- auth-crosspath.spec.ts` | ❌ W0 | ⬜ pending |
| AUTH-02 | Nuxt blog SSR HTML 含已登录 user 标记（view-source 可见） | E2E | `pnpm --filter blog test:e2e -- session.spec.ts` | ❌ W0 | ⬜ pending |
| AUTH-03 | `/api/auth/sign-in/social/github` callback 响应 `Set-Cookie` 匹配 `starye.org`（或无 Domain 等价） | 手动 curl smoke | `curl -si ... \| grep 'Set-Cookie.*Domain'` | ✅ 手动 | ⬜ pending |
| AUTH-04 | 四 app `package.json` `better-auth` 解析到 `^1.6.10`；lockfile 一致；build 通过 | CI | `pnpm install --frozen-lockfile && pnpm -r build` | ✅ CI | ⬜ pending |
| AUTH-05 | Gateway proxy 后上游请求可见原 `Cookie` 头 | Unit | `pnpm --filter gateway test -- routing.test.ts` | ✅ 扩展 | ⬜ pending |
| AUTH-06 | Gateway `/api/auth/*` 任意路径返回 `X-Cache-Status: BYPASS` | Unit | `pnpm --filter gateway test -- cache-middleware.test.ts` | ✅ 扩展 | ⬜ pending |
| AUTH-07 | 带 `cookie` 或 `authorization` 头的请求 → `X-Cache-Status: BYPASS` + `X-Cache-Reason: auth-headers` + 不读不写 KV | Unit（D-11 四条） | `pnpm --filter gateway test -- cache-middleware.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-08 | `sign-out` 后再 `get-session` 返回 `null` + 响应带 `Set-Cookie` 清除头 | Unit/Integration | `pnpm --filter api test -- signout.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## D-11 Cache Bypass Test Matrix (AUTH-07 core)

> 落在 `apps/gateway/src/__tests__/cache-middleware.test.ts` — Wave 0 新增。

| # | Scenario | Request | Expected |
|---|----------|---------|----------|
| 1 | 无头 + public group | `GET /api/movies` 无 cookie、无 authorization | 首次 MISS，二次 HIT（既有行为不回归） |
| 2 | 带 session cookie + public group | `GET /api/movies` `cookie: starye.session_token=xxx` | `X-Cache-Status: BYPASS`；`X-Cache-Reason: auth-headers`；不写 KV |
| 3 | 带 Authorization + public group | `GET /api/movies` `authorization: Bearer xxx` | `X-Cache-Status: BYPASS`；`X-Cache-Reason: auth-headers`；不写 KV |
| 4 | `/api/auth/*` 双 case | `GET /api/auth/get-session`（有/无 cookie 两个子 case） | 都 BYPASS（`NO_STORE_PREFIXES` 命中，独立于 D-07） |

---

## Wave 0 Requirements

- [ ] `apps/gateway/src/__tests__/cache-middleware.test.ts` — 新增 D-11 四条 `it`（覆盖 AUTH-07、AUTH-06）
- [ ] `apps/blog/e2e/session.spec.ts` — 新建，覆盖 AUTH-02（SSR HTML 登录态 + 401 降级到匿名）
- [ ] `apps/dashboard/e2e/auth-crosspath.spec.ts` — 新建，覆盖 AUTH-01（登录后跨 `/movie → /comic → /blog → /dashboard` 读到同一 user.id）
- [ ] `apps/api/src/routes/auth/__tests__/signout.test.ts` — 新建（目录不存在则一并创建），覆盖 AUTH-08（sign-out 删 D1 session + 回 Set-Cookie 清除头）
- [ ] 手动冒烟 checklist（D-19 六步）以 Markdown 段落追加到 PLAN 或 `.planning/` 下的 RUNBOOK

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub OAuth 完整往返 | AUTH-01 / AUTH-03 | 需要真实 GitHub 第三方交互，CI 无法替身 | 从 `/auth/login` 点击 GitHub → 授权 → 断言跳回发起页 + 能读到 user |
| Nuxt SSR 首屏无登录态闪烁 | AUTH-02 | 视觉体感，E2E 截图难稳定 | DevTools Network 禁用 JS 访问 `/blog/` → 查看 HTML 是否已渲染登录态 |
| 跨 tab 登出自然回收 | AUTH-08 / D-16 | 多 tab 浏览器上下文 Playwright 可做但成本高 | Tab A 登出 → Tab B 发起带 cookie 请求 → 被 401 → 前端跳转 `/auth/login` |
| 冒烟 6 步（D-19） | AUTH-01..08 整体 | 作为 phase gate 最终签字 | 按 RESEARCH L445-452 六步顺序执行，记录通过状态 |

---

## Validation Sign-Off

- [ ] 所有 Plan 任务都有 `<automated>` verify 命令或被列入 Wave 0 新增清单
- [ ] 采样连续性：无 3 个连续任务没有自动化 verify（gateway unit 作为锚点）
- [ ] Wave 0 覆盖所有 ❌ MISSING 条目（cache-middleware D-11、blog session.spec、dashboard crosspath、api signout）
- [ ] 无 `--watch` / `test:watch` 常驻形态
- [ ] 快速反馈 < 30s；全套 < 6 min
- [ ] `nyquist_compliant: true` 设入 frontmatter（Wave 0 完成后由 verifier 更新）

**Approval:** pending
