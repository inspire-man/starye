# Phase 2: Dashboard 访问控制 + 前台登录门控 + 公网暴露面加固 - Research

**Researched:** 2026-05-11
**Domain:** Cloudflare Workers Gateway 鉴权 / Hono 中间件 / Vue 3 Composable / Cloudflare Pages _redirects
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard 门控架构**
- D-01: Gateway Worker 层前置拦截 `/dashboard/*`，fetch `${API_ORIGIN}/api/auth/get-session`，判断 `user.githubId` 是否在 `ADMIN_GITHUB_ID` 白名单。未登录或非白名单 → `302 /auth/login?next=<encoded_origin_path>`。
- D-02: Session 查询结果在 Worker 内存做 L1 缓存 30s（`Map<sessionToken, {user, expiresAt}>`），best-effort 加速，不是安全边界。
- D-03: `ADMIN_GITHUB_ID` 纯 env var，支持单个 ID 或逗号分隔多个。Gateway 和 API 两侧 wrangler.toml 都要声明。生产走 `wrangler secret put`，本地走 `.dev.vars`。
- D-04: 白名单覆盖角色判定：`ADMIN_GITHUB_ID` 命中即视为 `super_admin`，不依赖 D1 的 `user.role`。`requireAuth` 新增白名单短路分支。
- D-05: 非白名单用户跳 `/auth/login?error=not_admin&next=<origin>`，auth 页显示"此账号没有管理员权限"文案。

**成人内容字段 + 过滤**
- D-06: `is_adult`（需求文档）与 `schema.isR18` 语义等价，不改名。
- D-07: 新建 `apps/api/src/services/adult-filter.ts`，导出 `buildAdultVisibilityCondition(user, table)`。未登录或 `isR18Verified===false` → `eq(table.isR18, false)`；`isR18Verified===true` → `undefined`。
- D-08: 所有 `apps/api/src/routes/public/*` 的 list/search/recommend handler 统一调用 `buildAdultVisibilityCondition`。
- D-09: 不新增 cache scope，沿用 Phase 1 D-07 带 cookie bypass 策略。
- D-10: 爬虫写入路径认定为已有能力，本期只验证覆盖率，不改爬虫逻辑。

**前台登录门控形态**
- D-11: 拦截形态：`window.location.href = '/auth/login?next=' + encodeURIComponent(location.pathname + location.search)`，不弹 modal。
- D-12: 实现分层：组件层为主。新建 `useAuthGuard` composable，导出 `requireLogin(nextPath?): boolean`。API 401 拦截器不在本期交付。
- D-13: 本期仅收藏按钮落地拦截（movie-app MovieDetail/MovieCard，comic-app 对应位置）。
- D-14: 登录回弹 `next` 同源校验：`new URL(next, location.origin).origin === location.origin` 才跳，否则回 `/`。

**暴露面加固落地位置**
- D-15: `robots.txt` 与 `X-Robots-Tag` 统一走 Gateway。`/robots.txt` 路由在所有 proxy 分支之前 match。
- D-16: `*.pages.dev` 301 由各 Pages 应用的 `public/_redirects` 承担，6 个 app 一次统一加完。
- D-17: `/api/docs` 与 `/api/openapi.json` 直接挂 `requireAuth(['admin','super_admin'])`，不用 env 开关。
- D-18: Cloudflare WAF Rate Limiting 手动配置，本期交付物仅 RUNBOOK.md 新增段落。

### Claude's Discretion

- `ADMIN_GITHUB_ID` env 格式（单值 vs 逗号列表）由 planner 按 Cloudflare secrets 习惯选
- L1 session 缓存的具体数据结构（`Map` vs `LRUCache`）由 planner 选；TTL 固定 30s
- `useAuthGuard` 放 `packages/ui` vs 各 app 本地由 planner 按当前两 app 的 composable 组织决定
- Gateway `/robots.txt` 路由放在 `index.ts` 分支首位还是拆到 `robots.ts` 由 planner 选
- 各 `_redirects` 文件是否需要 append 而非覆盖由 planner 在 research 阶段 check（已 check，见下文）
- `X-Robots-Tag` 注入位置（proxy 函数内 vs `cachedProxy` 外层装饰）由 planner 选
- Better Auth 返回的 `user` 对象里 `githubId` 的具体字段名由 researcher 确认（已确认，见下文）

### Deferred Ideas (OUT OF SCOPE)

- API 401 拦截器兜底方案
- Modal 登录 / UI 占位锁图标
- `serviceAuth` → `requireAuth + requireResource` 迁移
- 自实现限速中间件（KV / DO 计数）
- 成人内容 PIN 门控（v2 GATE-01）
- dashboard 手动标注 isR18 的复核入口（v2 GATE-02）
- Better Auth hooks 把 ADMIN_GITHUB_ID 写回 DB role
- `/robots.txt` 里包含 sitemap 行
- favicon / opengraph 元数据的 noindex 处理
</user_constraints>


