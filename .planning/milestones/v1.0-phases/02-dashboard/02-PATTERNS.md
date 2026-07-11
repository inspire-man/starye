# Phase 2: Dashboard 访问控制 + 前台登录门控 + 公网暴露面加固 - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 14
**Analogs found:** 14 / 14

## File Classification

| 新建/修改文件 | Role | Data Flow | 最近 Analog | 匹配质量 |
|---|---|---|---|---|
| `apps/gateway/src/index.ts`（修改：加 `/robots.txt` + dashboard 拦截） | middleware | request-response | 自身现有路由分支结构 | exact |
| `apps/gateway/src/dashboard-guard.ts`（新建） | middleware | request-response | `apps/gateway/src/cache-middleware.ts` | role-match |
| `apps/api/src/middleware/guard.ts`（修改：白名单短路） | middleware | request-response | 自身现有 `requireAuth` | exact |
| `apps/api/src/lib/auth.ts`（修改：additionalFields 加 githubId） | config | request-response | 自身现有 `additionalFields` 块 | exact |
| `apps/api/src/services/adult-filter.ts`（新建） | service | transform | `apps/api/src/routes/actors/services/auth.service.ts` | role-match |
| `apps/api/src/routes/public/movies/index.ts`（修改：统一调用 adult-filter） | route | CRUD | 自身现有 conditions 数组模式 | exact |
| `apps/api/src/routes/public/comics/index.ts`（修改：统一调用 adult-filter） | route | CRUD | `apps/api/src/routes/public/movies/index.ts` | exact |
| `apps/api/src/routes/public/search/index.ts`（修改：WHERE 过滤 bug 修复） | route | request-response | 自身现有 r18Filter 构造（有 bug） | exact |
| `apps/api/src/index.ts`（修改：/api/docs + /api/openapi.json 加 requireAuth） | config | request-response | 自身现有路由链 + `requireAuth` 用法 | exact |
| `apps/movie-app/src/composables/useAuthGuard.ts`（新建） | composable | request-response | `apps/movie-app/src/composables/useFavorites.ts` | role-match |
| `apps/comic-app/src/composables/useAuthGuard.ts`（新建） | composable | request-response | `apps/comic-app/src/composables/useFavorites.ts` | role-match |
| `apps/movie-app/src/views/MovieDetail.vue`（修改：toggleFavorite 插入 requireLogin） | component | request-response | 自身现有 `toggleFavorite` 函数 | exact |
| `apps/auth/app/pages/login.vue`（修改：next 参数 + 同源校验） | component | request-response | 自身现有 `redirectPath` computed | exact |
| `apps/{movie-app,comic-app,dashboard,blog,auth,tavern}/public/_redirects`（修改/新建） | config | — | `apps/movie-app/public/_redirects` 现有 SPA fallback | exact |
| `apps/gateway/wrangler.toml` + `apps/api/wrangler.toml`（修改：加 ADMIN_GITHUB_ID） | config | — | 自身现有 `[vars]` 块 | exact |
| `apps/gateway/src/__tests__/dashboard-guard.test.ts`（新建） | test | — | `apps/api/src/middleware/__tests__/` 下现有 vitest 测试 | role-match |
| `apps/api/src/services/__tests__/adult-filter.test.ts`（新建） | test | — | `apps/api/src/routes/actors/services/auth.service.ts` 对应测试模式 | role-match |

## Pattern Assignments

### `apps/gateway/src/index.ts`（修改：加 `/robots.txt` 路由 + dashboard 前置拦截）

**Analog:** 自身现有路由分支结构（`apps/gateway/src/index.ts` lines 22-108）

**Env 接口扩展模式**（lines 11-20）：
```typescript
interface Env {
  API_ORIGIN?: string
  DASHBOARD_ORIGIN?: string
  // ... 现有字段保留
  ADMIN_GITHUB_ID?: string  // 新增：逗号分隔的 GitHub ID 白名单
}
```

**路由分支核心模式**（lines 39-59）：
```typescript
// 在所有 proxy 分支之前 match /robots.txt（D-15）
if (path === '/robots.txt') {
  return new Response(
    'User-agent: *\nDisallow: /dashboard\nDisallow: /auth\nDisallow: /api\n',
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  )
}

// /dashboard 分支：在 cachedProxy 调用之前执行鉴权（D-01）
if (path.startsWith('/dashboard')) {
  if (path === '/dashboard') {
    return Response.redirect(`${url.origin}/dashboard/`, 301)
  }
  const authResult = await checkDashboardAuth(request, env)
  if (!authResult.allowed) {
    const next = encodeURIComponent(url.pathname + url.search)
    const errorParam = authResult.reason === 'not_admin' ? '&error=not_admin' : ''
    return Response.redirect(`${url.origin}/auth/login?next=${next}${errorParam}`, 302)
  }
  const target = isLocal ? 'http://localhost:5173' : (env.DASHBOARD_ORIGIN || 'http://localhost:5173')
  const pathRewrite = isLocal ? undefined : (p: string) => p.replace(/^\/dashboard/, '') || '/'
  return cachedProxy(request, target, pathRewrite, { bypassCache: true, executionCtx: ctx })
}
```

