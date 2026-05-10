# Project Research Summary

**Project:** Starye — 个人内容中台
**Domain:** Brownfield Turborepo on Cloudflare edge（Workers + Pages + D1 + R2 + KV），单用户自托管内容平台
**Researched:** 2026-05-11
**Confidence:** HIGH（研究全程以 `.planning/codebase/` 证据 + 官方文档交叉验证；gateway 统一入口架构是已存在的既定事实，研究聚焦缺口而非重新设计）

## Executive Summary

Starye 的 v1 不是从零起步的"内容中台"立项，而是一个已经跑起来的 brownfield 系统在做"可日常使用"的收口。技术栈已锁定（Turborepo / Cloudflare Workers+Pages / Hono / Vue 3+Nuxt 4 / D1+R2+KV / Drizzle / Better Auth），gateway-as-sole-entry + apex-domain cookie 的架构也已就位——研究的任务是（1）对 7 项 Active 需求填清缺口方案；（2）识别把这件事搞砸的几种方式；（3）给 roadmapper 拆 phase 的依赖排序。行业同类参考（Jellyfin、Plex、Komga、Kavita）在"服务端记真值 + 客户端上报事件"的进度模型上高度收敛，这和项目现有 D1 + Drizzle 流水线天然同构，没有新范式要引入。

**推荐主线：先把 session 这一条主动脉打通（Auth 全链路 + gateway cache 按用户隔离），然后闭合访问控制面（dashboard 门控 + 前台登录门控 + robots/限流），再分两路并行补"能用"的体感——R2 自定义域直发视频（停止 Worker 代理）、D1 + Drizzle 的 progress 表承接漫画/视频进度，最后用 Sentry + wrangler rollback 收口部署与可观测。** 关键反模式是"把视频流从 Worker 代理"（吃掉 Range 语义，Safari/Android 播放崩）和"把进度写 KV"（1 write/sec/key 限制 + 60s 最终一致让翻页进度回退）。

**最大三个风险**：（1）Better Auth cookie domain 与 gateway host 透传错位 → 登录看似成功但 session 全线丢，阻塞所有下游功能；（2）R2 CORS 未配 `Range`/`Content-Range` → 视频拖进度条黑屏；（3）Drizzle `DROP COLUMN` 式迁移在 D1 上无原生回滚 → 一次误操作即永久丢数据。前两个在 v1 必须正面解决；第三个用"迁移前 `wrangler d1 export` 备份 + 列重命名三步发布（add-new / backfill / drop-old）"规避。

## Key Findings

### Recommended Stack

研究仅针对 5 个 v1 缺口，不动底座。核心判断：**不引入新范式，顺着现有 Drizzle + Workers + wrangler 流水线增量收口**。细节见 `.planning/research/STACK.md`。

**Core additions（唯一新依赖，都是 patch/minor 级）：**
- `@sentry/cloudflare` `^10.52.0`（api、gateway）/ `@sentry/vue` / `@sentry/nuxt` — 错误聚合 + source map，free tier 5K/月够单用户用；替代已 deprecated 的 `@hono/sentry`
- `better-auth` `1.6.2 → ^1.6.10` — minor 升级对齐最新稳定版，无 breaking change
- `wrangler` `4.81.1 → ^4.90.0` — patch 级升级，获得稳定的 `wrangler rollback` 体验

**Core architectural choices（明确锁定的缺口方案）：**
- **视频**：R2 绑自定义域 `cdn.starye.org` + Cloudflare CDN 直发 MP4，浏览器原生 Range。**不**做 HLS 转码、**不**上 Cloudflare Stream、**不**在 Worker 里代理视频字节
- **漫画进度**：D1 统一 `progress` 表（覆盖 movie+comic）+ Drizzle，复合主键 `(userId, contentType, contentId)`，10s 或事件触发 debounce 写入。**不**用 KV（最终一致性 + 写额度硬伤）、**不**用 Durable Objects（过度架构）
- **会话**：维持 gateway 单源反代 + cookie domain = `.starye.org`，**不**引入 `crossSubDomainCookies` 插件
- **可观测**：Sentry 做错误聚合 + Cloudflare Workers Logs 做 debug 日志，二者互补
- **部署**：现有 per-app GitHub Actions workflow + `wrangler rollback`（Workers） + Cloudflare Pages dashboard rollback（Pages）。新增 `rollback.yml` workflow_dispatch 手动触发

### Expected Features

