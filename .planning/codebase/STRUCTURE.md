# Codebase Structure

**Analysis Date:** 2026-05-10

## Directory Layout

```
starye-monorepo/
├── apps/                       # Deployable applications
│   ├── api/                    # Core API Worker (Hono + D1)
│   ├── auth/                   # Auth UI (Nuxt 4)
│   ├── blog/                   # Personal blog (Nuxt 4)
│   ├── comic-app/              # Comic reader (Vue 3 + Vite)
│   ├── dashboard/              # Admin panel (Vue 3 + Vite)
│   ├── gateway/                # Reverse proxy (Cloudflare Worker)
│   └── movie-app/              # Movie streaming (Vue 3 + Vite)
├── packages/                   # Shared libraries
│   ├── api-types/              # RPC type exports from API
│   ├── config/                 # Shared vitest config
│   ├── crawler/                # Puppeteer-based scrapers
│   ├── db/                     # Drizzle ORM + migrations
│   ├── locales/                # i18n resources
│   └── ui/                     # Shared Vue components
├── docs/                       # Live topic docs + library snapshots
│   └── archive/                # Historical / superseded docs moved out of live entrypoints
├── openspec/                   # Spec-driven change proposals
├── scripts/                    # PowerShell/Node utility scripts
├── test/                       # Cross-app E2E tests
├── .github/workflows/          # CI/CD + crawler schedules
├── .agents/                    # Agent skills and workflows
├── AGENTS.md                   # Agent guidance (main)
├── CLAUDE.md, GEMINI.md        # Agent-specific adapters / duplicates
├── README.md, DEVLOG.md        # Project docs
├── package.json                # Root workspace manifest
├── pnpm-workspace.yaml         # pnpm workspace config
├── turbo.json                  # Turborepo pipeline
└── tsconfig.json               # Root TypeScript config
```

## Directory Purposes

**apps/api/:**
- Purpose: Core backend REST API on Cloudflare Workers
- Contains: Hono routes, middleware, services, OpenAPI schemas
- Key files: `apps/api/src/index.ts`, `apps/api/src/types.ts`, `apps/api/wrangler.toml`

**apps/gateway/:**
- Purpose: Unified edge entry point with reverse proxy and caching
- Contains: Routing logic, KV cache middleware
- Key files: `apps/gateway/src/index.ts`, `apps/gateway/src/cache-middleware.ts`

**apps/dashboard/:**
- Purpose: Admin management UI (Vue 3 + Vite)
- Contains: Views, components, stores, composables, Playwright E2E tests
- Key files: `apps/dashboard/src/main.ts`, `apps/dashboard/src/router/index.ts`

**apps/movie-app/:**
- Purpose: Public movie browsing and streaming UI
- Contains: Views, components, Pinia stores, RPC client
- Key files: `apps/movie-app/src/main.ts`, `apps/movie-app/src/lib/api-client.ts`

**apps/comic-app/:**
- Purpose: Public comic/manga reader
- Contains: Views, components, API client
- Key files: `apps/comic-app/src/main.ts`, `apps/comic-app/src/router.ts`

**apps/blog/:**
- Purpose: Personal blog with Markdown content and RSS
- Contains: Nuxt pages, server routes, i18n config
- Key files: `apps/blog/nuxt.config.ts`, `apps/blog/app/pages/index.vue`

**apps/auth/:**
- Purpose: Dedicated authentication UI (GitHub login)
- Contains: Nuxt login page, shared auth layout
- Key files: `apps/auth/nuxt.config.ts`, `apps/auth/app/pages/login.vue`

**packages/db/:**
- Purpose: Database schema, migrations, client factory
- Contains: Drizzle schema, SQL migrations, maintenance scripts
- Key files: `packages/db/src/schema.ts`, `packages/db/src/index.ts`, `packages/db/drizzle/`

**packages/ui/:**
- Purpose: Shared Vue component library
- Contains: Cards, dialogs, tables, toast, skeletons
- Key files: `packages/ui/src/index.ts`, `packages/ui/src/components/`

**packages/crawler/:**
- Purpose: Node.js-based web scraping service
- Contains: Puppeteer crawlers, parsing strategies, image processing
- Key files: `packages/crawler/src/index.ts`, `packages/crawler/src/crawlers/`, `packages/crawler/scripts/`

**packages/api-types/:**
- Purpose: Re-export API types for RPC consumers
- Contains: Single index.ts re-exporting AppType
- Key files: `packages/api-types/src/index.ts`

**packages/config/:**
- Purpose: Shared test and build configuration
- Contains: Vitest base config
- Key files: `packages/config/vitest-base.ts`

**packages/locales/:**
- Purpose: i18n translation resources
- Contains: en-US and zh-CN translation files
- Key files: `packages/locales/src/index.ts`

