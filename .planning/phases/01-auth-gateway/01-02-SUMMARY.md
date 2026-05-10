---
phase: 01-auth-gateway
plan: 02
subsystem: gateway
tags: [gateway, cache, bypass, security, cloudflare-workers, kv]

# Dependency graph
requires:
  - phase: 01-auth-gateway
    provides: 01-01 Plan 已留下 4 条 D-11 `it.todo` 骨架与整体类型/常量坐标，本 plan 在此基础上激活并重构
provides:
  - Gateway header-based cache bypass：带 Cookie / Authorization 的请求强制 bypass，零 KV 读写
  - CacheScope 收窄为 `'public' | 'bypass'`，彻底删除 private scope 全部代码路径
  - 新增 `X-Cache-Reason` 诊断响应头（BYPASS 时注入），枚举 5 档 bypass 原因
  - D-11 四条单测转为活用例（AUTH-06 / AUTH-07 回归锚点）
affects:
  - Phase 01 Plan 03（Nuxt SSR session 读取，需确保带 cookie 请求确实走 bypass）
  - Phase 01 Plan 05（signout 回归，借 D-11 #4 `/api/auth/*` 行为做前置假设）
  - Phase 01 Plan 06（手动/E2E 冒烟，可借 `X-Cache-Reason` 做现网排障锚点）
  - 未来任何 gateway cache 相关改动 — `CacheBypassReason` 枚举作为诊断契约

# Tech tracking
tech-stack:
  added: []  # 纯重构 + 测试激活，无新依赖
  patterns:
    - "Header-based bypass：request 入口统一读头 → bypassReason 贯穿 policy → 响应头透出"
    - "Bypass reason 优先级：auth-headers > cache-bypass-option > basePolicy.bypassReason"
    - "D-09 防线 + D-10 诊断组合：set-cookie 响应既不存 KV 也被标记为 `set-cookie-response`"

key-files:
  created: []
  modified:
    - "apps/gateway/src/cache-middleware.ts (+51 / -28，净增 23 行；类型收窄 + hasAuthHeaders 检测 + X-Cache-Reason 注入)"
    - "apps/gateway/src/__tests__/cache-middleware.test.ts (+80 / -47，净增 33 行；4 条 D-11 转活用例 + favorites 旧 mock 删除)"
    - "apps/gateway/src/__tests__/cache-consistency.e2e.test.ts (+3 / -46，净减 43 行；Rule 3 删除依赖死 private scope 的测试)"

key-decisions:
  - "CacheBypassReason 枚举确定 5 档：auth-headers / no-store-path / set-cookie-response / cache-bypass-option / non-cacheable-group（按 plan interfaces 采纳，未偏离）"
  - "hashValue 和 mergeVaryHeader 函数体保留 + eslint-disable 注释（D-14）— 未来静态资源 URL 分片和 Vary: Accept-Encoding 可能复用"
  - "auth-headers bypassReason 优先级高于 no-store-path — D-11 #4 带 cookie 场景期望 'auth-headers'（在 resolveCachePolicy 里 hasAuthHeaders 判断先于 basePolicy.bypassReason）"
  - "createCachedProxy 里 Set-Cookie 响应透传 'set-cookie-response' 原因（plan Step 11 要求），即便 D-07 已设 auth-headers 也保留优先级（只在 !policy.bypassReason 时才克隆 policy）"
  - "Rule 3：cache-consistency.e2e.test.ts 第二个测试 `clears all user-scoped favorites caches` 整块删除 — private scope 清理后该测试前提已消失，属 plan 外阻塞项"

patterns-established:
  - "bypassReason 字段作为 resolveBasePolicy → resolveCachePolicy → decorateResponse 三层贯穿的诊断契约"
  - "BYPASS 响应头三连：X-Cache-Status=BYPASS + X-Cache-Policy=bypass + X-Cache-Reason=<enum>，排障幕布"

requirements-completed:
  - AUTH-05
  - AUTH-06
  - AUTH-07

# Metrics
duration: 约 20min
completed: 2026-05-11
---

# Phase 01 Plan 02: Gateway cache header-bypass + private scope removal Summary

**Gateway 缓存按请求头判定 bypass，私有 scope 代码路径物理清零，诊断响应头 X-Cache-Reason 上线；D-11 四条采样用例从 it.todo 转为活用例。**

## Performance

- **Duration:** 约 20 分钟
- **Started:** 2026-05-11T02:30:00+08:00（读 plan 上下文）
- **Completed:** 2026-05-11T02:41:35+08:00
- **Tasks:** 2 / 2 全部完成
- **Files modified:** 3（cache-middleware.ts + 2 个测试文件）

## Accomplishments

