# Phase 07: Comic External Image Flow - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 12
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/crawler/src/crawlers/comic-crawler.ts` | crawler service | batch / transform | `packages/crawler/src/crawlers/comic-crawler.ts` | self-match |
| `packages/crawler/src/strategies/site-92hm.ts` | strategy | transform | `packages/crawler/src/strategies/site-92hm.ts` | self-match |
| `packages/crawler/src/strategies/site-92hm-parser.ts` | parser utility | transform | `packages/crawler/src/strategies/site-92hm-parser.ts` | self-match |
| `apps/api/src/routes/admin/sync/handlers.ts` | admin handler | request-response / CRUD | `apps/api/src/routes/admin/sync/handlers.ts` | self-match |
| `apps/api/src/routes/admin/chapters/handlers.ts` | admin handler | request-response / probe | `apps/api/src/routes/admin/chapters/handlers.ts` | self-match |
| `apps/api/src/routes/public/comics/index.ts` | public route | request-response | `apps/api/src/routes/public/comics/index.ts` | self-match |
| `apps/api/src/schemas/crawler.ts` | schema | validation | `apps/api/src/schemas/comic.ts` | role-match |
| `apps/comic-app/src/views/Reader.vue` | view component | event-driven / streaming | `apps/comic-app/src/views/Reader.vue` | self-match |
| `packages/crawler/test/site-92hm-chapter-content.test.ts` | test | transform | `packages/crawler/test/site-92hm.test.ts` | exact |
| `packages/crawler/src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts` | test | batch / integration | `packages/crawler/src/crawlers/__tests__/comic-crawler.e2e.test.ts` | role-match |
| `apps/api/src/routes/admin/sync/__tests__/handlers.test.ts` + `apps/api/src/routes/admin/chapters/__tests__/integrity-check.test.ts` + `apps/api/src/routes/public/comics/__tests__/public-comics.test.ts` | tests | request-response | `apps/api/src/routes/public/progress/__tests__/progress.test.ts` | role-match |
| `apps/comic-app/src/views/__tests__/Reader.test.ts` | component test | event-driven | `apps/comic-app/src/composables/__tests__/useAuthGuard.test.ts` | partial-match |

## Pattern Assignments

### `packages/crawler/src/crawlers/comic-crawler.ts` (crawler service, batch / transform)

**Primary analog:** `packages/crawler/src/crawlers/comic-crawler.ts`

**封面与章节分支已经天然分开**（`packages/crawler/src/crawlers/comic-crawler.ts:363-372`, `:458-504`）:

```ts
if (info.cover) {
  const coverImages = await this.imageProcessor.process(
    info.cover,
    `comics/${info.slug}`,
    'cover',
  )
  const preview = coverImages.find(i => i.variant === 'preview')
  if (preview) {
    info.cover = preview.url
  }
}

const batchResults = await Promise.all(
  batch.map(async (rawUrl, batchLocalIndex) => {
    const processed = await this.imageProcessor.process(
      rawUrl,
      `comics/${info.slug}/${chapter.slug}`,
      String(globalIndex + 1).padStart(3, '0'),
    )
    const targetVariant = processed.find(p => p.variant === 'original') || processed[0]
    return targetVariant?.url || 'https://placehold.co/800x1200?text=Image+Load+Failed'
  }),
)

await this.syncToApi('/api/admin/sync', {
  type: 'chapter',
  data: { title: content.title, comicSlug: info.slug, chapterSlug: chapter.slug, images: imageUrls },
})
```

**Apply to this file:**

- 保留现有 `processManga()` 章节循环、批次日志和 `syncToApi('/api/admin/sync')` 调用位置，不要重排整个 crawler 主流程。
- 复用现有“封面先处理、章节后处理”的分支结构，但把章节分支里的 `this.imageProcessor.process()` 整段替换成“直接收集标准化外链 URL”。
- 封面逻辑不要内联散开，优先抽成 `storeComicCoverIfEnabled()` 之类的小 helper，保持章节正文图与封面 opt-in 路径分流。
- 保留 `content.images -> sync payload.images` 这个 contract，只改变 `images` 的来源语义，不改变 payload 形状。

---

### `packages/crawler/src/strategies/site-92hm.ts` (strategy, transform)

**Primary analog:** `packages/crawler/src/strategies/site-92hm.ts`
**Supplementary analog:** `packages/crawler/src/strategies/site-92hm-parser.ts`

**现有 enrichResult 已有 URL 绝对化入口**（`packages/crawler/src/strategies/site-92hm.ts:255-279`）:

```ts
const normalizeUrl = (relativeUrl?: string) => {
  if (!relativeUrl)
    return undefined
  if (relativeUrl.startsWith('http'))
    return relativeUrl
  return `${this.baseUrl}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`
}