**docs/:**
- Purpose: Live topic docs and external library snapshots that still have stable reference value
- Contains: Cheatsheets for hono, drizzle, nuxt, vue, workers-ai, plus stable project topic docs
- Key files: `docs/documentation-ownership.md`, `docs/hono/`, `docs/drizzle/`, `docs/vue/`

**docs/archive/:**
- Purpose: Historical / superseded docs removed from live doc entrypoints
- Contains: One-off reports, old deploy/setup guides, completion summaries, legacy storage docs
- Key files: `docs/archive/README.md`, `docs/archive/*.md`

**openspec/:**
- Purpose: Spec-driven change management workflow
- Contains: Active specs, change proposals, archive
- Key files: `openspec/specs/`, `openspec/changes/`, `openspec/config.yaml`

**scripts/:**
- Purpose: Repository-level automation
- Contains: Port cleanup, service checks, migration scripts, test runners
- Key files: `scripts/clean-ports.ps1`, `scripts/check-services.ps1`, `scripts/sync-docs.ps1`

**test/:**
- Purpose: Cross-app integration and E2E tests
- Contains: End-to-end flow tests
- Key files: `test/e2e/flow.test.ts`

## Key File Locations

**Entry Points:**
- `apps/gateway/src/index.ts`: Gateway Worker fetch handler
- `apps/api/src/index.ts`: API Worker Hono app and route chain
- `apps/dashboard/src/main.ts`: Dashboard Vue app bootstrap
- `apps/movie-app/src/main.ts`: Movie App Vue app bootstrap
- `apps/comic-app/src/main.ts`: Comic App Vue app bootstrap
- `apps/blog/nuxt.config.ts`: Blog Nuxt configuration
- `apps/auth/nuxt.config.ts`: Auth Nuxt configuration
- `packages/crawler/src/index.ts`: Crawler CLI runner

**Configuration:**
- `package.json`: Root workspace scripts and dev dependencies
- `pnpm-workspace.yaml`: Package globs and version overrides
- `turbo.json`: Task pipeline for build/test/lint/dev
- `tsconfig.json`: Root TS config with path alias `@starye/*`
- `eslint.config.mjs`: ESLint flat config (antfu/eslint-config)
- `commitlint.config.mjs`: Conventional commit rules
- `apps/*/wrangler.toml`: Cloudflare Worker bindings and routes
- `apps/*/vite.config.ts`: Vite build config per app
- `apps/*/nuxt.config.ts`: Nuxt config per Nuxt app
- `packages/db/drizzle.config.ts`: Drizzle Kit config for migrations

**Core Logic:**
- `apps/api/src/index.ts`: Route registration and OpenAPI setup
- `apps/api/src/types.ts`: Hono context types (AppEnv, Variables)
- `apps/api/src/lib/auth.ts`: Better Auth factory
- `apps/api/src/routes/*/index.ts`: Route group definitions
- `apps/api/src/routes/*/handlers/`: HTTP handler functions
- `apps/api/src/routes/*/services/`: Business logic services
- `apps/api/src/middleware/`: Cross-cutting middleware
- `apps/api/src/schemas/`: Valibot validation schemas
- `packages/db/src/schema.ts`: Drizzle schema definitions

**Testing:**
- `apps/*/src/**/__tests__/`: Co-located unit tests
- `apps/dashboard/e2e/`: Dashboard Playwright E2E tests
- `apps/movie-app/e2e/`: Movie app Playwright E2E tests
- `apps/blog/e2e/`: Blog E2E tests
- `test/e2e/`: Cross-app E2E tests
- `packages/config/vitest-base.ts`: Shared Vitest config

## Naming Conventions

**Files:**
- TypeScript source: `kebab-case.ts` (e.g., `cache-middleware.ts`, `error-handler.ts`)
- Vue components: `PascalCase.vue` (e.g., `MovieCard.vue`, `ConfirmDialog.vue`)
- Handlers: `<resource>.handler.ts` (e.g., `movies.handler.ts`)
- Services: `<resource>.service.ts` (e.g., `movie.service.ts`)
- Schemas: `<resource>.ts` in `schemas/` (e.g., `movie.ts`, `admin.ts`)
- Composables: `use<Feature>.ts` (e.g., `useFavorites.ts`, `useRating.ts`)
- Tests: `<name>.test.ts` or `<name>.spec.ts` (e.g., `movies.test.ts`)
- Nuxt pages: `kebab-case.vue` or `[param].vue` (e.g., `[slug].vue`, `archive.vue`)

**Directories:**
- App names: `kebab-case` (e.g., `movie-app`, `comic-app`)
- Route groups: plural nouns (`movies/`, `actors/`, `favorites/`)
- Subdirs: singular context (`handlers/`, `services/`, `middleware/`)
- Test dirs: `__tests__/` or `__test__/` (mixed convention)

