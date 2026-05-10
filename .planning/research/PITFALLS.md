<!-- generated: 2026-05-10 -->
# Pitfalls Research

**Domain:** 个人内容中台 / Cloudflare edge 全栈（Workers + Pages + D1 + R2 + KV），单一 Gateway 反代，Better Auth，Puppeteer 爬虫
**Researched:** 2026-05-10
**Confidence:** HIGH（坑点基于官方文档 + 现有 `CONCERNS.md` 的证据；phase 建议基于 `PROJECT.md` 的 Active 列表）
**Scope:** 针对 v1 目标"部署可用、日常使用"，聚焦到能阻塞"打开站点 → 登录 → 刷视频/漫画 → 不崩"这条主路径的坑

---

## Critical Pitfalls

### Pitfall 1: gateway 反代 + Better Auth cookie domain 错位，登录看似成功但 session 丢

**What goes wrong:**
用户在 `starye.org/auth/login` 用 GitHub OAuth 登录成功、Set-Cookie 正常返回，但下一次请求 `/api/*` 或跳 `/dashboard` 时 session 没带上，或每次刷新都"像第一次登录"。典型症状：

- dashboard 进入后一秒被踢回登录页
- movie-app 能拉公开列表但一收藏就 401
- 浏览器 DevTools → Application → Cookies 里 `starye.better-auth.session_token` 要么不存在、要么 `Domain` 字段是 `api.starye.org` 而不是 `.starye.org`

**Why it happens:**
现在 `apps/api/src/lib/auth.ts:105` 的 cookie domain 是从 `WEB_URL` host 截出来的（去掉 `www.`），如果：

1. `WEB_URL` 设成 `https://starye.org` → cookie domain 是 `starye.org` → 只能在 `starye.org`（不含子域名）读到
2. `WEB_URL` 设成 `https://www.starye.org` → 截成 `starye.org` → 子域名 `api.starye.org`、`blog.starye.org` 才能共享
3. Gateway 把 `/api/*` 反代到 `api.starye.org` → 但浏览器看到的是 `starye.org` 响应 → 如果 Worker 回的 Set-Cookie 带 `Domain=api.starye.org`，浏览器直接丢弃
4. 开发环境 `http://localhost:8080` → cookie domain 没写（正确）但 `secure=true` 会被 Chrome 拒写
5. `sameSite: 'lax'` 在 OAuth 回跳链路的"跨站 POST"环节会被吃掉（GitHub → `/api/auth/callback` 如果走的是 POST 而不是 top-level GET redirect 会丢）

**How to avoid:**
- Cookie domain 用 `.starye.org`（点开头显式共享），不要依赖 host 截断
- Gateway 反代时 **保留原 Host 头**（或用 `url.host = request.headers.get('host')` 重写），让 Better Auth 看到的是 `starye.org` 而不是 `api.starye.org`
- 明确测试三个回路：
  1. `starye.org` 根路径登录 → `starye.org/dashboard` 能读 session
  2. `starye.org` 登录 → `starye.org/movie` 能读 session（同路径前缀不同 app）
  3. 本地 `http://localhost:8080` 登录 → `sameSite: 'lax'` + `secure: false` 能工作
- 在 `getAllowedOrigins(env)` 返回列表里 **同时** 包含 `https://starye.org` 和 `https://www.starye.org` —— 少一个会让 CORS 预检在某些路径挂掉
- OAuth callback 必须是 top-level navigation（GET redirect），**不要**在 auth app 里包成 XHR / fetch 调用

**Warning signs:**
- DevTools 里 cookie 的 `Domain` 不是 `.starye.org`
- Network 面板里 `/api/auth/get-session` 返回 200 但 body 是 `{user: null}`
- Set-Cookie header 的 `Path` 不是 `/`
- 登录链路里出现任何 302 到 `http://`（非 HTTPS）→ `secure` cookie 被浏览器丢

**Phase to address:** **Phase 1 — Auth 全链路打通**（阻塞所有后续需要登录的功能）

---

### Pitfall 2: R2 视频 Range 请求在跨域 `<video>` 标签下不工作，播放卡在开头

**What goes wrong:**
movie-app 页面点播放 → 前 30 秒能播，但拖动进度条、或视频大于某个阈值时直接黑屏/停住。Console 里看到 `net::ERR_BLOCKED_BY_ORB` 或 CORS 预检失败，Network 里 206 Partial Content 请求失败。

**Why it happens:**
1. R2 bucket 的 CORS 配置里 **没加** `Range` 到 `AllowedHeader`，也没把 `Content-Range`、`Accept-Ranges`、`Content-Length` 加到 `ExposeHeader`
2. `<video>` 标签的 `crossorigin="anonymous"` 和 R2 CORS 的 `AllowedOrigins` 不匹配
3. 用 presigned URL 播视频时，URL 1 小时过期 —— 用户暂停一段时间后恢复，最新的 Range 请求返回 403
4. R2 自定义域（比如 `cdn.starye.org`）和 presigned URL 的签名域名不一致 → 签名校验失败
5. Cloudflare 的 CDN 在未配置 `Cache-Control` 时会命中小对象缓存，但大视频的 Range 请求绕过缓存每次回源 R2 → 成本/延迟双升

