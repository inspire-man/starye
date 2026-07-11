# Phase 06 R2 Write Inventory

## Purpose and Scope

本文件落实 `06-CONTEXT.md` 中的 D-07 与 D-09：逐条盘点 live repo 当前可见的 R2 write entry，并把 owner module、direct caller、generated key prefix、DB write/reference behavior、documentation references、risk classification、runnable risk classification 固定成后续 cleanup phase 可复用的证据表。

- 只记录 live repo 可证实的 runtime / script / workflow 写入入口。
- 不把历史文档声明直接当成 live truth；历史声明单独放在 `06-RISK-BASELINES.md`。
- 本 phase 只盘点，不删除对象，不改 prefix，不修改 upload behavior。

## Executive Summary

当前仓库里与 R2 直接相关的 live write paths 可以分成五类：

1. API 通用上传：`/api/upload` 直接写入历史泛化前缀 `images/`，并写 `media.key` / `media.url` 元数据。
2. crawler 图片处理：`ImageProcessor` 被 `comic-crawler` 调用时会把 cover 与 chapter body images 都写入 `comics/<slug>` 相关前缀，其中 chapter 路径属于 forbidden-risk baseline。
3. mapping 持久化：crawler、API 管理端和验证脚本都会写 `mappings/` 与 `mappings/backups/`。
4. system / operations 例外：搜索索引脚本写 `system/search-index.json`，migration workflow 把 D1 备份写到 `ops/d1-backups/`。
5. one-off / verification / historical scripts：存在用于验证、部署说明或历史落地的写路径入口，必须按 D-09 区分 `production schedule`、`manual operation`、`test verification`、`historical script`，避免把“曾经能写”误读成“当前常规生产路径”。

## Runnable Risk Classes

| Class | Meaning | Typical trigger |
|-------|---------|-----------------|
| `production schedule` | 已接入 GitHub Actions schedule 或成功后自动执行的生产路径 | cron workflow、生产爬虫尾步骤 |
| `manual operation` | 需要人工触发的后台/API/CLI/`workflow_dispatch` 路径 | dashboard 操作、手动脚本、部署流程 |
| `test verification` | 验证或测试脚本，设计目的不是常规生产写入 | verify/test 脚本 |
| `historical script` | 历史文档、已漂移流程或不再被当前生产 workflow 引用的写路径 | 历史总结、旧部署说明 |

## Runtime Inventory Matrix

