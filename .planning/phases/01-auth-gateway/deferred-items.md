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
