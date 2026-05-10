# Phase 01 — Deferred Items

Items discovered during execution that are out of scope for the current plan.
These are pre-existing issues, not regressions introduced by phase-01 work.

## From Plan 01-04 (better-auth 1.6.2 → 1.6.10)

### 1. `apps/dashboard/vite.config.js` 被 tsc 覆盖为非 antfu 格式

- **发现时机**：Plan 01-04 Task 2，执行 `pnpm turbo run build` 后
- **现象**：dashboard 的 `build` 脚本为 `vue-tsc -b && vite build`，会把仓内 tracked 的
  `apps/dashboard/vite.config.ts` 编译成 `apps/dashboard/vite.config.js`（覆盖式写回），
  导致每次 build 后 `git status` 都显示该文件脏。其内容与仓内 antfu-eslint 规范化后的
  版本（单引号、无分号、两空格）不一致（分号、四空格缩进），说明仓内版本曾被手工改过或
  tsconfig 曾关闭过编译输出。
- **范围判定**：与 better-auth 升级无关（升级前就存在）。恢复方式：`git checkout --
  apps/dashboard/vite.config.js`。
- **建议处理**：在后续 dashboard 相关 plan 里统一其一：
  1. 把 `vite.config.ts` 从 `tsconfig.json` 的 include 里排除，避免被 `vue-tsc -b`
     产出覆盖；或
  2. 把 `vite.config.js` 加入 `.gitignore`（保留 `.ts` 为源）；
  3. 或删除 `vite.config.ts`，只保留 `.js`。
- **风险**：低 —— 不影响运行时；只是每次本地/CI build 后 worktree 被污染，易与真实改动
  混淆。

### 2. `@starye/crawler#build` turbo outputs 警告

- **现象**：`pnpm turbo run build` 末尾 warning `no output files found for task
  @starye/crawler#build. Please check your 'outputs' key in 'turbo.json'`。
- **范围判定**：既有 turbo 配置缺失，与 better-auth 升级无关。
- **建议处理**：后续在 turbo.json 中为 `@starye/crawler#build` 显式声明 outputs（crawler
  走 tsx 执行 TS 源，无编译产物，可将 outputs 置空数组 `[]`）。
