# Phase 1: Auth 全链路 + Gateway 缓存安全基线 - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 12（新建 / 修改）
**Analogs found:** 11 / 12（一项为纯 version bump，无代码 analog）

## File Classification

| 新建/修改文件 | 角色 | 数据流 | 最接近 Analog | 匹配度 |
|---|---|---|---|---|
| `apps/gateway/src/cache-middleware.ts`（修改） | gateway middleware | 请求入口 / 缓存决策 | 自身（就地重构） | exact（self-refactor） |
| `apps/gateway/src/__tests__/cache-middleware.test.ts`（修改 + 新增 4 条 it） | unit test | 缓存决策验证 | 同文件 既有 `it('caches movie list responses in KV...')` @ :45-66 | exact |
| `apps/api/src/routes/auth/__tests__/signout.test.ts`（新建，`__tests__/` 目录一并建） | api route unit test | session 删除验证 | `apps/api/src/routes/public/progress/__tests__/progress.test.ts` @ :83-113 | role-match（同为 Hono<AppEnv> + mock db + mock user） |
| `apps/blog/server/middleware/session.ts`（新建） | nuxt server middleware | session 读取（SSR 预取） | `apps/blog/server/routes/feed.xml.ts` @ :1-29（`defineEventHandler` + `$fetch` + `useRuntimeConfig` + try/catch 降级） | role-partial（routes 与 middleware 同属 Nitro 层，调用模式相同） |
| `apps/auth/server/middleware/session.ts`（新建，镜像 blog） | nuxt server middleware | 同上 | 同上 + 同 phase 新建的 `apps/blog/server/middleware/session.ts` | role-partial |
| `apps/blog/app/plugins/session.ts`（新建，seed `useState('session')`） | nuxt plugin | session hydrate（SSR→CSR） | `apps/blog/app/plugins/shiki.ts` @ :1-39（`defineNuxtPlugin` 骨架） | role-match |
| `apps/auth/app/plugins/session.ts`（新建，镜像 blog） | nuxt plugin | 同上 | 同上 | role-match |
| `apps/blog/e2e/session.spec.ts`（新建） | playwright e2e | SSR HTML 登录态断言 | `apps/blog/e2e/blog-features.spec.ts` @ :75-119（`page.route('**/api/...')` mock + `page.goto` + `waitForLoadState('networkidle')`） | role-match（同 app 下的 E2E 基础设施） |
| `apps/dashboard/e2e/auth-crosspath.spec.ts`（新建） | playwright e2e | 登录后跨路径 session 共享 | `apps/dashboard/e2e/auth-flow.spec.ts` @ :14-32（`mockSession` / `interceptExternalRedirects` 工具函数） | exact（同目标：auth 相关 E2E） |
| `apps/api/package.json`（改 :23） | package config | 依赖升级 | — | pure version bump |
| `apps/auth/package.json`（改 :18） | package config | 依赖升级 | — | pure version bump |
| `apps/blog/package.json`（改 :22） | package config | 依赖升级 | — | pure version bump |
| `apps/dashboard/package.json`（改 :29） | package config | 依赖升级 | — | pure version bump |

> Planner 判断依据：一次 commit 内 4 个 `package.json` 全部从 `"better-auth": "^1.6.2"` 升到 `"^1.6.10"`，随后一次 `pnpm install` 刷新根 lockfile。

---

## Pattern Assignments

### `apps/gateway/src/cache-middleware.ts`（修改）

**Analog:** 自身（就地重构）。已存在可复用的 `resolveCachePolicy` / `decorateResponse` / `shouldCacheResponse` / `createCachedProxy` 骨架，新增逻辑直接挂在这些钩子上，不改签名。

**Imports pattern:** 本文件目前零 import（只用 Workers 全局类型 + 自身常量），改后仍然不需要新增 import。

**当前 `resolveCachePolicy` 主体**（`cache-middleware.ts:179-196`）：
```ts
export function resolveCachePolicy(request: Request, options?: CacheOptions): CachePolicy {
  const url = new URL(request.url)
  const basePolicy = resolveBasePolicy(url)

  const ttl = options?.ttl ?? basePolicy.ttl
  const shouldStore = !options?.bypassCache && basePolicy.shouldStore
  const scope: CacheScope = shouldStore ? basePolicy.scope : 'bypass'

  return {
    ...basePolicy,
    scope,
    ttl,
    shouldStore,
    cacheControl: ttl && (basePolicy.scope === 'public' || basePolicy.scope === 'private')
      ? buildCacheControl(basePolicy.scope, ttl, basePolicy.staleWhileRevalidate)
      : basePolicy.cacheControl,
  }
}
```