**X-Robots-Tag 注入模式**（在 proxy 函数末尾或 cachedProxy 返回后包装）：
```typescript
// 在 proxy() 函数内，fetch 返回后注入响应头
const response = await fetch(newRequest)
const mutableHeaders = new Headers(response.headers)
if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/api/admin')) {
  mutableHeaders.set('X-Robots-Tag', 'noindex, nofollow')
}
return new Response(response.body, { status: response.status, statusText: response.statusText, headers: mutableHeaders })
```

**要新增的要点：**
- `/robots.txt` 路由必须在所有 `if (path.startsWith(...))` 分支之前，避免被 blog fallback 捕获
- `checkDashboardAuth` 函数从 `dashboard-guard.ts` 导入，保持 `index.ts` 简洁
- `ADMIN_GITHUB_ID` 加入 `Env` 接口，与 `wrangler.toml` 声明对齐
- X-Robots-Tag 注入在 `proxy()` 函数内（lines 111-146），对 `/dashboard/*` 和 `/api/admin/*` 生效
- 现有 `bypassCache: true` 对 dashboard 已设置，不要移除

---

### `apps/gateway/src/dashboard-guard.ts`（新建）

**Analog:** `apps/gateway/src/cache-middleware.ts`（模块顶层常量 + 纯函数导出模式）

**模块结构模式**（参考 cache-middleware.ts lines 1-57）：
```typescript
// 模块顶层：Worker 实例生命周期内有效的 L1 缓存（D-02）
interface CachedSession {
  githubId: string
  expiresAt: number
}
const sessionCache = new Map<string, CachedSession>()
const SESSION_CACHE_TTL = 30_000 // 30s，固定不配置化

// 纯函数：白名单判断（D-03）
export function isInAdminWhitelist(githubId: string, adminEnv?: string): boolean {
  if (!adminEnv) return false
  return adminEnv.split(',').map(s => s.trim()).includes(String(githubId))
}
```

**主函数导出模式**（参考 cache-middleware.ts `createCachedProxy` 函数签名）：
```typescript
export interface DashboardAuthResult {
  allowed: boolean
  reason?: 'no_session' | 'not_admin'
}

export async function checkDashboardAuth(
  request: Request,
  env: { API_ORIGIN?: string, ADMIN_GITHUB_ID?: string },
): Promise<DashboardAuthResult> {
  const cookie = request.headers.get('cookie') || ''
  // cookie 名称：starye.session_token（来自 auth.ts cookiePrefix: 'starye'）
  const tokenMatch = cookie.match(/starye\.session_token=([^;]+)/)
  if (!tokenMatch) return { allowed: false, reason: 'no_session' }

  const token = decodeURIComponent(tokenMatch[1])
  const now = Date.now()
  const cached = sessionCache.get(token)
  if (cached && cached.expiresAt > now) {
    return isInAdminWhitelist(cached.githubId, env.ADMIN_GITHUB_ID)
      ? { allowed: true }
      : { allowed: false, reason: 'not_admin' }
  }

  const apiOrigin = env.API_ORIGIN || 'http://127.0.0.1:8787'
  let data: any
  try {
    const resp = await fetch(`${apiOrigin}/api/auth/get-session`, { headers: { cookie } })
    if (!resp.ok) return { allowed: false, reason: 'no_session' }
    data = await resp.json()
  }
  catch {
    return { allowed: false, reason: 'no_session' }
  }

  if (!data?.user) return { allowed: false, reason: 'no_session' }
  // githubId 来自 Better Auth additionalFields（需先在 auth.ts 中配置）
  const githubId = String(data.user.githubId || '')
  if (!githubId) return { allowed: false, reason: 'not_admin' }

  sessionCache.set(token, { githubId, expiresAt: now + SESSION_CACHE_TTL })
  return isInAdminWhitelist(githubId, env.ADMIN_GITHUB_ID)
    ? { allowed: true }
    : { allowed: false, reason: 'not_admin' }
}
```

**要新增的要点：**
- `sessionCache` 是模块级 `Map`，Worker 实例生命周期内有效，冷启动重建（D-02）
- cookie 名称 `starye.session_token` 来自 `auth.ts` 的 `cookiePrefix: 'starye'`（已验证）
- `githubId` 依赖 Better Auth `additionalFields` 暴露，需先修改 `auth.ts`（见下文）
- `fetch` 调用直连 `API_ORIGIN`，绕过 cache-middleware（不走 `cachedProxy`）
- 导出 `isInAdminWhitelist` 供 API 侧 `guard.ts` 复用（D-04）

---

### `apps/api/src/middleware/guard.ts`（修改：白名单短路分支）

**Analog:** 自身现有 `requireAuth`（`apps/api/src/middleware/guard.ts` lines 1-40）

