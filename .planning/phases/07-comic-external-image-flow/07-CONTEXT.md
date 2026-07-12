# Phase 7: Comic External Image Flow - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 把漫画章节正文图片链路从 “crawler 下载并上传到 R2，再由 API/Reader 当作同源资源消费” 改成 “crawler 保存标准化后的源站外链 URL，API 原样返回，Reader 和 admin 围绕外链失败做可见反馈与只读检查”。本 phase 只处理章节正文图、封面分流、公共章节 API、Reader 失败体验、以及后台完整性检查；不引入默认图片代理、不自动镜像坏图到 R2、不重命名历史字段或 API 形状，也不处理 Phase 8 的 allowlist enforcement。

</domain>

<decisions>
## Implementation Decisions

### 章节外链入库策略
- **D-01:** `comic-crawler` 的章节正文图在抓取阶段不做保存前可达性预检查；只要解析器拿到可用图片 URL，就直接进入标准化与入库流程，把实际加载失败留给 Reader 和 admin 暴露。
- **D-02:** 章节图片 URL 的标准化边界是：去空值、去重、相对路径转绝对 URL，并保留完整 query 参数；不要擅自清理追踪/签名参数，避免误伤源站防盗链或临时签名。
- **D-03:** 如果某章节本次抓取后没有任何可用图片 URL，则判定该章节抓取失败，不覆盖数据库里已存在的 `pages` 记录。
- **D-04:** 如果某章节本次抓取得到的有效图片数少于库里已有页数，则视为异常/不完整抓取，不覆盖已有 `pages`；只有数量持平或更多时才允许进入覆盖更新。

### 封面与正文分流
- **D-05:** 章节正文图与封面必须彻底分流：章节正文图永远不再调用 `ImageProcessor` 或任何 R2 上传逻辑；漫画封面仍允许通过显式、单独的 allowed path 使用 R2，但默认 crawler 行为应保留源站封面 URL，只有开启明确的封面存储开关时才上传到 R2。

### API 与 Reader 外链消费
- **D-06:** Public comics chapter API 继续返回历史形状 `images: string[]`，其语义锁定为 external/source image URLs；接口层不得对这些 URL 做 CDN/R2 rewrite，也不得假设它们是 same-origin 资源。
- **D-07:** Reader 必须保留现有 lazy loading、滚动阅读和阅读进度保存行为，但每张加载失败的图片位都要显示可见失败反馈，至少包含页码、重试动作，以及“打开原图/外链”的逃生路径。
- **D-08:** Reader 的章节级失败状态分两层：部分图片失败时显示非阻塞的失败汇总/重试入口；如果整章没有任何图片成功加载，则升级为可用的整章失败态（例如重试整章、返回目录、打开原始来源）。外链失败不得静默吞掉。

### 后台完整性检查
- **D-09:** Admin/chapter integrity checks 要从“识别 placeholder/failed 字符串”升级为显式、只读的外链健康检查能力：按需探测外链可访问性，返回失败页数、失败样本或状态分类，但不自动修复、不替换成 R2 mirror。
- **D-10:** 用于日常 crawl/sync 完成判定的轻量状态检查仍然应保持便宜、本地、无额外远端探测；真正的外链健康探测属于 admin/integrity action，而不是每次爬取时的强制步骤。

### the agent's Discretion
None. 用户对章节正文图入库链路给出了明确选择，并授权其余灰区采用推荐方案。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and Requirements
- `.planning/PROJECT.md` — v1.1 目标、R2 成本边界、章节正文图外链化和禁止默认代理的项目级约束。
- `.planning/REQUIREMENTS.md` — Phase 7 requirements `COMIC-01` through `COMIC-05`，以及与镜像/健康检查相关的 v2 defer 项。
- `.planning/ROADMAP.md` — Phase 7 goal、success criteria，以及与后续 Phase 8/10 的边界。
- `.planning/research/SUMMARY.md` — milestone 级 Cloudflare 成本结论：章节正文图不应走 R2 或默认 Worker 代理。
- `.planning/phases/06-storage-policy-audit/06-CONTEXT.md` — Phase 6 锁定的 source/external URL 与 R2 asset 术语、no-proxy 边界、以及 comic chapter image forbidden-risk baseline。

