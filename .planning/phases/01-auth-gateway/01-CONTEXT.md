# Phase 1: Auth 全链路 + Gateway 缓存安全基线 - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

作者登录一次后，在所有子应用（dashboard / movie / comic / blog / auth）任意路径、任意刷新、任意 Nuxt SSR 页面都保持登录状态；gateway KV 缓存不会把已登录用户的私有响应泄漏给匿名访客或其他用户；Better Auth 从 `^1.6.2` 升级到 `^1.6.10` 并通过冒烟测试。

**In scope（本 phase 收口）：**
- Better Auth cookie domain / SameSite / Secure / path 正确化
- Nuxt SSR（blog / auth）读取 session 的通道
- Gateway 对 `/api/auth/*` 与带 Cookie/Authorization 请求的缓存行为
- Better Auth 从 1.6.2 升级到 ^1.6.10 全仓统一
- `apps/gateway/src/cache-middleware.ts` 里 `private scope` 死代码清理

**Out of scope（其他 phase）：**
- Dashboard 白名单、前台登录门控、成人内容过滤 → Phase 2
- R18 签名链接 / R2 直发 / 播放错误恢复 → Phase 3
- Progress 表与进度写入 → Phase 4
- Sentry / 部署回滚 / RUNBOOK → Phase 5

</domain>

<decisions>
## Implementation Decisions

### Cookie domain 与 Nuxt SSR session 通道
- **D-01:** Nuxt blog / auth 的 SSR 通过 server middleware 把请求 cookie 原样 forward 到 gateway 的 `/api/auth/get-session`，拿回 JSON 后放入 `useState('session')`。客户端 hydrate 时复用同一个 state，避免二次拉取。
- **D-02:** SSR fetch 的 base URL 一律来自 `NUXT_PUBLIC_API_URL`（本地 `http://localhost:8080`，生产 `https://starye.org`），**始终走 gateway**，不直连 `api.starye.org`。这样 cookie domain、CORS、trusted origins 语义全部一致。
- **D-03:** SSR fetch 失败（网络 / 5xx / 超时）→ 当作匿名会话降级，不抛异常、不阻塞页面渲染。超时设 3s。
- **D-04:** 同一 SSR 请求生命周期内对 `/api/auth/get-session` 做 request-scoped 去重（Nuxt `useAsyncData` / nitro `defineCachedEventHandler` memo，不是跨请求缓存），避免一个页面多次 `useSession()` 打多次上游。
- **D-05:** Cookie domain 维持 `starye.org`（不带前导点）。RFC 6265 下 leading dot 是历史遗留，现代浏览器对 `.starye.org` 和 `starye.org` 处理等价（都对所有子域可见）。AUTH-03 的文字表述按"语义等价"接受，不改 `apps/api/src/lib/auth.ts:52-54` 的 `new URL(env.WEB_URL).hostname.replace('www.', '')` 实现。
- **D-06:** `sameSite: 'lax'`、`secure: isHttps`（由 `x-forwarded-proto` 判定）、`path: '/'` 保持现状，覆盖 AUTH-03 的其余文字要求。

### Gateway bypass 触发条件（AUTH-07）
- **D-07:** `resolveCachePolicy` 扩展为读取请求头：若 `request.headers.has('cookie')` 或 `request.headers.has('authorization')` 任一为真，强制 `shouldStore = false`、`scope = 'bypass'`，覆盖原按路径算出的 policy。既不读 KV 也不写 KV。
- **D-08:** `/api/auth/*`、`/api/admin/*`、`/api/monitoring`、`/api/upload`、`/dashboard/*`、`/auth/*` 继续走 `NO_STORE_PREFIXES` 路径（独立于头判断）—— 即使请求无头也绝不缓存。现状（`apps/gateway/src/cache-middleware.ts:50`）满足 AUTH-06，无需改动。
- **D-09:** `Set-Cookie` 响应不存缓存的保护（`shouldCacheResponse` at `cache-middleware.ts:216`）**保留**，作为第二层防线 —— 即便 D-07 未来被改坏，也不会把带 `Set-Cookie` 的登录响应写进 KV。
- **D-10:** 新增响应头 `X-Cache-Reason: auth-headers` 以便排障；通过 `decorateResponse` 已有路径注入，不新增机制。
- **D-11:** 单元测试必须覆盖：无头 + public group → HIT 命中；带 session cookie + public group → BYPASS；带 Authorization + public group → BYPASS；`/api/auth/*` 无论有无头 → BYPASS。