**可直接扩展的插入点（D-07 + D-10）：**
```ts
// 新增：读 header → 决定 bypass
const hasAuthHeaders = request.headers.has('cookie') || request.headers.has('authorization')
const shouldStore = !options?.bypassCache && !hasAuthHeaders && basePolicy.shouldStore
// CachePolicy 新增字段（可选）：bypassReason?: 'auth-headers' | 'path' | 'options'
```

**当前 `decorateResponse`**（`cache-middleware.ts:339-371`）已有 `CACHE_*` 头注入位；新增 `X-Cache-Reason` 直接复用这段：
```ts
headers.set(CACHE_STATUS_HEADER, cacheStatus)
headers.set(CACHE_GROUP_HEADER, policy.group)
headers.set(CACHE_POLICY_HEADER, policy.scope)
```

**需要删除的块（D-12/D-13/D-14）：**
| 行号 | 动作 | 依据 |
|---|---|---|
| `:12` `CacheScope` | 删 `'private'` | D-13 |
| `:13` `CacheGroup` | 删 `'favorites'` | D-13 |
| `:49` `PRIVATE_CACHE_PREFIXES` | 整行删 | D-12 |
| `:53-62` `buildCacheControl` | 签名收窄为 `scope: 'public'`，删 `:54` private 分支 | D-13 |
| `:142-151` `resolveBasePolicy` private 分支 | 整块删 | D-12 |
| `:208-210` `createCacheKey` `userScope` | 整块删（`hashValue` 函数本体 `:81-90` 保留） | D-12 / D-14 |
| `:358-360` `decorateResponse` `Vary: Cookie` | 整块删 | D-12 |

**Planner 指引：** 先改 `CacheScope` / `CacheGroup` 类型，让 TypeScript 把 private 相关死代码全部标红，再按标红位置扫一遍，避免遗漏。

---

### `apps/gateway/src/__tests__/cache-middleware.test.ts`（修改 + 新增 4 条 it）

**Analog:** 同文件 `it('caches movie list responses in KV and returns HIT on repeat requests', ...)` @ :45-66

**Imports & mock 工厂**（`cache-middleware.test.ts:1-33`）— 直接复用：
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCachedProxy, invalidateCache } from '../cache-middleware'