### Data and API Contracts
- `packages/db/src/schema.ts` — `chapter_pages.image_url`、`comics.cover_image` 等历史字段与当前存储形状。
- `apps/api/src/schemas/comic.ts` — `ChapterDetailSchema` 仍然使用 `images: string[]` 且要求 URL 形状。
- `apps/api/src/routes/admin/sync/handlers.ts` — `syncChapterData` 当前的 pages 全量删写逻辑，是空结果/页数回退保护的关键入口。
- `apps/api/src/routes/public/comics/index.ts` — public chapter API 当前返回 `chapter.pages.map(p => p.imageUrl)`。

### Crawler and Reader Flows
- `packages/crawler/src/crawlers/comic-crawler.ts` — 章节正文图当前仍通过 `ImageProcessor` 上传 R2；封面与章节图分流都要在这里落地。
- `packages/crawler/src/strategies/site-92hm.ts` — `getChapterContent` 的 URL enrich/normalize 入口。
- `packages/crawler/src/strategies/site-92hm-parser.ts` — 章节图片提取、过滤、去重的解析器基础行为。
- `packages/crawler/src/lib/strategy.ts` — `ChapterContent.images` 的 crawler contract。
- `apps/comic-app/src/lib/api-client.ts` — comic reader 获取章节详情的 API client 边界。
- `apps/comic-app/src/views/Reader.vue` — lazy loading、scroll progress、以及本 phase 需要补上的 per-image / chapter-level failure UX。
- `apps/api/src/routes/admin/chapters/handlers.ts` — 现有 chapter status 检查只看 placeholder/failed 字符串，是 admin integrity checks 的起点而不是终点。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/crawler/src/strategies/site-92hm.ts` 已经负责相对路径转绝对路径、章节 slug enrich，可以复用为“章节图 URL 标准化”入口。
- `apps/api/src/routes/admin/sync/handlers.ts` 已经集中处理章节 page 覆盖写入，适合加“空结果/页数回退不覆盖”的保护逻辑。
- `apps/comic-app/src/views/Reader.vue` 已经具备 lazy loading、滚动阅读、pagehide flush 和 progress save 行为，本 phase 只需在现有链路上补失败态，不必重写阅读器。
- `apps/api/src/routes/admin/chapters/handlers.ts` 已经有 chapter status/check 的基础入口，可以延展成只读 integrity check，而不是新造一套完全独立的章节检查体系。

### Established Patterns
- Crawler strategy 负责抓取/标准化，`comic-crawler` 负责批量处理与 sync；正文图外链化应优先在 crawler 侧切断 R2 上传，而不是只在 API 侧兜底。
- Public comics API 已经把章节图当作普通 URL 数组返回，说明本 phase 更适合保持 response shape 稳定、只修正文义和消费路径。
- Reader 现有错误处理只覆盖整章接口请求失败，不覆盖单图加载失败；Phase 7 需要在同一视图层引入更细粒度的失败反馈，而不改变进度保存模型。

### Integration Points
- `comic-crawler -> syncChapterData -> chapter_pages.image_url -> public comics API -> Reader` 是本 phase 的主链路。
- `comic-crawler cover handling -> comics.cover_image` 与章节正文图链路必须拆开，避免封面策略被正文图外链化误伤。
- `admin chapter status / integrity check` 需要与 crawler 的廉价同步状态检查解耦，避免每次抓取都触发昂贵的远端健康探测。

</code_context>

<specifics>
## Specific Ideas

- 如果源站图片 URL 带签名、token 或防盗链 query 参数，标准化后必须完整保留。
- 章节部分失败时优先做“保留阅读上下文的非阻塞提示”，整章 0 成功图片时再升级成强失败态。
- 封面走 R2 必须通过显式开关或独立 allowed path 表达，不能再复用章节图那套“见图就传”的默认路径。
- 管理端的外链健康检查是 read-only probe + 报告，不是自动修复器。

</specifics>

<deferred>
## Deferred Ideas

- 自动把坏掉的高价值章节图镜像到 R2 的修复流程，属于 `REL-01`，留给后续可靠性 phase。
- 多源 host fallback / reader 自动切换来源，属于 `REL-03`，不在本 phase 落地。
- 长期健康追踪、定时重抓建议、失败历史趋势，属于 `REL-02` 或后续 operations phase。

</deferred>

---

*Phase: 7-Comic External Image Flow*
*Context gathered: 2026-07-13*
