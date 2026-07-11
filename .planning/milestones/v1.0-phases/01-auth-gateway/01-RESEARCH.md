# Phase 1: Auth 全链路 + Gateway 缓存安全基线 - Research

**Researched:** 2026-05-11
**Domain:** Cookie-based SSO across Cloudflare Pages/Workers（Better Auth + Nuxt 4 SSR + Gateway KV cache）
**Confidence:** HIGH（CONTEXT.md 已锁定全部关键决策，本研究只负责落实外部事实）

<user_constraints>
## User Constraints (from CONTEXT.md)

完整原文见 `.planning/phases/01-auth-gateway/01-CONTEXT.md:26-76`。关键锁定：

- **D-01/D-02:** Nuxt blog/auth 通过 server middleware forward cookie 到 gateway `/api/auth/get-session`，SSR fetch 走 gateway，不直连 `api.starye.org`
- **D-03:** SSR fetch 失败（超时 3s / 5xx）→ 当匿名处理
- **D-04:** 同一 SSR 请求内对 get-session 做 request-scoped 去重
- **D-05:** Cookie domain 维持 `starye.org`（无前导点），`apps/api/src/lib/auth.ts:52-54` 不改
- **D-06:** `sameSite=lax` / `secure=isHttps` / `path=/` 保持现状
- **D-07:** `resolveCachePolicy` 检测 `cookie` 或 `authorization` 头 → 强制 `shouldStore=false` + `scope=bypass`
- **D-08/D-09:** `NO_STORE_PREFIXES` 路径保留；`Set-Cookie` 响应不存缓存保留（第二层防线）
- **D-10:** 新增响应头 `X-Cache-Reason: auth-headers`
- **D-11:** 单元测试覆盖四种场景（见 Validation Architecture）
- **D-12/D-13/D-14:** 删除 `PRIVATE_CACHE_PREFIXES` / `private` scope 分支 / `userScope` hash；`CacheScope` 收窄为 `'public' | 'bypass'`；`CacheGroup` 删 `'favorites'`；`hashValue` 函数保留但移除 cookie 调用点
- **D-15/D-16/D-17:** 登出由服务端删 D1 session + 清 cookie；同浏览器其他 tab 不广播，靠 401 + redirect 自然回收
- **D-18/D-19/D-20:** 四个 package.json 同 commit `pnpm up -r better-auth@^1.6.10`；冒烟 6 步；升级前读 changelog 找 breaking change

### Claude's Discretion

- `X-Cache-Reason` 枚举粒度（`auth-headers` 统一 / `cookie-header` / `authorization-header` 分开）
- Nuxt server middleware 文件名与放置位置（`server/middleware/*.ts` vs `plugins/*.server.ts`）
- 冒烟测试自动化形态（Playwright spec vs 手动 checklist）
- pnpm 升级命令具体形式

### Deferred Ideas (OUT OF SCOPE)

- 登录态视觉统一（Phase 2 或独立 UI phase）
- BroadcastChannel / visibilitychange 跨 tab 广播
- 按 cookie 名精确匹配 bypass
- `/api/favorites` `/api/history` 显式迁入 `NO_STORE_PREFIXES`
- Better Auth major 升级（1.7.x / 2.x）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | 5 端登录后 session 互通 | Cookie domain 由 `apps/api/src/lib/auth.ts:52-54` 算成 `starye.org`；Phase 1 只需落实 Nuxt SSR 通道（D-01）+ gateway 透传 Cookie（`apps/gateway/src/index.ts:123` 只删 `host`） |
| AUTH-02 | Nuxt SSR 服务端读 session | Nuxt 4 `$fetch` SSR 默认不转发浏览器 cookie（nuxt.com/docs/4.x/api/utils/dollarfetch）— 必须显式 forward，即 D-01 方案 |
| AUTH-03 | Cookie domain=`.starye.org`/Lax/Secure | D-05 已接受"`starye.org` 与 `.starye.org` 浏览器等价"；Better Auth 1.6.x 对 `defaultCookieAttributes.domain` 处理见 Changelog 节 |
| AUTH-04 | Better Auth `^1.6.10` + 冒烟 | 1.6.3..1.6.10 逐版本审计（见 Changelog 节），**无 breaking change 影响本项目** |
| AUTH-05 | Gateway 透传 Cookie / Set-Cookie | `apps/gateway/src/index.ts:123-125` 已仅删 `host`；`X-Forwarded-Host` 已写入，现状正确 |
| AUTH-06 | `/api/auth/*` 跳过 KV | `cache-middleware.ts:50` `NO_STORE_PREFIXES` 已含 `/api/auth`；D-08 保留不动 |
| AUTH-07 | 带 Cookie/Authorization 请求 bypass | 核心新增（D-07，实现位点见 Gateway Cache Bypass 节） |
| AUTH-08 | 登出服务端真失效 | Better Auth `/api/auth/sign-out` 默认删 D1 session 行 + 回 `Set-Cookie` 清除头（`apps/api/src/routes/auth/index.ts:83-87` catch-all） |
</phase_requirements>

## Research Summary

**Planner 开工前必须先知道的 3 件事：**

1. **Better Auth 1.6.3 → 1.6.10 全部是 patch 级升级，没有 breaking change 影响本项目**（来源：`packages/better-auth/CHANGELOG.md` 全文审计，详见 Changelog 节）。1.6.7 对 2FA 路径做了 scope 调整（本项目不用 2FA）、1.6.6 收紧了 `drizzle-orm` peer 到 `^0.45.2`（本仓 `packages/db` 锁的正是 0.45.2，已满足）。可放心 `pnpm up -r better-auth@^1.6.10`。

