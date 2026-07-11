# Phase 2: Dashboard 访问控制 + 前台登录门控 + 公网暴露面加固 - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

闭合"谁能看到什么"：

1. **Dashboard 准入** —— 只有 `ADMIN_GITHUB_ID` env var 白名单命中的 GitHub 账号能进入 `/dashboard/*`，未登录或非白名单在 Gateway 层被拦截，返回登录页而非 Pages 静态资源
2. **前台登录门控** —— 匿名用户可浏览 `/movie/` `/comic/` `/blog/` 的公开目录；点击收藏（唯一落地场景）时被拦截到登录页，登录后回弹原页面
3. **服务端成人过滤** —— 匿名用户与未 R18 验证的登录用户，通过 `/api/public/*` 获取的 list/search/recommend 响应中不包含 `isR18=true` 记录（服务端 WHERE 过滤，非 UI 隐藏）
4. **公网暴露面加固** —— Gateway 统一提供 `/robots.txt` + `X-Robots-Tag: noindex,nofollow`；`*.pages.dev` 由各 Pages 的 `_redirects` 301 回 `starye.org/<app>/`；`/api/docs` 与 `/api/openapi.json` 加 `requireAuth(['admin','super_admin'])`；Cloudflare WAF 对 `/api/auth/sign-in` 手配 10 req/min/IP 并写入 RUNBOOK

**In scope（本 phase 收口）：**
- Gateway `/dashboard/*` 前置鉴权拦截器（读 session + 查 ADMIN_GITHUB_ID）
- API `requireAuth` 对 `ADMIN_GITHUB_ID` 的优先判定（白名单覆盖 role）
- `apps/api/src/services/adult-filter.ts` 新建 + 所有 `public/*` list/search/recommend 调用
- `apps/movie-app` + `apps/comic-app` 的 `useAuthGuard` composable（收藏按钮接入）
- 登录 next 参数 + 同源 origin 校验（`apps/auth` 侧）
- Gateway `/robots.txt` 路由 + 响应头中间件注入 `X-Robots-Tag`
- 各 Pages `public/_redirects` 写 `*.pages.dev` → `starye.org` 301
- `/api/docs` 与 `/api/openapi.json` 加 `requireAuth`
- RUNBOOK.md 新增 "WAF 限速手配记录" 段落（Phase 5 做完整 RUNBOOK，本期先占位）

**Out of scope（其他 phase）：**
- 视频 R18 签名链 / R2 直发 / 播放错误恢复 → Phase 3
- Progress 表与进度写入 + 对应前端拦截场景 → Phase 4
- Sentry 接入 / 完整 RUNBOOK / Deploy workflow → Phase 5
- 成人内容"PIN 门控 / dashboard 手动复核" → v2 GATE-01/02
- dashboard 正式审核流 → v1 之后立项

</domain>

<decisions>
## Implementation Decisions

### Dashboard 门控架构

- **D-01:** Gateway Worker 层前置拦截 `/dashboard/*`。请求到达时先 `fetch` 同一 Worker 的 `/api/auth/get-session`（直连 `env.API_ORIGIN`，绕过 cache-middleware），拿到 session JSON 后判断 `user.githubId` 是否在 `ADMIN_GITHUB_ID` env 白名单中。未登录或非白名单 → `302 /auth/login?next=<encoded_origin_path>`。白名单命中 → 继续走现有 proxy 逻辑。
- **D-02:** Session 查询结果在 Worker 内存做 L1 缓存 30s（简单 `Map<sessionToken, {user, expiresAt}>`，Worker 实例生命周期内有效，冷启动重建）。避免每次 dashboard 静态资源请求都打一次 API。注意：Cloudflare Workers 的 isolate 不共享内存 —— L1 缓存是 best-effort 加速，不是安全边界。
- **D-03:** `ADMIN_GITHUB_ID` 纯 env var，支持单个 ID（`"12345678"`）或逗号分隔多个（`"12345,67890"`）—— planner 决定具体格式。Worker 侧 `apps/gateway/wrangler.toml` 与 `apps/api/wrangler.toml` 都要声明（gateway 用于拦截，API 用于 `requireAuth` 白名单判定）。Production 走 `wrangler secret put`，本地走 `.dev.vars`。
- **D-04:** 白名单覆盖角色判定：`ADMIN_GITHUB_ID` 命中即视为 `super_admin`，不依赖 D1 的 `user.role` 字段。`apps/api/src/middleware/guard.ts` 的 `requireAuth` 要新增"白名单短路"分支：`if (isInAdminGithubIdWhitelist(user.githubId)) { await next(); return }`。现有 `comic_admin`/`movie_admin`/`admin`/`super_admin` 四角色保留不动（v1 单用户场景仅作者使用，所以实质只 ADMIN_GITHUB_ID 在工作），但 RBAC 分层为 v2 多用户留口子。
- **D-05:** 非白名单用户登录后：Gateway 拦截到 `/dashboard/*` 时，跳 `/auth/login?error=not_admin&next=<origin>`（而非 `/unauthorized`），让 auth 页面显示"此账号没有管理员权限"文案。需求 ACCESS-02 文字"非白名单账号登录后进入 dashboard 立即被拒"通过此行为满足。

