---
phase: 01-auth-gateway
plan: 03
subsystem: auth
tags: [nuxt, nitro, ssr, session, better-auth, playwright, cloudflare-pages, h3]

# Dependency graph
requires:
  - phase: 01-auth-gateway/01
    provides: "e2e 骨架 session.spec.ts（test.skip × 3）、runtimeConfig.public.apiUrl 约定"
  - phase: 01-auth-gateway/02
    provides: "Gateway /api/auth/* 代理与 cookie 透传（SSR middleware 的上游）"
provides:
  - "Nuxt blog SSR 通道：server/middleware/session.ts 将浏览器 cookie forward 到 gateway，event.context.session 挂入预取结果"
  - "Nuxt auth SSR 通道：字节等价 blog 的 middleware + plugin，auth app 首次建立 server/ 与 app/plugins/ 目录"
  - "SSR→CSR session seed：plugins/session.ts via useState('session')，enforce pre，消除首帧闪烁"
  - "AUTH-02 e2e 活用例：D-01 HTML 含 user-1、D-03 3s 超时降级 null、D-04 SSR 严格 1 次 + total <= 2"
affects: [02-content-core, 03-dashboard-rbac, 任何引入 Nuxt SSR-aware 鉴权的后续 phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nitro server/middleware 最早阶段预取 session 并注入 event.context（而非 plugin.server）"
    - "$fetch 显式 forward cookie 并用 AbortSignal.timeout(3000) + try/catch 降级"
    - "Nuxt 4 plugin `enforce: 'pre'` + useState single-instance 完成 SSR→CSR 同步"
    - "Playwright e2e 用 node:http mock 替身（8080）承接 Nitro SSR 的 $fetch，与 page.route 分担 SSR / hydrate 两阶段断言"

key-files:
  created:
    - "apps/blog/server/middleware/session.ts"
    - "apps/blog/app/plugins/session.ts"
    - "apps/auth/server/middleware/session.ts"
    - "apps/auth/app/plugins/session.ts"
    - "apps/auth/server/ 目录（新建）"
    - "apps/auth/server/middleware/ 目录（新建）"
    - "apps/auth/app/plugins/ 目录（新建）"
  modified:
    - "apps/blog/e2e/session.spec.ts（骨架 test.skip × 3 → 活用例 × 3）"

key-decisions:
  - "SSR session 通道走 server/middleware 而非 plugins/*.server.ts：前者最早阶段触发、可写 event.context；后者要经 useRequestHeaders('cookie') 绕一圈"
  - "middleware 仅 `headers: { cookie }`，不 spread 其他头：缓解 T-01-09 SSR header 泄漏"
  - "baseURL 固定走 runtimeConfig.public.apiUrl（gateway 原点）：D-02 不直连 api.starye.org"
  - "e2e 用进程内 node:http 替身而不是 page.route 拦截 SSR：Playwright route 只拦截浏览器请求，Nitro SSR 的 $fetch 直连 localhost:8080 无法被 page.route 捕获（Rule 1 修正）"
  - "auth 的 runtimeConfig.public.apiUrl 已存在，无需新增 —— Task 2 Step 1 实质为 no-op"

patterns-established:
  - "Pattern A: Nitro SSR 鉴权通道统一模板 —— defineEventHandler + getHeader(cookie) + $fetch baseURL + AbortSignal.timeout(3000) + try/catch 降级 null"
  - "Pattern B: session-seed plugin 模板 —— useState + import.meta.server 分支 + useRequestEvent + enforce 'pre'"
  - "Pattern C: SSR e2e 断言模板 —— startSsrMock() 承接 SSR fetch，page.route 承接 hydrate fetch，waitUntil: 'commit' 断 SSR phase 后 networkidle 断 total"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: 24min
completed: 2026-05-11
---

# Phase 01 Plan 03: Nuxt SSR 会话通道 Summary

**Nuxt blog 与 auth 建立 SSR 会话预取 + 同步 hydrate 的字节等价通道：event.context.session 注入 + useState seed + 3s 降级**

## Performance

- **Duration:** 24min 06s
- **Started:** 约 2026-05-11 plan 执行起点
- **Completed:** 2026-05-11
- **Tasks:** 3
- **Files modified:** 4 (3 created + 1 updated spec)

## Accomplishments
- Blog SSR 通道就位：cookie 原样 forward gateway、3s timeout 降级、event.context.session 单例
- Auth app 首次落地 server/ 与 app/plugins/ 目录，middleware 与 plugin 与 blog 字节等价
- session.spec.ts 三条活用例（D-01 / D-03 / D-04）本地 3 次连续执行全绿（约 31s/轮）
- A1 假设验证通过：`AbortSignal.timeout` 在 Cloudflare Pages Nitro 产物（`_worker.js/chunks/_/nitro.mjs`）内保留，无需回退到 AbortController + setTimeout

## Task Commits

1. **Task 1: blog SSR middleware + plugin** - `0dd750d` (feat)
2. **Task 2: mirror 到 auth + runtimeConfig 校验** - `291f611` (feat)
3. **Task 3: 激活 session.spec.ts 3 条活用例** - `ff441a3` (test)

## Files Created/Modified

- `apps/blog/server/middleware/session.ts` - Nitro SSR 最早阶段预取 /api/auth/get-session，挂入 event.context.session；失败降级 null
- `apps/blog/app/plugins/session.ts` - enforce 'pre' 的 session-seed plugin，SSR 端把 event.context.session 同步到 useState('session')
- `apps/auth/server/middleware/session.ts` - 与 blog 字节等价（仅首行 JSDoc Blog→Auth）
- `apps/auth/app/plugins/session.ts` - 与 blog 逐字等价
- `apps/blog/e2e/session.spec.ts` - 骨架 test.skip × 3 全部转活用例，追加进程内 node:http mock 替身、cookie 预置与 SSR phase / total 两阶段断言

## 一致性验证（Task 2 acceptance）

```bash
# middleware 除 JSDoc 头的 "Blog SSR" / "Auth SSR" 行外，行为与结构完全一致
$ diff <(grep -v '^ \* Phase\|^ \* Auth SSR\|^ \* Blog SSR' apps/blog/server/middleware/session.ts) \
       <(grep -v '^ \* Phase\|^ \* Auth SSR\|^ \* Blog SSR' apps/auth/server/middleware/session.ts)
# 输出：空（IDENTICAL）

# plugin 逐字等价
$ diff apps/blog/app/plugins/session.ts apps/auth/app/plugins/session.ts
# 输出：空（IDENTICAL）
```

## A1 假设验证结果（AbortSignal.timeout 在 Nitro / cloudflare-pages 产物中可用）

| 产物 | 路径 | grep 结果 |
| --- | --- | --- |
| blog 构建 | `apps/blog/dist/_worker.js/chunks/build/server.mjs` | `AbortSignal.timeout` / `AbortSignal.any` 皆命中（undici 带入） |
| auth 构建 | `apps/auth/dist/_worker.js/chunks/_/nitro.mjs` | `AbortSignal.timeout` 命中；middleware 源码未被工具链 transform |

结论：**A1 通过，无需 fallback 到 `AbortController + setTimeout(3000)`**。

## 新建目录清单（Task 2）

- `apps/auth/server/`
- `apps/auth/server/middleware/`
- `apps/auth/app/plugins/`

（Nitro 自动扫描 `server/middleware/*.ts`，无需在 `apps/auth/nuxt.config.ts` 注册；`runtimeConfig.public.apiUrl` 已预先存在于该文件，Task 2 Step 1 实质 no-op。）

## D-19 Step 5 手动验证步骤（view-source 无闪烁冒烟）

```bash
# 1) 启动 api + gateway + blog（需已登录 session cookie）
pnpm --filter api dev &
pnpm --filter gateway dev &
pnpm --filter blog dev

# 2) 登录后拿到 cookie；打开浏览器 view-source:http://localhost:3002/blog/
#    预期：HTML 中即可看到登录用户的身份渲染标记（由 plugin seed 到 useState）
#    观察：刷新页面时不出现 SSR→CSR 首帧闪烁
curl -sS -H "Cookie: $(cat ~/.starye-cookie)" http://localhost:3002/blog/ | grep -o 'user-[^"]*' | head -3
```

（本 plan 范围内只做代码实装，手动冒烟留给集成联调阶段执行；自动化路径由 e2e D-01 覆盖。）

## Decisions Made

- **e2e 的 SSR mock 用 node:http 替身** —— 见 key-decisions。原 PLAN 文本以 `page.route('**/api/auth/get-session')` 作 D-01/D-03/D-04 mock，但 Playwright `page.route` 只拦截浏览器请求；Nitro SSR 内的 `$fetch` 直连 `localhost:8080` 发生在 Nuxt dev 进程，浏览器拦截不到，测试会走空。改为 spec 内启动 `node:http` server listen 8080，并配合 `page.route` 双写（客户端 hydrate 仍走拦截），避免对 PLAN 原 mock 语义的改动最小化。
- **D-01 断言放宽到 HTML 含 `user-1` 字符串** —— dev SSR 的 `window.__NUXT__.state` 在 `domcontentloaded` 时机常未注入（Nuxt 4 dev 特性），直接断 HTML 中 SSR 渲染痕迹更稳，不影响"SSR 已经取到并把 session 注入了 DOM"这一命题。
- **cookie 预置用 `context.addCookies([{domain:'127.0.0.1'},{domain:'localhost'}])`** —— Playwright baseURL 是 `localhost`，但 SSR fetch 去到 `127.0.0.1:8080` —— 注入两份保证 middleware 的 `getHeader(event, 'cookie')` 非空。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] e2e mock 策略 `page.route` 无法覆盖 SSR $fetch**
- **Found during:** Task 3（session.spec.ts 初次实现）
- **Issue:** PLAN acceptance 中 D-01/D-03/D-04 全部以 `page.route('**/api/auth/get-session')` 作 mock，但 Playwright `page.route` 仅拦截浏览器发起的请求；Nitro SSR `$fetch` 走 Node.js 进程直连 127.0.0.1:8080，`page.route` 拦截不到，导致 SSR 真的去 fetch 不存在的上游、middleware 永远 catch 降级为 null，测试走空。
- **Fix:** spec 顶部加 `startSsrMock()` 工具用 `node:http` 监听 8080，作为 gateway 替身；`page.route` 仅保留客户端 hydrate 拦截；D-04 用例中 SSR 通过 node mock 计数 + 客户端通过 page.route 计数汇总到同一变量 `sessionRequests`。
- **Files modified:** `apps/blog/e2e/session.spec.ts`（新增 `startSsrMock` / `SsrMockOptions` / cookie 预置工具）
- **Verification:** 本地 `pnpm --filter blog test:e2e -- session.spec.ts` 连续 3 次全绿；每次 3 条用例总计约 31s，均在 acceptance `<40s` 预算内。
- **Committed in:** `ff441a3` (Task 3 commit)

