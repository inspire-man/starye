# External Integrations

**Analysis Date:** 2026-05-10

## APIs & External Services

**OAuth / Identity:**
- GitHub OAuth — Social login provider
  - SDK/Client: `better-auth` `^1.6.2` (`socialProviders.github` in `apps/api/src/lib/auth.ts`)
  - Auth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (Worker secrets)
  - Flow: Login redirects handled by Better Auth at `/api/auth/*` (`apps/api/src/routes/auth/index.ts`) with catch-all `on(['POST', 'GET'], '/*')`

**Object Storage (S3-compatible):**
- Cloudflare R2 — Images and media storage
  - SDK/Client: `@aws-sdk/client-s3` `^3.1029.0`, `@aws-sdk/s3-request-presigner` `^3.1029.0`
  - Endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com` (`apps/api/src/lib/r2.ts`)
  - Region: `auto`
  - Auth: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (presigned URLs, 1-hour expiry)
  - Also uses direct R2 binding (`env.BUCKET`) for server-side uploads (`apps/api/src/routes/upload/index.ts`); `@aws-sdk/lib-storage` for multipart uploads in crawler
  - Public CDN: `R2_PUBLIC_URL` env var (e.g. `https://cdn.starye.org`)

**Download / Torrent Clients:**
- Aria2 RPC — User-configured download manager (per-user connection)
  - Protocol: JSON-RPC 2.0 over HTTP (`apps/api/src/routes/aria2/services/aria2-proxy.service.ts`)
  - Auth: Token-based secret injected as `token:${secret}` in params (encrypted per-user in DB)
  - Endpoints exposed by API:
    - `GET /api/aria2/config` — Read current user's config
    - `PUT /api/aria2/config` — Update encrypted config
    - `POST /api/aria2/proxy` — Forward JSON-RPC call (10s timeout via `AbortSignal.timeout`)

**AI / LLM (reserved):**
- OpenRouter — Referenced via `OPENROUTER_API_KEY` in `Env` interface (`apps/api/src/lib/auth.ts`), not currently used by runtime routes. Treated as reserved integration slot.

**Crawled data sources (read-only scraping, `packages/crawler`):**
- JavBus (`https://www.javbus.com`) — Primary movie metadata source; strategy in `packages/crawler/src/strategies/javbus`, crawler `packages/crawler/src/crawlers/javbus.ts`
- SeesaaWiki (`https://seesaawiki.jp`) — Primary actor/publisher metadata source; strategy in `packages/crawler/src/strategies/seesaawiki/`
- Name mapping maintained in `packages/crawler/.actor-name-map.json`
- Access via `puppeteer-core` + `puppeteer-extra-plugin-stealth`, with `got`/`got-scraping` as HTTP fallback; optional proxy via `PROXY_SERVER`, `PROXY_USERNAME`, `PROXY_PASSWORD`

## Data Storage

**Databases:**
- Cloudflare D1 (SQLite at edge) — Primary persistence
  - Connection: `DB` binding in `apps/api/wrangler.toml`, database `starye-db` (id `72b60b6c-806f-4795-a846-9b0d157b8225`)
  - Client: `drizzle-orm/d1` via `createDb(d1)` factory (`packages/db/src/index.ts`)
  - Schema: `packages/db/src/schema.ts`
  - Migrations: `packages/db/drizzle/` applied with `wrangler d1 migrations apply starye-db --local|--remote`
  - Drizzle Studio: `pnpm --filter @starye/db studio` (requires `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN`)
- libSQL (`@libsql/client` `^0.17.2`) — Dev/test client used in some scripts; not a runtime dependency

**File Storage:**
- Cloudflare R2 — Bucket `starye-media` (binding `BUCKET` in `apps/api/wrangler.toml`)
  - Upload paths: `images/<timestamp>-<nanoid><ext>` (`apps/api/src/routes/upload/index.ts`)
  - Metadata tracked in `media` D1 table
  - Public access via CDN domain configured in `R2_PUBLIC_URL`

**Caching:**
- Cloudflare KV — Namespace id `f7f6a8c2bff84a1d89da528eab4eb559`, binding `CACHE`
  - Shared by API (`apps/api/wrangler.toml`) and Gateway (`apps/gateway/wrangler.toml`)
  - Used by Gateway's `createCachedProxy` (`apps/gateway/src/cache-middleware.ts`) and API utility (`apps/api/src/utils/cache.ts`)
  - Graceful degradation: `CACHE?` marked optional in `Env` types
- In-memory route cache — TTL constants in `apps/api/src/utils/cache.ts` (e.g. `ARIA2_CONFIG: 10 * 60 * 1000`)

## Authentication & Identity

**Auth Provider:**
- Better Auth `^1.6.2` — Session cookies backed by D1
  - Implementation: `apps/api/src/lib/auth.ts`
  - Adapter: `drizzleAdapter` with `provider: 'sqlite'`
  - Tables: `user`, `session`, `account`, `verification` (from `@starye/db/schema`)
  - Cookie prefix: `starye`; session cookie name `better-auth.session_token`
  - Additional user fields: `role`, `isAdult`, `isR18Verified`
  - Plugins: `openAPI()` exposes auth schema
  - Cookie behavior: `sameSite: 'lax'`, `secure` toggled by protocol, `domain` derived from `WEB_URL` host (stripped `www.`), `path: '/'`
  - Trusted origins computed in `apps/api/src/config.ts` via `getAllowedOrigins(env)` — mixes hard-coded localhost ports with `WEB_URL`/`ADMIN_URL`
  - Client usage: `createAuthClient` from `better-auth/vue` in `apps/dashboard/src/lib/auth-client.ts`; `baseURL = window.location.origin + '/api/auth'` so all traffic must flow through the gateway

## Monitoring & Observability

