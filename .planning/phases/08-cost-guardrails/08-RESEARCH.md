# Phase 8: Cost Guardrails - Research

**Researched:** 2026-07-13
**Domain:** R2 purpose allowlist、manual upload guardrails、crawler asset policy、audit/lifecycle/budget operations
**Confidence:** HIGH

<user_constraints>
## User Constraints (from 08-CONTEXT.md)

### Locked Decisions

- **D-01 / D-02:** `/api/upload` 必须从泛化 `images/` 写入改成显式 `purpose` allowlist；内部前缀如 `mappings/`、`mappings/backups/`、`import-staging/`、`crawler-debug/`、`ops/d1-backups/` 不得暴露给通用上传入口。
- **D-03 / D-04:** `blog_inline` 必须独立于 `manual_asset`，且 manual upload purpose 采用少量业务化名称，不能继续退回“什么都叫 images”。
- **D-05:** Phase 8 先收紧 `/api/upload` 与 crawler 主链路；像 comic cover 历史上传面只要求“不能绕过成本边界”，彻底统一留到 Phase 10。
- **D-06 ~ D-11:** 生命周期窗口固定为 `tmp/` 3 天、`crawler-debug/` 3 天、`import-staging/` 7 天、`mappings/backups/` 14 天，并且 `mappings/backups/` 还要保留“每类最近 20 份”的数量护栏。
- **D-12 ~ D-17:** `images/`、`comics/<slug>/<chapter>` 新增对象、过期短期前缀、超限 backup、以及不完整的 DB reference 审计都必须在 audit / runbook 中被当作硬失败或硬阻断条件；`system/` 与 `ops/d1-backups/` 仍是 audit-only inventory。

### Phase Boundary

- 本 phase 不是文档瘦身 phase；不要提前做 Phase 9 的 AGENTS/RUNBOOK 全面重构。
- 本 phase 不是 storage helper 大整理 phase；不要提前做 Phase 10 级别的“所有上传 helper 统一重写”。
- 本 phase 不做历史对象删除，不自动应用 lifecycle 规则，不引入默认图片代理。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COST-01 | `/api/upload` requires an explicit asset purpose and only allows approved R2 purposes. | 现有 `/api/upload` 仍直接写 `images/<timestamp>-<id>`，无 `purpose` 字段、无 prefix allowlist、无 consumer 约束；必须在 API 与 dashboard 调用侧一起收紧。 |
| COST-02 | Crawler image processing uses the same approved-purpose policy and refuses `comic_chapter_page` uploads. | `ImageProcessor.process()` 目前只收 `keyPrefix` 与 `filename`，movie / actor / publisher / comic / backfill 脚本都可以自由传 prefix；需要一个 shared policy seam。 |
| COST-03 | R2 lifecycle guidance exists for tmp/debug/import-staging/mapping backup prefixes. | `audit-r2-storage.ts` 已有 prefix 分类和风险 shaping，但当前只有粗粒度风险，没有 3d/7d/14d/20 份的可执行 guardrail。 |
| COST-04 | Owner has a repeatable R2 cost audit command or runbook section that checks forbidden prefixes and high-growth prefixes. | `audit-r2-storage.ts` 已是 read-only audit 基础，但 RUNBOOK 还没有“何时运行、看到哪些状态必须阻断 cleanup/lifecycle”的正式操作章节。 |
| COST-05 | RUNBOOK documents Cloudflare Budget Alerts and states that alerts notify only. | 现有 RUNBOOK 覆盖 deploy / rollback / D1 backup，但没有 Budget Alerts、低成本阈值或“只通知不封顶”的说明。 |
</phase_requirements>

## Summary

Phase 8 的关键事实很明确：Phase 6 已经把 `images/` 判定为 historical risk，把 `mappings/backups/` 判定为 growth risk，把 `tmp/` / `crawler-debug/` / `import-staging/` 判定为 short-term prefixes；Phase 7 已经把漫画章节正文图从主 crawler 链路里切出 R2。现在真正缺的是“运行时护栏”本身，而不是更多边界讨论。