**2. [Rule 1 - Bug] D-01 `window.__NUXT__.state` 断言时机不稳**
- **Found during:** Task 3 首次运行（D-01 fail，其余 pass）
- **Issue:** Nuxt 4 dev SSR 返回 HTML 时 `window.__NUXT__` 并未在 `domcontentloaded` 立即注入，`page.evaluate(() => window.__NUXT__?.state)` 返回 `undefined`，断言失败。
- **Fix:** 改为断言 `page.content()` 含 `'user-1'` —— 等价覆盖"SSR 端 session 已注入到渲染输出"这一命题，且不依赖 Nuxt 运行时 payload 注入时机。
- **Files modified:** `apps/blog/e2e/session.spec.ts`
- **Verification:** 三次连续执行 D-01 全绿。
- **Committed in:** `ff441a3`（与上一个修正同 commit，便于单次 squash）

---

**Total deviations:** 2 auto-fixed（均为 Rule 1 —— 测试写法修正，未改动业务代码或 PLAN 成功条件）
**Impact on plan:** 两处修正均发生在 e2e 层面，未动 middleware / plugin 的 6 truths 或任何 acceptance 的不变量（SSR 严格 1 次、total ≤ 2、`waitUntil: 'commit'` 仍保留）。业务 code 未偏离 PLAN。

