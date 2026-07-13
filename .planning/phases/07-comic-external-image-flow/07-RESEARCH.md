# Phase 7: Comic External Image Flow - Research

**Researched:** 2026-07-13
**Domain:** 漫画章节正文图外链化、R2 切断、Reader 失败体验、后台只读完整性检查
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
- 自动把坏掉的高价值章节图镜像到 R2 的修复流程，属于 `REL-01`，留给后续可靠性 phase。
- 多源 host fallback / reader 自动切换来源，属于 `REL-03`，不在本 phase 落地。
- 长期健康追踪、定时重抓建议、失败历史趋势，属于 `REL-02` 或后续 operations phase。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMIC-01 | Crawler saves comic chapter page images as normalized source image URLs instead of uploading them to R2. | 在 `ComicCrawler.processManga()` 章节批处理段切断 `ImageProcessor.process()`，把标准化放到 `site-92hm.ts`，并保持 `pages.image_url` 继续存 URL 字符串即可。 [VERIFIED: codebase grep] |
| COMIC-02 | Crawler still allows necessary comic covers to use R2 when explicitly configured, while chapter body pages remain external. | 维持封面独立路径，但改成显式开关和专用 helper，避免与章节页共用上传路径。 [VERIFIED: codebase grep] |
| COMIC-03 | API returns chapter image URLs without assuming they are same-origin or R2-backed assets. | Public chapter route 已直接返回 `chapter.pages.map(p => p.imageUrl)`；研究建议保持形状不变，仅补注释/测试和语义约束。 [VERIFIED: codebase grep] |
| COMIC-04 | Reader displays externally hosted chapter images with lazy loading, visible per-image failure feedback, and a usable chapter-level error state. | Reader 当前已保留 `loading="lazy"`、滚动定位、进度保存；研究建议增加逐页状态容器、`@error`/`@load`、部分失败汇总和整章失败态。 [VERIFIED: codebase grep][CITED: https://github.com/vuejs/docs/blob/main/src/guide/essentials/reactivity-fundamentals.md][CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event][CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading] |
| COMIC-05 | Admin/chapter integrity checks can report external image failures without replacing them with R2 mirrors. | 现有 `checkChapterStatus()` 仍依赖 placeholder/failed 字符串；研究建议新增显式只读 probe，并保留 count-only 轻量检查给 crawler。 [VERIFIED: codebase grep] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- 默认用中文输出结论、风险、验证结果和建议；研究文档也应以中文记录关键决策。 [VERIFIED: AGENTS.md]
- 本地验证涉及前端阅读链路时，必须通过 Gateway URL 访问，例如 `http://localhost:8080/comic/`，不能把 `3000` 端口直连当成正确阅读环境。 [VERIFIED: AGENTS.md]
- Phase 7 必须沿用现有 Turborepo + Cloudflare Workers/Pages + Hono + Vue 3 + D1/Drizzle 栈，不做框架级重写。 [VERIFIED: AGENTS.md]
- 管理端和前台的认证、安全、R18 访问控制要继续复用现有 Gateway/API 模式，不能为完整性检查单独发明旁路。 [VERIFIED: AGENTS.md]
- 后续真正改代码时，修改任何函数/方法前都要先跑 GitNexus impact；如果需要提交，再跑 `gitnexus detect-changes`。 [VERIFIED: AGENTS.md]
- 验证命令应优先复用现有 `pnpm`、Vitest、TypeScript、Wrangler 工作流。 [VERIFIED: AGENTS.md]

## Summary

当前章节正文图链路是：`site-92hm-parser.ts` 提取图片 URL 列表，`site-92hm.ts` 只对 `prev/next` 做绝对化补全，`comic-crawler.ts` 在 `processManga()` 里把 `content.images` 分批送入 `this.imageProcessor.process()`，输出 R2 URL 或 placeholder，再通过 `/api/admin/sync` 交给 `syncChapterData()` 全量删写到 `pages.image_url`；public chapter API 再把这些字符串原样回传给 Reader；Reader 当前只区分“章节接口加载失败”和“成功”，不区分单图失败。 [VERIFIED: codebase grep]

因此，最安全的切点不是 API 也不是 Reader，而是 `packages/crawler/src/crawlers/comic-crawler.ts` 里章节批量上传的那一段。只要在那里把“正文图上传到 R2”替换成“标准化外链 URL 并直接 sync”，下游 `pages.image_url -> public chapter API -> Reader` 的历史 contract 就能保留，Phase 7 只需要再补 `syncChapterData()` 的防回退保护和 Reader 的失败体验。 [VERIFIED: codebase grep]

封面与正文页必须分流处理：封面默认继续保留源站 URL，只在显式开关打开时才走专用 cover 上传 helper；章节正文图永远不再进入 `ImageProcessor`。后台完整性检查也必须和 crawler 的廉价完成度检查拆开，前者是手动触发、只读、有限并发的真实外链 probe，后者仍然只做本地 count/status 判断。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md]