### 成人内容字段 + 过滤

- **D-06:** 不改 schema。REQUIREMENTS.md 的 `is_adult` 与 `schema.isR18`（`movies` / `comics` / `actors` / `publishers` 各自的 `isR18` 字段，默认 `true`）视为**语义等价**。CONTEXT.md 此处明确映射，下游 planner/researcher 不要再纠结改名。
- **D-07:** 新建 `apps/api/src/services/adult-filter.ts`，导出 `buildAdultVisibilityCondition(user, table)`：
  - `table` 为 `movies` | `comics` | `actors` | `publishers` 之一（都有 `isR18` 列）
  - 未登录（`user === undefined`）或 `user.isR18Verified === false` → 返回 `eq(table.isR18, false)`
  - `user.isR18Verified === true` → 返回 `undefined`（让上游 WHERE 不加此条件，看全部）
  - **统一注意：使用 `isR18Verified` 而非 `isAdult` 作为可见性开关**。`isAdult` 是"声明成年"，`isR18Verified` 是"已加入 R18 白名单"。Phase 2 沿用现有 `dashboard` 的 R18Whitelist UI 作为 admin 给自己打标的入口。
- **D-08:** 所有 `apps/api/src/routes/public/*` 的 list / search / recommend handler 统一调用 `buildAdultVisibilityCondition`，返回条件 push 进 `conditions[]`。当前需审核覆盖的 handler：
  - `apps/api/src/routes/public/movies/index.ts` 的 list（`/api/public/movies`）
  - `apps/api/src/routes/public/movies/index.ts` 的 `/api/public/movies/recommended`
  - `apps/api/src/routes/public/comics/index.ts` 的 list
  - `apps/api/src/routes/public/search/index.ts` 的 `/api/search`
  - 任何新加的 public handler 需在单测里验证"匿名访问返回不含 isR18=true 记录"
- **D-09:** 不新增 cache scope。Phase 1 `D-07` 已确定"带 cookie 全 bypass"——匿名用户的 SFW 响应仍可 KV 命中（列表永远不含 R18），登录用户自然 bypass 缓存。验证：Gateway 对 `/api/public/*` 无 cookie 请求 → cache lookup；有 cookie → bypass；不会出现"匿名缓存错配给登录用户"。
- **D-10:** `ACCESS-06` 的"爬虫入库时写入 `is_adult`"认定为**已有能力**：schema 里所有 `isR18` 默认 `true`，爬虫如果识别到源站"SFW"标签则显式 set false；本期 planner 不改爬虫逻辑，只在 RESEARCH.md 记录"确认爬虫写入路径覆盖率"的验证项。

### 前台登录门控形态

