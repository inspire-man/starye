<!-- GSD:project-start source:PROJECT.md -->
## Project

**Starye — 个人内容中台**

一个自用的个人内容中台：集视频库（movie-app）、漫画库（comic-app）、博客（blog）、后台运管（dashboard）、爬虫（crawler）、认证（auth）、网关（gateway）、边缘 API（api）于一体，统一部署在 Cloudflare 边缘网络上，供作者一个人日常使用。

**Core Value:** **"部署在公网、能稳定日常使用的个人内容中台"** —— 所有子应用在同一域名下协同工作，能长期保持可访问、可阅读、可观看。其他一切（特性完整度、多用户、正式审核流）都可以退让，但"能用、不崩"必须守住。

### Constraints

- **技术栈**：沿用现有 Turborepo + Cloudflare Workers/Pages + Hono + Vue 3/Nuxt 4 + D1/R2/KV + Drizzle + Better Auth — 已有大量代码投入，不重写
- **预算**：维持在 Cloudflare 免费额度内（或接近免费） — 自用项目不愿承担月费
- **单用户**：作者一人使用，不做多租户隔离、配额、计费
- **包管理**：pnpm 10.33.0（lockfile 已锁，workspace 配置已定）
- **分支策略**：主干 `main`，功能在分支（worktree）开发后合入
- **中文注释 / 文档**：作者使用中文作为主交流语言
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ^6.0.2 — All apps (`apps/*`) and packages (`packages/*`), strict mode enabled via root `tsconfig.json`
- Vue 3 SFC (`^3.5.32`) — Frontend components in `apps/dashboard`, `apps/movie-app`, `apps/comic-app`, `apps/blog`, `apps/auth`, `packages/ui`
- PowerShell (`pwsh`) — Dev tooling scripts under `scripts/*.ps1` (port cleanup, service health checks, integration tests, deploy checks)
- JavaScript (ESM) — Small Node utilities in `scripts/generate-meta.js`, `scripts/generate-sections.js`
- SQL — Drizzle-generated migrations in `packages/db/drizzle/` plus hand-rolled recovery scripts (`scripts/cleanup-failed-migration.sql`, `scripts/fix-missing-tables.sql`)
## Runtime
- Cloudflare Workers (V8 isolates) — `apps/api`, `apps/gateway`; `compatibility_date = "2024-04-01"`, `nodejs_compat` flag enabled (`apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`)
- Cloudflare Pages — Static/SSR hosting for `apps/dashboard`, `apps/movie-app`, `apps/comic-app`, `apps/blog`, `apps/auth`
- Node.js 24 — CI runner (`.github/workflows/ci.yml`), crawler (`packages/crawler`), local tooling
- Nuxt 4 (Nitro `cloudflare-pages` preset) — `apps/blog/nuxt.config.ts`, `apps/auth`
- pnpm 10.33.0 (pinned via `packageManager` field in root `package.json`)
- Lockfile: `pnpm-lock.yaml` present (root-level, workspace-wide)
- Workspace config: `pnpm-workspace.yaml` (`apps/*`, `packages/*`) with overrides for `chokidar`, `semver`, `undici`, `undici-types`
## Frameworks
- Hono `^4.12.12` — Edge API framework (`apps/api/src/index.ts`); also consumed by clients via `hono/client` RPC
- `hono-openapi` `^1.3.0` — OpenAPI 3.0 generation inline with route definitions (`apps/api/src/index.ts`)
- `@scalar/hono-api-reference` `^0.10.7` — Interactive `/api/docs` UI served from the API worker
- Vue 3 `^3.5.32` + Vue Router `^5.0.4` — Shared across Vite apps and Nuxt apps
- Nuxt `^4.4.2` — `apps/blog`, `apps/auth` (SSR on Cloudflare Pages)
- Vite `^8.0.8` with `@vitejs/plugin-vue` `^6.0.6` — Bundler for Vue SPAs
- Pinia `^3.0.4` — State store in `apps/movie-app`, `apps/comic-app`
- Tailwind CSS `^4.2.2` via `@tailwindcss/vite` — Styling across all frontend apps
- Shadcn-style primitives via `radix-vue` `^1.9.17` — Base UI components in `packages/ui`
- `class-variance-authority` `^0.7.1`, `clsx` `^2.1.1`, `tailwind-merge` `^3.5.0`, `tailwindcss-animate` `^1.0.7` — UI utility stack in `packages/ui`
- Drizzle ORM `0.45.2` — Database access layer (`packages/db`, `apps/api`)
- Better Auth `^1.6.2` with `drizzleAdapter` + `openAPI` plugin — Session auth (`apps/api/src/lib/auth.ts`)
- Valibot `^1.3.1` + `@hono/standard-validator` `^0.2.2` + `@valibot/to-json-schema` `^1.6.0` — Request validation and JSON Schema export
- Vitest `^4.1.4` — Unit/integration tests for `apps/api`, `apps/gateway`, `apps/dashboard`, `apps/movie-app`, `packages/crawler`
- `@vitest/coverage-v8` `^4.1.4`, `@vitest/ui` `^4.1.4`
- `@vue/test-utils` `^2.4.6` + `happy-dom` `^20.8.9` / `jsdom` `^29.0.2` — Component tests
- Playwright `^1.59.1` (`@playwright/test`) — E2E tests in `apps/blog/e2e`, `apps/dashboard/e2e`, `apps/movie-app/e2e`
- Turborepo `^2.9.6` — Monorepo task orchestration (`turbo.json`: `build`, `dev`, `lint`, `test`, `type-check`, `clean`)
- Wrangler `^4.81.1` — Cloudflare Workers/Pages dev and deploy
- `drizzle-kit` `^0.31.10` — Schema migrations (`packages/db/drizzle.config.ts`, dialect `sqlite`, driver `d1-http`)
- `tsx` `^4.21.0` — TS script runner for DB and crawler scripts
- `vue-tsc` `^3.2.6` — Vue type-checking
## Key Dependencies
- `@aws-sdk/client-s3` `^3.1029.0` + `@aws-sdk/s3-request-presigner` `^3.1029.0` — S3-compatible R2 uploads and presigned URLs (`apps/api/src/lib/r2.ts`, `packages/crawler`)
- `better-auth` `^1.6.2` — Session-cookie auth backing user/session/account/verification tables; GitHub social provider configured in `apps/api/src/lib/auth.ts`
- `drizzle-orm` `0.45.2` + `drizzle-zod` `^0.8.3` + `zod` `^4.3.6` — Query builder and typed schema (`packages/db/src/schema.ts`, `packages/db/src/index.ts`)
- `@libsql/client` `^0.17.2` — Local libSQL driver for tests/scripts outside D1
- `nanoid` `^5.1.7` — Unique ID generation (upload keys, media IDs)
- `@starye/api-types` (workspace package) — Exports `AppType` for Hono RPC client type inference across frontends
- `@cloudflare/workers-types` `^4.20260413.1` — D1/R2/KV binding types
- `better-sqlite3` `^12.9.0` (root devDep) — Local SQLite for scripts/tests; listed in `ignoredBuiltDependencies`
- `puppeteer-core` `^24.40.0` + `puppeteer-extra` `^3.3.6` + `puppeteer-extra-plugin-stealth` `^2.11.2` — Browser-driven scraping (`packages/crawler`)
- `cheerio` `^1.2.0` — HTML parsing fallback in crawler
- `got` `^15.0.1` + `got-scraping` `^4.2.1` + `cacheable-lookup` `^7.0.0` — HTTP fetching with scraping defenses
- `sharp` `^0.34.5` — Image processing in crawler
- `p-map` `^7.0.4`, `p-queue` `^9.1.2`, `cli-progress` `^3.12.0` — Concurrency and progress tooling
- `@orama/orama` `^3.1.18` — Local search index build (`packages/crawler/scripts/build-search.ts`)
- `xgplayer` `^3.0.24` — Video player in `apps/movie-app`
- `@wangeditor/editor` `^5.1.23` + `@wangeditor/editor-for-vue` `^5.1.12` — Rich-text editor in dashboard
- `vis-network` `^10.0.2` — Relationship graph visualisation in dashboard
- `qrcode.vue` `^3.8.1` — QR rendering in `apps/movie-app`
- `markdown-it` `^14.1.1` + `shiki` `^4.0.2` + `@shikijs/markdown-it` `^4.0.2` — Blog markdown rendering
- `lucide-vue-next` `^1.0.0` — Icon set across UI apps
- `@vueuse/core` `^14.2.1` — Composition utilities in dashboard/auth
- `vue-i18n` `^11.3.2` + `@nuxtjs/i18n` `^10.2.4` + `@starye/locales` — i18n (zh-CN default, en-US)
## Configuration
- `.env.example` at repo root defines `VITE_API_URL`, `NUXT_PUBLIC_API_URL` (both default to `http://localhost:8080` via gateway); optional `VITE_R2_URL`, `VITE_ADMIN_URL`
- `.env.local` convention for local overrides (copied from `.env.example`)
- Cloudflare secrets managed via `wrangler secret put` or `.dev.vars`; declared in `apps/api/src/lib/auth.ts` `Env` interface:
- Gateway public vars in `apps/gateway/wrangler.toml`: `API_ORIGIN`, `AUTH_ORIGIN`, `DASHBOARD_ORIGIN`, `BLOG_ORIGIN`, `MOVIE_ORIGIN`, `COMIC_ORIGIN`, `TAVERN_ORIGIN`
- Drizzle Kit env requirements: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN` (`packages/db/drizzle.config.ts`)
- Root `tsconfig.json` — `target: ESNext`, `module: ESNext`, `moduleResolution: bundler`, path alias `@starye/* -> packages/*/src`
- `turbo.json` — Pipelines for `build`, `dev` (persistent, no cache), `lint`, `test`, `type-check`; outputs `dist/**`, `.output/**`, `.next/**`
- `.npmrc` — `registry-supports-provenance=false` (workaround for trust downgrade issues)
- `eslint.config.mjs` — `@antfu/eslint-config` with TS + Vue, ignores `.agent`, `.cursor`, `.github`, `openspec`
- `commitlint.config.mjs` — Conventional Commits (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`)
- `.lintstagedrc`, `.husky/` — Commit-msg and pre-commit hooks (ESLint via `lint-staged`, commitlint)
- App-level Wrangler: `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, `apps/dashboard/wrangler.toml`
## Platform Requirements
- Node.js >= 18 (README); CI and crawler use Node 24
- pnpm >= 8 (actual: 10.33.0)
- Wrangler CLI (bundled as root devDependency)
- Chrome/Chromium available for Playwright and Puppeteer (auto-installed via `playwright install chromium --with-deps`)
- PowerShell Core (`pwsh`) for Windows scripts; bash alternatives present for docs sync (`scripts/sync-docs.sh`)
- Ports: 8080 (gateway), 8787 (api), 3000 (comic), 3001 (movie), 3002 (blog), 3003 (auth), 3004 (tavern), 5173 (dashboard)
- Cloudflare account with:
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Route modules: `kebab-case` — `apps/api/src/routes/feature-flags/`, `apps/api/src/routes/movies/handlers/player-report.handler.ts`
- Handlers: `*.handler.ts` — `apps/api/src/routes/movies/handlers/sync.handler.ts`
- Services: `*.service.ts` — `apps/api/src/routes/movies/services/movie.service.ts`
- Vue components: `PascalCase.vue` — `apps/movie-app/src/components/BottomNavigation.vue`, `packages/ui/src/components/MovieCard.vue`
- Vue composables: `camelCase` with `use*` prefix — `apps/movie-app/src/composables/useToast.ts`, `useFavorites.ts`, `useDrawer.ts`
- Utilities: `camelCase` — `apps/movie-app/src/utils/magnetLink.ts`, `errorHandler.ts`
- Schemas (Valibot): lowercase noun — `apps/api/src/schemas/actor.ts`, `admin.ts`
- Test files: mirror source name + `.test.ts` — `movie.service.test.ts`; E2E (API integration): `*.e2e.test.ts`; Playwright E2E: `*.spec.ts`
- Config files: `<tool>.config.<ext>` — `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`
- `camelCase` — `getMovieList`, `checkUserAdultStatus`, `buildMovieOrderBy`
- Hono middleware factories use verb suffix `Middleware` — `authMiddleware()`, `databaseMiddleware()`, `corsMiddleware()`
- Guard factories return middleware — `requireAuth(role?)`, `serviceAuth()`
- `camelCase` for values — `const requestId`, `const queryBuilder`, `let env`
- `SCREAMING_SNAKE_CASE` for enum members — `ErrorCode.VALIDATION_ERROR`, `ErrorCode.UNAUTHORIZED` (`apps/api/src/types/errors.ts`)
- `PascalCase` for interfaces, types, enums — `ErrorResponse`, `MovieListItem`, `GetMoviesOptions`, `ErrorCode`
- Schema exports suffix intent — `*Schema` (Valibot), `*Input`, `*Result`, `*Options` — `GetActorsQuerySchema`, `SyncMovieDataOptions`
- Hono app env type: `AppEnv` (`apps/api/src/types`)
- Router instances named `<feature>Routes` — `moviesRoutes`, `actorsRoutes`, `favoritesRoutes`
- Chain `app.route('/api/movies', moviesRoutes)` in `apps/api/src/index.ts` to preserve RPC type inference, then `export type AppType = typeof routes`
## Code Style
- Tool: [`@antfu/eslint-config`](eslint.config.mjs) v8 (TypeScript + Vue) handles both lint and formatting — no Prettier
- EditorConfig (`.editorconfig`) enforces: 2-space indent, LF line endings, UTF-8, final newline, trim trailing whitespace (except `*.md`)
- Module system: ESM everywhere (`"type": "module"` in root `package.json`)
- TypeScript: `strict: true`, `module: ESNext`, `moduleResolution: bundler` (`tsconfig.json`)
- Prefer single quotes, no semicolons (antfu defaults)
- Config: `eslint.config.mjs` — flat config using `antfu({ typescript: true, vue: true })`
- Global ignores: `**/dist`, `**/node_modules`, `**/.output`, `**/.nuxt`, `**/.wrangler`, `.agent/*`, `.cursor/*`, `.github/*`, `.trae/*`, `openspec/*`
- Custom rule overrides: `e18e/prefer-static-regex: 'off'`, `e18e/ban-dependencies: 'off'`
- Enforcement: `pnpm lint` (Turbo task) runs `eslint .` per package; `pnpm lint:fix` applies autofixes
- Pre-commit: `.husky/pre-commit` runs `pnpm lint-staged`, which executes `eslint --fix` on staged `*.{js,ts,vue,json}` (`.lintstagedrc`)
- Enforced by commitlint (`commitlint.config.mjs`) extending `@commitlint/config-conventional`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Rules: subject required, no trailing period, case is flexible
- Scope optional but common — `feat(dashboard):`, `fix(ci):`, `perf:`
## Import Organization
- Root `tsconfig.json`: `@starye/*` → `./packages/*/src` (monorepo workspace references)
- Per-app `vitest.config.ts` / `vite.config.ts`: `@` → `./src` (e.g., `apps/movie-app`, `apps/api`)
- Workspace protocol in `package.json`: `"@starye/db": "workspace:*"`, `"@starye/ui": "workspace:*"`, `"@starye/api-types": "workspace:*"`
## Error Handling
- Throw `HTTPException` from `hono/http-exception` for expected HTTP errors in handlers and middleware (`apps/api/src/routes/movies/handlers/movies.handler.ts:53`, `apps/api/src/middleware/guard.ts:19`)
- Centralized `errorHandler` in `apps/api/src/middleware/error-handler.ts` classifies errors in this order: Valibot → Drizzle → Better Auth → HTTPException → unknown (500)
- Registered globally: `app.onError(errorHandler)` in `apps/api/src/index.ts:53`
- Composables catch and store into `error.value` with friendly messages, log with prefixed tag — `console.error('[useFavorites] 加载失败:', e)` (`apps/movie-app/src/composables/useFavorites.ts:46`)
- Typed error categories via `ErrorType` union in `apps/movie-app/src/utils/errorHandler.ts` (`aria2-connection | aria2-task | rating | websocket | network | other`) with `getFriendlyErrorMessage()` returning `{ title, description, suggestion }`
## Logging
- Built-in `logger()` middleware registered globally (`apps/api/src/index.ts:41`)
- Structured error logs with bracketed category + `requestId`:
- Every request gets a UUID via `requestId()` middleware, surfaced in `X-Request-Id` header and echoed in error payloads.
- `console.log/warn/error` with bracketed tag: `console.error('[useFavorites] 加载失败:', e)`, `console.error('[D1 Mock Error]', error)`
- Global error init: `initGlobalErrorHandling()` in `apps/movie-app/src/main.ts:15`
- Performance monitor gated on `import.meta.env.DEV` or `VITE_FEATURE_PERF_MONITOR` flag
## Comments
- Exported functions document purpose, params, and returns when behavior isn't obvious:
- Test files open with a short JSDoc block describing the test target (`apps/api/src/middleware/__tests__/error-handler.test.ts:1-5`)
## Function Design
- Functions with >2 params use a single options object with a named interface:
- Services accept the Drizzle `Database` instance injected from context (`c.get('db')`) rather than importing a global.
- Services return plain typed objects (`GetMoviesResult { data, meta }`, `SyncMovieDataResult { success, failed, skipped }`)
- Handlers return `c.json(result)` directly; never construct `Response` manually
- Prefer throwing `HTTPException` over returning error envelopes from services
## Module Design
- Named exports only — no `default export` except for Hono route groups that are composed with `.route()` in the main app (`adminMainRoutes`, `aria2Routes`, `featureFlagsRouter`, `feedbackRouter`, `monitoringRouter`, `ratingsRoutes`)
- Route groups created inline with chainable Hono builder:
## Project-Specific Patterns
- Never reach for global `process.env` in request paths; read from `c.env` (Workers bindings) — `c.env.DB`, `c.env.CACHE`, `c.env.CRAWLER_SECRET`, `c.env.BETTER_AUTH_SECRET`
- `process.env.NODE_ENV` only allowed for dev-mode branching in initialization code (`apps/api/src/middleware/database.ts:31`)
- Standard keys set on the Hono context: `db` (Drizzle client), `auth` (Better Auth instance), `user` (SessionUser | undefined), `requestId`
- Downstream handlers read with `c.get('db')`, `c.get('user')`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| Gateway | Reverse proxy, routing, caching, path rewriting | `apps/gateway/src/index.ts` |
| API Worker | REST API, auth, business logic, OpenAPI docs | `apps/api/src/index.ts` |
| Dashboard | Admin UI for content management (CRUD) | `apps/dashboard/src/main.ts` |
| Movie App | Public movie browsing, playback, favorites | `apps/movie-app/src/main.ts` |
| Comic App | Public comic reading, progress tracking | `apps/comic-app/src/main.ts` |
| Blog | Personal blog with Markdown content | `apps/blog/nuxt.config.ts` |
| Auth | Authentication UI (GitHub OAuth) | `apps/auth/nuxt.config.ts` |
| Database Package | Drizzle ORM schema, migrations | `packages/db/src/schema.ts` |
| UI Package | Shared Vue components, Tailwind v4 | `packages/ui/src/index.ts` |
| Crawler | Web scraping for JAV content | `packages/crawler/src/index.ts` |
## Pattern Overview
- Cloudflare Workers for serverless compute (API + Gateway)
- Turborepo for build orchestration across apps/packages
- Shared packages for code reuse (db, ui, api-types, config)
- Gateway-based routing for unified domain (starye.org)
- Better Auth for session management with cookie-based auth
- Drizzle ORM with D1 (SQLite) for data persistence
## Layers
- Purpose: Unified entry point, traffic routing, caching
- Location: `apps/gateway/src/`
- Contains: Proxy logic, cache middleware, path rewriting
- Depends on: KV namespace for cache storage
- Used by: All frontend apps and API consumers
- Purpose: Business logic, data access, authentication
- Location: `apps/api/src/`
- Contains: Hono routes, middleware, handlers, services
- Depends on: D1 database, R2 storage, Better Auth
- Used by: Frontend apps via RPC (Hono client)
- Purpose: User interfaces for different audiences
- Location: `apps/{dashboard,movie-app,comic-app,blog,auth}/`
- Contains: Vue/Nuxt components, views, stores, composables
- Depends on: API layer, shared UI package
- Used by: End users via browser
- Purpose: Persistence, schema management
- Location: `packages/db/src/`
- Contains: Drizzle schema, migrations, DB client factory
- Depends on: D1 binding from Cloudflare
- Used by: API layer
- Purpose: Reusable code across apps
- Location: `packages/{ui,api-types,config,locales}/`
- Contains: Components, types, configs, i18n
- Depends on: Framework-specific dependencies
- Used by: All apps
- Purpose: External data ingestion
- Location: `packages/crawler/src/`
- Contains: Puppeteer crawlers, strategies, image processing
- Depends on: API layer (for data sync), R2 (for media upload)
- Used by: GitHub Actions scheduled workflows
## Data Flow
### Primary Request Path
### Authentication Flow
### Crawler Sync Flow
- Frontend: Pinia stores for client state (`apps/movie-app/src/stores/user.ts`)
- Backend: Stateless (session in D1, cache in KV)
## Key Abstractions
- Purpose: Type-safe request context with bindings
- Examples: `apps/api/src/types.ts:12`
- Pattern: Middleware extends context with db, auth, user
- Purpose: Drizzle ORM instance with schema
- Examples: `packages/db/src/index.ts:11`
- Pattern: Factory function creates client from D1 binding
- Purpose: Authentication provider with session management
- Examples: `apps/api/src/lib/auth.ts:34`
- Pattern: Created per-request with dynamic baseURL
- Purpose: HTTP endpoint logic separated from routing
- Examples: `apps/api/src/routes/movies/handlers/movies.handler.ts`
- Pattern: Handler functions receive Hono context, return JSON
- Purpose: Reusable business logic and data access
- Examples: `apps/api/src/routes/movies/services/movie.service.ts`
- Pattern: Pure functions accepting db and parameters
- Purpose: Cross-cutting concerns (auth, logging, errors)
- Examples: `apps/api/src/middleware/auth.ts`, `apps/api/src/middleware/error-handler.ts`
- Pattern: Hono middleware with `createMiddleware<AppEnv>()`
- Purpose: Type-safe API calls from frontend
- Examples: `apps/movie-app/src/lib/api-client.ts:29`
- Pattern: Hono client with inferred types from API routes
## Entry Points
- Location: `apps/gateway/src/index.ts`
- Triggers: HTTP requests to starye.org
- Responsibilities: Route to appropriate service, cache responses
- Location: `apps/api/src/index.ts`
- Triggers: HTTP requests to /api/*
- Responsibilities: Handle business logic, auth, data access
- Location: `apps/dashboard/src/main.ts`
- Triggers: Browser navigation to /dashboard/*
- Responsibilities: Admin UI for content management
- Location: `apps/movie-app/src/main.ts`
- Triggers: Browser navigation to /movie/*
- Responsibilities: Public movie browsing and playback
- Location: `apps/comic-app/src/main.ts`
- Triggers: Browser navigation to /comic/*
- Responsibilities: Public comic reading
- Location: `apps/blog/nuxt.config.ts`
- Triggers: Browser navigation to /blog/*
- Responsibilities: Personal blog content
- Location: `apps/auth/nuxt.config.ts`
- Triggers: Browser navigation to /auth/*
- Responsibilities: Login/logout UI
- Location: `packages/crawler/src/index.ts`
- Triggers: GitHub Actions scheduled workflows
- Responsibilities: Scrape external sites, sync to API
## Architectural Constraints
- **Threading:** Single-threaded event loop (Cloudflare Workers runtime)
- **Global state:** No module-level singletons; all state in D1/KV/R2
- **Circular imports:** None detected; clean dependency graph
- **Request timeout:** 30 seconds max (Hono timeout middleware at `apps/api/src/index.ts:46`)
- **Cold start:** Workers have ~10ms cold start; optimized for edge deployment
- **Database:** D1 is SQLite-based; no transactions across multiple statements
- **Cookie scope:** Domain-wide cookies require path='/' and proper domain setting (`apps/api/src/lib/auth.ts:105`)
- **CORS:** Explicit origin whitelist required for cross-origin requests (`apps/api/src/config.ts:3`)
## Anti-Patterns
### Direct Database Access in Routes
### Bypassing Gateway in Development
### Hardcoded Environment URLs
### Missing Service Auth
## Error Handling
- Valibot validation errors → 400 with field-level details
- Better Auth errors → 401 Unauthorized
- Drizzle constraint violations → 409 Conflict or 400 Bad Request
- HTTPException → Status code from exception
- Unknown errors → 500 Internal Server Error
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| openspec-apply-change | Implement tasks from an OpenSpec change. Use when the user wants to start implementing, continue implementation, or work through tasks. | `.agents/skills/openspec-apply-change/SKILL.md` |
| openspec-archive-change | Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete. | `.agents/skills/openspec-archive-change/SKILL.md` |
| openspec-bulk-archive-change | Archive multiple completed changes at once. Use when archiving several parallel changes. | `.agents/skills/openspec-bulk-archive-change/SKILL.md` |
| openspec-continue-change | Continue working on an OpenSpec change by creating the next artifact. Use when the user wants to progress their change, create the next artifact, or continue their workflow. | `.agents/skills/openspec-continue-change/SKILL.md` |
| openspec-explore | Enter explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements. Use when the user wants to think through something before or during a change. | `.agents/skills/openspec-explore/SKILL.md` |
| openspec-ff-change | Fast-forward through OpenSpec artifact creation. Use when the user wants to quickly create all artifacts needed for implementation without stepping through each one individually. | `.agents/skills/openspec-ff-change/SKILL.md` |
| openspec-new-change | Start a new OpenSpec change using the experimental artifact workflow. Use when the user wants to create a new feature, fix, or modification with a structured step-by-step approach. | `.agents/skills/openspec-new-change/SKILL.md` |
| openspec-onboard | Guided onboarding for OpenSpec - walk through a complete workflow cycle with narration and real codebase work. | `.agents/skills/openspec-onboard/SKILL.md` |
| openspec-propose | Propose a new change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation. | `.agents/skills/openspec-propose/SKILL.md` |
| openspec-sync-specs | Sync delta specs from a change to main specs. Use when the user wants to update main specs with changes from a delta spec, without archiving the change. | `.agents/skills/openspec-sync-specs/SKILL.md` |
| openspec-verify-change | Verify implementation matches change artifacts. Use when the user wants to validate that implementation is complete, correct, and coherent before archiving. | `.agents/skills/openspec-verify-change/SKILL.md` |
| starye-crawler-strategy | Scaffold and enforce Starye crawler architecture standards for a new data source strategy and parser. | `.agents/skills/starye-crawler-strategy/SKILL.md` |
| starye-db-migration | Safely manage Drizzle schema changes, relations, and Cloudflare D1 migrations for Starye. | `.agents/skills/starye-db-migration/SKILL.md` |
| starye-hono-rpc | End-to-end framework for defining OpenAPI routed Hono endpoints connected to Vue frontends. | `.agents/skills/starye-hono-rpc/SKILL.md` |
| starye-ui-components | Maintain Shadcn UI boundaries, tailwind presets, and high-quality premium aesthetics. | `.agents/skills/starye-ui-components/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