Komga / Kavita / Jellyfin 的模式在单用户场景仍然适用：服务端记真值、客户端事件上报、打开即恢复。原始调研详见 `.planning/research/FEATURES.md`。

**Must have（table stakes，v1 必做）：**
- 播放稳定性：`<video>` error handler + 自动恢复 + 用户可见错误态 + "重试"按钮（不再黑屏）
- 播放进度：每 10s + on pause/seek/pagehide 写入；"继续观看"列表
- 漫画阅读进度：per-chapter page + completed 标志 + 打开章节跳到上次位置 + debounce 500ms 写入
- Dashboard 强制登录 + 作者 GitHub ID 白名单（`ADMIN_GITHUB_ID` env 即可，**不**建 roles 表）
- 登录门控：匿名可浏览目录，但收藏/进度/成人内容必须登录；**服务端过滤**，不是 UI 隐藏
- 统一 session：所有前端 `useSession()` 打同一个 `/api/auth/session`，Nuxt SSR 通过 `useRequestHeaders(['cookie'])` 透传
- 部署基线：per-app deploy workflow + `wrangler rollback` runbook + CI 跑 `drizzle-kit migrate`
- 可观测骨架：Sentry 前后端双接入 + `beforeSend` 过滤噪音

**Should have（deferred 到 v1.x，不阻塞发布）：**
- "继续观看/阅读"横幅 UI（数据已在，UI 打磨）
- 成人内容 PIN 门控（登录之外的额外摩擦）
- 阅读方向/Fit 按系列持久化
- 跨 blog+漫画+视频全文搜索

**Explicitly NOT building（anti-features，避免诱惑）：**
- 多用户 / profile / 家庭共享 / 邀请 / guest
- 评论 / 点赞 / 社交 / watch parties / SyncPlay
- 完整 RBAC 权限矩阵
- 服务端转码 / HLS 按需切片
- SEO / sitemap / OG 卡片（反而要 `noindex`）
- 公开 API / 第三方集成
- 邮箱验证 / 密码重置 / 2FA UI（GitHub OAuth 一把通吃）
- 自建 APM / Prometheus / Grafana / Plausible（违反预算约束）

### Architecture Approach

当前系统已经实现了正确的拓扑：gateway Worker 是唯一入口，按路径分发给 api（Hono on Workers） + 各 Pages 前端；D1 存结构化状态、R2 存二进制、KV 做边缘缓存；crawler 走 GitHub Actions + 共享 secret 回写 API。研究没有提出重写，只点出 5 处需要收口的地方。详见 `.planning/research/ARCHITECTURE.md`。

**Major components（责任边界 + 本次要增强的点）：**
1. **Gateway Worker** — URL 路由、KV cache、cache invalidation hook。**Harden**：用 `userId`（而非 cookie hash）做 private-scope cache key；新增 `POST /__cache/invalidate` 供 API 和 crawler 写后主动清
2. **API Worker (Hono)** — Auth、CRUD、progress upsert、R2 presign。**New**：`routes/progress/`（movie+comic 共用）、`routes/stream/sign.handler.ts`（R18 门控视频的签名 URL）、`middleware/cache-invalidate.ts`（2xx CUD 后自动 purge）
3. **Frontend Pages** — Vue/Nuxt SPA/SSR。**New**：`useAuth()` / `usePlaybackProgress()` / `useReadingProgress()` composables；所有 `*.pages.dev` 加 `_redirects` 301 回 `starye.org/<app>/`
4. **D1 / Drizzle** — 结构化状态。**New**：`progress` 表（复合主键）+ `(userId, updatedAt)` 索引。强制批写用 `db.batch()`，**不**依赖 `BEGIN/COMMIT` 跨语句事务（D1 不支持）
5. **R2** — 媒体字节，通过 `cdn.starye.org` 直发。**Harden**：CORS 加 `Range`/`Content-Range`/`Accept-Ranges`；大文件加 `Cache-Control: public, max-age=86400`
6. **Crawler (GitHub Actions + Puppeteer)** — 定时爬取 + POST 回 API。**Harden**：住宅代理 + 检测 Cloudflare challenge + 断点续抓 + HTTP fallback（`got-scraping`）能 HTTP 抓就别启 Chrome

### Critical Pitfalls

选自 `.planning/research/PITFALLS.md` 的 Top 5，按对"能用不崩"的阻塞力排序：