**现有核心模式**（lines 11-40，完整文件）：
```typescript
import type { AppEnv, SessionUser } from '../types'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

export function requireAuth(requiredRole?: string | string[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = c.get('auth')
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (!session || !session.user) {
      throw new HTTPException(401, { message: 'Unauthorized: Please login first' })
    }

    const user = session.user as SessionUser

    if (requiredRole) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
      // Super admin always passes
      if (user.role === 'super_admin' || user.role === 'admin') {
        await next()
        return
      }
      if (!roles.includes(user.role)) {
        throw new HTTPException(403, { message: `Forbidden: Requires one of [${roles.join(', ')}] role` })
      }
    }

    await next()
  })
}
```

**白名单短路插入位置**（在 `user.role === 'super_admin'` 判断之前）：
```typescript
// D-04：ADMIN_GITHUB_ID 白名单命中即视为 super_admin，覆盖 DB role
if (requiredRole && user.githubId) {
  const adminIds = c.env.ADMIN_GITHUB_ID
  if (adminIds && adminIds.split(',').map((s: string) => s.trim()).includes(String(user.githubId))) {
    await next()
    return
  }
}
```

**要新增的要点：**
- 白名单短路插入在 `if (requiredRole)` 块内、`user.role === 'super_admin'` 判断之前
- `user.githubId` 依赖 `SessionUser` 类型新增 `githubId?: string` 字段（需同步修改 `apps/api/src/types.ts`）
- `c.env.ADMIN_GITHUB_ID` 需在 `apps/api/src/lib/auth.ts` 的 `Env` 接口中声明
- 不新增中间件，只扩展现有 `requireAuth` 函数内部逻辑

---

### `apps/api/src/lib/auth.ts`（修改：additionalFields 加 githubId）

**Analog:** 自身现有 `additionalFields` 块（`apps/api/src/lib/auth.ts` lines 69-73）

**现有 additionalFields 模式**（lines 68-85）：
```typescript
user: {
  additionalFields: {
    role: { type: 'string' },
    isAdult: { type: 'boolean' },
    isR18Verified: { type: 'boolean' },
  },
},
callbacks: {
  session: async ({ session, user }: { session: schema.Session, user: schema.User }) => {
    return {
      session,
      user: {
        ...user,
        isAdult: !!user.isAdult,
        isR18Verified: !!user.isR18Verified,
      },
    }
  },
},
```

**新增 githubId 的模式**（在 `additionalFields` 和 `callbacks.session` 两处同时修改）：
```typescript
user: {
  additionalFields: {
    role: { type: 'string' },
    isAdult: { type: 'boolean' },
    isR18Verified: { type: 'boolean' },
    githubId: { type: 'string' },  // 新增：从 account 表注入
  },
},
callbacks: {
  session: async ({ session, user }: { session: schema.Session, user: schema.User }) => {
    // 从 account 表查询 GitHub ID（providerId='github' 的 accountId）
    const db = createDb(/* 需从闭包获取 env.DB */)
    const githubAccount = await db.query.account.findFirst({
      where: (a, { and, eq }) => and(eq(a.userId, user.id), eq(a.providerId, 'github')),
    })
    return {
      session,
      user: {
        ...user,
        isAdult: !!user.isAdult,
        isR18Verified: !!user.isR18Verified,
        githubId: githubAccount?.accountId ?? null,
      },
    }
  },
},
```

**要新增的要点：**
- `callbacks.session` 已有闭包访问 `env`（`createAuth(env, request)` 工厂函数），可用 `createDb(env.DB)` 查 account 表
- `account.accountId` 字段存储 GitHub 数字 ID（字符串形式），与 `ADMIN_GITHUB_ID` env var 对比时统一用 `String()` 转换
- `Env` 接口（lines 13-31）需新增 `ADMIN_GITHUB_ID?: string` 字段
- `SessionUser` 类型（`apps/api/src/types.ts` line 15）需新增 `githubId?: string | null`

---

### `apps/api/src/services/adult-filter.ts`（新建）

**Analog:** `apps/api/src/routes/actors/services/auth.service.ts`（纯函数 service 模式）

**Analog 核心模式**（auth.service.ts lines 1-14，完整文件）：
```typescript
import type { SessionUser } from '../../../types'

export function checkUserAdultStatus(user?: SessionUser): boolean {
  if (!user) return false
  return !!(user.isAdult || user.isR18Verified || user.role === 'admin')
}
```

**新文件模式**（对齐 `checkUserAdultStatus` 语义，D-07）：
```typescript
import type { SessionUser } from '../types'
import { eq } from 'drizzle-orm'

// 支持所有含 isR18 列的表（movies / comics / actors / publishers）
type TableWithR18 = { isR18: any }

/**
 * 构造成人内容可见性 WHERE 条件。
 * 与 checkUserAdultStatus 语义对齐：admin/super_admin 角色或 isR18Verified=true 可见全部。
 *
 * @returns Drizzle SQL 条件（push 进 conditions[]），或 undefined（无需过滤）
 */
export function buildAdultVisibilityCondition(
  user: SessionUser | undefined,
  table: TableWithR18,
) {
  // 对齐 checkUserAdultStatus：admin 角色也可见 R18（D-07 Open Question #2 解答）
  if (user?.isR18Verified || user?.role === 'admin' || user?.role === 'super_admin') {
    return undefined
  }
  return eq(table.isR18, false)
}
```