2. **Nuxt 4 的 `$fetch` 在 SSR 默认不带 cookie — 这是 AUTH-02 的根本原因**（来源：nuxt.com/docs/4.x/api/utils/dollarfetch 官方说明："During SSR, user browser cookies are not included by default due to security risks"）。D-01 选的 server middleware 方案是把 session 预先 seed 到 `useState('session')`，避免 hydration 抖动。

3. **Cloudflare Pages 上的 Nuxt Worker 当前不能直接绑定 D1**（来源：developers.cloudflare.com/pages/functions/bindings/ — Pages Functions 能绑 D1，但本仓 `apps/blog` / `apps/auth` **没有 wrangler.toml、没有 D1 binding 声明**，见 `apps/blog/public/_routes.json`）。即使绑上也会出现"两份 Better Auth 实例"问题，违反架构一致性。因此 D-01 选"HTTP fetch 到 gateway"是架构最佳解，不是妥协。

**Primary recommendation:** 严格按 CONTEXT.md D-01..D-20 执行。本研究所有外部事实都支撑既有决策，无需重开讨论。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cookie 签发 / 清除 | API Worker | — | Better Auth 只在 `apps/api` 实例化，cookie 权威源 |
| Session 校验（读） | API Worker | Nuxt Server（SSR forward） | D1 binding 只在 API Worker；Nuxt 通过 HTTP 读 |
| Gateway 缓存策略 | Gateway Worker | — | KV 绑定在 gateway，按 header 决定 bypass |
| SPA hydration 态 | Browser | Nuxt Server | SPA 用 `authClient.useSession()` 直拉；SSR 页预先 seed |
| 登出联动 | API Worker | Browser | 服务端删 session + 清 cookie；跨 tab 靠 401 自然回收（D-16） |
| Cookie domain 裁决 | API Worker | — | `createAuth(env, request)` 里动态计算（`apps/api/src/lib/auth.ts:52-54`） |

## Better Auth 1.6.3 → 1.6.10 Changelog

> 来源：`https://github.com/better-auth/better-auth/blob/main/packages/better-auth/CHANGELOG.md`（已下载全文审阅）；版本发布时间经 `npm view better-auth time --json` 核对。
> 结论：**7 个版本全部 Patch 级，无 breaking change 触及本项目 cookie / session / drizzleAdapter**。

### 1.6.3 `[patch]` — 2026-04-14
- PR #9131：harden dynamic `baseURL` handling for direct `auth.api.*` calls；baseURL 无法 resolve 现抛 `APIError` 而非空串。**本项目影响：** `createAuth` 显式传 `baseURL`（`apps/api/src/lib/auth.ts:46`），不受影响
- PR #9122：fix(two-factor) enforce 2FA on all sign-in paths — **该 PR 在 1.6.4 被 revert**
- PR #9072：`requestPasswordResetCallback` 对齐 OpenAPI — 不影响
- PR #8389：fix(open-api) `get-session` nullable schema for OAS 3.1 — 仅影响 `/api/docs` 展示
- PR #9078：fix(client) prevent `isMounted` race condition — 浏览器端优化

### 1.6.4 `[patch]` — 2026-04-15
- **PR #9205：revert #9122** — 2FA 强制范围恢复为仅 `/sign-in/email` `/sign-in/username` `/sign-in/phone-number`。本项目未启用 2FA，无关
- **PR #9165：require `drizzle-orm@^0.45.2` 和 `kysely@^0.28.14`**。本仓 `packages/db` 锁的正是 `drizzle-orm@0.45.2`（见 CLAUDE.md Key Dependencies），peer 满足。⚠️ 若后续调整 drizzle-orm 版本，1.6.4+ 会发 install-time warning（非 fatal）

### 1.6.5 `[patch]` — 2026-04-16
- fix(client) refetch session after `/change-password` 和 `/revoke-other-sessions`。本项目 GitHub OAuth 无密码流，不受影响

### 1.6.6 `[patch]` — 2026-04-21
- PR #9235：Preserve `Partitioned` attribute。本项目未配 `Partitioned`，无关
- **PR #9226：Consolidate host/IP classification** — 新增 `@better-auth/core/utils/host`；`isLoopbackHost` 不再把 `0.0.0.0` 当 loopback；`getTrustedOrigins` 修正 `127.0.0.1.nip.io` 这类假 loopback。**本项目影响：** `apps/api/src/lib/auth.ts:50` 自己写了 `isLocalDev` 判断，不依赖 better-auth 内部 host 分类；`getAllowedOrigins(env)` 传给 Better Auth 后对非 loopback origin 行为不变

### 1.6.7 `[patch]` — 2026-04-22
- **PR #9211：Preserve `Set-Cookie` headers when endpoint throws `APIError`** — `/api/auth/sign-out` 如果中间抛 `APIError`，`deleteSessionCookie` 设置的清除头不再丢失。**对本项目有益**
- PR #9292：Accept array of Client IDs on Google/Apple/Microsoft Entra/Facebook/Cognito。本项目只用 GitHub，无关
- PR #9293：Guard against `c.body` being undefined in `parseState` — OAuth callback 作为 GET 时的崩溃路径修复

### 1.6.8 `[patch]` — 2026-04-23
- PR #9253：fix(organization) `beforeCreateTeam` / `beforeCreateInvitation` 透传 id。本项目未用 organization 插件，无关
- PR #9331：fix(oauth) `mapProfileToUser` fallback for providers that may omit email — `GithubProfile.email` 类型变 `string \| null`。本项目未在 `socialProviders.github` 自定义 `mapProfileToUser`（`apps/api/src/lib/auth.ts:89-94`），不需改动

### 1.6.9 `[patch]` — 2026-04-24
- 仅 Updated dependencies，无 better-auth 自身改动