function createMockKv() {
  const store = new Map<string, string>()
  const kv = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value) }),
    delete: vi.fn(async (key: string) => { store.delete(key) }),
    list: vi.fn(async ({ prefix, cursor }: { prefix?: string, cursor?: string } = {}) => {
      /* ... */
    }),
  } as unknown as KVNamespace
  return { kv, store }
}
```

**测试骨架模板**（照 :45-66 复制，改头与断言即可）：
```ts
it('<场景描述>', async () => {
  const { kv } = createMockKv()
  let calls = 0

  const cachedProxy = createCachedProxy(kv, async () => {
    calls += 1
    return Response.json({ calls })
  })

  const request = new Request('https://starye.org/api/movies', {
    headers: { cookie: 'starye.session_token=xxx' }, // D-11 场景 2
  })

  const response = await cachedProxy(request, 'https://api.starye.org')
  expect(response.headers.get('X-Cache-Status')).toBe('BYPASS')
  expect(response.headers.get('X-Cache-Reason')).toBe('auth-headers')
  // 验证不写 KV：再请求一次，calls 应该增加
  await cachedProxy(request, 'https://api.starye.org')
  expect(calls).toBe(2)
})
```

**需要改/删的既有测试（D-11/D-12 配套）：**
| 行号 | 动作 |
|---|---|
| `:68-106` `isolates favorites cache per user cookie` | 整块删（private scope 死代码清理） |
| `:150-160` `invalidates cache entries by prefix` | store.set 里 `'gateway-cache:v2:favorites:private:abc:...'` 需改成 public key 或其他 group |

**D-11 四条新增 it（planner 按此表落）：**
| # | 场景 | 请求 headers | 预期 |
|---|---|---|---|
| 1 | 无头 public group 仍 HIT | 无 cookie / authorization | 首次 MISS，二次 HIT，`calls=1`（复用 :45-66 既有模式，作为基线回归） |
| 2 | 带 session cookie → BYPASS | `cookie: starye.session_token=...` | `X-Cache-Status: BYPASS`，`X-Cache-Reason: auth-headers`，`calls=2`（不写 KV） |
| 3 | 带 Authorization → BYPASS | `authorization: Bearer xxx` | 同上 |
| 4 | `/api/auth/*` 无论头 → BYPASS | `/api/auth/get-session` ± cookie 两 case | 两 case 都 `X-Cache-Status: BYPASS`（`NO_STORE_PREFIXES` 独立命中） |

---

### `apps/api/src/routes/auth/__tests__/signout.test.ts`（新建）

**Analog:** `apps/api/src/routes/public/progress/__tests__/progress.test.ts` @ :1-94

> 该文件与 signout 测试同样走"构造 Hono<AppEnv> app → 注入 mock db + mock auth + mock user → 发 Request → 断 Response"路径。与 `admin/movies/__tests__/analytics.test.ts` 对比，progress 这一个 analog 的 mock 结构更精简、更贴近 auth 场景（auth 不需要 `(c as any).env = {}` 黑魔法）。

**Imports pattern**（progress.test.ts :1-10）：
```ts
import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockUser } from '../../../../test/helpers'
import { <targetRoutes> } from '../index'
```

**Test helpers 已有（`apps/api/src/test/helpers.ts`）** — 直接 import：
- `createMockAuth(sessionData?)` @ :76-82：返回 `{ api: { getSession: vi.fn().mockResolvedValue(...) } }`
- `createMockUser(overrides?)` @ :87-101：返回含 `id/email/role/isAdult/isR18Verified` 的 SessionUser
- `createMockDb()` @ :9-71：通用 Drizzle mock（对 signout 场景足够，因为 signout 只做 delete session 行）

**App 工厂模板**（progress.test.ts :83-94）：
```ts
function createApp(db: any, user?: ReturnType<typeof createMockUser> | null, auth?: any) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('auth', auth)
    if (user !== undefined) c.set('user', user as any)
    await next()
  })
  app.route('/', authRoutes) // from apps/api/src/routes/auth/index.ts
  return app
}
```

**关键断言点（AUTH-08）：**
1. `POST /sign-out` 返回 200 并触发 `auth.api.signOut`（或通过 catch-all `/*` 走到 `authInstance.handler`）
2. 响应含 `Set-Cookie` 清除头（`starye.session_token=; Max-Age=0` 或等价形式）
3. 再次 `auth.api.getSession` 返回 `null`

**判断 note：** `authRoutes` 的 `/sign-out` 实际是 catch-all `/*` 代理到 `authInstance.handler(c.req.raw)`（见 `apps/api/src/routes/auth/index.ts:83-87`）。测试时 mock `authInstance.handler` 直接返回带 `Set-Cookie` 的 Response 比构造完整 Better Auth stack 更轻量；若 planner 倾向集成测试，则需 `betterAuth()` + in-memory D1（libsql），成本显著升高，建议优先走 mock handler。

---

### `apps/blog/server/middleware/session.ts`（新建）

**Analog:** `apps/blog/server/routes/feed.xml.ts` @ :1-29（Nitro 同一家族：`defineEventHandler` + `useRuntimeConfig` + `$fetch` with `baseURL` + try/catch 降级）

**Imports & runtime config pattern**（feed.xml.ts :5-8）：
```ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl as string
  /* ... */
})
```
> `runtimeConfig.public.apiUrl` 已在 `apps/blog/nuxt.config.ts:50-55` 和 `apps/auth/nuxt.config.ts:33-38` 定义（从 `NUXT_PUBLIC_API_URL` / `VITE_API_URL` / 默认 `http://localhost:8080` 取值）。middleware 照这条路径读即可，**不要**用 `process.env` 或 `import.meta.env`。

**fetch + 降级 pattern**（feed.xml.ts :19-28）：
```ts
try {
  const res = await $fetch<...>('/api/posts', {
    baseURL: apiUrl,
    query: { limit: 50 },
  })
  posts = res.data || []
}
catch {
  posts = []
}
```