- **D-11:** 拦截形态：匿名用户点击需登录按钮 → `window.location.href = '/auth/login?next=' + encodeURIComponent(location.pathname + location.search)`。不弹 modal、不做 UI 占位锁图标。统一跳登录页，登录后回弹。
- **D-12:** 实现分层：**组件层为主**。新建 `apps/movie-app/src/composables/useAuthGuard.ts` 与 `apps/comic-app/src/composables/useAuthGuard.ts`（或 `packages/ui` 下公用一份，planner 按当前架构选），导出 `useAuthGuard(): { requireLogin: (nextPath?: string) => boolean }`。业务代码写 `if (!requireLogin()) return; await addFavorite(...)`。API 401 拦截器**不作为 Phase 2 交付**（不做"API 兜底"方案），因为：(a) 组件层拦截已经覆盖所有触发点，(b) 401 闪烁体验差，(c) Phase 5 做 Sentry 时再一起看 401 噪音。
- **D-13:** 本期**仅收藏按钮**落地拦截，不扩展到其他场景：
  - `apps/movie-app` 的 `MovieDetail.vue` / `MovieCard.vue` 上的收藏心形按钮
  - `apps/comic-app` 对应位置的收藏按钮
  - 历史/进度入口 → Phase 4 再接入（composable 要设计成下期可复用）
  - 成人内容点击 → 服务端 `buildAdultVisibilityCondition` 已从 list 里过滤，匿名根本看不到 R18 卡片，不需要 UI 层拦截
  - 用户反馈表单 → 本期不在场景清单
- **D-14:** 登录回弹：`/auth/login?next=<encoded_url>`，登录成功（Better Auth callback 结束后）在 auth 页前端做 `next` 解析与**同源校验**：`new URL(next, location.origin).origin === location.origin` 时才 `location.href = next`，否则回 `/` 防 open redirect。校验逻辑放在 `apps/auth/app/` 的登录成功回调里（具体文件由 planner 按 Nuxt 4 结构选）。

### 暴露面加固落地位置

- **D-15:** `robots.txt` 与 `X-Robots-Tag` 统一走 Gateway：
  - 在 `apps/gateway/src/index.ts` 新增 `/robots.txt` 路由（在所有 proxy 分支之前 match），返回纯文本 `User-agent: *\nDisallow: /dashboard\nDisallow: /auth\nDisallow: /api\n`
  - 新增响应头中间件：当 `url.pathname` 匹配 `/dashboard/*` 或 `/api/admin/*` 时，在 proxy 返回的 Response 上注入 `X-Robots-Tag: noindex, nofollow`（直接 `new Headers(response.headers).set(...)`）
  - 各 Pages 应用不自理 robots.txt，避免 `starye.org/robots.txt` 与 `blog.starye.org/robots.txt` 双源不一致
- **D-16:** `*.pages.dev` 301 回 `starye.org/<app>/` 由**各 Pages 应用的 `public/_redirects`** 承担：
  - `apps/movie-app/public/_redirects`：`https://starye-movie.pages.dev/* https://starye.org/movie/:splat 301!`
  - `apps/comic-app`、`apps/dashboard`、`apps/auth`、`apps/blog`、`apps/tavern`（若有）同理
  - `blog` 走 `blog.starye.org` 自定义域，不需要 301；但保留兜底规则防止直链 `starye-blog.pages.dev`
  - 所有 6 个 `*.pages.dev` 映射须在一个 commit 内统一加完，避免遗漏
- **D-17:** `/api/docs` 与 `/api/openapi.json` 生产保护：直接在 `apps/api/src/index.ts:171` 前挂 `requireAuth(['admin','super_admin'])`（已有白名单 D-04 的账号自动通过）。**不用 env 开关关停**，保留本地/生产都能访问（方便作者查 API）。匿名 401。
- **D-18:** Cloudflare WAF Rate Limiting 对 `/api/auth/sign-in` 限 10 req/min/IP：
  - 在 Cloudflare Dashboard → Security → WAF → Rate Limiting Rules 手动配置（免费 plan 支持基础 Rate Limiting）
  - Phase 2 交付物仅包含 `RUNBOOK.md` 新增段落 "WAF 手配记录"：规则名 / 匹配条件 / 阈值 / 动作 / 配置截图或引用，供 Phase 5 做完整 RUNBOOK 时合并
  - 不做自实现 KV/Durable Object 限速代替（过度工程）

### Claude's Discretion