### 1.6.10 `[patch]` — 2026-05-09（latest）
- **PR #9497：Endpoints that set cookies before redirecting no longer emit each `Set-Cookie` entry twice** — OAuth 回调 / magic-link 响应里重复 `Set-Cookie` 被消除。**对本项目有益**（修一类偶发 cookie 丢失）
- PR #9387：bearer plugin 合并 Cookie 头去重。本项目未用 bearer，无关
- PR #9475：fix(username) respect `callbackURL`。不用 username 流，无关
- PR #9440：Clear organization active hook state after sign-out。未用 organization 插件，无关
- PR #9503：`internalAdapter.deleteAccount` 参数 `accountId` → `id`。仅内部 adapter，不影响公开 API
- PR #9268：openAPI schema for POST `/sign-in/social` 修正。仅文档层
- PR #8339：fix(captcha) email-otp flow。未用 captcha，无关
- PR #9484：fix warn for cookie-plugin being last in array。本项目未显式加 cookie 插件，无警告

### 风险汇总

- Breaking change：**0 项**
- 需要配套代码改动：**0 项**
- 顺手收益：1.6.7 + 1.6.10 两次 `Set-Cookie` 修复对登录/登出路径有稳定性提升
- 建议：升级后按 D-19 六步冒烟验证 cookie 流

## Nuxt 4 SSR Session Channel

### 默认行为（为什么需要本节）

Nuxt 4 官方文档明确：
> When `$fetch` is called in the browser, user headers like `cookie` are sent directly to the API. However, during SSR, user browser cookies are **not included by default due to security risks**.
>
> — https://nuxt.com/docs/4.x/api/utils/dollarfetch

### 两种合规实现（D-01 选 B）

**A. 组件侧 `useRequestFetch()`** — 每页重复，且只对相对路径自动 forward
**B. Server middleware 预取 + `useState` seed**（D-01 采纳）— 集中处理，SPA hydrate 后 `authClient.useSession()` 立即读到同 state，不闪烁

### 最小可用实现：`apps/blog/server/middleware/session.ts`

```ts
// 运行时：Nitro（cloudflare-pages preset）
// 作用：SSR 阶段预取 /api/auth/get-session 并挂到 event.context.session
// 客户端 hydrate 时由 plugins/session.ts 同步到 useState('session')

import { defineEventHandler, getHeader, getRequestURL } from 'h3'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  // 只处理 SSR 页面请求；API / 资源跳过
  if (url.pathname.startsWith('/api') || url.pathname.includes('.')) {
    return
  }

  const cookie = getHeader(event, 'cookie')
  if (!cookie) {
    event.context.session = null
    return
  }

  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl // 来自 nuxt.config.ts runtimeConfig

  try {
    const session = await $fetch<{ user: unknown, session: unknown } | null>(
      `${apiUrl}/api/auth/get-session`,
      {
        headers: { cookie },
        signal: AbortSignal.timeout(3000), // D-03: 3s 超时
        retry: false,
      },
    )
    event.context.session = session ?? null
  }
  catch {
    // D-03: 网络/超时/5xx → 降级匿名，不阻塞渲染
    event.context.session = null
  }
})
```

**端点选择说明**：Better Auth 原生是 `/api/auth/get-session`（kebab-case）。本项目 `apps/api/src/routes/auth/index.ts:13-47` 额外实现了自定义的 `/api/auth/session`；catch-all（同文件 `:83-87`）把 `/api/auth/get-session` 代理给 `authInstance.handler`。**建议统一走 `/api/auth/get-session`**（原生、结构稳定、不依赖自定义逻辑）。

### 客户端 hydrate：`apps/blog/app/plugins/session.ts`

```ts
export default defineNuxtPlugin({
  name: 'session-seed',
  enforce: 'pre',
  async setup() {
    const session = useState<unknown>('session', () => null)
    if (import.meta.server) {
      const event = useRequestEvent()
      session.value = event?.context.session ?? null
    }
  },
})
```

D-04 的 request-scoped 去重天然满足：`useState('session')` 在同一 SSR 请求内是单例，middleware 里的 `$fetch` 只执行一次。

### 为什么选 `server/middleware/` 而非 `plugins/*.server.ts`

- `server/middleware/` 在每个请求最早阶段执行，先于页面/组件，能把结果放进 `event.context`
- `plugins/*.server.ts` 在 Nuxt app 初始化期运行（晚于 middleware），拿 cookie 要走 `useRequestHeaders(['cookie'])` 绕一圈
- 源：https://nuxt.com/docs/4.x/directory-structure/server

### `apps/auth` 需要同样的 middleware + plugin 对

`apps/auth/` 当前无 `server/` 目录。新建 `apps/auth/server/middleware/session.ts` 会自动被 Nitro 识别，不需改 `nuxt.config.ts`。`apps/auth/app/plugins/` 目录也需新建（目前只有 `apps/blog/app/plugins/shiki.ts` 存在）。

## Cloudflare Pages Worker Binding Constraints

### 事实核对

- **Cloudflare Pages Functions 支持 D1 绑定** — 官方文档列出：https://developers.cloudflare.com/pages/functions/bindings/
- **但本项目 Nuxt 应用没有声明 D1 绑定** — `apps/blog` / `apps/auth` 无 `wrangler.toml`；`apps/blog/public/_routes.json` 仅 `/blog/*` 走 Functions；本仓只有 `apps/api/wrangler.toml` 和 `apps/gateway/wrangler.toml` 里有 D1 `[[d1_databases]]`
- **即使绑上 D1，也会破坏架构一致性** — Better Auth 在 Nuxt 上下文里实例化意味着两份 `createAuth(env, request)` 副本（api + nuxt-ssr），两份 secret / schema 绑定、两处 cookie 配置，一旦漂移就是隐蔽 bug