当前最危险的入口有两个：

1. `apps/api/src/routes/upload/index.ts` 仍接受任何管理员上传并统一写到 `images/`，而 dashboard 的 `PostEditor.vue` 与 `ImageUpload.vue` 都在走这个入口。
2. `packages/crawler/src/lib/image-processor.ts` 只接受 `keyPrefix`，没有目的枚举或 allowed combination 检查，所以任何新的 crawler / script call site 都能悄悄把对象写回错误 prefix。

与此同时，Phase 8 还有一个隐性问题：`apps/dashboard/src/views/Comics.vue` 还在调用 `api.upload.presign()`，但仓库里并不存在 `/api/upload/presign` 的 route，只有一个 `apps/api/src/lib/r2.ts::generatePresignedUrl()` helper。也就是说，manual comic cover 上传面当前不是“安全但宽松”，而是“客户端还保留着历史旁路意图，但服务端 contract 没对齐”。Phase 8 必须显式处理这个侧门，否则计划里会遗漏一个真实 consumer。

**Primary recommendation:** 用三张计划完成本 phase：

- **Plan 01:** 先创建一个小而明确的 shared purpose contract，收紧 `/api/upload` 与 dashboard manual consumers，不再允许 `images/` 和无 purpose 上传。
- **Plan 02:** 再把同一套 purpose contract 接到 crawler / script 主链路，明确 `cover / avatar / logo` 等 allowed 组合，并对 `comic_chapter_page` / chapter-like prefix 直接拒绝。
- **Plan 03:** 最后增强 `audit-r2-storage.ts` 与 `RUNBOOK.md`，把生命周期窗口、backup count guard、hard failure 条件和 Budget Alerts 正式化。

这样 Phase 8 可以完成“阻止新的错误对象继续进入 R2 + 给后续 cleanup 一个严格的证据门”，同时不提前把 Phase 10 的“大一统 helper 重构”拉进来。

## Current Flow

1. `apps/api/src/routes/upload/index.ts` 当前只校验 MIME / 扩展名 / 大小，然后把文件写到 `images/${timestamp}-${nanoid}${ext}`，并把相同 key 记录进 `media` 表。没有 `purpose` 字段，也没有对 prefix 进行任何语义约束。
2. `apps/dashboard/src/views/PostEditor.vue` 的 wangEditor 自定义上传直接 `fetch('/api/upload')`，只传 `file`；`apps/dashboard/src/components/ImageUpload.vue` 通过 `api.upload.uploadImage(file)` 走同一路径；两者都没有传 asset purpose。
3. `apps/dashboard/src/views/Comics.vue` 沿用一个 presign 流程：先 `api.upload.presign(file.name, file.type)`，再 `PUT` 到返回的 URL。但代码库里不存在 `/api/upload/presign` 路由实现，只存在 `apps/api/src/lib/r2.ts::generatePresignedUrl()`。
4. `packages/crawler/src/lib/image-processor.ts` 是 crawler 侧主上传入口，但它只知道 `(imageUrl, keyPrefix, filename, refererUrl)`，完全不知道“为什么上传”。因此 `movies/<code>`、`actors/<id>`、`publishers/<id>`、`comics/<slug>` 这些允许写入和 `comics/<slug>/<chapter>` 这种禁止写入在类型层面没有区分。
5. 当前 `ImageProcessor.process()` call site 包括：`optimized-crawler.ts` 的 movie cover、`actor-crawler.ts` 的 avatar、`publisher-crawler.ts` 的 logo、`comic-crawler.ts` 的 comic cover，以及 `scripts/backfill-covers.ts` 的历史封面回填脚本。Phase 7 已经去掉漫画章节正文图主链路上传，但 guard 仍然靠“调用方自觉不要传错 prefix”。
6. `packages/crawler/src/lib/mapping-file-manager.ts` 与 `apps/api/src/routes/admin/crawlers/index.ts` 都会在每次写 mapping 时额外创建 `mappings/backups/<name>-<timestamp>.json`。目前没有 retention window 或 per-type count guard。
7. `packages/crawler/scripts/audit-r2-storage.ts` 已经具备 prefix 分类、DB reference 状态、风险等级、CSV/JSON/Markdown 报告能力，并且已经知道 `images/`、`mappings/backups/`、`tmp/`、`crawler-debug/`、`import-staging/`、`ops/d1-backups/` 等类别；但它当前只把 `mappings/backups/ >= 50 objects` 粗略升级为 high risk，尚未编码 Phase 8 锁定的 14 天 / 20 份规则。
8. `RUNBOOK.md` 现在已经覆盖 D1 backup 和 `ops/d1-backups/` 的上传/恢复语义，这正好说明 `ops/d1-backups/` 是 operations inventory，而不是普通媒体资产；但 RUNBOOK 还没有专门的 R2 成本审计 / accidental upload remediation / Budget Alerts 章节。

