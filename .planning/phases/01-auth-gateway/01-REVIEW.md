---
status: issues_found
phase: 01-auth-gateway
depth: standard
files_reviewed: 14
findings:
  critical: 2
  warning: 8
  info: 0
  total: 10
date: 2026-05-11
---

# Phase 01 Code Review Report

## 摘要

审查了 Phase 01 的 14 个文件（gateway + blog SSR + auth SSR + dashboard e2e + api signout + 4 份 package.json）。发现 **2 条 BLOCKER**（`apps/gateway/src/cache-middleware.ts` 有两个 Cache-Control 泄漏路径，直接威胁 AUTH-07 "匿名永不读到他人缓存" 不变量）+ **8 条 WARNING**。

四份 package.json 的 `better-auth ^1.6.10` 升级一致、无其他依赖连带升级，通过。

## BLOCKER

### CR-01: hasAuthHeaders 触发 bypass 时 Cache-Control 仍下发 `public, max-age=300`（缓存投毒）

**File:** `apps/gateway/src/cache-middleware.ts:206-215`

**Issue:** `resolveCachePolicy` 在 `hasAuthHeaders=true` 时把 `scope` 和 `shouldStore` 翻为 bypass/false，但 `cacheControl` 的三元分支：
```ts
cacheControl: ttl && basePolicy.scope === 'public' && shouldStore
  ? buildCacheControl('public', ttl, basePolicy.staleWhileRevalidate)
  : basePolicy.cacheControl,
```
当 `shouldStore=false` 时 else 分支落回 `basePolicy.cacheControl`。对 `/api/movies`（MOVIE_LIST_PATHS basePolicy）该值是 `'public, max-age=300, stale-while-revalidate=60'`。结果：带 Cookie 的请求响应同时有 `X-Cache-Status: BYPASS` + `Cache-Control: public, max-age=300, stale-while-revalidate=60`，上游 CDN / 浏览器共享缓存会缓存用户态响应并回放给其他用户。D-07 只挡住 KV 层，HTTP 语义层全裸。

**Impact:** 直接违反 AUTH-07、ROADMAP Phase 1 Success Criteria #3。

**Fix:**
```ts
return {
  ...basePolicy,
  scope,
  ttl,
  shouldStore,
  bypassReason,
  cacheControl: ttl && basePolicy.scope === 'public' && shouldStore
    ? buildCacheControl('public', ttl, basePolicy.staleWhileRevalidate)
    : (!shouldStore && basePolicy.scope === 'public'
        ? 'private, no-store'       // public 基线翻 bypass 时必须降级
        : basePolicy.cacheControl),
}
```

配套：D-11 #2/#3 必须新增 `expect(Cache-Control).not.toContain('public')` + `toContain('no-store')` 断言锁死。

### CR-02: Set-Cookie 响应透传 public Cache-Control（D-09 仅挡 KV，漏响应头）

**File:** `apps/gateway/src/cache-middleware.ts:434-441`

**Issue:** `createCachedProxy` 里 Set-Cookie 响应克隆 policy 只覆写 `scope/shouldStore/bypassReason`，`cacheControl` 依然来自原 policy。对 `/api/movies` MISS 分支就是 `public, max-age=300`。上游 API 回 Set-Cookie，gateway 就把 `Set-Cookie + Cache-Control: public` 一起下发，经典共享缓存投毒链。`decorateResponse` 第 372-374 行强写该值，风险 100% 暴露。

**Impact:** 与 CR-01 同类，AUTH-07 + AUTH-05（Set-Cookie 透传应不伴随 public 缓存指令）。

**Fix:**
```ts
const finalPolicy: CachePolicy = !storable && response.headers.has('set-cookie')
  ? { ...policy, scope: 'bypass', shouldStore: false, cacheControl: 'private, no-store', bypassReason: policy.bypassReason ?? 'set-cookie-response' }
  : policy
```

配套：cache-middleware.test.ts 新增 "Set-Cookie 响应不下发 public Cache-Control" 用例。

## WARNING

### WR-01: `public-pages` 策略缺 `bypassReason`，X-Cache-Reason 永远不输出

**File:** `apps/gateway/src/cache-middleware.ts:163-171`

`public-pages` group 的 basePolicy `shouldStore: false` 但没 `bypassReason`，D-10 诊断断层。

**Fix:** 加 `bypassReason: 'non-cacheable-group'`。

### WR-02: X-Cache-TTL 在 BYPASS 响应上误报