return {
  title: data.title,
  images: data.images,
  prev: normalizeUrl(data.prev),
  next: normalizeUrl(data.next),
  comicSlug: comicSlug || '',
  chapterSlug,
}
```

**解析器当前已做提取 + 过滤 + 去重**（`packages/crawler/src/strategies/site-92hm-parser.ts:132-139`）:

```ts
const images = Array.from(
  doc.querySelectorAll('.comicpage img, .comiclist img, .comic-content img, #content img, .rd-article-wr img, .reader-main img'),
  img => img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('src') || '',
)
  .filter(src => src && !src.includes('/ad/') && !src.includes('logo') && !src.includes('wxqrcode.jpg'))
  .filter((v, i, a) => a.indexOf(v) === i)
```

**Apply to these files:**

- Phase 7 的“去空值、trim、相对转绝对、保留 query、再次去重”应落在 `site-92hm.ts` 的 `enrichResult()`，因为这里已经有 `baseUrl` 和上下文 URL。
- `site-92hm-parser.ts` 继续保持“纯提取器”角色，只做 selector/基础过滤，不要在 parser 里引入远端探活、query 清洗或站点策略分支。
- 新的标准化 helper 应兼容 `data-original`、`data-src` 和 `src` 已解析出来的各种相对路径，不要改变 `prev/next` 已有的模式。
- parser 与 strategy 的职责边界要保持清晰：parser 负责抽取，strategy 负责 enrich/normalize。

---

### `apps/api/src/routes/admin/sync/handlers.ts` (admin handler, request-response / CRUD)

**Primary analog:** `apps/api/src/routes/admin/sync/handlers.ts`

**当前是“先记 count，再删旧页，再重插”**（`apps/api/src/routes/admin/sync/handlers.ts:190-234`）:

```ts
const chapter = await db.query.chapters.findFirst({
  where: eq(chapters.id, chapterId),
})

await db.update(chapters)
  .set({ sourcePageCount: data.images.length, updatedAt: new Date() })
  .where(eq(chapters.id, chapterId))

await db.delete(pages).where(eq(pages.chapterId, chapterId))

const pageValues = data.images.map((url: string, index: number) => ({
  id: `${chapterId}-${index + 1}`,
  chapterId,
  pageNumber: index + 1,
  imageUrl: url,
  width: data.width || 0,
  height: data.height || 0,
}))
```

**Apply to this file:**

- 继续把“章节写库”收敛在 `syncChapterData()`，不要把 guard 逻辑拆去 crawler 或 public route。
- 保护逻辑应插在 `chapter` 存在校验之后、任何 `update/delete` 之前；先算 `incomingCount`、`existingPageCount`、`baseline = max(existingPageCount, chapter.sourcePageCount ?? 0)`。
- 合法覆盖仍沿用当前 `pageValues` 构造和 chunk insert 方式，但要外包到事务或等价原子替换边界，避免 delete 后插入失败留下空章。
- route 返回继续使用 `c.json({ success, ... })` 这种既有响应风格；对空结果/回退结果新增明确错误码和 message，不要 silent skip。

---

### `apps/api/src/routes/admin/chapters/handlers.ts` (admin handler, request-response / probe)

**Primary analog:** `apps/api/src/routes/admin/chapters/handlers.ts`

**cheap local check 的现有风格**（`apps/api/src/routes/admin/chapters/handlers.ts:84-118`）:

```ts
export async function checkChapterStatus(c: Context<AppEnv>) {
  const { comicSlug, chapterSlug, sourceCount } = (c.req as any).valid('query')
  const chapter = await db.query.chapters.findFirst({ with: { pages: true } })

  const currentCount = chapter.pages.length
  const hasFailures = chapter.pages.some(
    p => p.imageUrl.includes('placehold.co') || p.imageUrl.includes('failed'),
  )

  if (sourceCount && currentCount >= sourceCount && !hasFailures) {
    c.executionCtx.waitUntil(
      db.update(chapters)
        .set({ sourcePageCount: sourceCount, updatedAt: new Date() })
        .where(eq(chapters.id, chapterId)),
    )
  }

  return c.json({
    exists: true,
    count: currentCount,
    hasFailures,
    status: currentCount >= (sourceCount || 0) && !hasFailures ? 'complete' : 'partial',
  })
}
```

**Apply to this file:**

- 保留 `checkChapterStatus()` 作为 crawler 的便宜本地完成度检查，不把真实外链探测塞进这个 handler。
- Phase 7 新增的 integrity/probe handler 应沿用当前 Hono handler 结构、`c.get('db')` 获取依赖和 `c.json()` 响应形状。
- 新 probe 只能读取 DB 已有 `pages.imageUrl`，不能接受任意 URL 输入；服务端要显式做 `http/https`、私网/localhost 拒绝、低并发和超时控制。
- probe handler 必须是只读 action，不要复用当前 `waitUntil(update sourcePageCount)` 的 side-effect 模式。

---

### `apps/api/src/routes/public/comics/index.ts` (public route, request-response)

**Primary analog:** `apps/api/src/routes/public/comics/index.ts`

**现有 chapter contract 已经是目标形状**（`apps/api/src/routes/public/comics/index.ts:272-305`）:

```ts
const chapter = await db.query.chapters.findFirst({
  where: and(
    eq(chapters.id, fullChapterId),
    eq(chapters.comicId, comic.id),
  ),
  with: {
    pages: {
      orderBy: (pages, { asc }) => [asc(pages.pageNumber)],
    },
  },
})

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