**Packages:**
- All scoped under `@starye/*` namespace
- Package folders: lowercase single word or kebab-case (`db`, `ui`, `api-types`)
- Path alias: `@starye/<pkg>` maps to `./packages/<pkg>/src`

## Where to Add New Code

**New API Endpoint (Public):**
- Route definition: `apps/api/src/routes/<resource>/index.ts`
- Handler: `apps/api/src/routes/<resource>/handlers/<name>.handler.ts`
- Service: `apps/api/src/routes/<resource>/services/<name>.service.ts`
- Schema: `apps/api/src/schemas/<resource>.ts`
- Register: Add `.route('/api/<resource>', <resource>Routes)` in `apps/api/src/index.ts:58`
- Tests: `apps/api/src/routes/<resource>/__tests__/<name>.test.ts`

**New Admin Endpoint:**
- Location: `apps/api/src/routes/admin/<resource>/`
- Register: Add route in `apps/api/src/routes/admin/main/index.ts:20`
- Apply `requireAuth(['admin', 'super_admin'])` middleware

**New Middleware:**
- Location: `apps/api/src/middleware/<name>.ts`
- Pattern: Use `createMiddleware<AppEnv>()` from `hono/factory`
- Register: Add to global stack in `apps/api/src/index.ts:40-50`

**New Vue Component (App-Specific):**
- Location: `apps/<app>/src/components/<Name>.vue`
- Test: `apps/<app>/src/components/__tests__/<Name>.test.ts`

**New Vue Component (Shared):**
- Location: `packages/ui/src/components/<Name>.vue`
- Export: Add line to `packages/ui/src/index.ts`
- Usage: `import { Name } from '@starye/ui'`

**New View/Page:**
- Vue apps: `apps/<app>/src/views/<Name>.vue` + add route in `router.ts`
- Nuxt apps: `apps/<app>/app/pages/<name>.vue` (auto-routed)

**New Composable:**
- App-specific: `apps/<app>/src/composables/use<Name>.ts`
- Shared: `packages/ui/src/composables/use<Name>.ts` + export in `packages/ui/src/index.ts`

**New Pinia Store:**
- Location: `apps/<app>/src/stores/<name>.ts`
- Register: Usually no registration needed, imported on demand

**New Database Table:**
- Schema: Add to `packages/db/src/schema.ts`
- Migration: Generate with `pnpm --filter @starye/db db:generate`
- Apply: `pnpm --filter @starye/db db:migrate:local`

**New Crawler:**
- Crawler class: `packages/crawler/src/crawlers/<name>-crawler.ts`
- Strategy: `packages/crawler/src/strategies/<site>.ts`
- Script: `packages/crawler/scripts/run-<name>.ts`
- Workflow: `.github/workflows/daily-<name>-crawl.yml`

**Utilities:**
- App-specific: `apps/<app>/src/utils/<name>.ts` or `apps/<app>/src/lib/<name>.ts`
- Shared helpers: `packages/ui/src/lib/utils.ts`

**Validation Schemas:**
- API: `apps/api/src/schemas/<resource>.ts` using Valibot

## Special Directories

**drizzle/:**
- Purpose: SQL migration files generated by drizzle-kit
- Location: `packages/db/drizzle/`
- Generated: Yes (from schema.ts)
- Committed: Yes (source of truth for migrations)

**openspec/:**
- Purpose: Change proposals and specifications
- Generated: No (authored manually)
- Committed: Yes
- Archive: `openspec/changes/archive/` excluded from TS compilation

**.planning/:**
- Purpose: GSD workflow artifacts (codebase maps, plans)
- Location: `.planning/codebase/`
- Generated: Yes (by agents)
- Committed: Typically no (worktree-specific)

**playwright-report/:**
- Purpose: Playwright test report output
- Location: `apps/movie-app/playwright-report/`
- Generated: Yes
- Committed: No (gitignored)

**dist/ / .output/ / .nuxt/ / .next/:**
- Purpose: Build output
- Generated: Yes
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: pnpm-managed dependencies
- Generated: Yes (via `pnpm install`)
- Committed: No

**.wrangler/:**
- Purpose: Wrangler local state (D1, KV, R2 simulators)
- Generated: Yes
- Committed: No

## Documentation Boundary Notes

- `docs/` 是 live docs；historical / superseded 文档应迁到 `docs/archive/`。
- `.planning/` 是当前 milestone / phase 真相；`.planning/milestones/` 继续承接 v1.0 evidence chain。
- archive docs 不得重新充当 live owner；需要当前规则时先看 `README.md`、`AGENTS.md`、`RUNBOOK.md` 或 `.planning/*`。

---

*Structure analysis: 2026-05-10; updated 2026-07-13 for Phase 09 docs/archive ownership split*