### 结论

HTTP fetch 到 gateway 是架构最佳解。D-01 决策正确。参考：

- https://developers.cloudflare.com/pages/functions/bindings/
- https://content.nuxt.com/docs/deploy/cloudflare-pages
- https://hub.nuxt.com/docs/getting-started/deploy（NuxtHub 证明绑 D1 到 Nuxt 需要额外配置）

## Gateway Cache Bypass Implementation

本节定位 D-07 / D-10 / D-12 / D-13 的精确代码改动位点（全在 `apps/gateway/src/cache-middleware.ts`）。

### D-07：请求头触发 bypass（核心新增）

**位点：`cache-middleware.ts:179-196` `resolveCachePolicy`**

当前（`:184-185`）：
```ts
const ttl = options?.ttl ?? basePolicy.ttl
const shouldStore = !options?.bypassCache && basePolicy.shouldStore
```

扩展为（示意）：
```ts
const hasAuthHeaders = request.headers.has('cookie') || request.headers.has('authorization')
const ttl = options?.ttl ?? basePolicy.ttl
const shouldStore = !options?.bypassCache && !hasAuthHeaders && basePolicy.shouldStore
```

并把"为什么 bypass"通过返回值透出 — 建议给 `CachePolicy` 加 `bypassReason?: 'auth-headers' | 'options' | 'path'`，供 `decorateResponse` 注入 `X-Cache-Reason`。

**Workers runtime 语义验证**：
- Cloudflare Workers 的 `Request.headers` 在 `fetch` handler 入口是客户端原始头，**`cookie` 不被平台剥离**（`apps/gateway/src/index.ts:123-125` 已依赖该行为，现网可行；官方文档 https://developers.cloudflare.com/workers/runtime-apis/fetch/ 未列为剥离头）
- `Authorization` 头同理
- **潜在坑**：`new Response(response.body, response)`（`apps/gateway/src/index.ts:141`）重建响应后 `headers.get('set-cookie')` 在 Workers runtime 只返回第一个值；但 `shouldCacheResponse` 用 `headers.has('set-cookie')`，只要存在任一就 true，**D-09 防线对多个 Set-Cookie 场景仍成立**

### D-10：`X-Cache-Reason` 响应头

**位点：`cache-middleware.ts:339-371` `decorateResponse`**

当前 `:346-353` 已注入一组 `X-Cache-*` 头。新增（示意）：
```ts
if (cacheStatus === 'BYPASS' && policy.bypassReason) {
  headers.set('X-Cache-Reason', policy.bypassReason)
}
```

**Claude's Discretion 建议值**：统一 `auth-headers`。原因：单用户排障不需要区分 cookie/authorization；值越少越不易成为侧信道。若 planner 坚持细分，四档够用：`auth-headers` / `no-store-path` / `set-cookie-response` / `cache-bypass-option`。

### D-12 / D-13：私有 scope 死代码清理

| 删除位点 | 行号（当前） | 内容 |
|----------|-----------|------|
| 类型定义 | `:12` | `CacheScope` 删 `'private'`，保留 `'public' \| 'bypass'` |
| 类型定义 | `:13` | `CacheGroup` 删 `'favorites'` |
| 常量 | `:49` | 整行删 `const PRIVATE_CACHE_PREFIXES = ['/api/favorites', '/api/history']` |
| buildCacheControl | `:53-62` | 签名收窄为 `scope: 'public'`，删 `scope === 'private'` 分支（`:54`） |
| resolveBasePolicy | `:142-151` | 整块删 `if (PRIVATE_CACHE_PREFIXES.some(...))`（落入 `:153` `/api` 默认 bypass） |
| resolveCachePolicy | `:192-194` | `basePolicy.scope === 'private'` 条件简化（只剩 `'public'`） |
| createCacheKey | `:208-210` | 删 `userScope = hashValue(cookie)` 分支 |
| decorateResponse | `:358-360` | 删 `if (policy.scope === 'private')` 的 `Vary: Cookie` 分支 |

### D-14：保留 `hashValue` 函数

`:81-90` 函数体保留；唯一调用点 `:209` 随 D-12 一起删。未来如果静态资源需要按 URL 做 hash 分片可复用。

### 测试同步更新

- `apps/gateway/src/__tests__/cache-middleware.test.ts:68-106` `isolates favorites cache per user cookie` 整块删除或重写为"bypass on cookie header"
- `:150-160` `invalidateCache` mock 里 `'gateway-cache:v2:favorites:private:abc:...'` 键改成真实 public 路径或其他 group

## Existing Code Audit

按"文件:行号 — Phase 1 动作"梳理。所有读取基于本次 research 直接读过的文件。

### apps/gateway/src/cache-middleware.ts — 改动核心

| 行号 | 当前内容 | Phase 1 动作 | 决策 |
|------|---------|-------------|------|
| 12 | `type CacheScope = 'public' \| 'private' \| 'bypass'` | 删 `'private'` | D-13 |
| 13 | `type CacheGroup` 含 `'favorites'` | 删 `'favorites'` | D-13 |
| 49 | `const PRIVATE_CACHE_PREFIXES = [...]` | 整行删 | D-12 |
| 50 | `const NO_STORE_PREFIXES = [...]` | **保持不动** | D-08 |
| 53-62 | `buildCacheControl(scope, ttl, swr)` | 签名收窄 | D-13 |
| 142-151 | `resolveBasePolicy` private 分支 | 整块删 | D-12 |
| 179-196 | `resolveCachePolicy` 主体 | 新增 `hasAuthHeaders` 检测 → `shouldStore=false, scope='bypass', bypassReason='auth-headers'` | D-07 |
| 208-210 | `createCacheKey` userScope 分支 | 整块删 | D-12 |
| 216-222 | `shouldCacheResponse`（`set-cookie` 屏蔽） | **保持不动**（防线） | D-09 |
| 339-371 | `decorateResponse` | 新增 `X-Cache-Reason` 注入；删 `Vary: Cookie` 分支 | D-10 / D-12 |

