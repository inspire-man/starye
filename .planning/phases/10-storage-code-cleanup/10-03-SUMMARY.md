---
phase: 10-storage-code-cleanup
plan: "03"
subsystem: legacy-script-contracts
tags: [storage, scripts, regressions, policy]
requirements-completed:
  - CODE-03
  - CODE-04
completed: 2026-07-13
status: complete
---

# Phase 10 Plan 03 Summary

## Accomplishments

- `packages/crawler/scripts/backfill-covers.ts` 的默认叙事改成 policy-aware：managed asset 是 allowed path，合法 external URL 也是成功终态；日志不再把 CDN/R2 当唯一正确结果。
- `packages/crawler/scripts/test-full-flow.ts` 和 `packages/crawler/scripts/test-single-movie.ts` 的 smoke checklist 改为 “coverImage 符合当前 storage policy”，不再把 “必须是 R2 URL” 写成唯一验收标准。
- 复跑 Phase 7 protected coverage：`public-comics.test.ts` 和 `Reader.test.ts`，确认 shared helper 收口、pending heuristics 修正和脚本文案调整没有把 external-image contract 拉回旧状态。

## Verification

- `rg -n "policy-compatible|managed|external|coverImage|JavBus|R2|CDN" packages/crawler/scripts/backfill-covers.ts packages/crawler/scripts/test-full-flow.ts packages/crawler/scripts/test-single-movie.ts`
- `pnpm --filter @starye/crawler exec tsc --noEmit`
- `pnpm --filter api exec vitest run src/routes/public/comics/__tests__/public-comics.test.ts`
- `pnpm --filter @starye/comic-app exec vitest run src/views/__tests__/Reader.test.ts`

## Notes

- 本 plan 没有新增新的上传流程或 live crawler integration test，只修正脚本说明、日志口径和受保护回归矩阵。
- `backfill-covers.ts` 继续优先走 managed asset 路径，但当 R2 不可用或上传失败时，external URL 明确被视为 policy-compatible fallback，而不是“次级但不正确”的结果。
