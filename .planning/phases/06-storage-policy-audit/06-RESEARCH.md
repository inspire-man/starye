# Phase 6: Storage Policy Audit - Research

**Researched:** 2026-07-12
**Domain:** Cloudflare R2 / D1 / 外部 URL 存储边界审计
**Confidence:** MEDIUM

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use an explicit R2 allowlist. Anything not listed is forbidden by default or requires separate approval before planning.
- **D-02:** Normal allowed R2 purposes are necessary assets such as `covers/`, `avatars/`, `logos/`, `fallback/`, and `manual-assets/`.
- **D-03:** `mappings/` is a restricted allowed prefix. It may remain in R2, but `mappings/backups/` must have backup count, lifecycle, or growth audit controls.
- **D-04:** `tmp/`, `crawler-debug/`, and `import-staging/` are short-term allowed prefixes only when the policy records purpose, default retention window, and audit rules.
- **D-05:** Historical generic `images/` is a risk pending classification. Phase 6 must audit objects and DB references under it, but not delete or rename them.
- **D-06:** Forbidden uses include comic chapter body images, bulk comic page mirrors, Worker/Pages Function image proxy caches, long-term debug dumps, and any unlisted R2 purpose.
- **D-07:** Inventory each R2 write entry with direct callers and produced prefixes. Record owner module or script, direct caller, generated key prefix, DB write/reference behavior, documentation references, and risk classification.
- **D-08:** Historical docs that declare R2 behavior must be listed separately as documentation-declared entries. This includes `docs/r2-mapping-*` guidance and task summaries, but full documentation restructuring remains Phase 9 scope.
- **D-09:** One-off, verification, and backfill scripts are in scope for inventory. Classify them by runnable risk: production schedule, manual operation, test verification, or historical script.
- **D-10:** Include comic chapter body image paths as non-upload boundaries. These paths preserve or return source/external URLs and must not call R2. This becomes a regression baseline for later phases.
- **D-11:** The dry-run audit artifact is human-readable first and machine-processable second. Produce a Markdown report plus JSON or CSV details for Phase 8/10 automation.
- **D-12:** Each prefix/object group must include `prefix`, object count, rough size, sample keys, last-modified range, DB reference hits, referenced tables/fields, risk levels, and recommended action.
- **D-13:** Use dual-axis risk: `delete_risk` covers DB references, unknown purpose, and accidental deletion impact; `cost_risk` covers volume, growth, forbidden prefixes, and restricted prefixes. The report should also include a combined recommendation.
- **D-14:** Phase 6 must not delete any R2 object. Any deletion requires a later phase or separate explicit confirmation based on the dry-run report.
- **D-15:** Prefer source-based naming in future docs and code: `sourceImageUrl` or `externalImageUrl` means source-site/external URL; `r2Key` and `r2Url` mean R2-backed asset.
- **D-16:** Existing `chapter.pages.image_url` and public API `images: string[]` are historical fields whose semantics are locked to source/external URLs. Phase 6 does not require immediate DB/API renaming.
- **D-17:** R2 assets should be represented as `r2Key` plus `r2Url`. `r2Key` is object identity for audits and DB reference checks; `r2Url` is only the display/access URL.
- **D-18:** Documentation must split storage, proxying, and caching terminology. R2 storage, Worker/Pages Function proxying, and CDN/browser caching are separate concepts; chapter image proxying and proxy caching are forbidden by default.

### the agent's Discretion
None. The user selected explicit decisions for every discussed gray area.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STOR-01 | Owner can read a documented storage policy that states which assets may use R2 and which assets must remain external URLs. | 明确 allowlist / forbidden / restricted / short-term allowed / glossary / 文档落点 |
| STOR-02 | System rejects or flags any attempt to store comic chapter body images in R2 by default. | 先盘点当前违规路径，锁定 `comic-crawler -> ImageProcessor -> pages.image_url` 作为 Phase 7/8 的回归基线 |
| STOR-03 | Owner can distinguish R2-backed URLs from external source URLs in crawler/API/storage documentation and code naming. | 明确 `r2Key` / `r2Url` vs `sourceImageUrl` / `externalImageUrl`，并标注历史字段 `image_url` / `images` 语义 |
| STOR-04 | Existing R2 prefixes can be audited before deletion, including object count, rough size, and DB reference risk. | 设计 dry-run 报告结构、read-only inventory 路径、DB 引用检查清单、双轴风险模型 |

