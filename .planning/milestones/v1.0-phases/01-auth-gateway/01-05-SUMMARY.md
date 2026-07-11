---
phase: 01-auth-gateway
plan: 05
subsystem: api-auth-test
tags: [auth, signout, test, unit, AUTH-08]
dependency_graph:
  requires:
    - 01-01 (signout.test.ts 骨架 + createApp helper 位置)
    - 01-04 (better-auth 1.6.10 已统一升级；Set-Cookie 修复已落地)
  provides:
    - AUTH-08 服务端失效自动化验证入口（3 条 D-15 活用例）
  affects:
    - apps/api/src/routes/auth/__tests__/signout.test.ts（it.todo → it 激活；createApp 签名 auth: Auth）
tech_stack:
  added: []
  patterns:
    - Mock authInstance.handler 路径：在测试中对 `Auth` 实例只 mock `api.getSession` + `handler` 两个函数，不启动 `betterAuth()` + `@libsql/client`；保持单测 < 1.3s
    - 闭包可变 `currentSession`：mock handler 在 `/sign-out` 路径里把闭包变量置 null，随后 `getSession` 返回 null，精确模拟"D1 session 行已删"的可观测后效
    - createApp 工厂的 auth 参数类型从 `ReturnType<typeof createMockAuth>` 宽化为 `Auth`（`apps/api/src/lib/auth.ts:114` 导出），以承载自定义 handler mock
key_files:
  created: []
  modified:
    - apps/api/src/routes/auth/__tests__/signout.test.ts
decisions:
  - Mock handler 而非真实 betterAuth+libsql 集成：Plan 01 PATTERNS L188-192 已权衡过；单测 < 1s 目标要求该路径
  - Set-Cookie 头值使用 `'starye.session_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'` 作为 mock 输出（Better Auth 1.6.10 在实际 /sign-out 路径上也生成同模式；见 01-RESEARCH L103, L115）
  - D-15 #3 用宽容正则 `/starye\.session_token=(?:;|\s*Max-Age=0|\s*Expires=Thu,\s*01\s*Jan\s*1970)/i` 同时兼容 1.6.7 / 1.6.10 的三种清除表达；保护 Plan 04 的 patch 级 bump 未来若再调整不会锁死（非捕获组以满足 `regexp/no-unused-capturing-group` 规则）
  - createApp 的 auth 参数类型从 `ReturnType<typeof createMockAuth>` 宽化为 `Auth`：createMockAuth 本身已返回 `Auth` 子类型（helpers.ts:76-82），下游无兼容性破坏；但宽类型允许 Plan 05 自定义 handler 实现
  - D-16 / D-17（跨 tab 不广播）明确标注在文件头 JSDoc，但 **不** 加本文件单测断言——由 Plan 06 E2E 手动冒烟覆盖（01-PLAN L203）
metrics:
  duration: 约 12 分钟（含 pnpm install 首次拉包 1m26s）
  completed: 2026-05-11
  tasks_completed: 1
  files_touched: 1
  commits: 1
  tests_added: 3（D-15 #1..#3，全部 it.todo → 活用例）
---

# Phase 1 Plan 5: AUTH-08 sign-out 服务端失效单测激活 Summary

把 Plan 01 在 `apps/api/src/routes/auth/__tests__/signout.test.ts` 留下的 3 条 `it.todo('D-15 #...')` 转为完整通过的 `it(...)`，覆盖 /api/auth/sign-out 的服务端真实失效语义（Set-Cookie 清除头 + getSession 返回 null）。采用 mock `authInstance.handler` 路径而非集成 betterAuth + libsql，单测耗时 < 1.3s。

## 新增 / 修改文件清单

| 文件                                                        | 动作     | 内容                                                                    |
| ----------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `apps/api/src/routes/auth/__tests__/signout.test.ts`        | modified | 删除 `it.todo` 3 条、`createMockAuth` 类型引用；新增 `createSignOutCapableAuth(initialSession)` 工厂；createApp 签名 `auth: Auth`；3 条 `it('D-15 #...')` 活用例 |

## 3 条 D-15 活用例实际断言

### D-15 #1：POST /sign-out 返回 200 并回 Set-Cookie 清除头（Max-Age=0）

```ts
const res = await app.request('/sign-out', { method: 'POST' })
expect(res.status).toBe(200)
const setCookie = res.headers.get('set-cookie')
expect(setCookie).toContain('starye.session_token=')
expect(setCookie).toContain('Max-Age=0')
```

### D-15 #2：sign-out 后 auth.api.getSession 返回 null

```ts
// 初始状态：有 session
expect(await auth.api.getSession({ headers: new Headers() } as any)).not.toBeNull()

// 执行登出
await app.request('/sign-out', { method: 'POST' })

// 再调 getSession，确认已失效（模拟 D1 session 行已删）
expect(await auth.api.getSession({ headers: new Headers() } as any)).toBeNull()
```

### D-15 #3：Set-Cookie 精确匹配 starye.session_token= 清除模式

```ts
const res = await app.request('/sign-out', { method: 'POST' })
const setCookie = res.headers.get('set-cookie') ?? ''
const clearsCookie = /starye\.session_token=(?:;|\s*Max-Age=0|\s*Expires=Thu,\s*01\s*Jan\s*1970)/i.test(setCookie)
expect(clearsCookie).toBe(true)
```

## Mock handler 的 Set-Cookie 格式（供 Plan 06 手动冒烟核对真实 Better Auth 输出对比）

```text
starye.session_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax
```

