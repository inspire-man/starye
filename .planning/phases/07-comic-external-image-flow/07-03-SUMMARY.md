---
phase: 07-comic-external-image-flow
plan: 03
subsystem: reader
tags: [comic-app, reader, external-images, progress, failure-ux]
requirements-completed:
  - COMIC-04
completed: 2026-07-13
---

# Phase 7 Plan 03 Summary

## Accomplishments

- `apps/comic-app/src/views/Reader.vue` 从一维 `images: string[]` 直渲染升级为稳定的逐页 view-model，页容器成为滚动、页码和失败 UI 的共同基准。
- Reader 增加单页失败卡片、顶部部分失败汇总、整章失败态、失败页重试与打开原图动作，同时保留 `loading="lazy"`、进度读取、debounce 保存和 `pagehide` flush。
- completed 判定改为“至少一页成功加载且读到末页”才允许写入 `completed=true`，防止空章节或全失败章节被误记为已读完。
- `apps/comic-app/src/views/__tests__/Reader.test.ts` 用事件驱动覆盖章节加载失败、单图失败、部分失败、整章失败、空数组、`pagehide` 保存和 0 成功页 completed 保护。

## Verification

- `pnpm --filter @starye/comic-app exec vitest run src/views/__tests__/Reader.test.ts`
- `pnpm --filter @starye/comic-app exec vue-tsc --noEmit`

## Known Blockers

- 无新的 plan blocker。真实浏览器下的 Gateway smoke 仍建议在后续 verify-work 或 release smoke 中执行一次，以覆盖实际远端 host 的网络条件。

## Notes

- `handleScroll()` 和 `scrollToPage()` 现在基于 `.reader-page`，失败页卡片不会再破坏页码检测。
- Reader 顶部页码在空章节时显示 `0 / 0`，避免旧实现出现 `1 / 0` 这类误导状态。
