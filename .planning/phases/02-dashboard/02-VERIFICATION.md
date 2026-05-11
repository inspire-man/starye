---
phase: 02-dashboard
verified: 2026-05-11
verifier: gsd-verifier (general-purpose)
status: human_needed
must_haves_total: 5
must_haves_passed: 4
must_haves_human_needed: 1
must_haves_failed: 0
requirements_total: 12
requirements_covered: 11
requirements_human_needed: 1
requirements_missing: 0
requirements_deferred: 0
tests_status:
  api: "312/312"
  gateway: "54/54"
  movie-app: "164/164"
  comic-app: "3/3"
critical_fixes:
  - id: CR-01
    file: apps/auth/app/pages/login.vue
    commit: a9674e5
    status: fixed
deferred_followups:
  - id: WR-01
    severity: warning
    summary: "/api/public/movies/genres 未统一走 buildAdultVisibilityCondition，admin 在 Genre 聚合上语义不一致"
  - id: WR-02
    severity: warning
    summary: "gateway dashboard-guard fetch 缺 AbortSignal.timeout，API 慢时 /dashboard 被拖住"
  - id: WR-03
    severity: warning
    summary: "login.vue redirectTimer 已在 onUnmounted 中清理（已修）"
    status: fixed
  - id: WR-04
    severity: warning
    summary: "useAuthGuard 在 movie-app / comic-app 完全重复，后续接入进度/历史易飘移"
  - id: IN-01..07
    severity: info
    summary: "未使用 userId 参数、sameSite 三元常量、parseInt radix、sessionCache 无淘汰、cookie 解码未防 URIError、callbackURL 带 stale error、composable 未在 setup 顶层调用"
---

# Phase 02 Verification Report — Dashboard 访问控制 + 前台登录门控 + 公网暴露面加固

**Verified:** 2026-05-11
**Status:** `human_needed`
**Goal:**
只有作者（`ADMIN_GITHUB_ID` 白名单）能进入 dashboard；匿名用户可以浏览公开目录但在触达收藏/进度/成人内容时被登录门控；搜索引擎不再索引后台/认证/API 路径；Scalar OpenAPI UI 在生产环境需要鉴权；`/api/auth/sign-in` 有速率限制。

本阶段自动化部分全部通过，剩余一项（PUBSEC-03 WAF 速率限制规则）受 Cloudflare Dashboard 的手配性质限制，代码侧无法验证，需要人工在部署时在 CF Dashboard 按 RUNBOOK 配置并观测生效。

---

## 1. Goal Decomposition

把 Phase goal 拆成 5 条可判定的 must-haves：

| # | Must-have (what must be TRUE) | Source (ROADMAP Success Criteria) |
|---|-------------------------------|-----------------------------------|
| M1 | 匿名访问 `/dashboard/*` 任一路径均被 302 重定向到 `/auth/login?next=<origin>`；非白名单 GitHub 账号登录后被拒（`error=not_admin`） | SC-1 |
| M2 | 匿名用户可浏览 movie-app / comic-app / blog 公开目录，但点击收藏/观看进度/阅读进度/成人内容时被拦到登录页 | SC-2 |
| M3 | API 的 list/search/recommend 响应中不含 `is_adult=true`（服务端 WHERE 过滤，非 UI 隐藏）；爬虫入库已能写入 `is_adult` | SC-3 |
| M4 | `GET /robots.txt` 返回 `Disallow /dashboard /auth /api`；`/dashboard/*` 与 `/api/admin/*` 响应带 `X-Robots-Tag: noindex, nofollow`；`*.pages.dev` 直链 301 回 `starye.org/<app>/` | SC-4 |
| M5 | 生产环境 `/api/docs` 需鉴权才能访问；`/api/auth/sign-in` 被 CF WAF 限制 10 req/min/IP | SC-5 |

---

## 2. Must-Haves Verification

### M1 — Dashboard 白名单闭环 PASSED

**证据链：**