**Error Tracking:**
- None integrated. API has global error handler (`apps/api/src/middleware/error-handler.ts`) plus `HTTPException` mapping. Frontend uses Vue `app.config.errorHandler` + `window.onunhandledrejection` (`apps/dashboard/src/main.ts`).
- Discord Webhook alerting mentioned as ToDo in `CLAUDLE.md` / `GEMINI.md`, not wired up.

**Logs:**
- Cloudflare Workers Observability enabled on API (`apps/api/wrangler.toml` `[observability.logs]`, `head_sampling_rate = 1`, `persist = true`, `invocation_logs = true`)
- Cloudflare Workers Traces enabled (`head_sampling_rate = 0.1`, `persist = true`)
- Hono middleware stack: `requestId()` + `logger()` + `timing()` (`apps/api/src/index.ts`)
- Audit logger middleware at `apps/api/src/middleware/audit-logger.ts`

**Health Checks:**
- `GET /api/health` route (`apps/api/src/routes/health/`); consumed by crawler workflows before starting scrapes

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers — API (`api.starye.org`), Gateway (`starye.org`, `www.starye.org`)
- Cloudflare Pages — `starye-dashboard`, `starye-auth`, `starye-movie`, `starye-comic`, `starye-tavern`, plus blog custom domain `blog.starye.org`
- Nuxt 4 apps use `nitro.preset: 'cloudflare-pages'` (`apps/blog/nuxt.config.ts`)

**CI Pipeline:**
- GitHub Actions (`.github/workflows/`)
  - `ci.yml` — Lint, type-check, unit tests, E2E (`movie-app/html-integration.spec.ts`) on push/PR to `main`; Node 24 + pnpm 10.33.0
  - Deploys per-app via `deploy-api.yml`, `deploy-api-after-pr.yml`, `deploy-auth.yml`, `deploy-blog.yml`, `deploy-comic.yml`, `deploy-dashboard.yml`, `deploy-gateway.yml`, `deploy-movie.yml`, `deploy-migrations.yml`
  - Scheduled crawlers (use Puppeteer + Chrome installed in-workflow):
    - `daily-movie-crawl.yml` — `0 0 * * *` UTC (08:00 CST)
    - `daily-actor-crawl.yml` — `0 16 * * *` UTC
    - `daily-publisher-crawl.yml` — `0 8 * * *` UTC
    - `daily-manga-crawl.yml`
    - `monthly-cleanup.yml`
- Turborepo remote cache credentials passed via `TURBO_TOKEN` / `TURBO_TEAM` secrets

## Environment Configuration

**Required env vars (API Worker secrets):**
- `BETTER_AUTH_SECRET` — Session signing
- `BETTER_AUTH_URL` — Optional override for auth base URL
- `CRAWLER_SECRET` — Shared secret for crawler → API sync calls
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth app credentials
- `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — R2 access
- `OPENROUTER_API_KEY` — Reserved slot (unused in runtime)

**API Worker plain vars (`apps/api/wrangler.toml` `[vars]`):**
- `WEB_URL = "https://starye.org"`
- `ADMIN_URL = "https://dashboard.starye.org"`

**Gateway plain vars (`apps/gateway/wrangler.toml` `[vars]`):**
- `API_ORIGIN = "https://api.starye.org"`
- `AUTH_ORIGIN = "https://starye-auth.pages.dev"`
- `DASHBOARD_ORIGIN = "https://starye-dashboard.pages.dev"`
- `BLOG_ORIGIN = "https://blog.starye.org"`
- `MOVIE_ORIGIN = "https://starye-movie.pages.dev"`
- `COMIC_ORIGIN = "https://starye-comic.pages.dev"`
- `TAVERN_ORIGIN = "https://starye-tavern.pages.dev"`

**Frontend env vars:**
- `VITE_API_URL` (Vite apps), `NUXT_PUBLIC_API_URL` (Nuxt apps) — Both default to `http://localhost:8080` for local gateway routing
- `apps/dashboard/wrangler.toml` sets `VITE_API_URL = "https://api.starye.org"` for `production` env

**Crawler env vars (GitHub Actions secrets):**
- `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- `API_URL`, `CRAWLER_SECRET`
- `PROXY_SERVER`, `PROXY_USERNAME`, `PROXY_PASSWORD` (optional)
- `TURBO_TOKEN`, `TURBO_TEAM`

**DB tooling env vars (`packages/db/drizzle.config.ts`):**
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN`

**Secrets location:**
- Production: Cloudflare Workers secrets (managed via `wrangler secret put` or Dashboard)
- Local dev: `.dev.vars` per-Worker and `.env.local` at repo root
- CI: GitHub Actions repository secrets
- Example template: `.env.example` (only `VITE_API_URL` / `NUXT_PUBLIC_API_URL` exposed publicly)

## Webhooks & Callbacks

**Incoming:**
- GitHub OAuth callback — Handled by Better Auth catch-all at `POST|GET /api/auth/*` (`apps/api/src/routes/auth/index.ts`)
- Crawler sync calls — Crawler posts to `API_URL` endpoints authenticated via `CRAWLER_SECRET` header (middleware `apps/api/src/middleware/service-auth.ts`); used for upload routes and movie/actor/publisher sync
- User feedback submission — `POST /api/feedback` (`apps/api/src/routes/feedback/feedback.handler.ts`); currently persists to logs only, DB wiring commented as TODO

**Outgoing:**
- Aria2 JSON-RPC calls to user-provided RPC endpoints (`apps/api/src/routes/aria2/services/aria2-proxy.service.ts`)
- Crawler HTTP requests to JavBus / SeesaaWiki and image downloads to R2 (see `packages/crawler`)
- Discord Webhook for alerting — Documented as planned, not implemented

---

*Integration audit: 2026-05-10*