- `ADMIN_GITHUB_ID` env 格式（单值 vs 逗号列表）由 planner 按 Cloudflare secrets 习惯选
- L1 session 缓存的具体数据结构（`Map` vs `LRUCache`）由 planner 选；但 TTL 固定 30s，不做配置化
- `useAuthGuard` 放 `packages/ui` vs 各 app 本地由 planner 按当前两 app 的 composable 组织决定
- Gateway `/robots.txt` 路由放在 `index.ts` 分支首位还是拆到 `robots.ts` 由 planner 选
- 各 `_redirects` 文件是否已存在、是否需要 append 而非覆盖由 planner 在 research 阶段 check
- `X-Robots-Tag` 注入位置（proxy 函数内 vs `cachedProxy` 外层装饰）由 planner 选，但须覆盖 `/dashboard/*` 和 `/api/admin/*` 两条路径
- Better Auth 返回的 `user` 对象里 `githubId` 的具体字段名（可能是 `githubId` / `accounts[0].providerAccountId` / 自定义 additionalFields）由 researcher 在 Better Auth 1.6.10 + GitHub social provider 下确认

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线图
- `.planning/REQUIREMENTS.md` §Access Control（ACCESS-01..07）与 §Public Security（PUBSEC-01..05）— 13 条需求原文
- `.planning/ROADMAP.md` Phase 2 段（`40..50` 行）— 目标、5 条成功标准
- `.planning/PROJECT.md` — Core Value、单用户约束、"自用工具不做多租户"
- `.planning/STATE.md` — 当前里程碑、Phase 2 kick-off 预约（`gsd-sdk todo.match-phase 2` 返回 0 条，无历史积压）
- `.planning/phases/01-auth-gateway/01-CONTEXT.md` — Phase 1 的 D-01..D-20，特别是 D-07（带 cookie 全 bypass）、D-16（登出后 401 由 Phase 2 requireAuth + 前端拦截器收口）—— Phase 2 的地基

### Gateway 实现
- `apps/gateway/src/index.ts` — 入口，`/dashboard/*` 拦截器与 `/robots.txt` 路由要加在这里
- `apps/gateway/src/cache-middleware.ts` — Phase 1 D-07 后的缓存策略（带 cookie bypass），新 `/dashboard` 前置拦截要在 cache middleware **之前**执行避免泄漏
- `apps/gateway/wrangler.toml` — `ADMIN_GITHUB_ID` 新 secret 在此声明

### API 鉴权与成人过滤
- `apps/api/src/middleware/guard.ts` — `requireAuth`，需加白名单短路分支（D-04）
- `apps/api/src/middleware/service-auth.ts` — `serviceAuth` 已 deprecated，不在本期触碰（Phase 1 deferred 提到）
- `apps/api/src/middleware/resource-guard.ts` — `requireResource`，本期不改，参考其模式
- `apps/api/src/lib/auth.ts` — Better Auth 工厂，`user.githubId` 字段确认点；本期不改 cookie 逻辑
- `apps/api/src/lib/permissions.ts` — 现有 `hasPermission(user, resource)`，白名单短路要在这之前
- `apps/api/src/routes/public/movies/index.ts` — list + recommend 的 conditions 构造（需接入 `buildAdultVisibilityCondition`）
- `apps/api/src/routes/public/comics/index.ts` — 同上
- `apps/api/src/routes/public/search/index.ts` — 同上
- `apps/api/src/routes/actors/services/auth.service.ts` — 现有 `checkUserAdultStatus` 参考（`user.isAdult || user.isR18Verified || user.role === 'admin'`）；本期 `buildAdultVisibilityCondition` 应与此语义对齐
- `apps/api/src/index.ts:171` — `/api/docs` Scalar 挂载点，加 `requireAuth`

### Schema 与字段
- `packages/db/src/schema.ts`
  - `user.isAdult`（`line 12`）— 声明成年
  - `user.isR18Verified`（`line 13`）— R18 可见性开关（**本期过滤使用此字段**）
  - `movies.isR18`（`line 109`）、`comics.isR18`（`line 169`）、`actors.isR18`（`line 231`）、`publishers.isR18`（`line 267`）— 默认 `true`

### Dashboard 前端（前端路由调整）
- `apps/dashboard/src/router/index.ts:134` — `router.beforeEach`，Gateway 拦截生效后此处可简化为"拦未登录 + 检查角色"，但 ACCESS-02 已在 Gateway 满足，前端拦截作为第二层防线保留
- `apps/auth/app/pages/login.vue`（及 Nuxt 4 目录结构下的实际路径）— 登录成功回调需加 `next` 同源校验