**Primary recommendation:** 在 `ComicCrawler.processManga()` 里切断章节页图片上传，在 `syncChapterData()` 里先验证再删写，并把 Reader 改成“逐页状态 + 章节汇总状态”的模型；本 phase 不需要新增依赖，也不需要数据库 migration。 [VERIFIED: codebase grep]

## Current Flow

1. `parseChapterContent()` 读取 `.comicpage img` 等容器内的 `data-original` / `data-src` / `src`，过滤广告/logo/wxqrcode，并在解析阶段去重。 [VERIFIED: codebase grep]
2. `Site92Hm.getChapterContent()` 目前会 enrich `comicSlug`、`chapterSlug`，并把 `prev/next` 相对路径转绝对路径，但不会对 `images` 做绝对化或额外标准化。 [VERIFIED: codebase grep]
3. `ComicCrawler.processManga()` 当前在章节循环里把每个 `content.images` 项交给 `this.imageProcessor.process(rawUrl, \`comics/\${info.slug}/\${chapter.slug}\`, pageNo)`；失败页会被写成 `https://placehold.co/...` 占位 URL。 [VERIFIED: codebase grep]
4. `syncChapterData()` 当前先把 `sourcePageCount` 更新为新数量，然后无条件 `delete(pages where chapterId)`，最后再批量插入新页。 [VERIFIED: codebase grep]
5. Public chapter route 当前返回 `images: chapter.pages.map(p => p.imageUrl)`，没有任何 same-origin、R2 或 CDN rewrite。 [VERIFIED: codebase grep]
6. Reader 当前保留原生 `<img loading="lazy">`、滚动定位和阅读进度保存，但没有 `@error` 分支，也没有 per-image 或 chapter-level 失败状态。 [VERIFIED: codebase grep][CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading]
7. `pages.image_url` 已经是字符串 URL 存储位，`chapters.source_page_count` 已经存在，因此本 phase 不需要 schema 迁移，只需要修正文义与写入策略。 [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 章节正文图 URL 提取与标准化 | Crawler / Ingestion | API / Backend | 解析、去空值、去重、相对转绝对应该在抓取侧完成，API 只做防御式兜底。 [VERIFIED: codebase grep] |
| 空结果与页数回退保护 | API / Backend | Database / Storage | 是否允许覆盖现有页集必须在 delete 之前决定，责任点天然在 `syncChapterData()`。 [VERIFIED: codebase grep] |
| 章节图片对外 contract | API / Backend | Browser / Client | route 已经稳定输出 `images: string[]`，Phase 7 应保持 response shape 稳定。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md] |
| 单图失败提示与整章失败态 | Browser / Client | API / Backend | 失败是否可见、如何重试、如何保留进度都发生在 Reader；API 不应注入 placeholder 语义。 [VERIFIED: codebase grep] |
| 后台完整性检查 | API / Backend | Browser / Client | probe 必须由 admin action 显式触发并在服务端发起；前端只负责展示报告。 [VERIFIED: 07-CONTEXT.md] |
| 封面可选入 R2 | Crawler / Ingestion | Database / Storage | 封面上传入口现在就在 crawler；显式开关和专用 prefix/helper 也应在那里落地。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `hono` | repo `^4.12.14`; npm `4.12.29` modified `2026-07-10` | Public/admin chapter handlers | 现有 API 已在 Hono route/handler 上实现，本 phase 只需扩展既有 handler。 [VERIFIED: codebase grep][VERIFIED: npm registry] |
| `drizzle-orm` | repo `0.45.2`; npm `0.45.2` modified `2026-06-27` | `chapters` / `pages` 读写 | 现有同步逻辑和 schema 都已经在 Drizzle 上；不需要新 ORM 或 migration 工具。 [VERIFIED: codebase grep][VERIFIED: npm registry] |
| `valibot` | repo `^1.3.1`; npm `1.4.2` modified `2026-06-28` | Admin/public 输入验证 | 现有 API schema 层已经采用 Valibot，新增 integrity-check 入参应复用它。 [VERIFIED: codebase grep][VERIFIED: npm registry] |
| `vue` | repo `^3.5.32`; npm `3.5.39` modified `2026-06-25` | Reader 状态和模板事件 | Reader 已是 Vue 3 组合式组件，逐页 `@load` / `@error` 状态最小改动也在这里实现。 [VERIFIED: codebase grep][VERIFIED: npm registry][CITED: https://github.com/vuejs/docs/blob/main/src/guide/essentials/reactivity-fundamentals.md] |
| `vite` | repo `^8.0.8`; npm `8.1.4` modified `2026-07-09` | comic-app 构建与组件测试运行时 | 本 phase 的 Reader 测试继续跑在现有 Vite/Vitest 栈上。 [VERIFIED: codebase grep][VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | repo `^4.1.4`; npm `4.1.10` modified `2026-07-06` | crawler/API/Reader phase tests | 所有新增单测和组件测都应继续用现有 Vitest。 [VERIFIED: codebase grep][VERIFIED: npm registry] |
| `got` | repo `^15.0.2`; npm `15.1.0` modified `2026-07-02` | `site-92hm` 快路径抓取 | 章节 URL 标准化仍由 `getChapterContent()` 产出，现有 got fast-path 不需要替换。 [VERIFIED: codebase grep][VERIFIED: npm registry] |
| `happy-dom` | repo `^20.9.0`; npm `20.10.6` modified `2026-06-17` | parser 测试和 HTML fixture 解析 | 现有 crawler parser 测试已经在 happy-dom 上工作，适合补 chapter-content fixture 测试。 [VERIFIED: codebase grep][VERIFIED: npm registry] |
| `p-map` | repo `^7.0.4`; npm `7.0.5` modified `2026-06-29` | crawler 并发章节处理 | 章节并发控制已经存在，无需另起并发库。 [VERIFIED: codebase grep][VERIFIED: npm registry] |
| `wrangler` | repo `^4.90.0`; npm `4.110.0` modified `2026-07-09` | API worker 本地运行/验证 | 本地 API smoke 与 route-level tests 仍然遵循现有 Worker 开发流程。 [VERIFIED: codebase grep][VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 章节正文图直连外链 | Worker/Pages Function 图片代理 | 与项目级“默认禁止图片代理”约束冲突，并把阅读流量转成 Cloudflare 请求/CPU 成本。 [VERIFIED: PROJECT.md][VERIFIED: 07-CONTEXT.md] |
| 只读 admin probe | 爬取时强制远端健康检查 | 会把每次 crawl/sync 变成昂贵远端探测，违反 D-10 的便宜/本地边界。 [VERIFIED: 07-CONTEXT.md] |
| Reader 原生 `loading="lazy"` + 事件状态 | 自建预加载器/代理占位层 | 不必要地重写现有阅读器行为，且更容易破坏滚动与进度模型。 [VERIFIED: codebase grep][CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading] |

**Installation:**
```bash
# No new packages required for Phase 07.
```

**Version verification:** 已在 2026-07-13 通过 `npm view hono valibot drizzle-orm vue vite vitest got happy-dom p-map wrangler version time.modified repository.url` 核验包存在与当前 registry 版本。 [VERIFIED: npm registry]

## Package Legitimacy Audit

本 phase 不引入新外部依赖，不需要新增安装步骤；planner 应保持 repo 现有依赖，不要为 Phase 7 加入图片代理、状态机或额外抓取框架。 [VERIFIED: codebase grep]

## Recommended File-Level Changes

| File | Change | Why |
|------|--------|-----|
| `packages/crawler/src/crawlers/comic-crawler.ts` | 删除章节正文图 `ImageProcessor.process()` 批量上传段，改为调用 `normalizeChapterImages()` 后直接 sync；把封面上传抽成 `storeComicCoverIfEnabled()`。 [VERIFIED: codebase grep] | 这是唯一把 chapter body images 实际送进 R2 的主切点，也是最小 blast radius 切点。 [VERIFIED: codebase grep] |
| `packages/crawler/src/strategies/site-92hm.ts` | 在 `getChapterContent()` 的 `enrichResult()` 中对 `images` 执行去空值、trim、相对转绝对、保留 query、再次去重。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md] | 解析器已做一轮提取/去重，但绝对化边界还没有落在 `images` 上。 [VERIFIED: codebase grep] |
| `packages/crawler/src/strategies/site-92hm-parser.ts` | 保持选择器集合和基础去重逻辑，不增加“预先探活”或 query 清洗；仅在需要时补 fixture。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md] | D-01 / D-02 明确禁止抓取阶段预探活和 query 裁剪。 [VERIFIED: 07-CONTEXT.md] |
| `apps/api/src/routes/admin/sync/handlers.ts` | 在 `syncChapterData()` 中先读取现有页数与历史 `sourcePageCount`，对空结果和回退结果返回冲突错误，再用事务执行 `update sourcePageCount + replace pages`。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md] | 当前实现先写 count 再 delete，存在数据回退和中途失败留下空章的风险。 [VERIFIED: codebase grep] |
| `apps/api/src/routes/admin/chapters/handlers.ts` | 保留 `checkChapterStatus()` 作为 cheap local check；新增只读 integrity-check handler，返回失败样本、状态分类和探测摘要，不写库。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md] | 现有 status check 只看 placeholder/failed 字符串，不能反映真实外链失败。 [VERIFIED: codebase grep] |
| `apps/api/src/routes/public/comics/index.ts` | 保持 `images: string[]` 形状不变，补测试和注释，确保不做 rewrite。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md] | 当前 route 已满足 D-06；改动重点应是测试和语义锁定，不是新 shape。 [VERIFIED: codebase grep] |
| `apps/comic-app/src/views/Reader.vue` | 把 `images: string[]` 升级成逐页 view-model，增加 `@load` / `@error`、失败卡片、部分失败汇总、整章失败态，并把滚动/进度计算从 `img` 改成页面容器。 [VERIFIED: codebase grep][CITED: https://github.com/vuejs/docs/blob/main/src/guide/essentials/reactivity-fundamentals.md][CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event] | 当前模型只有全局 `loading/error`，且失败页若塌缩会干扰可见页计算。 [VERIFIED: codebase grep] |
| `packages/db/src/schema.ts` | 不做 migration；最多补语义注释说明 `pages.image_url` 存 external/source URL。 [VERIFIED: codebase grep] | 现有列型已经满足外链化，Phase 7 改的是写法和消费语义。 [VERIFIED: codebase grep] |
| `packages/crawler/test/*`, `apps/api/src/routes/**/__tests__/*`, `apps/comic-app/src/views/__tests__/*` | 新增 phase-scoped 测试文件，覆盖标准化、sync guard、public route、admin probe、Reader 失败态。 [VERIFIED: codebase grep] | 当前只有 parser 基础测试，Phase 7 关键防线还缺测试。 [VERIFIED: codebase grep] |

## Architecture Patterns

### System Architecture Diagram

```text
92hm HTML
  -> parseChapterContent() extracts image candidates
  -> Site92Hm.getChapterContent() normalizes external URLs
  -> ComicCrawler.processManga()
       -> cover branch: optional explicit cover upload helper
       -> chapter branch: direct sync of normalized external URLs
  -> /api/admin/sync (syncChapterData)
       -> validate incoming page set
       -> reject empty/regressed sets
       -> replace page rows atomically
  -> D1 tables: chapter.source_page_count + page.image_url
  -> /public/comics/:slug/chapters/:chapterId
       -> return images: string[] unchanged
  -> Reader.vue
       -> native lazy-load img
       -> page-level load/error state
       -> partial-failure banner or chapter-failure view

Admin integrity path:
dashboard/admin action
  -> read-only chapter integrity handler
  -> bounded external probes
  -> failure summary only, no DB writes, no R2 mirror
```

### Recommended Project Structure

```text
packages/
├── crawler/
│   ├── src/crawlers/comic-crawler.ts        # chapter-body cut point + cover gate
│   ├── src/strategies/site-92hm.ts          # image URL normalization seam
│   └── test/                                # parser/crawler phase tests
├── db/
│   └── src/schema.ts                        # no migration; semantic anchor only
apps/
├── api/
│   └── src/routes/
│       ├── admin/sync/handlers.ts           # overwrite guards
│       ├── admin/chapters/handlers.ts       # read-only integrity check
│       └── public/comics/index.ts           # stable images: string[] contract
└── comic-app/
    └── src/views/Reader.vue                 # page failure state and chapter failure UX
```

### Pattern 1: Crawler-Side URL Standardization Before Sync

**What:** 在 crawler 里把章节图片 URL 统一清洗成“非空、唯一、绝对 URL、完整保留 query”的数组，然后直接提交给 API。 [VERIFIED: 07-CONTEXT.md][VERIFIED: codebase grep]

**When to use:** 任何 `ChapterContent.images` 准备进入 `syncChapterData()` 之前。 [VERIFIED: codebase grep]

**Example:**
```typescript
// Source: adapted from current repo seam in packages/crawler/src/strategies/site-92hm.ts
function normalizeChapterImages(baseUrl: string, images: string[]): string[] {
  return images
    .map(url => url.trim())
    .filter(Boolean)
    .map((url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }
      return new URL(url, baseUrl).toString()
    })
    .filter((url, index, all) => all.indexOf(url) === index)
}
```

### Pattern 2: Reader Page Container State

**What:** 以“页面容器”为单位保存 `idle | loaded | failed` 状态，而不是只依赖 `img` DOM 节点。 [VERIFIED: codebase grep][CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event]

**When to use:** 需要同时保留 lazy loading、阅读进度和失败反馈时。 [VERIFIED: codebase grep][CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading]

**Example:**
```vue
<!-- Source: Vue template event handling + MDN img load/error behavior -->
<article
  v-for="page in pages"
  :key="`${page.pageNumber}:${page.retryCount}`"
  class="reader-page"
>
  <img
    v-if="page.status !== 'failed'"
    :src="page.url"
    :alt="`第 ${page.pageNumber} 页`"
    loading="lazy"
    @load="markPageLoaded(page.pageNumber)"
    @error="markPageFailed(page.pageNumber)"
  >
  <button
    v-else
    type="button"
    @click="retryPage(page.pageNumber)"
  >
    第 {{ page.pageNumber }} 页加载失败，点击重试
  </button>
</article>
```

### Anti-Patterns to Avoid

- **把 placeholder URL 写回数据库代表失败状态：** 这会把“内容存储”和“运行时健康”混在一起，并让轻量 status check 误把字符串规则当作真实健康检查。 [VERIFIED: codebase grep]
- **在 API 层 rewrite 外链到 R2/CDN：** 会违背 D-06 和项目级成本边界。 [VERIFIED: PROJECT.md][VERIFIED: 07-CONTEXT.md]
- **在 crawler 里对每张图先探活再入库：** 与 D-01 冲突，也会显著放大 crawl 成本和失败面。 [VERIFIED: 07-CONTEXT.md]
- **把进度定位建立在 `querySelectorAll('img')` 的脆弱假设上：** 一旦失败页渲染成非 `img` 元素或 broken image 高度异常，进度计算就会漂移。 [VERIFIED: codebase grep] |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 章节正文图成本控制 | 默认 Worker/Pages Function 图片代理 | 直接外链 `img src` + Reader 可见失败态 | 项目级约束已禁止默认代理；代理会把存储成本换成请求/CPU 成本。 [VERIFIED: PROJECT.md][VERIFIED: 07-CONTEXT.md] |
| 损坏图片修复 | 自动 R2 mirror/repair job | 只读 integrity report + 后续 phase 再决定修复策略 | Phase 7 只要求可见失败，不要求自动修复。 [VERIFIED: 07-CONTEXT.md] |
| 阅读失败反馈 | 自建预加载框架或额外状态库 | Vue 现有 `ref`/template event handlers + 原生 lazy loading | 现有 Reader 已足够承载逐页状态，不需要新依赖。 [VERIFIED: codebase grep][CITED: https://github.com/vuejs/docs/blob/main/src/guide/essentials/reactivity-fundamentals.md] |
| 健康状态持久化 | 往 `pages.image_url` 塞 sentinel 字符串 | 运行时 probe 结果直接返回给 admin UI | sentinel 会污染内容层语义并误导 completeness check。 [VERIFIED: codebase grep] |

**Key insight:** 这一 phase 的复杂度不在“如何把图片存下来”，而在“如何不再存图片，同时保住 contract、进度和可观测性”。最小改动策略是切断正文图写入、保留 API shape、把失败语义留在 Reader 和 admin probe。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md]

## Pitfalls / Invariants

### Invariants

- `pages.image_url` 在 Phase 7 之后应被视为章节正文图 external/source URL，不再默认代表 R2 对象地址。 [VERIFIED: codebase grep][VERIFIED: PROJECT.md]
- Public chapter API 必须继续返回历史形状 `images: string[]`，且不得 rewrite。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md]
- 封面路径允许存在，但必须是显式开关 + 专用 cover helper/path，不能和章节正文图共用上传入口。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md]
- `syncChapterData()` 在任何 delete 发生前，必须先挡住空结果和回退结果。 [VERIFIED: 07-CONTEXT.md]
- admin integrity check 必须是 read-only、手动触发、有限并发，不自动镜像到 R2。 [VERIFIED: 07-CONTEXT.md]