<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACCESS-01 | `/dashboard/*` 所有路由强制登录，未登录重定向到 `/auth/login?next=<origin>` | Gateway 前置拦截器（D-01），在 `cachedProxy` 调用之前执行 302 |
| ACCESS-02 | 作者管理员身份通过 `ADMIN_GITHUB_ID` 判定，非白名单账号进入 dashboard 即拒绝 | Gateway 读 session → 查白名单；API `requireAuth` 白名单短路（D-04） |
| ACCESS-03 | API 侧所有 `/api/admin/*` 路由通过 `requireAuth(['admin'])` 保护 | 现有 `requireAuth` 已覆盖，白名单短路后 `super_admin` 自动通过 |
| ACCESS-04 | 匿名用户可浏览 movie-app / comic-app / blog 的公开目录 | 公开路由无 `requireAuth`，`user` 为 undefined 时 `buildAdultVisibilityCondition` 过滤 R18 |
| ACCESS-05 | 匿名用户访问收藏时被登录门控 | `useAuthGuard` composable 在 `toggleFavorite` 调用前拦截 |
| ACCESS-06 | 成人内容字段 `is_adult` 由爬虫入库时根据源站标签自动写入 | 认定为已有能力，本期验证覆盖率（schema 默认 `isR18=true`） |
| ACCESS-07 | 成人内容在 API 查询层服务端过滤，未登录用户 list/search/recommend 不含 `is_adult=true` | `buildAdultVisibilityCondition` 注入所有 public handler 的 WHERE 条件 |
| PUBSEC-01 | Gateway 统一提供 `/robots.txt`，disallow `/dashboard /auth /api` | Gateway `index.ts` 新增 `/robots.txt` 路由，在所有 proxy 分支之前 match |
| PUBSEC-02 | Gateway 对 `/dashboard/*`、`/api/admin/*` 响应添加 `X-Robots-Tag: noindex, nofollow` | `decorateResponse` 或 proxy 函数内注入响应头 |
| PUBSEC-03 | Cloudflare WAF Rate Limiting 对 `/api/auth/sign-in` 限制 10 req/min/IP | 手动配置 + RUNBOOK.md 记录（D-18） |
| PUBSEC-04 | 生产环境关闭或鉴权保护 `/api/docs` | `requireAuth(['admin','super_admin'])` 挂在 `/api/docs` 和 `/api/openapi.json` 路由前（D-17） |
| PUBSEC-05 | 所有 `*.pages.dev` 直链通过 `_redirects` 301 回 `starye.org/<app>/` | 各 Pages `public/_redirects` 追加 301 规则（D-16） |
</phase_requirements>

## Summary

Phase 2 的核心工作分为四个独立但相互关联的子域：Gateway 层 dashboard 门控、API 层白名单短路、前台 composable 收藏拦截、公网暴露面加固。

**代码库现状（已验证）：** 成人内容过滤在 `public/movies` 和 `public/comics` 的 list/recommended 中已有 `!user?.isR18Verified` 条件，但 `public/search` 的实现有缺陷（先查全量再应用层 filter，不是 WHERE 过滤）。`MovieDetail.vue` 的 `toggleFavorite` 函数直接调用 API，没有登录检查。`_redirects` 文件在 4 个 app 中已存在，但只有 SPA fallback 规则，没有 `*.pages.dev` 301 规则。`/api/docs` 已挂载但无鉴权。

**最关键的技术发现：** `SessionUser` 类型（`apps/api/src/types.ts`）没有 `githubId` 字段。GitHub ID 存储在 `account` 表的 `accountId` 字段（`providerId='github'`）。D-01 要求 Gateway 判断 `user.githubId`，但 `/api/auth/get-session` 返回的 user 对象不包含此字段。需要通过 Better Auth `additionalFields` 或查 `account` 表来获取 GitHub ID。

**Primary recommendation:** Gateway 白名单判断改为查 `account` 表（通过 API 新增 `/api/auth/admin-check` 端点），或在 Better Auth `additionalFields` 中暴露 `githubId`，而不是依赖 session user 对象上不存在的字段。


## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dashboard 准入拦截 | Gateway Worker | API Worker (session 查询) | 静态资源在 Pages，必须在 Worker 层拦截，Pages 无法执行鉴权逻辑 |
| ADMIN_GITHUB_ID 白名单判定 | Gateway Worker | API Worker (requireAuth 短路) | 双层防御：Gateway 拦截未授权请求，API 层作为第二道防线 |
| 成人内容服务端过滤 | API Worker | — | WHERE 条件必须在数据库查询层，不能在前端或 Gateway |
| 前台收藏登录门控 | Browser (Vue composable) | — | 组件层拦截，登录前不发 API 请求，避免 401 闪烁 |
| robots.txt 提供 | Gateway Worker | — | 统一单一来源，避免各 Pages 各自维护导致不一致 |
| X-Robots-Tag 注入 | Gateway Worker | — | 响应头在 proxy 返回时注入，覆盖所有 `/dashboard/*` 和 `/api/admin/*` |
| *.pages.dev 301 重定向 | Cloudflare Pages (_redirects) | — | Pages 平台原生支持，无需 Worker 介入 |
| /api/docs 鉴权保护 | API Worker (Hono middleware) | — | 路由级 requireAuth，与其他 admin 路由一致 |
| WAF 限速 | Cloudflare WAF (手动配置) | — | 免费 plan 支持基础 Rate Limiting，不需要自实现 |

## Standard Stack

