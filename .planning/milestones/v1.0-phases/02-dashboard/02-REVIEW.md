---
phase: 02-dashboard
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - RUNBOOK.md
  - apps/api/src/__tests__/docs-auth.test.ts
  - apps/api/src/index.ts
  - apps/api/src/lib/__tests__/auth.test.ts
  - apps/api/src/lib/auth.ts
  - apps/api/src/middleware/__tests__/guard.test.ts
  - apps/api/src/middleware/guard.ts
  - apps/api/src/routes/public/comics/index.ts
  - apps/api/src/routes/public/movies/index.ts
  - apps/api/src/routes/public/search/index.ts
  - apps/api/src/services/__tests__/adult-filter.test.ts
  - apps/api/src/services/adult-filter.ts
  - apps/api/src/types.ts
  - apps/api/wrangler.toml
  - apps/auth/app/pages/login.vue
  - apps/auth/public/_redirects
  - apps/blog/public/_redirects
  - apps/comic-app/package.json
  - apps/comic-app/public/_redirects
  - apps/comic-app/src/composables/__tests__/useAuthGuard.test.ts
  - apps/comic-app/src/composables/useAuthGuard.ts
  - apps/comic-app/src/composables/useFavorites.ts
  - apps/comic-app/vitest.config.ts
  - apps/dashboard/public/_redirects
  - apps/gateway/src/__tests__/dashboard-guard.test.ts
  - apps/gateway/src/__tests__/routing.test.ts
  - apps/gateway/src/dashboard-guard.ts
  - apps/gateway/src/index.ts
  - apps/gateway/vitest.config.ts
  - apps/gateway/wrangler.toml
  - apps/movie-app/public/_redirects
  - apps/movie-app/src/composables/useAuthGuard.ts
  - apps/movie-app/src/views/MovieDetail.vue
findings:
  critical: 1
  warning: 4
  info: 7
  total: 12
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Phase 02 交付了较完整的"dashboard 白名单化"链路：Better Auth session 注入 `githubId`、API `requireAuth` 短路、Gateway 前置鉴权 + L1 缓存、统一 `adult-filter` 服务、前端 `useAuthGuard` + 登录页同源校验、5 个 Pages app 的 301 回落，以及 RUNBOOK 文档。核心流程在单元测试层面覆盖良好（guard / adult-filter / auth-guard / dashboard-guard / routing 等），思路清晰且与 PLAN/SUMMARY 对齐。

本次审查聚焦正确性与安全性，发现 1 处 Critical 级 open redirect（双重 URL 编码可绕过 `login.vue` 的同源校验）、4 处 Warning（公开路由 R18 过滤不一致、Gateway 子请求缺乏超时、`login.vue` 定时器未在 unmount 时清理、`useAuthGuard` 跨 app 逐字重复），以及 7 条可优化的 Info 项（未使用参数、常量三元、`Number.parseInt` 缺 radix、cache 无淘汰、cookie 解码未防崩、callbackURL 保留 stale error、composable 在事件内调用）。

按 CLAUDE.md "单用户自用" 约束，Critical 级 open redirect 的实际受害面很小，但它正是 D-14 明确要防御的类，修复优先级仍应排第一。

## Critical Issues

### CR-01: `login.vue` 双重 URL 编码可绕过同源校验 → open redirect

**File:** `apps/auth/app/pages/login.vue:27-37, 42-77`
**Issue:**
同源校验在 `redirectPath` computed 中基于 **raw**（一次解码）值执行 `new URL(raw, origin)`，随后在 `watchEffect` 中再次 `decodeURIComponent(redirectPath.value)` 作为跳转目标。这形成"先校验后再解码"的顺序错位。

攻击链：
1. 受害者被引导点击 `https://starye.org/auth/login?next=%252F%252Fevil.com`。
2. Vue Router/Nuxt 解码一次 → `route.query.next = '%2F%2Fevil.com'`。
3. 同源校验执行 `new URL('%2F%2Fevil.com', origin)`：URL 解析器把 `%2F` 当作 path 字符 → `https://starye.org/%2F%2Fevil.com`，origin 同源 → **放行**。
4. `raw.startsWith('/')` 为 false（首字符是 `%`），返回 `'/%2F%2Fevil.com'`。
5. `decodeURIComponent('/%2F%2Fevil.com')` → `'///evil.com'`。
6. `window.location.href = '///evil.com'`：WHATWG URL 解析把多余前导 `/` 折叠，浏览器（Chrome 实测）跳转至 `https://evil.com/`。

同源校验因此被绕过，满足 open redirect 定义（D-14 明确要防御该类风险）。

**Fix:**
在"跳转用的目标字符串"上再跑一次 URL 同源校验，或直接取消"再解码一次"这步（Router 已做好解码，重复解码没有业务收益）：