### Pitfall 1: Delete-First Sync Causes Silent Data Loss

**What goes wrong:** 现在的 `syncChapterData()` 会在没有 guard 的情况下先删旧页，再插新页；如果新数组为空、变少或插入中途报错，章节会被错误清空或降级。 [VERIFIED: codebase grep]

**Why it happens:** 现有实现先 `update sourcePageCount`，再 `delete pages`，最后分 chunk 插入，没有先比较新旧页集，也没有事务包裹。 [VERIFIED: codebase grep]

**How to avoid:** 先归一化新数组，再计算 `existingBaseline = max(currentPageCount, chapter.sourcePageCount ?? 0)`；若 `incomingCount === 0` 或 `incomingCount < existingBaseline`，直接返回冲突错误并保留旧页。 [VERIFIED: 07-CONTEXT.md]

**Warning signs:** API 返回成功但章节页数突然变 0、`sourcePageCount` 与 `pages.length` 倒挂、crawler 统计出现“章节完成”但 Reader 空白。 [VERIFIED: codebase grep]

### Pitfall 2: Stripping Query Parameters Breaks Real Source URLs

**What goes wrong:** 某些源站图片 URL 带 token、签名或防盗链参数；如果标准化时删掉 query，Reader 会稳定 403/404。 [VERIFIED: 07-CONTEXT.md]