**调用方模式**（已在 `public/movies/index.ts` line 52-55 验证）：
```typescript
const conditions: SQL[] = []
const adultCond = buildAdultVisibilityCondition(user, movies)
if (adultCond) conditions.push(adultCond)
// ... 其他条件
const whereClause = conditions.length > 0 ? and(...conditions) : undefined
```

**要新增的要点：**
- 函数签名用 `TableWithR18` 结构类型而非 union，避免导入所有表类型
- 语义与 `checkUserAdultStatus` 对齐：`admin`/`super_admin` 角色也返回 `undefined`（可见全部）
- 不使用 `sql.raw()`，只用 Drizzle `eq()`（CONCERNS.md SQL 注入风险规避）
- 文件放 `apps/api/src/services/`，与 `auth.service.ts` 同层级但不同目录（services 是顶层服务目录）

---

### `apps/api/src/routes/public/movies/index.ts`（修改：统一调用 adult-filter）

**Analog:** 自身现有 conditions 数组模式（lines 52-55，已正确实现）

**现有正确模式**（lines 52-55）：
```typescript
const conditions: SQL[] = []
if (!user?.isR18Verified) {
  conditions.push(eq(movies.isR18, false))
}
```

**替换为统一调用模式**：
```typescript
import { buildAdultVisibilityCondition } from '../../../services/adult-filter'

const conditions: SQL[] = []
const adultCond = buildAdultVisibilityCondition(user, movies)
if (adultCond) conditions.push(adultCond)
```

**要修改的要点：**
- list handler（line 52）、recommended handler（lines 268、334、373）、detail handler 的 related movies 查询（lines 505、530、566）共 6 处内联 `!user?.isR18Verified` 判断，统一替换为 `buildAdultVisibilityCondition` 调用
- genres handler（line 200）使用 sql 模板字符串的 r18Filter，保持现有模式不改（sql 模板不走 sql.raw，无注入风险）
- 只改 import 和条件构造，不改查询结构

---

### `apps/api/src/routes/public/search/index.ts`（修改：WHERE 过滤 bug 修复）

**Analog:** 自身现有代码（lines 31-63），当前有 bug

**现有 bug 模式**（lines 33-63）：
```typescript
// BUG：r18Filter 构造正确，但 WHERE 子句没有使用它
const r18Filter = user?.isR18Verified ? undefined : eq(movies.isR18, false)
results.movies = await db.select({...}).from(movies)
  .where(
    r18Filter
      ? or(eq(movies.code, keyword), like(movies.title, keyword))
      : or(eq(movies.code, keyword), like(movies.title, keyword)),
    // 两个分支完全相同，r18Filter 根本没有被 AND 进去
  )
  .limit(limitNum)
// 然后又在应用层过滤（line 61-63）
if (r18Filter && results.movies) {
  results.movies = results.movies.filter(m => !m.isR18)
}
```

**修复后的正确模式**：
```typescript
import { buildAdultVisibilityCondition } from '../../../services/adult-filter'

const adultCond = buildAdultVisibilityCondition(user, movies)
const searchCond = or(eq(movies.code, keyword), like(movies.title, keyword))
results.movies = await db.select({...}).from(movies)
  .where(adultCond ? and(adultCond, searchCond) : searchCond)
  .limit(limitNum)
// 删除应用层 filter（lines 61-63）
```

**要修改的要点：**
- 删除应用层 `.filter(m => !m.isR18)` 代码（lines 61-63）
- r18Filter 变量替换为 `buildAdultVisibilityCondition` 调用
- WHERE 子句用 `and(adultCond, searchCond)` 正确组合两个条件
- limit 语义恢复正确：数据库层过滤后再 limit，不会出现"limit 10 但只返回 3 条"的问题

---

### `apps/api/src/index.ts`（修改：/api/docs + /api/openapi.json 加 requireAuth）

**Analog:** 自身现有路由链（lines 56-80）+ `requireAuth` 在其他路由的用法

**现有 /api/openapi.json 挂载模式**（lines 81-196，无鉴权）：
```typescript
.get('/api/openapi.json', openAPIRouteHandler(app, { documentation: {...} }))
.get('/api/docs', Scalar({...}))
```

**修改后模式**（在两个路由前插入 requireAuth）：
```typescript
import { requireAuth } from './middleware/guard'

// OpenAPI 文档（D-17：requireAuth 保护，匿名 401）
.get('/api/openapi.json', requireAuth(['admin', 'super_admin']), openAPIRouteHandler(app, { documentation: {...} }))
.get('/api/docs', requireAuth(['admin', 'super_admin']), Scalar({...}))
```

