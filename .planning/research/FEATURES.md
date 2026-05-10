# Feature Landscape

**Domain:** Personal content hub (video + comic + blog + admin), single-user self-hosted
**Researched:** 2026-05-10
**Scope:** v1 target features — playback stability, comic progress, admin gating, frontend login gating, unified session, deploy baseline, basic observability
**Reference products:** Jellyfin, Plex, Komga, Kavita, Mihon/Tachiyomi, Calibre-Web

## Executive framing for a solo-user hub

2026 年主流自托管媒体应用（Komga、Kavita、Jellyfin）都收敛到同一个范式："服务端记录真值，客户端上报事件，阅读器/播放器打开时从服务端拉取恢复位置"。对一个单人自用中台，这个范式仍是正确选择——不是因为需要多设备同步（多半不需要），而是因为(1) 已经有 D1 可用；(2) 手机和笔记本切换时 localStorage-only 的进度会非常难受。其他一切——社交、发现、分享、转码——对"只给自己、能用不崩"的目标都是噪音。

---

## Table stakes

"用户预期存在，缺失就像坏掉"。本项目的"用户"就是作者本人，所以标尺是"我每天在用，不能让我烦"。

### Playback stability (movie-app)

| Feature | Why expected | Complexity | Depends on |
|---|---|---|---|
| hls.js auto-recovery on `MEDIA_ERR_*` and `NETWORK_ERR_*` | 流卡顿是正常的；手动重载是 hls.js issue 里头号抱怨 | Low | Existing hls.js usage |
| Fragment retry with capped attempts (`fragLoadingMaxRetry`, `manifestLoadingMaxRetry`) | 默认策略要么过激（无限循环）要么过浅 | Low | hls.js config |
| Graceful fallback: `recoverMediaError()` → `swapAudioCodec()` → reload src | 标准的 hls.js 降级路径；避免"永远黑屏" | Low | hls.js |
| User-visible error state with "retry" button | 自动恢复放弃后用户需要一个出口 | Low | UI only |
| Resume playback position | Jellyfin、Plex 等所有主流媒体服务都做，单用户也预期 | Medium | Progress table + auth |
| Progress event cadence: every ~10s + on pause/seek/unload | Jellyfin `PlaybackProgress` 节奏；兼顾 DB 压力与恢复精度 | Low | Progress API |
| "Continue watching" rail on home | 进度数据的自然消费者；Netflix 时代以来的标配 | Low | Progress + movie list |

大部分是 hls.js 配置 + 一张 `watch_progress` 表。现有 `favorites` 模式可以直接镜像过来做进度。

### Comic reading progress (comic-app)

| Feature | Why expected | Complexity | Depends on |
|---|---|---|---|
| Per-chapter page position persistence | Komga/Kavita 的标准：`{chapterId, page, completed, updatedAt}` | Low | Progress table + auth |
| Resume on chapter open (jump to last page) | Mihon/Tachiyomi、Komga 阅读器的默认行为 | Low | Progress API |
| Mark chapter `completed` when last page reached | 驱动"未读"过滤和"下一章"推荐 | Low | Progress API |
| Series-level progress rollup ("3/12 read") | Komga `/api/v1/series/{id}/read-progress` 模式 | Low | Aggregation query |
| "Continue reading" rail on comic home | 与"继续观看"对称 | Low | Progress |
| Progress write debounce (1-2s) | 避免翻一页就打一次 API；Komga/Kavita 都这么做 | Low | Frontend only |

Komga 的 progression 结构（`{page, completed, readDate}`）是很好的模板——文档齐全、覆盖 95% 场景、能干净映射到 D1。

### Admin gating (dashboard)

| Feature | Why expected | Complexity | Depends on |
|---|---|---|---|
| 所有 `/dashboard/*` 路由要求已认证 session | dashboard 目前不登录也能进——这是 v1 核心阻塞 | Low | Auth middleware + gateway or app-level guard |
| 按身份白名单（只有作者的 GitHub 账号） | 单人项目；roles 表是过度设计，"是不是我的 github id"检查就够 | Low | Session + config/env |
| 未认证重定向到 `/auth/login?next=<original>` | 标准 SPA auth UX；登录后回到原页面 | Low | Auth UI route param |
| API 侧 `requireAuth(['admin'])` 守住所有 `/api/admin/*` | 深度防御；UI 门控不是安全 | Low | Existing middleware |
| 管理写操作的审计日志 | 已在 `audit-logger` 里存在；保持开启即可 | Low | Existing |

建议：v1 跳过完整 RBAC 表。一个 `ADMIN_GITHUB_ID` 环境变量检查就够，后续可扩展。

### Frontend login gating (movie-app, comic-app)