**Why it happens:** 这是最常见的“看起来像清理 URL，实际上改了资源身份”的误伤。 [VERIFIED: 07-CONTEXT.md]

**How to avoid:** 仅做非空、去重、相对转绝对；不要裁剪 query，也不要手动净化“追踪参数”。 [VERIFIED: 07-CONTEXT.md]

**Warning signs:** 同一 host 在浏览器打开原始 URL 可访问，但系统存储后的 URL 全部失败。 [VERIFIED: 07-CONTEXT.md]

### Pitfall 3: Reader Failure UI Breaks Scroll/Progress

**What goes wrong:** 如果失败页不再渲染为 `img`，当前 `querySelectorAll('img')` 的定位逻辑就会把页码和视觉位置算错。 [VERIFIED: codebase grep]

**Why it happens:** Reader 当前把“页面元素”和“图片元素”视为同一件事。 [VERIFIED: codebase grep]

**How to avoid:** 用固定顺序的页面容器 `.reader-page` 作为滚动与进度的基准，图片只是容器内部的资源。 [VERIFIED: codebase grep][CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event]

**Warning signs:** 失败页出现后页码跳动、保存的阅读进度偏前或偏后、整章失败时 `currentPage` 仍被判定为 1/总页数。 [VERIFIED: codebase grep]

