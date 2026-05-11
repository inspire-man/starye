# Phase 2: Dashboard 访问控制 + 前台登录门控 + 公网暴露面加固 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 2-dashboard
**Areas discussed:** Dashboard 门控架构、成人内容字段 + 过滤、前台登录门控形态、暴露面加固落地位置

---

## 区域选择（gray area selection）

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard 门控架构 | ADMIN_GITHUB_ID 白名单与 role 四角色共存关系，门控在哪一层 | ✓ |
| 成人内容字段 + 过滤 | schema isR18 vs 需求 is_adult、服务端过滤切入层、可见性规则 | ✓ |
| 前台登录门控形态 | 匿名点收藏/进度/成人的拦截方式与实现分层 | ✓ |
| 暴露面加固落地位置 | robots/X-Robots-Tag/pages.dev 301/docs 鉴权/WAF 限速的归属 | ✓ |

**User's choice:** 四个区全选。
**Notes:** 无历史 todo 匹配（`gsd-sdk todo.match-phase 2` 返回 `todo_count: 0`），讨论仅围绕 ROADMAP + REQUIREMENTS。

---

## Dashboard 门控架构

### Q1: 门控层级

| Option | Description | Selected |
|--------|-------------|----------|
| Gateway Worker 层拦截（推荐） | 到达 `/dashboard/*` 立即调 `/api/auth/get-session`，未登/非白名单 302 登录页。未登陆用户拿不到 Pages 静态资源，最符合 ACCESS-01 | ✓ |
| API + 前端双重校验 | Gateway 放行，前端 router + API admin 中间件各自校验。修改最小，但 bots/直链能拿到 dashboard JS bundle | |
| Gateway 轻拦截 + API 强校验 | Gateway 看有无 session cookie（不验真假），API 侧做真假/角色校验。零额外 RTT，但匿名伪造 cookie 可跳过 Gateway | |

**User's choice:** Gateway Worker 层拦截
**Notes:** 用户倾向"不信任纯前端 router guard"，要求 Pages 静态资源都别放给未授权访客。

### Q2: 白名单 vs 角色

| Option | Description | Selected |
|--------|-------------|----------|
| ADMIN_GITHUB_ID 覆盖角色判定（推荐） | 白名单命中即视为 super_admin，env var 权威，DB role 不影响 | ✓ |
| 白名单 AND 角色 双闸 | env + DB role 同时满足才放行，最严格但首次部署需 seed | |
| 废除 role，纯白名单 | 移除 comic_admin/movie_admin 四角色，全仓重命名 | |

**User's choice:** ADMIN_GITHUB_ID 覆盖角色判定
**Notes:** 单用户场景下 env 为权威源，DB role 作为防御深度保留给 v2 多用户扩展口子。

### Q3: 白名单存储

| Option | Description | Selected |
|--------|-------------|----------|
| 纯 env var（推荐） | ADMIN_GITHUB_ID 在 wrangler secret / .dev.vars 中 | ✓ |
| env var + D1 flag 双重 | env 主、DB user.role 辅 | |
| Better Auth hooks 注入 | databaseHooks.user.create.after 里自动 set role | |

**User's choice:** 纯 env var
**Notes:** 零依赖、单用户场景足够。

### Q4: Gateway 识别机制

| Option | Description | Selected |
|--------|-------------|----------|
| fetch /api/auth/get-session（推荐） | Gateway 内 fetch API 拿 session，内存 L1 缓存 30s | ✓ |
| 直接核对签名 cookie | Gateway 解 HMAC 验签 | |
| Cookie 存在性启发式 | 只看有无 session cookie 就放行 | |

**User's choice:** fetch /api/auth/get-session
**Notes:** 忠实于 Better Auth 状态；L1 缓存 30s 减少 RTT。

---

## 成人内容字段 + 过滤

### Q1: 字段命名

| Option | Description | Selected |
|--------|-------------|----------|
| 不改名，文档对齐（推荐） | REQUIREMENTS.md is_adult ↔ schema isR18 语义等价，CONTEXT.md 明确映射 | ✓ |
| 改 schema isR18 → isAdult | 60+ 处重命名 + migration | |
| 另开 isAdult 列 | 与 isR18 并行，更混乱 | |

**User's choice:** 不改名，文档对齐
**Notes:** 避免 churn。

### Q2: 过滤层

