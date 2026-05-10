---
phase: 01-auth-gateway
plan: 04
subsystem: auth
tags: [better-auth, upgrade, security, supply-chain]

requires:
  - phase: 01-auth-gateway
    provides: 01-CONTEXT/RESEARCH/PATTERNS（D-18 锁定 ^1.6.10；1.6.3..1.6.10 changelog 已审）
provides:
  - Better Auth 依赖版本基线对齐 ^1.6.10（四个 apps 同 commit）
  - pnpm-lock.yaml 内 better-auth 具体解析版本锁到 1.6.10
  - 附带 1.6.7（APIError 保留 Set-Cookie）+ 1.6.10（OAuth 回调去重 Set-Cookie）修复
affects: [01-05-PLAN cookie 属性手动冒烟, 01-06-PLAN phase gate 签字, 后续 auth 全链路 plan]

tech-stack:
  added: []
  patterns:
    - "workspace 依赖版本"命令行统一升版 (pnpm up -r <pkg>@<ver>)"
    - "升级后强制走 Turbo pipeline 做回归（尊重 ^build 依赖），而非 pnpm -r <task>"

key-files:
  created:
    - .planning/phases/01-auth-gateway/deferred-items.md
  modified:
    - apps/api/package.json
    - apps/auth/package.json
    - apps/blog/package.json
    - apps/dashboard/package.json
    - pnpm-lock.yaml

key-decisions:
  - "回归命令从 pnpm -r type-check 改走 pnpm turbo run type-check —— 前者跳过 ^build，导致 packages/db 的 dist/ 缺失诱发 TS6305 假阳性；Turbo 管道才能正确反映项目实际构建顺序"
  - "把 dashboard/vite.config.js 和 crawler outputs 警告记入 deferred-items 而非在本 plan 修复 —— 均为 pre-existing 仓库配置问题，超出 Plan 01-04 范围"

patterns-established:
  - "升级类 plan 回归统一走 pnpm turbo run <task>：尊重 turbo.json 声明的 ^build 依赖，避免 pnpm -r 直出导致 d.ts 未就绪的 TS6305 误报"
  - "包版本升级 + lockfile 刷新 = 单 commit（D-18 守约）：pnpm up -r 天然产出该形态，但要在 commit 前 git status 核对无顺带的其他包变动"

requirements-completed:
  - AUTH-03
  - AUTH-04

duration: 11min
completed: 2026-05-10
---

# Phase 01 Plan 04: Better Auth 1.6.2 → 1.6.10 升级 Summary

**Better Auth 在 api / auth / blog / dashboard 四端同 commit 升至 1.6.10，带入 1.6.7/1.6.10 的 Set-Cookie 稳定性修复，lockfile 同步锁死；9 个 Turbo type-check、5 个 test (652/652 通过)、10 个 build 任务全绿，apps/api/src/lib/auth.ts 与 middleware/auth.ts 零 diff 保证 D-05/D-06 不漂移。**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-10T18:06:38Z
- **Completed:** 2026-05-10T18:18:26Z
- **Tasks:** 2 (Task 1 升版 + Task 2 回归验证)
- **Files modified:** 5 in commit + 1 deferred-items.md

## Accomplishments

- 四个 package.json（api / auth / blog / dashboard）的 `better-auth` 从 `^1.6.2` 同步升至 `^1.6.10`；pnpm-lock.yaml 在同一 commit 内刷新（D-18 守约）
- lockfile 解析到 `better-auth@1.6.10`（grep 验证：四处 workspace 引用 + `better-auth@1.6.10:` 版本条目）
- 全仓回归三步全绿：9 个 Turbo type-check / 5 个 Turbo test（合计 652 tests） / 10 个 Turbo build
- `apps/api/src/lib/auth.ts` 与 `apps/api/src/middleware/auth.ts` **字节不动**（`git diff --exit-code` 通过），等价保证 cookieDomain / sameSite / secure / path / cookiePrefix 行为未漂移（D-05 / D-06 回归）
- `pnpm up -r` 仅动 better-auth，未顺带升级 drizzle-orm 或其他包（peer 要求 `drizzle-orm@^0.45.2` 已满足，packages/db 实锁 0.45.2）

## Task Commits

1. **Task 1: 四 package.json 同步升级 + lockfile 刷新** - `6f902a7` (chore)
2. **Task 2: 升级后全仓回归 build / type-check / test** - 无单独 commit（纯验证步骤，"done" 不要求 commit）

**Plan metadata commit:** 待本 SUMMARY.md 加入后合并提交（见最终 commit）