**Apply to this file:**

- 保持 `images: string[]` 和 `pageNumber` 排序逻辑不变，planner 不需要安排 route shape 重构。
- 这里的工作重点是补 contract 测试、必要注释和防回归验证，不是加 rewrite/CDN/R2 推断。
- 如果 planner 想增加 API 侧兜底校验，应保持为非破坏式，例如仅过滤空字符串或非法 scheme；不要改变返回 shape。

---

### `apps/api/src/schemas/crawler.ts` (schema, validation)

**Primary analog:** `apps/api/src/schemas/comic.ts`
**Supplementary analog:** `apps/api/src/schemas/crawler.ts`

**public schema 对 chapter image contract 的写法**（`apps/api/src/schemas/comic.ts:83-90`）:

```ts
export const ChapterDetailSchema = v.pipe(
  v.object({
    id: v.string(),
    title: v.string(),
    chapterNumber: v.string(),
    images: v.array(v.pipe(v.string(), v.url())),
  }),
  v.metadata({ ref: 'ChapterDetail' }),
)
```

**crawler schema 当前有过时描述**（`apps/api/src/schemas/crawler.ts:42-48`）:

```ts
export const ChapterContentSchema = v.object({
  comicSlug: v.pipe(v.string(), v.description('漫画 slug')),
  chapterSlug: v.pipe(v.string(), v.description('章节 slug')),
  title: v.pipe(v.string(), v.description('章节标题')),
  images: v.pipe(
    v.array(v.pipe(v.string(), v.url())),
    v.description('图片 URL 数组（已上传）'),
  ),
})
```

**Apply to this file:**

- 继续沿用 `valibot` 的 `v.array(v.pipe(v.string(), v.url()))` 约束，不要为 external image flow 改成弱类型字符串数组。
- 要改的是描述语义和注释，而不是 validator 结构本身；planner 可以把这里列为“文档/contract 校准”而非逻辑重构。
- `ChapterContentSchema` 与 `ChapterDetailSchema` 需要保持同一 URL contract 语义，但一个代表 crawler 入站，一个代表 public 出站。

---

### `apps/comic-app/src/views/Reader.vue` (view component, event-driven / streaming)

**Primary analog:** `apps/comic-app/src/views/Reader.vue`

**现有状态与生命周期骨架**（`apps/comic-app/src/views/Reader.vue:11-25`, `:57-67`, `:91-114`, `:153-172`）:

```ts
const loading = ref(true)
const error = ref('')
const images = ref<string[]>([])
const currentPage = ref(1)
const totalPages = ref(0)
const loadedImages = new Set<number>()

async function fetchChapter() {
  const response = await comicApi.getChapterDetail(slug, chapterId)
  images.value = response.data.images
  totalPages.value = response.data.images.length
}

function handleScroll() {
  const images = container.querySelectorAll('img')
  let visiblePage = 1
  for (let i = 0; i < images.length; i++) {
    const rect = images[i].getBoundingClientRect()
    if (rect.top < window.innerHeight / 2 && rect.bottom > window.innerHeight / 2) {
      visiblePage = i + 1
      break
    }
  }
}

function handlePageHide() {
  void persistProgress(currentPage.value, currentPage.value >= totalPages.value)
}
```