### apps/gateway/src/index.ts — 不改
- `:123-125` 删 `host` 头，保留其他（Cookie/Authorization 透传）— 满足 AUTH-05
- `:141` `new Response(response.body, response)` — 注意只透传第一个 `Set-Cookie`，但 D-09 防线用的是 `.has()`，无问题

### apps/gateway/src/__tests__/cache-middleware.test.ts — 测试同步

| 行号 | 动作 | 决策 |
|------|------|------|
| 68-106 `isolates favorites cache per user cookie` | 删整个 it，替换为 D-11 四条新测试 | D-11, D-12 |
| 150-160 `invalidates cache entries by prefix` | 修改 mock 里的 private key 为新 scope | D-13 |

### apps/api/src/lib/auth.ts — 不改
- `:34-55` `createAuth(env, request)` cookieDomain/baseURL/sameSite 计算维持
- `:52-54` `cookieDomain = new URL(env.WEB_URL).hostname.replace('www.', '')` — D-05 接受等价语义，不改
- `:97-107` `advanced.defaultCookieAttributes`（`cookiePrefix: 'starye'`, `sameSite: 'lax'`, `secure: isHttps`, `domain: cookieDomain`, `path: '/'`）— 满足 AUTH-03 + D-06

### apps/api/src/routes/auth/index.ts — 不改
- `:13-47` 自定义 `/api/auth/session` GET（保留，但 Nuxt SSR 建议走 Better Auth 原生 `/api/auth/get-session`）
- `:83-87` catch-all 代理到 `authInstance.handler` — Better Auth 原生端点唯一挂载点

### apps/api/package.json — 改 1 行
- `:19` `"better-auth": "^1.6.2"` → `"^1.6.10"`（D-18）

### apps/auth/package.json — 改 1 行
- `better-auth` 行 `^1.6.2` → `^1.6.10`（D-18）
- `apps/auth/app/lib/auth-client.ts:1-11` 不改（baseURL 已从 `VITE_API_URL` 取指向 gateway）

### apps/blog/package.json — 改 1 行
- `"better-auth": "^1.6.2"` → `"^1.6.10"`（D-18）

### apps/blog/app/lib/auth-client.ts — 不改
- `:5-9` `baseURL` 已从 `VITE_API_URL` 构造走 gateway，符合 D-02
- `:13-22` `useSession()` 类型断言保持 — SSR 改造通过 server middleware 预取 + `useState` 完成

### apps/blog/server/middleware/session.ts — 新建
- 内容见 Nuxt 4 SSR Session Channel 节示例
- Claude's Discretion：文件名 `session.ts`（`auth.ts` 也可，但 `session` 更精确）

### apps/blog/app/plugins/session.ts — 新建
- 内容见 Nuxt 4 SSR Session Channel 节示例
- Nuxt 4 plugin 目录规范：`apps/blog/app/plugins/`（对照已存在的 `shiki.ts`）

### apps/auth/server/middleware/session.ts — 新建（镜像 blog）
- `apps/auth/` 当前无 `server/` 目录，需一并新建

### apps/auth/app/plugins/session.ts — 新建（镜像 blog）
- `apps/auth/app/` 当前无 `plugins/` 目录，需一并新建

### apps/auth/app/lib/auth-client.ts — 不改
- `:5-9` 已从 `VITE_API_URL` 取 baseURL，符合 D-02

### apps/dashboard/package.json — 改 1 行
- `"better-auth": "^1.6.2"` → `"^1.6.10"`（D-18）

### apps/dashboard/src/lib/auth-client.ts — 不改
- `:3-8` 用 `window.location.origin` 构造 baseURL — 浏览器端同域，天然走 gateway，SPA 不走 SSR，无需 middleware

### 不触碰清单（CONCERNS 标记的脆弱区）
- `apps/gateway/src/cache-middleware.ts:425-447` `invalidateCache` — 不改
- `apps/api/src/middleware/service-auth.ts` CRAWLER_SECRET 明文 — 不改
- `apps/movie-app/src/composables/useAria2.ts` localStorage 凭据 — 不改

## Runtime State Inventory

本 phase 是代码重构（cache policy 简化 + private scope 删除） + 依赖升级，无 DB schema / 存储 key / OS 注册态迁移，但 **KV 缓存有过期数据残留窗口**。

| 类别 | 发现 | 需要动作 |
|------|------|---------|
| Stored data (KV) | Gateway KV 可能残留 `gateway-cache:v2:favorites:private:<hash>:...` 形式旧 key（`cache-middleware.ts:198-212` 当前键格式）。部署后不再写/读，最多 TTL 到期消失（`:146` favorites TTL=60s + swr=30s，≤90s） | **不主动清理**。KV 自然过期。如需保险可部署后手工跑 `invalidateCache(kv, 'gateway-cache:v2:favorites:')` |
| Stored data (D1) | Better Auth `session` / `user` / `account` / `verification` 表 | **不动**。1.6.3→1.6.10 无 schema 变更 |
| Live service config | 无（Gateway 配置全在代码 + wrangler.toml） | — |
| OS-registered state | 无 | — |
| Secrets/env vars | `BETTER_AUTH_SECRET` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `WEB_URL` | **不动**。升级不需要轮换 |
| Build artifacts | `apps/api/.wrangler/`、`apps/gateway/.wrangler/`、`apps/blog/.output/`、`apps/auth/.output/`、`apps/dashboard/dist/` | 重新 build（`pnpm build` Turbo 任务处理） |