### Pitfall 4: Integrity Probe Becomes SSRF Utility

**What goes wrong:** 如果 admin probe 可以对任意 URL 发请求，或者允许访问 `localhost` / 私网地址，它就会成为 SSRF 面。 [CITED: https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/][CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html]

**Why it happens:** SSRF 的核心就是服务器在未充分校验目标 URL 时去抓远端资源。 [CITED: https://owasp.org/www-community/attacks/Server_Side_Request_Forgery]

**How to avoid:** probe 只能读取当前章节已存的 `pages.image_url`；限制为 `http/https`，拒绝 `localhost`、私网 IP、link-local 和非标准 scheme；设置小并发、超时和重定向上限。 [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html][CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html]

**Warning signs:** probe 支持手填 URL、可访问内部服务、或报告里出现非漫画源站 host。 [CITED: https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/]

## Verification Matrix

| Area | Requirement | What to Verify | Command / Method | Status |
|------|-------------|----------------|------------------|--------|
| Crawler normalization | COMIC-01 | 相对路径图片被转为绝对 URL，空值被丢弃，query 被保留，重复 URL 被去重 | `pnpm --filter @starye/crawler exec vitest run test/site-92hm-chapter-content.test.ts` | ❌ Wave 0 |
| Crawler body cut point | COMIC-01 | 章节正文图不再调用 `ImageProcessor.process()`；sync payload 直接携带标准化外链 | `pnpm --filter @starye/crawler exec vitest run src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts` | ❌ Wave 0 |
| Cover gate | COMIC-02 | 默认不上传封面；开关打开时仅 cover helper 被调用，章节图仍不上传 | `pnpm --filter @starye/crawler exec vitest run src/crawlers/__tests__/comic-crawler.cover-gate.test.ts` | ❌ Wave 0 |
| Sync overwrite guards | COMIC-01, COMIC-05 | 空页集与回退页集不会覆盖现有数据；合法同量/增量更新可通过 | `pnpm --filter api exec vitest run src/routes/admin/sync/__tests__/handlers.test.ts` | ❌ Wave 0 |
| Public contract | COMIC-03 | chapter route 保持 `images: string[]`，且返回 DB 中原始 URL，不做 rewrite | `pnpm --filter api exec vitest run src/routes/public/comics/__tests__/public-comics.test.ts` | ❌ Wave 0 |
| Reader partial failure | COMIC-04 | 单图失败显示页码、重试、打开原图；未失败页面仍 lazy load | `pnpm --filter @starye/comic-app exec vitest run src/views/__tests__/Reader.test.ts` | ❌ Wave 0 |
| Reader chapter failure | COMIC-04 | 全章 0 成功图时显示整章失败态，且保留返回目录/重试/打开原图路径 | `pnpm --filter @starye/comic-app exec vitest run src/views/__tests__/Reader.test.ts` | ❌ Wave 0 |
| Admin integrity check | COMIC-05 | 默认全章、低并发、短超时的手动 probe 返回失败页数、样本和状态分类，且不写 DB、不触发 R2 修复 | `pnpm --filter api exec vitest run src/routes/admin/chapters/__tests__/integrity-check.test.ts` | ❌ Wave 0 |
| Type safety | COMIC-01..05 | crawler/api/comic-app 类型检查不回退 | `pnpm type-check` | ⚠️ Existing infra |
| Local route sanity | COMIC-03, COMIC-04 | 通过 Gateway 阅读链路能看到外链图、失败提示和进度保存 | 手工：`pnpm dev:clean` 后访问 `http://localhost:8080/comic/` | ⚠️ Manual |

## Code Examples

Verified patterns from official sources:

### Vue Template Event Binding for Page State

```vue
<!-- Source: Vue docs event/template refs + MDN load/error/lazy-loading -->
<img
  :src="page.url"
  loading="lazy"
  @load="markPageLoaded(page.pageNumber)"
  @error="markPageFailed(page.pageNumber)"
>
```

### Hono Execution Context Boundary

```typescript
// Source: Hono Context API docs
app.get('/health', (c) => {
  if (c.executionCtx) {
    c.executionCtx.waitUntil(fetch('https://example.com/log').catch(() => {}))
  }
  return c.text('OK')
})
```

在本 phase 中，这个模式的含义是：crawler 的 cheap status check 不需要远端 probe，而显式 admin integrity action 应该在请求生命周期内产出结果本身；不要把真实 probe 藏到 `waitUntil()` 里让 UI 拿不到同步结果。 [CITED: https://github.com/honojs/hono/blob/main/_autodocs/context-api.md]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 章节正文图上传到 R2，再把结果 URL 存入 `pages.image_url` | 章节正文图只存标准化后的源站 URL，Reader 直接消费 | v1.1 / Phase 7 | 大幅降低 R2 成本，但必须把失败反馈转移到 Reader/admin。 [VERIFIED: codebase grep][VERIFIED: PROJECT.md] |
| 通过 placeholder/failed 字符串推断章节异常 | 通过 runtime failure UI 和只读 probe 报告真实失败 | v1.1 / Phase 7 | 内容存储与健康状态解耦，后台报告更真实。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md] |
| count-check 与状态回写混在同一入口 | cheap count-check 继续本地化，远端健康检查单独手动触发 | v1.1 / Phase 7 | 把高成本 probe 从日常 crawl/sync 路径剥离。 [VERIFIED: codebase grep][VERIFIED: 07-CONTEXT.md] |

**Deprecated/outdated:**

- “章节页失败时把 placeholder URL 写库里再靠字符串识别失败”这一策略应视为过时。 [VERIFIED: codebase grep]
- “默认用 Cloudflare 代理/镜像正文图兜底”这一策略与当前 milestone 的成本边界冲突。 [VERIFIED: PROJECT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | admin integrity probe 默认应优先使用“接近 Reader 行为的有界 GET/取消 body”而不是 HEAD-only，以减少防盗链和错误页面场景下的假阳性。 [ASSUMED] | Common Pitfalls / Verification Matrix | 如果源站对 HEAD 与 GET 行为差异不大，则实现可以更轻；若差异很大，HEAD-only 会低估真实失败。 |
| A2 | 在 Phase 8 的 purpose allowlist 落地前，给 crawler 增加一个显式 cover upload 开关是 Phase 7 最小且清晰的封面分流方式。 [ASSUMED] | Recommended File-Level Changes | 如果 repo 已有更中心化的上传目的配置位，planner 应复用它而不是再造一个开关。 |

## Resolved Decisions

1. **完整性探测默认采用“全章探测、低并发、短超时”，不做默认采样。**
   - Why resolved this way: Phase 7 的单位已经收缩到“显式 admin action + 单章节”，成本压力来自并发和超时，而不是章节总量本身；为了真正 surfacing real external failures，默认采样会把“恰好坏掉的页”变成漏检风险。 [VERIFIED: 07-CONTEXT.md]
   - Locked execution boundary: integrity probe 默认对该章节所有已存 `pages.imageUrl` 做只读探测，但必须限制为低并发、短超时、无自动重试、无后台 cron。 [VERIFIED: 07-CONTEXT.md]
   - Deferred alternative: 采样模式可以作为后续非阻塞增强或 UI 选项，但不作为 Phase 7 默认行为。 [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | crawler/API/comic-app tests | ✓ | `v24.0.1` | — |
| `pnpm` | workspace scripts | ✓ | `10.33.0` | — |
| `vitest` | phase-scoped automated tests | ✓ | `4.1.4` in repo runtime | — |
| `tsx` | crawler scripts and local utilities | ✓ | `4.21.0` | — |
| `wrangler` | API local worker validation | ✓ | `4.90.1` | — |
| `vite` | comic-app local/component validation | ✓ | `8.0.8` | — |

**Missing dependencies with no fallback:**

- None. [VERIFIED: local shell]

**Missing dependencies with fallback:**

- None. [VERIFIED: local shell]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.4` across crawler, API, and comic-app. [VERIFIED: codebase grep][VERIFIED: local shell] |
| Config file | `none` detected at phase scope; packages rely on package-local defaults and scripts. [VERIFIED: codebase grep] |
| Quick run command | phase-scoped Vitest commands from the Verification Matrix. [VERIFIED: codebase grep] |
| Full suite command | `pnpm test` and `pnpm type-check`. [VERIFIED: AGENTS.md][VERIFIED: codebase grep] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMIC-01 | crawler 存标准化外链，不再上传章节正文图 | unit + integration | `pnpm --filter @starye/crawler exec vitest run test/site-92hm-chapter-content.test.ts src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts` | ❌ Wave 0 |
| COMIC-02 | 只有显式 cover gate 可上传封面 | unit | `pnpm --filter @starye/crawler exec vitest run src/crawlers/__tests__/comic-crawler.cover-gate.test.ts` | ❌ Wave 0 |
| COMIC-03 | public chapter API 保持 `images: string[]` 且不 rewrite | integration | `pnpm --filter api exec vitest run src/routes/public/comics/__tests__/public-comics.test.ts` | ❌ Wave 0 |
| COMIC-04 | Reader 显示单图失败与整章失败态，且不破坏进度 | component | `pnpm --filter @starye/comic-app exec vitest run src/views/__tests__/Reader.test.ts` | ❌ Wave 0 |
| COMIC-05 | admin integrity check 只读且能对整章已存 URL 做低并发全量探测并报告真实失败 | integration | `pnpm --filter api exec vitest run src/routes/admin/chapters/__tests__/integrity-check.test.ts src/routes/admin/sync/__tests__/handlers.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** 运行被改包对应的 phase-scoped Vitest 命令。 [VERIFIED: codebase grep]
- **Per wave merge:** 运行 `pnpm type-check`，再运行受影响包的 Vitest 集合。 [VERIFIED: AGENTS.md][VERIFIED: codebase grep]
- **Phase gate:** 至少通过 crawler normalization、API sync guard、public contract、Reader failure UX、admin integrity 五类验证后，再进入 `$gsd-verify-work`。 [VERIFIED: 07-CONTEXT.md]

### Wave 0 Gaps

- [ ] `packages/crawler/test/site-92hm-chapter-content.test.ts` - 覆盖 `images` 绝对化、query 保留、去重、空值过滤。 [VERIFIED: codebase grep]
- [ ] `packages/crawler/src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts` - 覆盖章节图不再上传、封面 helper 不被误触发。 [VERIFIED: codebase grep]
- [ ] `apps/api/src/routes/admin/sync/__tests__/handlers.test.ts` - 覆盖空集/回退保护和事务性替换。 [VERIFIED: codebase grep]
- [ ] `apps/api/src/routes/public/comics/__tests__/public-comics.test.ts` - 锁定 `images: string[]` contract。 [VERIFIED: codebase grep]
- [ ] `apps/api/src/routes/admin/chapters/__tests__/integrity-check.test.ts` - 覆盖只读 probe、失败样本与 SSRF guard。 [VERIFIED: codebase grep]
- [ ] `apps/comic-app/src/views/__tests__/Reader.test.ts` - 覆盖单图失败、整章失败、重试、进度不回退。 [VERIFIED: codebase grep]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | admin integrity action 必须复用现有后台认证/会话入口，不开放匿名 probe。 [VERIFIED: AGENTS.md][ASSUMED] |
| V3 Session Management | yes | 继续沿用 Better Auth + Gateway session 基线，不为 probe 单独发 token 旁路。 [VERIFIED: AGENTS.md][ASSUMED] |
| V4 Access Control | yes | integrity check 仅限 admin 路由；public chapter route 继续只读公开内容并受 R18 访问控制。 [VERIFIED: AGENTS.md][VERIFIED: codebase grep] |
| V5 Input Validation | yes | 新增 probe 入参继续使用 Valibot，限制 URL、scheme、超时、并发和章节作用域。 [VERIFIED: codebase grep][CITED: https://owasp.org/www-project-application-security-verification-standard/][CITED: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html] |
| V6 Cryptography | no | 本 phase 不新增加密需求，不应手写签名、hash 或代理 token 方案。 [VERIFIED: codebase grep] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| admin probe SSRF | Information Disclosure / Elevation | 只探测已存章节 URL，拒绝私网/localhost/非 http(s)，限制重定向与超时。 [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html][CITED: https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/] |
| 外链“打开原图”导致窗口劫持 | Spoofing | 在前端使用 `noopener,noreferrer` 打开外链，只展示 host 或页码，不信任远端标题。 [ASSUMED] |
| 伪造/异常 URL 输入污染 `pages.image_url` | Tampering | crawler/API 双侧都做最小 URL 校验与去空值；不允许 `javascript:`、`data:` 等 scheme。 [VERIFIED: 07-CONTEXT.md][CITED: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html] |
| 远端探测成本被滥用 | Denial of Service | probe 保持手动、章节级、低并发、无自动重试、无后台 cron。 [VERIFIED: 07-CONTEXT.md] |

## Sources

### Primary (HIGH confidence)

- Repository files: `packages/crawler/src/crawlers/comic-crawler.ts`, `packages/crawler/src/strategies/site-92hm.ts`, `packages/crawler/src/strategies/site-92hm-parser.ts`, `apps/api/src/routes/admin/sync/handlers.ts`, `apps/api/src/routes/public/comics/index.ts`, `apps/api/src/routes/admin/chapters/handlers.ts`, `apps/comic-app/src/views/Reader.vue`, `packages/db/src/schema.ts` - 当前实现、切点和 contract。 [VERIFIED: codebase grep]
- `07-CONTEXT.md`, `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `research/SUMMARY.md` - phase 边界、锁定决策、成功标准和成本约束。 [VERIFIED: codebase grep]
- npm registry (`npm view`) - `hono`, `valibot`, `drizzle-orm`, `vue`, `vite`, `vitest`, `got`, `happy-dom`, `p-map`, `wrangler` 的当前 registry 版本与修改时间。 [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- Vue docs via Context7: https://github.com/vuejs/docs/blob/main/src/guide/essentials/reactivity-fundamentals.md - 模板事件与 ref 行为。 [CITED: https://github.com/vuejs/docs/blob/main/src/guide/essentials/reactivity-fundamentals.md]
- Hono docs via Context7: https://github.com/honojs/hono/blob/main/_autodocs/context-api.md - `c.executionCtx.waitUntil` 边界。 [CITED: https://github.com/honojs/hono/blob/main/_autodocs/context-api.md]
- MDN: `HTMLImageElement.loading`, `HTMLElement error event`, `<img>` element docs - lazy loading 和资源失败事件行为。 [CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading][CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event][CITED: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img]
- OWASP ASVS / Input Validation / SSRF guidance - 完整性检查的输入验证和 SSRF 边界。 [CITED: https://owasp.org/www-project-application-security-verification-standard/][CITED: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html][CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html]

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - 全部来自 repo 现状和 npm registry 核验，无新增依赖假设。 [VERIFIED: codebase grep][VERIFIED: npm registry]
- Architecture: MEDIUM - 主链路和切点来自代码，Reader/admin probe 的具体实现形状有少量设计裁量。 [VERIFIED: codebase grep][ASSUMED]
- Pitfalls: MEDIUM - 数据回退、scroll drift、SSRF 风险都有直接依据，但 probe 的默认 GET/HEAD 策略仍需实现时确认。 [VERIFIED: codebase grep][CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html][ASSUMED]

**Research date:** 2026-07-13
**Valid until:** 2026-08-12

## RESEARCH COMPLETE