**扩展到 session middleware（D-01/D-02/D-03）：**
```ts
import { defineEventHandler, getHeader, getRequestURL } from 'h3'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  // 跳过 API 路径与静态资源
  if (url.pathname.startsWith('/api') || url.pathname.includes('.')) return

  const cookie = getHeader(event, 'cookie')
  if (!cookie) {
    event.context.session = null
    return
  }

  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl as string

  try {
    const session = await $fetch<{ user: unknown, session: unknown } | null>(
      '/api/auth/get-session',
      {
        baseURL: apiUrl,                              // D-02: 一律走 gateway
        headers: { cookie },                          // D-01: 原样 forward
        signal: AbortSignal.timeout(3000),            // D-03: 3s 超时
        retry: false,
      },
    )
    event.context.session = session ?? null
  }
  catch {
    event.context.session = null                     // D-03: 降级匿名
  }
})
```

**端点选择：** `/api/auth/get-session`（Better Auth 原生，走 `apps/api/src/routes/auth/index.ts:83-87` 的 catch-all）优于自定义的 `/api/auth/session`（:13-47），原因：(a) Better Auth 自身维护；(b) 返回结构稳定；(c) 未来升级不会被自定义逻辑挡住。

**判断 note：**
- 选 `server/middleware/` 而非 `plugins/*.server.ts`：middleware 在请求最早阶段执行，可把结果放 `event.context`；plugin 在 Nuxt app 初始化期才运行。文件名选 `session.ts`（精确），不选 `auth.ts`（容易与后端 `lib/auth-client.ts` 混淆）。
- A1 假设：`AbortSignal.timeout(3000)` 在 Cloudflare Pages Nitro `$fetch` 内可用（基于 undici）。实现时本地 `pnpm --filter blog dev` 跑一次就能验证，若不支持则回退到 `AbortController + setTimeout`。
- 不要给 middleware 加任何 KV / D1 binding 依赖 — Nuxt Worker 没有这些 binding（见 RESEARCH §Cloudflare Pages Worker Binding Constraints）。

---

### `apps/auth/server/middleware/session.ts`（新建，镜像 blog）

**Analog:** 同 phase 新建的 `apps/blog/server/middleware/session.ts`。**完全镜像**，不要 drift。

**判断 note：** `apps/auth/` 当前无 `server/` 目录（`apps/auth/server/**/*.ts` glob 为空），planner 需同时新建 `apps/auth/server/` + `apps/auth/server/middleware/` 目录层级。Nitro 自动识别，不需改 `apps/auth/nuxt.config.ts`。

---

### `apps/blog/app/plugins/session.ts`（新建）

**Analog:** `apps/blog/app/plugins/shiki.ts` @ :1-39

**Plugin 骨架**（shiki.ts :7-39）：
```ts
export default defineNuxtPlugin(async () => {
  /* setup logic */
  return { provide: { shiki: highlighter } }
})
```

**扩展到 session seed（D-04）：**
```ts
export default defineNuxtPlugin({
  name: 'session-seed',
  enforce: 'pre',
  setup() {
    const session = useState<unknown>('session', () => null)
    if (import.meta.server) {
      const event = useRequestEvent()
      session.value = event?.context.session ?? null
    }
  },
})
```

**判断 note：**
- `useState('session')` 在同一 SSR 请求内是单例，天然满足 D-04 去重。
- `enforce: 'pre'` 确保比其他 plugin 先跑，在组件用 `useSession()` 之前 state 已就绪。
- 客户端侧 Better Auth 的 `authClient.useSession()` 会自己重新拉一次（CSR 默认行为），这里 seed 只为了消除 SSR→CSR 首帧闪烁。

---

### `apps/auth/app/plugins/session.ts`（新建，镜像 blog）

**Analog:** 同 phase 新建的 `apps/blog/app/plugins/session.ts`。**完全镜像**。

**判断 note：** `apps/auth/app/plugins/` 目录当前不存在（仅 `apps/blog/app/plugins/shiki.ts` 存在），planner 需一并新建。

---

### `apps/blog/e2e/session.spec.ts`（新建）

**Analog:** `apps/blog/e2e/blog-features.spec.ts` @ :1-119（同 app 下的 E2E 基础设施：`page.route('**/api/...')` mock + `page.goto` + `waitForLoadState('networkidle')`）

**Imports pattern**（blog-features.spec.ts :1-6）：
```ts
import { expect, test } from '@playwright/test'
```

**API mock 工具模板**（blog-features.spec.ts :77-119）：
```ts
async function mockApiRoutes(page: import('@playwright/test').Page) {
  await page.route('**/api/posts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_POSTS_LIST),
    })
  })
}
```