| Feature | Why expected | Complexity | Depends on |
|---|---|---|---|
| 匿名用户能看目录但看不到成人/敏感内容 | 标准"未登录 = SFW 视图"模式 | Medium | Content flag + middleware |
| 收藏、观看/阅读进度需要登录 | 进度是用户级的；匿名用户不做持久化 | Low | Auth check on write endpoints |
| "登录后继续"提示（不是硬墙） | 比强制登录更友好；Jellyfin 公开模式、Komga demo 都这样 | Low | UI modal |
| 成人内容通过 content rating 字段门控 | 每条内容一个 `is_adult boolean`，加 session 检查 | Medium | DB migration + query filter |
| 服务端过滤，不是只 UI 隐藏 | UI 隐藏但 API 返回就是泄漏；必须在查询层过滤 | Low | Query builder |

成人内容门控复杂度偏高，因为涉及 list/search/recommend 多个端点的查询逻辑——容易漏掉一处。

### Unified session (gateway + api + frontends)

当前架构是单域名（gateway 位于 `starye.org` 反代一切），所以**比看起来简单**——不需要 `advanced.crossSubDomainCookies`，因为所有流量通过 gateway 后都是同源。

| Feature | Why expected | Complexity | Depends on |
|---|---|---|---|
| 所有 app 使用同一个 cookie 名/域 | 经 gateway 流量已同源；只需确认没有 app 改写 cookie | Low | Gateway + Better Auth config |
| Gateway 原样转发 `Cookie` 与 `Set-Cookie` | 标准反代卫生；Cloudflare Workers `fetch` 默认这样 | Low | Gateway code audit |
| 各前端用 `useSession()` 打同一个 `/api/auth/session` | 已是 Better Auth 模式；保证各 app 都用，没有缓存陈旧 | Low | Shared composable |
| 登出在服务端失效 session（不只是清 cookie） | Better Auth `/api/auth/sign-out` 默认这样 | Low | Existing |
| Nuxt SSR 页面的 session 读取 | Nuxt 需要服务端 session；Better Auth 有 `getSession` for server routes | Medium | Better Auth Nuxt integration |

`better-auth#4038` 的跨域 cookie issue 是警示——如果未来从 gateway-proxy 切到 `*.starye.org` 子域名，会是一周的 debug。v1 阶段保持单源反代。

### Deploy baseline (all Workers + Pages)

Cloudflare 多数能力开箱即用——工作是把它们写明白、记录清楚。

| Feature | Why expected | Complexity | Depends on |
|---|---|---|---|
| CI 在 merge 到 main 时逐 Worker 跑 `wrangler deploy` | Workers CI/CD 标准流 | Low | GitHub Actions |
| Cloudflare Pages 从 `main` 分支自动部署 | Pages 原生支持；确认连接好即可 | Low | Cloudflare Pages config |
| `wrangler rollback [deployment-id]` 写进 `RUNBOOK.md` | Workers 2023 起原生支持；只是操作者要知道命令 | Low | Docs only |
| Pages 通过 dashboard 一键回滚 | 原生；记录一下操作路径 | Low | Docs only |
| PR 分支的预览部署 | Pages 内置；用来验证 UI 变更 | Low | Pages config |
| CI 中 D1 迁移应用（`drizzle-kit migrate`） | 没有这个，本地和 prod 的 schema 漂移是 v2 噩梦 | Medium | CI workflow |
| 环境变量/secret 清单文档化 | Workers 和 Pages 分别需要哪些 secret；目前隐式 | Low | Docs |

### Basic observability

| Feature | Why expected | Complexity | Depends on |
|---|---|---|---|
| API Worker 的 Sentry 错误捕获（`@sentry/cloudflare` + `honoIntegration`） | 2025+ Sentry 文档推荐的当前最佳；替代已 deprecated 的 `@hono/sentry`+toucan-js | Low | Sentry account + DSN |
| 前端 app 的 Sentry（至少 movie-app、comic-app） | 播放器 crash 和阅读器 crash 发生在浏览器 | Low | Sentry SDK per app |
| Sentry `beforeSend` 过滤已知噪音（用户中止、离线） | Free tier 5K events/月；不过滤的话 hls.js 错误循环一个小时耗尽 | Low | Sentry config |
| `wrangler tail` 内置实时调试 | 已有；文档化成第一排查工具 | Low | Docs |
| Playback failure 事件（Sentry message，不是 crash） | `recoverMediaError` 处理过的错误也值得追踪 | Low | hls.js error handler |
| Crawler 失败通知（GitHub Actions → Sentry 或 workflow 邮件） | 不通知的话你会一周都没发现；Actions 默认邮件通知失败 | Low | Actions config |

