# Deferred Items — Phase 01 Auth Gateway

本文件记录执行过程中发现但超出当前 plan 范围的问题，避免阻塞 plan 推进。

## 01-01 执行期（Nyquist 骨架 plan）

### DI-01: `apps/api` pnpm type-check 失败（pre-existing）

- **现象**：运行 `pnpm --filter api type-check` 报大量 `TS6305 Output file ... has not been built` + 若干 `TS7006 implicit any` 错误。
- **根因**：
  - TS6305 由 `packages/db/dist` 未产出触发（composite project 引用）——全新 worktree 从未 `pnpm build` 过 db 包。
  - TS7006 存在于 `routes/public/movies/index.ts` / `routes/public/progress/index.ts` / `routes/public/series/index.ts` / `routes/ratings/services/rating.service.ts` / `routes/publishers/services/publisher.service.ts` —— Drizzle 回调参数 `ch/p/res/mp/ma/players` 缺显式类型。
- **验证 pre-existing**：在 `01-01-PLAN.md` 所有改动 `git stash -u` 的基线上运行 `pnpm type-check` 仍失败（相同 TS6305 / TS7006 清单）。
- **与本 plan 关系**：`apps/api/src/routes/auth/__tests__/signout.test.ts` 自身不贡献任何 type-check error（`grep signout` 上方 type-check 输出为空），import 解析正常（Vitest `pnpm test` 287 passed + 3 todo）。
- **处置**：不在 01-01 范围内修。建议在 `apps/api` 日常维护 wave 或下一个 api 相关 phase 单独修复（`pnpm --filter @starye/db build` + 批量补 Drizzle 回调类型）。