### 私有 scope 缓存死代码清理
- **D-12:** 由 D-07 推出：请求只要带 cookie 就 bypass，private scope 永远走不到。一次性删除以下代码路径：
  - `PRIVATE_CACHE_PREFIXES` 常量（`cache-middleware.ts:49`）
  - `resolveBasePolicy` 中 `PRIVATE_CACHE_PREFIXES.some(...)` 分支（`cache-middleware.ts:142-151`）
  - `createCacheKey` 中 `userScope = hashValue(cookie)` 分支（`cache-middleware.ts:208-210`）
  - `decorateResponse` 中 `policy.scope === 'private'` 的 `Vary: Cookie` 分支（`cache-middleware.ts:358`）
- **D-13:** 类型收窄：`CacheScope = 'public' | 'bypass'`；`CacheGroup` 移除 `'favorites'`（无引用）。所有相关测试同步更新或删除。
- **D-14:** `hashValue` 函数保留（静态资源与其他路径可能后续用到），只移除它在 cookie 上的调用点。

### 登出跨端传播（AUTH-08）
- **D-15:** 登出行为：任一 app 的 `authClient.signOut()` 打 `/api/auth/sign-out`，better-auth 删 D1 session 行 + 清 cookie —— 服务端真实失效，满足 AUTH-08 文字。
- **D-16:** **同浏览器其他 tab 不主动传播**。其他 tab 下一次发起带 cookie 的请求即被 401（cookie 已清），由 Phase 2 的 `requireAuth` 中间件 + 前端 401 拦截器统一跳转到 `/auth/login`。成功标准 #2 "所有前端刷新即变回匿名态" 已被 cookie 清除 + 401 回绝满足。
- **D-17:** 不引入 BroadcastChannel / visibilitychange 重拉 —— 单用户自用场景下复杂度不值得。

### Better Auth 1.6.2 → ^1.6.10 升级
- **D-18:** 四个 package.json（`apps/api`、`apps/auth`、`apps/blog`、`apps/dashboard`）在**同一 commit** 内 `pnpm up -r better-auth@^1.6.10`。版本漂移过 drizzle-adapter 会触发行为不一致的风险，统一升最安全。
- **D-19:** 升级后冒烟测试（手动，写进 PLAN 的验证 step，最好能脚本化进 E2E）：
  1. 未登录访问 `/movie/` → 正常浏览公开目录
  2. 从 `/auth/login` GitHub 登录 → 跳回发起页
  3. 刷新当前页 → 仍登录
  4. 跨子路径 `/movie → /comic → /blog → /dashboard` → 所有 SPA 读得到同一用户
  5. Nuxt SSR `/blog/` view-source 检查是否带已登录标记（或 SSR HTML 中无闪烁的匿名态）
  6. 点登出 → `/api/auth/sign-out` 返回 200 + `Set-Cookie` 清除 → 刷新任一前端变回匿名
- **D-20:** 升级前先快速读 Better Auth 1.6.3 → 1.6.10 的 changelog（gsd-phase-researcher 负责）找出破坏性变更。若发现 breaking change，任务升到 HIGH 风险并回来讨论。

### Claude's Discretion

