# Requirements: Starye — 个人内容中台

**Defined:** 2026-05-11
**Core Value:** 一个能部署在公网、能稳定日常使用的个人内容中台，所有子应用在同一域名下协同工作

## v1 Requirements

v1 目标：**"部署可用、日常使用态"** —— 关键是"能用、不崩"，不是"功能全"。

> 注：2026-05-12 起，Phase 3 已按真实执行范围收窄；`VIDEO-01/02/03/06` 从 v1 Active 移出，v1 活跃需求总数从旧稿 45 调整为真实的 41。

### Auth（认证与会话）

- [ ] **AUTH-01**：所有前端（dashboard / movie / comic / blog / auth）登录后 session 互通，刷新/跨子路径不掉线
- [ ] **AUTH-02**：Nuxt SSR 页面（blog / auth）能在服务端正确读取 session
- [ ] **AUTH-03**：Better Auth cookie 的 domain 显式设为 `.starye.org`，SameSite=Lax，Secure=true
- [ ] **AUTH-04**：Better Auth 升级到 `^1.6.10` 并通过登录/登出/刷新冒烟测试
- [ ] **AUTH-05**：Gateway 反向代理保留原 Host、原样透传 `Cookie` / `Set-Cookie` 头
- [ ] **AUTH-06**：Gateway 对 `/api/auth/*` 路径一律跳过 KV 缓存
- [ ] **AUTH-07**：Gateway KV 缓存对携带 `Cookie` 或 `Authorization` 的请求默认绕过缓存
- [ ] **AUTH-08**：登出在服务端真正失效 session（Better Auth `/api/auth/sign-out` 默认行为验证）

### Access Control（访问控制与门控）

- [ ] **ACCESS-01**：`/dashboard/*` 所有路由强制登录，未登录重定向到 `/auth/login?next=<origin>`
- [ ] **ACCESS-02**：作者管理员身份通过环境变量 `ADMIN_GITHUB_ID` 判定，非白名单账号进入 dashboard 即拒绝
- [ ] **ACCESS-03**：API 侧所有 `/api/admin/*` 路由通过 `requireAuth(['admin'])` 保护
- [ ] **ACCESS-04**：匿名用户可浏览 movie-app / comic-app / blog 的公开目录
- [ ] **ACCESS-05**：匿名用户访问收藏 / 观看进度 / 阅读进度 / 成人内容时被登录门控
- [ ] **ACCESS-06**：成人内容字段 `is_adult` 由爬虫入库时根据源站标签自动写入
- [ ] **ACCESS-07**：成人内容在 API 查询层服务端过滤（未登录用户的 list/search/recommend 返回不含 `is_adult=true`），UI 不做隐藏式过滤

### Public Security（公网暴露面）

- [ ] **PUBSEC-01**：Gateway 统一提供 `/robots.txt`，disallow `/dashboard /auth /api`
- [ ] **PUBSEC-02**：Gateway 对 `/dashboard/*`、`/api/admin/*` 响应添加 `X-Robots-Tag: noindex, nofollow`
- [ ] **PUBSEC-03**：Cloudflare WAF Rate Limiting 规则对 `/api/auth/sign-in` 限制 10 req/min/IP
- [ ] **PUBSEC-04**：生产环境关闭或鉴权保护 `/api/docs`（Scalar OpenAPI UI）
- [ ] **PUBSEC-05**：所有 `*.pages.dev` 直链通过 `_redirects` 301 回 `starye.org/<app>/`，阻止绕过 gateway

### Video Playback（视频播放稳定性）

- [ ] **VIDEO-04**：播放器捕获 `error` / `waiting` 超时等异常，显示统一错误卡片，并提供“重试当前源”动作（保留 `currentTime`，不自动切源、不做 codec swap）
- [ ] **VIDEO-05**：播放失败时显示可见错误态 + "重试"按钮，避免黑屏卡死

### Progress（观看/阅读进度）