1. **Better Auth cookie domain 与 gateway host 透传错位** — 登录 200 但 `/api/auth/get-session` 返回 `{user: null}`。**预防**：cookie domain 显式写 `.starye.org`；gateway 必须保留原 Host 头透传；`trustedOrigins` 同时列 `starye.org` 和 `www.starye.org`；OAuth callback 走 top-level GET redirect 而非 XHR。**处理 Phase：P1**。
2. **R2 视频 Range 请求在跨域 `<video>` 下不工作** — 前 30s 能播、拖进度条黑屏，Safari/Android 尤敏感。**预防**：R2 CORS（只能通过 S3 API 或 `wrangler r2 bucket cors put`，dashboard UI 改不了）加 `Range`/`If-Range` 到 `AllowedHeaders`、`Content-Range`/`Content-Length`/`Accept-Ranges` 到 `ExposeHeaders`；**不**把 presigned URL 直接塞 `<video src>`（过期后无法恢复播放位置），改用公开域 + 防盗链，或客户端监听 error 自动续签。**处理 Phase：P3**。
3. **Gateway KV cache 把已登录用户私有响应泄漏给匿名访客** — 用户 A 的收藏列表被 B 拿到。**预防**：带 `Cookie` 或 `Authorization` 的请求**默认绕过缓存**；cache key 用 `userId` 哈希而非 cookie 全串；考虑把 cache 作用域缩小到 `/api/public/*` 和静态资源（单用户系统收益低、风险高）。**处理 Phase：P1（与 Auth 一并审计）**。
4. **Drizzle + D1 迁移无原生回滚，`DROP COLUMN` 即永久丢数据** — Drizzle Kit 不生成 down migration。**预防**：列重命名走三步（add new / backfill / 下一版 drop old）；生产 migration 前 `wrangler d1 export --remote` 备份到 R2；CI 里 `git diff packages/db/drizzle/` 看到 `DROP COLUMN` 必须人工 ack；只用 `migrations apply`、**不**用 `drizzle-kit push --force` 对生产。**处理 Phase：P5**。
5. **Dashboard / OpenAPI docs 被搜索引擎索引 + `/api/auth/*` 无速率限制** — `site:starye.org` 暴露后台 URL 结构 + 撞库。**预防**：gateway 统一给 `/robots.txt`（disallow `/dashboard /auth /api`）；dashboard/auth HTML 加 `<meta name="robots" content="noindex">`；gateway 对 `/dashboard/*`、`/api/admin/*` 加 `X-Robots-Tag: noindex, nofollow`；Cloudflare WAF Rate Limiting 规则 `/api/auth/sign-in` 10 req/min/IP；prod 关闭或鉴权保护 Scalar/OpenAPI UI。**处理 Phase：P2**。

**次级但不可忽略**：
- D1 循环里 `await db.insert()` = N 次网络往返，必须 `db.batch([...])` 并按 90 条/批分块（SQLite 999 绑定参数上限）
- Puppeteer 在 GitHub Actions 固定 IP 段易被反爬封，必须住宅代理轮换 + 检测 Cloudflare challenge 页主动换 IP
- 同域多 Nuxt/Vue 应用下 service worker / manifest / favicon 串台——**v1 明确不启用 PWA / SW**，一劳永逸

## Implications for Roadmap

三份研究文档对 phase 顺序有高度共识（Auth → 访问控制 → 播放/进度 → 部署基线 → 爬虫）。下列 phase 是 roadmapper 的起点，不是定稿。

### Phase 1: Auth 全链路打通 + Gateway cache 安全基线

**Rationale:** Session 是其他一切的主动脉——门控、进度、收藏、成人内容过滤都要可靠识别用户。与此同时 gateway cache 当前用 cookie hash 做 private key，对"登出登入换 session" 语义错，也有跨用户泄漏风险，两件事的审计面重合，一起做不拆。
**Delivers:** dashboard/movie/comic/blog/auth 五端登录后 session 互通不掉线；Nuxt SSR 能读 session；gateway cache 对带 `Cookie`/`Authorization` 的请求默认绕过，private scope 改用 `userId` 做 key；`/api/auth/*` 全部跳过缓存。
**Addresses:** Active 项"认证全链路打通"
**Uses:** 现有 Better Auth（升 1.6.10）+ 已有 gateway cache-middleware 重构
**Avoids:** Pitfall #1 Cookie domain 错位、Pitfall #7 Cache 泄漏

### Phase 2: Dashboard 访问控制 + 前台登录门控 + 安全基线