- `X-Cache-Reason` 的具体枚举值（`auth-headers` / `cookie-header` / `authorization-header` 区分到什么粒度）由 planner 决定
- Nuxt server middleware 的具体文件名与放置位置（`apps/blog/server/middleware/session.ts` vs plugin）由 planner 按 Nuxt 4 惯例选
- 冒烟测试的自动化形态（Playwright spec vs 手动 checklist）由 planner 评估当前 E2E 基础设施后决定
- `packageManager` 已锁 pnpm 10.33.0，升级命令 / lockfile 更新顺序按 pnpm 默认行为

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Gateway / cache 实现
- `apps/gateway/src/index.ts` — 入口，按路径 proxy + 传 `CACHE` binding；Phase 1 不改这里
- `apps/gateway/src/cache-middleware.ts` — 缓存策略核心；Phase 1 要改的代码全在这里
- `apps/gateway/wrangler.toml` — Gateway 环境变量 `API_ORIGIN` / `AUTH_ORIGIN` / `BLOG_ORIGIN` 等

### Better Auth 实现
- `apps/api/src/lib/auth.ts` — `createAuth(env, request)` 工厂，cookieDomain / sameSite / secure / baseURL 计算逻辑
- `apps/api/src/config.ts` — `getAllowedOrigins(env)` 构造 trustedOrigins
- `apps/api/src/routes/auth/index.ts` — Hono 上挂 `/api/auth/*` catch-all
- `apps/auth/app/lib/auth-client.ts` — `createAuthClient` from `better-auth/vue`
- `apps/blog/app/lib/auth-client.ts` — 同上
- `apps/dashboard/src/lib/auth-client.ts` — 同上
- `apps/api/wrangler.toml` — API Worker 的 `WEB_URL` / `ADMIN_URL` vars 与 D1/R2/KV bindings

### 需求与路线图
- `.planning/REQUIREMENTS.md` §Auth — AUTH-01..08 原文
- `.planning/ROADMAP.md` — Phase 1 目标、5 条成功标准、Research Flag
- `.planning/PROJECT.md` — Core Value、技术栈约束
- `.planning/STATE.md` — 当前里程碑、Phase 1 kick-off todo（含"audit cache-middleware 现状"）

### 代码库背景
- `.planning/codebase/ARCHITECTURE.md` — Gateway / API / Data 层关系，Authentication Flow 小节
- `.planning/codebase/INTEGRATIONS.md` — Better Auth + GitHub OAuth 集成、KV/D1/R2 绑定细节
- `.planning/codebase/CONCERNS.md` §"Better Auth Integration" 与 §"Gateway Cache Middleware" — 标记为 fragile areas，覆盖修改需要额外测试

