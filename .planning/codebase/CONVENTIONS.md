# Coding Conventions

**Analysis Date:** 2026-05-10

## Naming Patterns

**Files:**
- Route modules: `kebab-case` — `apps/api/src/routes/feature-flags/`, `apps/api/src/routes/movies/handlers/player-report.handler.ts`
- Handlers: `*.handler.ts` — `apps/api/src/routes/movies/handlers/sync.handler.ts`
- Services: `*.service.ts` — `apps/api/src/routes/movies/services/movie.service.ts`
- Vue components: `PascalCase.vue` — `apps/movie-app/src/components/BottomNavigation.vue`, `packages/ui/src/components/MovieCard.vue`
- Vue composables: `camelCase` with `use*` prefix — `apps/movie-app/src/composables/useToast.ts`, `useFavorites.ts`, `useDrawer.ts`
- Utilities: `camelCase` — `apps/movie-app/src/utils/magnetLink.ts`, `errorHandler.ts`
- Schemas (Valibot): lowercase noun — `apps/api/src/schemas/actor.ts`, `admin.ts`
- Test files: mirror source name + `.test.ts` — `movie.service.test.ts`; E2E (API integration): `*.e2e.test.ts`; Playwright E2E: `*.spec.ts`
- Config files: `<tool>.config.<ext>` — `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`

**Functions:**
- `camelCase` — `getMovieList`, `checkUserAdultStatus`, `buildMovieOrderBy`
- Hono middleware factories use verb suffix `Middleware` — `authMiddleware()`, `databaseMiddleware()`, `corsMiddleware()`
- Guard factories return middleware — `requireAuth(role?)`, `serviceAuth()`

**Variables:**
- `camelCase` for values — `const requestId`, `const queryBuilder`, `let env`
- `SCREAMING_SNAKE_CASE` for enum members — `ErrorCode.VALIDATION_ERROR`, `ErrorCode.UNAUTHORIZED` (`apps/api/src/types/errors.ts`)

**Types:**
- `PascalCase` for interfaces, types, enums — `ErrorResponse`, `MovieListItem`, `GetMoviesOptions`, `ErrorCode`
- Schema exports suffix intent — `*Schema` (Valibot), `*Input`, `*Result`, `*Options` — `GetActorsQuerySchema`, `SyncMovieDataOptions`
- Hono app env type: `AppEnv` (`apps/api/src/types`)

**Exports:**
- Router instances named `<feature>Routes` — `moviesRoutes`, `actorsRoutes`, `favoritesRoutes`
- Chain `app.route('/api/movies', moviesRoutes)` in `apps/api/src/index.ts` to preserve RPC type inference, then `export type AppType = typeof routes`

## Code Style

**Formatting:**
- Tool: [`@antfu/eslint-config`](eslint.config.mjs) v8 (TypeScript + Vue) handles both lint and formatting — no Prettier
- EditorConfig (`.editorconfig`) enforces: 2-space indent, LF line endings, UTF-8, final newline, trim trailing whitespace (except `*.md`)
- Module system: ESM everywhere (`"type": "module"` in root `package.json`)
- TypeScript: `strict: true`, `module: ESNext`, `moduleResolution: bundler` (`tsconfig.json`)
- Prefer single quotes, no semicolons (antfu defaults)

**Linting:**
- Config: `eslint.config.mjs` — flat config using `antfu({ typescript: true, vue: true })`
- Global ignores: `**/dist`, `**/node_modules`, `**/.output`, `**/.nuxt`, `**/.wrangler`, `.agent/*`, `.cursor/*`, `.github/*`, `.trae/*`, `openspec/*`
- Custom rule overrides: `e18e/prefer-static-regex: 'off'`, `e18e/ban-dependencies: 'off'`
- Enforcement: `pnpm lint` (Turbo task) runs `eslint .` per package; `pnpm lint:fix` applies autofixes
- Pre-commit: `.husky/pre-commit` runs `pnpm lint-staged`, which executes `eslint --fix` on staged `*.{js,ts,vue,json}` (`.lintstagedrc`)