## Summary

Phase 6 不应该被规划成“开始清理 R2”的阶段，而应该被规划成“锁政策、做现状盘点、定义 dry-run 审计产物”的阶段。[VERIFIED: live repo] 当前仓库里最重要的事实不是 Cloudflare 理论，而是现有代码已经存在多条真实 R2 写路径，而且这些路径的前缀、语义和文档声明并不一致：`/api/upload` 仍写入泛化 `images/`，漫画 crawler 仍把章节正文图写到 `comics/<slug>/<chapter>/...`，mapping 路径同时被 crawler、admin API、测试脚本和历史文档使用。[VERIFIED: live repo]

本 phase 的最高风险点是“当前实现与已锁定政策冲突，但又不能直接删”。`packages/crawler/src/crawlers/comic-crawler.ts` 现在会把章节正文图上传到 R2，再经 `syncChapterData()` 落进 `pages.image_url`，而公开章节 API 又把 `chapter.pages.map(p => p.imageUrl)` 原样返回给 reader。[VERIFIED: live repo] 这说明章节正文图已经可能依赖现存 R2 URL；因此 Phase 6 只能把这条链路标成 forbidden current risk 和后续 phase 的回归基线，不能在此阶段做对象删除、字段重写或策略 enforcement。[VERIFIED: `06-CONTEXT.md`]

Cloudflare 官方能力足够支撑“只审不删”的方案：Worker R2 binding 的 `R2Bucket.list()` 支持 `prefix`、`limit`、`cursor`、`delimiter` 和 `include` 元数据，适合做 read-only inventory；R2 lifecycle 是显式的 bucket state change，能够定义对象过期/转 IA/中止 multipart，因此在本 phase 必须被视为 destructive-adjacent 配置变更，而不是普通读操作。[CITED: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/] [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/]

**Primary recommendation:** 把 Phase 6 规划成 5 个块：`约束与术语`、`live repo 写路径 inventory`、`非上传边界说明`、`dry-run R2 审计格式`、`no-delete guardrails`，且输出只落在文档/规划产物，不改应用逻辑。

## Project Constraints (from AGENTS.md)

