---
phase: 02-dashboard
plan: "03"
subsystem: gateway
tags: [access-control, auth-guard, robots-txt, x-robots-tag, vitest, tdd]
dependency_graph:
  requires: [02-01]
  provides: [dashboard-auth-guard, robots-txt, x-robots-tag-injection]
  affects: [apps/gateway]
tech_stack:
  added: [vitest gateway config]
  patterns: [L1 session cache Map, fail-closed auth, X-Robots-Tag injection, robots.txt route]
key_files:
  created:
    - apps/gateway/src/dashboard-guard.ts
    - apps/gateway/vitest.config.ts
    - apps/gateway/src/__tests__/dashboard-guard.test.ts
  modified:
    - apps/gateway/src/index.ts
    - apps/gateway/wrangler.toml
    - apps/gateway/src/__tests__/routing.test.ts
decisions:
  - "L1 缓存 key 使用完整 sessionToken（非 userId），不同用户 token 不同，避免混淆（T-02-01）"
  - "fetch 失败时 fail-closed 返回 no_session，拒绝访问（T-02-02）"
  - "X-Robots-Tag 注入在 proxy() 函数内，对 /dashboard/* 和 /api/admin/* 生效"
  - "routing.test.ts 中 3 个 dashboard 测试更新为携带 session cookie + 双阶段 fetch mock"
metrics:
  duration: "10m 8s"
  completed: "2026-05-11T08:44:28Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 2 Plan 03: Gateway Dashboard 鉴权守卫 + SEO 防护 Summary

Gateway Worker 层前置拦截 `/dashboard/*`，通过 L1 session 缓存 + fetch `/api/auth/get-session` 验证 `user.githubId` 白名单，并统一提供 `/robots.txt` 和 `X-Robots-Tag` 响应头注入。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | 新建测试文件 + vitest 配置 | 4eac13c | `dashboard-guard.test.ts`, `vitest.config.ts` |
| 1 (GREEN) | 实现 dashboard-guard.ts | 67c763a | `dashboard-guard.ts` |
| 2 | 接入 index.ts + wrangler.toml + 修复 routing 测试 | df5b2c7 | `index.ts`, `wrangler.toml`, `routing.test.ts` |

## What Was Built

**`apps/gateway/src/dashboard-guard.ts`**
- 导出 `checkDashboardAuth`、`isInAdminWhitelist`、`DashboardAuthResult`
- 模块级 `sessionCache` Map，TTL 30s（D-02 L1 缓存）
- cookie 正则 `/starye\.session_token=([^;]+)/` 匹配 Better Auth cookie 前缀
- fetch 失败时 fail-closed 返回 `no_session`（T-02-02）
- `isInAdminWhitelist` 支持逗号分隔多个 GitHub ID，含 trim 处理

**`apps/gateway/src/index.ts`**
- `Env` 接口新增 `ADMIN_GITHUB_ID?: string`
- `/robots.txt` 路由在所有 proxy 分支之前（D-15）
- `/dashboard/*` 分支在 `cachedProxy` 前调用 `checkDashboardAuth`（D-01）
- 未登录 302 → `/auth/login?next=<encoded_path>`
- 非白名单 302 → `/auth/login?error=not_admin&next=<encoded_path>`
- `proxy()` 函数对 `/dashboard/*` 和 `/api/admin/*` 注入 `X-Robots-Tag: noindex, nofollow`（D-15）

**`apps/gateway/vitest.config.ts`**
- node 环境，include `src/**/*.test.ts`

## Test Results

```
Test Files  4 passed (4)
     Tests  54 passed (54)
```

覆盖：`isInAdminWhitelist` 5 cases + `checkDashboardAuth` 5 cases（ACCESS-01/02/PUBSEC-01/02）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 修复 routing.test.ts 中 3 个 dashboard 测试**
- **Found during:** Task 2
- **Issue:** 现有 routing 测试对 `/dashboard/*` 不携带 session cookie，新增鉴权后返回 302 而非 proxy，导致 `capturedRequest` 为 null
- **Fix:** 更新 3 个测试用例，携带 `starye.session_token` cookie，并使用双阶段 fetch mock（第一次返回 admin session，第二次捕获 proxy 请求）
- **Files modified:** `apps/gateway/src/__tests__/routing.test.ts`
- **Commit:** df5b2c7

**2. [Rule 1 - Bug] 移除 `any` 类型注解**
- **Found during:** Task 1 GREEN commit（pre-commit ESLint hook）
- **Issue:** `let data: any` 触发 `@typescript-eslint/no-explicit-any` 错误
- **Fix:** 改为 `let data: { user?: { githubId?: string | number } } | null = null`
- **Files modified:** `apps/gateway/src/dashboard-guard.ts`
- **Commit:** 67c763a

## Known Stubs

None — 所有功能均已完整实现并通过测试。

## Threat Flags

无新增安全面超出 plan 的 `<threat_model>` 范围。

## TDD Gate Compliance

- RED gate: `test(02-03)` commit 4eac13c — 测试文件创建，确认失败（`Cannot find module '../dashboard-guard'`）
- GREEN gate: `feat(02-03)` commit 67c763a — 实现通过，54 tests pass

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `apps/gateway/src/dashboard-guard.ts` | FOUND |
| `apps/gateway/vitest.config.ts` | FOUND |
| `apps/gateway/src/__tests__/dashboard-guard.test.ts` | FOUND |
| `.planning/phases/02-dashboard/02-03-SUMMARY.md` | FOUND |
| commit 4eac13c (RED) | FOUND |
| commit 67c763a (GREEN) | FOUND |
| commit df5b2c7 (Task 2) | FOUND |
