---
phase: 07-comic-external-image-flow
plan: 01
subsystem: crawler-sync
tags: [crawler, comic, external-images, r2, sync]
requirements-completed:
  - COMIC-01
  - COMIC-02
completed: 2026-07-13
---

# Phase 7 Plan 01 Summary

## Accomplishments

- `packages/crawler/src/strategies/site-92hm.ts` 增加章节图片 URL 标准化，统一做 trim、空值过滤、绝对化、query 保留和标准化后去重。
- `packages/crawler/src/crawlers/comic-crawler.ts` 切断章节正文图的 `ImageProcessor.process()` 路径，章节 sync payload 改为直接写入 source/external URLs。
- 封面上传改成显式 opt-in：`packages/crawler/src/index.ts` 通过 `UPLOAD_COMIC_COVERS_TO_R2` 向 `ComicCrawler` 传入 `uploadCoversToR2`，默认保留源站封面 URL。
- `apps/api/src/routes/admin/sync/handlers.ts` 为章节页替换加上 empty / regressed guard 和失败回滚，避免 delete-first 抹掉历史页面。

## Verification

- `pnpm --filter @starye/crawler exec vitest run test/site-92hm-chapter-content.test.ts`
- `pnpm --filter @starye/crawler exec vitest run src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts`
- `pnpm --filter api exec vitest run src/routes/admin/sync/__tests__/handlers.test.ts`
- `pnpm --filter @starye/crawler exec tsc --noEmit`

## Known Blockers

- `pnpm --filter api exec tsc --noEmit` 仍受仓库既有 `packages/db/dist` 声明缺失和大量历史 `implicit any` 噪音影响，不是本 plan 新引入的问题。

## Notes

- Phase 7 的章节正文图语义已固定为 source/external URL，不再允许 placeholder 或“已上传”语义混入 `pages.imageUrl`。
- 封面与正文图的边界现在有显式配置面，后续 Phase 8/10 可以围绕这条边界继续做成本 guardrail 与命名收敛。