- **AUTH-07 闭合：** `resolveCachePolicy` 现在读 `request.headers.has('cookie') || .has('authorization')` 触发 bypass，覆盖路径 policy；D-11 #2 / #3 单测回归确认 calls 每次 +1（不写 KV）。
- **AUTH-06 回归锚点：** D-11 #4 覆盖 `/api/auth/get-session` 有无 cookie 两档，前者 `no-store-path` 后者 `auth-headers`，验证 hasAuthHeaders 优先级高于 NO_STORE_PREFIXES 标记。
- **AUTH-05 未动：** `apps/gateway/src/index.ts` 零改动，Cookie/Set-Cookie 透传语义保持。
- **D-12 / D-13 / D-14 完成：** `CacheScope = 'public' | 'bypass'`；`CacheGroup` 去掉 `'favorites'`；`PRIVATE_CACHE_PREFIXES` 常量 / `resolveBasePolicy` private 分支 / `createCacheKey` userScope 分支 / `decorateResponse` Vary:Cookie 分支 四处同时清除；`hashValue` / `mergeVaryHeader` 函数体保留。
- **D-10 诊断头上线：** `CACHE_REASON_HEADER = 'X-Cache-Reason'` 常量新增；BYPASS 且有 bypassReason 时注入；五档枚举值在源码中都有实际使用（no-store-path×1, non-cacheable-group×2, set-cookie-response×1, cache-bypass-option×1, auth-headers×1）。

## Task Commits

1. **Task 1：重构 cache-middleware.ts** — `8735e9b` (refactor)
   - 同 commit 附带 Rule 3 清理：`cache-consistency.e2e.test.ts` 删除依赖 private scope 的 obsolete 测试
2. **Task 2：D-11 四条用例转活 + favorites 旧 mock 清理** — `d4b79f0` (test)

## Files Created/Modified

- `apps/gateway/src/cache-middleware.ts` — 核心重构，按 plan Step 1-11 顺序落地；类型收窄 → 常量清理 → resolveBasePolicy 加 bypassReason 标签 → resolveCachePolicy 新增 hasAuthHeaders → createCacheKey 删 userScope → decorateResponse 注入 X-Cache-Reason → createCachedProxy 处理 Set-Cookie BYPASS 诊断
- `apps/gateway/src/__tests__/cache-middleware.test.ts` — 4 条 `it.todo('D-11 #...')` 转为完整 `it(...)`；删除 `isolates favorites cache per user cookie` 整块；更新 `invalidates cache entries by prefix` fixture（favorites:private key 替换为真实 public/bypass key）
- `apps/gateway/src/__tests__/cache-consistency.e2e.test.ts` — Rule 3 删除第二个测试 `clears all user-scoped favorites caches`（依赖 private scope + userScope hash，D-12 后永远走 bypass）

## 接口最终形态

### CacheBypassReason 枚举（最终命名，与 plan interfaces 一致）

| 值 | 触发条件 | 优先级 |
|---|---|---|
| `auth-headers` | request 带 cookie 或 authorization | 最高（覆盖路径 policy） |
| `cache-bypass-option` | 调用方传 `options.bypassCache = true` | 次高 |
| `no-store-path` | `NO_STORE_PREFIXES` 路径命中且未被上面两条覆盖 | 路径级 |
| `non-cacheable-group` | `/api` 默认分支 或 misc 兜底分支 | 路径级 |
| `set-cookie-response` | 上游响应带 Set-Cookie，被 `shouldCacheResponse` 拦截 | 响应级（createCachedProxy 后置克隆） |

### CachePolicy 新字段

```ts
interface CachePolicy {
  scope: 'public' | 'bypass'          // D-13 收窄
  group: 'admin' | 'api' | 'auth' | 'misc' | 'movies' | 'public-pages' | 'static-assets'
  ttl?: number
  staleWhileRevalidate?: number
  cacheControl?: string
  shouldStore: boolean
  bypassReason?: CacheBypassReason   // D-10 新增
}
```

## D-11 四条测试最终断言（供 Plan 06 冒烟引用）

| # | 请求 | X-Cache-Status | X-Cache-Reason | calls 递增 |
|---|---|---|---|---|
| 1 | `GET /api/movies` 无头 | 首次 MISS / 二次 HIT | 无 | calls === 1 |
| 2 | `GET /api/movies` + `cookie: starye.session_token=xxx` | BYPASS / BYPASS | `auth-headers` | calls === 2 |
| 3 | `GET /api/movies` + `authorization: Bearer xxx` | BYPASS / BYPASS | `auth-headers` | calls === 2 |
| 4a | `GET /api/auth/get-session` 无 cookie | BYPASS | `no-store-path` | — |
| 4b | `GET /api/auth/get-session` 带 cookie | BYPASS | `auth-headers`（优先级覆盖） | — |