**要修改的要点：**
- Hono 路由链支持在 handler 前插入中间件，语法为 `.get(path, middleware, handler)`
- `requireAuth(['admin', 'super_admin'])` 白名单短路后自动通过（D-04）
- 不用 env 开关，本地和生产都保护（D-17）
- `requireAuth` 已在文件顶部 import，无需新增 import

---

### `apps/movie-app/src/composables/useAuthGuard.ts`（新建）

**Analog:** `apps/movie-app/src/composables/useFavorites.ts`（composable 结构模式）

**Analog 结构模式**（useFavorites.ts lines 1-10，函数签名 + store 依赖）：
```typescript
import type { Favorite } from '../types'
import { computed, ref } from 'vue'
import { favoritesApi } from '../lib/api-client'

export function useFavorites(options: UseFavoritesOptions = {}) {
  const loading = ref(false)
  return { loading, ... }
}
```

**新文件模式**（D-11/D-12/D-14）：
```typescript
import { useUserStore } from '../stores/user'

/**
 * 登录门控 composable。
 * requireLogin() 返回 false 时已执行跳转，调用方应立即 return。
 */
export function useAuthGuard() {
  const userStore = useUserStore()

  /**
   * 检查登录态，未登录则跳转到登录页并返回 false。
   * @param nextPath 登录后回弹路径，默认为当前页
   */
  function requireLogin(nextPath?: string): boolean {
    if (userStore.user) return true
    const target = nextPath ?? (window.location.pathname + window.location.search)
    window.location.href = `/auth/login?next=${encodeURIComponent(target)}`
    return false
  }

  return { requireLogin }
}
```

**要新增的要点：**
- 只依赖 `useUserStore`，不发 API 请求（store 在 app 初始化时已 fetch）
- `window.location.href` 跳转（D-11），不用 Vue Router push（跨 app 跳转需要完整页面导航）
- 函数名 `requireLogin` 而非 `checkAuth`，语义更明确（调用方 `if (!requireLogin()) return`）
- 设计为下期可复用：`nextPath` 参数支持 Phase 4 历史/进度场景传入自定义路径

---

### `apps/comic-app/src/composables/useAuthGuard.ts`（新建）

**Analog:** `apps/comic-app/src/composables/useFavorites.ts`（lines 1-4，import 风格）

**Analog import 模式**（comic-app useFavorites.ts lines 1-4）：
```typescript
import { error as showError, success as showSuccess } from '@starye/ui'
import { ref } from 'vue'
import { favoritesApi } from '../lib/api-client'
```

**新文件模式**（与 movie-app 版本结构相同，store 路径待确认）：
```typescript
import { useUserStore } from '../stores/user'  // 需确认 comic-app 的 user store 路径

export function useAuthGuard() {
  const userStore = useUserStore()

  function requireLogin(nextPath?: string): boolean {
    if (userStore.user) return true
    const target = nextPath ?? (window.location.pathname + window.location.search)
    window.location.href = `/auth/login?next=${encodeURIComponent(target)}`
    return false
  }

  return { requireLogin }
}
```

**要新增的要点：**
- 先确认 `apps/comic-app/src/stores/user.ts` 是否存在；若不存在，需新建或从 movie-app 复用
- 两个 app 的 `useAuthGuard` 实现完全相同，planner 可选择放 `packages/ui` 共用（需确认 packages/ui 是否已有 Pinia 依赖）
- comic-app 的 `toggleFavorite`（useFavorites.ts line 60）需在调用前插入 `requireLogin()` 检查

---

### `apps/movie-app/src/views/MovieDetail.vue`（修改：toggleFavorite 插入 requireLogin）

**Analog:** 自身现有 `toggleFavorite` 函数（lines 462-484）

**现有模式**（lines 462-466，无登录检查）：
```typescript
async function toggleFavorite() {
  if (!movie.value || favoritingLoading.value)
    return
  favoritingLoading.value = true
  // 直接操作收藏...
}
```

**修改后模式**（D-13）：
```typescript
import { useAuthGuard } from '../composables/useAuthGuard'

async function toggleFavorite() {
  const { requireLogin } = useAuthGuard()
  if (!requireLogin()) return  // 未登录 → 跳转登录页，early return
  if (!movie.value || favoritingLoading.value)
    return
  favoritingLoading.value = true
  // 原有收藏逻辑不变...
}
```

**要修改的要点：**
- `useAuthGuard()` 在函数体内调用（不在 setup 顶层），符合 Vue 3 composable 在事件处理器内调用的惯例
- `requireLogin()` 返回 false 时函数已触发页面跳转，`return` 确保后续逻辑不执行
- `MovieCard.vue` 的收藏按钮同样需要插入（D-13），模式相同

---

### `apps/auth/app/pages/login.vue`（修改：next 参数 + 同源校验）

**Analog:** 自身现有 `redirectPath` computed（lines 22-26）