Sentry 是比"自己搭 logs-to-D1"务实的选择：free tier 对单用户足够，Hono 集成三行配置，分组/去重才是你真正需要的价值。

---

## Differentiators

"锦上添花，单用户 v1 不做也能发布。"这些明确**延后到 v1 之后**。

| Feature | Value | Complexity | Why defer |
|---|---|---|---|
| 跨设备离线进度同步 (service worker, queue replay) | 手机-笔记本无网切换 | High | 多数时候有网；过早优化 |
| 新入库 / 新发布 feed | 自己内容库的发现 | Medium | 已部分建好（`4cefbe6`）；打磨别扩展 |
| 个性化推荐 | "基于你看过的" | High | 已部分建好；算法质量是单人场景的无底洞 |
| 成人内容 PIN 门控（登录之外的额外） | 共享空间额外摩擦 | Low | 登录门控已够摩擦 |
| 阅读设置（阅读方向、Fit 模式）按系列持久化 | Tachiyomi/Mihon 做——西漫 LTR、日漫 RTL | Medium | 全局设置覆盖 90% |
| 播放速度 / 字幕偏好持久化 | Jellyfin 有；实用 | Low | localStorage 对 v1 就够 |
| 跳片头/片尾（章节标记） | Plex 级能力；需要章节数据 | High | 没有章节数据源；要手动标注 |
| "下一集"自动播放 | 追剧利器 | Medium | 依赖 series 数据模型；v2 |
| 跨 blog + 漫画 + 视频标题/元数据的全文搜索 | 统一中台价值点 | Medium | 单 app 搜索够 v1 |
| 推送通知（爬虫完成、新内容） | 实时感知 | High | 失败邮件已覆盖关键路径 |
| Watchlist / reading queue（独立于收藏） | Komga/Kavita 有 readlists | Medium | favorites 暂够 |
| Analytics dashboard（年度回顾） | 个人化氛围 | Medium | 纯虚荣功能 |

---

## Anti-features (explicitly NOT building)

这些对"内容平台"有诱惑但对单人中台是错的。

| Anti-feature | Why avoid | What to do instead |
|---|---|---|
| 多用户账号、profile、per-user 库 | Core Value 是"自用工具"；PROJECT.md 明确排除 | 单个 GitHub ID 白名单；不做 Better Auth 默认之外的 `users` 表 |
| 邀请系统、家庭共享、guest | 同上；session/权限复杂度倍增 | 要分享一件事就发公开 blog 链接 |
| 评论、点赞、他人评分、社交 | 没有他用户；零价值 | 1-5 星个人评分字段可以；不建社交层 |
| 多角色 RBAC、权限矩阵 | 单用户；roles 表纯开销 | 作者 GitHub ID 一个 `isAdmin` 检查 |
| 实时协作（SyncPlay、watch parties） | Jellyfin 功能；零价值 | 不适用 |
| 站内聊天、消息中心、活动流 | 社交模式；没观众 | 邮件或 Telegram webhook 覆盖真正关心的 2 件事 |
| 服务端转码 / 格式转换 | Workers 跑不了 ffmpeg；R2+HLS 已是正确架构 | 入库时 crawler 一次编码到 HLS/MP4；不做按需转码 |
| 直播 / TV | 没源 | 不适用 |
| SEO 优化、sitemap、OG 卡片 | PROJECT.md 排除"对外发布/运营/SEO"；吸引的是 bot | robots.txt disallow；公开 URL 保持稳定但不索引 |
| 公开 API / 第三方集成 | 没第三方；白给攻击面 | `/api/*` 藏在 session 或 service auth 后面 |
| 内容审核、DMCA 流、举报按钮 | 单作者；自审 | 不适用 |
| 访客行为分析（GA、Plausible） | 没访客；Sentry 已覆盖错误 | Cloudflare Workers Analytics（免费内置）够 |
| 用户管理 UI | 没用户 | 不适用 |
| 注册邮箱验证流 | 没注册；GitHub OAuth 一个白名单 | 在 callback 处拒绝白名单外的人 |
| 密码重置、2FA 设置 UI | GitHub 负责；这就是代入点 | 不适用 |
| 作者自己内容的审批队列 / 审核流 | PROJECT.md 明确延后"审核流程" | 直接发布；信任单一作者 |
| "Freemium" 付费墙、A/B 测试升级 | 非商业 | 不适用 |
| A/B 测试基础设施 | 没用户测 | 不适用 |
| 重分析 schema（事件日志表、漏斗） | D1 写成本 vs 零洞察价值 | Sentry events + CF analytics |

---

## Feature dependencies