**session mock（从 dashboard auth-flow.spec.ts :14-22 跨借）：**
```ts
async function mockSession(page: any, session: any) {
  await page.route('**/api/auth/get-session', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    }))
}
```

**SSR 断言场景（AUTH-02 + D-19 step 5）：**
1. mock `/api/auth/get-session` 返回已登录 user
2. `page.goto('/')`
3. 读 `await page.content()` 检查 HTML 中已登录标记（例如 `data-user-id` 或登录状态文案）—— 注意是 **view-source** 语义，不是 hydrated DOM
4. 或：监听 `page.waitForLoadState('networkidle')` 后无匿名→登录的闪烁过渡

**判断 note：**
- Playwright E2E 复用 blog 现有 `playwright.config.ts` 的 `baseURL: http://localhost:3002/blog` + 自动启动 dev server（见 :22-43）。
- Mock `/api/auth/get-session` 即可，不需要真的起 gateway + api。
- 参考 `apps/dashboard/e2e/auth-flow.spec.ts` 的 `mockSession` 工具而不是 blog 自己的 `mockApiRoutes`，更贴切。

---

### `apps/dashboard/e2e/auth-crosspath.spec.ts`（新建）

**Analog:** `apps/dashboard/e2e/auth-flow.spec.ts` @ :1-211（同目录下的 auth 场景 E2E，最贴切）

**Imports + mockSession + interceptExternalRedirects（auth-flow.spec.ts :10-32）** — 直接复用：
```ts
import { expect, test } from '@playwright/test'

async function mockSession(page: any, session: any) {
  await page.route('**/api/auth/get-session', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    }))
}

async function interceptExternalRedirects(page: any) {
  await page.route('**/auth/**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><div id="auth-page">Auth Page</div></body></html>',
    }))
}
```

**test case 骨架（auth-flow.spec.ts :37-52）：**
```ts
test.describe('跨子路径 session 共享', () => {
  test('登录后跨 /movie → /comic → /blog → /dashboard 仍读得到同一用户', async ({ page }) => {
    await mockSession(page, {
      user: { id: 'user-1', email: 'admin@example.com', role: 'admin' },
      session: { id: 'session-1' },
    })
    // 拦截跨域跳转，避免真实导航失败
    await interceptExternalRedirects(page)

    await page.goto('/')
    // 断言当前 SPA 读到 user-1
    // ... 切路径 ...
  })
})
```

**判断 note：**
- dashboard 的 `playwright.config.ts` `baseURL: http://localhost:5173`（单 app 视角），跨子路径需靠 `page.route()` 模拟 gateway 转发或者 `interceptExternalRedirects` 拦截跳转。
- "真实"跨 app 验证（Playwright 同时跑 movie/comic/blog/dashboard 4 个 dev server）复杂度过高，不推荐；这个 spec 覆盖 dashboard 单 app 读 session 即可，跨路径场景的剩余三端（movie/comic/blog）走手动冒烟（D-19 step 4）。

---

### `apps/{api,auth,blog,dashboard}/package.json`（4 文件 better-auth 版本 bump）

**无代码 analog** — 这是 4 个同构的字符串替换 + 一次 `pnpm install`。

**具体行号：**
| 文件 | 行号 | 当前 | 目标 |
|---|---|---|---|
| `apps/api/package.json` | `:23` | `"better-auth": "^1.6.2"` | `"better-auth": "^1.6.10"` |
| `apps/auth/package.json` | `:18` | `"better-auth": "^1.6.2"` | `"better-auth": "^1.6.10"` |
| `apps/blog/package.json` | `:22` | `"better-auth": "^1.6.2"` | `"better-auth": "^1.6.10"` |
| `apps/dashboard/package.json` | `:29` | `"better-auth": "^1.6.2"` | `"better-auth": "^1.6.10"` |

**判断 note（D-18）：**
- **必须同一 commit** 升 4 个文件 + `pnpm-lock.yaml`。不要分多 commit（中间 commit CI 会拉到漂移版本）。
- 命令：`pnpm up -r better-auth@^1.6.10`（-r 表示 workspace 全量）或手工改 4 个 package.json 后 `pnpm install`。
- 升级后必跑 `pnpm -r test && pnpm build` + D-19 六步手动冒烟。

---

## Shared Patterns

### 认证守卫已存在（Phase 1 不改）

**Source:** `apps/api/src/middleware/auth.ts` @ :5-23

