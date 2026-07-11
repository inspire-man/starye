---
phase: 02-dashboard
plan: "01"
subsystem: api/auth
tags: [better-auth, session, github-oauth, tdd]
dependency_graph:
  requires: []
  provides: [githubId-in-session]
  affects: [02-02, 02-03]
tech_stack:
  added: []
  patterns: [better-auth-additionalFields, callbacks-session, pure-function-extraction]
key_files:
  created:
    - apps/api/src/lib/__tests__/auth.test.ts
  modified:
    - apps/api/src/lib/auth.ts
    - apps/api/src/types.ts
decisions:
  - "将 githubId 注入逻辑提取为纯函数 injectGithubIdIntoSession，便于单元测试，避免 mock 整个 Better Auth 实例"
  - "githubId 查询失败或无 GitHub account 时返回 null，不抛异常，保证 session 稳定性"
metrics:
  duration: "~15min"
  completed: "2026-05-11"
  tasks_completed: 2
  files_changed: 3
---

# Phase 02 Plan 01: Session githubId 注入 Summary

Better Auth session callback 通过查询 account 表注入 githubId 字段，为 Gateway 白名单判断（Plan 03）和 API requireAuth 短路（Plan 02）提供数据基础。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | 新建 auth.test.ts 失败测试 | d8725d1 | apps/api/src/lib/__tests__/auth.test.ts |
| GREEN | 扩展 auth.ts + types.ts 实现注入 | e513e37 | apps/api/src/lib/auth.ts, apps/api/src/types.ts |

## What Was Built

`injectGithubIdIntoSession` 纯函数从 account 表查询 `providerId='github'` 的 `accountId`，在 `callbacks.session` 中注入到 session user 对象。`SessionUser` 类型新增 `githubId?: string | null`，`Env` 接口新增 `ADMIN_GITHUB_ID?: string`。

## Decisions Made

1. **纯函数提取**：将 githubId 注入逻辑提取为 `injectGithubIdIntoSession`，避免 mock 整个 Better Auth 实例，使单元测试简洁可靠。
2. **null 而非 undefined**：无 GitHub account 时返回 `null`（`??` 运算符），与 JSON 序列化行为一致，下游可用 `user.githubId != null` 判断。
3. **不抛异常**：查询失败时 `findFirst` 返回 `undefined`，`??` 兜底为 `null`，session 不中断。

## Verification

- TypeScript 编译：`auth.ts` 和 `types.ts` 无类型错误（其余文件的 pre-existing 错误不在本 plan 范围内）
- 单元测试：4/4 通过（有 GitHub account、无 GitHub account、空 accountId、createAuth 基础验证）

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None - 查询使用 Drizzle ORM 参数化查询（`eq(a.userId, user.id)`），满足 T-02-01 mitigation 要求。

## Self-Check: PASSED

- apps/api/src/lib/auth.ts: FOUND
- apps/api/src/types.ts: FOUND
- apps/api/src/lib/__tests__/auth.test.ts: FOUND
- commit d8725d1: FOUND
- commit e513e37: FOUND