**现有模板只区分 loading / error / success，图片是裸 `<img>`**（`apps/comic-app/src/views/Reader.vue:206-239`）:

```vue
<div v-else-if="error" class="flex items-center justify-center h-full">
  <div class="text-red-500 text-lg">
    {{ error }}
  </div>
</div>

<div v-else ref="scrollContainer" class="h-full overflow-y-auto scrollbar-hide" @scroll="handleScroll">
  <div class="max-w-4xl mx-auto py-20">
    <img
      v-for="(image, index) in images"
      :key="index"
      :src="image"
      :alt="`第 ${index + 1} 页`"
      class="w-full mb-1"
      loading="lazy"
      @load="onImageLoad(index)"
    >
  </div>
</div>
```

**Apply to this file:**

- 保留现有 `fetchChapter -> loadProgress -> handleScroll -> persistProgress` 主链路，不要把 Reader 重写成全新架构。
- 需要把 `images: string[]` 升成逐页 view-model，但应保留顺序数组驱动模板的方式，避免影响顶部页码和 progress contract。
- `scrollToPage` / `handleScroll` 的基准元素要从裸 `img` 切到稳定的页面容器，以兼容失败卡片和整章失败态。
- 失败处理采用 Vue 原生 `@load` / `@error` + `ref` 状态，不要引入额外状态机库或复杂预加载器。

---

### `packages/crawler/test/site-92hm-chapter-content.test.ts` (test, transform)

**Primary analog:** `packages/crawler/test/site-92hm.test.ts`

**happy-dom fixture test 风格**（`packages/crawler/test/site-92hm.test.ts:1-27`）:

```ts
import fs from 'node:fs'
import path from 'node:path'
import { Window } from 'happy-dom'
import { describe, expect, it } from 'vitest'

const html = fs.readFileSync(path.join(__dirname, 'fixtures/92hm-sample.html'), 'utf-8')
const window = new Window()
const document = window.document
document.write(html)
```

**Apply to this file:**

- 章节 URL 标准化测试继续用 fixture + happy-dom + 纯函数/轻 strategy 调用，不要起浏览器。
- 断言必须覆盖：相对路径绝对化、query 保留、空值过滤、重复 URL 去重。
- 若需要覆盖 `getChapterContent()` 的 enrich 层，优先用最小 HTML fixture 驱动，而不是端到端网络请求。

---

### `packages/crawler/src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts` (test, batch / integration)

**Primary analog:** `packages/crawler/src/crawlers/__tests__/comic-crawler.e2e.test.ts`

**fetch mock + scenario 分组风格**（`packages/crawler/src/crawlers/__tests__/comic-crawler.e2e.test.ts:1-19`, `:91-126`）:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.fetch = vi.fn()

describe('comic-crawler E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该仅处理新章节，跳过已存在章节', async () => {
    const mockFetch = vi.mocked(globalThis.fetch)
    mockFetch.mockImplementation(async (url) => {
      if (urlStr.includes('/api/admin/comics/batch-status')) {
        return { ok: true, json: async () => ({ ... }) } as Response
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response
    })
  })
})
```

**Apply to this file:**

- 新 crawler chapter-flow / cover-gate 测试优先复用 `vi.mocked(globalThis.fetch)`、`beforeEach(vi.clearAllMocks)` 的风格。
- 明确断言“章节正文图不再调用 `ImageProcessor.process()`”与“cover gate 开关关闭时不上传、打开时仅 cover helper 上传”。
- 这类测试更像 orchestration/unit hybrid，不需要真的跑 Puppeteer。

---

### `apps/api/src/routes/admin/sync/__tests__/handlers.test.ts` + `apps/api/src/routes/admin/chapters/__tests__/integrity-check.test.ts` + `apps/api/src/routes/public/comics/__tests__/public-comics.test.ts` (tests, request-response)

**Primary analog:** `apps/api/src/routes/public/progress/__tests__/progress.test.ts`

**Hono app test harness 模式**（`apps/api/src/routes/public/progress/__tests__/progress.test.ts:8-72`）:

```ts
function createProgressDb(opts: ProgressDbOpts = {}) {
  return {
    select: vi.fn(() => ({ ... })),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    query: {
      movies: { findFirst: vi.fn() },
      chapters: { findFirst: vi.fn(), findMany: vi.fn() },
      comics: { findFirst: vi.fn() },
    },
  } as any
}