```
Unified Session (5) ──┬──► Admin Gating (3)
                      ├──► Frontend Login Gating (4)
                      ├──► Comic Progress write path (2)
                      └──► Video Progress write path (1)

Deploy Baseline (6) ──► Everything else (can't ship without it)

Observability (7) ───► Detects regressions in 1-6 (parallel, not blocking)

Playback Stability (1) ─┬─► Resume-position UX
                        └─► Error-recovery UX

Comic Progress (2) ─────► "Continue reading" rail (differentiator, defer)
```

**含义：** Session 统一（5）是中心。第一优先建——其他一切都假设它有效。若 session 不稳，门控（3、4）是安全戏剧，进度（1、2）无法可靠识别用户。

---

## MVP recommendation for v1 sequencing

按依赖 + 风险排序：

1. **部署基线 + 可观测骨架** — 部署坏了或错误不可见，后面的修复都是瞎飞。先把 Sentry + `wrangler rollback` runbook 就位。
2. **端到端 session 统一** — 3、4 以及 1、2 的用户级部分的前置。验证 gateway cookie 转发、同一 session endpoint、Nuxt SSR session 读取。
3. **Admin 门控** — 依赖 auth 的最简单特性；用一个封闭 UI 验证整条 session 管道。
4. **前端登录门控（含成人内容过滤）** — 把 session 验证扩展到公开 app；强制服务端过滤的纪律。
5. **漫画阅读进度** — 比视频进度简单（整数 page + bool completed）。
6. **视频播放稳定性 + resume** — 因为都在 player 代码里；hls.js 怪癖导致风险最高。

**明确延后到 v1.1+：** "继续观看/阅读"横幅（进度数据消费者）、个性化推荐打磨、预览部署。

---

## Sources

HIGH confidence (official docs):
- [hls.js API: error handling and recovery](https://github.com/video-dev/hls.js/blob/master/docs/API.md)
- [Komga OpenAPI: book progression](https://komga.org/docs/openapi/get-book-progression)
- [Komga OpenAPI: mark read progress](https://komga.org/docs/openapi/mark-book-read-progress)
- [Kavita progress sync wiki](https://wiki.kavitareader.com/kavita+/progress-sync/)
- [Cloudflare Workers rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)
- [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/platform/rollbacks/)
- [Cloudflare Workers gradual deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/)
- [Sentry for Cloudflare + Hono](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/hono)
- [Sentry Cloudflare honoIntegration](https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/integrations/hono)
- [Better Auth cookies concept](https://www.better-auth.com/docs/concepts/cookies)

MEDIUM confidence (community/corroborated):
- [Jellyfin watch status & resume points issue](https://github.com/jellyfin/jellyfin/issues/2518)
- [hls.js retry/timeout configuration guide](https://app.studyraid.com/en/read/15763/550502/adjusting-retry-and-timeout-settings)
- [hls.js media error handling pattern (StackOverflow)](https://stackoverflow.com/questions/76608403/how-to-handle-media-errors-with-hls-js)
- [@hono/sentry (npm, now superseded by @sentry/cloudflare)](https://www.npmjs.com/package/@hono/sentry)
- [Better Auth cross-domain cookies issue #4038](https://github.com/better-auth/better-auth/issues/4038)

---

## Confidence assessment

| Area | Confidence | Notes |
|---|---|---|
| Playback stability patterns | HIGH | hls.js 行为和 Jellyfin 模型都有文档 |
| Comic progress patterns | HIGH | Komga/Kavita 暴露了精确的 schema |
| Admin gating | HIGH | 标准模式；代码里已有中间件 |
| Frontend login gating | MEDIUM | "登录后继续" UX 是惯例，不是规范 |
| Unified session | HIGH | 当前 gateway-proxy 架构是简单场景；Better Auth 文档覆盖 |
| Deploy baseline | HIGH | Cloudflare 2023 起原生 rollback |
| Observability | HIGH | Sentry Cloudflare/Hono 集成 2025+ 已是一方 |
| Anti-feature calls | HIGH | 直接锚定 PROJECT.md 声明的 Out of Scope |

---

## Gaps / open questions for requirements stage

- **Content rating schema**：`is_adult boolean` 最简单，但 crawler 当前不填——决定 ingest-time 标注 vs 手动标注（下放到某个 Phase）
- **视频进度粒度**：秒（float）vs tick（int，Jellyfin 风格）——小事，但锁定 API 形状
- **Sentry 预算**：free tier = 5K events/月。启用前端前需要噪音过滤方案，否则一个无限重试循环一个下午耗完
- **Admin 白名单机制**：env var（`ADMIN_GITHUB_ID=...`）vs user 表的 DB 列。env var 更简单且契合单用户；在 requirements 确认
- **"敏感内容"定义**：仅成人，还是更广（草稿、私有标签、未完成导入）？影响查询过滤复杂度

Files read during research: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.
