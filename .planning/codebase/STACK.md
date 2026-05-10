# Technology Stack

**Analysis Date:** 2026-05-10

## Languages

**Primary:**
- TypeScript ^6.0.2 — All apps (`apps/*`) and packages (`packages/*`), strict mode enabled via root `tsconfig.json`
- Vue 3 SFC (`^3.5.32`) — Frontend components in `apps/dashboard`, `apps/movie-app`, `apps/comic-app`, `apps/blog`, `apps/auth`, `packages/ui`

**Secondary:**
- PowerShell (`pwsh`) — Dev tooling scripts under `scripts/*.ps1` (port cleanup, service health checks, integration tests, deploy checks)
- JavaScript (ESM) — Small Node utilities in `scripts/generate-meta.js`, `scripts/generate-sections.js`
- SQL — Drizzle-generated migrations in `packages/db/drizzle/` plus hand-rolled recovery scripts (`scripts/cleanup-failed-migration.sql`, `scripts/fix-missing-tables.sql`)

## Runtime

**Environment:**
- Cloudflare Workers (V8 isolates) — `apps/api`, `apps/gateway`; `compatibility_date = "2024-04-01"`, `nodejs_compat` flag enabled (`apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`)
- Cloudflare Pages — Static/SSR hosting for `apps/dashboard`, `apps/movie-app`, `apps/comic-app`, `apps/blog`, `apps/auth`
- Node.js 24 — CI runner (`.github/workflows/ci.yml`), crawler (`packages/crawler`), local tooling
- Nuxt 4 (Nitro `cloudflare-pages` preset) — `apps/blog/nuxt.config.ts`, `apps/auth`

**Package Manager:**
- pnpm 10.33.0 (pinned via `packageManager` field in root `package.json`)
- Lockfile: `pnpm-lock.yaml` present (root-level, workspace-wide)
- Workspace config: `pnpm-workspace.yaml` (`apps/*`, `packages/*`) with overrides for `chokidar`, `semver`, `undici`, `undici-types`

## Frameworks

**Core:**
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

**Testing:**
- Vitest `^4.1.4` — Unit/integration tests for `apps/api`, `apps/gateway`, `apps/dashboard`, `apps/movie-app`, `packages/crawler`
- `@vitest/coverage-v8` `^4.1.4`, `@vitest/ui` `^4.1.4`
- `@vue/test-utils` `^2.4.6` + `happy-dom` `^20.8.9` / `jsdom` `^29.0.2` — Component tests
- Playwright `^1.59.1` (`@playwright/test`) — E2E tests in `apps/blog/e2e`, `apps/dashboard/e2e`, `apps/movie-app/e2e`

**Build/Dev:**
- Turborepo `^2.9.6` — Monorepo task orchestration (`turbo.json`: `build`, `dev`, `lint`, `test`, `type-check`, `clean`)
- Wrangler `^4.81.1` — Cloudflare Workers/Pages dev and deploy
- `drizzle-kit` `^0.31.10` — Schema migrations (`packages/db/drizzle.config.ts`, dialect `sqlite`, driver `d1-http`)
- `tsx` `^4.21.0` — TS script runner for DB and crawler scripts
- `vue-tsc` `^3.2.6` — Vue type-checking

## Key Dependencies

**Critical:**
- `@aws-sdk/client-s3` `^3.1029.0` + `@aws-sdk/s3-request-presigner` `^3.1029.0` — S3-compatible R2 uploads and presigned URLs (`apps/api/src/lib/r2.ts`, `packages/crawler`)
- `better-auth` `^1.6.2` — Session-cookie auth backing user/session/account/verification tables; GitHub social provider configured in `apps/api/src/lib/auth.ts`
- `drizzle-orm` `0.45.2` + `drizzle-zod` `^0.8.3` + `zod` `^4.3.6` — Query builder and typed schema (`packages/db/src/schema.ts`, `packages/db/src/index.ts`)
- `@libsql/client` `^0.17.2` — Local libSQL driver for tests/scripts outside D1
- `nanoid` `^5.1.7` — Unique ID generation (upload keys, media IDs)
- `@starye/api-types` (workspace package) — Exports `AppType` for Hono RPC client type inference across frontends

**Infrastructure:**
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

**Environment:**
- `.env.example` at repo root defines `VITE_API_URL`, `NUXT_PUBLIC_API_URL` (both default to `http://localhost:8080` via gateway); optional `VITE_R2_URL`, `VITE_ADMIN_URL`
- `.env.local` convention for local overrides (copied from `.env.example`)
- Cloudflare secrets managed via `wrangler secret put` or `.dev.vars`; declared in `apps/api/src/lib/auth.ts` `Env` interface:
  - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CRAWLER_SECRET`
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
  - `OPENROUTER_API_KEY` (optional, present in interface, not currently wired into runtime code)
  - `WEB_URL`, `ADMIN_URL` (set in `apps/api/wrangler.toml` `[vars]`)
- Gateway public vars in `apps/gateway/wrangler.toml`: `API_ORIGIN`, `AUTH_ORIGIN`, `DASHBOARD_ORIGIN`, `BLOG_ORIGIN`, `MOVIE_ORIGIN`, `COMIC_ORIGIN`, `TAVERN_ORIGIN`
- Drizzle Kit env requirements: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN` (`packages/db/drizzle.config.ts`)

**Build:**
- Root `tsconfig.json` — `target: ESNext`, `module: ESNext`, `moduleResolution: bundler`, path alias `@starye/* -> packages/*/src`
- `turbo.json` — Pipelines for `build`, `dev` (persistent, no cache), `lint`, `test`, `type-check`; outputs `dist/**`, `.output/**`, `.next/**`
- `.npmrc` — `registry-supports-provenance=false` (workaround for trust downgrade issues)
- `eslint.config.mjs` — `@antfu/eslint-config` with TS + Vue, ignores `.agent`, `.cursor`, `.github`, `openspec`
- `commitlint.config.mjs` — Conventional Commits (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`)
- `.lintstagedrc`, `.husky/` — Commit-msg and pre-commit hooks (ESLint via `lint-staged`, commitlint)
- App-level Wrangler: `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, `apps/dashboard/wrangler.toml`

## Platform Requirements

**Development:**
- Node.js >= 18 (README); CI and crawler use Node 24
- pnpm >= 8 (actual: 10.33.0)
- Wrangler CLI (bundled as root devDependency)
- Chrome/Chromium available for Playwright and Puppeteer (auto-installed via `playwright install chromium --with-deps`)
- PowerShell Core (`pwsh`) for Windows scripts; bash alternatives present for docs sync (`scripts/sync-docs.sh`)
- Ports: 8080 (gateway), 8787 (api), 3000 (comic), 3001 (movie), 3002 (blog), 3003 (auth), 3004 (tavern), 5173 (dashboard)

**Production:**
- Cloudflare account with:
  - Workers enabled (API + Gateway)
  - Pages projects: `starye-dashboard`, `starye-auth`, `starye-movie`, `starye-comic` (+ blog custom domain `blog.starye.org`, tavern `starye-tavern.pages.dev`)
  - D1 database `starye-db` (id `72b60b6c-806f-4795-a846-9b0d157b8225`)
  - R2 bucket `starye-media`
  - KV namespace for cache (`CACHE` binding, id `f7f6a8c2bff84a1d89da528eab4eb559`, shared by API and Gateway)
  - Custom domains: `starye.org`, `www.starye.org` (gateway), `api.starye.org` (API)

---

*Stack analysis: 2026-05-10*
