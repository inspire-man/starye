---
phase: 02-dashboard
plan: "04"
subsystem: api/public-routes
tags: [adult-filter, access-control, bug-fix, tdd]
dependency_graph:
  requires: [02-01]
  provides: [buildAdultVisibilityCondition, search-r18-fix]
  affects: [apps/api/src/routes/public/movies, apps/api/src/routes/public/comics, apps/api/src/routes/public/search]
tech_stack:
  added: []
  patterns: [service-extraction, conditions-array-pattern, tdd-red-green]
key_files:
  created:
    - apps/api/src/services/adult-filter.ts
    - apps/api/src/services/__tests__/adult-filter.test.ts
  modified:
    - apps/api/src/routes/public/movies/index.ts
    - apps/api/src/routes/public/comics/index.ts
    - apps/api/src/routes/public/search/index.ts
decisions:
  - "genres handler 保留 sql 模板字符串模式（非 sql.raw，无注入风险），不改为 buildAdultVisibilityCondition"
  - "super_admin 角色加入豁免条件，与 checkUserAdultStatus 语义对齐（D-07）"
metrics:
  duration: "~10m"
  completed: "2026-05-11"
  tasks_completed: 2
  files_changed: 5
---

# Phase 02 Plan 04: Adult Filter Service + Public Routes 统一 Summary

新建 `buildAdultVisibilityCondition` 服务函数，统一注入所有 public handler 的 WHERE 条件，并修复 `search/index.ts` 的应用层过滤 bug（WHERE 子句两分支完全相同，r18Filter 未被 AND 进去）。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | 新建 adult-filter 单元测试 | 8b24300 | apps/api/src/services/__tests__/adult-filter.test.ts |
| 1 (GREEN) | 实现 buildAdultVisibilityCondition | 15b474f | apps/api/src/services/adult-filter.ts |
| 2 | 修改 public routes + 修复 search bug | 6792806 | movies/index.ts, comics/index.ts, search/index.ts |

## What Was Built

`apps/api/src/services/adult-filter.ts` 导出 `buildAdultVisibilityCondition(user, table)`：
- 匿名用户（undefined）→ `eq(table.isR18, false)`
- `isR18Verified=false` → `eq(table.isR18, false)`
- `isR18Verified=true` → `undefined`（无过滤）
- `role === 'admin'` → `undefined`（与 `checkUserAdultStatus` 对齐）
- `role === 'super_admin'` → `undefined`

**movies/index.ts**：6 处内联 `!user?.isR18Verified` 判断全部替换为 `buildAdultVisibilityCondition` 调用（list、fallBackToHot、recommended 主条件、fill 条件、actor 关联、series 关联、genre fallback）。genres handler 的 `sql` 模板字符串模式保留不变（非 sql.raw，无注入风险）。

**comics/index.ts**：list handler 的 R18 过滤替换为 `buildAdultVisibilityCondition`。

**search/index.ts（bug 修复）**：原代码 WHERE 子句两个分支完全相同（r18Filter 未被 AND 进去），然后在应用层 `.filter(m => !m.isR18)` 补救，导致 limit 语义错误。修复为 `and(adultCond, searchCond)` 在 WHERE 层过滤，删除应用层 filter。

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

- 6 个单元测试全部通过（ACCESS-04/07 覆盖）
- 全量 API 测试 300/300 通过

## Threat Flags

无新增安全面。所有修改均为 WHERE 条件注入，使用 Drizzle `eq()` 参数化查询，无 SQL 注入风险（T-02-04 mitigated）。search bug 修复消除了 T-02-12（应用层过滤绕过）。

## Self-Check: PASSED

- ✓ adult-filter.ts 存在
- ✓ adult-filter.test.ts 存在
- ✓ Commit 8b24300 存在（RED test）
- ✓ Commit 15b474f 存在（GREEN implementation）
- ✓ Commit 6792806 存在（Task 2 routes）