**How to avoid:**
- R2 CORS 必须通过 S3 API 或 dashboard 设置（[官方文档](https://developers.cloudflare.com/r2/buckets/cors/)），至少包含：
  ```json
  {
    "AllowedOrigins": ["https://starye.org", "https://www.starye.org"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "If-Range", "If-Modified-Since"],
    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges", "ETag"],
    "MaxAgeSeconds": 3600
  }
  ```
- 视频 URL 策略二选一：
  - **A.** 公开读 + 防盗链：用 Cloudflare Workers 自定义域做 Referer 检查（白名单 `starye.org`），走 CDN 缓存 → 适合自用但要防爬虫
  - **B.** 签名短 URL + 客户端续签：用 `/api/media/sign?key=...` 返回 1 小时签名，前端监听 `error` 事件自动刷新 URL 并 `video.load()`
- **不要**在 `<video src>` 里直接嵌 presigned URL —— 一旦中途过期、`<video>` 无法恢复播放位置。改用 `<source>` + error 处理
- 大文件（>50MB）在 Cloudflare CDN 配置 `Cache-Control: public, max-age=86400` 让 Range 请求也能命中边缘缓存

**Warning signs:**
- 日志里看到 `206 Partial Content` 数量远低于 `200 OK`（说明客户端根本没发 Range）
- Network 里视频请求 Response Headers 里没有 `Accept-Ranges: bytes`
- 移动端 Safari 播放直接报"无法播放此视频"（Safari 对 Range 缺失最敏感）
- `CONCERNS.md` 里已经记录 movie-app 播放"偶尔出错"，`MovieDetail.vue:1162` 组件超千行，很可能吞掉了具体错误

**Phase to address:** **Phase 3 — movie-app 播放链路加固**（`PROJECT.md` Active 里的 "movie-app 播放页稳定性"）

---

### Pitfall 3: D1 prepared statement 在 Worker 里循环复用 = 隐式 "N 次独立请求"

**What goes wrong:**
爬虫一次同步塞 200 部电影，API 侧 Worker 内存猛涨、请求超时、或返回 "D1_ERROR: too many SQL statements"。或看似成功但 D1 账单/指标页 `rows_read` 暴涨 10 倍。

**Why it happens:**
1. D1 的 [官方文档](https://developers.cloudflare.com/d1/platform/limits/) 约束：
   - 单条 SQL 语句长度上限 **100 KB**
   - 每次 `db.batch([...])` 在一个 D1 请求里串行执行（不是真事务，而是按顺序原子应用）
   - 一次 Worker 调用里发 100 条独立 `prepare().run()` = 100 次 D1 请求 = 网络往返 100 次
2. Drizzle 的 `.values([...大数组])` 在参数超过 SQLite 的 **999 个绑定参数** 上限时会报错或被拆分
3. 每次 `new Database()` / `createDb(env.DB)` 都会创建新的 prepared statement 缓存，在 Worker 热路径上反复重建浪费时间
4. D1 **不支持跨 statement 的事务**（`BEGIN` / `COMMIT` 在 Worker 环境无效）—— 依赖"扣库存 + 写订单"原子性的代码在 D1 下会有脏数据

**How to avoid:**
- 批量写入统一用 `db.batch(statements)`（Drizzle 支持 `db.batch(...)`）—— 一次 D1 请求做完
- 拆分策略：按 **90 条 / 批** 分块（给参数数量留安全边界），用 `Promise.all` 发多个 batch
- SQLite 参数上限防御：若单条 INSERT 涉及 >100 列 × 9 行 ≈ 900 参数，拆成多条
- 写事务性强的逻辑（例如"创建 favorite 同时更新 counter"）：
  ```ts
  await db.batch([
    db.insert(favorites).values(...),
    db.update(movies).set({ favoriteCount: sql`favoriteCount + 1` })...
  ])
  ```
  而不是两次 `await` —— 后者中间失败会脏
- 爬虫 sync 路由加入**幂等键**（例如 `movie.code` UNIQUE 约束 + `ON CONFLICT DO UPDATE`），重试不怕
- 不要在 handler 每次请求都 `new Drizzle()` —— 让它随请求短暂存在即可，但确保 schema 是 import 的（不是运行时构造）

**Warning signs:**
- Worker Observability 里某个 endpoint 的 `wall_time` 突然 >10s 且 `cpu_time` 很低 → 在等 D1 网络往返
- D1 console 里 `rows_read` 远大于业务预期
- 爬虫 sync 后某些 movie 部分字段是新的、部分是旧的（事务断裂）
- Error log 出现 `too many SQL variables` 或 `statement too long`

**Phase to address:** **Phase 4 — comic 阅读进度 & movie 收藏写入模型** 里统一重构 + **Phase 6 — 爬虫 sync 路由加固**

---

### Pitfall 4: Drizzle 迁移在 D1 上回滚困难 —— 一次 `ALTER TABLE DROP COLUMN` 即可能永久丢数据

**What goes wrong:**
`pnpm drizzle-kit generate` 检测到你重命名了一列，生成的 SQL 是 `DROP COLUMN old` + `ADD COLUMN new` —— 在 local 上看起来 OK，一 `wrangler d1 migrations apply --remote` 生产数据直接蒸发。之后因为 Drizzle 没有内置 `down` 迁移，想回退只能手写 SQL 反向补。

**Why it happens:**
- Drizzle Kit 目前**不生成 down migrations**（见 [GitHub discussion #1339](https://github.com/drizzle-team/drizzle-orm/discussions/1339) 和 [issue #2352](https://github.com/drizzle-team/drizzle-orm/issues/2352)）
- SQLite 的 `ALTER TABLE` 能力有限：不支持直接 rename column（仅 3.25+ 支持，D1 支持但 Drizzle 生成的 SQL 不一定走 rename 路径）、不支持 DROP CONSTRAINT
- Drizzle 对"重命名"的识别基于启发式，如果 schema diff 不够明显就当成"删 + 加"
- D1 没有原生 snapshot / PITR（2026 仅有 time travel 30 天，恢复粒度是整个 DB 不是表）
- 开发环境用 `--local` SQLite 文件，prod 是 D1，两者 schema 飘移常见（本地手改过表又忘了提交 migration）

**How to avoid:**
- **强制流程**：每次 `drizzle-kit generate` 后，**人工 diff** `packages/db/drizzle/*.sql`，看到 `DROP COLUMN` 必须停下来问"真的要丢数据吗？"
- 列重命名走三步发布：
  1. Add new column
  2. Backfill + 双写
  3. 下一个版本才 drop old
- 生产 migration 前做一次 D1 **备份导出**：`wrangler d1 export starye-db --remote --output=backup-YYYYMMDD.sql`（放到 GitHub Actions secret 里上传到 R2）
- 在 `.github/workflows/deploy-migrations.yml` 里加 dry-run 步骤：先 `--preview` 看 SQL，PR 里 reviewer 必须 ack
- 用 **一个** `.env` 启用 "migration lock"：在 `packages/db` 加 `drizzle-meta` 表记录 schema hash，启动 API 时对不上就拒绝启动（避免运行期跑在错 schema 上）
- 本地开发只用 `wrangler d1 migrations apply --local`，**不要**手写 `ALTER TABLE` 到本地 SQLite

**Warning signs:**
- `drizzle/meta/_journal.json` 和 git 的 migration 文件对不上
- `git diff packages/db/drizzle/` 出现 `DROP COLUMN`、`DROP TABLE`
- 生产 API 报错 `no such column: xxx`（迁移没跑 or 跑了旧的）
- 开发环境 schema 和生产不一致 → E2E 过了但线上炸

**Phase to address:** **Phase 5 — 部署基础盘**（`PROJECT.md` 里的"一键部署、可回滚"）必须解决

---

### Pitfall 5: dashboard 被搜索引擎索引 → 整个后台 URL 结构、接口签名暴露

**What goes wrong:**
某天 Google 搜 `site:starye.org` 出现 `/dashboard/movies?id=...` 或 `/api/admin/...` 链接，陌生人看到登录页就开始撞库 / 爆接口。虽然有鉴权，但 URL pattern 本身泄漏了系统结构。

**Why it happens:**
- Cloudflare Pages 默认不屏蔽爬虫
- `robots.txt` 在 gateway 里没统一处理，每个 app 自己决定 → dashboard 和 auth 很容易漏
- `/api/*` 的 OpenAPI/Scalar UI 默认开在 `/api/docs`，会被爬到
- 即便有登录，登录页本身被索引也会在 SERP 里显示"登录 - Starye 后台"，增加被爆破的诱因
- sitemap.xml（Nuxt 可能自动生成）把 `/dashboard/*` 路由也列进去了

**How to avoid:**
- Gateway 加一个全局 `/robots.txt` 路由：
  ```
  User-agent: *
  Disallow: /dashboard
  Disallow: /auth
  Disallow: /api
  Allow: /blog
  Allow: /movie
  Allow: /comic
  ```
  —— 但注意 robots.txt **不是安全机制**，只是行为规范
- dashboard、auth 的 HTML `<meta>` 加 `<meta name="robots" content="noindex,nofollow">`
- gateway 对 `/dashboard/*` 和 `/api/admin/*` 的响应强制加 `X-Robots-Tag: noindex, nofollow` 头（robots.txt 拦不住的 Bingbot 能拦）
- 把 OpenAPI docs 移到需要登录的路径（或 prod 环境关闭）：检查 `apps/api/src/routes/docs.ts`，加 `requireAuth` 守卫
- 登录接口加 **速率限制**（现在 `CONCERNS.md` 明说 "No rate limiting on public API endpoints"）—— Cloudflare WAF 的 Rate Limiting 免费规则 + `/api/auth/*` 10 次/分钟 IP 限流
- 爬虫端点（`/api/movies/sync` 等）加 **IP allowlist**（GitHub Actions IP 范围）或保留 service token 但加强轮换

**Warning signs:**
- Google Search Console 里收到 `site:starye.org` 的索引通知（建议主动注册 GSC 监控）
- gateway 日志出现 `/dashboard/*` 的 User-Agent 是 Googlebot / Bingbot / GPTBot
- `/api/auth/sign-in` 有同 IP 连续失败 >10 次 → 没有告警

**Phase to address:** **Phase 2 — dashboard 访问控制 + 前台登录门控**（同时加 robots 与限流）

---

### Pitfall 6: Puppeteer 在 GitHub Actions 里被反爬系统识别 → crawler 数据断供

**What goes wrong:**
`daily-movie-crawl.yml` 前 3 天好好的，第 4 天开始每次 run 都抓 0 条，日志里 `page.goto` 超时或返回 Cloudflare"验证你是人类"页面。GitHub Actions IP 段（`140.82.x.x`、`20.x.x.x`）被 JavBus / Cloudflare Challenge 列黑。

**Why it happens:**
1. GitHub Actions 用的是 Azure 数据中心 IP，**早就**被反爬服务列入"数据中心 IP"黑名单
2. Puppeteer 默认 User-Agent 含 `HeadlessChrome` 关键字 —— 哪怕用了 stealth 插件，一些检测项（`navigator.webdriver`、CDP `Runtime.enable` 痕迹）仍会泄漏
3. `navigator.plugins`、`WebGL` fingerprint、时区、screen 尺寸都是 headless 指纹 —— stealth plugin 覆盖不全
4. 目标站 Cloudflare 打开 Turnstile/JS Challenge → Puppeteer 等不到内容就 timeout
5. `packages/crawler` 里默认 30s navigation timeout（见 Puppeteer [issue #8829](https://github.com/puppeteer/puppeteer/issues/8829)），一阻塞直接跑 fail
6. 容器内存 7GB（GitHub runner），多个 Chrome tab + 图片下载轻松触顶 → OOMKilled

**How to avoid:**
- **必须配住宅代理**（见 `INTEGRATIONS.md` 已有 `PROXY_SERVER` 变量）—— 用靠谱的住宅代理池（如 Bright Data、Smartproxy）或自建：每次 crawl 轮换 IP
- 单次 Action run 内限制 **一个 Chrome 实例**，处理完一批就关，不要复用长 session（session 越长越容易被指纹关联）
- 超时策略：
  - `page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })`
  - 页面内资源用 `page.waitForSelector(critical_selector, { timeout: 30_000 })` 而不是 `waitForNetworkIdle`（JAV 站内嵌大量广告 iframe，永远不 idle）
  - 整体 wrap 在 `Promise.race([crawl(), timeout(5*60*1000)])`
- **检测 challenge 页**：抓到含 `"Just a moment..."` 或 `"cf-browser-verification"` 的 HTML 直接判失败 + 换代理重试，而不是傻等
- GitHub Actions 里加 `runs-on: ubuntu-latest` 的 runner memory 监控：`free -h` 前后打印，OOM 时查看
- crawler 数据**分片** + **断点续抓**：当前的 4 阶段 queue 要支持"某批失败跳过不阻塞下一批"（`CONCERNS.md` 里说 `actor-crawler.ts` / `publisher-crawler.ts` 的"recovery 模式"是 stub，要实现）
- Puppeteer 版本固定，升级前在 staging 跑一晚（CONCERNS 里也提到 "puppeteer frequent breaking changes"）
- Fallback：`got-scraping` HTTP 客户端抓静态页（JavBus 列表页是 SSR，图片和详情才需要 JS）—— 能 HTTP 抓就别启 Chrome

**Warning signs:**
- 某次 workflow 抓到 `result_count: 0` 但 `runs: 1` —— 加告警
- GitHub Actions log 里出现 `Navigation timeout of X ms exceeded`
- 抓到的 HTML 含 "Checking your browser" / "challenge-platform" / "cf-chl-"
- Puppeteer log 出现 `Target.createTarget timed out` → CDP 崩溃（见 [issue #10144](https://github.com/puppeteer/puppeteer/issues/10144)）
- runner 用时突然从 5min 跳到 30min（通常是卡在 timeout）

**Phase to address:** **Phase 6 — crawler 稳定性**（可以放 v1 较后，因为不直接阻塞"日常使用"，但影响内容新鲜度）

---

### Pitfall 7: gateway KV 缓存泄漏已登录用户的私有响应给匿名访客

**What goes wrong:**
用户 A 登录后访问 `/api/users/me/favorites`，响应被 gateway cache 缓存；用户 B（或匿名）请求同一 URL，拿到 A 的收藏列表。严重数据泄漏。

**Why it happens:**
1. `apps/gateway/src/cache-middleware.ts` 的 cache key 如果只用 URL path + method，**不区分用户**
2. `CONCERNS.md` 里已经说 "Complex cache key generation; scope-based isolation" —— 复杂就容易漏
3. Hono/gateway 的 `Vary: Cookie` 头没加 → Cloudflare CDN 也会做跨用户缓存
4. 缓存失效只按 prefix delete，但登录状态切换时没主动清 `per-user` 缓存
5. gateway 在响应流里没检查 `Set-Cookie`/`Authorization` → 把带鉴权的响应当成可缓存

**How to avoid:**
- Gateway cache **强默认**：所有带 `Cookie` 或 `Authorization` 头的请求 **直接绕过缓存**（no lookup, no store）
- 除非 API 明确返回 `Cache-Control: public` —— 否则一律 `private, no-store`
- API handler 里区分"公共 vs 私有"路由：
  - 公共：`/api/public/*` → `Cache-Control: public, max-age=60`
  - 私有：`/api/users/me/*`、`/api/admin/*` → `Cache-Control: private, no-store, must-revalidate`
- Cache key 构造：如果要缓存登录用户的响应，必须把 `session.userId` 哈希进 key（或干脆不缓存 —— 单用户系统基本没收益）
- 加自动化 e2e：用两个 fetch client（A 有 cookie、B 没有）打同一 URL，断言响应不同
- 考虑把 gateway cache 的作用**缩小到静态资源 + `/api/public/*`**，其他一律透传 —— 单用户系统，cache 收益极低，风险极高

**Warning signs:**
- KV 里 cache 总容量意外膨胀（>10k 个 key）
- 用户报告"退出登录后还能看到之前的收藏"
- 看到 `/api/users/me/*` 的 cache hit 率 >0（应该为 0）
- A/B 测试两个 cookie 拿到完全相同的响应 body + 相同的 `X-Cache: HIT` 头

**Phase to address:** **Phase 1 一并处理**（和 auth 全链路打通同时审计 gateway cache）

---

### Pitfall 8: 同一域名下多 Nuxt/Vue 应用切换时，service worker / manifest / favicon 串台

**What goes wrong:**
用户在 `/movie` 首页给浏览器装了 PWA 图标，切到 `/dashboard` 时 Vue Router 工作正常但 service worker 还指向 movie-app 的 cache；登出后 SW 还在缓存旧的登录态 API 响应。或 `/dashboard` 的 `<link rel="manifest">` 被 `/movie` 覆盖。

**Why it happens:**
- 所有前端 app 都部署在 `starye.org` 同一 origin，service worker 的 scope 默认是注册路径
- Vue Router 在 SPA 导航时不重新装 SW，但浏览器把 SW 绑定在 origin 上 → 第一次访问哪个 app，哪个 SW 赢
- gateway 路径反代把 `/movie/sw.js` 和 `/dashboard/sw.js` 都代理到各自 origin，但 SW 在客户端是全 origin 生效
- `favicon.ico` 和 `/manifest.json` 请求路径是根路径，每个 app 都想占用

**How to avoid:**
- 决策：**v1 先不启用任何 PWA / service worker**（`PROJECT.md` 明说不做原生移动端，SW 不是必需）
- 每个 app 的 `vite.config` / `nuxt.config` 显式设置 `base: '/movie/'` 等，所有资源引用走子路径
- Gateway 保留根路径的 `/favicon.ico`、`/robots.txt`、`/manifest.json` 统一由 gateway 或 blog 提供
- 如果未来要 PWA，service worker 必须每个 app 独立 scope：`/movie/sw.js` scope `/movie/`，注册时显式写

**Warning signs:**
- DevTools → Application → Service Workers 里看到一个 SW 但控制多个路径
- 登出后 `/api/users/me` 返回 304 但实际会话已失效 → SW 缓存
- 切换 app 时 favicon 闪变

**Phase to address:** **Phase 5 — 部署基础盘**（审计 manifest/sw/favicon 一次性解决）

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `sql.raw()` 拼 LIKE（`CONCERNS.md` 已提） | 快速搞定搜索 | SQL 注入 + 索引失效 | **never** — Drizzle 的 `like()` 和参数化就够 |
| 同用户收藏用 localStorage 兜底 | 不登录也能收藏 | 换浏览器丢数据 + 和服务端不一致 | 只作为"未登录状态的临时记录"，登录后必须迁移入库 |
| gateway cache TTL 配长（如 1h） | 命中率高 | 登录态泄漏 + invalidation 困难 | 仅对 `/api/public/*` 静态内容 |
| Drizzle migration 直接 `DROP COLUMN` | 少写一个 PR | 生产数据丢失 | **never** — 必须走 add-new / backfill / drop-old 三步 |
| 爬虫 sync 用 serviceAuth 而不是 requireResource | 不改动现有代码 | 权限粒度粗，一旦 secret 泄漏全线崩 | 仅 v1 内部过渡，v1 结束前必须迁移（`CONCERNS.md` 已标 deprecated） |
| 1000+ 行的 Vue 单文件 / 路由 handler | 改动不要跨文件 | 回归高、无法单测 | 自用 v1 可容忍，但新增功能必须拆分不扩 |
| `console.log` 当日志 | 无需引入依赖 | Workers Observability 里信息碎片化 | 本地开发可，生产必须 logger |
| R2 credentials 放 env var | 配置简单 | 泄漏面大、难轮换 | v1 可接受，v1 后切 Workers Secrets + 轮换 |
| E2E test skip | CI 能过 | 播放/评分/系列页等核心功能不保护 | **never** — `PROJECT.md` 核心价值就是"不崩" |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cloudflare D1 | 循环里串行 `await db.insert()` | 用 `db.batch([...])` 单次请求；大数据拆 90 条/批 |
| Cloudflare D1 | 依赖 SQL `BEGIN/COMMIT` 做事务 | D1 不支持跨 statement 事务 — 用 `batch()` 的原子性或接受最终一致 |
| Cloudflare R2 (S3 API) | 通过 dashboard UI 改 CORS 规则 | **只能**通过 S3 API 或 wrangler r2 bucket cors put |
| Cloudflare R2 | 用 presigned URL 直接喂 `<video>` | presigned 过期即无法恢复 — 用公开域 + 防盗链，或客户端监听 error 续签 |
| Cloudflare KV | 用 `.list({prefix})` 再 delete 做 invalidation | 慢且按 key 数量计费 — 用 cache tag 或版本号（key 里带 `v=N`，改 N 即全失效） |
| Cloudflare Workers | 在 handler 外声明全局缓存对象 | Worker 实例会被回收，全局状态不保证 — 用 KV/D1 |
| Cloudflare Workers Free Plan | 一个请求发 >50 个外部 subrequest | Free 套餐限 50 外部 subrequest（[changelog](https://developers.cloudflare.com/changelog/2026-02-11-subrequests-limit/)） — 批处理或升级 paid |
| Better Auth | 依赖 `window.location.origin` 推算 baseURL 但 gateway 改了 host | 保留 Host header 透传，或在 auth config 显式写 baseURL |
| Better Auth | cookie domain 从 `WEB_URL` host 截断 | 显式配 `.starye.org`，并在 trusted origins 里列全子域 |
| GitHub OAuth | callback URL 用 `http://` 或多域名不一致 | prod 用单一 `https://starye.org/api/auth/callback/github`；local 单独注册一个 OAuth App |
| Puppeteer + GitHub Actions | 复用单个长时 Chrome 实例抓 1000 条 | 每 N 条重启 Chrome；住宅代理轮换 |
| Drizzle Kit | 本地改 schema 后 `drizzle-kit push --force` | `push --force` 会丢数据 — 生产只用 migrate，push 仅限本地探索 |
| Aria2 RPC | 前端直连用户的 Aria2 RPC（`CONCERNS.md` 已提 localStorage 存凭据） | 凭据服务端加密存、API 代理转发（现在 `aria2-proxy.service.ts` 已是这个模式，守住） |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| LIKE 查询非规范化字段（`movies.actors` 逗号字符串） | 列表接口 >2s，D1 rows_read 爆炸 | 用 `movieActors` 关系表 + 索引外键（`CONCERNS.md` 已记） | 单 actor 关联电影 >100 时 |
| R2 大文件一次性 `.arrayBuffer()` 进 Worker 内存 | Worker OOM / 128MB 内存上限报错 | 流式 `response.body.pipeTo(...)`，或让客户端直连 R2 | 上传/下载 >50MB 时 |
| KV 单 value >25MB | 写入失败 | 分片存储 / 改用 R2 | 缓存大列表响应时（`CONCERNS.md` 已记） |
| D1 单次请求写入 >1000 行 | P99 延迟飙升 | batch 分块 + 限 sync 频率 | 爬虫一次性 sync 大批新增时 |
| 视频 Range 请求全量回源 R2（无 CDN cache） | R2 egress 账单增长 + 拖动卡顿 | Workers 自定义域 + `Cache-Control: public, max-age=86400` | 单视频 >100 次播放后差异明显 |
| Puppeteer 每次 launch 装 Chrome | GitHub Actions minutes 被吃光 | cache Chrome 安装到 `~/.cache/puppeteer`（`actions/cache`） | 每天 3 次 × 4 个 crawler workflow |
| Nuxt/Vue 单组件 1000+ 行导致 bundle 巨大 | 首屏 >3s，LCP 差 | Code split + 路由懒加载 | 任何慢网络用户 |
| 所有中间件串行（auth → db → cache → audit） | P50 +30ms/请求 | 能并行的不要串行（如 DB 和 audit 不依赖同一结果） | API QPS 涨到自用高峰时 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `/api/auth/sign-in` 没速率限制 | 暴力破解 + GitHub token 滥用 | Cloudflare WAF Rate Limiting：10 req/min/IP |
| Admin 路由依赖 `serviceAuth` 但该中间件已 deprecated（`CONCERNS.md`） | 权限检查不一致 | 迁移到 `requireAuth + requireResource` |
| CRAWLER_SECRET 长期不轮换 | 一次 GitHub Actions log 泄漏即全线失守 | 每月轮换（GitHub secret 改名 + API 双接收窗口 24h） |
| 成人内容（`isAdult` / `isR18Verified`）仅前端判断 | 直接调 API 绕过 | 必须在 API 中间件里做 `guard` 检查 |
| OpenAPI docs / Scalar UI 公开可访问 | 暴露所有路由签名 | Prod 环境加 `requireAuth` 守卫或关闭 |
| R2 bucket 公开读 + 目录可列（ListObjects） | 全量内容被拖走 | bucket policy 禁 list、只允许 GetObject |
| Blog `v-html` 无 sanitization（`CONCERNS.md`） | XSS（尽管单用户、自己写的 Markdown） | DOMPurify + CSP；单用户也要防将来接外部输入 |
| 视频/图片 URL 通过 GET 参数带 session token | token 进日志、进 Referer 被泄漏 | 用 POST body 或短期签名路径 `/s/{hash}` |
| gateway 把 `Cookie` 头转发给所有上游 | auth cookie 可能被第三方 origin（如 tavern）误读 | 只转发给"同 auth 域"的上游；其余剥离 |
| robots.txt 没写 `/api` | search engine 索引 admin URL 结构 | gateway 统一给出 robots.txt |
| localStorage 存 Aria2/TorrServer 凭据（`CONCERNS.md`） | XSS 一旦发生凭据全泄 | 服务端加密存（现有代码已在 DB 加密，但前端仍有明文 composable） |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 播放失败无提示、只黑屏 | 以为"内容不存在"、反复点击 | 捕获 `<video>` 的 `error` 事件显示可读错误 + "重试"/"切源" |
| 登录后跳回首页而不是跳回来源页 | 每次登录都要重新导航回去 | 登录前把 `location.href` 存到 `return_to` query，登录后跳回 |
| 阅读进度仅本地存储 | 换设备从第一话读起 | 登录用户进度存 D1（`PROJECT.md` Active 项） |
| D1 跨区域写入导致"刚收藏刷新看不到"（最终一致） | 用户误以为按钮坏了 | 收藏接口返回后，前端乐观更新本地状态；或显式 `?fresh=1` 跳 cache |
| Dashboard 权限失败跳登录页而不是 403 页 | 已登录用户困惑"为什么又要登录" | 区分"未登录 → 401 → 跳登录" vs "已登录无权限 → 403 → 显示无权限页" |
| 爬虫失败无可见性 | 用户不知道新电影没入库 | dashboard 显示最近 crawl 状态卡片 |

## "Looks Done But Isn't" Checklist

- [ ] **Auth 打通**：dashboard、movie、comic、blog 四处登录后刷新页面都不掉线 — 验证：打开 4 个 tab，刷 `/api/auth/get-session` 都返回 user
- [ ] **播放稳定**：不同大小（10MB / 500MB / 2GB）视频拖动 3 次不出错 — 验证：Chrome + Safari + 手机浏览器各跑一遍
- [ ] **R2 CORS 生效**：`curl -I -H "Origin: https://starye.org" https://cdn.starye.org/xxx.mp4` 返回 `Access-Control-Allow-Origin`
- [ ] **robots.txt 生效**：`curl https://starye.org/robots.txt` 返回且含 `Disallow: /dashboard`
- [ ] **dashboard 鉴权**：未登录直接访问 `https://starye.org/dashboard` **不渲染任何内容**（不是渲染壳之后再跳），SSR/SSG 也要挡
- [ ] **API 限流**：`ab -n 100 /api/auth/sign-in` 第 11 次开始返回 429
- [ ] **Migration 可回滚**：把生产 DB 导出备份 → 跑下一版 migration → 能从备份恢复
- [ ] **Cache 隔离**：两个 cookie 访问 `/api/users/me/*` 拿到不同响应，且 `X-Cache: MISS`
- [ ] **Crawler 恢复**：故意让一批失败 → 下一次 run 能挑出失败的继续（当前 `actor-crawler.ts` 是 stub）
- [ ] **健康检查链路**：`/api/health` 能看到 D1/R2/KV 三个依赖的状态（现在只是存在，没详查）
- [ ] **错误可见性**：线上制造一次 500 → 15 分钟内能在 Workers Observability 里定位到请求 ID 和堆栈
- [ ] **一键回滚**：任一 app 部署失败 → 能 `wrangler rollback` 到上个版本（workers 支持，Pages 的 deployment history 也支持）

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cookie domain 配错，登录全员失效 | LOW | 改 `WEB_URL` + 重新部署 API Worker（1 分钟）；用户清一次 cookie 即可 |
| R2 视频 CORS 漏配 | LOW | `wrangler r2 bucket cors put` 下发新规则，5 分钟全球生效 |
| D1 prepared statement 爆 Worker | MEDIUM | 把爆点 handler 降级为 `db.batch()`；回退到上个 Worker 版本 |
| Drizzle migration `DROP COLUMN` 误删数据 | **HIGH** | 从 D1 Time Travel 恢复（30 天窗口）或从 R2 备份 import；期间 API 停服 |
| dashboard 被索引 | MEDIUM | 加 robots.txt + `X-Robots-Tag` + Google Search Console 申请下架；URL 改版重发（旧链接永久跳 403） |
| Crawler IP 被封 | MEDIUM | 切换代理池 IP；降低 crawl 频率到每天 1 次；用 HTTP fallback 补齐关键数据 |
| gateway cache 泄漏用户数据 | MEDIUM | 立刻 `wrangler kv key delete` 清光 namespace；gateway 回退到"无缓存"版本；审计日志评估影响 |
| CRAWLER_SECRET 泄漏 | LOW | 生成新 secret → Worker secret put + GitHub secret 改 → 下次 crawl 生效 |

## Pitfall-to-Phase Mapping

基于 `PROJECT.md` 的 Active 列表，建议按以下顺序 + 每阶段明确防护的坑：

| Phase 建议 | 覆盖的 Active 需求 | 主要针对的坑 | Verification |
|------------|---------------------|-----------|--------------|
| **P1. Auth 全链路 + gateway cache 安全基线** | 认证全链路打通 | #1 Cookie domain、#7 Gateway cache 泄漏 | 4 个 app 登录后 session 互通；两个 cookie 打私有 API 响应不同 |
| **P2. dashboard 访问控制 + 前台登录门控 + 安全基线** | dashboard 访问控制、前台登录门控 | #5 搜索引擎索引 / 无限流 | 未登录进 `/dashboard` 直接挡；`/api/auth/sign-in` 有限流；robots.txt 生效 |
| **P3. movie-app 播放稳定化** | movie-app 播放稳定性 | #2 R2 Range/CORS | 三种尺寸视频 + 三种浏览器拖动稳定；R2 CORS 配置可用 curl 验证 |
| **P4. comic 阅读进度 + 写入模型加固** | comic-app 阅读进度 | #3 D1 prepared statement 批处理、写入事务 | 批量进度同步 <200ms；一次 batch 包含多写 |
| **P5. 部署基础盘：migration 安全 + 可观测性 + SW/manifest 收口** | 部署基础盘、基础可观测 | #4 Drizzle migration 回滚、#8 SW/manifest 串台 | Migration 前自动备份；`/api/health` 反映三依赖；一键回滚演练过一次 |
| **P6. Crawler 稳定性 + 数据新鲜度** | （不在 Active，但支撑"可用"） | #6 Puppeteer 反爬 + OOM | 连续 7 天 crawl 成功率 >95%；失败能自动续抓 |

**排序理由：**
- P1 是基石：其他所有需要登录的功能都依赖它
- P2 紧跟 P1，因为"公开暴露 + 无访问控制"是当前最大的面子/安全风险
- P3 是用户每天高频触发的路径，最直接影响"能用"的体感
- P4 业务写入模型统一，避免后续到处重写
- P5 部署/迁移/可观测是"不崩"的兜底，放在业务功能稳定后再做
- P6 爬虫是内容供给，短期不抓数据也不影响已有内容可看；权衡下放最后

## Sources

**Cloudflare D1:**
- [D1 Platform Limits](https://developers.cloudflare.com/d1/platform/limits/) — HIGH 置信度（WebFetch 被网络拦截，WebSearch 摘要确认：100KB SQL 上限、batch 是串行、无跨 statement 事务）
- [D1 Worker Binding API](https://developers.cloudflare.com/d1/worker-api/)
- [Cloudflare D1 Reference Sheet](https://tigerabrodi.blog/cloudflare-d1-reference-sheet) — MEDIUM（社区整理）
- [Journey to Optimize Cloudflare D1 Database Queries](https://rxliuli.com/blog/journey-to-optimize-cloudflare-d1-database-queries/) — MEDIUM（实战经验）

**Cloudflare Workers:**
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers are no longer limited to 1000 subrequests (2026-02)](https://developers.cloudflare.com/changelog/2026-02-11-subrequests-limit/) — HIGH
- [Run Workers for up to 5 minutes of CPU-time (2025-03)](https://developers.cloudflare.com/changelog/2025-03-25-higher-cpu-limits/) — HIGH

**Cloudflare R2:**
- [R2 CORS Configuration](https://developers.cloudflare.com/r2/buckets/cors/) — HIGH
- [R2 CORS 社区讨论：UI 不支持改 CORS](https://community.cloudflare.com/t/cors-issue-with-r2-presigned-url/428567) — MEDIUM

**Better Auth:**
- [Better Auth Cookies 文档](https://www.better-auth.com/docs/concepts/cookies) — HIGH（WebFetch 拦截，但结合代码 `apps/api/src/lib/auth.ts:98-106` 和 stackoverflow 讨论交叉验证）
- [GH Issue #4038: Cross-Domain cookies not being set](https://github.com/better-auth/better-auth/issues/4038) — HIGH（官方 repo issue）

**Drizzle + D1:**
- [GH Discussion #1339: Migrations Rollback](https://github.com/drizzle-team/drizzle-orm/discussions/1339) — HIGH（官方 repo discussion）
- [GH Issue #2352: Migration Rollback feature](https://github.com/drizzle-team/drizzle-orm/issues/2352) — HIGH
- [Anyway to migrate down in Drizzle (SO)](https://stackoverflow.com/questions/78745661/anyway-to-migrate-down-in-drizzle) — MEDIUM
- [d1-migration skill 笔记](https://explainx.ai/skills/jezweb/claude-skills/d1-migration) — LOW（三方整理，但所述"destructive migrations for simple changes"和官方 issue 吻合）

**Puppeteer + GitHub Actions:**
- [Navigation timeout 30000ms (issue #8829)](https://github.com/puppeteer/puppeteer/issues/8829) — HIGH
- [Target.createTarget timed out (issue #10144)](https://github.com/puppeteer/puppeteer/issues/10144) — HIGH
- [chrome-linux64 blocked on remote server (issue #11060)](https://github.com/puppeteer/puppeteer/issues/11060) — HIGH

**Security / Hotlinking:**
- [R2 Hotlink Protection 社区讨论](https://community.cloudflare.com/t/implementing-hotlink-protection-for-r2-media-files-on-a-wordpress-site/593531) — MEDIUM
- [S3 bucket policy hotlink prevention (gist)](https://gist.github.com/kiranvj/17b3264b2d53e83d7c5cd024ccd1a134) — MEDIUM（S3 适用，R2 S3-compatible）

**Codebase evidence (本仓):**
- `.planning/codebase/CONCERNS.md` — 已验证 SQL injection、deprecated serviceAuth、大组件、缓存复杂度、LIKE 查询、localStorage 凭据、migration 测试缺失等
- `.planning/codebase/INTEGRATIONS.md` — cookie domain 逻辑、allowed origins、`baseURL = window.location.origin + '/api/auth'` 架构
- `.planning/codebase/ARCHITECTURE.md` — D1 不支持 cross-statement 事务、cookie scope、CORS whitelist 要求

---
*Pitfalls research for: 个人内容中台 v1 on Cloudflare edge*
*Researched: 2026-05-10*