## Files Created/Modified

- `apps/api/package.json` — `better-auth` 依赖 `^1.6.2` → `^1.6.10`（dependencies L23）
- `apps/auth/package.json` — 同上（dependencies L18）
- `apps/blog/package.json` — 同上（dependencies L22）
- `apps/dashboard/package.json` — 同上（dependencies L29）
- `pnpm-lock.yaml` — 根 lockfile 刷新；四个 `importers.apps/*` 条目的 `better-auth` 指定器由 `^1.6.2` 转 `^1.6.10`；`better-auth@1.6.10:` 顶级版本条目新增（取代 1.6.2）；@better-auth/core/drizzle-adapter/kysely-adapter/memory-adapter/mongo-adapter/prisma-adapter/telemetry 伴随同步升到 1.6.10 的传递依赖图
- `.planning/phases/01-auth-gateway/deferred-items.md` — 新增，记录 2 个 pre-existing 仓配置问题

## 回归命令输出摘要

| 命令 | 结果 | 备注 |
|------|------|------|
| `pnpm install --frozen-lockfile` | Done in 35.5s | lockfile 与四个 package.json 一致 |
| `pnpm turbo run type-check` | 9 successful / 9 total（41.968s） | 包含 @starye/ui、@starye/db、@starye/crawler、api、dashboard 的 type-check + 被依赖包的 ^build |
| `pnpm turbo run test` | 5 successful / 5 total（47.903s）；测试 **652 passed / 652 total** | api 37 files/287 tests · dashboard 10/115 · gateway 3/41 · movie-app 15/161 · crawler 9/48 |
| `pnpm turbo run build` | 10 successful / 10 total（1m58.521s） | 所有 dist/ 或 .output/ 产出正常 |
| `git diff --exit-code apps/api/src/lib/auth.ts apps/api/src/middleware/auth.ts` | 0（无差异） | D-05 / D-06 零漂移 |

## Decisions Made

1. **回归走 Turbo，而非 `pnpm -r <task>`**：首次用 `pnpm -r type-check` 直跑时，apps/api 吐出一堆 TS6305（`Output file ... has not been built from source file`）和 TS7006（`Parameter 'x' implicitly has an 'any'`），看似 better-auth 升级引发。实际上 `turbo.json` 声明 `type-check` 依赖 `^build`，`pnpm -r` 绕过 Turbo 就跳过了 packages/db 的 `tsc` 产出步骤 —— 下游 apps/api 引用的 `@starye/db/dist/src/index.d.ts` 缺失导致 TS6305；TS7006 是 Drizzle query builder 在缺 d.ts 时的类型退化副作用。改走 `pnpm turbo run type-check` 后全绿，证实这是执行方式问题而非 better-auth 引入的回归。
2. **不提交 `apps/dashboard/vite.config.js` 的意外修改**：build 跑完后该 tracked 文件被 `vue-tsc -b` 覆盖为分号 + 四空格格式（仓内版本是 antfu 规范化过的）。与 better-auth 无关，`git checkout --` 还原，记到 `deferred-items.md` 等后续 dashboard plan 统一处理。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `pnpm -r type-check` 被 TS6305 堵住 → 改走 Turbo pipeline**

- **Found during:** Task 2（升级后全仓回归）
- **Issue:** `pnpm -r type-check` 先于 packages/db 的 `build` 运行，apps/api 看不到 `@starye/db/dist/src/*.d.ts`，TS6305 在 15+ 个 service 文件报错；同时 TS7006 在 Drizzle query 结果上触发 implicit-any。乍看像 better-auth 1.6.10 引入的类型破坏。
- **Fix:** 切到 `pnpm turbo run type-check`（尊重 turbo.json 声明的 `^build` 前置），packages/{db,ui,api-types} 先 build 再对下游做 type-check。全 9 个 task 绿，确认之前是执行方式问题，不是 better-auth 回归。
- **Files modified:** 无（纯命令级切换）
- **Verification:** `pnpm turbo run type-check` → `Tasks: 9 successful, 9 total`
- **Committed in:** 无独立 commit（验证命令调整）

**2. [Scope Boundary] `apps/dashboard/vite.config.js` 被 build 副作用覆盖 → 还原 + 登记 deferred**