```vue
<script setup lang="ts">
// 1) 删掉 line 49 的 decodeURIComponent，直接用 redirectPath.value
const target = redirectPath.value

// 2) 额外做一次"最终目标"的 URL.origin 校验
try {
  const finalUrl = new URL(target, window.location.origin)
  if (finalUrl.origin !== window.location.origin) {
    // 拒绝跳转，回到默认
    window.location.href = '/'
    return
  }
  window.location.href = finalUrl.pathname + finalUrl.search + finalUrl.hash
}
catch {
  window.location.href = '/'
}
</script>
```

同时 **不再使用 `startsWith('http')` 作为跳转分支依据**（它对 `//evil.com`、`\\/evil.com` 等 protocol-relative 情形都为 false）。

## Warnings

### WR-01: `/api/public/movies/genres` 未使用统一 `buildAdultVisibilityCondition`

**File:** `apps/api/src/routes/public/movies/index.ts:199-213`
**Issue:**
`/genres` 端点手工拼接：
```ts
const r18Filter = !user?.isR18Verified
  ? sql`AND m.is_r18 = 0`
  : sql``
```
这与本期 Plan 04 统一的 `buildAdultVisibilityCondition(user, movies)` 语义不一致：后者对 `role === 'admin' | 'super_admin'` 也放行 R18，而 `/genres` 仅看 `isR18Verified`。结果：admin 账号如果没勾选 R18 验证，列表/详情/搜索都能看到 R18，但 Genre 聚合接口看不到 R18 相关标签，UI 数据不一致。
**Fix:**
抽象一个对齐 `buildAdultVisibilityCondition` 的 SQL 片段（或改用纯 Drizzle 查询），例如：

```ts
import { checkUserAdultStatus } from '.../adult' // 或复用服务逻辑
const canSeeR18 = user?.isR18Verified || user?.role === 'admin' || user?.role === 'super_admin'
const r18Filter = canSeeR18 ? sql`` : sql`AND m.is_r18 = 0`
```

或把整条 SQL 改成 Drizzle 风格，由 `buildAdultVisibilityCondition` 统一输出条件。

### WR-02: `dashboard-guard.ts` fetch 没有显式超时

**File:** `apps/gateway/src/dashboard-guard.ts:60-71`
**Issue:**
Gateway 在缓存 miss 时 `fetch(`${apiOrigin}/api/auth/get-session`, …)` 没有 `AbortSignal.timeout` 或任何 deadline。API 一旦慢/阻塞，Gateway 整条 `/dashboard/*` 请求会被拖住，用户无法获得快速 fail-closed 的 302。Cloudflare Workers 有全局 30s CPU/wall 限制，但这 30s 之内 UI 是彻底没有响应的。
**Fix:**
引入短超时（例如 3s），超时按现有失败分支走 fail-closed：

```ts
try {
  const resp = await fetch(`${apiOrigin}/api/auth/get-session`, {
    headers: { cookie },
    signal: AbortSignal.timeout(3000),
  })
  if (!resp.ok)
    return { allowed: false, reason: 'no_session' }
  data = await resp.json()
}
catch {
  return { allowed: false, reason: 'no_session' }
}
```

### WR-03: `login.vue` `redirectTimer` 未在组件卸载时清理

**File:** `apps/auth/app/pages/login.vue:41-77`
**Issue:**
`let redirectTimer: NodeJS.Timeout | null = null` 放在 `<script setup>` 顶层、由 `watchEffect` 内部 `setTimeout` 赋值。当组件在计时器到期前被卸载（例如用户按返回），回调仍会执行并触发 `window.location.href = target` —— 此时路由已变，跳转是非预期的。另外 `watchEffect` 多次触发只会覆盖变量，但不会取消上一个定时器（当前代码会在覆盖前 `clearTimeout`，OK），**真正缺的是 unmount 清理**。
**Fix:**

```vue
<script setup lang="ts">
import { onUnmounted } from 'vue'

onUnmounted(() => {
  if (redirectTimer) {
    clearTimeout(redirectTimer)
    redirectTimer = null
  }
})
</script>
```

### WR-04: `useAuthGuard.ts` 在 movie-app / comic-app 完全重复

**File:**
- `apps/movie-app/src/composables/useAuthGuard.ts:1-24`
- `apps/comic-app/src/composables/useAuthGuard.ts:1-24`

**Issue:**
两个文件逐字节相同（均 24 行），只是 `useUserStore` import 路径指向各自 app。Phase 02 已经同时把登录拦截接入 `useFavorites` / `MovieDetail.vue`，后续若再接入历史、进度、评分等场景必然会修改这段逻辑，双份维护极易飘移。
**Fix:**
把 composable 提升到共享包（例如 `packages/ui` 或新建 `packages/auth-client`），并把 `useUserStore` 作为入参注入，避免耦合具体 app 的 store：

```ts
// packages/auth-client/src/useAuthGuard.ts
export function createAuthGuard(getUser: () => unknown | null) {
  return function useAuthGuard() {
    function requireLogin(nextPath?: string): boolean {
      if (getUser())
        return true
      const target = nextPath ?? (window.location.pathname + window.location.search)
      window.location.href = `/auth/login?next=${encodeURIComponent(target)}`
      return false
    }
    return { requireLogin }
  }
}
```