**Commit Messages:**
- Enforced by commitlint (`commitlint.config.mjs`) extending `@commitlint/config-conventional`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Rules: subject required, no trailing period, case is flexible
- Scope optional but common — `feat(dashboard):`, `fix(ci):`, `perf:`

## Import Organization

**Order** (enforced by antfu config auto-sort):
1. `import type` statements (grouped first) — `import type { AppEnv } from './types'`
2. Node built-ins — `import process from 'node:process'`, `import path from 'node:path'`
3. External packages — `import { Hono } from 'hono'`, `import { describe, expect, it, vi } from 'vitest'`
4. Workspace packages — `import { createDb } from '@starye/db'`
5. Relative imports (parent first, then sibling) — `import { authMiddleware } from './middleware/auth'`

**Path Aliases:**
- Root `tsconfig.json`: `@starye/*` → `./packages/*/src` (monorepo workspace references)
- Per-app `vitest.config.ts` / `vite.config.ts`: `@` → `./src` (e.g., `apps/movie-app`, `apps/api`)
- Workspace protocol in `package.json`: `"@starye/db": "workspace:*"`, `"@starye/ui": "workspace:*"`, `"@starye/api-types": "workspace:*"`

## Error Handling

**Pattern — throw, don't return:**
- Throw `HTTPException` from `hono/http-exception` for expected HTTP errors in handlers and middleware (`apps/api/src/routes/movies/handlers/movies.handler.ts:53`, `apps/api/src/middleware/guard.ts:19`)
- Centralized `errorHandler` in `apps/api/src/middleware/error-handler.ts` classifies errors in this order: Valibot → Drizzle → Better Auth → HTTPException → unknown (500)
- Registered globally: `app.onError(errorHandler)` in `apps/api/src/index.ts:53`

**Error response shape** (`apps/api/src/types/errors.ts`):
```typescript
interface ErrorResponse {
  success: false
  error: string
  code?: string           // ErrorCode enum value
  details?: unknown
  requestId?: string      // injected from hono/request-id
  timestamp: string       // ISO 8601
}
```

**ErrorCode enum** used across the API — `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_RESOURCE`, `CONSTRAINT_VIOLATION`, `RATE_LIMIT_EXCEEDED`, `DATABASE_ERROR`, `INTERNAL_SERVER_ERROR`, `GATEWAY_TIMEOUT`.

**Frontend error handling:**
- Composables catch and store into `error.value` with friendly messages, log with prefixed tag — `console.error('[useFavorites] 加载失败:', e)` (`apps/movie-app/src/composables/useFavorites.ts:46`)
- Typed error categories via `ErrorType` union in `apps/movie-app/src/utils/errorHandler.ts` (`aria2-connection | aria2-task | rating | websocket | network | other`) with `getFriendlyErrorMessage()` returning `{ title, description, suggestion }`

## Logging

**Backend (Hono):**
- Built-in `logger()` middleware registered globally (`apps/api/src/index.ts:41`)
- Structured error logs with bracketed category + `requestId`:
  ```typescript
  console.error('[Valibot Error]', { requestId, error: err })
  console.error('[Auth Error]', { requestId, error: err })
  console.error('[HTTP Exception]', { requestId, status, message })
  ```
- Every request gets a UUID via `requestId()` middleware, surfaced in `X-Request-Id` header and echoed in error payloads.

**Frontend:**
- `console.log/warn/error` with bracketed tag: `console.error('[useFavorites] 加载失败:', e)`, `console.error('[D1 Mock Error]', error)`
- Global error init: `initGlobalErrorHandling()` in `apps/movie-app/src/main.ts:15`
- Performance monitor gated on `import.meta.env.DEV` or `VITE_FEATURE_PERF_MONITOR` flag

## Comments

**Language:** Chinese is the default for inline comments, JSDoc descriptions, and test `describe` / `it` titles. English is accepted for technical terminology and API contracts.

**JSDoc usage:**
- Exported functions document purpose, params, and returns when behavior isn't obvious:
  ```typescript
  /**
   * Middleware to require authentication and optional role verification.
   *
   * @param requiredRole Single role or array of roles allowed to access.
   *                     'admin' and 'super_admin' are always allowed.
   */
  export function requireAuth(requiredRole?: string | string[])
  ```