**关键澄清**：D-18 要求四个 package.json 同 commit 升级 = pnpm lockfile 同 commit 更新。**不要分多个 commit**，否则跨 commit 的 CI 会拉到版本漂移的 better-auth。

## Validation Architecture

> Nyquist Dimension 8：Phase 1 可验证不变量 + 测试矩阵。

### Test Framework

| Property | Value |
|----------|-------|
| 单测框架 | Vitest ^4.1.4（各 app 独立配置） |
| 主要单测位点 | `apps/gateway/src/__tests__/cache-middleware.test.ts` |
| E2E 框架 | Playwright ^1.59.1（`apps/blog/e2e/`、`apps/dashboard/e2e/`、`apps/movie-app/e2e/` 已存在） |
| 快速运行（per commit） | `pnpm --filter gateway test`、`pnpm --filter api test` |
| 全套（per wave / phase gate） | `pnpm -r test && pnpm --filter blog test:e2e && pnpm --filter dashboard test:e2e` |

### Phase Requirements → Test Map

| Req | 可验证不变量 | 测试类型 | 自动化命令 | 已存在？ |
|-----|-------------|---------|-----------|---------|
| AUTH-01 | 同 cookie 跨 gateway 路径 `/api/auth/get-session` 返回同 user.id | Playwright E2E + 手动 | `pnpm --filter dashboard test:e2e -- auth.spec.ts` | ❌ Wave 0 |
| AUTH-02 | Nuxt blog SSR HTML 含已登录 user 标记 | Playwright E2E（view-source） | `pnpm --filter blog test:e2e` | ❌ Wave 0 |
| AUTH-03 | `/api/auth/sign-in/social/github` callback 响应 `Set-Cookie` 含 `Domain=starye.org`（或按 D-05 无 Domain 等价） | 手动 curl smoke | curl + grep | ✅ 手动 |
| AUTH-04 | 四 app `package.json` better-auth=^1.6.10；lockfile 一致；build + 冒烟通过 | CI + 手动 | `pnpm install --frozen-lockfile && pnpm build` | ✅ CI |
| AUTH-05 | Gateway proxy 后上游请求可见原 `Cookie` 头 | Vitest 单测（mock 上游 echo） | `pnpm --filter gateway test -- routing.test.ts` | ✅ 扩展 |
| AUTH-06 | Gateway `/api/auth/*` 任意路径返回 `X-Cache-Status: BYPASS` | Vitest 单测 | `pnpm --filter gateway test -- cache-middleware.test.ts` | ✅ 扩展 |
| AUTH-07 | Gateway 任意路径带 cookie/authorization → `X-Cache-Status: BYPASS` + `X-Cache-Reason: auth-headers` | Vitest 单测（D-11 四条） | 同上 | ❌ Wave 0 |
| AUTH-08 | signOut 后再 get-session 返回 `null`，响应带 `Set-Cookie` 清除头 | Vitest 集成 + E2E | `pnpm --filter api test` | ❌ Wave 0 |

### D-11 测试矩阵（AUTH-07 核心）

在 `apps/gateway/src/__tests__/cache-middleware.test.ts` 新建：

| # | 场景 | 请求 | 预期 |
|---|------|------|------|
| 1 | 无头 + public group | GET `/api/movies` 无 cookie、无 authorization | 首次 MISS，二次 HIT |
| 2 | 带 session cookie + public group | GET `/api/movies` `cookie: starye.session_token=xxx` | BYPASS，`X-Cache-Reason: auth-headers`，不写 KV |
| 3 | 带 Authorization + public group | GET `/api/movies` `authorization: Bearer xxx` | BYPASS，`X-Cache-Reason: auth-headers`，不写 KV |
| 4 | `/api/auth/*` | GET `/api/auth/get-session` 有/无 cookie 两个子 case | 都 BYPASS（`NO_STORE_PREFIXES` 命中） |

### Sampling Rate

- **Per task commit**：`pnpm --filter <affected> test`
- **Per wave merge**：`pnpm -r test`
- **Phase gate**：完整 6 步冒烟（D-19）+ 全套自动化测试绿

### Wave 0 Gaps（实现前补齐）

- [ ] `apps/gateway/src/__tests__/cache-middleware.test.ts` 新增 D-11 四条 it
- [ ] `apps/blog/e2e/session.spec.ts` — 覆盖 AUTH-01 / AUTH-02（SSR HTML 登录态）
- [ ] `apps/dashboard/e2e/auth-crosspath.spec.ts` — 覆盖 AUTH-01（登录后跨 `/movie → /comic → /blog → /dashboard`）
- [ ] `apps/api/src/routes/auth/__tests__/signout.test.ts`（`__tests__` 目录不存在则一并建）— 覆盖 AUTH-08
- [ ] 冒烟 checklist（D-19 六步）以 Markdown 追加到 PLAN 或 RUNBOOK

### Manual Smoke Checklist（D-19 原文）

1. 未登录访问 `/movie/` → 正常浏览公开目录
2. 从 `/auth/login` GitHub 登录 → 跳回发起页
3. 刷新当前页 → 仍登录
4. 跨子路径 `/movie → /comic → /blog → /dashboard` → 所有 SPA 读得到同一用户
5. Nuxt SSR `/blog/` view-source 检查是否带已登录标记（或 SSR HTML 中无闪烁的匿名态）
6. 点登出 → `/api/auth/sign-out` 返回 200 + `Set-Cookie` 清除 → 刷新任一前端变回匿名

