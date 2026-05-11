# Roadmap: Starye — 个人内容中台 v1

**Created:** 2026-05-11
**Granularity:** standard
**Total phases:** 5
**v1 coverage:** 45/45 requirements mapped

## Core Value Reminder

"部署在公网、能稳定日常使用的个人内容中台" —— 所有子应用在同一域名下协同工作，能长期保持可访问、可阅读、可观看。v1 不追求功能全，只守住"能用、不崩"。

## Phases

- [ ] **Phase 1: Auth 全链路 + Gateway 缓存安全基线** — 打通 5 端统一会话，堵上 gateway 缓存按用户隔离的漏洞
- [ ] **Phase 2: Dashboard 访问控制 + 前台登录门控 + 公网暴露面加固** — 闭合"谁能看到什么"：dashboard 白名单、成人内容服务端过滤、robots/限流/文档鉴权
- [ ] **Phase 3: movie-app 播放稳定化（R2 直发 + 错误恢复）** — 视频从 `cdn.starye.org` 直出 MP4，原生 Range + 可见错误态 + R18 签名
- [ ] **Phase 4: 统一 Progress 表 + 漫画阅读/视频观看进度** — `progress` 表支撑"打开即恢复"
- [ ] **Phase 5: 部署基础盘 + 可观测骨架 + Migration 安全** — deploy/rollback workflow、D1 迁移前备份、Sentry 双端接入、RUNBOOK

## Phase Details

### Phase 1: Auth 全链路 + Gateway 缓存安全基线
**Goal**: 作者登录一次后，在所有子应用（dashboard/movie/comic/blog/auth）任意路径、任意刷新、任意 Nuxt SSR 页面都保持登录状态；gateway KV 缓存不会把已登录用户的私有响应泄漏给匿名访客或其他用户。
**Depends on**: Nothing (first phase, unblocks everything downstream)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08
**Success Criteria** (what must be TRUE):
  1. 作者在任一前端登录后，刷新页面、跨子路径切换、进入 Nuxt SSR 页面（blog / auth）均保持登录状态，不需要重新登录
  2. 作者点击登出后服务端 session 立刻失效，所有前端刷新即变回匿名态，再次访问受保护路径被重定向到 `/auth/login`
  3. 带 `Cookie` 或 `Authorization` 的请求默认绕过 gateway KV 缓存，且匿名用户永远不会读到上一个已登录用户的响应
  4. `/api/auth/*` 全路径不落 KV 缓存，`Set-Cookie` 头原样透传到浏览器（cookie domain 正确写为 `.starye.org`，SameSite=Lax，Secure=true）
  5. `better-auth` 升级到 `^1.6.10` 并通过登录 / 登出 / 刷新冒烟测试
**Plans**: 6 plans across 3 waves
  - [x] 01-01-PLAN.md — Wave 0 测试骨架（gateway D-11 四条 it.todo + blog/dashboard e2e skip + api signout todo）
  - [x] 01-02-PLAN.md — Gateway cache bypass 实现 + private scope 死代码清理（D-07/D-10/D-12..14）
  - [x] 01-03-PLAN.md — Nuxt blog + auth SSR session 通道（D-01..D-04）
  - [x] 01-04-PLAN.md — Better Auth 升级 1.6.2 → ^1.6.10（D-18，四 package.json 同 commit）
  - [x] 01-05-PLAN.md — AUTH-08 signout 单测实装（D-15）
  - [x] 01-06-PLAN.md — 集成冒烟 + D-19 六步 human checkpoint（phase gate）

### Phase 2: Dashboard 访问控制 + 前台登录门控 + 公网暴露面加固
**Goal**: 只有作者（`ADMIN_GITHUB_ID` 白名单）能进入 dashboard；匿名用户可以浏览公开目录但在触达收藏/进度/成人内容时被登录门控；搜索引擎不再索引后台/认证/API 路径；Scalar OpenAPI UI 在生产环境需要鉴权；`/api/auth/sign-in` 有速率限制。
**Depends on**: Phase 1 (needs reliable session to make gating decisions)
**Requirements**: ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-06, ACCESS-07, PUBSEC-01, PUBSEC-02, PUBSEC-03, PUBSEC-04, PUBSEC-05
**Success Criteria** (what must be TRUE):
  1. 匿名访问 `/dashboard/*` 任何路径均被重定向到 `/auth/login?next=<origin>`，非白名单 GitHub 账号登录后进入 dashboard 立即被拒
  2. 匿名用户可正常浏览 movie-app / comic-app / blog 的公开目录，但点击收藏 / 观看进度 / 阅读进度 / 成人内容时被拦截到登录页
  3. 匿名用户通过 API 的 list / search / recommend 响应中不包含 `is_adult=true` 记录（服务端过滤，非 UI 隐藏）；爬虫入库时已根据源站标签写入 `is_adult`
  4. `curl https://starye.org/robots.txt` 返回 disallow `/dashboard /auth /api`；`/dashboard/*` 与 `/api/admin/*` 响应带 `X-Robots-Tag: noindex, nofollow`；`*.pages.dev` 直链 301 回 `starye.org/<app>/`
  5. 生产环境 `/api/docs` 需鉴权才能访问；`/api/auth/sign-in` 被 Cloudflare WAF 规则限制 10 req/min/IP