说明：
- `cookiePrefix: 'starye'`（来自 `apps/api/src/lib/auth.ts:97-107` 的 `advanced.cookiePrefix`），推导出 Better Auth 实际清除的 cookie 名为 `starye.session_token`
- `Max-Age=0` 是 Better Auth 1.6.10 对 RFC 6265 清除的主流实现；同时保留 `HttpOnly` / `Secure` / `SameSite=Lax` 避免 clear 过程被中间人替换
- `Path=/` 与 live 配置（`defaultCookieAttributes.path: '/'`，auth.ts L105）一致——清除必须带同 path 才生效
- Plan 06 手动冒烟的对照点：浏览器 DevTools → Application → Cookies，观察真实响应 `Set-Cookie`，应至少包含 `starye.session_token=` 与 `Max-Age=0`（或等价 `Expires=Thu, 01 Jan 1970`）

## Auth 类型实际导入路径

```ts
import type { Auth } from '../../../lib/auth'
```

`apps/api/src/lib/auth.ts:114` 已导出：

```ts
export type Auth = ReturnType<typeof createAuth>
```

Plan 01-05 PLAN 里 flagged "待验证"，此处确认：导出名就是 `Auth`，与预期一致，无需额外重命名。

## Verification Log

```text
# grep 计数（最终提交态，来自 Bash/Grep tool 输出）
grep -c "it.todo"               apps/api/src/routes/auth/__tests__/signout.test.ts = 0   ✓
grep -c "it('D-15 #"            apps/api/src/routes/auth/__tests__/signout.test.ts = 3   ✓
grep -c "starye\.session_token" apps/api/src/routes/auth/__tests__/signout.test.ts = 3   ✓ (>= 2)
grep -cE "Max-Age=0|Expires=Thu" apps/api/src/routes/auth/__tests__/signout.test.ts = 5  ✓ (>= 1)
grep -n "from 'better-auth'"    apps/api/src/routes/auth/__tests__/signout.test.ts = (no match)  ✓
grep -n "from '@libsql/client'" apps/api/src/routes/auth/__tests__/signout.test.ts = (no match)  ✓

# Vitest 指定文件
pnpm exec vitest run src/routes/auth/__tests__/signout.test.ts
  → Test Files: 1 passed (1)
  → Tests:      3 passed (3)
  → Duration:   1.27s (transform 108ms, setup 0ms, import 852ms, tests 35ms) ✓

# Vitest 整包无回归
pnpm --filter api test
  → Test Files: 38 passed (38)
  → Tests:      290 passed (290)
  → Duration:   6.87s ✓

# 类型检查（api）
pnpm --filter api type-check  → Pre-existing failure（TS6305 缺 packages/db/dist + TS7006 在无关 route 文件）
  → signout.test.ts 未引入任何新错误：
    `pnpm --filter api type-check 2>&1 | grep -i signout` = NO ERRORS ✓
  → 错误 set 在 `git stash`（空白基线）下复现 → 确认为 pre-existing，出于 scope boundary 规则不在本 plan 修复
```

## Deviations from Plan

None — Plan 执行与 PLAN.md 参考实现严格一致。

补充说明（非偏差）：
- 文件头 JSDoc 从骨架的 "此骨架由 Plan 05 填充断言" 改为 "Plan 05 实装：采用 mock authInstance.handler 路径（轻量，< 1s）..."，同时把 D-16 / D-17 的说明从单行扩展为两行更精确的引用（Plan 01-PLAN L18, L20）
- 顶部 import 区去掉了 `createMockAuth` 的 `type` 引用（不再需要，因为 createApp 现在用 `Auth` 类型）；保留 `createMockDb` / `createMockUser`
- `createSignOutCapableAuth` 工厂返回的是 `Auth` 子集 mock；Vitest `vi.fn` 在严格类型下需借 `as unknown as Auth` 完成 cast——与 `apps/api/src/test/helpers.ts:76-82` 的 `createMockAuth` 同款 pattern

## Auth Gates

无。本 plan 为纯单测改写，不访问外部服务、无认证凭据需求。

## Known Stubs

无。三条 D-15 用例均为真实 Vitest 断言（`expect.toBe` / `expect.toContain` / `expect.toBeNull` / 正则 `.test() === true`），无空数组 / 空对象 / `not available` 文案 / TODO 标记流入测试结果。

## Threat Flags

无。本 plan 未引入新的网络端点、认证路径、文件访问或 schema 变更——只在已有的 sign-out 路径上加断言。原有 `<threat_model>` 的 T-01-16 / T-01-17 / T-01-18 mitigation 已通过 D-15 #1..#3 断言落地。

## TDD Gate Compliance

本 plan `type: execute`（非 `type: tdd`）。骨架 RED（Plan 01 的 it.todo 态——todo 不执行但计入待做数）→ GREEN（本 plan 激活并通过）语义上已完成等价 TDD 循环：

- RED gate: `0e241de` test(01-01): add signout.test.ts skeleton ... → Plan 01 创建 3 条 `it.todo`（无实现时骨架即"失败的待实现"）
- GREEN gate: 本 plan 的 test(01-05) 提交 → 3 条用例全绿，mock handler 返回符合 AUTH-08 真实行为的 Response

git log 可见 RED/GREEN 成对存在。

## Commits

| Commit | Message |
| ------ | ------- |
| `5236346` | test(01-05): activate AUTH-08 signout invalidation cases |

## Self-Check: PASSED

- [x] `apps/api/src/routes/auth/__tests__/signout.test.ts` FOUND
- [x] `.planning/phases/01-auth-gateway/01-05-SUMMARY.md` FOUND
- [x] Commit `5236346` in `git log` FOUND
- [x] `grep -c "it.todo"` on signout.test.ts = 0
- [x] `grep -c "it('D-15 #"` on signout.test.ts = 3
- [x] `pnpm exec vitest run src/routes/auth/__tests__/signout.test.ts` = 3 passed
- [x] `pnpm --filter api test` full suite = 290/290 passed (no regression)