## Security Domain

### 适用 ASVS 类别

| ASVS | 适用 | 本 phase 控件 |
|------|------|--------------|
| V2 Authentication | 是 | Better Auth `^1.6.10` + GitHub OAuth，仅升版本 |
| V3 Session Management | 是 | Better Auth session 由 D1 权威存储；cookie HttpOnly / Secure / SameSite=Lax（`apps/api/src/lib/auth.ts:97-107`） |
| V4 Access Control | 否（本 phase） | Phase 2 的 `requireAuth` 才是主战场 |
| V5 Input Validation | 否 | 无新增用户输入路径 |
| V6 Cryptography | 否 | 无新增加密代码；Better Auth 内部已用 scrypt |

### 威胁模型

| 模式 | STRIDE | 本 phase 缓解 |
|------|--------|--------------|
| 缓存投毒（把已登录响应塞进匿名缓存槽位） | Tampering / Information Disclosure | D-07：带头即 bypass（读写两端）；D-09：`Set-Cookie` 响应不存；D-12：删 private scope 后无机会按 cookie hash 切片 |
| 跨用户响应泄漏（匿名读到别人缓存） | Information Disclosure | D-07 + D-12 联合消除：匿名无头走 public policy 读公开缓存，带头 bypass |
| Cookie 跨子域漂移 | Tampering | D-05：cookie domain 固定 `starye.org`（等价 `.starye.org`）；`*.pages.dev` 301 由 PUBSEC-05（Phase 2）处理 |
| 登出后 session 复活 | Elevation | D-15：sign-out 删 D1 行 + 清 cookie；即使其他 tab 持旧 cookie（D-16），下次请求被 401（D1 已无 row） |
| 缓存绕过 CSRF（伪 cookie 触发 MISS 写入） | Tampering | D-09：上游带 `Set-Cookie` 直接不存；D-07：带 cookie 请求先于 KV 写入已被拦截 |

### 升级安全性收益
- 1.6.7：`APIError` 路径 `Set-Cookie` 不再丢失（登出路径更稳）
- 1.6.10：重复 `Set-Cookie` 消除（OAuth 回调更稳）

### 不在本 phase 范围
- `/api/auth/sign-in` 速率限制（PUBSEC-03 → Phase 2）
- `/api/docs` 生产鉴权（PUBSEC-04 → Phase 2）
- `*.pages.dev` 301（PUBSEC-05 → Phase 2）

## Assumptions Log

| # | 主张 | 位置 | Risk if Wrong |
|---|------|------|--------------|
| A1 | `AbortSignal.timeout(3000)` 在 Cloudflare Pages Nitro `$fetch` 里可用 | Nuxt 4 SSR Session Channel 节 | **[ASSUMED]** — 基于 undici 默认支持。若 runtime 不支持，fallback 用 `AbortController` + `setTimeout`。Planner 实现时验证一次（成本：一次本地 run） |
| A2 | 本仓除 `packages/db` 外无其他包 pin `drizzle-orm` 到早于 0.45.2 | Better Auth Changelog 1.6.4 节 | **[ASSUMED]** — 未全仓 grep。Planner 实现前跑 `grep -r "drizzle-orm" apps packages --include package.json`（成本：一条命令） |
| A3 | Better Auth `/api/auth/get-session` 返回 `{ user, session } \| null` 结构稳定 | Nuxt 4 SSR Session Channel 节 | VERIFIED：`apps/api/src/routes/auth/index.ts:31-40` 的自定义端点返回同构，`better-auth/vue` 客户端也按此消费。**非 assumption** |
| A4 | Cloudflare Workers runtime 不剥离 client `Cookie` / `Authorization` 头 | Gateway Cache Bypass 节 | VERIFIED：`apps/gateway/src/index.ts:123-125` 透传依赖此行为，现网运行；官方文档未列为剥离头。**非 assumption** |
| A5 | Nuxt plugin 目录是 `apps/blog/app/plugins/` | Nuxt 4 SSR Session Channel 节 | VERIFIED：`apps/blog/app/plugins/shiki.ts` 已存在。**非 assumption** |

**汇总**：真正的 assumption 只 2 条（A1、A2），都是低风险、验证成本低的事项。

## Risks & Open Questions

### 高风险
无（CONTEXT.md 已锁定全部关键决策，changelog 审计零 breaking change）

### 中风险

1. **KV 缓存残留 key 消失时间窗**
   - 旧 `gateway-cache:v2:favorites:private:...` key 部署后最多 90s TTL 过期
   - 这期间 `createCacheKey` 已按新 scheme 生成键，不会读旧 key，**无行为问题**，仅短暂存储残留
   - 建议：不主动清理，TTL 自然回收

2. **SSR 超时 3s 是否过长**
   - Workers 单请求 30s 上限，3s 给同边缘内的 `/api/auth/get-session` 足够 10x margin
   - 但 API Worker cold start 叠加 D1 cold query 可能接近 3s tail
   - 缓解：降级匿名后用户仍能看到内容，仅短暂状态错（显示"未登录"），可接受

3. **1.6.10 的 Set-Cookie 修复是否改变 `shouldCacheResponse` 判断**
   - 消除重复条目后 `headers.has('set-cookie')` 返回值不变（1 个或 2 个都 true）
   - 风险为零，但值得在 D-11 测试矩阵加一条回归：sign-in 回调响应仍不被缓存

### 低风险 / Open Questions

