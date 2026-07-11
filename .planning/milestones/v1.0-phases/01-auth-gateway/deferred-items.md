# Deferred Items — Phase 01 Auth Gateway

本文件记录执行过程中发现但超出当前 plan 范围的问题，避免阻塞 plan 推进。
These are pre-existing issues, not regressions introduced by phase-01 work.

## 01-01 执行期（Nyquist 骨架 plan）

### DI-01: `apps/api` pnpm type-check 失败（pre-existing）

- **现象**：运行 `pnpm --filter api type-check` 报大量 `TS6305 Output file ... has not been built` + 若干 `TS7006 implicit any` 错误。
- **根因**：
  - TS6305 由 `packages/db/dist` 未产出触发（composite project 引用）——全新 worktree 从未 `pnpm build` 过 db 包。
  - TS7006 存在于 `routes/public/movies/index.ts` / `routes/public/progress/index.ts` / `routes/public/series/index.ts` / `routes/ratings/services/rating.service.ts` / `routes/publishers/services/publisher.service.ts` —— Drizzle 回调参数 `ch/p/res/mp/ma/players` 缺显式类型。
- **验证 pre-existing**：在 `01-01-PLAN.md` 所有改动 `git stash -u` 的基线上运行 `pnpm type-check` 仍失败（相同 TS6305 / TS7006 清单）。
- **与本 plan 关系**：`apps/api/src/routes/auth/__tests__/signout.test.ts` 自身不贡献任何 type-check error（`grep signout` 上方 type-check 输出为空），import 解析正常（Vitest `pnpm test` 287 passed + 3 todo）。
- **处置**：不在 01-01 范围内修。建议在 `apps/api` 日常维护 wave 或下一个 api 相关 phase 单独修复（`pnpm --filter @starye/db build` + 批量补 Drizzle 回调类型）。
- **Plan 01-04 佐证**：01-04 改走 `pnpm turbo run type-check` 后全仓零错；证实 `pnpm -r type-check` 直接跑（绕过 turbo `^build`）的失败是 turbo composite 依赖问题，与源码无关。

## 01-04 执行期（better-auth 1.6.2 → 1.6.10）

### DI-02: `apps/dashboard/vite.config.js` 被 tsc 覆盖为非 antfu 格式

- **发现时机**：Plan 01-04 Task 2，执行 `pnpm turbo run build` 后
- **现象**：dashboard 的 `build` 脚本为 `vue-tsc -b && vite build`，会把仓内 tracked 的
  `apps/dashboard/vite.config.ts` 编译成 `apps/dashboard/vite.config.js`（覆盖式写回），
  导致每次 build 后 `git status` 都显示该文件脏。其内容与仓内 antfu-eslint 规范化后的
  版本（单引号、无分号、两空格）不一致（分号、四空格缩进），说明仓内版本曾被手工改过或
  tsconfig 曾关闭过编译输出。
- **范围判定**：与 better-auth 升级无关（升级前就存在）。恢复方式：`git checkout -- apps/dashboard/vite.config.js`。
- **建议处理**：在后续 dashboard 相关 plan 里统一其一：
  1. 把 `vite.config.ts` 从 `tsconfig.json` 的 include 里排除，避免被 `vue-tsc -b` 产出覆盖；或
  2. 把 `vite.config.js` 加入 `.gitignore`（保留 `.ts` 为源）；
  3. 或删除 `vite.config.ts`，只保留 `.js`。
- **风险**：低 —— 不影响运行时；只是每次本地/CI build 后 worktree 被污染，易与真实改动混淆。

### DI-03: `@starye/crawler#build` turbo outputs 警告

- **现象**：`pnpm turbo run build` 末尾 warning `no output files found for task @starye/crawler#build. Please check your 'outputs' key in 'turbo.json'`。
- **范围判定**：既有 turbo 配置缺失，与 better-auth 升级无关。
- **建议处理**：后续在 turbo.json 中为 `@starye/crawler#build` 显式声明 outputs（crawler 走 tsx 执行 TS 源，无编译产物，可将 outputs 置空数组 `[]`）。

## Phase 1 Code Review 延期项（归 Phase 2 处理）

以下 6 条来源于 `.planning/phases/01-auth-gateway/01-REVIEW.md` 的 WARNING 级 finding。CR-01/02/WR-01/02 已在本 phase 用 `fix(01-review)` + `test(01-review)` 两条 commit 闭合（e7fce45 / 9a4dd1c）。WR-03..08 与 Phase 2（auth 跨端守卫 / `requireAuth` 统一化）天然同域，推迟到 Phase 2 一并收。

### DI-04: WR-03 — SSR middleware 静态资源过滤过于宽松