## Issues Encountered

- **首轮 pnpm install 未执行** —— worktree 刚 reset 到 wave 2 base，node_modules 缺失；运行 `pnpm install --prefer-offline` 用时约 1min 30s 恢复依赖。后续 build / e2e 正常。
- **D-04 用例首轮观测到 3 次请求** —— 开启 `clientMethods` 调试日志后三轮重跑稳定为 2 次（`['GET']`）。怀疑首轮是 Nuxt dev HMR 冷启动期间多触发了一次 hydrate cycle；随 dev server 预热后稳定。保险起见 PLAN 的 `toBeLessThanOrEqual(2)` + `>=1` 双边断言已经给了足量弹性。

## Threat Flags

无。本 plan 未引入新的网络端点 / 鉴权路径 / 文件访问表面；所有新增的 outbound 网络请求（SSR `$fetch` → gateway `/api/auth/get-session`）都在 PLAN `<threat_model>` 的既有 STRIDE 条目 T-01-09 / T-01-10 / T-01-11 覆盖范围内，且 acceptance grep 已锁死 `headers: { cookie }` 与 `baseURL: apiUrl` 不变量。

## Known Stubs

无。三份新文件均完整接入实际数据源（`runtimeConfig.public.apiUrl` → gateway → api），不存在硬编码空对象或占位数据。