**Plans**: 6 plans across 3 waves
  - [x] 02-01-PLAN.md — Wave 1 地基：Better Auth additionalFields 注入 githubId + SessionUser 类型扩展（ACCESS-02/03）
  - [x] 02-02-PLAN.md — Wave 2：API requireAuth 白名单短路 + /api/docs 鉴权保护（ACCESS-02/03/PUBSEC-04）
  - [x] 02-03-PLAN.md — Wave 2：Gateway dashboard-guard + /robots.txt + X-Robots-Tag（ACCESS-01/02/PUBSEC-01/02）
  - [x] 02-04-PLAN.md — Wave 2：adult-filter service + public routes 统一调用 + search bug 修复（ACCESS-04/06/07）
  - [x] 02-05-PLAN.md — Wave 2：useAuthGuard composable + 收藏按钮拦截 + login.vue next 参数（ACCESS-04/05）
  - [x] 02-06-PLAN.md — Wave 3：6 个 Pages _redirects 301 规则 + RUNBOOK WAF 段落（PUBSEC-03/05）

### Phase 3: movie-app 播放稳定化（R2 直发 + 错误恢复）
**Goal**: 视频从 `cdn.starye.org` 直接由 R2 + Cloudflare CDN 发出，浏览器拿到原生 Range + Accept-Ranges，Safari/Android 拖进度条不黑屏；`<video>` 异常时用户看到可见错误态 + 重试按钮而非卡死；R18 内容通过短期签名 URL 播放且过期前自动续签不打断观看。
**Depends on**: Phase 1 (R18 sign endpoint 需要识别用户身份)
**Requirements**: VIDEO-01, VIDEO-02, VIDEO-03, VIDEO-04, VIDEO-05, VIDEO-06
**Success Criteria** (what must be TRUE):
  1. 打开任一视频详情页，DevTools Network 显示视频 URL 指向 `cdn.starye.org`，首个请求返回 206 Partial Content + `Accept-Ranges: bytes`
  2. 拖动进度条至视频任意位置均可正常 seek 并继续播放，Safari 与 Android Chrome 不再出现黑屏
  3. 播放异常（codec 失配 / 网络中断 / 403 签名过期）时用户看到明确错误文案 + "重试"按钮；点击可恢复播放
  4. R18 内容播放 URL 为签名短链（≤1h 过期），过期前自动静默续签，观看不中断
  5. 同一视频二次访问命中 Cloudflare 边缘缓存（响应头 `Cache-Control: public, max-age=86400` 生效，CF-Cache-Status: HIT）
**Plans**: TBD
**UI hint**: yes

### Phase 4: 统一 Progress 表 + 漫画阅读/视频观看进度
**Goal**: 作者打开已播放过的视频自动 seek 到上次位置，打开已读过的漫画章节自动跳到上次翻到的页；一张 `progress` 表同时支撑 movie + comic 两路消费，写入遵循"事件触发 debounce + pagehide flush"，关闭标签页不丢进度；章节最后一页自动标记完成。
**Depends on**: Phase 1 (progress 读写按 userId 分片，需要会话可靠识别用户)
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04, PROG-05, PROG-06, PROG-07, PROG-08
**Success Criteria** (what must be TRUE):
  1. 作者关闭视频后重新打开同一视频，播放器自动 seek 到上次退出时的秒数（误差 ≤ 10s）
  2. 作者关闭漫画章节后重新打开同一章节，阅读器跳到上次翻到的页（误差 0 页）
  3. 视频每 10 秒 + 暂停 / seek / `pagehide` 时进度被写入 D1；漫画翻页 500ms debounce + `pagehide` 强制 flush
  4. `GET /api/progress?contentType=movie` 按 `updatedAt` 倒序返回最近观看列表（支撑 v2 的"继续观看"横幅）
  5. 读到章节最后一页后 `progress.completed=true`，下次查询该章节时标识为已完成
**Plans**: TBD
**UI hint**: yes

