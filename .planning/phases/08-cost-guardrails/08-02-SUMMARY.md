---
phase: 08-cost-guardrails
plan: 02
subsystem: crawler-purpose-policy
tags: [crawler, upload, r2, purpose-policy, regression]
requirements-completed:
  - COST-02
completed: 2026-07-13
---

# Phase 8 Plan 02 Summary

## Accomplishments

- `packages/crawler/src/lib/image-processor.ts` 把 `ImageProcessor.process()` 改成显式 purpose-aware object contract，并新增 `assertAllowedCrawlerImageTarget()` / `buildApprovedCrawlerPrefix()` 作为上传边界守门点。
- `cover` 现在只允许 `movies/<code>` 和 `comics/<slug>`；`avatar` 只允许 `actors/<id>`；`logo` 只允许 `publishers/<id>`；显式 `comic_chapter_page` intent 与 chapter-like namespace 会在上传前同步失败。
- `optimized-crawler.ts`、`comic-crawler.ts`、`actor-crawler.ts`、`publisher-crawler.ts`、`backfill-covers.ts`、`test-single-movie.ts` 全部切到同一 purpose contract。
- `packages/crawler/test/image-processor-purpose-policy.test.ts` 与 `src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts` 共同锁住“allowed cover/avatar/logo + forbidden chapter-page target”回归面。

## Verification

- `pnpm --filter @starye/crawler exec vitest run test/image-processor-purpose-policy.test.ts src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts`
- `pnpm --filter @starye/crawler exec tsc --noEmit`
- `rg -n "purpose: 'cover'|purpose: 'avatar'|purpose: 'logo'|comic_chapter_page|buildApprovedCrawlerPrefix" packages/crawler/src packages/crawler/scripts packages/crawler/test`

## Notes

- 这次改动保留了 movie/comic cover、actor avatar、publisher logo 的现有 preview URL 回写语义，只把 namespace/purpose 的合法性前移到 `ImageProcessor` 边界。
- 章节正文图继续停留在 source/external URL 语义，不重新进入 R2。