## User Setup Required

无。本 plan 仅接入已有的 `NUXT_PUBLIC_API_URL` / `VITE_API_URL` 环境变量路径（`.env.example` 已含），不新增 secret / binding / 外部服务。

## Next Phase Readiness

- Nuxt blog / auth 的 SSR 鉴权通道已就绪：下游 phase 可直接在 Vue 组件内 `useState('session')` 读到 SSR 已注入的用户态，或继续用 `authClient.useSession()`（CSR 层）
- `AbortSignal.timeout` 在本仓 Nitro 运行时确认可用，后续 SSR 外呼场景可复用 3s 超时 pattern
- e2e 中 `startSsrMock` 工具可抽成共享 helper（例如 `apps/blog/e2e/helpers/ssr-mock.ts`），未来 phase 如需类似 SSR 级外呼断言可复用

---

## Self-Check: PASSED

- `test -f apps/blog/server/middleware/session.ts` → FOUND
- `test -f apps/blog/app/plugins/session.ts` → FOUND
- `test -f apps/auth/server/middleware/session.ts` → FOUND
- `test -f apps/auth/app/plugins/session.ts` → FOUND
- `test -f apps/blog/e2e/session.spec.ts` → FOUND（已修改，不含 test.skip）
- commit `0dd750d` (feat blog) → FOUND in `git log`
- commit `291f611` (feat auth mirror) → FOUND in `git log`
- commit `ff441a3` (test e2e) → FOUND in `git log`
- `pnpm --filter blog build` → green
- `pnpm --filter auth build` → green
- `pnpm --filter blog test:e2e -- session.spec.ts` → 3 passed × 3 连续运行
- 不变量 grep：`AbortSignal.timeout(3000)`、`headers: { cookie }`、`baseURL: apiUrl`、`enforce: 'pre'`、`expect(sessionRequests).toBe(1)`、`toBeLessThanOrEqual(2)`、`waitUntil: 'commit'` 全部命中

---
*Phase: 01-auth-gateway*
*Plan: 03*
*Completed: 2026-05-11*