### Core（已在项目中，无需新增）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hono | ^4.12.12 | API 路由 + 中间件 | 项目已用，`requireAuth` 基于此 |
| Drizzle ORM | 0.45.2 | `buildAdultVisibilityCondition` 的 `eq()` 条件构造 | 项目已用，类型安全 WHERE 构造 |
| Better Auth | ^1.6.2 | session 查询（Gateway fetch `/api/auth/get-session`） | 项目已用 |
| Vue 3 Composition API | ^3.5.32 | `useAuthGuard` composable | 项目已用 |
| Pinia | ^3.0.4 | `useUserStore` 读登录态 | movie-app 已用 |

### Supporting（无需新增依赖）

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Cloudflare Workers Map | 内置 | Gateway L1 session 缓存 | Worker 实例内存，30s TTL |
| Cloudflare Pages _redirects | 平台原生 | *.pages.dev → starye.org 301 | 静态文件，Pages 部署时自动识别 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Map L1 缓存 | LRUCache (npm) | LRUCache 有大小限制，但 Worker 内存本就有限；Map 够用，不引入新依赖 |
| Gateway fetch session | Durable Object 共享状态 | DO 有额外费用且复杂度高；单用户场景 Map 足够 |
| 组件层 useAuthGuard | 路由级 beforeEach 全局拦截 | 全局拦截会影响所有路由；本期只需收藏按钮，组件层更精准 |

**Installation:** 无需新增依赖。


## Architecture Patterns

### System Architecture Diagram

```
Browser Request
      |
      v
[Gateway Worker: starye.org]
      |
      +-- /robots.txt --> 纯文本响应（无 proxy）
      |
      +-- /dashboard/* --> [L1 Cache 查 sessionToken]
      |                         |
      |                    HIT (30s内) --> 白名单判断 --> 通过 -> proxy to Pages
      |                         |                      -> 拒绝 -> 302 /auth/login?next=...
      |                    MISS --> fetch API_ORIGIN/api/auth/get-session
      |                              |
      |                         session存在 -> 写L1 -> 白名单判断
      |                         session不存在 -> 302 /auth/login?next=...
      |
      +-- /api/admin/* --> proxy to API Worker
      |       (响应时注入 X-Robots-Tag: noindex,nofollow)
      |
      +-- /api/public/* --> proxy to API Worker
              |
              v
        [API Worker: Hono]
              |
              +-- authMiddleware: 读 session -> c.set("user", ...)
              |
              +-- /api/public/movies --> buildAdultVisibilityCondition(user, movies)
              |                              |
              |                         user.isR18Verified=true -> 无过滤
              |                         user=undefined 或 false -> eq(movies.isR18, false)
              |
              +-- /api/docs --> requireAuth(["admin","super_admin"]) -> Scalar UI
              +-- /api/openapi.json --> requireAuth(["admin","super_admin"]) -> JSON

[Browser: Vue 3 SPA]
      |
      +-- 收藏按钮 onClick
              |
              v
        useAuthGuard.requireLogin()
              |
         user存在 -> 继续 addFavorite()
         user不存在 -> window.location.href = "/auth/login?next=..."

[Cloudflare Pages: *.pages.dev]
      |
      +-- _redirects: /* -> https://starye.org/<app>/:splat 301!
```

### Recommended Project Structure

```
apps/gateway/src/
├── index.ts              # 新增 /robots.txt 路由 + /dashboard/* 拦截器
└── cache-middleware.ts   # 现有，decorateResponse 可扩展注入 X-Robots-Tag

apps/api/src/
├── middleware/
│   └── guard.ts          # 扩展 requireAuth，加白名单短路分支
├── services/
│   └── adult-filter.ts   # 新建，导出 buildAdultVisibilityCondition
└── routes/public/
    ├── movies/index.ts   # 已有过滤，重构为调用 adult-filter.ts
    ├── comics/index.ts   # 已有过滤，重构为调用 adult-filter.ts
    └── search/index.ts   # 修复：改为 WHERE 过滤，调用 adult-filter.ts

apps/movie-app/src/composables/
└── useAuthGuard.ts       # 新建

apps/comic-app/src/composables/
└── useAuthGuard.ts       # 新建（或共用 packages/ui 版本）

apps/auth/app/pages/
└── login.vue             # 扩展：支持 ?next= 参数 + 同源校验

apps/{movie-app,comic-app,dashboard,auth,blog,tavern}/public/
└── _redirects            # 追加 *.pages.dev -> starye.org 301 规则
```

### Pattern 1: Gateway 前置鉴权拦截器

**What:** 在 `cachedProxy` 调用之前，对 `/dashboard/*` 路径执行 session 查询 + 白名单判断。
**When to use:** 需要在静态资源到达 Pages 之前拦截未授权请求。

```typescript
// apps/gateway/src/index.ts — 在 /dashboard 分支内，cachedProxy 调用之前
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

### Pattern 2: Gateway L1 Session 缓存

**What:** Worker 实例内存 Map，缓存 sessionToken -> {githubId, expiresAt}，TTL 30s。
**When to use:** 避免每次 dashboard 静态资源请求都打一次 API。

```typescript
// apps/gateway/src/index.ts 模块顶层（Worker 实例生命周期内有效）
interface CachedSession {
  githubId: string
  expiresAt: number // Date.now() + 30_000
}
const sessionCache = new Map<string, CachedSession>()

