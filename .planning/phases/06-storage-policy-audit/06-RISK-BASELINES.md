# Phase 06 Risk Baselines

## Purpose and Scope

本文件落实 `06-CONTEXT.md` 中的 D-08 与 D-10，把 historical docs、stale assumptions、non-upload boundaries 分开固定下来，避免后续 phase 把“历史声明”误当成“当前 live runtime truth”。

- 第一部分只记录 documentation-declared entries。
- 第二部分只记录 forbidden-risk baselines 与 stale assumptions。
- 本 phase 只盘点与标注，不修复应用行为，不修改 API、crawler 或 dashboard。

## Executive Summary

当前仓库对 R2 的认知存在三层信息源：

1. live runtime write entries：以 `06-R2-WRITE-INVENTORY.md` 为准。
2. historical docs declarations：大量 `docs/r2-mapping-*` 与 task summary 记录了“mapping 会写 R2”的历史实现与部署说明。
3. stale assumptions / forbidden baselines：`/upload/presign` 客户端假设仍存在；章节图链路仍沿用 `chapter.pages.image_url` 与 public comics API `images: string[]` 的历史命名，并承载 forbidden-risk baseline。

因此，Phase 6 必须先把“文档说过什么”和“当前代码正在做什么”拆开，再给后续 cleanup / enforcement phase 使用。

## Part 1: Documentation-Declared Entries

### Rule

本节对应 D-08：以下条目都是“历史文档声明来源”，不等于 live runtime truth。它们只能作为背景证据，不能替代 `06-R2-WRITE-INVENTORY.md` 中的 live code inventory。

### Historical Document Matrix

| Document | Historical declaration focus | Declared prefixes / behavior | Why it is not live runtime truth |
|----------|------------------------------|------------------------------|----------------------------------|
| `docs/r2-mapping-storage-setup-guide.md` | mapping 文件上传到 R2 的配置与部署步骤 | `mappings/`, `mappings/backups/`, GitHub Actions 环境变量 | 只描述期望配置与操作步骤，不证明今天所有 workflow 都仍按文档配置运行。 |
| `docs/r2-mapping-storage-implementation-report.md` | mapping R2 存储实施细节、成本与后续建议 | `mappings/`, `mappings/backups/`, R2-backed dashboard workflow | 属于实施报告，不是 live inventory；其中“后续建议”与“已完成”叙述不能直接当运行时证据。 |
| `docs/r2-mapping-quick-deploy-guide.md` | mapping 功能的快速部署与验证流程 | `mappings/`, `mappings/backups/`, `daily-actor-crawl.yml`, `daily-publisher-crawl.yml` | 面向部署者的操作文档，不校验 repo 当前每个 caller 是否仍一致。 |
| `docs/r2-mapping-env-vars-guide.md` | R2 mapping 环境变量说明与 `verify-r2-upload.ts` 用法 | `mappings/`, `mappings/backups/` | 只证明“如果这样配，脚本会尝试上传”，不证明当前生产环境实际如此。 |
| `docs/r2-mapping-deployment-checklist.md` | 本地/生产验证 checklist | `mappings/`, `mappings/backups/`, workflow 手动触发 | checklist 是预期核验步骤，不是 live runtime snapshot。 |
| `docs/r2-mapping-usage-examples.md` | 示例脚本、示例 workflow、清理备份示例 | `mappings/`, `mappings/backups/`, cleanup examples | 示例具有教学性质，里面的 cleanup/cron 片段不能直接当现网行为。 |
| `docs/task-15.7-r2-storage-completion-summary.md` | “R2 映射存储完善” 任务总结 | `mappings/`, `mappings/backups/`, actors/publishers asset examples | 属于历史任务收尾文档，声明范围比当前 live repo 宽，且混有“未来计划”“部署建议”“成本估算”。 |

### Documentation-Declared Prefix Summary

| Prefix / path family | Declared by docs | Documentation meaning in Phase 6 |
|----------------------|------------------|----------------------------------|
| `mappings/` | 多份 `docs/r2-mapping-*` 与 task summary | 历史上被文档明确宣称为 mapping workflow 的 R2 主前缀。 |
| `mappings/backups/` | `docs/r2-mapping-*`, checklist, usage examples | 历史上被文档宣称为自动备份路径，但增长控制是否真实落地不能只看文档。 |
| `actors/` / `publishers/` asset examples | `docs/task-15.7-r2-storage-completion-summary.md`, `docs/r2-mapping-env-vars-guide.md` | 属于历史说明中的例子，不在 06-02 live inventory read set 内直接确认其 active writer。 |
| workflow env setup | `docs/r2-mapping-quick-deploy-guide.md`, `docs/r2-mapping-env-vars-guide.md` | 仅说明“应如何配置”；不是 live workflow state 证明。 |

### Documentation Boundary Decision

1. historical docs 继续保留为 evidence sources，但后续 phase 引用它们时必须标注“historical declaration”。
2. 是否真的存在 live writer，必须回到代码或 workflow 读取结果确认。
3. docs 中出现的 cleanup、backup rotation、生产已完成表述，都不能被当作 Phase 6 已验证事实。