| Write entry | Owner module or script | Direct caller | Generated key prefix | DB write/reference behavior | Documentation references | Risk classification | Runnable risk classification | Evidence |
|-------------|------------------------|---------------|----------------------|-----------------------------|--------------------------|--------------------|------------------------------|----------|
| Generic API upload | `apps/api/src/routes/upload/index.ts` | `POST /api/upload`; dashboard `PostEditor.vue` 直接 `fetch('/api/upload')`; dashboard `api.upload.direct()` 走 `${API_BASE}/upload` | `images/<timestamp>-<nanoid>.<ext>` | 成功上传后向 `media` 表插入 `key` / `url` / `mimeType` / `size`；DB 失败时不回滚 R2 上传 | `06-CONTEXT.md` D-07/D-09, `06-STORAGE-POLICY.md` `images/` historical risk | `historical risk` | `manual operation` | `apps/api/src/routes/upload/index.ts` |
| Dashboard stale presign assumption | `apps/dashboard/src/lib/api.ts` | `api.upload.presign()` 调 `POST /upload/presign` | none in live server code | 无 live server DB 写入；当前更像 stale client assumption，不应计作有效 write path | 需与 `06-RISK-BASELINES.md` 联动 | `stale assumption boundary` | `historical script` | `apps/dashboard/src/lib/api.ts` |
| Comic cover asset upload | `packages/crawler/src/lib/image-processor.ts` via `packages/crawler/src/crawlers/comic-crawler.ts` | `comic-crawler` 在 `info.cover` 存在时调用 `imageProcessor.process(info.cover, \`comics/${info.slug}\`, 'cover')` | `comics/<slug>/cover-{thumb|preview|original}.webp` | crawler 后续把处理结果用于 comic metadata 同步；属 asset-style path，但当前仍落在 `comics/` 语义下，后续 phase 需与 canonical allowlist 对齐 | `06-CONTEXT.md`, `06-RESEARCH.md`, `06-STORAGE-POLICY.md` forbidden-risk baseline notes | `restricted pending classification` | `production schedule` | `packages/crawler/src/crawlers/comic-crawler.ts`, `packages/crawler/src/lib/image-processor.ts`, `.github/workflows/daily-manga-crawl.yml` |
| Comic chapter body image upload | `packages/crawler/src/lib/image-processor.ts` via `packages/crawler/src/crawlers/comic-crawler.ts` | `comic-crawler` 在章节批处理中调用 `imageProcessor.process(rawUrl, \`comics/${info.slug}/${chapter.slug}\`, '001')` 等 | `comics/<slug>/<chapter>/<page>-{thumb|preview|original}.webp` | 处理结果 URL 被塞进 `syncChapterData` payload 的 `images` 数组，最终写入 `pages.image_url`，并经 public comics API 暴露为 `images: string[]` | `06-CONTEXT.md` D-10, `06-STORAGE-POLICY.md` forbidden-risk baseline | `forbidden-risk baseline` | `production schedule` | `packages/crawler/src/crawlers/comic-crawler.ts`, `apps/api/src/routes/admin/sync/handlers.ts`, `apps/api/src/routes/public/comics/index.ts`, `.github/workflows/daily-manga-crawl.yml` |
| Mapping upload from crawler | `packages/crawler/src/lib/mapping-file-manager.ts` | `packages/crawler/src/lib/name-mapper.ts` 在 `saveMappings()` 后触发 `uploadAllMappings()`；`run-actor` / `run-publisher` 通过 crawler 运行 | `mappings/*.json` | 不写 D1；R2 payload 自带 `metadata.version` / `uploadedAt` / `totalEntries` / `source` | `06-CONTEXT.md`, `06-RESEARCH.md`, `docs/r2-mapping-*` historical docs | `restricted allowed` | `production schedule` | `packages/crawler/src/lib/name-mapper.ts`, `packages/crawler/src/lib/mapping-file-manager.ts`, `.github/workflows/daily-actor-crawl.yml`, `.github/workflows/daily-publisher-crawl.yml` |
| Mapping backup upload from crawler | `packages/crawler/src/lib/mapping-file-manager.ts` | 同上，`uploadMapping(..., backup=true)` 默认创建备份 | `mappings/backups/<name>-<timestamp>.json` | 不写 D1；与主映射文件一起持久化 | `06-CONTEXT.md` D-03/D-09, `06-STORAGE-POLICY.md` restricted allowed | `restricted allowed with growth risk` | `production schedule` | `packages/crawler/src/lib/mapping-file-manager.ts`, `.github/workflows/daily-actor-crawl.yml`, `.github/workflows/daily-publisher-crawl.yml` |
| Manual mapping persistence from admin API | `apps/api/src/routes/admin/crawlers/index.ts` | `POST /api/admin/crawlers/add-mapping` | `mappings/<actor-name-map|publisher-name-map>.json`; `mappings/backups/...`; possibly overwrite `mappings/unmapped-*.json` | 不写 D1；直接读写 R2 payload，并在 metadata 中记 `lastModifiedBy` | `docs/task-15.7-r2-storage-completion-summary.md`, `docs/r2-mapping-storage-implementation-report.md` | `restricted allowed` | `manual operation` | `apps/api/src/routes/admin/crawlers/index.ts` |
| Mapping version history listing boundary | `apps/api/src/routes/admin/crawlers/index.ts` | `GET /api/admin/crawlers/mapping-versions` | reads `mappings/backups/...` only | 只读，不新增 R2 写入；保留在 inventory 旁作为 caller/reference 边界 | 与 mapping backup 条目配套 | `non-writer reference` | `manual operation` | `apps/api/src/routes/admin/crawlers/index.ts` |
| Search index upload | `packages/crawler/scripts/build-search.ts` | `pnpm --filter @starye/crawler build:search`; `daily-manga-crawl.yml` 在爬虫成功后自动执行 | `system/search-index.json` | 不写 D1；从 `/api/comics` 拉数据后生成搜索索引并上传单个对象 | `06-RESEARCH.md` open question #1, `06-STORAGE-POLICY.md` discovered unlisted prefix | `discovered unlisted prefix` | `production schedule` | `packages/crawler/scripts/build-search.ts`, `.github/workflows/daily-manga-crawl.yml` |
| D1 backup upload to R2 | `.github/workflows/deploy-migrations.yml` | migration deploy workflow 的 `Upload D1 Backup to R2` step | `ops/d1-backups/starye-db-<run_id>-<run_attempt>.sql` | 不写 D1；先导出 D1 SQL 到本地 artifact，再上传到 R2 备份 key | `06-RESEARCH.md`, `06-STORAGE-POLICY.md` discovered unlisted prefix | `discovered unlisted prefix` | `manual operation` | `.github/workflows/deploy-migrations.yml` |
| R2 upload verification script | `packages/crawler/scripts/verify-r2-upload.ts` | 手工运行 `pnpm tsx scripts/verify-r2-upload.ts` | `mappings/actor-name-map.json`, `mappings/backups/...`, `mappings/unmapped-actors.json` | 不写 D1；只验证 mapping upload path 与 R2 凭据 | `docs/r2-mapping-env-vars-guide.md`, `docs/r2-mapping-storage-setup-guide.md` | `restricted allowed` | `test verification` | `packages/crawler/scripts/verify-r2-upload.ts` |
| R2 mapping storage integration test script | `packages/crawler/scripts/test-r2-mapping-storage.ts` | 手工运行 `pnpm tsx scripts/test-r2-mapping-storage.ts` | `mappings/*.json`, `mappings/backups/...` | 通过 API 读写 mapping payload；不以生产数据最小扰动为前提 | `docs/task-15.7-r2-storage-completion-summary.md`, `docs/r2-mapping-quick-deploy-guide.md` | `restricted allowed` | `test verification` | `packages/crawler/scripts/test-r2-mapping-storage.ts` |
| Historical backfill / doc-declared script family | `packages/crawler/scripts/backfill-covers.ts` 等由 research 提到的 one-off / backfill family | 仅在人工命令或历史流程中被引用；本计划不把它们当 production schedule | prefix 取决于脚本目标，至少应视为 future audit candidates | 可能写 DB、也可能写 R2；当前计划只把它们固定为 inventory candidates，不宣称 live production behavior | `06-RESEARCH.md` text flow `build-search / backfill-covers` | `historical risk candidate` | `historical script` | `06-RESEARCH.md` |