**现有模式**（lines 22-26，只读 redirect 参数，无同源校验）：
```typescript
const redirectPath = computed(() => {
  const path = route.query.redirect as string || '/'
  return path.startsWith('http') ? path : (path.startsWith('/') ? path : `/${path}`)
})
```

**修改后模式**（D-14，同时支持 next 和 redirect，加同源校验）：
```typescript
const redirectPath = computed(() => {
  // 同时支持 next（Phase 2 新增）和 redirect（向后兼容 dashboard router.beforeEach）
  const raw = (route.query.next || route.query.redirect) as string || '/'
  // 同源校验：防止 open redirect（D-14）
  try {
    const target = new URL(raw, window.location.origin)
    if (target.origin !== window.location.origin) return '/'
  }
  catch {
    return '/'
  }
  return raw.startsWith('/') ? raw : `/${raw}`
})
```

**error 参数扩展**（lines 14-18，加 not_admin 错误文案）：
```typescript
const error = computed(() => {
  const err = route.query.error as string
  if (err === 'not_admin') return '此账号没有管理员权限。'  // D-05 新增
  if (err === 'insufficient_permissions') return '权限不足：需要管理员身份。'
  return err
})
```

**要修改的要点：**
- `redirectPath` 优先读 `next`，fallback 到 `redirect`（向后兼容 dashboard 的 ?redirect= 参数）
- 同源校验用 `new URL(raw, window.location.origin).origin === window.location.origin`
- `not_admin` 错误文案对应 Gateway D-05 的 `?error=not_admin` 参数
- `watchEffect` 中的跳转逻辑（lines 31-67）不需要修改，`redirectPath` 已处理好安全路径

---

### `apps/{movie-app,comic-app,dashboard,blog,auth,tavern}/public/_redirects`（修改/新建）

**Analog:** `apps/movie-app/public/_redirects`（现有 SPA fallback，line 2）

**现有模式**（所有 4 个已存在文件内容相同）：
```
# SPA fallback - 所有非文件请求都返回 index.html
/* /index.html 200
```

**修改后模式**（跨域 301 规则必须在 SPA fallback 之前，D-16）：
```
# *.pages.dev 直链 301 回 starye.org（必须在 SPA fallback 之前）
https://starye-movie.pages.dev/* https://starye.org/movie/:splat 301!

# SPA fallback（保留原有规则）
/* /index.html 200
```

**各 app 的具体规则**：
```
# apps/movie-app/public/_redirects
https://starye-movie.pages.dev/* https://starye.org/movie/:splat 301!
/* /index.html 200

# apps/comic-app/public/_redirects
https://starye-comic.pages.dev/* https://starye.org/comic/:splat 301!
/* /index.html 200

# apps/dashboard/public/_redirects
https://starye-dashboard.pages.dev/* https://starye.org/dashboard/:splat 301!
/* /index.html 200

# apps/blog/public/_redirects（blog 走 blog.starye.org 自定义域，兜底防直链）
https://starye-blog.pages.dev/* https://starye.org/blog/:splat 301!
/* /index.html 200

# apps/auth/public/_redirects（新建文件，auth 目前无此文件）
https://starye-auth.pages.dev/* https://starye.org/auth/:splat 301!
/* /index.html 200

# apps/tavern/public/_redirects（若文件不存在则新建）
https://starye-tavern.pages.dev/* https://starye.org/tavern/:splat 301!
/* /index.html 200
```

**要修改的要点：**
- `301!` 末尾的 `!` 表示强制重定向，优先级高于 SPA fallback
- 跨域 301 规则必须写在 `/* /index.html 200` 之前（Cloudflare Pages 按顺序匹配）
- `apps/auth` 目前无 `public/_redirects` 文件，需新建（Nuxt 4 的 `public/` 目录会被复制到 `.output/public/`）
- `apps/tavern` 是否存在需 planner 确认；`wrangler.toml` 中 `TAVERN_ORIGIN` 已声明，说明 app 存在
- 6 个 app 在同一 commit 内统一加完，避免遗漏（D-16）

---

### `apps/gateway/wrangler.toml` + `apps/api/wrangler.toml`（修改：加 ADMIN_GITHUB_ID）

**Analog:** 自身现有 `[vars]` 块

**gateway/wrangler.toml 现有模式**（lines 9-18）：
```toml
[vars]
API_ORIGIN = "https://api.starye.org"
AUTH_ORIGIN = "https://starye-auth.pages.dev"
DASHBOARD_ORIGIN = "https://starye-dashboard.pages.dev"
# ...
```

**修改后模式**（在 `[vars]` 块末尾追加注释占位，实际值走 wrangler secret）：
```toml
[vars]
API_ORIGIN = "https://api.starye.org"
# ... 现有 vars 保留 ...
# ADMIN_GITHUB_ID 通过 wrangler secret put 注入，不在此明文配置
# 本地开发：在 .dev.vars 中设置 ADMIN_GITHUB_ID=<your_github_id>
```

