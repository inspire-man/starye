---
phase: 01-auth-gateway
plan: 01
subsystem: test-scaffold
tags: [auth, cache, nyquist, test-scaffold, e2e, unit]
dependency_graph:
  requires: []
  provides:
    - D-11 四条 it.todo（Plan 02 接骨架填 gateway cache bypass 断言）
    - apps/blog/e2e/session.spec.ts（Plan 03 接骨架填 Nuxt SSR 会话通道）
    - apps/dashboard/e2e/auth-crosspath.spec.ts（Plan 06 接骨架填跨路径冒烟）
    - apps/api/src/routes/auth/__tests__/signout.test.ts + createApp helper（Plan 05 接骨架填 sign-out 服务端失效）
  affects:
    - apps/gateway/src/__tests__/cache-middleware.test.ts（仅追加，未删除既有 it）
tech_stack:
  added: []
  patterns:
    - Vitest `it.todo(title)` 用作单元测试 Nyquist 采样点；`.todo` 计入总数但不执行
    - Playwright `test.skip(title, fn)` 用作 e2e Nyquist 采样点；生成 skipped 计数，下游仅需删 `.skip`
    - Hono 单测 app 工厂（`createApp(db, auth, user?)`）模式，源自 `apps/api/src/routes/public/progress/__tests__/progress.test.ts:83-94`
    - e2e 重复定义 `mockSession` / `interceptExternalRedirects`，避免 Playwright config 跨 spec import 风险（与 `apps/dashboard/e2e/auth-flow.spec.ts:14-32` 保持同款）
key_files:
  created:
    - apps/blog/e2e/session.spec.ts
    - apps/dashboard/e2e/auth-crosspath.spec.ts
    - apps/api/src/routes/auth/__tests__/signout.test.ts
    - .planning/phases/01-auth-gateway/deferred-items.md
  modified:
    - apps/gateway/src/__tests__/cache-middleware.test.ts
decisions:
  - 骨架用 `it.todo` / `test.skip` 而非空断言 `it(...)`，确保 runner 不会假阳性通过
  - 在 `it.todo` 外围加 `eslint-disable test/prefer-lowercase-title` 注释，保护 `D-11 #N` / `D-15 #N` 矩阵编号不被 lint-staged 自动小写化
  - 不在 `apps/api/src/test/helpers.ts` 新增 `createApp` —— 而是把它 export 自 `signout.test.ts`，避免污染跨测试共享模块
  - 在 signout 骨架里 mock `authInstance.handler`（后续 Plan 05 填），不引入 better-auth + libsql 集成栈
  - Pre-existing `apps/api` type-check 失败（TS6305 缺 `packages/db/dist` + 若干 TS7006 在无关 route 文件）不在本 plan 范围；记录到 `deferred-items.md` DI-01
metrics:
  duration: 约 8 分钟（不含 pnpm install 首次拉包 2m41s）
  completed: 2026-05-11
  tasks_completed: 3
  files_touched: 5
  commits: 4
  tests_added: 11（7 skeleton：4 it.todo gateway + 3 it.todo signout；4 playwright skipped：3 blog + 1 dashboard）
---

# Phase 1 Plan 1: Nyquist 测试骨架 Summary

Nyquist 采样点先行：在 Phase 1 所有需要验证的不变量位置预先落下 11 条 todo/skip 骨架，锁定后续 plan（02/03/05/06）可直接激活断言，避免"边实现边补测试"的漂移。

## 新建 / 修改文件清单

| 文件                                                               | 动作     | 内容                                                    |
| ------------------------------------------------------------------ | -------- | ------------------------------------------------------- |
| `apps/gateway/src/__tests__/cache-middleware.test.ts`              | modified | 追加 4 条 `it.todo('D-11 #N: ...')`，不删既有 5 条 it   |
| `apps/blog/e2e/session.spec.ts`                                    | created  | 3 条 `test.skip` 覆盖 AUTH-02（D-01/D-03/hydrate）      |
| `apps/dashboard/e2e/auth-crosspath.spec.ts`                        | created  | 1 条 `test.skip` 覆盖 AUTH-01（D-19 step 4）            |
| `apps/api/src/routes/auth/__tests__/signout.test.ts`               | created  | 3 条 `it.todo('D-15 #N: ...')` + export `createApp` helper |
| `.planning/phases/01-auth-gateway/deferred-items.md`               | created  | 记录 DI-01 pre-existing type-check 失败                 |