## Prefix-Centric View

| Prefix or object key | Live writer(s) | Current classification in Phase 6 | Notes |
|----------------------|----------------|-----------------------------------|-------|
| `images/` | `/api/upload` | `historical risk` | 明确不是 valid future prefix。 |
| `mappings/` | `MappingFileManager`, admin mapping API, verification scripts | `restricted allowed` | 当前 mapping 工作流依赖它。 |
| `mappings/backups/` | `MappingFileManager`, admin mapping API, verification scripts | `restricted allowed with growth risk` | 后续 phase 必须补增长控制。 |
| `system/search-index.json` | `build-search.ts` | `discovered unlisted prefix` | 仅单文件，不应 silently 升级为常规资产目录。 |
| `ops/d1-backups/` | `deploy-migrations.yml` | `discovered unlisted prefix` | 运维备份路径，不属于标准媒体资产。 |
| `comics/<slug>` | `comic-crawler` cover processing | `restricted pending classification` | 与 cover 资产相关，但当前命名仍落在 `comics/`。 |
| `comics/<slug>/<chapter>` | `comic-crawler` chapter processing | `forbidden-risk baseline` | 必须与 `comics/<slug>` 分开记录，不能折叠成单一 `comics/`。 |

## Caller and Coupling Notes

### `/api/upload` -> `images/`

- caller 侧已知 live 使用包括 dashboard 富文本编辑器 `PostEditor.vue` 的 direct upload。
- `apps/dashboard/src/lib/api.ts` 还保留了 `/upload/presign` 假设，但 server read set 中未见对应 live route；这属于 stale assumption，不是可确认 write entry。
- 该入口会把 R2 写入与 `media` 表 metadata insert 绑定；即使 DB insert 失败，也不回滚已上传对象，因此 inventory 里必须保留“R2 与 DB 可能短暂不一致”的说明。

### `comic-crawler` -> `ImageProcessor`

- cover 与 chapter body images 共用同一个 `ImageProcessor`，但 direct caller prefix 不同，风险语义必须拆开。
- cover path 当前是“可继续讨论的 asset-like path”；chapter path 则是已锁定的 forbidden-risk baseline。
- `syncChapterData` 最终把 `data.images` 写到 `pages.image_url`，这使 `comics/<slug>/<chapter>` 不只是“写了 R2”，而是已经耦合进 public read path。

### `mappings/` family

- crawler 生产任务、admin 手工操作、验证脚本三条链路都能写 `mappings/`。
- 这说明 `mappings/` 不是单一脚本副产物，而是当前仍在使用的受限允许前缀。
- `mappings/backups/` 默认随每次写入增长，必须在后续 phase 审计 backup count / lifecycle / retention。

### `system/` and `ops/`

- `system/search-index.json` 与 `ops/d1-backups/` 都是 live repo inventory 的真实写入路径。
- 它们都不能因为“用途合理”就被误记成标准 allowlist；Phase 6 只记录并要求后续 operations classification。

## Phase 6 Constraints

1. 本 inventory 对应 D-07：不能把多个 write path 折成一句“crawler 会上传图片”。
2. 本 inventory 对应 D-09：one-off、verification、backfill、manual 操作必须单独标 runnable risk classification。
3. `images/` 必须保留为 `historical risk`，不得表述成 current approved prefix。
4. `system/` 与 `ops/d1-backups/` 必须保留在 live repo inventory 中，不能遗漏。
5. 本文件不宣布任何对象可安全删除，也不宣布任何旧文档已经被 runtime 事实证伪；后者统一记录在 `06-RISK-BASELINES.md`。