**api/wrangler.toml 修改模式**（在现有 `[vars]` 块末尾追加）：
```toml
[vars]
WEB_URL = "https://starye.org"
ADMIN_URL = "https://dashboard.starye.org"
# ADMIN_GITHUB_ID 通过 wrangler secret put 注入，不在此明文配置
```

**要修改的要点：**
- `ADMIN_GITHUB_ID` 不写入 `[vars]`（明文），只加注释说明需要 `wrangler secret put`
- 两个 Worker 都需要声明：gateway 用于拦截，api 用于 `requireAuth` 白名单短路（D-03）
- 本地开发在 `apps/gateway/.dev.vars` 和 `apps/api/.dev.vars` 中设置
- `Env` 接口（`apps/gateway/src/index.ts` line 11 和 `apps/api/src/lib/auth.ts` line 13）需同步新增 `ADMIN_GITHUB_ID?: string`

---

### `apps/gateway/src/__tests__/dashboard-guard.test.ts`（新建）

**Analog:** `apps/api/src/middleware/__tests__/` 下现有 vitest 测试结构

**测试文件结构模式**（参考 api 测试惯例）：
```typescript
/**
 * dashboard-guard.ts 单元测试
 * 覆盖：ACCESS-01（未登录 302）、ACCESS-02（白名单判断）、PUBSEC-01（robots.txt）、PUBSEC-02（X-Robots-Tag）
 */
import { describe, expect, it, vi } from 'vitest'
import { checkDashboardAuth, isInAdminWhitelist } from '../dashboard-guard'

describe('isInAdminWhitelist', () => {
  it('单个 ID 命中返回 true', () => {
    expect(isInAdminWhitelist('12345', '12345')).toBe(true)
  })
  it('逗号分隔多个 ID 命中返回 true', () => {
    expect(isInAdminWhitelist('67890', '12345,67890')).toBe(true)
  })
  it('未命中返回 false', () => {
    expect(isInAdminWhitelist('99999', '12345,67890')).toBe(false)
  })
  it('env 为空返回 false', () => {
    expect(isInAdminWhitelist('12345', undefined)).toBe(false)
  })
})

describe('checkDashboardAuth', () => {
  it('无 cookie 返回 no_session', async () => {
    const req = new Request('https://starye.org/dashboard/')
    const result = await checkDashboardAuth(req, { ADMIN_GITHUB_ID: '12345' })
    expect(result).toEqual({ allowed: false, reason: 'no_session' })
  })

  it('session API 返回无 user 时返回 no_session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    ))
    const req = new Request('https://starye.org/dashboard/', {
      headers: { cookie: 'starye.session_token=abc123' },
    })
    const result = await checkDashboardAuth(req, { API_ORIGIN: 'http://127.0.0.1:8787', ADMIN_GITHUB_ID: '12345' })
    expect(result).toEqual({ allowed: false, reason: 'no_session' })
  })

  it('githubId 在白名单中返回 allowed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { githubId: '12345' } }), { status: 200 })
    ))
    const req = new Request('https://starye.org/dashboard/', {
      headers: { cookie: 'starye.session_token=abc123' },
    })
    const result = await checkDashboardAuth(req, { API_ORIGIN: 'http://127.0.0.1:8787', ADMIN_GITHUB_ID: '12345' })
    expect(result).toEqual({ allowed: true })
  })
})
```

**要新增的要点：**
- gateway 目前无 `vitest.config.ts`，需新建（参考 `apps/api/vitest.config.ts` 模式）
- `vi.stubGlobal('fetch', ...)` mock 全局 fetch，避免真实网络请求
- L1 缓存（模块级 Map）在测试间可能有状态污染，需在 `beforeEach` 中清理或用 `vi.resetModules()`
- 测试文件放 `apps/gateway/src/__tests__/` 目录（与 api 的 `__tests__` 惯例对齐）

---

### `apps/api/src/services/__tests__/adult-filter.test.ts`（新建）

**Analog:** api 现有测试文件结构（`apps/api/src/middleware/__tests__/error-handler.test.ts` 模式）

**测试文件模式**（D-07，覆盖 ACCESS-04/07）：
```typescript
/**
 * adult-filter.ts 单元测试
 * 覆盖：ACCESS-04（匿名用户可访问公开目录）、ACCESS-07（匿名用户 list 不含 isR18=true）
 */
import { describe, expect, it } from 'vitest'
import { movies } from '@starye/db/schema'
import { buildAdultVisibilityCondition } from '../adult-filter'

describe('buildAdultVisibilityCondition', () => {
  it('未登录用户返回 eq(isR18, false) 条件', () => {
    const cond = buildAdultVisibilityCondition(undefined, movies)
    expect(cond).toBeDefined()
  })

  it('isR18Verified=false 的用户返回过滤条件', () => {
    const user = { isR18Verified: false, role: 'user' } as any
    const cond = buildAdultVisibilityCondition(user, movies)
    expect(cond).toBeDefined()
  })

  it('isR18Verified=true 的用户返回 undefined（无过滤）', () => {
    const user = { isR18Verified: true, role: 'user' } as any
    const cond = buildAdultVisibilityCondition(user, movies)
    expect(cond).toBeUndefined()
  })

  it('admin 角色返回 undefined（无过滤）', () => {
    const user = { isR18Verified: false, role: 'admin' } as any
    const cond = buildAdultVisibilityCondition(user, movies)
    expect(cond).toBeUndefined()
  })

  it('super_admin 角色返回 undefined（无过滤）', () => {
    const user = { isR18Verified: false, role: 'super_admin' } as any
    const cond = buildAdultVisibilityCondition(user, movies)
    expect(cond).toBeUndefined()
  })
})
```