### Better Auth 官方
- `https://www.better-auth.com/docs` — cookie 配置、`/api/auth/get-session` 行为、`drizzleAdapter` 用法
- `https://github.com/better-auth/better-auth/blob/main/CHANGELOG.md` — 1.6.3..1.6.10 变更记录（phase-researcher 负责落地具体版本的关键点）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createCachedProxy(cache, proxyFn)` in `apps/gateway/src/cache-middleware.ts:376` — 拿来主义，仅扩展其调用的 `resolveCachePolicy` 即可满足 D-07，不必改签名
- `decorateResponse` in `cache-middleware.ts:339` — 已有响应头注入位，D-10 的 `X-Cache-Reason` 直接挂这
- `shouldCacheResponse` in `cache-middleware.ts:216` — 已经屏蔽 `Set-Cookie` 响应，D-09 保留
- `createAuth(env, request)` in `apps/api/src/lib/auth.ts:34` — 返回 `auth` 实例，Nuxt SSR fetch 调 `/api/auth/get-session` 可经由 gateway 命中它
- `getAllowedOrigins(env)` in `apps/api/src/config.ts:3` — Nuxt SSR 访问时 `origin` 会来自 gateway，不必改 trustedOrigins

### Established Patterns
- Gateway 对 auth / admin / monitoring / upload 已有 `NO_STORE_PREFIXES`（`cache-middleware.ts:50`）—— Phase 1 新增的逻辑必须与这条路径共存（两者"或"关系），不能被绕过
- Better Auth cookie 名形如 `starye.session_token`（由 `advanced.cookiePrefix: 'starye'` 推得）—— 若未来按 cookie 名精确匹配 bypass，这里是 anchor 点
- Nuxt 4 `cloudflare-pages` preset（`apps/blog/nuxt.config.ts`、`apps/auth/nuxt.config.ts`）：server middleware 可直接用 nitro `defineEventHandler`，环境变量通过 `process.env` 或 `useRuntimeConfig()` 读
- Cloudflare Pages 上的 Nuxt Worker **没有 D1 binding**（只有 API Worker 有）—— 这就是为什么 D-01 必须选"HTTP fetch"而不是直接 `auth.api.getSession()`

### Integration Points
- Nuxt server middleware → gateway `/api/auth/get-session` → API Worker `createAuth(env, request)` → D1
- Gateway 收到带 cookie 的 `/api/movies` 请求 → 按 D-07 走 bypass → 透传到 API Worker
- 前端 SPA `authClient.signOut()` → Gateway → API Worker → better-auth 删 D1 session + 回 `Set-Cookie` 清除头 → Gateway 透传 → 浏览器清 cookie

### Phase 1 不触碰的脆弱区（CONCERNS 提示）
- `apps/gateway/src/cache-middleware.ts:436` 的 `invalidateCache` 前缀扫描：成本高但只在显式 invalidate 时走，Phase 1 改的是读写路径，不动它
- `apps/api/src/middleware/service-auth.ts` 的 CRAWLER_SECRET 明文头：Phase 1 不碰，遗留给后续任务
- `apps/movie-app/src/composables/useAria2.ts:60` 的 localStorage 凭据：与 session 无关，不入此 phase

</code_context>

<specifics>
## Specific Ideas

- "粗暴无脑"优于"精确匹配"—— 用户明确表达 Phase 1 以安全性 / 可理解性为先，hit 率损失在单用户场景可接受
- "死代码直接删，不留注释保留"—— 用户倾向果断清理，不保留"以防将来用"的冗余
- "同浏览器其他 tab 登出不广播"—— 自用场景下 BroadcastChannel 等复杂度不值得，401-redirect 已经够用
- AUTH-02 的"服务端正确读取 session"接受"通过 HTTP fetch 调 `/api/auth/get-session` 取回 session JSON"的实现（而非直接 D1 访问）—— 因为 Nuxt Worker 没 D1 binding，HTTP 是唯一可行路径

</specifics>

<deferred>
## Deferred Ideas

- **客户端 UI 风格统一**：用户在 gray area 选项里提到。Phase 1 是纯后端（cookie / SSR 通道 / gateway 缓存 / better-auth 升级），ROADMAP 5 条成功标准不含任何 UI 视觉交付。推迟到 Phase 2（前台登录门控 + dashboard 入口）或独立 UI phase 处理登录按钮 / 导航栏登录态 / 重定向 loading 等视觉层统一。
- **BroadcastChannel 跨 tab 登出传播**：若未来切到"多人/共享设备"场景再回来补。
- **visibilitychange 重拉 session**：同上，目前 401-redirect 已够。
- **精确按 cookie 名（`starye.session_token`）做 bypass**：如果 hit 率真的掉到影响使用再调，Phase 1 先用"有 cookie 就 bypass"。
- **`/api/favorites` / `/api/history` 迁入 `NO_STORE_PREFIXES`**：D-12 删掉 private scope 后这两个路径落入 `api` 默认分支（已是 bypass），事实上已达成。若想在语义上更明确可做一次重构，但非必要。
- **Better Auth 的 major 升级路径**：1.6.x → 1.7.x / 2.x 出现时再单独评估，本 phase 只走 patch 级。

### Reviewed Todos (not folded)
None —— `gsd-sdk todo.match-phase 1` 查询结果 `todo_count: 0`。

</deferred>

---

*Phase: 1-auth-gateway*
*Context gathered: 2026-05-11*