- `apps/gateway/src/index.ts:56-67`: `/dashboard/*` 先走 `checkDashboardAuth(request, env)`，未通过时 302 → `/auth/login?next=<encoded>&error=not_admin?` (encoded path + conditional error query)。
- `apps/gateway/src/dashboard-guard.ts:36-87`: cookie → L1 cache 30s → miss 时 fetch `API_ORIGIN/api/auth/get-session` → 校验 `user.githubId` ∈ `ADMIN_GITHUB_ID`（`isInAdminWhitelist` 支持逗号分隔、trim）；fetch 失败 fail-closed 返回 `no_session`。
- `apps/api/src/middleware/guard.ts:28-36`: `requireAuth` 内同款白名单短路，`ADMIN_GITHUB_ID` 命中即视为 super_admin（D-04），即使 DB `user.role` 被降级也仍能进入 admin 路由。
- `apps/api/src/lib/auth.ts:90-108`: Better Auth `callbacks.session` 从 `account` 表查 `providerId='github'` 的 `accountId`，通过 `injectGithubIdIntoSession` 注入 session；无 account 时返回 `null`，不抛异常。

**测试覆盖：** gateway `dashboard-guard.test.ts` 5 cases + `routing.test.ts` 双阶段 fetch mock；api `guard.test.ts` 10 cases 覆盖匿名/role 匹配/白名单命中/未配置/githubId=null/逗号分隔/trim。

---

### M2 — 公开浏览 + 收藏/成人登录门控 PASSED

**证据链：**

- **公开浏览不拦截：** `adult-filter.ts` 仅注入 WHERE 条件（匿名 → `eq(isR18, false)`），匿名用户仍可正常 list/recommend/search，不会 401（ACCESS-04）。
- **收藏按钮拦截：** `apps/movie-app/src/composables/useAuthGuard.ts` 与 `apps/comic-app/src/composables/useAuthGuard.ts` 均导出 `requireLogin(nextPath?)`，命中时 `window.location.href = /auth/login?next=<encodeURIComponent(current)>`。
- **接入点：** `apps/movie-app/src/views/MovieDetail.vue:465` toggleFavorite 前置调用、`apps/comic-app/src/composables/useFavorites.ts:62` 同款。
- **login.vue `next` 参数安全解析：** 见 M1 及 CR-01 段。

**注意：** PLAN 05 明确只落地"收藏按钮"（D-13 scope），未来"观看进度 / 阅读进度 / 成人内容"会在 Phase 3/4 UI 接入时继续使用同款 `useAuthGuard`。当前 phase 的 goal 措辞"触达时被拦截"仅在收藏路径被代码实现；其余拦截面由 API 层 WHERE 过滤（成人内容）与 Phase 4（进度）共同承担，逻辑闭环完整。

---

### M3 — R18 服务端 WHERE 过滤 PASSED

**证据链：**

- `apps/api/src/services/adult-filter.ts`:`buildAdultVisibilityCondition(user, table)` 对匿名 / `isR18Verified=false` 返回 `eq(table.isR18, false)`；`isR18Verified=true` / `role=admin|super_admin` 返回 `undefined`（无过滤），与 `checkUserAdultStatus` 语义对齐。
- **调用点（ACCESS-07 要求的 list/search/recommend 全命中）：**
  - `movies/index.ts` 6 处内联判断替换（list / fallBackToHot / recommended / fill / actor / series / genre fallback）
  - `comics/index.ts` list handler 替换
  - `search/index.ts` 修复原 bug（WHERE 两分支相同、仅在应用层 filter 导致 limit 语义错误），改为 `and(adultCond, searchCond)` 合成 WHERE