**Rationale:** Auth 打通后第一件要做的是闭合暴露面。当前 dashboard 不登录能进、`/api/auth/sign-in` 无限流、OpenAPI 公开——单独每项都是小事，合起来是 v1 最大的运营风险。这一阶段把"谁能看到什么"一次讲清楚。
**Delivers:** `/dashboard/*` SSR/SSG 均强制登录 + `ADMIN_GITHUB_ID` 白名单；API 侧 `requireAuth(['admin'])` 守住 `/api/admin/*`；登录重定向带 `next=<origin>`；gateway 统一 `/robots.txt` + `X-Robots-Tag: noindex`；Cloudflare WAF Rate Limiting 对 auth 端点和 admin 端点生效；成人内容 `is_adult` 字段 + 服务端查询过滤（非 UI 隐藏）；Scalar docs 加鉴权。
**Addresses:** Active 项"dashboard 访问控制"、"前台登录门控"
**Uses:** 现有 Better Auth session + 现有 audit-logger + Cloudflare WAF（免费 tier）
**Avoids:** Pitfall #5 搜索引擎索引 + 无限流

### Phase 3: movie-app 播放稳定化（R2 直发 + 错误恢复）

**Rationale:** 这是用户每天高频触发的路径，也是 "CONCERNS.md 已指出偶尔出错" 的核心痛点。研究三方共识：**停止通过 Worker 代理视频字节**，改 R2 custom domain + Cloudflare CDN 直发 MP4，原生 Range + 边缘缓存。与 Phase 4 正交，可并行。
**Delivers:** `cdn.starye.org` 绑定 R2 bucket；CORS 正确配置（`Range`/`Content-Range` 暴露）；`<video>` 捕获 `error` 事件、自动 `recoverMediaError()` + swap codec + 兜底 reload；用户可见错误态 + "重试"按钮；`GET /api/stream/sign?key=...` 仅对 R18 内容签发短 URL，前端监听过期自动续签；大文件 `Cache-Control: public, max-age=86400`。Resume-position UX 放 Phase 4 一起。
**Addresses:** Active 项"movie-app 播放页稳定性"
**Uses:** 现有 xgplayer ^3.0.24 + `@aws-sdk/s3-request-presigner`（已装）
**Avoids:** Pitfall #2 R2 Range/CORS、Anti-Pattern "Worker 代理视频"

### Phase 4: 统一 Progress 表 + comic 阅读 / movie 观看进度

**Rationale:** 漫画进度和视频 resume 用同一张 `progress` 表（`{userId, contentType, contentId, position, duration, updatedAt}` 复合主键）—— 一次建好模型，两处消费。Komga/Kavita/Jellyfin 的模式直接映射。依赖 Phase 1 的 userId，与 Phase 3 正交可并行。
**Delivers:** Drizzle schema `progress` 表 + `(userId, updatedAt)` 索引；`PUT /api/progress/:contentType/:id` 用 `ON CONFLICT DO UPDATE`；漫画端 page-turn debounce 500ms + `pagehide` flush；视频端每 10s + `pause`/`seek`/`pagehide` 触发；批写统一用 `db.batch([...])`；"继续阅读 / 继续观看"首页列表（UI 精修可延到 v1.x）。
**Addresses:** Active 项"comic-app 阅读进度"；同时给 Phase 3 补上"视频 resume"体感
**Uses:** 现有 Drizzle + D1
**Avoids:** Pitfall #3 D1 prepared statement 爆 Worker、Anti-Pattern "进度写 KV"

### Phase 5: 部署基础盘 + 可观测骨架 + Migration 安全

**Rationale:** 业务功能稳了之后再收口"不崩"的兜底能力。研究给出的组合拳：wrangler rollback runbook + 一键 `rollback.yml` workflow + migration 前自动备份 + Sentry 接入前后端 + noise filter。此时做，Sentry 正好接上 Phase 3/4 的新代码路径，source map 和错误聚合立即有价值。
**Delivers:** 新增 `rollback.yml`（workflow_dispatch，接受 app + version_id）；`deploy-migrations.yml` 加 `wrangler d1 export --remote` 前置备份到 R2；`@sentry/cloudflare` 接入 api、gateway（用 `honoIntegration()`，**不**用 deprecated `@hono/sentry`）；前端接入 `@sentry/vue`/`@sentry/nuxt`；`beforeSend` 过滤用户中止/离线/hls.js 已恢复错误；RUNBOOK.md 文档化 Pages/Workers 的分级回滚路径；SW/manifest/favicon 在 gateway 统一收口（v1 关闭 PWA）；`[env.staging]` 可选（研究列了但非 v1 必需）。
**Addresses:** Active 项"部署基础盘"、"基础可观测"
**Uses:** wrangler `^4.90.0` + `@sentry/cloudflare` `^10.52.0` + 现有 GitHub Actions
**Avoids:** Pitfall #4 Drizzle 迁移、Pitfall #8 SW/manifest 串台

