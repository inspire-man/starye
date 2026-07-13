---
phase: 10-storage-code-cleanup
plan: "02"
subsystem: crawler-and-admin-runtime-adoption
tags: [storage, crawler, admin, heuristics]
requirements-completed:
  - CODE-01
  - CODE-02
  - CODE-03
completed: 2026-07-13
status: complete
---

# Phase 10 Plan 02 Summary

## Accomplishments

- `packages/crawler/src/lib/image-processor.ts` 不再维护独立 namespace policy，改为通过 shared helper 解析 managed asset prefix；`process(target)`、`ImageProcessor` 构造和对外 seam 保持兼容。
- `packages/crawler/test/image-processor-purpose-policy.test.ts` 增加了 leading/trailing slash normalization regression，证明 crawler seam 现在直接吃 shared semantics。
- `apps/api/src/routes/admin/actors/index.ts` 与 `apps/api/src/routes/admin/publishers/index.ts` 把 pending heuristics 从 “不是 R2 就待修复” 改成 “缺资产或 URL 无效才待修复”；合法 external URL 不再被错标。
- 新增 actor / publisher pending focused tests，覆盖 external-valid 不再进入 update 队列、missing asset 仍保留 update 标记、原有 recrawl / uncrawled 行为不回退。

## Verification

- `pnpm --filter @starye/crawler exec vitest run test/image-processor-purpose-policy.test.ts`
- `pnpm --filter @starye/crawler exec tsc --noEmit`
- `pnpm --filter api exec vitest run src/routes/admin/actors/__tests__/pending.test.ts src/routes/admin/publishers/__tests__/pending.test.ts`
- `pnpm --filter api exec tsc --noEmit`

## Notes

- `needsAvatarUpdate` / `needsLogoUpdate` 字段名保持不变，避免扩大 dashboard / crawler consumer blast radius；修正的是内部语义，不是对外字段。
- actor pending route 仍然保留 “非 SeesaaWiki 数据源需 recrawl” 的优先级路径，publisher pending route 仍然保留 “未爬取即 pending” 的基础行为。