**File:** `apps/gateway/src/cache-middleware.ts:368-370`

`decorateResponse` 只看 `policy.ttl` 是否真就写头。BYPASS + TTL=300 的组合对监控面板是误导。

**Fix:**
```ts
if (policy.ttl && cacheStatus !== 'BYPASS') {
  headers.set(CACHE_TTL_HEADER, `${policy.ttl}`)
}
```

### WR-03: SSR middleware 静态资源过滤过于宽松（`pathname.includes('.')`）

**File:** `apps/blog/server/middleware/session.ts:22`, `apps/auth/server/middleware/session.ts:22`

会把 `/posts/v1.2.0-release`、带点 slug 的博客路由都判为静态资源跳过 session 预取。

**Fix:** 用 `pathname.match(/\.[a-z0-9]+$/i)` 专门匹配真实扩展名；或定义 `STATIC_EXT_PATTERN`。

### WR-04: `apiUrl` 未校验即 `as string` 转发

**File:** `apps/blog/server/middleware/session.ts:33`, `apps/auth/server/middleware/session.ts:33`

runtimeConfig 未注入时 `apiUrl=undefined`，`$fetch` 退化为相对路径打到 Nuxt 自身，配置错误被悄悄掩盖。

**Fix:** 开头校验 `typeof apiUrl !== 'string' || !apiUrl` 直接降级 + 打 error log。

### WR-05: blog e2e 断言 `$ssession` 在 key 不对时恒 null（tautology）

**File:** `apps/blog/e2e/session.spec.ts:137`

`expect(nuxtState?.$ssession ?? null).toBeNull()` — Nuxt 4 的 useState key 序列化具体名字依赖构建版本；若 key 名变了断言永真。

**Fix:** 两步断言：先 `expect(nuxtState).toBeDefined()`，再用 `Object.keys` 找到包含 `session` 的 key 再断言 null。

### WR-06: dashboard 跨路径测试的强断言被条件化

**File:** `apps/dashboard/e2e/auth-crosspath.spec.ts:68-74`

`if (userId !== null) { expect(userId).toBe('user-1') }` 若 `[data-user-id]` 属性丢了整条跳过，只剩 `sessionRequests >= 1`。D-19 step 4 的 "同一 user.id" 弱化。

**Fix:** 要么在被测组件保证该属性稳定存在、去掉 `if`；要么加专门的 `data-testid="current-user"` 供 e2e 使用。

### WR-07: signout.test.ts 只验证 mock，未触及真实 Set-Cookie 格式与 D1 session 删除

**File:** `apps/api/src/routes/auth/__tests__/signout.test.ts:27-51, 89-103`

`createSignOutCapableAuth` 自维护内存变量，D-15 #2/#3 断言只是在验 mock 自洽，better-auth 1.6.10 真实输出格式 + D1 session 行删除都没被覆盖。

**Fix:** Phase 2 用 `memoryAdapter(...)` + 真实 `betterAuth({...})` 补 integration 层；本 phase 至少在文件顶部加 JSDoc 警示 "只覆盖路由转发，不覆盖 better-auth 内部"。

### WR-08: blog 与 auth 的 session middleware / plugin 逐字节重复

**File:** `apps/blog/server/middleware/session.ts` ↔ `apps/auth/server/middleware/session.ts`

两个文件 1-50 行完全一样，plugin 也双份。任一方补 bug（如 WR-03 / WR-04 修正）必须手工同步，易漂移。

**Fix:** Phase 2 抽到 `packages/auth-ssr/`，两 app 薄壳 import；本 phase 只加 `// TODO(phase-2)` 警示注释。

## 通过项

- `better-auth ^1.6.10` 四份 package.json 一致、无其他依赖连带升级
- `hono ^4.12.12`、`nuxt ^4.4.2`、`vue ^3.5.32` 基线一致
- Valibot / Drizzle 未被 Phase 1 触及，保持原状
- signout.test.ts mock handler 模式与 Plan 05 决策一致（不在本 phase 启动真实 better-auth）

## 决策

**本 phase 处理：** CR-01 / CR-02 / WR-01 / WR-02（都在同一个文件 `apps/gateway/src/cache-middleware.ts`，属于 Phase 1 核心不变量闭环）

**归入 deferred-items.md 或 phase 2 处理：** WR-03..08（Nuxt SSR middleware 细节、e2e tautology 风险、shared package 抽取均在 Phase 2 `requireAuth 中间件 + 跨端权限守卫` 的自然扩展范围内）
