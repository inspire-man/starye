# Testing Patterns

**Analysis Date:** 2026-05-10

## Test Framework

**Runner:**
- [Vitest](https://vitest.dev) `^4.1.4` — unit and integration tests
- [Playwright](https://playwright.dev) `^1.59.1` — browser E2E for Vue apps and admin dashboard
- Coverage: `@vitest/coverage-v8` `^4.1.4`
- Config files:
  - Root workspace orchestration: `turbo.json` (`test` task, no outputs/cache inputs)
  - Shared base: `packages/config/vitest-base.ts`
  - Per-package overrides: `apps/api/vitest.config.ts`, `apps/movie-app/vitest.config.ts`, `apps/dashboard/vitest.config.ts`, `packages/crawler/vitest.config.ts`
  - Playwright: `apps/movie-app/playwright.config.ts`, `apps/dashboard/playwright.config.ts`, `apps/blog/playwright.config.ts`

**Assertion Library:**
- Vitest built-in `expect` (Chai-compatible + Jest matchers). Globals are enabled (`globals: true`) so `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterAll` are ambient.

**Shared base config** (`packages/config/vitest-base.ts`):
```typescript
export const baseVitestConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    include: ['**/*.{test,spec}.{ts,js}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.turbo/**'],
  },
})
```

**Environment per workspace:**

| Package | Environment | Purpose |
|---------|-------------|---------|
| `apps/api` | `node` | Hono request-level tests |
| `apps/movie-app` | `happy-dom` | Vue component / composable tests |
| `apps/dashboard` | `jsdom` (with `setupFiles: ['./src/test/setup.ts']`) | Vue component / composable tests with matchMedia stub |
| `packages/crawler` | `happy-dom` (overrides base) | DOM parsing with fixture HTML |

**Run Commands:**
```bash
pnpm test                               # All packages, via Turbo
pnpm --filter api test                  # apps/api only (vitest in watch)
pnpm --filter api test:coverage         # vitest run --coverage
pnpm --filter @starye/movie-app test    # movie-app unit tests
pnpm --filter @starye/movie-app test:ui # vitest UI
pnpm --filter @starye/movie-app test:e2e         # Playwright
pnpm --filter @starye/movie-app test:e2e:headed  # Playwright headed
pnpm --filter @starye/movie-app test:e2e:debug   # Playwright debug
pnpm --filter @starye/crawler test:unit # vitest run (one-shot)
pnpm test:e2e                           # Root: vitest run test/e2e/flow.test.ts
```

## Test File Organization

**Location — co-located by convention:**
- API server: `apps/api/src/<feature>/__tests__/` mirroring the feature's internal layout (`handlers/`, `services/`, `e2e/`)
- Vue apps: `apps/<app>/src/<folder>/__tests__/` (movie-app, crawler) or `__test__/` (dashboard — note singular)
- Crawler: two locations — `packages/crawler/test/` for top-level fixture-driven tests, `packages/crawler/src/<folder>/__tests__/` for unit tests
- Cross-service integration: `test/e2e/` at the repo root (`test/e2e/flow.test.ts`)

**Naming:**
- Unit / integration: `<source-name>.test.ts` — `movies.handler.test.ts`, `actor.service.test.ts`, `magnetLink.test.ts`
- API E2E (Vitest, Hono `app.request`): `*.e2e.test.ts` placed under `__tests__/e2e/` — `cache-admin.e2e.test.ts`, `favorites-api.e2e.test.ts`, `posts-api.e2e.test.ts`
- Browser E2E (Playwright): `*.spec.ts` under `apps/<app>/e2e/` — `auth-flow.spec.ts`, `rating-system.spec.ts`, `html-integration.spec.ts`
- Crawler fixture tests often skip `__tests__/` and sit next to `package.json` in `packages/crawler/test/`

**Structure:**
```
apps/api/src/
├── middleware/
│   ├── auth.ts
│   ├── error-handler.ts
│   └── __tests__/
│       ├── auth.test.ts
│       ├── cache.test.ts
│       ├── error-handler.test.ts
│       └── middleware-stack.test.ts
├── routes/movies/
│   ├── handlers/
│   ├── services/
│   └── __tests__/
│       ├── handlers/movies.handler.test.ts
│       └── services/sync.service.test.ts
└── test/helpers.ts                # shared mock factories
```

## Test Structure

**Suite Organization:**
```typescript
// apps/api/src/middleware/__tests__/cache.test.ts
describe('cache Middleware', () => {
  let app: Hono<AppEnv>
  let mockCache: Map<string, Response>

  beforeEach(() => {
    app = new Hono<AppEnv>()
    mockCache = new Map()
    globalThis.caches = { default: { /* ... */ } } as CacheStorage
  })

  describe('publicCache', () => {
    it('应返回 Cache-Control 头', async () => { /* ... */ })
    it('应跳过非 GET 请求', async () => { /* ... */ })
  })

  describe('userCache', () => { /* ... */ })
  describe('错误处理', () => { /* ... */ })
})
```

**Patterns:**
- Test titles are written in Chinese, matching the project's 中文协作约定 (AGENTS.md). `describe` labels the SUT (Subject Under Test); `it` reads as a Chinese sentence: "应该…", "应返回…", "未认证时应返回 401"
- Nested `describe` blocks group by feature / scenario / edge case ("基础渲染", "props 配置", "路由集成", "边界情况")
- Use `beforeEach(() => vi.clearAllMocks())` or `vi.restoreAllMocks()` between tests when spies are reused
- Use `vi.useFakeTimers()` / `vi.advanceTimersByTime()` for timed behavior (`apps/movie-app/src/composables/__tests__/useToast.test.ts:72-83`); always restore with `vi.useRealTimers()`

**Hono handler pattern:** Construct a mini `Hono<AppEnv>` app, seed context via middleware, then call `app.fetch(new Request(...))` or `app.request(...)`:
```typescript
const app = new Hono<AppEnv>()
app.use('*', async (c, next) => {
  c.set('db', mockDb)
  c.set('user', mockUser)
  await next()
})
app.get('/movies', getMovieList)

const res = await app.fetch(new Request('http://localhost/movies?page=2&limit=10'))
expect(res.status).toBe(200)
```

## Mocking

**Framework:** Vitest `vi` — `vi.fn()`, `vi.spyOn()`, `vi.mock()`, `vi.stubGlobal()`.

**Shared helpers** (`apps/api/src/test/helpers.ts`):
```typescript
createMockDb()         // Chain-aware Drizzle client mock with query.* namespaces
createMockAuth(session?) // Better Auth mock exposing api.getSession
createMockUser(overrides?)
createMockPost(overrides?)
createMockActor(overrides?)
createMockComic(overrides?)
createMockMovie(overrides?)
createMockPublisher(overrides?)
```
Import via `import { createMockDb, createMockUser } from '../../../../test/helpers'`.

**DB mock — chainable Drizzle builder:**
```typescript
// apps/api/src/routes/movies/__tests__/services/sync.service.test.ts
function createMockDb(overrides?) {
  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  }
  return {
    query: {
      movies: { findFirst: vi.fn().mockResolvedValue(existingMovie) },
      actors: { findFirst: vi.fn().mockResolvedValue(existingActor) },
    },
    insert: vi.fn().mockReturnValue(mockInsertChain),
    update: vi.fn().mockReturnValue(mockUpdate),
    delete: vi.fn().mockReturnValue(mockDeleteChain),
    select: vi.fn().mockReturnValue(mockSelectChain),
  } as unknown as Database
}
```

**Hono context mock** (alternative when a full app isn't needed — `apps/api/src/routes/favorites/__tests__/e2e/favorites-api.e2e.test.ts:11-33`):
```typescript
function createMockContext({ db, user = null, query = {}, params = {} }): Context<any> {
  return {
    get: vi.fn((key) => key === 'db' ? db : key === 'user' ? user : undefined),
    req: {
      query: vi.fn((key) => query[key]),
      param: vi.fn((key) => params[key]),
    },
    json: vi.fn((body) => body),
  } as unknown as Context<any>
}
```

**fetch mocking** (frontend — `apps/movie-app/src/lib/__tests__/api-client.test.ts`):
```typescript
function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

beforeEach(() => { vi.stubGlobal('fetch', mockFetchOk({ success: true, data: [] })) })
afterEach(() => { vi.unstubAllGlobals() })
```

**Spy + service isolation** (`apps/api/src/routes/movies/__tests__/handlers/movies.handler.test.ts`):
```typescript
import * as movieService from '../../services/movie.service'
const mockGetMovies = vi.spyOn(movieService, 'getMovies').mockResolvedValue({ data: [], meta: {...} })
```

**Cloudflare Workers APIs:** stub `globalThis.caches` and mock `KVNamespace` manually — `apps/api/src/middleware/__tests__/cache.test.ts`, `apps/api/src/lib/__tests__/gateway-cache.test.ts`.

**D1 via better-sqlite3:** For cross-service integration (`test/e2e/flow.test.ts`), a `BetterSqliteD1Adapter` class implements the D1 `prepare`/`batch` API on top of an in-memory SQLite database, injected as `env.DB`.

**What to Mock:**
- External network: `fetch`, `got`, Puppeteer `page.goto`/`page.content`
- D1 database and KV namespaces at the Workers API boundary
- Better Auth sessions (via mocked `auth.api.getSession`)
- Browser globals for Workers tests — `globalThis.caches`

**What NOT to Mock:**
- Pure functions (`FilterBuilder`, `validateMagnetLink`, `extractInfoHash`) — test directly with literal inputs
- Hono router composition — use the real `Hono<AppEnv>` instance, only mock what it pulls from `c.env` / `c.get()`
- Parsers — feed raw HTML fixtures through the real DOM (happy-dom) rather than stubbing DOM traversal

## Fixtures and Factories

**Factories** live in `apps/api/src/test/helpers.ts` and produce overridable objects (`createMockUser({ role: 'admin' })`).

**HTML fixtures** for crawler parsing live in `packages/crawler/test/fixtures/` — `92hm-sample.html`, `javdb-detail.html`, `javdb-list.html`. Load with Node `fs`:
```typescript
// packages/crawler/test/site-92hm.test.ts
const html = fs.readFileSync(path.join(__dirname, 'fixtures/92hm-sample.html'), 'utf-8')
const window = new Window()
window.document.write(html)
const info = parseMangaInfo(window.document as unknown as Document, sourceUrl)
window.close()
```

**Inline HTML snippets** are common for small strategies (`packages/crawler/test/avsox.test.ts`): the `page.content` mock returns a raw template literal.

## Coverage

**Requirements:** No global coverage gate is enforced in CI. Local coverage available per package via `pnpm --filter <pkg> test:coverage`.

**Reporters:** `['text', 'json', 'html']` from `packages/config/vitest-base.ts`. Per-app `vitest.config.ts` files extend the exclude list:
```typescript
// apps/movie-app/vitest.config.ts
coverage: {
  exclude: [
    'node_modules/**', 'dist/**', 'e2e/**',
    '**/*.test.ts', '**/*.config.ts',
    'src/main.ts', 'src/router.ts',
  ],
}
```

**View Coverage:**
```bash
pnpm --filter api test:coverage
# HTML report written to apps/api/coverage/index.html
```

## Test Types

**Unit Tests:**
- Pure logic — `magnetLink.test.ts`, `useToast.test.ts`, `progress.test.ts`
- Individual services with mocked DB — `actor.service.test.ts`, `sync.service.test.ts`
- Middleware in isolation — `auth.test.ts`, `cache.test.ts`, `error-handler.test.ts`
- Vue components via `@vue/test-utils` `mount()` — `BottomNavigation.test.ts`, dashboard `Toast.test.ts`

**Integration Tests (Vitest):**
- Handler + service + mocked DB / context — `movies.handler.test.ts`, `favorites-api.e2e.test.ts`
- Middleware stack wired to a real `Hono` app — `middleware-stack.test.ts`
- Root-level cross-service: `test/e2e/flow.test.ts` runs Crawler → API → Frontend against a better-sqlite3-backed D1 adapter

**Vue Component Tests** (`@vue/test-utils` + happy-dom / jsdom):
```typescript
// apps/movie-app/src/components/__tests__/BottomNavigation.test.ts
const wrapper = mount(BottomNavigation, {
  props: { items },
  global: { plugins: [router] },
})
expect(wrapper.findAll('.nav-item')).toHaveLength(3)
expect(wrapper.findAllComponents({ name: 'RouterLink' }).length).toBe(3)
```

**E2E Tests (Playwright):**
- Location per app: `apps/<app>/e2e/`
- Config pattern: `testDir: './e2e'`, `timeout: 60000`, `workers: 1` (serial), Chromium only (`devices['Desktop Chrome']`), `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, `trace: 'retain-on-failure'`
- Auto-starts dev server in `webServer` block; CI skips auto-start on dashboard's config (`reuseExistingServer: !process.env.CI`)
- Session mocking via `page.route('**/api/auth/get-session', (route) => route.fulfill(...))` (`apps/dashboard/e2e/auth-flow.spec.ts:15-22`)

## Common Patterns

**Async Testing:**
```typescript
it('认证后应返回包含 entity 的收藏列表', async () => {
  const mockDb = { /* ... */ } as unknown as Database
  const c = createMockContext({ db: mockDb, user: { id: 'u1' } })
  await getFavoriteList(c)
  expect(c.json).toHaveBeenCalled()
  const response = (c.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
  expect(response.success).toBe(true)
})
```

**Error Testing:**
```typescript
// Reject with throw
await expect(getFavoriteList(c)).rejects.toThrow()

// Assert HTTP status / code from Hono error handler
const res = await app.fetch(new Request('http://localhost/test'))
const json = await res.json() as any
expect(res.status).toBe(404)
expect(json).toMatchObject({
  success: false,
  error: 'Resource not found',
  code: ErrorCode.NOT_FOUND,
})
expect(json.requestId).toBeDefined()
expect(json.timestamp).toBeDefined()
```

**Type-only tests** verify RPC inference surfaces (`apps/api/src/__tests__/app-type.test.ts`):
```typescript
import type { AppType } from '../index'
const typeCheck: AppType = null as unknown as AppType
expect(typeCheck).toBeDefined()
```

**Fake timers for debounce / delay logic:**
```typescript
vi.useFakeTimers()
showToast('自动隐藏', 'success', 1000)
expect(toast.value.show).toBe(true)
vi.advanceTimersByTime(1000)
expect(toast.value.show).toBe(false)
vi.useRealTimers()
```

## CI Integration

`.github/workflows/ci.yml` enforces on every push / PR to `main`:
1. `pnpm install` (pnpm 10.33.0, Node 24)
2. `pnpm lint`
3. `pnpm type-check`
4. Set test env (`CLOUDFLARE_ACCOUNT_ID=test`, `CLOUDFLARE_DATABASE_ID=test`, `CLOUDFLARE_D1_TOKEN=test`)
5. `pnpm test` (Turbo fans out per-package `vitest`)
6. `cd apps/movie-app && pnpm run playwright:install && pnpm run test:e2e html-integration.spec.ts` — a single Playwright smoke test is gated in CI; the full suite is run locally

---

*Testing analysis: 2026-05-10*