## Planning-Critical Findings

### 1. `/api/upload` 与 dashboard manual upload 必须一起改

只改服务端不改客户端会导致 PostEditor / generic ImageUpload / Comics cover 立刻 400；只改客户端不改服务端则仍会继续写 `images/`。因此 Phase 8 的 API upload 收紧必须和三个 manual consumer 一起进同一个 wave。

### 2. `Comics.vue` 的 presign 是一个真实旁路风险

即使 `/api/upload` 改成 purpose allowlist，如果 `Comics.vue` 继续保留“拿 presigned URL 后直 PUT”的思路，也会在未来重新出现绕过 upload policy 的空间。当前最稳妥的 Phase 8 路线不是新造一个宽松的 `/upload/presign` route，而是把 comic cover manual upload 收回同一条 purpose-based `/api/upload` 合同中。

### 3. Crawler policy 更适合加在 `ImageProcessor` 边界，而不是散落在每个 crawler

movie cover、comic cover、actor avatar、publisher logo、历史 `backfill-covers.ts` 都在调用 `ImageProcessor.process()`。如果只在各 caller 里补注释或本地判断，后续脚本仍然能绕过。Phase 8 应该把“允许的 purpose + 允许的 key namespace”校验集中在 `ImageProcessor` 或其紧邻 helper 上，然后让各 caller 显式传 `purpose`。

### 4. `mappings/backups/` 的 count guard 完全可以靠 audit script 先落地

Phase 8 不需要直接写自动清理器；只要 `audit-r2-storage.ts` 能按“prefix + mapping type”识别备份、判断是否超过 14 天或最近 20 份，并把它们标成 hard failure / blocking recommendation，就已经满足“可执行规则而不是口头建议”的约束。

### 5. `RUNBOOK` 需要一个 owner-facing 成本操作章节，而不是零散补丁

Budget Alerts、R2 cost audit 命令、cleanup 前置条件、accidental upload remediation、`system/` / `ops/d1-backups/` 说明最好落在同一个运维章节中。这样 Phase 9 再做文档重构时，迁移路径也更清晰。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Why |
|------------|-------------|----------------|-----|
| Manual upload purpose allowlist | API / Dashboard | R2 / media table | `/api/upload` 是 manual upload 的统一入口，consumer 也都在 dashboard。 |
| Crawler allowed-purpose enforcement | Crawler / Scripts | Shared contract module | 主风险点在 `ImageProcessor.process()` 的自由 prefix；应在上传边界前就拒绝。 |
| Mapping backup growth guard | Audit script / RUNBOOK | Mapping writers | 当前最需要的是“发现并阻断 cleanup/lifecycle 误操作”的可执行规则，而不是马上清理。 |
| Lifecycle guidance | RUNBOOK | R2 console / future automation | Phase 8 只定义窗口和审计步骤，不直接应用 destructive lifecycle config。 |
| Budget alert operations | RUNBOOK | Cloudflare Billing UI | 这是 owner-facing 运维动作，不是应用运行时代码。 |

## Concrete Implementation Shape

### Shared purpose contract (Phase 8 scope)