1. **`X-Cache-Reason` 粒度（Claude's Discretion）**
   - 建议：统一 `auth-headers`
   - 若细分，四档：`auth-headers` / `no-store-path` / `set-cookie-response` / `cache-bypass-option`
   - **RESOLVED:** 采用多档枚举：`auth-headers` / `no-store-path` / `non-cacheable-group` / `set-cookie-response` / `cache-bypass-option`（比建议多一档 `non-cacheable-group`，用于 `/api` 默认 bypass 与 misc/static-assets；`set-cookie-response` 由 Step 11 强制触发，不是死码）。Implemented by 01-02 (planner revision W3 升格 Step 11 为必做)。

2. **冒烟测试形态：Playwright vs 手动（Claude's Discretion）**
   - 已有 3 个 Playwright 基础设施
   - 建议：登录 + 跨子路径（step 4）、SSR view-source（step 5）自动化；GitHub OAuth 回调自动化成本高，保留手动
   - 建议产物：3/6 自动化 + 3/6 手动 checklist 写进 RUNBOOK（Phase 5）
   - **RESOLVED:** 混合策略。自动化覆盖：gateway cache-middleware D-11 四条（AUTH-06/07）、blog SSR session.spec 三条（AUTH-02）、dashboard auth-crosspath 一条（AUTH-01）、api signout 三条（AUTH-08），共 11 条。手动 6 步 checklist 覆盖 GitHub OAuth 完整往返 + DevTools Set-Cookie 观测（AUTH-03）+ Nuxt SSR view-source + 跨 tab 自然回收（D-16）。Implemented by 01-01 骨架 + 01-06 SMOKE-CHECKLIST.md。

3. **是否同 PR 升级 Better Auth 和重构 Gateway**
   - D-18 要求四个 package.json 同 commit；"升级 commit"与"Gateway 重构 commit"可分开
   - 建议顺序：(a) 先 Gateway 重构（D-07/D-10/D-12/D-13 + 新测试）→ 独立 PR → 部署验证缓存行为 → (b) Better Auth 升级 + Nuxt SSR middleware 新建 → 独立 PR
   - 理由：两次独立回滚位点
   - **RESOLVED:** 归入同一 phase 的不同 plan（01-02 Gateway 重构 vs 01-04 Better Auth 升级 vs 01-03 Nuxt SSR middleware），合入策略由 orchestrator 按需决定独立 PR 或合并 PR。依赖图保证两者不冲突（不同 files_modified）；Plan 06 的冒烟作为 phase gate 在两者都合入后执行。Implemented by 01-02 / 01-03 / 01-04 分离。

4. **`apps/auth` 无 `server/` 目录**
   - 新建 `apps/auth/server/middleware/session.ts` 需同时新建 `server/` 目录
   - Nitro 自动识别，不需改 `nuxt.config.ts`
   - 源：https://nuxt.com/docs/4.x/directory-structure/server
   - **RESOLVED:** Plan 03 Task 2 一并新建 `apps/auth/server/` 与 `apps/auth/server/middleware/` 两级目录，内容逐字镜像 `apps/blog` 对应文件（仅允许 JSDoc 注释 "Blog" → "Auth" 的文本差异）；同时补齐 `apps/auth/nuxt.config.ts` 的 `runtimeConfig.public.apiUrl`（若缺失），与 blog 对齐。Implemented by 01-03 Task 2。

## Sources

### Primary (HIGH confidence)

- `https://github.com/better-auth/better-auth/blob/main/packages/better-auth/CHANGELOG.md` — 1.6.3..1.6.10 全文审计
- Context7 `/better-auth/better-auth` — `defaultCookieAttributes` / `crossSubDomainCookies` / `drizzleAdapter` 文档
- Context7 `/websites/nuxt_4_x` — `$fetch` SSR cookie / `useState` / `defineEventHandler` / `useRequestFetch` 文档
- `https://nuxt.com/docs/4.x/api/utils/dollarfetch` — SSR 不默认转发 cookie 权威说明
- `https://nuxt.com/docs/4.x/directory-structure/server` — server middleware 放置规范
- `https://developers.cloudflare.com/pages/functions/bindings/` — Pages Functions 绑定清单
- `https://developers.cloudflare.com/workers/runtime-apis/fetch/` — Workers fetch API
- 本地代码：`apps/gateway/src/cache-middleware.ts`、`apps/gateway/src/index.ts`、`apps/api/src/lib/auth.ts`、`apps/api/src/routes/auth/index.ts`、`apps/api/src/config.ts`、`apps/{blog,auth,dashboard}/app/lib/auth-client.ts`、`apps/{blog,auth}/nuxt.config.ts`、各 app `package.json`
- `npm view better-auth time --json` — 1.6.3..1.6.10 发布日期（2026-04-14 ~ 2026-05-09）

### Secondary (MEDIUM confidence)

- `https://content.nuxt.com/docs/deploy/cloudflare-pages` — Nuxt Cloudflare Pages 部署说明
- `https://hub.nuxt.com/docs/getting-started/deploy` — NuxtHub D1/KV/R2 绑定

### Tertiary (LOW confidence)
- 无（关键主张均有 HIGH/MEDIUM 来源）

## Metadata

**Confidence breakdown:**
- Standard stack：HIGH — Phase 1 不引入新依赖（仅升版本）
- Architecture：HIGH — CONTEXT.md 锁定，Research 仅验证外部前提
- Pitfalls：HIGH — Better Auth changelog 全量审计 + 本仓代码审计
- Validation：MEDIUM — 矩阵已列但 Wave 0 需新建多个 spec/test
- Better Auth Upgrade：HIGH — 7 个 patch 版本零 breaking change

**Research date:** 2026-05-11
**Valid until:** 2026-06-10（约 30 天，前提是 Better Auth 未发 1.7.x major）

---
*Research for Phase 1 auth-gateway completed: 2026-05-11*