async function checkDashboardAuth(
  request: Request,
  env: Env,
): Promise<{ allowed: boolean, reason?: string }> {
  const cookie = request.headers.get('cookie') || ''
  const tokenMatch = cookie.match(/starye\.session_token=([^;]+)/)
  if (!tokenMatch) return { allowed: false, reason: 'no_session' }

  const token = tokenMatch[1]
  const now = Date.now()

  const cached = sessionCache.get(token)
  if (cached && cached.expiresAt > now) {
    return isInAdminWhitelist(cached.githubId, env.ADMIN_GITHUB_ID)
      ? { allowed: true }
      : { allowed: false, reason: 'not_admin' }
  }

  const apiOrigin = env.API_ORIGIN || 'http://127.0.0.1:8787'
  const sessionResp = await fetch(`${apiOrigin}/api/auth/get-session`, {
    headers: { cookie },
  })
  if (!sessionResp.ok) return { allowed: false, reason: 'no_session' }

  const data = await sessionResp.json() as any
  if (!data?.user) return { allowed: false, reason: 'no_session' }

  // githubId 获取方式见 Open Questions #1 [ASSUMED]
  const githubId = data.user.githubId || data.user.id
  sessionCache.set(token, { githubId, expiresAt: now + 30_000 })

  return isInAdminWhitelist(githubId, env.ADMIN_GITHUB_ID)
    ? { allowed: true }
    : { allowed: false, reason: 'not_admin' }
}