## Acceptance Criteria Grep 结果

`apps/gateway/src/cache-middleware.ts` 静态检查（pnpm --filter gateway test / lint 零错误前提下）：

| Criteria | 要求 | 实测 | 结论 |
|---|---|---|---|
| `grep -c "'private'"` | == 0 | 0 | ✓ |
| `grep -c "PRIVATE_CACHE_PREFIXES"` | == 0 | 0 | ✓ |
| `grep -c "'favorites'"` | == 0 | 0 | ✓ |
| `grep -c "hasAuthHeaders"` | >= 1 | 3（定义+使用×2） | ✓ |
| `grep -c "CACHE_REASON_HEADER"` | >= 2 | 2 | ✓ |
| `grep -c "bypassReason"` | >= 6 | 15 | ✓ |
| `grep -c "bypassReason: 'no-store-path'"` | >= 1 | 1 | ✓ |
| `grep -c "bypassReason: 'non-cacheable-group'"` | >= 1 | 2 | ✓ |
| `grep -c "bypassReason: 'set-cookie-response'"` | >= 1 | 1 | ✓ |
| `grep -c "bypassReason: 'auth-headers'"` | >= 1 | 1 | ✓ |
| `grep -c "mergeVaryHeader"` | == 1（仅定义） | 2（定义 + 中文注释中的名字） | 语义符合：无调用点 |
| `hashValue` 调用点 | 仅定义无调用 | 定义 1 行 + 注释 1 行，零调用 | ✓ |

测试文件：

| Criteria | 要求 | 实测 | 结论 |
|---|---|---|---|
| `grep -c "isolates favorites cache per user cookie"` | == 0 | 0 | ✓ |
| `grep -c "it('D-11 #"` | == 4 | 4 | ✓ |
| `grep -c "it.todo('D-11"` | == 0 | 0 | ✓ |
| `grep -c "favorites:private"` | == 0 | 0 | ✓ |
| `grep -c "X-Cache-Reason"` | >= 4 | 8（4 条用例 × 2 断言） | ✓ |
| 测试通过总数 | >= 7 | 43 passed（全 gateway 套件） | ✓ |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 删除 cache-consistency.e2e.test.ts 第二条 obsolete 测试**

- **Found during:** Task 1 完成后首次全量回归
- **Issue:** `clears all user-scoped favorites caches so the next request reflects the latest state` 依赖 private scope + userScope hash 切片；D-07 生效后带 cookie 请求一律 bypass，`/api/favorites` 永远走不到 private 分支，该测试期望 HIT 但实际 BYPASS → 红。
- **Fix:** 整块删除该 it，保留 `clears gateway cache group (movies)` 第一条测试（仍有效）；源文件头上加一行注释说明删除理由（D-12）。
- **Files modified:** `apps/gateway/src/__tests__/cache-consistency.e2e.test.ts`
- **Commit:** 合并在 Task 1 commit `8735e9b` 中
- **Why auto-fix:** plan 未列此文件但它和 `cache-middleware.ts` private scope 清理强耦合；不删则整个 gateway 套件红 → Task 1 `<verify>` 不通过，阻塞后续。属 Rule 3（blocking）。

### Auth Gates

无。本 plan 纯本地重构 + 单测，未触及任何需认证的资源。

## Deferred Issues

无。所有 acceptance criteria 达标，pnpm lint / test 全绿。

## Known Stubs

无。本 plan 不涉及 UI 数据流或外部集成；新增的 `X-Cache-Reason` 响应头值来自纯函数计算，无占位。

## 回归测试摘要

```
pnpm --filter @starye/gateway test
→ Test Files  3 passed (3)
→ Tests       43 passed (43)
→ Duration    530ms

pnpm --filter @starye/gateway lint
→ 0 errors / 0 warnings
```

## 未来 Phase 可借用的位点

- **X-Cache-Reason 诊断钩子：** 生产环境排障可直接看响应头。Phase 06 手动冒烟可加一条 `curl -sI https://starye.org/api/movies | grep X-Cache-Reason` 校验。
- **CacheBypassReason 枚举扩展：** 未来如新增 per-route 策略（如 rate-limit、geo-bypass），只需扩展该 union type 并在相应分支设置 bypassReason，decorateResponse 自动透出，不改调用侧。
- **hashValue 保留：** 静态资源 URL 分片（CDN cache key）可直接复用。

## Self-Check: PASSED

已验证：
- `apps/gateway/src/cache-middleware.ts` FOUND
- `apps/gateway/src/__tests__/cache-middleware.test.ts` FOUND
- `apps/gateway/src/__tests__/cache-consistency.e2e.test.ts` FOUND
- commit `8735e9b` FOUND in git log
- commit `d4b79f0` FOUND in git log