**Apply to:** API Worker 所有 route；Phase 1 不在 API 侧加新的 guard，只在 Gateway 侧加 bypass。

**作用参考：**
```ts
export function authMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = createAuth(c.env, c.req.raw)
    c.set('auth', auth)
    try {
      const session = await auth.api.getSession({ headers: c.req.raw.headers })
      if (session?.user) c.set('user', session.user as unknown as SessionUser)
    }
    catch { /* 未登录 */ }
    await next()
  })
}
```

> Phase 1 的 `signout.test.ts` 如果走集成测试路径，可以挂这个中间件；走 mock handler 路径则不需要。

### 响应头注入模式（D-10 X-Cache-Reason）

**Source:** `apps/gateway/src/cache-middleware.ts:345-356` `decorateResponse` 的 header 注入段

**Apply to:** `cache-middleware.ts` 内新增的 `X-Cache-Reason` 头注入

**Pattern:**
```ts
headers.set(CACHE_STATUS_HEADER, cacheStatus)
headers.set(CACHE_GROUP_HEADER, policy.group)
headers.set(CACHE_POLICY_HEADER, policy.scope)
// 新增：
if (cacheStatus === 'BYPASS' && policy.bypassReason) {
  headers.set('X-Cache-Reason', policy.bypassReason)
}
```

> 统一用常量命名（`const CACHE_REASON_HEADER = 'X-Cache-Reason'`），与 `:44-47` 现有 `CACHE_STATUS_HEADER` 等保持风格一致。Claude's Discretion 建议：值枚举统一 `'auth-headers'`，不细分 cookie/authorization。

### Nuxt SSR $fetch + 降级模式

**Source:** `apps/blog/server/routes/feed.xml.ts:19-28`

**Apply to:** 两个新建的 `server/middleware/session.ts`

**Pattern:**
```ts
const config = useRuntimeConfig()
const apiUrl = config.public.apiUrl as string
try {
  const res = await $fetch<...>('<path>', {
    baseURL: apiUrl,
    /* ... headers / query / signal */
  })
  /* 赋值 event.context.* */
}
catch {
  /* 降级 */
}
```

### Playwright session mock 模式

**Source:** `apps/dashboard/e2e/auth-flow.spec.ts:14-22`

**Apply to:** 两个新建的 E2E spec（`apps/blog/e2e/session.spec.ts`、`apps/dashboard/e2e/auth-crosspath.spec.ts`）

**Pattern:**
```ts
async function mockSession(page: any, session: any) {
  await page.route('**/api/auth/get-session', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    }))
}
```

### Hono<AppEnv> 测试 App 工厂模式

**Source:** `apps/api/src/routes/public/progress/__tests__/progress.test.ts:83-94`

**Apply to:** 新建的 `apps/api/src/routes/auth/__tests__/signout.test.ts`

**Pattern:**
```ts
function createApp(db: any, user?: ReturnType<typeof createMockUser> | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    if (user !== undefined) c.set('user', user as any)
    await next()
  })
  app.route('/', <targetRoutes>)
  return app
}
```

> 注意：`apps/api/src/routes/admin/movies/__tests__/analytics.test.ts:52-65` 有 `(c as any).env = {}` 黑魔法（因 requireResource 中间件读 `c.env.CRAWLER_SECRET`）。signout 场景不走 requireResource，**不要**跟着抄这一行。

---

## No Analog Found

无。12 个目标文件全部有可复用的 analog 或已锁定的版本 bump 路径。

---

## Metadata

**Analog search scope:**
- `apps/gateway/src/**` — gateway middleware 与单测
- `apps/api/src/routes/**/__tests__/**` — api 路由单测
- `apps/api/src/test/helpers.ts` — 测试工具
- `apps/api/src/lib/auth.ts` + `apps/api/src/middleware/auth.ts` — Better Auth 集成参考
- `apps/blog/server/**` + `apps/auth/server/**` — Nitro 层
- `apps/blog/app/plugins/**` — Nuxt plugin 参考
- `apps/blog/e2e/**` + `apps/dashboard/e2e/**` + `apps/movie-app/e2e/**` — Playwright E2E
- `apps/{api,auth,blog,dashboard}/package.json`
- `apps/blog/nuxt.config.ts` + `apps/auth/nuxt.config.ts`
- `apps/{blog,dashboard}/playwright.config.ts`

**Files scanned:** 约 18 个源文件（精确非重叠读取）

**Pattern extraction date:** 2026-05-11