- **Found during:** Task 2（`pnpm turbo run build` 之后）
- **Issue:** dashboard 的 `build` 脚本 `vue-tsc -b && vite build` 会把 tracked 的 `vite.config.ts` 编译成 `vite.config.js`（仓里同时 tracked 了 `.ts` 和 `.js`），产物格式与仓内 antfu 规范化后的 `.js` 不一致。与 better-auth 无关，是既有 build 配置问题。
- **Fix:** `git checkout -- apps/dashboard/vite.config.js` 还原；创建 `.planning/phases/01-auth-gateway/deferred-items.md` 登记此问题 + `@starye/crawler#build` 的 turbo outputs 缺失警告。
- **Files modified:** `.planning/phases/01-auth-gateway/deferred-items.md`（新增）
- **Verification:** `git status --short` 仅显示 SUMMARY.md 与 deferred-items.md；guard 文件 diff 为空
- **Committed in:** 最终 metadata commit

---

**Total deviations:** 2（1 Rule 3 blocking、1 scope boundary）
**Impact on plan:** 两条都是 pre-existing 仓库环境/配置行为，与 better-auth 升级的语义变化无关。Plan 核心目标（four package.json + lockfile 同 commit、D-05/D-06 零漂移、回归全绿）100% 达成。

## Issues Encountered

- **peer dependency warnings**（升级期间）：`pnpm up -r better-auth@^1.6.10` 末尾打了 8 行 peer warning，但 **无一条指向 better-auth**：
  - `@typescript-eslint/rule-tester` / `@intlify/unplugin-vue-i18n` 下的 `@typescript-eslint/*@8.57.0` 要求 `typescript@>=4.8.4 <6.0.0`，仓实装 typescript@6.0.2 —— pre-existing，与本 plan 无关
  - apps/{auth,blog} nuxt devtools 链路下 `vite-plugin-inspect` / `vite-plugin-vue-tracer` 要求 `vite@^6||^7`，仓实装 vite@8.0.8 —— pre-existing
  - `prisma 7.4.2 > @prisma/config > c12` 要求 `magicast@^0.3.5`，仓实装 0.5.1 —— pre-existing
  - **drizzle-orm peer 零警告**：better-auth 1.6.4 起的 `drizzle-orm@^0.45.2` 要求被 packages/db 的 `drizzle-orm@0.45.2` 稳稳满足，RESEARCH.md §Changelog 的判断成立。
- **Turbo cache miss**：首次 `pnpm turbo run build` 因升级清了 better-auth 的哈希，全部 10 个 task 走 cache miss（1m58s）。预期行为，无影响。

## Threat Flags

无。本 plan 不新增任何攻击面 —— 升级是 supply-chain 路径内的版本基线对齐；T-01-13 / T-01-14 / T-01-15 的 mitigation 全部落地（changelog 审完、npm 官源 + lockfile integrity、frozen-lockfile 断言 4 + 1 同 commit）。

## User Setup Required

None — better-auth 升级对运行时配置透明（secret 名称、cookie 配置、provider 配置均未变）。

## Next Phase Readiness

- **Plan 01-05**（手动 cookie 冒烟）可直接启动 —— 升级后端不再有 APIError 情况下丢 Set-Cookie（1.6.7）、OAuth 回调不再下发重复 Set-Cookie（1.6.10），冒烟脚本如有针对这两点的断言会更稳。
- **Plan 01-06**（phase gate 最后签字）在本 plan PR merge 后即可跑 —— 升级 PR 与 Gateway 重构 PR（Plan 02）保持独立，维持两次独立回滚位点（objective 要求）。
- **Deferred items**：`deferred-items.md` 登记的 2 项（dashboard vite.config.js build 副作用、crawler turbo outputs 警告）不阻塞 phase 1，后续 dashboard/infra 类 plan 统一处理。

## Self-Check: PASSED

**1. Created files exist**
- `.planning/phases/01-auth-gateway/01-04-SUMMARY.md`: FOUND (this file)
- `.planning/phases/01-auth-gateway/deferred-items.md`: FOUND

**2. Commit exists**
- `6f902a7` (chore(01-04): upgrade better-auth to ^1.6.10 across four apps): FOUND in `git log --oneline`

**3. Verification artifacts**
- `grep '"better-auth": "^1.6.10"' apps/{api,auth,blog,dashboard}/package.json`: 4 matches (expected 4)
- `grep '"better-auth": "^1.6.2"' apps/{api,auth,blog,dashboard}/package.json`: 0 matches (expected 0)
- `grep 'better-auth@1.6.10:' pnpm-lock.yaml`: 1 match
- `git diff --exit-code apps/api/src/lib/auth.ts apps/api/src/middleware/auth.ts`: exit 0
- `pnpm turbo run {type-check,test,build}`: 9/5/10 tasks successful; 652/652 tests passed

---
*Phase: 01-auth-gateway*
*Completed: 2026-05-10*