### 前台 composable 参考
- `apps/movie-app/src/stores/user.ts` — Pinia store，`userStore.user` 登录态来源
- `apps/movie-app/src/components/Header.vue:94` — `userStore.user.isR18Verified` 的现有消费点，参考拼写
- `apps/movie-app/src/composables/useFavorites.ts` — 收藏 composable，本期要在调用处插 `useAuthGuard`
- `apps/comic-app/src/composables/` — 同构参考

### 代码库背景
- `.planning/codebase/ARCHITECTURE.md` §Authentication Flow — 5 步 cookie 流
- `.planning/codebase/INTEGRATIONS.md` §Auth Provider — Better Auth 配置快照
- `.planning/codebase/CONCERNS.md` §"Better Auth Integration" §"Gateway Cache Middleware" — fragile 区，改动需额外测试
- `.planning/codebase/CONCERNS.md` §"SQL Injection via sql.raw()" — 本期涉及 WHERE 构造，如命中需主备注

### Cloudflare 平台
- Cloudflare Pages `_redirects` 文档：`https://developers.cloudflare.com/pages/configuration/redirects/` — 语法 `source destination status`
- Cloudflare WAF Rate Limiting（免费 plan 基础限速）：`https://developers.cloudflare.com/waf/rate-limiting-rules/` — 规则语法与阈值
- Better Auth GitHub social provider 返回字段：`https://www.better-auth.com/docs/authentication/github` — 确认 `githubId` 挂载位置

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireAuth(requiredRole?)` in `apps/api/src/middleware/guard.ts:11` — 直接扩展，加白名单短路分支即可，不需要新中间件
- `checkUserAdultStatus(user)` in `apps/api/src/routes/actors/services/auth.service.ts:13` — 已判 `isAdult || isR18Verified || role === 'admin'`，`buildAdultVisibilityCondition` 可内部复用此判断
- `createCachedProxy(cache, proxyFn)` in `apps/gateway/src/cache-middleware.ts:376` — Gateway `/dashboard` 拦截加在其**前面**（在 `cachedProxy` 调用之前决定是否 302）
- `decorateResponse` in `apps/gateway/src/cache-middleware.ts:339` — 现成响应头注入位，`X-Robots-Tag` 可以挂这条路径
- `userStore` in `apps/movie-app/src/stores/user.ts` — 现有 Pinia store，`useAuthGuard` 内部 `userStore.user` 读登录态
- `authClient` in `apps/dashboard/src/lib/auth-client.ts`、`apps/movie-app/src/lib/auth-client.ts`（若存在）— Better Auth Vue client
- `apps/dashboard/src/views/R18Whitelist.vue` — admin 侧现成 R18 白名单管理 UI，`user.isR18Verified` 的打标入口已存在，本期不改

### Established Patterns
- Hono middleware 链：`requestId → logger → CORS → auth → database → timing → error`（`apps/api/src/index.ts:40-50`）—— 新白名单短路放在 `requireAuth` 内部，不新增 middleware
- Gateway 路径分支结构（`apps/gateway/src/index.ts:40-107`）—— `/robots.txt` 和 `/dashboard` 拦截在 `/api` 分支之前；现有 `cachedProxy(..., { bypassCache: true })` 已被 dashboard 使用
- Public route 的 conditions 数组拼接（`apps/api/src/routes/public/movies/index.ts:80`）—— `buildAdultVisibilityCondition` 返回值直接 `if (cond) conditions.push(cond)`
- 前端 `router.beforeEach` 未登录 `window.location.href = '/auth/login?redirect=...'`（`apps/dashboard/src/router/index.ts:144`）—— 注意：dashboard 用 `redirect` 参数，本期对齐需求用 `next`；若 auth 页现支持 `redirect`，planner 决定是否重命名或双支持
- Pages 的 `public/` 静态文件打包到 dist（Vite 默认）—— `_redirects` 放这里会被 Pages 识别
- `.dev.vars` 与 `wrangler secret` 分环境注入（`apps/api/.dev.vars`、`apps/gateway/.dev.vars`）—— `ADMIN_GITHUB_ID` 按此模式

### Integration Points
- Gateway `/dashboard/*` → fetch `${API_ORIGIN}/api/auth/get-session` → 读 session → 判白名单 → 302 或 continue
- API `requireAuth` 内 → `session.user.githubId` → 查 `c.env.ADMIN_GITHUB_ID` → 短路 or fallthrough
- `adult-filter.ts` → 注入 `apps/api/src/routes/public/**/*.ts` 所有 WHERE 构造位
- `useAuthGuard` → movie-app/comic-app 的收藏按钮 onClick → `requireLogin()` → 未登录 `window.location.href = '/auth/login?next=...'`
- Gateway 响应中间件 → 拦 `/dashboard/*` 或 `/api/admin/*` response → `headers.set('X-Robots-Tag', 'noindex, nofollow')`

### Phase 2 不触碰的脆弱区（CONCERNS 提示）
- `apps/api/src/services/query-builder.ts:33` 的 `sql.raw()` SQL 注入点：本期加的 `buildAdultVisibilityCondition` 用 Drizzle `eq()`，不走 `sql.raw`，**不触发此风险**
- `apps/api/src/middleware/service-auth.ts` CRAWLER_SECRET 明文头：Phase 1 deferred、Phase 2 继续 deferred，不碰
- `apps/gateway/src/cache-middleware.ts:436` `invalidateCache` 前缀扫描：本期不改读写路径外的 invalidate，不动它
- `apps/api/src/routes/admin/*/index.ts` 超大文件（如 `admin/actors/index.ts` 1213 行）：本期只在 `/api/admin/*` 路由上加 Gateway `X-Robots-Tag` 注入（不改 handler），避免牵连

</code_context>

<specifics>
## Specific Ideas

- "Gateway 层拦截，Pages 静态资源都别放出去" —— 用户明确选择把 dashboard 挡在 Worker 层，不信任纯前端 router guard
- "白名单覆盖角色" —— 单用户场景下 DB role 是防御深度，env var 才是权威，ADMIN_GITHUB_ID 命中即 super_admin
- "isR18 不改名" —— 60+ 处引用，改名纯 churn；文档对齐即可
- "isR18Verified 作为 R18 可见性开关，不合并到 isAdult" —— 两个字段语义分离（声明成年 vs 白名单放行），现有 R18Whitelist UI 与 DrawerFooter.vue 已按此分层渲染，保留
- "前台门控只做收藏" —— Phase 4 历史/进度再接 `useAuthGuard`；成人内容靠服务端过滤，匿名根本看不到 R18 卡片，前端不需要点击拦截
- "WAF 手配 + RUNBOOK 即可" —— 不自己实现 KV 限速，单用户场景无暴力破解压力
- "`_redirects` 6 处统一一次加" —— 分散加容易漏

</specifics>

<deferred>
## Deferred Ideas

- **API 401 拦截器兜底方案** —— 本期不做。组件层 `useAuthGuard` 已覆盖所有触发点；Phase 5 做 Sentry 时再看 401 噪音
- **Modal 登录 / UI 占位锁图标** —— 单用户场景复杂度不值得，直接 redirect 已够
- **`serviceAuth` → `requireAuth + requireResource` 迁移** —— Phase 1 deferred、Phase 2 继续 deferred，不阻塞 v1，留到稳定期
- **自实现限速中间件（KV / DO 计数）** —— 过度工程；WAF 手配即可
- **成人内容 PIN 门控** —— v2 GATE-01，多人/共享设备场景才值得
- **dashboard 手动标注 isR18 的复核入口** —— v2 GATE-02，补爬虫漏报
- **Better Auth hooks 把 ADMIN_GITHUB_ID 写回 DB role** —— 曾在 Q3 作为备选；选 env-only 后此路径关闭。未来若做多管理员可以复活
- **`/robots.txt` 里是否包含 sitemap 行** —— 本期 disallow 为主，sitemap 留到未来 SEO 真需要（目前 PROJECT.md 已排除 SEO）
- **favicon / opengraph 元数据的 noindex 处理** —— 无需单独处理，`X-Robots-Tag` 只作用于 HTML/JSON 路径；静态资源 bot 不 index
- **各前端登录后的 `location.href = next` vs Vue Router push** —— Gateway 拦截后通常跨 app 跳转，`location.href` 最稳；planner 按实际场景选

### Reviewed Todos (not folded)
None —— `gsd-sdk todo.match-phase 2` 返回 `todo_count: 0`。

</deferred>

---

*Phase: 2-dashboard*
*Context gathered: 2026-05-11*
