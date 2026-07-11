# R2 Storage Audit Dry Run Contract

## Executive Summary

本文件固定 Phase 6 的人类可读 dry-run 报告结构。它是 `packages/crawler/scripts/audit-r2-storage.ts` 的 Markdown 输出契约，不是本次执行已经拿到的 live R2 truth。

- 真实 `object_count`、`rough_size_bytes`、`oldest_last_modified`、`newest_last_modified`、`db_reference_hits` 必须在提供 Cloudflare 只读凭据后由脚本 dry-run 填充。
- 本文件里的 sample key 只用于说明 prefix shape 和字段含义，不能当作 live inventory 证据。
- `comics/<slug>` 与 `comics/<slug>/<chapter>` 必须始终分成两条独立记录，禁止折叠成单一泛化 `comics/` 行。

## Prefix Matrix

| Prefix | Source Kind | Writer | Object Count | Rough Size Bytes | Sample Keys | DB Reference Status | DB Reference Hits | Delete Risk | Cost Risk | Combined Recommendation |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | --- | --- | --- |
| `images/` | `runtime_prefix_group` | Generic API upload route | `TBD_LIVE_RUN` | `TBD_LIVE_RUN` | `images/2026-07-12-example.png` | `missing_credentials` | `TBD_LIVE_RUN` | `high` | `high` | Inventory first, then classify or migrate before any cleanup. |
| `mappings/` | `runtime_prefix_group` | MappingFileManager; admin crawler API; verification scripts | `TBD_LIVE_RUN` | `TBD_LIVE_RUN` | `mappings/actor-name-map.json` | `not_applicable` | `TBD_LIVE_RUN` | `medium` | `medium` | Keep for active mapping workflows and audit backup growth separately. |
| `mappings/backups/` | `runtime_prefix_group` | MappingFileManager; admin crawler API; verification scripts | `TBD_LIVE_RUN` | `TBD_LIVE_RUN` | `mappings/backups/actor-name-map-1720000000000.json` | `not_applicable` | `TBD_LIVE_RUN` | `low` | `high` | Treat as restricted backups with explicit growth controls. |
| `comics/<slug>` | `runtime_prefix_group` | comic-crawler cover processing | `TBD_LIVE_RUN` | `TBD_LIVE_RUN` | `comics/demo-slug/cover-original.webp` | `missing_credentials` | `TBD_LIVE_RUN` | `high` | `medium` | Keep distinct from chapter-body mirrors and verify cover references first. |
| `comics/<slug>/<chapter>` | `runtime_prefix_group` | comic-crawler chapter page processing | `TBD_LIVE_RUN` | `TBD_LIVE_RUN` | `comics/demo-slug/chapter-1/001-original.webp` | `missing_credentials` | `TBD_LIVE_RUN` | `critical` | `critical` | Forbidden-risk baseline: do not delete until reader/API callers migrate away from R2 URLs. |
| `system/` | `runtime_prefix_group` | Search index build script | `TBD_LIVE_RUN` | `TBD_LIVE_RUN` | `system/search-index.json` | `not_applicable` | `TBD_LIVE_RUN` | `high` | `medium` | Classify operational ownership before cleanup. |
| `ops/d1-backups/` | `runtime_prefix_group` | deploy-migrations backup step | `TBD_LIVE_RUN` | `TBD_LIVE_RUN` | `ops/d1-backups/starye-db-12345-1.sql` | `not_applicable` | `TBD_LIVE_RUN` | `critical` | `medium` | Treat as operations backups with restore/retention review before cleanup. |

## Runtime Write Paths

- `images/`: `apps/api/src/routes/upload/index.ts` -> `POST /api/upload`
- `mappings/`: `packages/crawler/src/lib/mapping-file-manager.ts` -> crawler save mappings
- `mappings/backups/`: `packages/crawler/src/lib/mapping-file-manager.ts` -> backup writes
- `comics/<slug>`: `packages/crawler/src/crawlers/comic-crawler.ts` -> cover processing
- `comics/<slug>/<chapter>`: `packages/crawler/src/crawlers/comic-crawler.ts` -> chapter page processing
- `system/`: `packages/crawler/scripts/build-search.ts` -> search index upload
- `ops/d1-backups/`: `.github/workflows/deploy-migrations.yml` -> D1 backup upload

## Docs-Declared Entries

- `docs/r2-mapping-storage-setup-guide.md`
- `docs/r2-mapping-storage-implementation-report.md`
- `docs/r2-mapping-quick-deploy-guide.md`
- `docs/r2-mapping-env-vars-guide.md`
- `docs/r2-mapping-deployment-checklist.md`
- `docs/r2-mapping-usage-examples.md`
- `docs/task-15.7-r2-storage-completion-summary.md`

## DB Reference Checks

| Prefix | Expected Lookup Strategy | Possible Referenced Tables/Fields | Missing-Credential Behavior |
| --- | --- | --- | --- |
| `images/` | Match `media.key` by prefix and public URL fields by URL prefix | `media.key`, `media.url`, `post.cover_image`, `comic.cover_image`, `movie.cover_image`, `actor.avatar`, `actor.cover`, `publisher.logo`, `user.image`, `page.image_url` | Must mark `db_reference_status=missing_credentials` or `partial`; never fake `0 hits`. |
| `mappings/` | Runtime-only prefix; no D1 table map in Phase 6 | `n/a` | Use `db_reference_status=not_applicable`. |
| `mappings/backups/` | Runtime-only prefix; no D1 table map in Phase 6 | `n/a` | Use `db_reference_status=not_applicable`. |
| `comics/<slug>` | Match cover-style keys and public URLs | `media.key`, `media.url`, `comic.cover_image` | Must preserve missing-context reason if `R2_PUBLIC_URL` is absent. |
| `comics/<slug>/<chapter>` | Match chapter-body keys and public URLs | `media.key`, `media.url`, `page.image_url` | Missing D1 or public-URL context must stay explicit. |
| `system/` | No D1 table map in Phase 6 | `n/a` | Use `db_reference_status=not_applicable`. |
| `ops/d1-backups/` | No D1 table map in Phase 6 | `n/a` | Use `db_reference_status=not_applicable`. |

## No-Delete Confirmation

- 本报告只允许来自 `audit-r2-storage.ts` 的 read-only inventory 与可选 D1 read-only 查询。
- 本 phase 不做 object delete、lifecycle apply、upload enforcement、DB 字段改名或 R2 deletion。
- 任何 future cleanup phase 必须基于本报告重新跑 live dry-run，而不是依赖旧模板或人工记忆。

## Follow-up Candidates

- `images/`: 历史泛化前缀，需要 live inventory + DB 引用核验后再决定迁移或清理策略。
- `mappings/backups/`: 需要 retention / count / lifecycle 策略，但本 phase 不应用任何 lifecycle。
- `comics/<slug>`: 需要确认 cover 资产最终归属和命名边界。
- `comics/<slug>/<chapter>`: forbidden-risk baseline，后续 phase 必须先消除 reader/API 对现有 R2 URL 的依赖。
- `system/`: 需要单独运维分类。
- `ops/d1-backups/`: 需要 restore policy、retention policy 与 cleanup 前置验证。