然后每个 app 用自家 store 绑定：`export const useAuthGuard = createAuthGuard(() => useUserStore().user)`。

## Info

### IN-01: `injectGithubIdIntoSession` 的 `userId` 参数未使用

**File:** `apps/api/src/lib/auth.ts:40-45`
**Issue:** 函数签名接收 `userId`，函数体完全不读它。调用方（line 105）传了 `user.id` 但只是为了对齐签名。
**Fix:** 删掉 `userId` 参数、简化调用，避免误以为函数里有校验：

```ts
export function injectGithubIdIntoSession(
  githubAccount: { accountId: string } | undefined,
): string | null {
  return githubAccount?.accountId ?? null
}
```

### IN-02: `sameSite` 三元式全部落到 `'lax'`

**File:** `apps/api/src/lib/auth.ts:125`
**Issue:** `sameSite: isLocalDev ? 'lax' : (isHttps ? 'lax' : 'lax')` 三条分支都是 `'lax'`，要么是历史遗留、要么是本该区分 `none` 的逻辑被误删。
**Fix:** 直接写 `sameSite: 'lax'`；若确实需要区分跨站场景，按 Better Auth 推荐补上。

### IN-03: `Number.parseInt(yearFrom)` 缺 radix 且无 NaN 保护

**File:** `apps/api/src/routes/public/movies/index.ts:102, 107, 112, 116`
**Issue:** `Number.parseInt(yearFrom)` 省了 radix；若 valibot schema 未强制为数字字符串，传入 `'abc'` 会得到 `NaN`，再 `new Date(NaN, 0, 1)` → Invalid Date，`gte(movies.releaseDate, InvalidDate)` 行为依赖 Drizzle/D1 对 Date 序列化。
**Fix:** `Number.parseInt(yearFrom, 10)`，并在 `GetMoviesQuerySchema` 里用 `v.pipe(v.string(), v.regex(/^\d{4}$/))` 约束；或直接保留 schema 里的 number 类型、去掉 `parseInt`。

### IN-04: `dashboard-guard.ts` `sessionCache` 没有容量上限 / 过期条目淘汰

**File:** `apps/gateway/src/dashboard-guard.ts:7-13, 82`
**Issue:** `sessionCache: Map<string, {githubId, expiresAt}>` 只写不读清理，过期条目不会被移除；isolate 生命周期长时，随着不同 session token 进入会持续增长。对单用户自用冲击极小，但在长跑 isolate 里仍属代码异味。
**Fix:** 写入时做机会式清理（例如 size > 500 时按 `expiresAt` 淘汰），或改用 `Map` + `setInterval`（Workers 不可用）的替代——最简单是 size 上限 LRU：

```ts
if (sessionCache.size > 500) {
  for (const [k, v] of sessionCache) {
    if (v.expiresAt <= now)
      sessionCache.delete(k)
  }
}
sessionCache.set(token, { githubId, expiresAt: now + SESSION_CACHE_TTL })
```

### IN-05: `decodeURIComponent(tokenMatch[1])` 未捕获 URIError

**File:** `apps/gateway/src/dashboard-guard.ts:46`
**Issue:** 极低概率场景：如果 cookie 值含非法 `%` 序列（例如 `%ZZ`），`decodeURIComponent` 会抛 `URIError`，Gateway 当前没有 try/catch，会向上传播为 500。实际 Better Auth session token 是 `.` 分隔的 base64，出现 `%` 概率极低；但 fail-closed 行为更稳：
**Fix:**
```ts
let token: string
try { token = decodeURIComponent(tokenMatch[1]) }
catch { return { allowed: false, reason: 'no_session' } }
```

### IN-06: `login.vue` `callbackURL = window.location.href` 会把旧 `error` 参数带过 OAuth 往返

**File:** `apps/auth/app/pages/login.vue:91-99`
**Issue:** 用户第一次因 `not_admin` 被踢到登录页后，点 "Login with GitHub" 以同一账号/他账号登录，OAuth 回调仍会带 `?error=not_admin&next=...`，登录页会继续显示旧错误而不自动跳转（line 44 的 early return）。
**Fix:** 构造 `callbackURL` 时剔除 `error` 参数：

```ts
const u = new URL(window.location.href)
u.searchParams.delete('error')
const callbackURL = u.toString()
```

### IN-07: `useAuthGuard()` 在事件处理函数内部调用，而非 `setup` 顶层

**File:**
- `apps/movie-app/src/views/MovieDetail.vue:465`
- `apps/comic-app/src/composables/useFavorites.ts:62`

**Issue:** `useAuthGuard` 内部调用了 `useUserStore`（Pinia composable）。虽然在当前实现下 `pinia.useStore()` 在任意位置都能工作（有全局 active pinia），但 Vue 官方约定 composable 在 setup 顶层调用，利于未来做响应式追踪/DI。
**Fix:** 在 setup 顶层 `const { requireLogin } = useAuthGuard()`，事件里只引用 `requireLogin`。

---

_Reviewed: 2026-05-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
