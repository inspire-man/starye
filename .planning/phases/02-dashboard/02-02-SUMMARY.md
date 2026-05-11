---
phase: 02-dashboard
plan: "02"
subsystem: api/middleware
tags: [requireAuth, admin-whitelist, openapi-docs, security, tdd]
dependency_graph:
  requires: [02-01]
  provides: [api-admin-whitelist, api-docs-protection]
  affects: [02-03]
tech_stack:
  added: []
  patterns: [middleware-short-circuit, env-backed-whitelist, route-level-guard]
key_files:
  created:
    - apps/api/src/middleware/__tests__/guard.test.ts
    - apps/api/src/__tests__/docs-auth.test.ts
  modified:
    - apps/api/src/middleware/guard.ts
    - apps/api/src/index.ts
    - apps/api/wrangler.toml
decisions:
  - "白名单短路位于 role 检查之前：D-04 要求 ADMIN_GITHUB_ID 命中即视为 super_admin，不依赖 DB role，避免 role 字段被篡改后失去 admin 能力"
  - "/api/docs 和 /api/openapi.json 使用 requireAuth(['admin', 'super_admin']) 而非独立 env 开关：D-17 要求本地开发和生产环境统一保护，白名单用户通过 D-04 短路自动通过"
  - "ADMIN_GITHUB_ID 通过 wrangler secret put 注入而非在 wrangler.toml 明文配置：避免秘钥进入 git 历史，T-02-10 mitigation"
  - "docs-auth.test.ts 使用 vi.mock 替换 createAuth 和 createDb：避免真实 D1 binding 依赖，使 app.fetch 可在 Node.js 环境直接运行"
metrics:
  duration: "~45min"
  completed: "2026-05-11"
  tasks_completed: 2
  files_changed: 5
---

# Phase 02 Plan 02: API 白名单短路 + /api/docs 鉴权 Summary

API Worker 的 `requireAuth` 中间件加入 `ADMIN_GITHUB_ID` 白名单短路分支，作者账号命中白名单即自动通过所有 admin 路由检查。同时 `/api/docs` 和 `/api/openapi.json` 加 `requireAuth(['admin', 'super_admin'])` 保护，匿名用户访问返回 401。

## Tasks Completed

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 RED | requireAuth 白名单失败测试 | 2ecdafa | apps/api/src/middleware/__tests__/guard.test.ts |
| 1 GREEN | guard.ts 白名单短路 + wrangler.toml 注释 | 98e5730 | apps/api/src/middleware/guard.ts, apps/api/wrangler.toml |
| 2 RED | /api/docs 401 失败测试 | ffe3395 | apps/api/src/__tests__/docs-auth.test.ts |
| 2 GREEN | /api/docs 和 /api/openapi.json 加 requireAuth | dfa3196 | apps/api/src/index.ts |

## What Was Built

### D-04: ADMIN_GITHUB_ID 白名单短路

`requireAuth` 中间件在 `if (requiredRole)` 分支内、`user.role === 'super_admin'` 判断之前插入白名单短路逻辑：

```typescript
// D-04：ADMIN_GITHUB_ID 白名单命中即视为 super_admin，覆盖 DB role
if (user.githubId) {
  const adminIds = c.env.ADMIN_GITHUB_ID
  if (adminIds && adminIds.split(',').map((s: string) => s.trim()).includes(String(user.githubId))) {
    await next()
    return
  }
}
```

- 支持单个 ID（`"12345678"`）或逗号分隔多个（`"12345,67890"`）
- 自动 `trim()` ID 前后的空格
- `ADMIN_GITHUB_ID` 未配置 / `user.githubId` 为 `null` 时短路不生效，回退到原有 role 检查
- `String(user.githubId)` 防御类型不一致（Better Auth 返回的 accountId 永远是 string，但防御式编码）

### D-17: /api/docs 鉴权保护

`apps/api/src/index.ts` 为 `/api/openapi.json` 和 `/api/docs` 两个路由插入 `requireAuth(['admin', 'super_admin'])` 中间件。匿名用户返回 401，白名单用户通过 D-04 短路自动通过。

### wrangler.toml secret 声明

`apps/api/wrangler.toml` 在 `[vars]` 块末尾追加 `ADMIN_GITHUB_ID` 使用说明注释（不写明文值），提醒通过 `wrangler secret put` 或 `.dev.vars` 注入。

## Decisions Made

1. **白名单短路位于 role 检查之前**：D-04 明确要求 `ADMIN_GITHUB_ID` 命中即视为 `super_admin`，不依赖 DB role。如果放在 role 之后，当作者账号的 DB role 被误改或被攻击者降级，作者将失去 admin 能力；放在之前则 env var 成为最终兜底，避免单点失效。

2. **统一用 requireAuth 保护 /api/docs 而非独立 env 开关**：D-17 要求本地和生产环境统一保护。独立开关（如 `DOCS_AUTH_ENABLED`）会在本地开发时容易被关闭，留下"开发正常、上线泄露"的风险。用 requireAuth 配合 D-04 白名单短路，作者账号始终可访问，匿名/非 admin 始终被拒。