- Test files open with a short JSDoc block describing the test target (`apps/api/src/middleware/__tests__/error-handler.test.ts:1-5`)

**Inline comments** annotate numbered middleware stacks and step-by-step flows:
```typescript
app.use('*', requestId())          // 1️⃣ 请求追踪
app.use('*', logger())             // 2️⃣ 结构化日志
app.use('*', timing())             // 3️⃣ 性能指标
```

## Function Design

**Size:** Keep handler functions thin — parse request, call service, return JSON. Non-trivial logic lives in `services/*.service.ts`. Example: `getMovieList` in `apps/api/src/routes/movies/handlers/movies.handler.ts` is 29 lines; heavy lifting is in `movie.service.ts`.

**Parameters:**
- Functions with >2 params use a single options object with a named interface:
  ```typescript
  export interface GetMoviesOptions {
    db: Database
    isAdult: boolean
    page?: number
    pageSize?: number
    genre?: string
    // ...
  }
  export async function getMovies(options: GetMoviesOptions): Promise<GetMoviesResult>
  ```
- Services accept the Drizzle `Database` instance injected from context (`c.get('db')`) rather than importing a global.

**Return values:**
- Services return plain typed objects (`GetMoviesResult { data, meta }`, `SyncMovieDataResult { success, failed, skipped }`)
- Handlers return `c.json(result)` directly; never construct `Response` manually
- Prefer throwing `HTTPException` over returning error envelopes from services

## Module Design

**Exports:**
- Named exports only — no `default export` except for Hono route groups that are composed with `.route()` in the main app (`adminMainRoutes`, `aria2Routes`, `featureFlagsRouter`, `feedbackRouter`, `monitoringRouter`, `ratingsRoutes`)
- Route groups created inline with chainable Hono builder:
  ```typescript
  export const moviesRoutes = new Hono<AppEnv>()
    .get('/', publicCache(), getMovieList)
    .get('/:identifier', detailCache(), getMovieDetail)
  ```

**Barrel files:** Rare. Feature folders expose `index.ts` only when it composes the public router (`apps/api/src/routes/movies/index.ts`). Component directories typically import by filename, not through barrels.

**Schema validation:** Valibot (`valibot` package, aliased as `v`) is the source of truth for request/response shapes. Schemas live in `apps/api/src/schemas/` and are attached to routes via `@hono/standard-validator` or `hono-openapi`. Prefer `v.pipe(..., v.description(...), v.metadata({ ref: '...' }))` so OpenAPI docs inherit descriptions.

**Hono RPC chain:** Every new route must be mounted on the main chain in `apps/api/src/index.ts` — breaking the chain silently drops types from `AppType`. See `.agents/skills/starye-hono-rpc/SKILL.md` for the required sequence.

## Project-Specific Patterns

**Cloudflare Workers context access:**
- Never reach for global `process.env` in request paths; read from `c.env` (Workers bindings) — `c.env.DB`, `c.env.CACHE`, `c.env.CRAWLER_SECRET`, `c.env.BETTER_AUTH_SECRET`
- `process.env.NODE_ENV` only allowed for dev-mode branching in initialization code (`apps/api/src/middleware/database.ts:31`)

**Context state propagation:**
- Standard keys set on the Hono context: `db` (Drizzle client), `auth` (Better Auth instance), `user` (SessionUser | undefined), `requestId`
- Downstream handlers read with `c.get('db')`, `c.get('user')`

**Cache headers:** Use middleware helpers — `publicCache()`, `listCache()`, `detailCache()`, `userCache()` from `apps/api/src/middleware/cache.ts`. Don't set `Cache-Control` manually in handlers.

**Drizzle queries:** Prefer `db.query.<table>.findMany({ where, columns, with })` for relational reads; fall back to `db.select().from(...)` only for aggregates. Use the `FilterBuilder` helper in `apps/api/src/services/query-builder.ts` for composable where-clauses.

**Tailwind tokens:** Map to design tokens from `packages/ui/tailwind.preset.ts` — do not hardcode hex colors in Vue components. See `.agents/skills/starye-ui-components/SKILL.md`.

---

*Convention analysis: 2026-05-10*