| Option | Description | Selected |
|--------|-------------|----------|
| handler 层描描 handler | 直接在每个 public handler 的 conditions 数组里插 eq(isR18, false) | |
| 统一 buildAdultFilter helper（推荐） | 新建 services/adult-filter.ts，所有 public/* 统一调用 | ✓ |
| middleware 注入 scope | c.set('adultScope', ...) 由 service 取用 | |

**User's choice:** 统一 buildAdultFilter helper
**Notes:** 矩阵化 + 可测，防漏网。

### Q3: 可见性规则

| Option | Description | Selected |
|--------|-------------|----------|
| 二层：登录+R18验证可见（推荐） | 匿名/未验证 → 只见 isR18=false；isR18Verified=true → 见全部 | ✓ |
| 一层：登录+isAdult 即可见 | 简化为一个状态机，但 R18Whitelist 语义丢失 | |
| public 永远 SFW | 想看 R18 走 /api/movies/*（已 requireAuth） | |

**User's choice:** 二层
**Notes:** 沿用现有 `isR18Verified` + R18Whitelist UI 作为 admin 打标入口。

### Q4: 与 Phase 1 缓存交互

| Option | Description | Selected |
|--------|-------------|----------|
| 不新增 scope（推荐） | Phase 1 D-07 带 cookie 全 bypass，匿名 SFW 可缓存、登录自然 bypass | ✓ |
| 保险：list 路径也不缓存 | 加入 NO_STORE_PREFIXES | |
| 新增 SFW/ALL scope 拆分 | Q3 选了二层才需要 | |

**User's choice:** 不新增 scope

### Q5 补问: Area 2 收口

| Option | Description | Selected |
|--------|-------------|----------|
| 下一个区（推荐） | 进 ③ 前台门控形态 | ✓ |
| Area 2 再补问 | 问爬虫入库 isR18 覆盖率、isR18Verified 打标入口等 | |

**User's choice:** 下一个区
**Notes:** "爬虫 ACCESS-06" 视为已有能力，planner 在 RESEARCH 阶段验证覆盖率即可。

---

## 前台登录门控形态

### Q1: 拦截形态

| Option | Description | Selected |
|--------|-------------|----------|
| 直接 redirect 到 /auth/login（统一） | window.location.href = /auth/login?next=... | ✓ |
| 弹 modal 登录卡片 | 原地登录卡片，GitHub OAuth 仍需跳转 | |
| UI 占位：锁图标 + CTA | 未登时按钮渲染为占位样式，点击即语义 | |

**User's choice:** 直接 redirect
**Notes:** 简洁，体验统一。

### Q2: 实现分层

| Option | Description | Selected |
|--------|-------------|----------|
| 组件层：useAuthGuard composable（推荐） | 所有需登的按钮调 guardedAction | ✓ |
| API 401 拦截器回勖 | axios/fetch 拦截 401 → redirect | |
| 两层都做 | 组件层上纠 + API 401 兜底 | |

**User's choice:** 组件层：useAuthGuard composable
**Notes:** API 401 兜底方案本期不做，Phase 5 Sentry 时再看噪音。

### Q3: 拦截场景（多选）

| Option | Description | Selected |
|--------|-------------|----------|
| 收藏按钮（movie/comic） | ACCESS-05 核心场景 | ✓ |
| 观看/阅读进度入口（历史页） | Phase 4 未落实前不强放今天 | |
| 成人内容点击（点卡片/详情/播放） | 服务端 buildAdultFilter 已过滤，匿名看不到 R18 卡片 | |
| 用户反馈表单 | Phase 5 才正式做反馈 | |

**User's choice:** 收藏按钮（movie/comic）
**Notes:** 历史/进度 Phase 4 接入同一 composable；成人靠服务端过滤。

### Q4: 登录后回弹

| Option | Description | Selected |
|--------|-------------|----------|
| next 参数 + 同源校验（推荐） | /auth/login?next=<encoded>，成功后 location.href=next；防 open redirect | ✓ |
| 登录后回首页 | 无 open redirect 风险但体验差 | |
| 服务器 cookie 回弹页面 | 过度工程，单用户不值 | |

**User's choice:** next 参数 + 同源校验

### Q5 补问: Area 3 收口

| Option | Description | Selected |
|--------|-------------|----------|
| 收藏按钮单场景，成人内容靠服务端【确认】 | 本期仅收藏按钮拦截 | ✓ |
| 还有场景需补充 | 如登录但 isR18Verified=false 的 UI 体验 | |

**User's choice:** 单场景确认

---

## 暴露面加固落地位置

### Q1: robots.txt + X-Robots-Tag

| Option | Description | Selected |
|--------|-------------|----------|
| Gateway 统一处理（推荐） | Gateway 新增 /robots.txt 路由 + 响应头中间件 | ✓ |
| 各 app 自理 _redirects + nuxt-robots | 分散到各 Pages，双源风险 | |
| 只加响应头 | 不设 robots.txt，仅 X-Robots-Tag | |

**User's choice:** Gateway 统一处理

### Q2: *.pages.dev 301

| Option | Description | Selected |
|--------|-------------|----------|
| 各 Pages _redirects（推荐） | 6 个 Pages 应用各写 public/_redirects | ✓ |
| Gateway Worker 解析 *.pages.dev | 不可行，CF 不支持 Worker 挂 pages.dev 根域 | |
| 放弃，移给 RUNBOOK | 不公开宣传 *.pages.dev URL 即可 | |

**User's choice:** 各 Pages _redirects

### Q3: /api/docs 生产保护

| Option | Description | Selected |
|--------|-------------|----------|
| requireAuth 鉴权（推荐） | /api/docs + /api/openapi.json 加 requireAuth(['admin','super_admin']) | ✓ |
| 生产关停 | if ENVIRONMENT === 'production' 不挂 Scalar | |
| Gateway 前挂拦截 | 重复已有鉴权逻辑 | |

**User's choice:** requireAuth 鉴权

### Q4: WAF 限速

| Option | Description | Selected |
|--------|-------------|----------|
| 手配 + 写进 RUNBOOK（推荐） | CF Dashboard 手配 10 req/min/IP，本期 RUNBOOK 占位段落 | ✓ |
| 自实现限速代替 WAF | KV/DO 计数，过度工程 | |
| 跳过，不做 WAF | 违反 PUBSEC-03 | |

**User's choice:** 手配 + 写进 RUNBOOK

---

## 收口

| Option | Description | Selected |
|--------|-------------|----------|
| 再深挖几个灰色区 | ADMIN_GITHUB_ID 格式、favicon noindex、本地开发 get-session 端口等 | |
| 可以写 CONTEXT 了（推荐） | 四个区决策已清，进入写作 | ✓ |

**User's choice:** 可以写 CONTEXT 了

---

## Claude's Discretion

这些决策交由 planner 在 PLAN 阶段选择，不阻塞本期 CONTEXT：

- `ADMIN_GITHUB_ID` env 具体格式（单值 vs 逗号列表）
- L1 session 缓存的数据结构（`Map` vs `LRUCache`）与具体 key schema
- `useAuthGuard` 放置位置（`packages/ui` vs 各 app 本地）
- Gateway `/robots.txt` 路由放 `index.ts` 主分支首位还是拆 `robots.ts`
- `_redirects` 是否需要 append 而非覆盖
- `X-Robots-Tag` 注入位置（proxy 函数内 vs `cachedProxy` 外层装饰）
- Better Auth `user` 对象里 `githubId` 的具体字段名（需 researcher 确认 1.6.10 + GitHub provider 行为）
- `apps/dashboard/src/router/index.ts` 里 `redirect` vs 新 `next` 参数的双支持策略

## Deferred Ideas

- API 401 拦截器兜底方案（Phase 5 Sentry 时再看）
- Modal 登录 / UI 占位锁图标（单用户场景不值）
- `serviceAuth` → `requireAuth + requireResource` 迁移（Phase 1 deferred 继续 deferred）
- 自实现限速中间件（过度工程）
- 成人内容 PIN 门控（v2 GATE-01）
- Dashboard 手动标注 isR18 的复核入口（v2 GATE-02）
- Better Auth hooks 把 ADMIN_GITHUB_ID 写回 DB role（当前路径关闭，多管理员时可复活）
- `/robots.txt` 里的 sitemap 行（SEO 已排除，不需要）
- favicon / opengraph 的 noindex 处理（静态资源无需）
- 各前端登录后的 `location.href = next` vs Vue Router push（planner 按场景选）

---

*Discussion log: 2026-05-11*
