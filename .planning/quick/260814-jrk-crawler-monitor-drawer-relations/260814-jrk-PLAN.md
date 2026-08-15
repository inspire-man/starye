---
quick: 260814-jrk-crawler-monitor-drawer-relations
date: 2026-08-14
status: complete
---

# 爬虫监控与关联入库优化

## Objective

清理本地未同步到封面的历史 fixture，验证女优与厂商关联同步真实写入 D1；将 Dashboard 列表统一为表格 + 右侧详情抽屉，并把爬虫任务历史改为视频/漫画 tabs。

## Tasks

### 1. 本地数据清理与关联入库验证

- Read the exact local D1 rows with `cover_image IS NULL` and confirm they are historical fixture records before deleting.
- Delete only those movie rows in a transaction, preserve referenced actor/publisher rows, and verify movie/player/relation counts after deletion.
- Add publisher relation coverage beside the existing actor integration test: publisher row, `movie_publisher`, movie count, idempotence, and related movie readback.
- Run the focused actor and publisher sync integration tests through the existing workspace test command.

### 2. Shared detail drawer and list-page adoption

- Add a reusable `DetailDrawer` to `@starye/ui` with overlay, close button, keyboard-friendly semantics, scrollable body, and responsive full-width mobile behavior.
- Convert crawler execution details, movie edit/player details, comic edit/chapter details, actor/publisher edit details, and audit log details from centered modal/inline surfaces to the shared right drawer.
- Keep existing API calls, mutation semantics, confirmation dialogs, and list row/action behavior intact while making the drawer open only after a row/task selection.

### 3. Task history tabs/table and regression verification

- Replace crawler task cards with two permission-aware tabs (`视频任务历史`, `漫画任务历史`) and a table with a right-side operation column.
- Keep terminal lifecycle tasks actionable through the existing archive endpoint, expose an icon delete/archive action in the row, and keep run/history/audit facts in the selected task drawer.
- Update focused Dashboard tests for explicit row selection and terminal archive action; run typecheck/tests and verify the local Dashboard through `http://localhost:8080/dashboard/...`.

## Verification

- GitNexus impact was run before editing: `loadTaskPanel` MEDIUM, `selectRun` LOW, `sync.service.ts:syncMovieData` LOW, no HIGH/CRITICAL result.
- Before commit run GitNexus `detect_changes` and confirm only the intended UI, sync test, and local data evidence files are affected.