## 骨架 → 下游 Plan 映射

| 骨架 ID     | 位置                                                                 | 需求           | 激活 Plan  | 激活动作                                             |
| ----------- | -------------------------------------------------------------------- | -------------- | ---------- | ---------------------------------------------------- |
| D-11 #1     | `apps/gateway/src/__tests__/cache-middleware.test.ts`                | AUTH-06        | Plan 02    | 删 `.todo`，加 `async (ctx) => { ... }` 断言 MISS→HIT |
| D-11 #2     | 同上                                                                 | AUTH-07        | Plan 02    | 带 Cookie 头，断言 `X-Cache-Status: BYPASS` + `X-Cache-Reason: auth-headers` + KV 未写 |
| D-11 #3     | 同上                                                                 | AUTH-07        | Plan 02    | 带 `Authorization` 头，同上                          |
| D-11 #4     | 同上                                                                 | AUTH-06        | Plan 02    | `/api/auth/get-session` ± Cookie，两 case 均 BYPASS  |
| D-01 SSR    | `apps/blog/e2e/session.spec.ts:26`                                   | AUTH-02        | Plan 03    | 删 `.skip`，断言 SSR HTML 含 session 注入标记        |
| D-03 降级   | `apps/blog/e2e/session.spec.ts:36`                                   | AUTH-02        | Plan 03    | 删 `.skip`，断言 3s 超时时 SSR status=200 不 500     |
| hydrate dedup | `apps/blog/e2e/session.spec.ts:46`                                 | AUTH-02        | Plan 03    | 删 `.skip`，断言客户端 hydrate 期间 get-session 仅调 1 次 |
| D-19 step 4 | `apps/dashboard/e2e/auth-crosspath.spec.ts:33`                       | AUTH-01        | Plan 06    | 删 `.skip`，模拟跨 /movie /comic /blog /dashboard 路径断言同 user.id |
| D-15 #1     | `apps/api/src/routes/auth/__tests__/signout.test.ts`                 | AUTH-08        | Plan 05    | 删 `.todo`，mock `authInstance.handler` 返回 200 + Set-Cookie Max-Age=0 |
| D-15 #2     | 同上                                                                 | AUTH-08        | Plan 05    | 删 `.todo`，断言后续 `auth.api.getSession` 返回 null |
| D-15 #3     | 同上                                                                 | AUTH-08        | Plan 05    | 删 `.todo`，断言 Set-Cookie 精确匹配 `starye.session_token=` |

## 下游 Plan 导入路径参考

- Gateway cache 单测（Plan 02）：路径保持 `'../cache-middleware'`，工厂 `createMockKv()` 已导出于 L4，复用即可。
- Blog / Dashboard e2e（Plan 03 / 06）：沿用内联 `mockSession` / `interceptExternalRedirects`，不要提取到跨 spec 的共享文件（Playwright 不建议 spec 间 import helper）。
- Signout 单测（Plan 05）：
  - 从 `__tests__/signout.test.ts` 回到 `apps/api/src/` 的相对深度为 `../../../`，例如 `../../../test/helpers`、`../../../types`、`../index`。
  - `createApp(db, auth, user?)` 已在本文件导出，Plan 05 可直接 import 使用；如需额外 mock（例如 `authInstance.handler`），以 `vi.spyOn(auth, 'handler')` 接入。

## Deviations from Plan

None — plan executed as written，除下列 lint 适配（非功能性）：

### 1. [Rule 3 - Blocking] lint-staged 自动小写化 title

- **Found during:** Task 1 commit
- **Issue:** `@antfu/eslint-config` 的 `test/prefer-lowercase-title` 自动把 `D-11 #N` 改成 `d-11 #N`，打破 plan acceptance `grep "it.todo('D-11"` 返回 4 的硬约束。
- **Fix:** 在 4 条 `it.todo` 外围加 `/* eslint-disable test/prefer-lowercase-title -- D-11 matrix identifier must remain uppercase for traceability */` + 对应 `eslint-enable`。同处理施加于 signout.test.ts 的 D-15。
- **Files modified:** `apps/gateway/src/__tests__/cache-middleware.test.ts`, `apps/api/src/routes/auth/__tests__/signout.test.ts`
- **Commit:** `6d7b728` (gateway), included inline in `982cf6c` (signout)