**要新增的要点：**
- 纯函数测试，无需 mock，直接 import 调用
- 测试放 `apps/api/src/services/__tests__/` 目录（需新建 `__tests__` 子目录）
- 运行命令：`pnpm --filter @starye/api test --run`（已有 vitest 配置）

---

## Shared Patterns

### 认证中间件（所有需要登录的路由）

**Source:** `apps/api/src/middleware/guard.ts`
**Apply to:** `apps/api/src/index.ts` 的 `/api/docs` 和 `/api/openapi.json` 路由

```typescript
// 用法：在路由 handler 前插入
.get('/api/docs', requireAuth(['admin', 'super_admin']), Scalar({...}))
```

### 错误处理（Gateway 层）

**Source:** `apps/gateway/src/index.ts` lines 138-145（proxy 函数的 try/catch）
**Apply to:** `apps/gateway/src/dashboard-guard.ts` 的 fetch 调用

```typescript
try {
  const resp = await fetch(`${apiOrigin}/api/auth/get-session`, { headers: { cookie } })
  if (!resp.ok) return { allowed: false, reason: 'no_session' }
  data = await resp.json()
}
catch {
  // fetch 失败（API 不可达）时 fail-open 还是 fail-closed？
  // 安全原则：fail-closed，返回 no_session 拒绝访问
  return { allowed: false, reason: 'no_session' }
}
```

### Drizzle conditions 数组模式（所有 public routes）

**Source:** `apps/api/src/routes/public/movies/index.ts` lines 52-125
**Apply to:** `public/comics/index.ts`、`public/search/index.ts`

```typescript
const conditions: SQL[] = []
const adultCond = buildAdultVisibilityCondition(user, targetTable)
if (adultCond) conditions.push(adultCond)
// ... 其他条件
const whereClause = conditions.length > 0 ? and(...conditions) : undefined
```

### 响应头注入模式（Gateway）

**Source:** `apps/gateway/src/cache-middleware.ts` lines 361-394（`decorateResponse` 函数）
**Apply to:** `apps/gateway/src/index.ts` 的 `proxy()` 函数

```typescript
// decorateResponse 模式：new Headers(response.headers) + new Response(response.body, {...})
const headers = new Headers(response.headers)
headers.set('X-Robots-Tag', 'noindex, nofollow')
return new Response(response.body, {
  status: response.status,
  statusText: response.statusText,
  headers,
})
```

---

## No Analog Found

所有文件均找到 analog，无此分类。

---

## Metadata

**Analog search scope:** `apps/gateway/src/`, `apps/api/src/`, `apps/movie-app/src/`, `apps/comic-app/src/`, `apps/auth/app/`, `apps/*/public/`
**Files scanned:** 17
**Pattern extraction date:** 2026-05-11

### 关键发现摘要

1. **githubId 字段缺失**：`SessionUser`（`apps/api/src/types.ts:15`）无 `githubId`，需在 `auth.ts` `additionalFields` + `callbacks.session` 中从 `account` 表注入，并同步更新 `SessionUser` 类型。这是 D-01/D-04 的前置依赖，必须最先实现。

2. **search handler bug 已定位**：`apps/api/src/routes/public/search/index.ts` lines 33-63，`r18Filter` 构造正确但未注入 WHERE，且有应用层 filter 兜底。修复方式：用 `and(adultCond, searchCond)` 替换现有 `.where()` 调用，删除 lines 61-63。

3. **login.vue 参数不兼容**：现有 `login.vue` 读 `route.query.redirect`，Gateway 302 用 `?next=`，需同时支持两个参数（向后兼容）。

4. **auth app 无 _redirects**：`apps/auth/public/_redirects` 不存在，需新建（其他 4 个 app 已有 SPA fallback 规则）。

5. **gateway 无 vitest 配置**：`apps/gateway/` 目前无 `vitest.config.ts`，新建测试文件前需先建配置（参考 `apps/api/vitest.config.ts`）。

6. **cookie 名称已确认**：`auth.ts` line 98 `cookiePrefix: 'starye'`，session cookie 名为 `starye.session_token`，Gateway 正则 `/starye\.session_token=([^;]+)/` 可直接使用。