3. **ADMIN_GITHUB_ID 通过 secret 而非明文配置**：即使 GitHub ID 本身不是敏感信息，但允许修改 wrangler.toml 的攻击者可以把自己的 ID 加进去。`wrangler secret put` 走的是独立秘密管理，不在 git 历史留痕（T-02-10 mitigation）。

4. **docs-auth.test.ts 使用 vi.mock 而非真实 D1**：测试 `/api/docs` 路由必须启动完整 app，但 `authMiddleware` 和 `databaseMiddleware` 都会调用 `createAuth`（需要真实 D1）。用 `vi.mock('../lib/auth')` 把 `createAuth` 替换为返回 `getSession: null` 的 mock，避免测试依赖 D1，也不需要构造完整 Better Auth 实例。

## Verification

**单元测试**（全部通过）：

- `guard.test.ts`：10/10 通过
  - 匿名用户 401（1）
  - role 不匹配 403 / admin 通过 / super_admin 通过（3）
  - 白名单命中 200（即使 role=user）（1）
  - 白名单不命中 403（1）
  - ADMIN_GITHUB_ID 未配置时短路不生效（1）
  - githubId=null 时短路不生效（1）
  - 逗号分隔多 ID 支持（1）
  - ID 前后有空格时仍能匹配（1）
- `docs-auth.test.ts`：2/2 通过
  - 匿名访问 `/api/docs` → 401
  - 匿名访问 `/api/openapi.json` → 401

**TypeScript 检查**：`guard.ts` 和 `index.ts` 无类型错误。worktree 其它文件存在 pre-existing `implicit any` 错误（主要在 `admin/actors/index.ts`、`audit-logger.ts` 等），与本 plan 无关，已记录在 `.planning/phases/02-dashboard/deferred-items.md`（见下）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] worktree 缺少 node_modules**

- **Found during:** Task 1 RED 阶段运行测试
- **Issue:** Git worktree（`.claude/worktrees/agent-.../`）没有自己的 node_modules，Node.js 无法解析 `hono`、`@starye/db` 等包。Vitest 直接报 `Cannot find package 'hono'`。
- **Fix:** 用 PowerShell `New-Item -ItemType Junction` 在 worktree 创建两个 Windows junction：
  - `apps/api/node_modules` → `D:\my-workspace\starye\apps\api\node_modules`
  - `packages/db/dist` → `D:\my-workspace\starye\packages\db\dist`
  这让 Node.js 的 `node_modules` 向上查找机制能正确定位到主仓库的依赖。所有 12 个单元测试随即通过。
- **Files modified:** 文件系统 junction，无 git tracked 变更
- **Note:** 这是 worktree 基础设施问题，不影响 plan 交付物。主仓库合并后，正常 `pnpm install` 即可。

没有其他偏离——plan 按书面执行。

## Deferred Issues

Pre-existing worktree TypeScript `implicit any` 错误（非本 plan 引入）：

- `apps/api/src/routes/admin/actors/index.ts` — 多处 callback 参数缺类型注解
- `apps/api/src/middleware/audit-logger.ts` — Drizzle `where` callback 参数缺类型注解
- `apps/api/src/routes/admin/audit-logs/index.ts`
- `apps/api/src/routes/admin/chapters/handlers.ts`
- `apps/api/src/routes/movies/services/*.ts`
- `apps/api/src/routes/public/*/index.ts`

主仓库 `tsc --noEmit` 通过，这些错误仅在 worktree 出现，可能与 `tsconfig.json` 路径解析或 `packages/db` 构建产物有关。不影响本 plan 交付物（`guard.ts` 和 `index.ts` 均通过检查）。

## Known Stubs

None.

## Threat Flags

None 新增。`guard.ts` 白名单短路已按 T-02-01 mitigation 实施：`String()` 强制类型一致、`split/trim` 处理空格、env 未配置时自动回退。`/api/docs` 保护已按 T-02-06 mitigation 实施：匿名 401、admin 200。`wrangler.toml` 不含明文 secret，按 T-02-10 mitigation 通过 `wrangler secret put` 注入。

## TDD Gate Compliance

- RED gate for Task 1: `2ecdafa` — test commit precedes feat
- GREEN gate for Task 1: `98e5730` — feat commit after RED
- RED gate for Task 2: `ffe3395` — test commit precedes feat
- GREEN gate for Task 2: `dfa3196` — feat commit after RED

所有 TDD 门禁顺序符合要求。

## Self-Check: PASSED

- apps/api/src/middleware/guard.ts: FOUND (modified)
- apps/api/src/middleware/__tests__/guard.test.ts: FOUND (created)
- apps/api/src/index.ts: FOUND (modified)
- apps/api/src/__tests__/docs-auth.test.ts: FOUND (created)
- apps/api/wrangler.toml: FOUND (modified)
- commit 2ecdafa: FOUND
- commit 98e5730: FOUND
- commit ffe3395: FOUND
- commit dfa3196: FOUND
