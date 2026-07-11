---
phase: 01-auth-gateway
plan: 06
subsystem: smoke / phase-gate
tags: [smoke, e2e, phase-gate, manual, checkpoint]

# Dependency graph
requires:
  - phase: 01-auth-gateway
    provides: Plan 01..05 全部合入（Gateway bypass、Nuxt SSR session、better-auth 1.6.10、signout 单测、auth-crosspath e2e 骨架）
provides:
  - Phase 1 gate 签字通过，AUTH-01..08 八项需求全部闭环
  - D-19 六步手动冒烟 checklist 固化为可复用模板
  - dashboard auth-crosspath.spec.ts 活用例（sessionRequests 计数器断言）替代恒真断言
affects:
  - Phase 2 admin / dashboard 管控：可假设 Phase 1 session 基础设施已稳定，不再在 Phase 2 PLAN 中重新验证
  - 后续 phase 新增 app（若有）：需沿用 D-19 checklist 模板新增跨路径 step

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Playwright page.route 计数器模式：用 sessionRequests 计数替代 expect(true).toBe(true) 恒真断言；SPA 真的消费 session 才会递增，失败信号可被真实缺失触发"
    - "Phase gate 三段式：auto 单测 + e2e 活用例 + 手动冒烟 checklist 双重签字；checklist 每步锚定 AUTH-XX + Success Criteria 编号便于可溯源"

key-files:
  created:
    - ".planning/phases/01-auth-gateway/01-SMOKE-CHECKLIST.md"
    - ".planning/phases/01-auth-gateway/01-06-SUMMARY.md"
  modified:
    - "apps/dashboard/e2e/auth-crosspath.spec.ts"

key-decisions:
  - "sessionRequests 计数器替代恒真断言：page.route handler 内计数 /api/auth/get-session 请求次数；toBeGreaterThanOrEqual(1) 锚定 AUTH-01 SPA 读 session 行为不变量"
  - "不启动 movie/comic/blog 三端 dev server：e2e 自动化只覆盖 dashboard 单 app 读 session；真实跨 app 跳转由 D-19 step 4 手动 checklist 覆盖"
  - "Checklist 颗粒度到 DevTools observable：Step 2 逐条列出 Set-Cookie 5 个属性（Domain / SameSite / Secure / Path / 去重）；可被作者真实观测"
  - "Step 6 额外覆盖 D-16 跨 tab 自然回收：明示不需要 BroadcastChannel / visibilitychange，回收靠 cookie 过期即可"

patterns-established:
  - "Phase gate checklist 回溯矩阵：每 step 标注对应 AUTH-XX 需求 + ROADMAP Success Criteria 编号；gate 末尾附回溯矩阵便于 verifier / orchestrator 审计"
  - "Playwright SPA 行为断言：禁止 expect(true).toBe(true)；用 page.route 拦截 + 闭包计数器作为客观证据"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08]

# Metrics
duration: 约 35 分钟（Task 1 e2e 激活 20min + Task 2 checklist 产出 10min + Task 3 人工冒烟 5min）
completed: 2026-05-11
---

# Phase 1 Plan 6: D-19 六步手动冒烟与 Phase gate 签字 Summary

**Dashboard 跨路径 e2e 活用例（sessionRequests 计数器）+ D-19 六步手动冒烟 checklist 双重签字通过；Phase 1 AUTH-01..08 八项需求全部闭环，ROADMAP 5 条 Success Criteria 全部实锚，Phase 1 状态：Completed。**

## 交付内容

- **自动化层：** `apps/dashboard/e2e/auth-crosspath.spec.ts` 唯一一条 `test.skip` 转为活用例，使用内联 `page.route` + `sessionRequests` 计数器（W1 修订）替代恒真断言；`toBeGreaterThanOrEqual(1)` 断言 SPA 真实消费 `/api/auth/get-session`，同时保留 `[data-user-id]` 条件分支作为强断言补充。
- **手动层：** `.planning/phases/01-auth-gateway/01-SMOKE-CHECKLIST.md` 新建，覆盖 D-19 六步全流程（匿名基线 → OAuth 登录 → 刷新保持 → 跨子路径 → Nuxt SSR view-source → 登出彻底失效）。每步锚定 AUTH-XX 需求 + ROADMAP Success Criteria 编号，颗粒度细到 DevTools Set-Cookie 5 个属性逐条观测。
- **Gate 层：** 作者于 2026-05-11 按 checklist 跑完六步，Sign-Off 表 6 行全 Pass，回复"phase 1 通过"关闭 Phase 1。

## 提交记录

| Task | Hash | 消息 |
|------|------|------|
| 1    | `40e1153` | `test(01-06): activate dashboard auth-crosspath e2e with sessionRequests counter` |
| 2    | `4ad2e82` | `docs(01-06): add D-19 six-step manual smoke checklist for Phase 1 gate` |
| 3    | _(human checkpoint)_ | `phase 1 通过 — 2026-05-11 作者签字` |
| 元数据 | _(本提交)_ | `docs(01-06): sign off Phase 1 smoke checklist, complete plan 01-06` |

## Checklist 执行结果