建议把 Phase 8 的 shared contract 限定为“purpose vocabulary + prefix mapping / combination rules”，不在本 phase 顺手做所有 helper 合并。一个足够窄的 contract 可以包含：

- Manual upload public purposes:
  - `cover`
  - `avatar`
  - `logo`
  - `blog_inline`
  - `manual_asset`
  - `fallback`
  - `temp`
- Crawler image purposes:
  - `cover`
  - `avatar`
  - `logo`
- Explicitly rejected:
  - `comic_chapter_page`
  - generic `images/*` future writes

推荐的 public upload key mapping：

| Purpose | Prefix |
|---------|--------|
| `cover` | `covers/manual/` |
| `avatar` | `avatars/manual/` |
| `logo` | `logos/manual/` |
| `blog_inline` | `manual-assets/blog-inline/` |
| `manual_asset` | `manual-assets/uploads/` |
| `fallback` | `fallback/manual/` |
| `temp` | `tmp/manual/` |

Crawler side 不必复用同一套“manual path”前缀，但应复用相同的 allowed purpose nouns，并增加 namespace guard：

- `cover` 仅允许 `movies/<code>`、`comics/<slug>`
- `avatar` 仅允许 `actors/<id>`
- `logo` 仅允许 `publishers/<id>`
- 显式拒绝 `comics/<slug>/<chapter>` 与任何 chapter-page intent

### Audit / lifecycle shape

`audit-r2-storage.ts` 已经适合作为 Phase 8 的单一 audit 执行入口。最稳的增强方式是：

- 引入 guardrail config table，记录：
  - `tmp/` => `maxAgeDays=3`
  - `crawler-debug/` => `maxAgeDays=3`
  - `import-staging/` => `maxAgeDays=7`
  - `mappings/backups/` => `maxAgeDays=14`, `maxRecentPerSeries=20`
- 对 `mappings/backups/actor-name-map-*`、`publisher-name-map-*`、`series-to-publisher-map-*` 等 series 分组计算“超龄对象”和“超量对象”
- 在 Markdown/JSON/CSV 报告中暴露明确的 guardrail result / blocking note，而不是只有抽象 risk level
- 当 `db_reference_status` 为 `missing_credentials`、`partial` 或 `missing_query_context` 时，把 cleanup / lifecycle recommendation 强制标成 blocked

## Verification Strategy

| Area | Recommended command |
|------|---------------------|
| API upload guard | `pnpm --filter api exec vitest run src/routes/upload/__tests__/upload.route.test.ts` |
| Dashboard manual upload consumers | `pnpm --filter dashboard exec vitest run src/views/__test__/Comics.test.ts` |
| Crawler purpose guard | `pnpm --filter @starye/crawler exec vitest run test/image-processor-purpose-policy.test.ts src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts` |
| Audit guardrails | `pnpm --filter @starye/crawler exec vitest run test/audit-r2-storage.test.ts` |
| Crawler type surface | `pnpm --filter @starye/crawler exec tsc --noEmit` |

## Risks and Deferrals

- **Do not** let Phase 8 quietly become a Phase 10 refactor. Shared policy contract可以新增，但全面重命名 helper / 清理所有 legacy script 不是本 phase 目标。
- `system/` 与 `ops/d1-backups/` 继续作为 audit-only inventory；不要在本 phase 把它们套进 short-term retention hard failure。
- 如果 `dashboard` 里还有更多未被 grep 找到的历史上传组件，Plan 01 必须把它们作为 source audit 补查项，而不是假设当前三个 consumer 就是全部。

## Drift Note

本次 `verify.codebase-drift` 预检查给出了非阻断 `warn`：自上次 mapping 以来仓库结构变化较大，建议在计划落盘后补一次 `/gsd-map-codebase --paths apps/api,packages/crawler,packages/api-types,apps/dashboard,RUNBOOK.md`，以便后续 execute-phase 的 codebase intel 更新鲜。但这不阻碍当前 Phase 8 进入 planned 状态。