function createApp(db: any, user?: ReturnType<typeof createMockUser> | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    if (user !== undefined) c.set('user', user as any)
    await next()
  })
  app.route('/', publicProgressRoutes)
  return app
}
```

**请求级断言风格**（`apps/api/src/routes/public/progress/__tests__/progress.test.ts:75-118`）:

```ts
const res = await app.fetch(new Request('http://localhost/watching'))
expect(res.status).toBe(401)
const json: any = await res.json()
expect(json.success).toBe(false)
expect(json.error).toBe('需要登录')
```

**Apply to these files:**

- API route 测试统一沿用“本地 Hono app + 注入 mock db + `app.fetch(new Request(...))`”模式，不要引入外部 HTTP server。
- `sync` handler 测试重点断言状态码、旧数据保留、合法同量/增量更新通过；若实现事务，测试也要覆盖 insert 失败时旧页仍在。
- `public-comics` 测试重点断言排序后的 `images: string[]` 原样返回和 R18/404 分支。
- `integrity-check` 测试重点断言只读 probe 返回失败样本、拒绝私网/localhost、且不触发 DB 写入。

---

### `apps/comic-app/src/views/__tests__/Reader.test.ts` (component test, event-driven)

**Primary analog:** `apps/comic-app/src/composables/__tests__/useAuthGuard.test.ts`
**Supplementary analog:** `apps/comic-app/src/views/Reader.vue`

**comic-app 单测基本风格**（`apps/comic-app/src/composables/__tests__/useAuthGuard.test.ts:1-26`）:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../stores/user', () => ({
  useUserStore: vi.fn(),
}))

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('window', {
    location: {
      href: '',
      pathname: '/comic/detail/456',
      search: '',
      origin: 'http://localhost:3000',
    },
  })
})
```

**Apply to this file:**

- Reader 组件测试继续使用 Vitest mock + 全局 `window` stub，不需要启动真实路由。
- 需要 mock `comicApi`、`progressApi`、`useRoute`、`useRouter`、`useUserStore`，并手动触发 `load` / `error` / `scroll` / `pagehide` 事件。
- 断言至少覆盖：章节接口失败、单图失败卡片、部分失败汇总、整章 0 成功失败态、以及 `0 成功图片不应标记 completed`。

## Shared Patterns

### Hono Route Test Harness

来源：`apps/api/src/routes/public/progress/__tests__/progress.test.ts:8-72`

- 用 `new Hono<AppEnv>()` 创建最小 app。
- 通过 `app.use('*', ...)` 注入 `db`、`user`。
- 用 `app.route('/', routes)` 直接挂载待测 route。
- 通过 `app.fetch(new Request(...))` 做 request-response 断言。

### Valibot URL Contract

来源：`apps/api/src/schemas/crawler.ts:42-48`, `apps/api/src/schemas/comic.ts:83-90`

- crawler 入站和 public 出站都继续用 `v.array(v.pipe(v.string(), v.url()))`。
- 本 phase 改语义，不降级 schema 强度。
- 文案/description 要跟 external/source URL 语义同步。

### Vue Reader State Pattern

来源：`apps/comic-app/src/views/Reader.vue:11-25`, `:153-172`

- 继续用 `ref()` 存章节数据、进度与视图状态。
- 继续通过 `onMounted` 拉取章节、通过 `onUnmounted` + `pagehide` 保存进度。
- 新增逐页失败状态时，优先扩展现有 state，而不是拆成额外 runtime 层。

### Crawler Fixture Parsing Pattern

来源：`packages/crawler/test/site-92hm.test.ts:1-27`

- fixture HTML 用 `fs.readFileSync` 读取。
- `happy-dom` 的 `Window` + `document.write()` 复现 parser 输入。
- 适合验证提取器/标准化器，不适合做 orchestration 或网络行为断言。

### Mocked Fetch Batch Pattern

来源：`packages/crawler/src/crawlers/__tests__/comic-crawler.e2e.test.ts:1-19`

- `globalThis.fetch = vi.fn()` 放在文件顶部。
- `beforeEach(() => vi.clearAllMocks())` 清理批次场景。
- `mockImplementation(async (url) => { ... })` 根据 URL 分支返回不同 API 响应。

## Planning Notes

- Phase 7 不需要 schema migration；planner 不应生成 Drizzle push/migration 任务。
- 主任务波次应优先按“crawler/source URL -> API overwrite guard + probe -> Reader failure UX -> tests/verification”拆分。
- 对 public chapter route 的修改应尽量收敛为测试和 contract 锁定，不要把 Phase 7 误扩成 API 形状改造。