### Phase 5: 部署基础盘 + 可观测骨架 + Migration 安全
**Goal**: 每个 Worker / Pages 应用都有 `main` 分支 merge 触发的部署流水线；生产故障可在 workflow_dispatch 一键回滚；D1 迁移在应用前自动备份，`DROP COLUMN` 需显式 reviewer 确认；api/gateway 和各前端的关键错误（含 `<video>` 播放失败）汇入 Sentry，噪音被 `beforeSend` 过滤；RUNBOOK 记录各应用的分级回滚路径。
**Depends on**: Phase 3, Phase 4 (Sentry 上线时已有 P3/P4 新增代码路径，错误聚合立即有价值；P2 的 WAF/限流配置也会汇总进入 RUNBOOK)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, OBS-01, OBS-02, OBS-03, OBS-04, OBS-05
**Success Criteria** (what must be TRUE):
  1. 任一应用代码 merge 到 `main` 后对应的 GitHub Actions workflow 自动完成生产部署；`wrangler` 已升至 `^4.90.0`
  2. `rollback.yml` 可通过 workflow_dispatch 接收 `app` + `version_id` 参数，在 1 分钟内把指定 Worker 回滚到上一版本
  3. `deploy-migrations.yml` 在执行 `drizzle-kit migrate` 前先 `wrangler d1 export --remote` 备份到 R2；PR diff 含 `DROP COLUMN` 时 CI 强制要求 reviewer 显式 ack 才能 merge
  4. api / gateway / movie-app / comic-app / blog / auth 六个应用的关键错误均进入同一 Sentry 项目（Workers 用 `@sentry/cloudflare` + `honoIntegration()`，不用已 deprecated 的 `@hono/sentry`），`AbortError` / `NetworkError` / 已恢复的 hls.js 事件被 `beforeSend` 过滤掉；`<video>` 播放失败以非 crash message 事件上报（含 error code / src / user-agent）
  5. `RUNBOOK.md` 入仓并记录 Workers / Pages 分级回滚路径 + 常见故障处理步骤；crawler GitHub Actions workflow 失败时通过 Actions 默认行为发送邮件告警
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth 全链路 + Gateway 缓存安全基线 | 0/6 | Planned | - |
| 2. Dashboard 访问控制 + 前台登录门控 + 公网暴露面加固 | 0/6 | Planned | - |
| 3. movie-app 播放稳定化（R2 直发 + 错误恢复） | 0/0 | Not started | - |
| 4. 统一 Progress 表 + 漫画阅读/视频观看进度 | 0/0 | Not started | - |
| 5. 部署基础盘 + 可观测骨架 + Migration 安全 | 0/0 | Not started | - |

## Coverage Validation

**v1 requirements mapped:** 45/45 ✓

| Category | REQ-IDs | Phase |
|----------|---------|-------|
| AUTH (8) | AUTH-01..08 | Phase 1 |
| ACCESS (7) | ACCESS-01..07 | Phase 2 |
| PUBSEC (5) | PUBSEC-01..05 | Phase 2 |
| VIDEO (6) | VIDEO-01..06 | Phase 3 |
| PROG (8) | PROG-01..08 | Phase 4 |
| DEPLOY (6) | DEPLOY-01..06 | Phase 5 |
| OBS (5) | OBS-01..05 | Phase 5 |

**No orphaned requirements.**
**No duplicate mappings.**

## Coverage Notes

**Discrepancy found and resolved:**
REQUIREMENTS.md Coverage block claimed "v1 requirements: 41 total" but actual sum by category is 45 (AUTH 8 + ACCESS 7 + PUBSEC 5 + VIDEO 6 + PROG 8 + DEPLOY 6 + OBS 5 = 45). All 45 are genuine v1 items with REQ-IDs. Traceability section updated to reflect 45 mapped.

**v2 requirements explicitly excluded from roadmap (will not block v1 ship):**
CONT-01..03 (continue watching/reading banner UI), GATE-01..02 (advanced gating), UX-01..02 (reading/playback prefs), DISC-01..02 (discovery/search), CRAW-01..04 (crawler reliability), OPS-01..02 (staging/Sentry tuning). These stay in REQUIREMENTS.md v2 section until v1 is validated in production.

## Phase Ordering Rationale

**Why Auth first:** Session 是下游所有功能的主动脉 —— 门控、进度、收藏、成人内容过滤都要可靠识别用户。没 P1，P2/P4 全部悬空。

**Why Access + PubSec together (P2):** Dashboard 门控、robots/limiter、成人内容过滤、docs 鉴权、`*.pages.dev` 301 —— 单独每项都是小事，合起来是 v1 最大的运营风险面。共享 "谁能看到什么" 的审计视角，一次讲清楚。

**Why Video before Progress (P3 before P4):** 两者正交可并行。把播放稳定化排前，是因为 "CONCERNS.md 已指出偶尔出错" 属于作者每日高频触发的痛点；P4 需要 P1 的 userId 但与 P3 无直接依赖，实际排期可按需并行。

**Why Deploy + Obs last (P5):** Sentry 在 P3/P4 上线后才有稳定的错误形状可以聚合，过早接入只看到海量噪音。Deploy/rollback 流水线是 brownfield 增量，不会让前面阶段的调试体验明显变差。

**Research Flag (to investigate before starting):**
- P1 开工前必须先读 `apps/gateway/src/cache-middleware.ts` 现状：是否已跳过 `/api/auth/*`、是否对 `Set-Cookie` 响应 bypass、private scope 当前如何构造 key —— 避免 "以为已经做了、其实没做"
- P3 开工前确认 `xgplayer` 的 `error` 事件结构 + `wrangler r2 bucket cors put` 语法 + R2 custom domain 与 zone-level Cache Rules 的交互

---
*Roadmap created: 2026-05-11*