- [ ] **PROG-01**：D1 新增 `progress` 表：复合主键 `(userId, contentType, contentId)`，字段含 `position`(int seconds/int page)、`duration`、`completed`、`updatedAt`
- [ ] **PROG-02**：`progress` 表建立 `(userId, updatedAt)` 索引支持"继续观看/阅读"查询
- [ ] **PROG-03**：`PUT /api/progress/:contentType/:id` upsert 使用 `ON CONFLICT DO UPDATE`；批写使用 `db.batch([...])`
- [ ] **PROG-04**：movie-app 打开视频时从 `progress` 表恢复 `position`，自动 seek
- [ ] **PROG-05**：movie-app 每 10 秒 + 暂停 / seek / pagehide 时写入进度
- [ ] **PROG-06**：comic-app 打开章节时从 `progress` 表恢复 `page`，跳到上次位置
- [ ] **PROG-07**：comic-app 翻页 debounce 500ms 写入进度；`pagehide` 强制 flush
- [ ] **PROG-08**：章节最后一页自动标记 `completed=true`

### Deploy（部署与迁移安全）

- [ ] **DEPLOY-01**：每个 Worker / Pages 应用均有 `main` 分支 merge 触发的 deploy workflow
- [ ] **DEPLOY-02**：新增 `rollback.yml` workflow（workflow_dispatch），接收 app + version_id 参数，调用 `wrangler rollback`
- [ ] **DEPLOY-03**：`deploy-migrations.yml` 在 `drizzle-kit migrate` 前执行 `wrangler d1 export --remote` 备份到 R2
- [ ] **DEPLOY-04**：CI 在 PR diff 包含 `DROP COLUMN` 时要求显式 reviewer ack 才能 merge
- [ ] **DEPLOY-05**：编写 `RUNBOOK.md`，记录 Workers / Pages 的分级回滚路径与常见故障处理步骤
- [ ] **DEPLOY-06**：wrangler 升级到 `^4.90.0`（获得稳定 `wrangler rollback` 体验）

### Observability（可观测性骨架）

- [ ] **OBS-01**：api / gateway Worker 接入 `@sentry/cloudflare ^10.52.0` + `honoIntegration()`，不使用已 deprecated 的 `@hono/sentry`
- [ ] **OBS-02**：movie-app / comic-app 接入 `@sentry/vue`；blog / auth 接入 `@sentry/nuxt`
- [ ] **OBS-03**：Sentry `beforeSend` 过滤用户中止（`AbortError`）、离线（`NetworkError`）、已恢复的 hls.js 事件
- [ ] **OBS-04**：视频 `<video>` 播放失败发送 Sentry message 事件（非 crash），含 error code / src / user-agent
- [ ] **OBS-05**：Crawler GitHub Actions workflow 失败时发送邮件告警（Actions 默认行为验证）

## v2 Requirements

v1 稳定后考虑，不阻塞 v1 发布。

### Continue Rails（继续观看/阅读横幅 UI）

- **CONT-01**：movie-app 首页"继续观看"横幅
- **CONT-02**：comic-app 首页"继续阅读"横幅
- **CONT-03**：series 级阅读进度汇总（"3/12 章已读"）

### Advanced Gating

- **GATE-01**：成人内容登录之外的 PIN 门控（共享空间额外摩擦）
- **GATE-02**：dashboard 手动标注 `is_adult` 的复核入口（补爬虫漏报）

### Reading / Watching UX

- **UX-01**：阅读方向（LTR/RTL）与 Fit 模式按系列持久化
- **UX-02**：播放速度 / 字幕偏好持久化（跨设备）

### Discovery

- **DISC-01**：跨 blog / 漫画 / 视频标题 + 元数据全文搜索
- **DISC-02**：个性化推荐算法打磨

### Crawler Reliability

- **CRAW-01**：住宅代理接入 `PROXY_SERVER` 变量
- **CRAW-02**：Cloudflare challenge 页面检测（"Just a moment..."/"cf-browser-verification" 触发代理轮换）
- **CRAW-03**：断点续抓 + 幂等键（`ON CONFLICT DO UPDATE`）
- **CRAW-04**：HTTP-only fallback 用 `got-scraping`（不必启 Chrome 的场景）

### Ops

- **OPS-01**：`[env.staging]` + Pages preview branch 启用
- **OPS-02**：Sentry noise filter 按首周用量微调

## Out of Scope

