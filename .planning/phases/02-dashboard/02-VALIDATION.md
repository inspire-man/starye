---
phase: 2
slug: dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 |
| **Config file** | `apps/api/vitest.config.ts` (API), `apps/gateway/vitest.config.ts` (Gateway — Wave 0 新建) |
| **Quick run command** | `pnpm --filter @starye/api test --run` |
| **Full suite command** | `pnpm --filter @starye/api test --run && pnpm --filter @starye/gateway test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @starye/api test --run`
- **After every plan wave:** Run `pnpm --filter @starye/api test --run && pnpm --filter @starye/gateway test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | ACCESS-01 | T-02-02 | 未登录访问 /dashboard/* 返回 302 /auth/login?next=... | unit | `pnpm --filter @starye/gateway test --run` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | ACCESS-02 | T-02-02 | 非白名单账号被拒绝，白名单账号通过 | unit | `pnpm --filter @starye/gateway test --run` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | ACCESS-03 | T-02-01 | /api/admin/* 无 session 返回 401 | unit | `pnpm --filter @starye/api test --run` | ✅ (guard.test.ts 已有) | ⬜ pending |
| TBD | TBD | 0 | ACCESS-04 | — | 匿名用户可访问 /api/public/movies | unit | `pnpm --filter @starye/api test --run` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | ACCESS-07 | T-02-04 | 匿名用户 list 响应不含 isR18=true | unit | `pnpm --filter @starye/api test --run` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | PUBSEC-01 | — | GET /robots.txt 返回正确 disallow 规则 | unit | `pnpm --filter @starye/gateway test --run` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | PUBSEC-02 | — | /dashboard/* 响应含 X-Robots-Tag: noindex, nofollow | unit | `pnpm --filter @starye/gateway test --run` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | PUBSEC-04 | T-02-06 | 匿名访问 /api/docs 返回 401 | unit | `pnpm --filter @starye/api test --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/gateway/vitest.config.ts` — Gateway 目前无 vitest 配置，需新建
- [ ] `apps/gateway/src/__tests__/dashboard-guard.test.ts` — 覆盖 ACCESS-01/02/PUBSEC-01/02
- [ ] `apps/api/src/services/__tests__/adult-filter.test.ts` — 覆盖 ACCESS-04/07
- [ ] `apps/api/src/__tests__/docs-auth.test.ts` — 覆盖 PUBSEC-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| *.pages.dev 返回 301 | PUBSEC-05 | 跨域 DNS 配置，无法在单元测试中模拟 | 浏览器访问 `https://starye-movie.pages.dev/` 确认 301 到 `https://starye.org/movie/` |
| WAF 限速生效 | PUBSEC-03 | Cloudflare Dashboard 手配，无 API | Cloudflare Dashboard → Security → WAF → Rate Limiting Rules 确认规则存在 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