### Phase 6 (post-v1 或 v1 尾部): Crawler 稳定性 + 数据新鲜度

**Rationale:** 不直接阻塞"日常使用"——现有内容库短期不新抓也能看。但 `CONCERNS.md` 指出 `actor-crawler.ts`/`publisher-crawler.ts` 的 recovery 模式是 stub，GitHub Actions IP 段被反爬识别是概率问题。放到 v1 稳住后再正面处理。
**Delivers:** 住宅代理接入 `PROXY_SERVER`（已有 env 坑位）；Puppeteer challenge 页检测（含 "Just a moment..."/"cf-browser-verification" 即换代理重试）；断点续抓 + 幂等键 `ON CONFLICT DO UPDATE`；HTTP-only fallback 用 `got-scraping`；超时拆 `domcontentloaded` + 关键 selector；Sentry 接入 + 失败告警。
**Addresses:** 不在 Active 但支撑"长期可用"
**Uses:** 现有 Puppeteer + crawler 模块 + 新加代理
**Avoids:** Pitfall #6 Puppeteer 被反爬

### Phase Ordering Rationale

- **依赖链**：Session（P1）→ 门控（P2）→ 基于身份的写入（P4 progress）。P3 和 P4 在 P1 后可并行。P5 收尾。P6 可离线推进。
- **风险优先**：P1 和 P2 覆盖 Critical Pitfalls #1、#5、#7 三个最阻塞的坑；P3 覆盖 #2；P5 覆盖 #4、#8；把最易爆的先爆掉。
- **反直觉决策**：研究没把 "部署/可观测" 放 Phase 1（FEATURES.md 有过这个建议），原因是本项目是 brownfield——部署流已在跑、Sentry 接入是增量改动、放 P5 不会让 P1-P4 的调试体验显著变差；而如果 P1 的 cookie/cache 都没稳，光有 Sentry 看到的只是海量噪音。
- **v1 范围克制**：差异化功能（继续观看横幅、全文搜索、成人 PIN、自动续集）**全部延后**到 v1.x——PROJECT.md 的 Core Value 是"能用、不崩"，不是"功能全"。

### Research Flags

**需要 `/gsd-research-phase` 深入调研的 phase：**

- **Phase 1**：Better Auth 1.6.2 → 1.6.10 的具体 changelog + `trustedOrigins` 配置与 gateway host 透传的边界 case；gateway cache-middleware 现有代码里 `/api/auth/*` 是否已跳过缓存（STACK.md 已标为实施前必核）。
- **Phase 3**：`xgplayer` 的 `error` 事件结构 + 自动恢复最佳实践；R2 CORS 规则的 `wrangler r2 bucket cors put` 语法；R2 custom domain 与 Cloudflare zone-level Cache Rules 的交互（需要开 `cacheEverything: true` 且 `cacheTtlByStatus.200-299`）。

**标准模式，跳过深入研究：**

- **Phase 2**：强制登录中间件 + 白名单 env 检查 + robots.txt 是常规 pattern，按 ARCHITECTURE.md 落地即可。
- **Phase 4**：Drizzle upsert + 复合主键是项目内熟悉操作（favorites 有先例可 mirror）。
- **Phase 5**：Sentry Cloudflare + wrangler rollback 都是官方一方集成，有明确 CLI/SDK，不需要额外研究。

**Phase 6** 单独调研时机：v1 稳定后遇到第一次 crawler 连续失败时再拉起。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 只做增量：Sentry/better-auth/wrangler 升级都是官方 npm 元数据验证过的最新稳定版；反模式（Cloudflare Stream、HLS 转码、Worker proxy video、KV progress）都有明确一手佐证 |
| Features | HIGH | Komga/Kavita/Jellyfin 的进度/gating 模式都有官方 OpenAPI/wiki；anti-feature 清单直接锚定 PROJECT.md 的 Out of Scope |
| Architecture | HIGH | 现有 gateway-as-sole-entry + 单源 cookie + D1/R2/KV 是 Cloudflare 官方推荐 pattern；refinement（userId 做 cache key、cache-invalidate middleware、_redirects 挡 pages.dev）基于既有代码读取 + Context7 官方文档 |
| Pitfalls | HIGH | 8 个 critical 坑每个都有 GH issue 或官方 docs 佐证 + `CONCERNS.md` 的代码级证据；Recovery cost 评估基于 Cloudflare 原生能力（Time Travel 30 天、`wrangler rollback` 秒级） |