- 默认中文协作、中文结论、中文风险和验证说明。[VERIFIED: `AGENTS.md`]
- 本地联调必须经由 Gateway `http://localhost:8080/...`，不要直接用子应用端口做验证结论。[VERIFIED: `AGENTS.md`]
- 推荐命令以 `pnpm` 为主：`pnpm build`、`pnpm type-check`、`pnpm lint`、`pnpm test`、`pnpm test:e2e`。[VERIFIED: `AGENTS.md`]
- GitNexus 规则：修改函数/类/方法前必须先做 impact analysis；提交前必须做 `gitnexus_detect_changes()`；若风险为 HIGH/CRITICAL 必须先警告用户。[VERIFIED: `AGENTS.md`]
- 不应建议违反现有 Cloudflare / D1 / R2 / Gateway 工作模式的方案。[VERIFIED: `AGENTS.md`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| R2 对象写入入口盘点 | API / Backend | Scripts / Crawler | `/api/upload`、admin crawler route、crawler scripts 都在服务端或脚本侧写 R2 |
| 章节正文图“不得写入 R2”边界定义 | API / Backend | Scripts / Crawler | 实际违规写入来自 crawler，同步落库和公开返回也都经 API |
| `page.image_url` / `images: string[]` 语义澄清 | API / Backend | Browser / Client | 字段由 D1/API 定义，comic-app 只是消费端 |
| R2 prefix dry-run 审计 | API / Backend | Database / Storage | R2 清单、对象元数据、DB 引用比对都在后端/存储层完成 |
| DB 引用风险判断 | Database / Storage | API / Backend | 风险核心是哪些表/字段还引用对象或 URL |
| 历史文档声明与真实实现对账 | Frontend Server / Docs | API / Backend | 这是文档治理问题，但必须基于 live repo 实现核对 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `wrangler` [WARNING: flagged as suspicious — verify before using.] | `4.90.0` in repo, latest registry `4.110.0` modified `2026-07-09` | Cloudflare CLI for D1 export, R2 bucket inspection, lifecycle inspection | 仓库已经固定用它驱动 D1/R2/Workers 运维；这里记录的是“现状基线”，不是建议在本 phase 新装或升级。[VERIFIED: live repo] [ASSUMED] |
| `drizzle-orm` | `0.45.2` modified `2026-06-27` | D1 schema / table-field audit reference | 所有 DB 引用检查都要以现有 Drizzle schema 为准；无新增安装建议。[VERIFIED: live repo] [ASSUMED] |
| `@aws-sdk/client-s3` [WARNING: flagged as suspicious — verify before using.] | `3.1031.0` in repo, latest registry `3.1085.0` modified `2026-07-10` | Node-side R2 S3-compatible client for crawler/script writes | crawler、mapping manager、search index 脚本都依赖它；这里是现有依赖盘点，不是新增推荐。[VERIFIED: live repo] [ASSUMED] |
| `@aws-sdk/lib-storage` [WARNING: flagged as suspicious — verify before using.] | `3.1031.0` in repo, latest registry `3.1085.0` modified `2026-07-10` | Multipart/stream upload helper for image processing | `ImageProcessor` 用它直接把 `sharp` 流上传到 R2；这里是现有依赖盘点，不是新增推荐。[VERIFIED: live repo] [ASSUMED] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `hono` [WARNING: flagged as suspicious — verify before using.] | `4.12.14` in repo, latest registry `4.12.29` modified `2026-07-10` | API route organization and Cloudflare binding access | 需要盘点 `/api/upload`、`/api/admin/crawlers/*`、公开 comics route 时使用；这里是现状说明。[VERIFIED: live repo] [ASSUMED] |
| `valibot` [WARNING: flagged as suspicious — verify before using.] | `1.3.1` in repo, latest registry `1.4.2` modified `2026-06-28` | Current validation pattern reference | 本 phase 不新增校验逻辑，但 planner 需要知道后续 enforcement 会沿用现有校验风格；这里是现状说明。[VERIFIED: live repo] [ASSUMED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Worker `R2Bucket.list()` read-only inventory | 远端脚本通过 S3 `ListObjectsV2` | 仓库当前已有 Worker binding 读取示例，且本机 `wrangler 4.90.1` 的 `r2 object` 子命令未显示 `list`，因此 Phase 6 先以 Worker/API dry-run 模式更稳妥。[VERIFIED: live repo] [CITED: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/] |
| 直接改代码封禁章节图上传 | 先只做 audit + policy | Phase 6 目标是“先知道现状”，不是在未知引用风险下直接切断路径。[VERIFIED: `06-CONTEXT.md`] |

**Installation:**
```bash
pnpm install
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `wrangler` | npm | 新版本发布于 `2026-07-09` | `14521998/wk` | `github.com/cloudflare/workers-sdk` | `SUS` | Flagged — planner must add checkpoint if proposing upgrade/install |
| `drizzle-orm` | npm | 发布于 `2026-03-27` | `11061961/wk` | `github.com/drizzle-team/drizzle-orm` | `OK` | Approved |
| `hono` | npm | 新版本发布于 `2026-07-10` | `48309165/wk` | `github.com/honojs/hono` | `SUS` | Flagged — planner must add checkpoint if proposing upgrade/install |
| `@aws-sdk/client-s3` | npm | 新版本发布于 `2026-07-10` | `27248202/wk` | `github.com/aws/aws-sdk-js-v3` | `SUS` | Flagged — planner must add checkpoint if proposing upgrade/install |
| `@aws-sdk/lib-storage` | npm | 新版本发布于 `2026-07-10` | `8179161/wk` | `github.com/aws/aws-sdk-js-v3` | `SUS` | Flagged — planner must add checkpoint if proposing upgrade/install |
| `valibot` | npm | 新版本发布于 `2026-06-28` | `14046520/wk` | `github.com/open-circle/valibot` | `SUS` | Flagged — planner must add checkpoint if proposing upgrade/install |

**Packages removed due to `SLOP` verdict:** none
**Packages flagged as suspicious `SUS`:** `wrangler`, `hono`, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `valibot`

*本 section 只用于后续 planner 不要把“引用现有依赖”误当成“无门槛新增依赖”。Phase 6 本身不需要新增外部包，也不建议在本 phase 里顺手升级这些依赖。*

## Architecture Patterns

### System Architecture Diagram

```text
GitHub Actions / Manual Scripts
  -> crawler scripts / build-search / backfill-covers
  -> AWS SDK R2 writes
  -> R2 bucket prefixes (comics/, movies/, actors/, publishers/, mappings/, system/, ops/)

Dashboard / PostEditor / Comics view
  -> /api/upload or assumed /upload/presign caller
  -> API Worker Hono routes
  -> Worker R2 binding BUCKET.put()/get()/list()
  -> D1 metadata tables or direct runtime reads

Comic crawler
  -> ImageProcessor.process()
  -> uploads chapter pages / covers to R2
  -> syncCrawlerData()
  -> D1 pages.image_url / comics.cover_image
  -> public comics route
  -> comic-app reader consumes images[]

Dry-run audit phase
  -> read-only inventory (Worker list/get metadata, D1 query, docs grep)
  -> report rows with delete_risk + cost_risk
  -> no delete / no rewrite / no lifecycle apply
```

### Recommended Project Structure

```text
.planning/phases/06-storage-policy-audit/
├── 06-RESEARCH.md              # 本研究
├── 06-STORAGE-POLICY.md        # 规划后的政策文档候选
├── 06-R2-AUDIT-DRY-RUN.md      # 人类可读 dry-run 报告
├── 06-r2-audit-details.json    # 机器可处理明细
└── 06-r2-audit-details.csv     # 导出视图
```

### Pattern 1: Live Repo Inventory Before Policy

**What:** 先列出真实写入路径、调用者、前缀、DB 关联，再决定哪些属于 allowlist、restricted 或 forbidden current risk。
**When to use:** 当仓库已有多条历史写路径且文档可能滞后时。
**Example:**
```typescript
// Source: apps/api/src/routes/upload/index.ts
const key = `images/${timestamp}-${uniqueId}${ext}`
await bucket.put(key, file.stream(), {
  httpMetadata: {
    contentType: file.type,
  },
})
```

### Pattern 2: Read-Only R2 Prefix Inventory via Worker Binding

**What:** 使用 Worker `R2Bucket.list()` 做 prefix、cursor、metadata 驱动的 dry-run inventory。
**When to use:** 需要对象计数、样本 key、分页、元数据，但不能删对象时。
**Example:**
```typescript
// Source: Cloudflare Workers R2 API docs
const listed = await env.MY_BUCKET.list({
  prefix: 'mappings/backups/',
  limit: 500,
  include: ['httpMetadata'],
})

let cursor = listed.cursor
let truncated = listed.truncated
while (truncated) {
  const next = await env.MY_BUCKET.list({ prefix: 'mappings/backups/', limit: 500, cursor })
  listed.objects.push(...next.objects)
  truncated = next.truncated
  cursor = next.cursor
}
```

### Pattern 3: URL Semantics Locked at API Boundary

**What:** 即使字段名历史包袱很重，也先锁定“这个字段今天代表什么”，而不是先重命名。
**When to use:** `image_url` / `images` 已被多处消费，且本 phase 不负责 API/DB breaking change。
**Example:**
```typescript
// Source: apps/api/src/routes/public/comics/index.ts
return c.json({
  success: true,
  data: {
    id: chapter.id,
    title: chapter.title,
    chapterNumber: chapter.chapterNumber,
    images: chapter.pages.map(p => p.imageUrl),
  },
})
```

### Anti-Patterns to Avoid

- **直接在 Phase 6 里删对象:** 当前 `pages.image_url`、`media.url`、mapping runtime 仍可能依赖现有对象，先删会破坏读链路。[VERIFIED: live repo]
- **把 `R2_PUBLIC_URL` 前缀判断当成对象身份:** 这只能区分“看起来像 R2 URL”，不能替代 `r2Key` 审计。[VERIFIED: live repo]
- **把 Worker proxy/cache 当章节图默认兜底:** 会把阅读流量转成 Workers/Pages Functions 成本，与 milestone 目标冲突。[VERIFIED: `.planning/PROJECT.md`] [CITED: https://developers.cloudflare.com/workers/platform/pricing/]
- **假设 `wrangler r2 object list` 在当前本机 CLI 一定可用:** 本机 `wrangler 4.90.1` help 仅显示 `get/put/delete`；规划时必须先选 Worker list 或在执行阶段单独核验 CLI 能力。[VERIFIED: live repo]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| R2 对象分页列举 | 自己拼不完整的对象游标协议 | Worker `R2Bucket.list()` | 官方已有 prefix/cursor/truncated 语义，适合 dry-run inventory。[CITED: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/] |
| R2 生命周期策略解释 | 自定义 retention 规则语义猜测 | Cloudflare lifecycle docs + later explicit apply phase | lifecycle 会改变对象状态/删除行为，不能在 research 阶段靠猜。[CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/] |
| DB 引用风险判断 | 只看文件路径/grep | 直接查 Drizzle schema + 同步链路 | 真正风险在表字段是否还引用 URL/key，而不是路径名字好不好看。[VERIFIED: live repo] |

**Key insight:** 这个 phase 的难点不是“写出一个脚本”，而是“搞清楚哪些对象还能被系统/文档/运营流程消费”。手搓清理逻辑比先把消费边界说清更危险。

## Common Pitfalls

### Pitfall 1: 把章节正文图上传链路误当成“普通封面上传”

**What goes wrong:** 把 `ImageProcessor` 当成统一安全上传器，忽略 caller prefix 和落库字段差异。
**Why it happens:** `ImageProcessor` 是共享组件，真正违规发生在 `comic-crawler.ts` 的调用方式，而不是组件本身。
**How to avoid:** inventory 必须按 call site 拆开记录，不要只记“有个 image processor”。 
**Warning signs:** 出现 `comics/<slug>/<chapter>/...`；`syncChapterData()` 把返回 URL 写进 `pages.image_url`。

### Pitfall 2: 用旧文档替代 live repo

**What goes wrong:** 直接相信 `docs/r2-mapping-*` 的 bucket 名、前缀、流程都还是当前真相。
**Why it happens:** 这些文档量大、描述完整，但很多内容是历史实现总结。
**How to avoid:** 单独列为 documentation-declared entries，与 live repo inventory 分表。
**Warning signs:** 文档中出现 `starye-assets`、`wrangler r2 object list`、手动 delete 示例，而 live repo 实际 bucket binding 是 `starye-media`。

### Pitfall 3: 把 dry-run 规划写成 cleanup 规划

**What goes wrong:** 在同一个 phase 里夹带 lifecycle apply、R2 delete、URL rewrite、bucket migration。
**Why it happens:** 审计和清理容易在语言上混在一起。
**How to avoid:** 每个任务都要能回答“它是否改变远端状态”。只要会变，就不属于 Phase 6。
**Warning signs:** 计划里出现 `delete`、`restore`、`migrate`、`apply lifecycle`、`update page.image_url`。

## Code Examples

### Current Generic Upload Path
```typescript
// Source: apps/api/src/routes/upload/index.ts
const timestamp = Date.now()
const uniqueId = nanoid()
const key = `images/${timestamp}-${uniqueId}${ext}`

await bucket.put(key, file.stream(), {
  httpMetadata: {
    contentType: file.type,
  },
})
```

### Current Forbidden-Risk Chapter Upload Path
```typescript
// Source: packages/crawler/src/crawlers/comic-crawler.ts
const processed = await this.imageProcessor.process(
  rawUrl,
  `comics/${info.slug}/${chapter.slug}`,
  String(globalIndex + 1).padStart(3, '0'),
)
const targetVariant = processed.find(p => p.variant === 'original') || processed[0]
return targetVariant?.url || 'https://placehold.co/800x1200?text=Image+Load+Failed'
```

### Current Chapter Sync to D1
```typescript
// Source: apps/api/src/routes/admin/sync/handlers.ts
const pageValues = data.images.map((url: string, index: number) => ({
  id: `${chapterId}-${index + 1}`,
  chapterId,
  pageNumber: index + 1,
  imageUrl: url,
  width: data.width || 0,
  height: data.height || 0,
}))
```

### Current Mapping Backup Listing
```typescript
// Source: apps/api/src/routes/admin/crawlers/index.ts
const prefix = type === 'actor'
  ? 'mappings/backups/actor-name-map-'
  : 'mappings/backups/publisher-name-map-'

const listed = await r2.list({ prefix, limit: 50 })
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| “看到图片就上传到 R2，再把 URL 存库” | “章节正文图保留 external/source URL，R2 仅留必要资产” | v1.1 milestone decision on `2026-07-11` | 大幅降低存储与请求成本，但需要更强 reader 失败可见性。[VERIFIED: `.planning/STATE.md`] |
| 泛化 `images/` 上传入口 | 未来需要 purpose allowlist | 已在 requirements/roadmap 锁定，尚未实施 | Phase 6 先审计 generic debt，Phase 8 再 enforce。[VERIFIED: `.planning/REQUIREMENTS.md`] |
| 文档把 R2 / proxy / cache 混讲 | 文档要拆成 storage / proxy / cache 三个概念 | `06-CONTEXT.md` 已锁定 | 避免后续 planner 把代理缓存误当成存储策略的一部分。[VERIFIED: `06-CONTEXT.md`] |

**Deprecated/outdated:**
- `docs/r2-mapping-*` 中把旧 bucket、list/delete 示例当成当前标准流程的部分说法：历史有参考价值，但不能替代 live repo inventory。[VERIFIED: live repo]
- Dashboard `api.upload.presign()` 调 `/upload/presign` 的客户端假设：当前 API 路由中未找到匹配 handler，应视为 stale client assumption。[VERIFIED: live repo]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `06-STORAGE-POLICY.md` 作为本 phase 的 canonical policy artifact 更合适，后续如需 repo-wide doc consolidation 再由 Phase 9 迁移 | Architecture Patterns / Summary | 若项目实际上要求 root docs 落点，后续 phase 需要补一层文档归档迁移 |
| A2 | `user.image` 在 Better Auth 语义上可能需要纳入 R2 URL 引用检查，即便当前 phase 没有明确相关上传入口 | Summary / Dry-run thinking | 可能少算或多算 DB 风险字段 |
| A3 | `system/search-index.json` 与 `ops/d1-backups/*.sql` 应先作为 discovered system/operations prefixes 单独分类，不自动进入标准资产 allowlist | Summary / Current inventory | 若其实已有既定运维 policy，后续执行时需要把 phase-local 归类迁回正式运维文档 |

## Open Questions (RESOLVED)

1. **`system/search-index.json` 是否应进入正式 allowlist？**
   - Resolved decision: 不进入标准资产 allowlist。Phase 6 将其固定为 `system/` discovered system prefix，要求在 policy 和 inventory 中单独分类，后续 phase 不得把它默认为 `covers/` / `manual-assets/` 一类标准资产用途。
   - Evidence: `packages/crawler/scripts/build-search.ts` 会把搜索索引上传到 `system/search-index.json`。[VERIFIED: live repo]
   - Planning impact: `06-01` 和 `06-02` 必须把 `system/` 写成 discovered unlisted prefix / system-purpose exception，而不是 silently approve。

2. **`ops/d1-backups/` 应算 media bucket 合法用途，还是“操作备份例外”？**
   - Resolved decision: 视为 operations backup exception，不进入 media asset allowlist。Phase 6 只记录它当前与媒体对象共桶的现实，不提出迁桶或删除动作。
   - Evidence: `deploy-migrations.yml` 会在应用 migration 前把 D1 导出 SQL 上传到 `ops/d1-backups/...sql`。[VERIFIED: live repo]
   - Planning impact: `06-01` 和 `06-03` 必须把 `ops/d1-backups/` 写成 operations-purpose exception，并在 dry-run 报告里单独呈现其 delete/cost risk。

3. **`/upload/presign` 客户端假设是否仍需保留？**
   - Resolved decision: 在本 phase 把它视为 stale client assumption，而不是 active API write path。Phase 6 只盘点与标注，不修复 dashboard 或 API 行为。
   - Evidence: dashboard `Comics.vue` 与 `apps/dashboard/src/lib/api.ts` 仍调用 `api.upload.presign()`，但当前 `apps/api/src/routes` 下未发现匹配的 `/upload/presign` handler。[VERIFIED: live repo]
   - Planning impact: `06-02` 必须在 `06-RISK-BASELINES.md` 里把 `/upload/presign` 记录为 stale assumption，并避免把它算成当前有效服务端上传入口。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | crawler scripts, tooling | ✓ | `v24.0.1` | — |
| `pnpm` | workspace scripts | ✓ | `10.33.0` | — |
| `npm` | registry verification | ✓ | `11.3.0` | — |
| `wrangler` | D1/R2/Workers inspection | ✓ | `4.90.1` | Worker `R2Bucket.list()` for object inventory |
| Cloudflare credentials in current shell | live remote R2/D1 audit | ✗ | — | 文档化命令与 report skeleton；跳过真实 object counts |

**Missing dependencies with no fallback:**
- none

**Missing dependencies with fallback:**
- 当前 shell 没有 `CLOUDFLARE_ACCOUNT_ID` / `R2_*` / `CLOUDFLARE_API_TOKEN`，因此本次研究不能跑远端真实 R2/D1 inventory；但 planner 仍可基于 live repo + read-only command contract 设计 Phase 6。

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | source assertions + `vitest` for crawler audit script + manual credentialed dry-run |
| Config file | `packages/crawler/vitest.config.ts`, `.planning/phases/06-storage-policy-audit/06-*.md` |
| Quick run command | `pnpm --filter @starye/crawler exec vitest run test/audit-r2-storage.test.ts` (after `06-03` lands) |
| Full suite command | targeted Phase 6 matrix from `06-VALIDATION.md` + package-scoped crawler test |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOR-01 | policy artifact exists with allowed/forbidden semantics | docs/manual review | `rg -n "covers/|manual-assets/|comic chapter body images" .planning/phases/06-storage-policy-audit` | ❌ Wave 0 |
| STOR-02 | current chapter-body-to-R2 path is flagged as risk baseline | static analysis | `rg -n "comics/\\$\\{info.slug\\}/\\$\\{chapter.slug\\}" packages/crawler/src/crawlers/comic-crawler.ts` | ✅ |
| STOR-03 | external URL vs R2 semantics documented | static analysis | `rg -n "r2Key|externalImageUrl|sourceImageUrl|image_url|images:" .planning/phases/06-storage-policy-audit` | ❌ Wave 0 |
| STOR-04 | dry-run report shape includes count/size/sample/db refs/risk | docs/schema review | `rg -n "object count|rough size|sample keys|delete_risk|cost_risk" .planning/phases/06-storage-policy-audit` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** 运行当前任务最窄的 `rg` / `vitest` 检查，不把整个 workspace 测试当默认 quick loop
- **Per wave merge:** 重跑 `06-VALIDATION.md` 中的 targeted matrix；若触及 `06-03`，额外跑 crawler audit script 测试
- **Phase gate:** 文档与计划类 phase 以 artifact completeness + no-delete grep + package-scoped crawler test 为主

### Wave 0 Gaps

- [ ] `06-STORAGE-POLICY.md` 或等价文档 — covers STOR-01 / STOR-03
- [ ] `06-R2-AUDIT-DRY-RUN.md` 模板 — covers STOR-04
- [ ] `06-r2-audit-details.json` schema/example — covers STOR-04
- [ ] no-delete guardrail checklist in phase artifacts — covers STOR-02 / STOR-04

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 本 phase 不新增登录认证逻辑 |
| V3 Session Management | no | 本 phase 不改 session 行为 |
| V4 Access Control | yes | 后续若做 audit route/script，沿用 `serviceAuth()` / admin-only boundaries |
| V5 Input Validation | yes | 后续脚本/API 参数继续沿用 `valibot` / Hono validation patterns |
| V6 Cryptography | no | 本 phase 不涉及加密设计 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 误删仍被引用的 R2 对象 | Tampering | 先做 DB reference audit + no-delete phase guardrail |
| 把 source URL 与 R2 URL 混淆导致错误清理 | Tampering | 文档中固定 `r2Key` / `r2Url` / `externalImageUrl` 语义 |
| 在审计输出里泄露 Cloudflare secrets | Information Disclosure | 只记录 bucket/prefix/count/sample key；不打印 access key / secret / token |
| 以 proxy/cache 名义绕过 forbidden storage policy | Elevation of Privilege | 明确 storage/proxy/cache 三分并在 policy 中禁默认 proxy |

## Sources

### Primary (HIGH confidence)

- Live repo grep and file reads — `apps/api/src/routes/upload/index.ts`, `apps/api/src/lib/r2.ts`, `apps/api/src/routes/admin/sync/handlers.ts`, `apps/api/src/routes/admin/crawlers/index.ts`, `apps/api/src/routes/public/comics/index.ts`, `packages/crawler/src/crawlers/comic-crawler.ts`, `packages/crawler/src/lib/image-processor.ts`, `packages/crawler/src/lib/mapping-file-manager.ts`, `packages/crawler/scripts/build-search.ts`, `.github/workflows/deploy-migrations.yml`, `.github/workflows/daily-*.yml`, `packages/db/src/schema.ts`
- `06-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `AGENTS.md`, `CLAUDE.md`

### Secondary (MEDIUM confidence)

- Cloudflare R2 Workers API reference — `R2Bucket.list()` / `R2Objects` / pagination / include metadata: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- Cloudflare R2 object lifecycle docs — lifecycle rules and object expiration/IA semantics: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- Context7 digests for Cloudflare R2 docs gathered via research seam

### Tertiary (LOW confidence)

- none

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - 版本已通过 registry 和 repo 核验，但官方 docs 对包合法性未逐一交叉确认，且部分包被 legitimacy seam 标记为 `SUS` 仅因太新
- Architecture: HIGH - 核心结论直接来自 live repo 调用链和 workflow
- Pitfalls: HIGH - 基本都来自 live repo 当前冲突与已锁定 decisions

**Research date:** 2026-07-12
**Valid until:** 2026-08-11