| Step | 名称 | 验证目标 | 结果 | 备注 |
|------|------|---------|------|------|
| 1 | 未登录浏览公开目录 | ROADMAP SC #1 前半（公开路径匿名基线） | ✅ Pass | 基线成立：`/movie/` 匿名可达，无 401 / `starye.session_token` |
| 2 | GitHub OAuth 登录 | AUTH-03 + AUTH-04 + SC #4 + SC #5 | ✅ Pass | Set-Cookie 5 属性（Domain / SameSite / Secure / Path / 去重）全部符合；1.6.10 的 Set-Cookie 去重修复被现场观测 |
| 3 | 刷新页面仍登录 | AUTH-01 + AUTH-07 + SC #1 前半 | ✅ Pass | F5 后 `/api/auth/get-session` 200 + 非空 user；无匿名/登录闪烁 |
| 4 | 跨子路径 session 共享 | AUTH-01 + AUTH-05 + AUTH-07 + SC #1 核心 | ✅ Pass | `/movie/` `/comic/` `/blog/` `/dashboard/` 四端登录态可见且 user.id 一致 |
| 5 | Nuxt SSR view-source 含登录态 | AUTH-02 + SC #1 后半 | ✅ Pass | 禁 JS 硬刷新 `/blog/` view-source 含 `__NUXT__.state` session 对象，零闪烁 |
| 6 | 登出彻底失效 | AUTH-06 + AUTH-08 + D-15 / D-16 + SC #2 | ✅ Pass | `/api/auth/sign-out` 200 + Set-Cookie `Max-Age=0`；四端刷新均匿名；双 tab 自然回收无需 BroadcastChannel |

## Decisions Made

- **不启动 movie/comic/blog 三端 dev server：** e2e 自动化只覆盖 dashboard 单 app，真实跨 app 由 Step 4 手动。dev server 冷启总和 > 15s，与 e2e 快速反馈目标冲突；且真实跨 app 必须通过 gateway:8080，不是 Playwright baseURL 的覆盖范围。
- **sessionRequests 计数器替代恒真断言（W1 修订）：** 原骨架考虑的 `expect(true).toBe(true)` 为恒真占位，测试绿灯无法反映 SPA 行为缺失。改用 `page.route` 闭包计数更合理。
- **Checklist Step 6 覆盖 D-16：** 跨 tab 登出回收是 ROADMAP 未直接列出但 D-19 原文要求的不变量；checklist 明示"无需 BroadcastChannel / visibilitychange"即可，靠 cookie 过期自然回收。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Playwright route 匹配顺序修复**
- **Found during:** Task 1（e2e 激活）
- **Issue:** 最初注册 `**/api/auth/get-session` 专属路由在 `**/auth/**` 通配路由之后，Playwright 以 FIFO 顺序匹配，导致通配先命中，专属计数器从未递增。
- **Fix:** 调整注册顺序 —— 通配 `**/auth/**` 先注册（作为 fallback `continue`），专属 `**/api/auth/get-session` 后注册（具体路径在计数器 handler 内 `fulfill` 响应）。
- **Files modified:** `apps/dashboard/e2e/auth-crosspath.spec.ts`
- **Verification:** `pnpm --filter dashboard test:e2e -- auth-crosspath.spec.ts` 绿；`sessionRequests >= 1` 断言成立。
- **Committed in:** `40e1153`

**2. [Out-of-scope observation] vue-i18n 在 Home.vue loadStats 错误路径上的 warning**
- **Found during:** Task 1 dashboard dev server 启动日志中打印 `Must be called at the top of a setup function`
- **Scope:** 与 Plan 06 无关；Home.vue 的错误处理分支非本 plan 作用域
- **Action:** 未修复；不阻塞 e2e 活用例绿灯；如需跟进由后续独立 plan 覆盖。

---

**Total deviations:** 1 auto-fixed (Rule 1 bug) + 1 out-of-scope observation
**Impact on plan:** 零功能范围蔓延；e2e 活用例与 checklist 均按 plan 内容产出。

## Issues Encountered

无需额外问题解决；Task 1 的 route 顺序问题已在 Deviations 中记录并修复。

## User Setup Required

无新增外部服务配置。本 plan 的 GitHub OAuth 依赖在 Phase 1 的早期 plan（01-04 better-auth 升级 + GitHub social provider 配置）已就位；作者仅需持有有效 GitHub 账号即可跑 Step 2。

## Phase 1 最终状态

- **Status:** **Completed**
- **Requirements 闭环：** AUTH-01 / AUTH-02 / AUTH-03 / AUTH-04 / AUTH-05 / AUTH-06 / AUTH-07 / AUTH-08 —— 8/8 全部关闭
- **ROADMAP Success Criteria 实锚：** 5/5 全部通过自动化单测（4 条：cache-middleware D-11、blog e2e session、api signout D-15、dashboard e2e crosspath）+ D-19 六步手动冒烟双重签字
- **Phase gate：** 通过，可进入 close 流程，准备 Phase 2 规划

## Self-Check: PASSED

- 文件 `.planning/phases/01-auth-gateway/01-SMOKE-CHECKLIST.md` 存在，Sign-Off 表 6 行全 `✅ pass`，Gate 签字行为 `✅ 通过`
- 文件 `.planning/phases/01-auth-gateway/01-06-SUMMARY.md` 存在，含完整 frontmatter + 6 个 body 段
- 提交 `40e1153`、`4ad2e82` 均在 `git log` 可见（base 74e2098 祖先链上）
- 无 STATE.md / ROADMAP.md / deferred-items.md 修改（orchestrator 负责）

---
*Phase: 01-auth-gateway*
*Completed: 2026-05-11*