**Overall confidence:** HIGH

### Gaps to Address

- **视频"偶尔出错"的精确根因**：PITFALLS 和 STACK 都锁定到 R2 CORS/Range 最可能，但 `CONCERNS.md` 没给出具体错误码。**处理**：Phase 5 Sentry 上线后第一周专门看 `<video>` error 事件，必要时回到 Phase 3 追加修复。
- **Gateway cache-middleware 当前行为**：是否已跳过 `/api/auth/*`、是否已对 `set-cookie` 响应 bypass、private scope 如何构造 key——研究给了正确目标状态，但 Phase 1 开工前必须先读 `apps/gateway/src/cache-middleware.ts` 现状，避免"以为已经做了、其实没做"。
- **成人内容标注 ingest-time vs 手动**：FEATURES.md 指出 crawler 当前不填 `is_adult`，Phase 2 的"服务端过滤"依赖这个字段有值。决策点：(a) crawler 按源站标签自动打、(b) dashboard 上线手动补 UI。建议 requirements 阶段定。
- **视频进度粒度（秒 float vs tick int）**：小事但会固化 API 形状，Phase 4 开工前定下来。倾向与 Jellyfin 一致用 int seconds。
- **Drizzle 三步发布流程的执行纪律**：研究给了方法论，但没有工具强制。Phase 5 加 CI 检查：PR diff 出现 `DROP COLUMN` 时需要 reviewer 显式 ack 才能 merge——用 GitHub Actions + `grep` 实现即可。
- **Sentry free tier 5K 事件/月用量**：首周接入前端时 noise 可能偏高，Phase 5 上线后第 7 天 review 用量曲线，必要时补 `beforeSend` 过滤规则。

## Sources

### Primary (HIGH confidence)

**Cloudflare 官方文档：**

- Workers Environments / `wrangler.toml` env.* syntax
- Workers `rollback` 命令 + Pages rollback API
- D1 Platform Limits（100KB SQL、batch 原子性、无跨语句事务）
- KV write-key-value-pairs（1 write/sec/key、~60s 最终一致）
- R2 CORS Configuration + R2 Workers API Range 支持
- R2 S3 Presigned URLs + AWS SDK v3 示例
- CLOUDFLARE_ENV 变量（2025-11-09） + CPU time 5-min 上限（2025-03-25）

**Better Auth：** Cookies 概念文档 + Hono 集成文档 + GH Issue #4038（跨域 cookie）

**Drizzle：** GH Discussion #1339 / Issue #2352（migration rollback）

**Sentry：** Sentry for Cloudflare + Hono + honoIntegration 官方集成

**Komga / Kavita / Jellyfin：** Komga OpenAPI book progression + Kavita progress sync wiki + Jellyfin issue #2518

**hls.js：** 官方 API error handling docs

**Puppeteer：** Navigation timeout #8829 + CDP createTarget timeout #10144

### Secondary (MEDIUM confidence)

- hls.js 重试/超时配置（社区整理）
- R2 hotlink protection 社区讨论
- D1 query 优化实战博客

### Codebase evidence（本仓）

- `.planning/codebase/CONCERNS.md` — SQL injection 风险点、deprecated serviceAuth、大组件、缓存复杂度、LIKE 查询、localStorage 凭据、migration 测试缺失
- `.planning/codebase/INTEGRATIONS.md` — cookie domain 推导、`getAllowedOrigins`、`baseURL = window.location.origin + '/api/auth'`
- `.planning/codebase/ARCHITECTURE.md` — D1 不支持 cross-statement 事务、cookie scope、CORS 白名单要求
- `apps/api/src/lib/auth.ts:34-106` — Better Auth 工厂 + cookie domain 推导
- `apps/gateway/src/cache-middleware.ts` — 两 scope 缓存、`NO_STORE_PREFIXES`、`Vary: Cookie`

---
*Research completed: 2026-05-11*
*Ready for roadmap: yes*