- **现象**：`apps/blog/server/middleware/session.ts:22` 与 `apps/auth/server/middleware/session.ts:22` 用 `url.pathname.includes('.')` 判定静态资源，会误伤 slug 里带点的文章路径（例如 `/posts/v1.2.0-release`、`/2024.10.01`）。
- **影响**：这类路径的 SSR 预取被跳过，首帧可能闪现匿名态 → 与 AUTH-02 "无闪烁" 不变量打架（但当前 blog 未上该类路径，真实触发概率低）。
- **建议处理**：Phase 2 抽 `packages/auth-ssr/` 时顺手修为 `pathname.match(/\.[a-z0-9]+$/i)`，仅匹配真实扩展名。

### DI-05: WR-04 — `apiUrl` 未校验即 `as string` 转发

- **现象**：`apps/blog/server/middleware/session.ts:33`、`apps/auth/server/middleware/session.ts:33` 读 `config.public.apiUrl as string`。若 runtimeConfig 注入失败，`apiUrl` 是 `undefined`，`$fetch` 会退化为相对路径打 Nuxt 自身，配置错误被 catch 吞掉。
- **影响**：Phase 2 生产部署故障排障会变难。
- **建议处理**：开头校验 `typeof apiUrl !== 'string' || !apiUrl` 直接降级 session=null + `console.error`。

### DI-06: WR-05 — blog e2e 断言 `$ssession` 存在 tautology 风险

- **现象**：`apps/blog/e2e/session.spec.ts:137` 用 `expect(nuxtState?.$ssession ?? null).toBeNull()`；Nuxt 4 的 useState key 序列化名字依赖构建版本，若 key 变断言永真。
- **影响**：D-03 "降级匿名" 不变量未被严锚，但已有 DOM 可见性 + `waitUntil:'commit'` + sessionRequests 计数等三条活锚点托底。
- **建议处理**：`Object.keys(nuxtState).find(k => k.toLowerCase().endsWith('session'))` 先锁 key 再断言 null。

### DI-07: WR-06 — dashboard 跨路径测试的强断言被条件化

- **现象**：`apps/dashboard/e2e/auth-crosspath.spec.ts:68-74` 的 `if (userId !== null) { expect(userId).toBe('user-1') }`——`[data-user-id]` 属性一旦丢了整条强断言跳过，只剩 `sessionRequests >= 1`。
- **影响**：D-19 step 4 的"同一 user.id 跨端读到"弱化为"至少发了 session 请求"。
- **建议处理**：Phase 2 里在 dashboard 入口加 `data-testid="current-user"` 作为 e2e 稳定契约，然后去掉 `if` 条件化。

### DI-08: WR-07 — signout.test.ts 只验 mock，未触达真实 Set-Cookie 格式

- **现象**：`apps/api/src/routes/auth/__tests__/signout.test.ts:27-51, 89-103` 的 `createSignOutCapableAuth` 自维护内存变量，D-15 #2/#3 实际在断言 mock 自洽。better-auth 1.6.10 真实 Set-Cookie 格式 + D1 session 行删除没被 integration 覆盖。
- **影响**：better-auth 后续小版本升级的回归面空缺；但 D-19 step 6 手动冒烟 + Phase 2 `requireAuth` E2E 会覆盖。
- **建议处理**：Phase 2 引入 `memoryAdapter(...)` + 真实 `betterAuth({...})` 做一次 integration smoke；本 phase signout.test.ts 顶部 JSDoc 当前已注明 "只覆盖路由转发层"。

### DI-09: WR-08 — blog 与 auth 的 session middleware / plugin 字节重复

- **现象**：`apps/blog/server/middleware/session.ts` ↔ `apps/auth/server/middleware/session.ts` 1-50 行逐字节一致；plugin 同样。
- **影响**：任一方补 bug（DI-04 / DI-05 修正）必须手工同步，易漂移。
- **建议处理**：Phase 2 抽到 `packages/auth-ssr/` + `packages/auth-ssr-nuxt-plugin/`，两 app 薄壳 import。短期内接受双写，已在 01-03-SUMMARY 记录为 Pattern A/B。

## 外部 Infra（不在 Phase 1 / Phase 2 范围，独立 chore 处理）

### DI-10: worktree husky hook 缺 shebang

- **现象**：01-06 continuation agent 报告 worktree 的 `core.hooksPath` 指向 main repo `.husky/`，其中两个 hook 缺 shebang，导致 worktree commit 偶发 `Exec format error`。
- **影响**：agent commit 有时需临时 `git -c core.hooksPath=.husky`。
- **建议处理**：独立 chore 修 `.husky/pre-commit` 与 `.husky/commit-msg` 的 shebang，与 Phase 1 / Phase 2 均无业务耦合。