明确不做，防止范围蔓延。

| Feature | Reason |
|---------|--------|
| 多用户账号 / profile / 家庭共享 / 邀请 / guest | Core Value 是自用工具，多用户复杂度不值得 |
| 评论 / 点赞 / 他人评分 / 社交 / watch parties / SyncPlay | 没有他用户，零价值 |
| 完整 RBAC 权限矩阵 | 单用户；env var 白名单就够 |
| 服务端按需转码 / HLS 切片 | Workers 跑不了 ffmpeg；R2 直出 MP4 已够 |
| SEO / sitemap / OG 卡片 | PROJECT.md 明确排除；反而要 noindex |
| 公开 API / 第三方集成 | 没第三方；白给攻击面 |
| 内容审核 / DMCA 流 / 举报 | 单作者；自审 |
| 访客行为分析（GA / Plausible） | 没访客；Sentry + CF Analytics 够 |
| 邮箱验证 / 密码重置 / 2FA UI | GitHub OAuth 覆盖 |
| dashboard 正式审核流 | "审核"语义作者未明确定义 |
| 自建 APM / Prometheus / Grafana | 违反 Cloudflare 免费额度预算约束 |
| PWA / Service Worker | 同域多 app 下 SW 串台风险，v1 明确不启用 |
| 移动端原生 App | 浏览器访问够用 |
| 支付 / 会员体系 | 非商业 |
| R2 作为视频宿主 | 存储 + 出站成本相对价值不划算；视频保持现有 magnet / TorrServer / Aria2 / 外链路径 |

## Traceability

由 roadmapper 于 2026-05-11 填充，对应 `.planning/ROADMAP.md`。

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| AUTH-08 | Phase 1 | Pending |
| ACCESS-01 | Phase 2 | Pending |
| ACCESS-02 | Phase 2 | Pending |
| ACCESS-03 | Phase 2 | Pending |
| ACCESS-04 | Phase 2 | Pending |
| ACCESS-05 | Phase 2 | Pending |
| ACCESS-06 | Phase 2 | Pending |
| ACCESS-07 | Phase 2 | Pending |
| PUBSEC-01 | Phase 2 | Pending |
| PUBSEC-02 | Phase 2 | Pending |
| PUBSEC-03 | Phase 2 | Pending |
| PUBSEC-04 | Phase 2 | Pending |
| PUBSEC-05 | Phase 2 | Pending |
| VIDEO-01 | Out of Scope | Dropped from v1 in Phase 3 |
| VIDEO-02 | Out of Scope | Dropped from v1 in Phase 3 |
| VIDEO-03 | Out of Scope | Dropped from v1 in Phase 3 |
| VIDEO-04 | Phase 3 | Pending |
| VIDEO-05 | Phase 3 | Pending |
| VIDEO-06 | Out of Scope | Dropped from v1 in Phase 3 |
| PROG-01 | Phase 4 | Pending |
| PROG-02 | Phase 4 | Pending |
| PROG-03 | Phase 4 | Pending |
| PROG-04 | Phase 4 | Pending |
| PROG-05 | Phase 4 | Pending |
| PROG-06 | Phase 4 | Pending |
| PROG-07 | Phase 4 | Pending |
| PROG-08 | Phase 4 | Pending |
| DEPLOY-01 | Phase 5 | Pending |
| DEPLOY-02 | Phase 5 | Pending |
| DEPLOY-03 | Phase 5 | Pending |
| DEPLOY-04 | Phase 5 | Pending |
| DEPLOY-05 | Phase 5 | Pending |
| DEPLOY-06 | Phase 5 | Pending |
| OBS-01 | Phase 5 | Pending |
| OBS-02 | Phase 5 | Pending |
| OBS-03 | Phase 5 | Pending |
| OBS-04 | Phase 5 | Pending |
| OBS-05 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 41 total（AUTH 8 + ACCESS 7 + PUBSEC 5 + VIDEO 2 + PROG 8 + DEPLOY 6 + OBS 5 = 41；2026-05-12 起按 Phase 3 真实范围收窄）
- Mapped to phases: 41 / 41 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-11*
*Last updated: 2026-05-11 traceability populated by roadmapper*