function isInAdminWhitelist(githubId: string, adminEnv?: string): boolean {
  if (!adminEnv) return false
  return adminEnv.split(',').map(s => s.trim()).includes(githubId)
}
```

### Pattern 3: buildAdultVisibilityCondition

**What:** 统一的成人内容可见性条件构造函数，注入所有 public handler 的 WHERE 条件数组。
**When to use:** 所有 `/api/public/*` 的 list/search/recommend handler。

```typescript
// apps/api/src/services/adult-filter.ts
import type { SessionUser } from '../types'
import { eq } from 'drizzle-orm'
import { actors, comics, movies, publishers } from '@starye/db/schema'

type R18Table = typeof movies | typeof comics | typeof actors | typeof publishers

export function buildAdultVisibilityCondition(
  user: SessionUser | undefined,
  table: R18Table,
) {
  if (user?.isR18Verified) return undefined
  return eq((table as typeof movies).isR18, false)
}
```

**调用方式（已有模式，直接复用）：**
```typescript
const conditions: SQL[] = []
const adultCond = buildAdultVisibilityCondition(user, movies)
if (adultCond) conditions.push(adultCond)
```

### Pattern 4: useAuthGuard Composable

**What:** 前台登录门控，`requireLogin()` 返回 false 时执行跳转，调用方 early return。
**When to use:** 需要登录才能执行的操作（收藏、进度写入等）。

```typescript
// apps/movie-app/src/composables/useAuthGuard.ts
import { useUserStore } from '../stores/user'

export function useAuthGuard() {
  const userStore = useUserStore()

  function requireLogin(nextPath?: string): boolean {
    if (userStore.user) return true
    const next = encodeURIComponent(nextPath || (window.location.pathname + window.location.search))
    window.location.href = `/auth/login?next=${next}`
    return false
  }

  return { requireLogin }
}
```

**调用方式：**
```typescript
// apps/movie-app/src/views/MovieDetail.vue — toggleFavorite 函数
async function toggleFavorite() {
  const { requireLogin } = useAuthGuard()
  if (!requireLogin()) return
  // ... 原有收藏逻辑
}
```

### Pattern 5: Cloudflare Pages _redirects 跨域 301

**What:** `_redirects` 文件中的跨域重定向规则，将 `*.pages.dev` 直链 301 到自定义域。
**When to use:** 阻止用户绕过 Gateway 直接访问 Pages 原始域名。

```
# apps/movie-app/public/_redirects
# 跨域 301 规则必须在 SPA fallback 之前 [ASSUMED: *.pages.dev 跨域重定向语法]
https://starye-movie.pages.dev/* https://starye.org/movie/:splat 301!

# SPA fallback（保留原有规则）
/* /index.html 200
```

**重要：** `301!` 末尾的 `!` 表示强制重定向，优先级高于 SPA fallback。跨域重定向规则必须写在 `/* /index.html 200` 之前。

### Pattern 6: X-Robots-Tag 响应头注入

**What:** 在 Gateway proxy 返回响应时，对特定路径注入 `X-Robots-Tag: noindex, nofollow`。
**When to use:** `/dashboard/*` 和 `/api/admin/*` 路径。

```typescript
function injectRobotsTag(response: Response, pathname: string): Response {
  if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/api/admin')) {
    return response
  }
  const headers = new Headers(response.headers)
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
```

### Anti-Patterns to Avoid

- **在 Pages 前端做 dashboard 鉴权：** Vue Router `beforeEach` 只是第二道防线，不能替代 Gateway 拦截。静态资源（JS bundle）在 Gateway 拦截前就已经可以被下载。
- **在 Gateway 直接查 D1：** Gateway Worker 没有 D1 binding，必须通过 API fetch session。
- **缓存带 Cookie 的 dashboard 响应：** `bypassCache: true` 已设置，不要移除。
- **search handler 应用层过滤：** 现有 `public/search/index.ts` 先查全量再 `.filter(m => !m.isR18)` 是错误的，必须改为 WHERE 条件过滤。
- **`_redirects` 规则顺序错误：** 跨域 301 规则必须在 `/* /index.html 200` 之前，否则 SPA fallback 优先匹配。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session 验证 | 自己解析 JWT / cookie | Better Auth `auth.api.getSession()` | Better Auth 处理 token 轮换、过期、签名验证 |
| 成人内容 WHERE 条件 | `sql.raw()` 字符串拼接 | Drizzle `eq(table.isR18, false)` | `sql.raw()` 有 SQL 注入风险（CONCERNS.md 已标注） |
| WAF 限速 | KV 计数器 / Durable Object | Cloudflare WAF Rate Limiting | 免费 plan 支持，无需代码，无额外费用 |
| 跨域重定向 | Worker 拦截 *.pages.dev | Pages `_redirects` 文件 | Pages 平台原生支持，Worker 无法拦截其他 Pages 的请求 |
| 登录态检查 | 每次操作都 fetch `/api/auth/get-session` | Pinia `useUserStore().user` | store 已在 app 初始化时 fetch，避免重复请求 |

**Key insight:** Gateway 层没有 D1 binding，所有 session 验证必须通过 API fetch，不能绕过。

## Runtime State Inventory

> 本 phase 为功能新增（非 rename/refactor），但涉及 env var 新增，需确认运行时状态。

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | 无 — 不改 schema，不迁移数据 | 无 |
| Live service config | `apps/gateway/wrangler.toml` 和 `apps/api/wrangler.toml` 需新增 `ADMIN_GITHUB_ID` 声明 | 代码编辑 + `wrangler secret put ADMIN_GITHUB_ID` |
| OS-registered state | 无 | 无 |
| Secrets/env vars | `ADMIN_GITHUB_ID` — 新增 secret，需在 gateway 和 api 两个 Worker 各自 `wrangler secret put` | 两处都要配置，遗漏一处会导致 Gateway 拦截但 API 不认 |
| Build artifacts | 无 — 无 egg-info / 全局安装 | 无 |

**Nothing found in category:** Stored data、OS-registered state、Build artifacts — 均无，已验证（本 phase 不改 schema，不新增 OS 注册项）。

## Common Pitfalls

### Pitfall 1: githubId 字段不在 SessionUser 上

**What goes wrong:** Gateway 调用 `/api/auth/get-session` 后，尝试读 `data.user.githubId`，但该字段不存在，导致白名单判断永远失败（所有人都被拒绝）。
**Why it happens:** `SessionUser` 类型（`apps/api/src/types.ts:15`）只有 `id, email, role, isAdult, isR18Verified`，没有 `githubId`。GitHub ID 存在 `account` 表的 `accountId` 字段（`providerId='github'`）。Better Auth 的 `additionalFields` 没有配置 `githubId`。
**How to avoid:** 方案 A：在 Better Auth `additionalFields` 中添加 `githubId` 字段，通过 `session` callback 从 `account` 表查询并注入。方案 B：新增 `/api/auth/admin-check` 端点，内部查 `account` 表判断白名单，Gateway 调用此端点而非 `get-session`。方案 A 更简洁，方案 B 更解耦。
**Warning signs:** 所有 dashboard 访问都被 302 到登录页，即使已登录。

### Pitfall 2: login.vue 用 `redirect` 参数，Phase 2 要求用 `next` 参数

**What goes wrong:** Gateway 302 到 `/auth/login?next=...`，但 `login.vue` 读的是 `route.query.redirect`，导致登录后无法回弹原页面。
**Why it happens:** 现有 `login.vue`（`apps/auth/app/pages/login.vue:22`）读 `route.query.redirect`；dashboard 的 `router.beforeEach`（`apps/dashboard/src/router/index.ts:144`）也用 `redirect` 参数。Phase 2 CONTEXT.md D-11/D-14 要求用 `next` 参数。
**How to avoid:** `login.vue` 改为同时支持 `next` 和 `redirect` 参数（`const redirectPath = route.query.next || route.query.redirect || '/'`），保持向后兼容。同源校验逻辑对两个参数都要执行。
**Warning signs:** 登录成功后跳回 `/`（默认值）而非原页面。

### Pitfall 3: search handler 应用层过滤而非 WHERE 过滤

**What goes wrong:** `public/search/index.ts` 先查全量（包含 R18 内容），再在应用层 `.filter(m => !m.isR18)` 过滤，导致：(a) 查询性能差；(b) `limit` 语义错误（limit 10 但过滤后可能只剩 3 条）；(c) 不符合 ACCESS-07 "服务端 WHERE 过滤"要求。
**Why it happens:** 代码（`apps/api/src/routes/public/search/index.ts:61`）先构造 `r18Filter = eq(movies.isR18, false)` 但没有把它加进 WHERE，而是查完再 filter。
**How to avoid:** 将 `r18Filter` 正确注入 `.where()` 条件，或统一调用 `buildAdultVisibilityCondition`。
**Warning signs:** 搜索结果数量少于 limit，或 R18 内容出现在匿名用户的搜索结果中。

### Pitfall 4: _redirects 规则顺序导致 SPA fallback 优先

**What goes wrong:** 跨域 301 规则写在 `/* /index.html 200` 之后，SPA fallback 先匹配，301 规则永远不生效。
**Why it happens:** Cloudflare Pages `_redirects` 按顺序匹配，第一个匹配的规则生效。`/*` 是最宽泛的模式，会匹配所有请求。
**How to avoid:** 跨域 301 规则必须写在 SPA fallback 之前。
**Warning signs:** 直接访问 `starye-movie.pages.dev` 显示 movie-app 内容而非 301 跳转。

### Pitfall 5: Gateway L1 缓存泄漏 session 到其他用户

**What goes wrong:** 多个用户共享同一 Worker 实例时，Map 中的 session 数据被错误地返回给其他用户。
**Why it happens:** Map key 是 sessionToken，不同用户的 token 不同，不会混淆。但如果 key 设计错误（如用 IP 或 userId），会导致泄漏。
**How to avoid:** Map key 必须是 sessionToken（完整 cookie 值），不能是 userId 或 IP。TTL 30s 确保过期 session 不会长期驻留。
**Warning signs:** 用户 A 登出后，用户 B 仍能访问 dashboard（如果 B 恰好复用了 A 的 Worker 实例且 token 未过期）。

### Pitfall 6: auth app 没有 _redirects 文件

**What goes wrong:** `apps/auth` 没有 `public/_redirects` 文件（Glob 验证：`apps/auth/public/_redirects` 不存在），需要新建而非追加。
**Why it happens:** auth 是 Nuxt 4 应用，静态文件目录可能是 `public/` 或 `static/`，需要确认 Nuxt 4 的静态文件目录约定。
**How to avoid:** 确认 Nuxt 4 Pages 部署时 `_redirects` 的正确位置（通常是 `public/_redirects`，Nuxt 会将 `public/` 内容复制到 `.output/public/`）。
**Warning signs:** auth app 的 `*.pages.dev` 直链没有被 301 重定向。

## Code Examples

### 现有成人过滤模式（已验证，直接参考）

```typescript
// [VERIFIED: apps/api/src/routes/public/movies/index.ts:54]
// 已有正确实现，buildAdultVisibilityCondition 应与此对齐
if (!user?.isR18Verified) {
  conditions.push(eq(movies.isR18, false))
}
```

### 现有 requireAuth 结构（需扩展白名单短路）

```typescript
// [VERIFIED: apps/api/src/middleware/guard.ts:11]
export function requireAuth(requiredRole?: string | string[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    // ... session 查询 ...
    // 需要在此处加白名单短路：
    // if (isInAdminWhitelist(user.githubId, c.env.ADMIN_GITHUB_ID)) {
    //   await next(); return
    // }
    if (user.role === 'super_admin' || user.role === 'admin') {
      await next()
      return
    }
    // ...
  })
}
```

### 现有 login.vue 回跳逻辑（需扩展支持 next 参数）

```typescript
// [VERIFIED: apps/auth/app/pages/login.vue:22]
// 现有：只读 redirect 参数
const redirectPath = computed(() => {
  const path = route.query.redirect as string || '/'
  return path.startsWith('http') ? path : (path.startsWith('/') ? path : `/${path}`)
})

// 需要改为：同时支持 next 和 redirect，加同源校验
const redirectPath = computed(() => {
  const path = (route.query.next || route.query.redirect) as string || '/'
  // 同源校验
  try {
    const target = new URL(path, window.location.origin)
    if (target.origin !== window.location.origin) return '/'
  } catch { return '/' }
  return path.startsWith('/') ? path : `/${path}`
})
```

### 现有 toggleFavorite（需插入 useAuthGuard）

```typescript
// [VERIFIED: apps/movie-app/src/views/MovieDetail.vue:463]
// 现有：无登录检查
async function toggleFavorite() {
  if (!movie.value || favoritingLoading.value) return
  // 直接操作...
}

// 需要改为：
async function toggleFavorite() {
  const { requireLogin } = useAuthGuard()
  if (!requireLogin()) return  // 未登录 -> 跳转
  if (!movie.value || favoritingLoading.value) return
  // 原有逻辑...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 前端 router guard 做 dashboard 鉴权 | Gateway Worker 层前置拦截 | Phase 2 | 静态资源不再泄漏给未授权用户 |
| 应用层 R18 过滤（filter after query） | 数据库 WHERE 条件过滤 | Phase 2 | 性能提升 + 语义正确 |
| 无 robots.txt | Gateway 统一提供 | Phase 2 | 搜索引擎不再索引后台路径 |
| /api/docs 无鉴权 | requireAuth 保护 | Phase 2 | 避免 API 结构暴露给匿名用户 |

**Deprecated/outdated:**
- `apps/dashboard/src/router/index.ts` 的 `redirect` 参数：Phase 2 后统一用 `next` 参数，`redirect` 保留向后兼容但不再是主路径。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cloudflare Pages `_redirects` 支持跨域 301，语法为 `https://source.pages.dev/* https://target.org/path/:splat 301!` | Pattern 5, Pitfall 4 | 跨域 301 规则不生效，需改用 Cloudflare Redirect Rules（Dashboard 手动配置） |
| A2 | Better Auth `get-session` 返回的 user 对象不包含 `githubId`，GitHub ID 在 `account` 表的 `accountId` 字段 | Summary, Pitfall 1, Open Questions | 如果 Better Auth 实际上暴露了 `githubId`，则 Open Questions #1 的解决方案可以简化 |
| A3 | Nuxt 4 Pages 部署时 `public/_redirects` 会被正确复制到输出目录 | Pitfall 6 | auth app 的 301 规则不生效，需要确认 Nuxt 4 + Cloudflare Pages 的静态文件处理 |
| A4 | Better Auth cookie 名称为 `starye.session_token`（基于 `cookiePrefix: 'starye'` 配置） | Pattern 2 | Gateway 无法提取 session token，L1 缓存失效，每次都走 API fetch |
| A5 | `checkUserAdultStatus` 中 `user.role === 'admin'` 的判断与 `buildAdultVisibilityCondition` 的 `isR18Verified` 判断语义不同：admin 角色自动可见 R18，但 `buildAdultVisibilityCondition` 只看 `isR18Verified` | Pattern 3, D-07 | 如果作者的 admin 账号没有设置 `isR18Verified=true`，则 admin 在 public 路由也看不到 R18 内容（与 `checkUserAdultStatus` 行为不一致） |

**如果此表为空：** 所有声明均已验证或引用 — 无需用户确认。（本表有 5 条假设，需要在实现前确认 A1、A2、A5）

## Open Questions

1. **Better Auth get-session 返回的 user 对象是否包含 githubId？**
   - What we know: `SessionUser` 类型没有 `githubId`；GitHub ID 存在 `account.accountId`（`providerId='github'`）；Better Auth 支持 `additionalFields` 扩展 session user
   - What's unclear: `/api/auth/get-session` 的实际响应 JSON 结构，是否已经包含 `githubId` 或需要通过 `additionalFields` 注入
   - Recommendation: 实现前在本地运行 `curl http://localhost:8080/api/auth/get-session -H "Cookie: ..."` 验证响应结构。如果没有 `githubId`，在 `apps/api/src/lib/auth.ts` 的 `additionalFields` 中添加 `githubId: { type: 'string' }` 并在 `session` callback 中从 `account` 表查询注入。

2. **`buildAdultVisibilityCondition` 是否应该对 admin 角色也返回 undefined（允许看全部）？**
   - What we know: `checkUserAdultStatus`（`apps/api/src/routes/actors/services/auth.service.ts:8`）判断 `user.isAdult || user.isR18Verified || user.role === 'admin'`；D-07 只说 `isR18Verified===true` 返回 undefined
   - What's unclear: 作者的账号是否会有 `isR18Verified=true`？如果没有，admin 在 public 路由也看不到 R18 内容
   - Recommendation: `buildAdultVisibilityCondition` 应与 `checkUserAdultStatus` 语义对齐，加入 `user.role === 'admin' || user.role === 'super_admin'` 的判断，或者确保 ADMIN_GITHUB_ID 白名单用户在登录时自动设置 `isR18Verified=true`。

3. **`apps/auth` 的 Nuxt 4 静态文件目录是 `public/` 还是其他？**
   - What we know: `apps/auth` 是 Nuxt 4 应用；其他 Vue SPA 的 `_redirects` 在 `public/`；Nuxt 4 默认静态目录是 `public/`
   - What's unclear: Nuxt 4 + Cloudflare Pages 部署时 `public/_redirects` 是否会被正确识别
   - Recommendation: 查看 `apps/auth/nuxt.config.ts` 确认 `nitro.publicAssets` 配置；参考 Cloudflare Pages Nuxt 部署文档确认 `_redirects` 位置。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Cloudflare Workers runtime | Gateway 拦截器 | ✓ | wrangler ^4.81.1 | — |
| Cloudflare KV | Gateway L1 缓存（非必须） | ✓ | 已配置 | Map 内存缓存（已是方案） |
| Better Auth get-session API | Gateway session 查询 | ✓ | ^1.6.2 | — |
| Cloudflare WAF Rate Limiting | PUBSEC-03 | ✓（免费 plan 支持基础限速） | — | 无（手动配置） |
| Cloudflare Pages _redirects | PUBSEC-05 | ✓（平台原生） | — | — |
| Vitest | 单元测试 | ✓ | ^4.1.4 | — |

**Missing dependencies with no fallback:** 无。

**Missing dependencies with fallback:** 无。

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @starye/api test --run` |
| Full suite command | `pnpm --filter @starye/api test --run --coverage` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACCESS-01 | 未登录访问 /dashboard/* 返回 302 | unit | `pnpm --filter @starye/gateway test --run` | ❌ Wave 0 |
| ACCESS-02 | 非白名单账号被拒绝，白名单账号通过 | unit | `pnpm --filter @starye/gateway test --run` | ❌ Wave 0 |
| ACCESS-03 | /api/admin/* 无 session 返回 401 | unit | `pnpm --filter @starye/api test --run` | ✅ (guard.test.ts 已有) |
| ACCESS-04 | 匿名用户可访问 /api/public/movies | unit | `pnpm --filter @starye/api test --run` | ❌ Wave 0 |
| ACCESS-07 | 匿名用户 list 响应不含 isR18=true | unit | `pnpm --filter @starye/api test --run` | ❌ Wave 0 |
| PUBSEC-01 | GET /robots.txt 返回正确 disallow 规则 | unit | `pnpm --filter @starye/gateway test --run` | ❌ Wave 0 |
| PUBSEC-02 | /dashboard/* 响应含 X-Robots-Tag | unit | `pnpm --filter @starye/gateway test --run` | ❌ Wave 0 |
| PUBSEC-04 | 匿名访问 /api/docs 返回 401 | unit | `pnpm --filter @starye/api test --run` | ❌ Wave 0 |
| PUBSEC-05 | *.pages.dev 返回 301 | manual | 浏览器访问 starye-movie.pages.dev | — |
| PUBSEC-03 | WAF 限速 | manual | 手动验证 Cloudflare Dashboard | — |

### Sampling Rate

- **Per task commit:** `pnpm --filter @starye/api test --run`
- **Per wave merge:** `pnpm --filter @starye/api test --run && pnpm --filter @starye/gateway test --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/gateway/src/__tests__/dashboard-guard.test.ts` — 覆盖 ACCESS-01/02/PUBSEC-01/02
- [ ] `apps/api/src/services/__tests__/adult-filter.test.ts` — 覆盖 ACCESS-04/07
- [ ] `apps/api/src/__tests__/docs-auth.test.ts` — 覆盖 PUBSEC-04
- [ ] `apps/gateway/vitest.config.ts` — gateway 目前无 vitest 配置，需新建

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session cookie（已有） |
| V3 Session Management | yes | Gateway L1 缓存 TTL 30s，不作为安全边界 |
| V4 Access Control | yes | Gateway 白名单拦截 + API requireAuth 双层 |
| V5 Input Validation | yes | `next` 参数同源校验（open redirect 防护） |
| V6 Cryptography | no | 无新增加密操作 |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open Redirect via `next` 参数 | Spoofing | `new URL(next, origin).origin === origin` 同源校验 |
| Dashboard 静态资源泄漏 | Information Disclosure | Gateway Worker 层前置拦截，Pages 静态资源不直接暴露 |
| Session token 枚举 | Elevation of Privilege | L1 缓存 key 是完整 token，TTL 30s，Worker 实例隔离 |
| R18 内容通过 API 直接访问 | Information Disclosure | WHERE 条件服务端过滤，不依赖前端隐藏 |
| *.pages.dev 绕过 Gateway | Security Feature Bypass | _redirects 301 强制回 starye.org |
| /api/docs 暴露 API 结构 | Information Disclosure | requireAuth 保护，匿名 401 |
| /api/auth/sign-in 暴力破解 | Denial of Service | Cloudflare WAF Rate Limiting 10 req/min/IP |

## Sources

### Primary (HIGH confidence)

- `apps/gateway/src/index.ts` — Gateway 路由结构，`/dashboard` 分支现状，`cachedProxy` 调用位置
- `apps/gateway/src/cache-middleware.ts` — `decorateResponse` 函数，`NO_STORE_PREFIXES` 列表
- `apps/api/src/middleware/guard.ts` — `requireAuth` 现有实现
- `apps/api/src/lib/auth.ts` — Better Auth 配置，`additionalFields`，`cookiePrefix: 'starye'`
- `apps/api/src/types.ts` — `SessionUser` 类型定义（无 `githubId` 字段）
- `packages/db/src/schema.ts` — `user.isR18Verified`，`movies.isR18`，`account.accountId`
- `apps/api/src/routes/public/movies/index.ts` — 现有 R18 过滤实现（已正确）
- `apps/api/src/routes/public/search/index.ts` — 现有 R18 过滤实现（有 bug，应用层过滤）
- `apps/api/src/routes/public/comics/index.ts` — 现有 R18 过滤实现（已正确）
- `apps/movie-app/src/views/MovieDetail.vue` — `toggleFavorite` 无登录检查
- `apps/movie-app/src/stores/user.ts` — `useUserStore` 结构
- `apps/auth/app/pages/login.vue` — 现有 `redirect` 参数处理，无同源校验
- `apps/{movie-app,comic-app,dashboard,blog}/public/_redirects` — 现有文件内容（只有 SPA fallback）
- `apps/api/src/routes/actors/services/auth.service.ts` — `checkUserAdultStatus` 语义参考
- `apps/api/src/lib/permissions.ts` — RBAC 权限矩阵
- `apps/api/src/index.ts` — `/api/docs` 挂载位置（line 170，无鉴权）
- `apps/gateway/wrangler.toml` — 现有 env vars，无 `ADMIN_GITHUB_ID`
- `apps/api/wrangler.toml` — 现有 env vars，无 `ADMIN_GITHUB_ID`

### Secondary (MEDIUM confidence)

- Cloudflare Pages `_redirects` 跨域 301 语法 — WebSearch 结果，未能通过 WebFetch 验证（网络受限）

### Tertiary (LOW confidence)

- Better Auth `get-session` 响应中 `githubId` 字段是否存在 — 未能通过 WebFetch 验证，基于代码分析推断

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 全部基于代码库直接验证
- Architecture: HIGH — 基于现有代码结构推导，模式已在代码库中有先例
- Pitfalls: HIGH — 基于代码库实际问题（search bug、login.vue redirect 参数）
- _redirects 跨域语法: MEDIUM — 基于训练知识，未能 WebFetch 验证
- githubId 字段: LOW — 需要运行时验证

**Research date:** 2026-05-11
**Valid until:** 2026-06-11（Better Auth 版本稳定，Cloudflare Pages 平台稳定）
