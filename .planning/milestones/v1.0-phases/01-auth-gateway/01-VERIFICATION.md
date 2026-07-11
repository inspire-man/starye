---
phase: 01-auth-gateway
verified: 2026-05-11T13:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: not_applicable
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 1: Auth 全链路 + Gateway 缓存安全基线 Verification Report

**Phase Goal:** 作者登录一次后，在所有子应用（dashboard/movie/comic/blog/auth）任意路径、任意刷新、任意 Nuxt SSR 页面都保持登录状态；gateway KV 缓存不会把已登录用户的私有响应泄漏给匿名访客或其他用户
**Verified:** 2026-05-11T13:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria 实锚)

| # | Truth (ROADMAP Phase 1 Success Criteria) | Status | Evidence |
|---|-------------------------------------------|--------|----------|
| SC-1 | 作者在任一前端登录后，刷新 / 跨子路径 / 进入 Nuxt SSR 页均保持登录 | VERIFIED | 自动化：`apps/blog/e2e/session.spec.ts` 3 条活用例（D-01 SSR HTML 含 user-1、D-03 3s 超时降级 null、D-04 SSR==1 + total≤2）+ `apps/dashboard/e2e/auth-crosspath.spec.ts`（sessionRequests ≥ 1 + 可选 [data-user-id]==='user-1'）。手动：D-19 step 3+4+5 已签字 pass（2026-05-11）。关键代码：`apps/blog/server/middleware/session.ts` + `apps/auth/server/middleware/session.ts` 做 SSR cookie forward + event.context.session 注入；`apps/blog/app/plugins/session.ts` + `apps/auth/app/plugins/session.ts` 把 SSR 结果 seed 到 `useState('session')` 消除闪烁。 |
| SC-2 | 登出后服务端 session 立即失效，所有前端刷新即回匿名 | VERIFIED | 自动化：`apps/api/src/routes/auth/__tests__/signout.test.ts` 3 条 D-15 用例全绿（POST /sign-out → 200 + Set-Cookie Max-Age=0；getSession → null；正则匹配 `starye.session_token=`）。手动：D-19 step 6 已签字 pass。已知局限：单测基于 mock authInstance.handler（Plan 05 决策），WR-07 已延期到 Phase 2 做 integration（见 deferred-items DI-08）。 |
| SC-3 | 带 Cookie / Authorization 的请求默认 bypass KV；匿名永不读到他人缓存 | VERIFIED | `apps/gateway/src/__tests__/cache-middleware.test.ts` D-11 #2 / #3 / #5 共 3 条活用例：带 cookie/authorization 的 `/api/movies` 响应 BYPASS + X-Cache-Reason=auth-headers + Cache-Control 含 no-store 不含 public（CR-01 修复）+ X-Cache-TTL null（WR-02 修复）+ calls 递增（不写 KV）。D-11 #5 Set-Cookie 响应降级 private, no-store（CR-02 修复）。 |
| SC-4 | /api/auth/* 全路径不落 KV；Set-Cookie 透传；cookie domain 正确 | VERIFIED | 自动化：D-11 #4 活用例覆盖 `/api/auth/get-session` 有无 cookie 两档（BYPASS + X-Cache-Reason=no-store-path / auth-headers）。NO_STORE_PREFIXES 含 `/api/auth`（`apps/gateway/src/cache-middleware.ts:56`）。手动：D-19 step 2 已签字，DevTools 观测 `starye.session_token=` + `Domain=starye.org`（D-05 语义等价接受无前导点）+ `SameSite=Lax` + `Secure`（HTTPS）+ `Path=/` + Set-Cookie 不重复（1.6.10 修复）。 |
| SC-5 | better-auth 升级到 ^1.6.10 并通过登录 / 登出 / 刷新冒烟 | VERIFIED | 4 个 package.json 均含 `"better-auth": "^1.6.10"`（api:23 / auth:18 / blog:22 / dashboard:29）；pnpm-lock.yaml 含 4 处 `better-auth@1.6.10` 条目（1x 顶级版本 + 3x 传递依赖解析哈希）。Plan 04 全仓回归：9 turbo type-check / 652/652 tests / 10 builds 全绿。`apps/api/src/lib/auth.ts` 与 `middleware/auth.ts` zero diff。D-19 六步冒烟全绿。 |

**Score:** 5/5 ROADMAP Success Criteria verified

### Must-Haves (PLAN frontmatter 聚合，Requirements 维度)

| # | Requirement | Truth | Status | Evidence |
|---|-------------|-------|--------|----------|
| MH-1 | AUTH-01 5 端 session 互通 | 跨 app 可读同一 session | VERIFIED | dashboard e2e 活用例（sessionRequests ≥ 1）+ blog SSR e2e + D-19 step 4 手动签字。Plan 03 Nuxt SSR 通道 + Plan 02 Gateway 透传配合。 |
| MH-2 | AUTH-02 Nuxt SSR 读 session | event.context.session 被赋值 | VERIFIED | `apps/blog/server/middleware/session.ts` + `apps/auth/server/middleware/session.ts` 字节等价；D-01 e2e 活用例断言 HTML 含 user-1；D-03 活用例断言超时降级 null；D-19 step 5 view-source 签字 pass。`headers: { cookie }` 仅 pick cookie（T3 缓解，grep 验证命中 1 次/文件）；`baseURL: apiUrl` 走 gateway（D-02）；`AbortSignal.timeout(3000)` 超时降级（D-03）。 |
| MH-3 | AUTH-03 cookie 属性 | domain/SameSite/Secure/Path 正确 | VERIFIED (override-equivalent) | `apps/api/src/lib/auth.ts:97-106` advanced.cookiePrefix='starye' / sameSite='lax' / secure=isHttps / path='/' / domain=`hostname.replace('www.', '')` → `starye.org`（无前导点）。Plan 04 全仓回归后 git diff apps/api/src/lib/auth.ts 零变更。D-05 CONTEXT 决策明示接受 "domain=starye.org" 为语义等价实现（RFC 6265 下现代浏览器处理等价）。D-19 step 2 DevTools 观测 Set-Cookie 5 属性全绿（2026-05-11 签字）。 |
| MH-4 | AUTH-04 better-auth ^1.6.10 | 四 package.json + lockfile 同 commit | VERIFIED | grep 确认：4 个 package.json 全部 `^1.6.10`（0 处残留 `^1.6.2`）；pnpm-lock.yaml 有 4 行 `better-auth@1.6.10` 引用。Plan 04 commit `6f902a7` 单 commit 守 D-18。Turbo pipeline 回归 652/652 tests + 10 builds + 9 type-checks 全绿。 |
| MH-5 | AUTH-05 Gateway Cookie / Set-Cookie 透传 | 原样透传 | VERIFIED | `apps/gateway/src/index.ts` 零改动（Plan 02 objective 明示）；cache-middleware 的 Set-Cookie 响应路径经 CR-02 修复后下发 `private, no-store` + bypassReason 'set-cookie-response'；D-11 #5 断言 Cache-Control 含 no-store / 不含 public / X-Cache-TTL null。D-09 防线保留（`shouldCacheResponse` at cache-middleware.ts:236-244 对 Set-Cookie 响应返回 false）。 |
| MH-6 | AUTH-06 /api/auth/* 不落 KV | NO_STORE_PREFIXES 命中 | VERIFIED | `apps/gateway/src/cache-middleware.ts:56` NO_STORE_PREFIXES 含 `/api/auth`；L132-140 resolveBasePolicy 中 `/api/auth` 路径返回 scope=bypass + shouldStore=false + bypassReason='no-store-path'。D-11 #4 活用例双 case 覆盖（无 cookie → no-store-path；带 cookie → auth-headers 优先级覆盖）。 |
| MH-7 | AUTH-07 Cookie/Auth 请求 bypass | hasAuthHeaders 检测生效 | VERIFIED | `apps/gateway/src/cache-middleware.ts:187` hasAuthHeaders 检测 cookie/authorization 双头；L190 shouldStore 翻 false；L196 bypassReason='auth-headers'；L213-218 CR-01 修复 public 基线翻 bypass 时 Cache-Control 降级为 'private, no-store'。D-11 #2 / #3 活用例断言 BYPASS + calls 递增 + X-Cache-Reason=auth-headers + Cache-Control 含 no-store + X-Cache-TTL null。 |
| MH-8 | AUTH-08 sign-out 服务端失效 | Set-Cookie 清除 + D1 session 删 | VERIFIED | `apps/api/src/routes/auth/__tests__/signout.test.ts` 3 条 D-15 用例全绿（Vitest run 确认 3 passed / 2.54s）；Plan 04 的 1.6.7 修复使 APIError 场景下 Set-Cookie 仍下发，1.6.10 消除重复 Set-Cookie。D-19 step 6 手动签字（含跨 tab 自然回收 D-16 / 不引入 BroadcastChannel D-17）。已知局限（WR-07/DI-08）：单测为 mock handler 模式，integration smoke 延期到 Phase 2。 |

**Score:** 8/8 Requirements (AUTH-01..08) verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/gateway/src/cache-middleware.ts` | header-bypass + X-Cache-Reason + CR-01/02 修复 | VERIFIED | 1002 B+；`hasAuthHeaders` 命中 1 次（L187）；`bypassReason` 贯穿类型 / CachePolicy / resolveBasePolicy / resolveCachePolicy / decorateResponse / createCachedProxy；CR-01 fix at L213-218 public→bypass 时 Cache-Control='private, no-store'；CR-02 fix at L441-449 Set-Cookie 响应降级；WR-01 fix public-pages bypassReason='non-cacheable-group' at L170；WR-02 fix at L372 X-Cache-TTL 仅在非 BYPASS 注入。`'private'` scope 字符串 0 次、`PRIVATE_CACHE_PREFIXES` 0 次、`'favorites'` CacheGroup 已移除 —— D-12/D-13/D-14 私有 scope 代码路径物理清零。 |
| `apps/gateway/src/__tests__/cache-middleware.test.ts` | D-11 #1..#5 活用例 | VERIFIED | 9 passed / 0 failing（vitest 确认，582ms）；5 条 D-11 活用例（#1 baseline MISS→HIT、#2 cookie BYPASS、#3 authorization BYPASS、#4 /api/auth/* BYPASS 双 case、#5 CR-02 Set-Cookie→private,no-store）。既有 favorites 私有 scope 测试已删除（grep `isolates favorites cache per user cookie` = 0）。 |
| `apps/blog/server/middleware/session.ts` | SSR cookie forward + 3s timeout + 降级 null | VERIFIED | 1329 B；`headers: { cookie }` 严格单行（T3 缓解）；`AbortSignal.timeout(3000)`（D-03 超时）；`baseURL: apiUrl` 走 gateway（D-02）；try/catch 降级 `event.context.session = null`。 |
| `apps/blog/app/plugins/session.ts` | SSR→CSR session seed | VERIFIED | 548 B；`useState('session')` + `import.meta.server` 分支 + `useRequestEvent()?.context.session` seed；`enforce: 'pre'`（早于其他插件执行）；name='session-seed'。 |
| `apps/auth/server/middleware/session.ts` | 字节等价 blog middleware | VERIFIED | 1329 B，与 blog 同字节数；diff（剔除 JSDoc "Blog/Auth" 字样）应为空。 |
| `apps/auth/app/plugins/session.ts` | 字节等价 blog plugin | VERIFIED | 548 B，与 blog 同字节数。 |
| `apps/blog/e2e/session.spec.ts` | D-01 / D-03 / hydrate dedup 活用例 | VERIFIED | 6526 B；3 条 `test(...)` 活用例（0 处 `test.skip`）；`startSsrMock()` + `node:http` 替身 + `page.route` 双层拦截；D-04 `sessionRequests` SSR==1 严格断言 + total ≤ 2；`waitUntil: 'commit'` 锚 SSR phase 严格一次。 |
| `apps/dashboard/e2e/auth-crosspath.spec.ts` | 跨路径 session 共享活用例 | VERIFIED | 3355 B；1 条 `test(...)` 活用例（0 处 `test.skip` / `test.only` / `test.fixme`）；`sessionRequests` 计数器（W1 修订，替代恒真断言）；`expect(sessionRequests).toBeGreaterThanOrEqual(1)` 非恒真；可选 `[data-user-id]` 强断言条件化（WR-06/DI-07 延期到 Phase 2）。 |
| `apps/api/src/routes/auth/__tests__/signout.test.ts` | D-15 #1..#3 活用例 | VERIFIED | 4606 B；3 条 `it('D-15 #...')` 活用例（0 处 `it.todo`）；vitest run 确认 3/3 passed（2.54s）；不 import `better-auth` / `@libsql/client`（mock handler 路径）；`createSignOutCapableAuth` 闭包 currentSession 变量模拟 D1 删除。 |
| `apps/{api,auth,blog,dashboard}/package.json` | better-auth ^1.6.10 | VERIFIED | 4 处全部 `^1.6.10`；0 处 `^1.6.2` 残留。 |
| `pnpm-lock.yaml` | better-auth@1.6.10 解析 | VERIFIED | 4 处 `better-auth@1.6.10`（1 顶级版本条目 + 3 传递解析哈希）；0 处 `better-auth@1.6.2`。 |
| `.planning/phases/01-auth-gateway/01-SMOKE-CHECKLIST.md` | D-19 六步 + Sign-Off | VERIFIED | 6 个 `## Step [1-6]` 小节；Sign-Off 表 6 行全 `✅ pass`；Gate 签字 `✅ 通过`（2026-05-11）；含回溯矩阵映射 SC #1..#5 到覆盖位置。 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `cache-middleware.ts resolveCachePolicy` | `decorateResponse` | CachePolicy.bypassReason 字段 | WIRED | L194-205 写 bypassReason；L381-383 decorateResponse 在 BYPASS 时注入 CACHE_REASON_HEADER；D-11 #2-#5 活用例断言响应头 X-Cache-Reason 为 auth-headers / no-store-path / set-cookie-response。 |
| `cache-middleware.ts createCachedProxy` | Workers KV binding | `policy.shouldStore=false` 带头请求零 KV 读写 | WIRED | L410 resolveCachePolicy → L412 `!policy.shouldStore` early return BYPASS 分支；L429 `storable` 双重检查 shouldCacheResponse；D-11 #2 活用例 `calls === 2` 二次调用仍递增证明零 KV 命中。 |
| `apps/blog/server/middleware/session.ts` | gateway `/api/auth/get-session` | `$fetch` baseURL=apiUrl + headers:{cookie} | WIRED | L36-44 $fetch 调用带 baseURL + cookie + AbortSignal + retry:false；D-01 e2e 活用例用 node:http mock 替身接住 SSR 调用并返回 user-1 payload，HTML 断言命中证明 middleware→gateway 链路打通。 |
| `apps/blog/app/plugins/session.ts` | blog/server/middleware/session.ts | `useState('session')` seed from `event.context.session` | WIRED | L12-16 plugin 在 import.meta.server 分支读 useRequestEvent().context.session；同 key 'session' 连接 middleware 注入与客户端读取。 |
| `apps/auth/nuxt.config.ts runtimeConfig.public.apiUrl` | auth/server/middleware/session.ts | middleware 读 useRuntimeConfig().public.apiUrl | WIRED | 01-03-SUMMARY 确认 runtimeConfig 已存在；middleware L32-33 读取并赋值给 apiUrl。 |
| `signout.test.ts` | `apps/api/src/routes/auth/index.ts` catch-all /* | mock authInstance.handler 返回带 Set-Cookie 的 Response | WIRED | L27-51 createSignOutCapableAuth 构造 mock；L70 `app.route('/', authRoutes)` 挂路由；L82 `app.request('/sign-out', { method: 'POST' })` 调用；authRoutes catch-all 调用 `c.get('auth').handler(c.req.raw)` 触发 mock handler。 |

### Data-Flow Trace (Level 4)

Phase 1 artifacts 多为测试/middleware/plugin，没有渲染动态数据。下表只列涉及真实数据流的位点：

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `apps/blog/server/middleware/session.ts` | event.context.session | `$fetch('/api/auth/get-session', { baseURL: apiUrl, headers:{cookie} })` | Yes — 真实 HTTP fetch 到 gateway→api→better-auth→D1 | FLOWING |
| `apps/blog/app/plugins/session.ts` | useState('session') | `event.context.session`（来自 middleware） | Yes — SSR 阶段读 middleware 注入值 | FLOWING |
| `apps/gateway/src/cache-middleware.ts` decorateResponse | X-Cache-Reason | `policy.bypassReason` 来自 resolveCachePolicy | Yes — 根据 request.headers 与 path 动态计算 | FLOWING |

其余 artifacts（测试文件、package.json、SMOKE-CHECKLIST.md）无数据流概念。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Gateway D-11 cache-bypass matrix | `cd apps/gateway && pnpm exec vitest run cache-middleware.test.ts` | `Test Files 1 passed (1) / Tests 9 passed (9) / 582ms` | PASS |
| API sign-out D-15 server-side invalidation | `cd apps/api && pnpm exec vitest run src/routes/auth/__tests__/signout.test.ts` | `Test Files 1 passed (1) / Tests 3 passed (3) / 2.54s` | PASS |
| better-auth 四 package.json 版本一致性 | `grep -n '"better-auth"' apps/{api,auth,blog,dashboard}/package.json` | 4 处全 `^1.6.10` | PASS |
| better-auth lockfile 解析 | `grep -c 'better-auth@1.6.10' pnpm-lock.yaml` | 4 处命中 | PASS |
| `'private'` scope 死代码清零 | `grep -c "'private'" apps/gateway/src/cache-middleware.ts` | 0（D-12/D-13 完整清理） | PASS |
| Blog e2e 活用例 skip 清零 | `grep -c "test.skip" apps/blog/e2e/session.spec.ts` | 0（3 条 test.skip 转活用例） | PASS |
| Dashboard e2e 活用例 skip/恒真清零 | `grep -c "test.skip\|expect(true).toBe(true)" apps/dashboard/e2e/auth-crosspath.spec.ts` | 0 | PASS |
| Signout it.todo 清零 | `grep -c "it.todo" apps/api/src/routes/auth/__tests__/signout.test.ts` | 0 | PASS |

Blog e2e 活用例未纳入 Spot-Check（需要 `pnpm --filter blog test:e2e` 启动完整 Nuxt dev server + Playwright 浏览器，运行时间 > 10s 违反 spot-check 约束）。Plan 03 SUMMARY 记录本地 3 次连续执行全绿；Plan 06 gate 已接受该证据。

Dashboard e2e 活用例同上理由未纳入 Spot-Check；Plan 06 SUMMARY + git log `40e1153` 记录该用例在 Task 1 执行期通过 `pnpm --filter dashboard test:e2e -- auth-crosspath.spec.ts` 绿。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 01-01 / 01-03 / 01-06 | 5 端登录后 session 互通，刷新/跨子路径不掉线 | SATISFIED | dashboard 自动化 e2e + blog 自动化 SSR e2e + D-19 step 3+4 手动签字 |
| AUTH-02 | 01-01 / 01-03 | Nuxt SSR 正确读 session | SATISFIED | blog/auth middleware + plugin + D-01/D-03/D-04 活用例 + D-19 step 5 view-source 手动签字 |
| AUTH-03 | 01-04 | Cookie domain/SameSite/Secure/Path 正确 | SATISFIED (D-05 override-equivalent) | auth.ts 未改（Plan 04 git diff 零变更）；D-05 CONTEXT 决策明示 `starye.org`（无前导点）为语义等价；D-19 step 2 DevTools 观测手动签字 |
| AUTH-04 | 01-04 | better-auth ^1.6.10 升级 + 冒烟 | SATISFIED | 4 package.json + lockfile 单 commit (6f902a7)；652/652 tests；D-19 六步全绿 |
| AUTH-05 | 01-02 | Gateway 透传 Cookie/Set-Cookie | SATISFIED | gateway/src/index.ts 零改动；CR-02 Set-Cookie 响应 Cache-Control 降级；D-11 #5 活用例 |
| AUTH-06 | 01-01 / 01-02 | /api/auth/* 一律跳 KV | SATISFIED | NO_STORE_PREFIXES + D-11 #4 活用例（有无 cookie 双 case） |
| AUTH-07 | 01-01 / 01-02 | Cookie/Authorization 请求默认 bypass | SATISFIED | hasAuthHeaders 检测 + CR-01 Cache-Control 降级 + D-11 #2 / #3 活用例 |
| AUTH-08 | 01-01 / 01-05 / 01-06 | 登出服务端真正失效 | SATISFIED | signout.test.ts 3 条 D-15 活用例（mock handler 路径）+ D-19 step 6 手动签字（真实 better-auth 1.6.10 输出对比）；WR-07 integration 补齐延期到 Phase 2（DI-08） |

**Orphaned requirements check:** 无。ROADMAP Phase 1 映射 AUTH-01..08 共 8 条；每条都在至少一份 PLAN frontmatter 的 `requirements:` 字段声明（交叉覆盖）；实现证据完整。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/blog/server/middleware/session.ts` | 22 | `pathname.includes('.')` 过滤过于宽松 | Warning (已记为 WR-03/DI-04) | 带点 slug 路径 SSR 预取被跳过；当前 blog 未上该类路径，真实触发概率低；Phase 2 抽 `packages/auth-ssr/` 时修复 |
| `apps/blog/server/middleware/session.ts` | 33 | `apiUrl as string` 未校验 | Warning (已记为 WR-04/DI-05) | runtimeConfig 注入失败时 `$fetch` 退化为相对路径；Phase 2 修复 |
| `apps/auth/server/middleware/session.ts` | 22, 33 | 同上（字节重复） | Warning (已记为 WR-08/DI-09) | 与 blog 字节等价，任一改动需手工同步 |
| `apps/blog/e2e/session.spec.ts` | 137 | `$ssession` key 恒 null 风险 | Warning (已记为 WR-05/DI-06) | Nuxt 4 useState key 序列化变更时断言永真 |
| `apps/dashboard/e2e/auth-crosspath.spec.ts` | 72-74 | `[data-user-id]` 强断言条件化 | Warning (已记为 WR-06/DI-07) | D-19 step 4 的强断言弱化为"至少发了 session 请求"；sessionRequests 计数器托底 |
| `apps/api/src/routes/auth/__tests__/signout.test.ts` | 27-51 | mock handler 非 integration | Warning (已记为 WR-07/DI-08) | 未覆盖 better-auth 真实 Set-Cookie 格式 + D1 session 删除；D-19 step 6 手动冒烟 + Phase 2 integration 补齐 |

**Scope note:** 6 条 Warning 全部由 Phase 1 Code Review（`01-REVIEW.md`）识别并记录到 `deferred-items.md` DI-04..DI-09，与 Phase 2 `requireAuth 中间件 + 跨端权限守卫 + packages/auth-ssr/ 抽取` 同域，orchestrator 已协调延期。无 Blocker 级 anti-pattern（CR-01/CR-02/WR-01/WR-02 已在 phase 内 fix 完成，commits e7fce45 + 9a4dd1c）。

### Human Verification Required

无 pending 项。D-19 六步人工冒烟 checklist 已于 **2026-05-11** 由作者执行并签字：

| Step | 结果 | 覆盖 |
|------|------|------|
| Step 1 匿名公开目录 | ✅ Pass | SC-1 前半 |
| Step 2 GitHub OAuth + Set-Cookie 5 属性 | ✅ Pass | AUTH-03 + AUTH-04 + SC-4 + SC-5 |
| Step 3 刷新仍登录 | ✅ Pass | AUTH-01 + AUTH-07 + SC-1 前半 |
| Step 4 跨子路径共享 | ✅ Pass | AUTH-01 + AUTH-05 + AUTH-07 + SC-1 核心 |
| Step 5 Nuxt SSR view-source | ✅ Pass | AUTH-02 + SC-1 后半 |
| Step 6 登出彻底失效（含 D-16 跨 tab 自然回收） | ✅ Pass | AUTH-06 + AUTH-08 + SC-2 |

Gate 签字：✅ 通过。参见 `.planning/phases/01-auth-gateway/01-SMOKE-CHECKLIST.md` L122-142。

**已知局限（非 gap）：** 自动化 e2e 覆盖 dashboard 单 app（1 case）+ blog SSR（3 cases），5-app 真实跨平台联调由 D-19 step 4 手动签字覆盖，非自动化。这是 Phase 1 的 scope 边界决定（dashboard 自动化不启动 movie/comic/blog 三端 dev server，参见 01-06-SUMMARY `key-decisions`）。

### Gaps Summary

未发现 gap。

Phase 1 的 8 条 AUTH 需求、5 条 ROADMAP Success Criteria 全部通过自动化证据 + 人工签字双重验证：

1. **代码实现完整：** Gateway header-bypass + X-Cache-Reason + 私有 scope 清零 + SSR session 通道（blog/auth 字节等价）+ better-auth 1.6.10 + signout 单测 —— 全部落地。
2. **Code Review 闭环：** 2 个 CRITICAL（CR-01 Cache-Control 泄漏 / CR-02 Set-Cookie 透传）+ 2 个 WARNING（WR-01 public-pages bypassReason / WR-02 X-Cache-TTL 误报）在 phase 内由 e7fce45 + 9a4dd1c 修复，D-11 #2/#3/#4/#5 活用例均补充 Cache-Control 断言锁死不变量。其余 6 个 WARNING（WR-03..WR-08）按 orchestrator 决策延期到 Phase 2（deferred-items DI-04..DI-09）。
3. **自动化测试绿：** Phase 1 交付的 4 个测试文件当前状态：gateway 9/9 passed、api signout 3/3 passed、blog e2e 3 活用例（Plan 03 3 次连续绿）、dashboard e2e 1 活用例（Plan 06 Task 1 绿）。Plan 04 全仓回归 652/652 tests。
4. **手动冒烟签字：** D-19 六步 checklist 2026-05-11 全 Pass，Gate 通过。
5. **Deferred items 透明：** DI-01..DI-10 记录清晰，全部为 pre-existing 仓库环境问题（type-check pipeline、vite.config.js build 副作用、crawler outputs、husky hooks）或 Phase 2 自然域（SSR middleware 抽包、e2e tautology 加固、signout integration）。

Phase 1 goal（5 端统一会话 + gateway 缓存不泄漏）在代码库中可观测为真。Phase gate **通过**，可进入 Phase 2 规划。

---

_Verified: 2026-05-11T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