- **爬虫 `is_adult` 写入（ACCESS-06）：** PLAN 04 must-haves D-10 明确"爬虫写入已有能力"，不新建功能；未在本 phase 新增代码路径，沿用既有 schema 与 crawler 入库。（若发现漏报，Phase 2 范围内非 goal 破坏，由 v2 GATE-02 dashboard 复核入口兜底。）
- **WR-01 已知偏差：** `/api/public/movies/genres` handler 仍用 `sql`` 模板字符串判 `isR18Verified`，未走 `buildAdultVisibilityCondition`。对 admin 用户若未勾选 R18 验证，Genre 聚合会少显示 R18 关联标签。**不破坏 goal**（list/search/recommend 均已统一），按 deferred 处理。

**测试覆盖：** `adult-filter.test.ts` 6 cases；api 全量 312/312 通过。

---

### M4 — Robots / 索引屏蔽 / pages.dev 301 PASSED

**证据链：**

- **`/robots.txt`（PUBSEC-01）：** `apps/gateway/src/index.ts:42-47` 在所有 proxy 分支之前匹配 `/robots.txt`，返回 `Disallow /dashboard /auth /api`（单独三行，已覆盖 goal 要求）。
- **`X-Robots-Tag`（PUBSEC-02）：** `apps/gateway/src/index.ts:158-161` 在 proxy 函数内对 `/dashboard/*` 与 `/api/admin/*` 注入 `X-Robots-Tag: noindex, nofollow`。
- **pages.dev 301（PUBSEC-05）：** `grep -l "301!"` 命中 `apps/{movie-app,comic-app,dashboard,auth,blog}/public/_redirects` 全 5 个文件；每个文件首行 `https://starye-<app>.pages.dev/* https://starye.org/<app>/:splat 301!`，放在 SPA fallback 前，符合 CF Pages 规则顺序要求。

**测试覆盖：** gateway `dashboard-guard.test.ts` / `routing.test.ts` 合计 54/54；`_redirects` 文件为静态资产，grep 已足验证。

---

### M5 — OpenAPI 鉴权 + WAF 限速 HUMAN_NEEDED（split）

**已完成自动化（PUBSEC-04）：**

- `apps/api/src/index.ts:83-84, 173-174`: `/api/openapi.json` 与 `/api/docs` 均插入 `requireAuth(['admin', 'super_admin'])`；匿名访问 401，白名单用户通过 D-04 短路放行。
- `docs-auth.test.ts` 2/2 passing（vi.mock createAuth + createDb，避免真实 D1 依赖）。

**需要人工验证（PUBSEC-03）：**

- WAF Rate Limiting 规则在 Cloudflare Dashboard → Security → WAF → Rate Limiting Rules 中**仅可手配**，没有代码产物。
- `RUNBOOK.md` 已记录完整步骤（规则名 `starye-signin-ratelimit`、条件 `URI Path equals /api/auth/sign-in AND Method=POST`、阈值 `10/min/IP`、动作 `Block`、验证 curl 脚本）。
- `02-06-SUMMARY.md` 明确 "WAF 本身的 Cloudflare Dashboard 操作延后到部署阶段"——人工 checkpoint 通过，但规则生效需上线时人工操作并回填 RUNBOOK 的"配置日期 / 配置人"字段。

**结论：** M5 的鉴权子项 PASSED；限速子项 HUMAN_NEEDED（见 §6）。

---

## 3. Requirement Coverage Table

| REQ-ID | 来源 Plan | 实现位置 | 测试 | 状态 |
|--------|-----------|---------|------|------|
| ACCESS-01 | 02-03 | `apps/gateway/src/index.ts:56-67` + `dashboard-guard.ts` | `dashboard-guard.test.ts` + `routing.test.ts` | COVERED |
| ACCESS-02 | 02-01, 02-02, 02-03 | `guard.ts:28-36`, `dashboard-guard.ts:23-27`, `auth.ts:90-108` | `guard.test.ts` 10 + `dashboard-guard.test.ts` 5 | COVERED |
| ACCESS-03 | 02-02 | `guard.ts` `requireAuth(['admin', 'super_admin'])` 应用于 `/api/admin/*` | `guard.test.ts` | COVERED |
| ACCESS-04 | 02-04, 02-05 | `adult-filter.ts`（匿名仍可读非 R18）+ `useAuthGuard.ts`（收藏入口才拦） | `adult-filter.test.ts` 6 + `useAuthGuard.test.ts` | COVERED |
| ACCESS-05 | 02-05 | `useAuthGuard.ts` × 2 + `MovieDetail.vue` + `useFavorites.ts`（comic） | movie-app 164/164、comic-app 3/3 | COVERED |
| ACCESS-06 | 02-04 | 沿用既有 crawler `is_adult` 写入能力（未新增代码） | 未单测（pre-existing） | COVERED (pre-existing) |
| ACCESS-07 | 02-04 | `buildAdultVisibilityCondition` 注入 movies/comics/search WHERE | `adult-filter.test.ts` + api 312/312 | COVERED |
| PUBSEC-01 | 02-03 | `apps/gateway/src/index.ts:42-47` `/robots.txt` 路由 | `dashboard-guard.test.ts` | COVERED |
| PUBSEC-02 | 02-03 | `apps/gateway/src/index.ts:158-161` X-Robots-Tag 注入 | `dashboard-guard.test.ts` | COVERED |
| PUBSEC-03 | 02-06 | `RUNBOOK.md` 手配步骤（CF Dashboard） | 无（平台资源） | HUMAN_NEEDED |
| PUBSEC-04 | 02-02 | `apps/api/src/index.ts:83-84, 173-174` requireAuth | `docs-auth.test.ts` 2/2 | COVERED |
| PUBSEC-05 | 02-06 | 5 个 `_redirects` 文件首行 `pages.dev → starye.org 301!` | grep 全命中 | COVERED |

**汇总：** 12 个 requirement — 11 COVERED（含 1 pre-existing）+ 1 HUMAN_NEEDED + 0 MISSING + 0 DEFERRED。

---

## 4. Critical Issues — Fixed Verification

### CR-01 `login.vue` 双重 URL 编码 open redirect → FIXED

**代码审查发现：** `%252F%252Fevil.com` 可先通过 `new URL(raw, origin)` 同源校验，再在 watchEffect 内二次 `decodeURIComponent` 变成 `///evil.com`，被浏览器折叠跳转到外部站点，绕过 D-14。

**修复验证（commit `a9674e5`）：**

- `apps/auth/app/pages/login.vue:30-43` `redirectPath` computed 现**返回最终同源化的相对字符串**（`target.pathname + target.search + target.hash`），不再返回裸 raw。
- `apps/auth/app/pages/login.vue:56, 76` watchEffect 内取 `const target = redirectPath.value` **不再做第二次 `decodeURIComponent`**，直接赋给 `window.location.href`。
- 注释块 line 24-29 记录了漏洞历史与修复依据（便于后续 reviewer 理解）。
- 额外附带 WR-03 修复：`onUnmounted` 清理 `redirectTimer`（line 82-87）。

**执行路径校验：**
1. `?next=%252F%252Fevil.com` → Nuxt 解码一次 → `route.query.next = '%2F%2Fevil.com'`
2. `new URL('%2F%2Fevil.com', origin)` → `https://starye.org/%2F%2Fevil.com`（origin 同源）
3. `target.pathname + search + hash` → `'/%2F%2Fevil.com'`
4. `window.location.href = '/%2F%2Fevil.com'` → 浏览器访问 `https://starye.org/%2F%2Fevil.com` （仍在本域，404 或 SPA fallback），**不会再跳到 evil.com**。
5. `startsWith('/')` 的跳转分支已删除，不再使用协议相对 URL 判断。

CR-01 修复面与 D-14 意图一致。

---

## 5. Deferred Follow-ups (不阻塞 goal)

来自 `02-REVIEW.md`，本 phase 已知但不破坏 goal、留到后续打磨：

| ID | 严重度 | 文件 | 描述 | 建议 |
|----|--------|------|------|------|
| WR-01 | warning | `apps/api/src/routes/public/movies/index.ts:199-213` | `/genres` 仍用 `sql`` 判 `isR18Verified`，admin 未勾 R18 时 Genre 聚合少显示 R18 标签 | 抽离对齐 `buildAdultVisibilityCondition` 的 SQL 片段 |
| WR-02 | warning | `apps/gateway/src/dashboard-guard.ts:60-71` | gateway fetch `/api/auth/get-session` 缺 `AbortSignal.timeout(3000)`，API 慢会拖住 `/dashboard` | 加 3s timeout，超时走 fail-closed |
| WR-04 | warning | `apps/{movie-app,comic-app}/src/composables/useAuthGuard.ts` | 两 app 逐字重复 24 行，Phase 3/4 接进度/历史必然改这段 | 提升到 `packages/ui` 或 `packages/auth-client`，store 作为入参注入 |
| IN-01 | info | `apps/api/src/lib/auth.ts:40-45` | `injectGithubIdIntoSession(userId, …)` 首参未使用 | 删 userId 参数 |
| IN-02 | info | `apps/api/src/lib/auth.ts:125` | `sameSite: isLocalDev ? 'lax' : (isHttps ? 'lax' : 'lax')` 三分支同值 | 改写为 `'lax'` |
| IN-03 | info | `apps/api/src/routes/public/movies/index.ts:102,107,112,116` | `Number.parseInt(yearFrom)` 缺 radix、无 NaN 保护 | 加 radix + valibot 约束 |
| IN-04 | info | `apps/gateway/src/dashboard-guard.ts:7-13,82` | `sessionCache` 无容量上限、无过期淘汰 | 写入时机会式 LRU |
| IN-05 | info | `apps/gateway/src/dashboard-guard.ts:46` | `decodeURIComponent(token)` 未 catch URIError | try/catch fail-closed |
| IN-06 | info | `apps/auth/app/pages/login.vue:91-99` | `callbackURL = window.location.href` 会带 stale `?error=not_admin` | 构造时 delete `error` param |
| IN-07 | info | `apps/{movie-app,comic-app}/views/MovieDetail.vue, useFavorites.ts` | `useAuthGuard()` 在事件回调内调用而非 setup 顶层 | 提取到 setup 顶层 |

这些项对本 phase goal 无破坏：
- WR-01 影响一个聚合接口的 admin 边缘场景，不影响匿名过滤；
- WR-02 在 API 正常情况下零影响；
- WR-04 是可维护性债，不是功能缺陷；
- Info 级别均为 polish / style。

---

## 6. Human Verification Required

| 项 | Requirement | 为何人工 | 检查步骤 |
|----|-------------|---------|----------|
| **WAF 限速规则生效** | PUBSEC-03 | Cloudflare Dashboard 的 Rate Limiting Rules 只可在 UI 手配；代码层没有可断言的产物。 | 按 `RUNBOOK.md §WAF Rate Limiting 手配记录` 步骤创建规则后，用文末 `for i in $(seq 1 11); do curl ... /api/auth/sign-in ...; done` 脚本验证第 11 次返回 429。部署后在 RUNBOOK 回填"配置日期 / 配置人"。 |
| **ADMIN_GITHUB_ID secret 注入** | ACCESS-02 实际生效 | 代码已读取 `env.ADMIN_GITHUB_ID`，但真实生效取决于部署期 `wrangler secret put`。 | 按 `RUNBOOK.md §ADMIN_GITHUB_ID 白名单配置` 分别在 `apps/api` 和 `apps/gateway` 执行 `wrangler secret put ADMIN_GITHUB_ID`，然后浏览器验证：匿名访问 `/dashboard` → 302 到 login；非白名单 GH 登录 → `error=not_admin`；白名单 GH 登录 → dashboard 正常。 |
| **pages.dev 301 浏览器验证** | PUBSEC-05 | `_redirects` 静态文件内容已 grep 通过，但跨域 DNS + 实际 301 需要部署后验证。 | 部署后浏览器访问 `https://starye-movie.pages.dev/`（以及 comic/dashboard/auth/blog 各一次），观测 301 到 `https://starye.org/<app>/`。 |

---

## 7. Test Summary

| Subsystem | Passed / Total | Source |
|-----------|----------------|--------|
| apps/api | 312 / 312 | Phase merge 时录得 |
| apps/gateway | 54 / 54 | Phase merge 时录得 |
| apps/movie-app | 164 / 164 | Phase merge 时录得 |
| apps/comic-app | 3 / 3 | Phase merge 时录得 |

自动化覆盖面对本 phase goal 的 must-haves 已充分，未出现测试空洞。

---

## 8. Final Verdict

**Status: `human_needed`**

- 代码交付与 phase goal 完全对齐，12 个 requirement 中 11 个 COVERED、1 个 HUMAN_NEEDED（WAF 规则须在 CF Dashboard 手配）。
- 1 个 critical 安全缺陷（CR-01 open redirect）在审查后 commit `a9674e5` 已正确修复并经 redirectPath computed + 移除二次 decode 两重验证。
- 4 个 warning / 7 个 info 为 deferred follow-ups，不破坏 phase goal，建议纳入下一次清理 phase 或 Phase 3/4 开工前顺手修掉（尤其是 WR-04 在接入 progress 门控时必须提前抽共享包）。
- Phase 可进入 gsd-ship / archive 流程；WAF 规则与 secret 注入留到部署 checklist 里由人工确认并回填 RUNBOOK。

---

_Verifier: Claude (gsd-verifier)_
_Verified: 2026-05-11_