## Verification Log

```text
# 文件存在性
apps/gateway/src/__tests__/cache-middleware.test.ts        ✓ (modified)
apps/blog/e2e/session.spec.ts                              ✓ (created)
apps/dashboard/e2e/auth-crosspath.spec.ts                  ✓ (created)
apps/api/src/routes/auth/__tests__/signout.test.ts         ✓ (created)

# grep 计数（最终提交态）
grep -c "it.todo('D-11"   apps/gateway/src/__tests__/cache-middleware.test.ts   = 4 ✓
grep -c "test.skip"       apps/blog/e2e/session.spec.ts                         = 4（3 真实 test.skip + 1 docstring 引用）✓ 意图一致
grep -c "test.skip"       apps/dashboard/e2e/auth-crosspath.spec.ts             = 1 ✓
grep -c "it.todo('D-15 #" apps/api/src/routes/auth/__tests__/signout.test.ts    = 3 ✓
grep -c "export function createApp" apps/api/src/routes/auth/__tests__/signout.test.ts = 1 ✓
grep -c "mockSession"     apps/blog/e2e/session.spec.ts                         = 4（定义 1 + 调用 2 + 1 doc）≥ 2 ✓
grep -c "mockSession"     apps/dashboard/e2e/auth-crosspath.spec.ts             = 2 ✓
grep "test.only\|test.fixme" 两文件：no matches ✓

# Playwright 发现计数
apps/blog   npx playwright test --list session.spec.ts        = 3 tests ✓
apps/dashboard npx playwright test --list auth-crosspath...   = 1 test  ✓

# Vitest 绿
apps/gateway pnpm test -- --run cache-middleware.test.ts       → 41 passed | 4 todo ✓
apps/api     pnpm test -- --run signout.test.ts                → 287 passed | 3 todo | 1 skipped ✓
```

备注：`apps/blog/e2e/session.spec.ts` 的 `grep -c test.skip` = 4（含 docstring 中的 "以 test.skip 占位" 文字引用），plan acceptance 写的 "= 3" 针对的是 3 个真实 `test.skip(...)` 调用，Playwright `--list` 输出 3 tests 证实实际骨架数正确；这是 plan 文档的计数口径未剔除注释引用，不影响骨架意图。

## Auth Gates

无。本 plan 纯本地测试骨架创建，不涉及网络 / 认证流程。

## Known Stubs

无。所有新骨架均为测试用例，todo / skip 是设计的目标状态；下游 plan 激活即可，无"渲染占位空数据"型 stub。

## TDD Gate Compliance

此 plan `type: execute`（非 `type: tdd`），无 RED→GREEN→REFACTOR 门要求。骨架本身为后续 plan 铺设 RED 采样点。

## Commits

| Commit    | Message                                                              |
| --------- | -------------------------------------------------------------------- |
| `9210509` | test(01-01): add D-11 cache-bypass todo skeletons in gateway ...      |
| `6d7b728` | fix(01-01): restore uppercase D-11 identifiers in cache middleware ... |
| `0e241de` | test(01-01): add blog SSR + dashboard cross-path session e2e skeletons |
| `982cf6c` | test(01-01): add signout.test.ts skeleton for AUTH-08 server-side ... |

## Self-Check: PASSED

- [x] `.planning/phases/01-auth-gateway/deferred-items.md` FOUND
- [x] `apps/blog/e2e/session.spec.ts` FOUND
- [x] `apps/dashboard/e2e/auth-crosspath.spec.ts` FOUND
- [x] `apps/api/src/routes/auth/__tests__/signout.test.ts` FOUND
- [x] `apps/gateway/src/__tests__/cache-middleware.test.ts` contains 4 `it.todo('D-11` FOUND
- [x] Commit `9210509` in `git log` FOUND
- [x] Commit `6d7b728` in `git log` FOUND
- [x] Commit `0e241de` in `git log` FOUND
- [x] Commit `982cf6c` in `git log` FOUND