## Part 2: Non-Upload Boundaries and Stale Assumptions

### D-10 Forbidden-Risk Baseline

本节对应 D-10，必须把当前章节正文图链路固定成 non-upload boundary 与 forbidden-risk baseline：

```text
comic-crawler -> ImageProcessor -> syncChapterData -> pages.image_url -> public comics API -> comic-app
```

该链路的风险含义如下：

| Hop | Current evidence | Why it is a forbidden-risk baseline |
|-----|------------------|-------------------------------------|
| `comic-crawler -> ImageProcessor` | `comic-crawler` 对 chapter pages 调用 `imageProcessor.process(rawUrl, \`comics/${info.slug}/${chapter.slug}\`, ...)` | chapter body images 被送进 R2-style processor，而不是被保留为 source/external URL。 |
| `ImageProcessor -> syncChapterData` | crawler 把 `processed[0].url` 收集到 `images` 数组并提交给 sync API | 章节正文图上传结果继续进入后续 DB 写入链。 |
| `syncChapterData -> pages.image_url` | `syncChapterData` 把 `data.images` 写到 `pages.image_url` | 历史字段名继续承载章节图 URL 语义，且当前可能持有 R2 URL。 |
| `pages.image_url -> public comics API` | public route 返回 `images: chapter.pages.map(p => p.imageUrl)` | 外部读路径继续消费历史字段，后续任何修复都必须兼顾 API 兼容边界。 |
| `public comics API -> comic-app` | comic-app 读取 `images: string[]` | UI 已经围绕历史字段工作；Phase 6 只记录，不在本计划重构。 |

### Historical Semantic Locks

| Surface | Historical name | Locked semantics in Phase 6 | Baseline conclusion |
|---------|------------------|-----------------------------|--------------------|
| D1 page field | `chapter.pages.image_url` | 历史字段名，语义应锁到 source/external chapter image URL | 当前实现与目标语义存在漂移，因此必须被记录为风险基线。 |
| Public chapter response | `images: string[]` | 历史 API 字段名，语义应锁到 source/external URL 列表 | 现在仍可能承接 R2 URL；这是后续 phase 的修复对象，不是本 phase 即时修复项。 |

### Stale Assumptions

| Assumption | Evidence | Phase 6 interpretation | Current action |
|------------|----------|------------------------|----------------|
| `/upload/presign` still exists as a valid server upload path | `apps/dashboard/src/lib/api.ts` 仍提供 `api.upload.presign()`，请求 `POST /upload/presign` | 这是 stale assumption；在本次 read set 中未看到对应 live server route，不能把它计作有效 upload entry | 只记录与标注，不修复 dashboard 行为。 |
| “历史文档声明的 mapping workflow = 当前生产 truth” | 多份 `docs/r2-mapping-*` 和 task summary 用完成式叙述 mapping R2 流程 | 这是 historical-doc drift risk，不是 live runtime proof | 只在 Part 1 归档为 documentation-declared entries。 |
| `image_url` / `images` 名字天然意味着 R2 URL | 代码与历史实现曾混用名字与语义 | 这是 naming drift；Phase 6 只锁语义，不做 DB/API rename | 记录为 baseline，等待后续 phase 处理。 |

## What Phase 6 Does Not Fix

1. 不删除 `comics/<slug>/<chapter>` 相关对象。
2. 不把 `chapter.pages.image_url` 立刻迁移成新字段。
3. 不把 public comics API `images: string[]` 立刻改名或改 shape。
4. 不修复 dashboard 的 `/upload/presign` stale assumption。
5. 不根据历史 docs 自动认定任何 workflow “已经正确部署”。

## Evidence Pointers

| Topic | Primary evidence |
|-------|------------------|
| D-08 historical declarations | `docs/r2-mapping-storage-setup-guide.md`, `docs/r2-mapping-storage-implementation-report.md`, `docs/r2-mapping-quick-deploy-guide.md`, `docs/r2-mapping-env-vars-guide.md`, `docs/r2-mapping-deployment-checklist.md`, `docs/r2-mapping-usage-examples.md`, `docs/task-15.7-r2-storage-completion-summary.md` |
| `/upload/presign` stale assumption | `apps/dashboard/src/lib/api.ts` |
| `chapter.pages.image_url` baseline | `apps/api/src/routes/admin/sync/handlers.ts` |
| public `images: string[]` baseline | `apps/api/src/routes/public/comics/index.ts` |
| forbidden chain source | `packages/crawler/src/crawlers/comic-crawler.ts`, `packages/crawler/src/lib/image-processor.ts`, `06-STORAGE-POLICY.md` |

## Phase 6 Conclusion

本文件与 `06-R2-WRITE-INVENTORY.md` 形成一对证据边界：

- inventory 文档负责回答“live repo 现在谁在写 R2、写到哪里、耦合到哪里”。
- baseline 文档负责回答“历史文档说过什么、哪些客户端/字段假设已经漂移、章节图 forbidden-risk 链路当前如何存在”。

只有把这两类信息拆开，后续 cleanup phase 才不会把历史完成叙述误当成当前事实，也不会把章节图风险误写成“Phase 6 已修复”。
