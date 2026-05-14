---
phase: 02
slug: dashboard
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-14
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser -> Gateway `/dashboard/*` | 访问 dashboard 的请求先经过 Gateway 白名单与 session 校验，未授权请求不得到达 Pages 源站 | session cookie、`next` 跳转路径、dashboard 页面响应 |
| Browser -> API `/api/docs` / `/api/openapi.json` | OpenAPI 文档仅对白名单/管理员开放，匿名用户不得看到 API 结构 | session cookie、OpenAPI schema、Scalar UI |
| Browser -> API public routes | 匿名用户可访问公开目录，但 R18 数据必须在 WHERE 层收口，不能依赖前端隐藏 | movie/comic/search 结果、R18 标志位 |
| Browser route query -> `/auth/login` | `next` / `redirect` 参数来自 URL，必须阻断跨域跳转 | 登录回弹目标路径、错误参数 |
| `*.pages.dev` -> `starye.org/<app>/` | Pages 原始域名必须强制 301 回统一主域，避免绕过 Gateway 策略 | 跨域重定向目标、原始 Pages 入口 |
| Operator -> Cloudflare Dashboard / Wrangler secrets | WAF 限速与 `ADMIN_GITHUB_ID` 生效依赖平台配置，不在 git 中明文保存 | `starye-signin-ratelimit` 规则、`ADMIN_GITHUB_ID` secret |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 | Elevation of Privilege | Better Auth session callback + API/Gateway 白名单判断 | mitigate | `githubId` 注入通过 Drizzle 参数化查询实现；`requireAuth` 与 `dashboard-guard` 均以 `String()` + `split(',').map(trim)` 做白名单短路；Gateway L1 cache 以完整 session token 为 key，避免用户混淆。 | closed |
| T-02-03 | Spoofing | `next` 参数 open redirect | mitigate | `apps/auth/app/pages/login.vue` 的 `redirectPath` 通过 `new URL(raw, origin)` 做同源校验，并移除二次 `decodeURIComponent`；Gateway 自身只拼接本地 `pathname + search`。 | closed |
| T-02-04 | Information Disclosure | R18 内容经 public routes 泄漏 | mitigate | `buildAdultVisibilityCondition` 在 movies/comics/search 的 WHERE 层统一收口；匿名与未验证用户只能看到 `isR18 = false`，search 应用层过滤 bug 已消除。 | closed |
| T-02-05 | Security Feature Bypass | `*.pages.dev` 绕过 Gateway | mitigate | 5 个已存在 Pages app 的 `_redirects` 首行均已加入 `301!` 规则，强制回到 `starye.org/<app>/`，并通过 UAT 确认浏览器行为正确。 | closed |
| T-02-06 | Information Disclosure | `/api/docs` / `/api/openapi.json` 暴露 API 结构 | mitigate | 两条路由都已挂 `requireAuth(['admin', 'super_admin'])`，匿名访问 401，白名单账号可通过 D-04 白名单短路访问。 | closed |
| T-02-07 | Denial of Service | `/api/auth/sign-in` 暴力破解 | mitigate | Cloudflare WAF Rate Limiting 规则 `starye-signin-ratelimit` 已按 RUNBOOK 手配并在 Phase 2 UAT 中确认通过；持续运维依赖 Cloudflare 平台配置留存。 | closed |
| T-02-08 | Information Disclosure | `githubId` 字段暴露 | accept | `githubId` 本身是公开的 GitHub 账号标识，仅出现在已登录 session payload 中；该信息泄露面相对较低，且是白名单判定所必需。 | closed |
| T-02-09 | Denial of Service | `account` 表查询性能 | accept | 当前仓库内未能证明 `account.user_id` 存在显式索引；考虑到单作者/低并发使用场景，这一查询成本暂时接受，并留待后续 schema/ops phase 统一补强。 | closed |
| T-02-10 | Tampering | `ADMIN_GITHUB_ID` 注入攻击 | mitigate | `ADMIN_GITHUB_ID` 通过 `wrangler secret put` / `.dev.vars` 注入，未在 `wrangler.toml` 或 git 历史中明文保存。 | closed |
| T-02-11 | Denial of Service | Gateway L1 session cache 无上限增长 | accept | 当前是单作者使用场景，token 数量极少；Cloudflare Worker 内存上限天然限制了这一风险，且该缓存只是一层 best-effort 加速。 | closed |
| T-02-12 | Information Disclosure | search handler 应用层过滤绕过 | mitigate | `public/search` 已改为 `and(adultCond, searchCond)` 的 WHERE 层过滤，并删除 `.filter(m => !m.isR18)`。 | closed |
| T-02-13 | Elevation of Privilege | admin / super_admin 可见全部 R18 内容 | accept | 这是本 phase 的产品与权限模型既定语义：管理员即作者本人，应当可见全部内容。 | closed |
| T-02-14 | Spoofing | `useAuthGuard` 构造的 `next` 参数 | accept | `next` 由当前页面 `pathname + search` 拼接，不接受外部自由输入；最终同源校验仍由 `login.vue` 兜底。 | closed |
| T-02-15 | Elevation of Privilege | 绕过前端 `requireLogin` 直接访问 API | accept | 组件层拦截只是 UX 层门控，真正的安全边界仍在 API `requireAuth` 与服务端过滤；直接调 API 仍会被后端拒绝。 | closed |
| T-02-16 | Security Feature Bypass | `_redirects` 规则顺序错误 | mitigate | `_redirects` 中的 `301!` 规则位于 SPA fallback 之前，并已通过文件检查与浏览器 UAT 验证。 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Threat ID | Risk | Rationale |
|-----------|------|-----------|
| T-02-08 | `githubId` 出现在已登录 session 中 | GitHub 数字 ID 属于公开标识，且是 Phase 2 白名单判定的必要字段。 |
| T-02-09 | `account.user_id` 查询路径缺少显式索引证据 | 当前部署形态为单作者低并发，Better Auth session 查询频率与数据规模有限；在后续 schema/ops phase 再统一补强索引或性能证据。 |
| T-02-11 | Gateway L1 session cache 无显式容量上限 | 单用户场景 + Worker 128MB 内存上限使实际风险较低，当前收益大于治理成本。 |
| T-02-13 | admin / super_admin 不受 R18 WHERE 过滤 | 这是产品语义的一部分，管理员即内容维护者，应当可见全部 R18 内容。 |
| T-02-14 | `useAuthGuard` 自行拼接 `next` 参数 | 参数源自当前页面，不接受外部任意输入；`login.vue` 同源校验提供最终兜底。 |
| T-02-15 | 绕过前端门控直接打 API | 前端门控只改善 UX，不承担最终鉴权责任；服务端 `requireAuth` / R18 过滤已是实际安全边界。 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-14 | 15 | 14 | 1 | Codex (`$gsd-secure-phase 2`) |
| 2026-05-14 | 15 | 15 | 0 | Codex (`$gsd-secure-phase 2`, accepted remaining open threat) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-14
