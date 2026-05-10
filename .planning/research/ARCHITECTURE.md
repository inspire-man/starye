# Architecture Research

**Domain:** Cloudflare edge monorepo — gateway + Hono API on Workers + multiple Vue/Nuxt frontends on Pages + GitHub Actions crawler, sharing D1/R2/KV
**Researched:** 2026-05-10
**Confidence:** HIGH (Context7 + codebase evidence) for sessions/preview/cache; MEDIUM for video/progress (informed by CF docs + single-user constraint, not stress-tested)

## Standard Architecture

Current system already implements the recommended topology — this research validates the shape, tightens a few seams, and sequences the five open decisions into a build order. No infrastructure outside Cloudflare is introduced.

### System Overview

```
                             Browser (single user)
                                    │
                                    ▼
                 ┌──────────────────────────────────┐
                 │  Gateway Worker (starye.org)     │
                 │  - apex-domain cookie relay      │
                 │  - KV cache (public + private)   │
                 │  - path-based routing            │
                 │  - invalidateCache() on hook     │
                 └──┬─────────────────────────────┬─┘
                    │                             │
          ┌─────────┼─────────┬────────┬─────────┤
          ▼         ▼         ▼        ▼         ▼
      ┌───────┐ ┌───────┐ ┌────────┐ ┌──────┐ ┌──────────┐
      │ /api  │ │/dash  │ │/movie  │ │/comic│ │/blog     │
      │ Hono  │ │ Vue   │ │ Vue    │ │ Vue  │ │ Nuxt     │
      │Worker │ │ Pages │ │ Pages  │ │Pages │ │ Pages    │
      └───┬───┘ └───────┘ └────────┘ └──────┘ └──────────┘
          │
          ├──── Better Auth (session in D1, cookie apex=.starye.org)
          │
          ▼
  ┌─────────────────────────────────────────────────────┐
  │   D1 (users, sessions, movies, progress, favorites) │
  │   R2 starye-media (images, video files)             │
  │     └─ served via cdn.starye.org custom domain      │
  │   KV (CACHE, shared by gateway + api utils)         │
  └─────────────────────────────────────────────────────┘
          ▲
          │  (crawler → POST /api/.../sync with CRAWLER_SECRET)
          │
  ┌─────────────────────────────────────┐
  │  GitHub Actions (3× daily cron)     │
  │  Puppeteer crawler → R2 + API       │
  └─────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owns | Does Not Own |
|-----------|------|--------------|
| Gateway Worker | URL routing, KV cache read/write, cache invalidation hooks, request header normalization | Business logic, auth decisions, DB access |
| API Worker (Hono) | Auth, CRUD, progress sync, service-auth gate for crawler, R2 presigning | HTML rendering, static assets |
| Frontend Pages (Vue/Nuxt) | UI, client-side state, progress debouncing, RPC calls through gateway | Cross-app data, session minting |
| Auth App (Nuxt) | Login/callback UI — a thin shell over Better Auth routes hosted on the API | Session storage (lives in D1) |
| Better Auth | Session issue/refresh, cookie signing, GitHub OAuth | Per-route authorization (middleware's job) |
| D1 | Persistent structured state (user, session, content, progress, favorites) | Binary blobs |
| R2 (`starye-media`) | Images + video bytes, served via custom domain with native range request support | Access control (enforced at presigning layer when needed) |
| KV (`CACHE`) | Gateway edge cache, short-TTL API response cache | Durable state (never use as source of truth — 60s consistency window) |
| Crawler | Scrape + upload to R2 + POST sync to API | Direct D1 access |

## Recommended Project Structure

Current structure already aligns with edge-first monorepo conventions and needs only targeted additions. Annotations (`← NEW`, `← HARDEN`) mark what this milestone adds or refines.

```
apps/
├── api/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── progress/           ← NEW  unified progress endpoints
│   │   │   │   ├── handlers/
│   │   │   │   ├── services/
│   │   │   │   └── index.ts
│   │   │   ├── stream/             ← NEW  video signed URL issuer
│   │   │   │   └── sign.handler.ts
│   │   │   └── admin/…             (existing — add cache-invalidate hook)
│   │   ├── middleware/
│   │   │   ├── auth.ts             ← HARDEN  unify with gateway-forwarded cookie
│   │   │   └── cache-invalidate.ts ← NEW    post-CUD hook → gateway KV purge
│   │   └── lib/
│   │       ├── auth.ts             (existing — cookie domain already apex)
│   │       └── r2-sign.ts          ← NEW    GET presign wrapper (range-aware)
│   └── wrangler.toml               ← EXTEND  [env.staging] block
├── gateway/
│   ├── src/
│   │   ├── index.ts                (existing router)
│   │   ├── cache-middleware.ts     ← REFINE  user-id based private cache key
│   │   └── invalidate.ts           ← NEW    authenticated purge endpoint
│   └── wrangler.toml               ← EXTEND  [env.staging] block
├── movie-app/src/
│   ├── composables/
│   │   └── usePlaybackProgress.ts  ← NEW    debounced sync
│   └── lib/stream-client.ts        ← NEW    fetch signed URL, pass to <video>
├── comic-app/src/
│   └── composables/
│       └── useReadingProgress.ts   ← NEW    page-turn debounced sync
packages/
└── db/src/schema.ts                ← EXTEND  progress + history tables
.github/workflows/
├── deploy-*-staging.yml            ← NEW    per-app staging deploy on PR
└── deploy-*.yml                    (existing — production)
```

### Structure Rationale

- **`routes/progress/` as its own route group:** progress is cross-product (movies + comics), keeping it out of `routes/movies/` avoids duplication. Follows existing `resource/handlers + services` split documented in `STRUCTURE.md:194`.
- **`routes/stream/sign.handler.ts`:** signed-URL minting is auth-sensitive and needs its own rate-limit posture; isolating it makes that explicit.
- **`middleware/cache-invalidate.ts`:** mutations already pass through `audit-logger.ts`; adding a parallel invalidation middleware keeps cache concerns near the write path, not inside handlers.
- **`gateway/src/invalidate.ts`:** exposes `POST /__cache/invalidate` with `CRAWLER_SECRET`-style shared secret so API can punch through cache after writes and crawler can after batch imports.
- **`[env.staging]` in wrangler.toml (not separate files):** Cloudflare's native pattern; bindings are explicitly per-environment, top-level inherits only non-binding keys ([Cloudflare Workers Environments docs](https://developers.cloudflare.com/workers/wrangler/environments/)).

## Architectural Patterns

### Pattern 1: Gateway-as-Sole-Entry with Apex-Domain Cookie (Unified Session)

**What:** All traffic enters through `starye.org` via the gateway Worker. Better Auth sets its cookie on `.starye.org` (apex, derived from `WEB_URL` in `apps/api/src/lib/auth.ts:52-54`) with `path: '/'` and `sameSite: 'lax'`. Every sub-path proxies to its backing Pages project, so cookies are in-domain throughout.

**Why this over alternatives:**

| Option | Verdict | Why |
|--------|---------|-----|
| **Gateway relays apex-domain cookie (current)** | RECOMMENDED | Zero per-app session code; Better Auth already configured; `SameSite=Lax` works for same-site navigation; single point of control |
| Per-app session cookies | Reject | Requires token exchange between apps; 5 apps × sync logic = high surface for single-user gain zero |
| SSO-like redirect (OAuth-style between apps) | Reject | Overkill for single tenant; adds round-trips; cookie-on-apex already achieves it |
| Third-party cookie with `SameSite=None` | Reject | Blocked by default in modern Chrome for third-party context; fragile; not needed once all apps sit under `starye.org` |

**Trade-offs:**
- **Pro:** Already 90% working in code. Cookie automatically flows because gateway proxies without stripping `Cookie` / `Set-Cookie`.
- **Pro:** Better Auth's Vue client calls `window.location.origin + '/api/auth'` — always hits gateway, never bypasses.
- **Con:** Direct access to `*.pages.dev` URLs bypasses auth. Must be closed off (Cloudflare Access rule or a redirect in each Pages app's `_redirects` file that bounces back to `starye.org`).
- **Con:** Local dev cookies scoped to `localhost` only — correctly handled by the `isLocalDev` branch in `auth.ts:50`, but worth keeping test coverage.

**Hardening actions (this milestone):**
1. Add `_redirects` to each Pages app that 301s `*.pages.dev/*` → `https://starye.org/<app>/*`, OR set a Cloudflare Access policy on the `pages.dev` hostnames.
2. Normalize `X-Forwarded-Host` / `X-Forwarded-Proto` at gateway (already done in `apps/gateway/src/index.ts:134-135`) — the API uses these to compute `baseURL` (`auth.ts:41-46`), keep contract stable.
3. Add an E2E test: login on `/auth/login` → navigate to `/movie` → `/api/movies/mine` returns 200 without re-login.

### Pattern 2: R2 Direct Delivery with Native Range Requests (Video Stability)

**What:** Video bytes live in R2 bucket `starye-media`, served via the custom domain `cdn.starye.org` (`R2_PUBLIC_URL`). The browser's `<video>` element issues HTTP `Range` requests; R2 + Cloudflare's CDN return `206 Partial Content` natively. No transcoding, no HLS, no Cloudflare Stream.

**Why this over alternatives:**

| Option | Verdict | Why |
|--------|---------|-----|
| **R2 public custom domain + direct MP4 + range (current)** | RECOMMENDED | Zero egress inside Cloudflare network; CDN caches aggressively; range requests "just work" for MP4; no transcoding pipeline |
| R2 + presigned URLs for every request | Situational | Adds 1h-expiring auth; use only for adult/gated content where public URL leak is unacceptable |
| Cloudflare Stream | Reject | Not free: $5/1000 min storage + $1/1000 min delivered. Violates "免费额度" constraint in `PROJECT.md`. |
| HLS/DASH segmentation | Reject for now | Requires transcoding infra (ffmpeg in GitHub Actions adds cost/complexity); range-request MP4 already gives seek + resume on modern browsers. Defer until a specific device/quality complaint appears. |

**Trade-offs:**
- **Pro:** R2 binding natively supports range via `env.BUCKET.get(key, { range: request.headers })` (see R2 Workers API). Public custom domain handles this transparently at CDN edge.
- **Pro:** No pre-processing pipeline to maintain.
- **Con:** Single MP4 quality — no adaptive bitrate. Acceptable for personal use; revisit if/when it hurts.
- **Con:** Public URL is guessable if key pattern is flat. Mitigate by using nanoid-based paths (already the crawler convention in `apps/api/src/routes/upload/index.ts`) and issuing presigned URLs for R18 content.

**When to reach for presigned GET URLs (Pattern 2a):**
- Use `@aws-sdk/s3-request-presigner` (already a dep; see `INTEGRATIONS.md:18`) for `GetObjectCommand` with `expiresIn: 3600`.
- Signed URLs preserve range-request behavior — the signature binds URL + query string, not byte ranges.
- Issue signed URL from `GET /api/stream/sign?key=...` after auth + R18 verification middleware; client assigns to `<video src>` directly.
- Do **not** proxy video through the Worker — 100MB response-body cap and 30s timeout make it unsuitable.

### Pattern 3: D1 for Progress, KV for Cache (Progress Tracking)

**What:** Reading/watching progress is a user-owned relational record. Store in D1 with a `progress` table keyed on `(user_id, content_type, content_id)`. Sync from client on a debounce (10s of playback, page-turn, or pagehide) — not every second.

**Why D1 over KV:**

| Concern | D1 Verdict | KV Verdict |
|---------|-----------|------------|
| Single-key write rate | 100,000 writes/day free tier, no per-row rate cap | **1 write/sec/key limit** — `429 Too Many Requests` on bursts ([confirmed via Context7 / CF KV docs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)) |
| Consistency | Strong (SQLite) | Eventual, up to 60s propagation — user could lose progress on refresh |
| Query needs | "Recent watched," "resume list," JOIN with movies | Key-scan only; poor fit for feeds |
| Existing setup | Drizzle schema already defines `user`; adding `progress` is trivial | Would need custom serialization layer |
| Free tier headroom (single user) | Very high (100K/day) | Tight (1K writes/day on free tier) |

**D1 recommended. KV is the wrong tool for this workload**, even on paper a single user can't trip the rate limits — but every write request hitting KV still costs the daily quota, and the 60-second read consistency means a user refreshing the reader app could see stale progress.

**Sync cadence (client):**
```
Video:  every 10s of wall-clock playback OR on `pause` / `pagehide` / route change
Comic:  on page-turn (debounced 500ms) + on `pagehide`
```

This yields ~6 writes/min per active user in worst case. D1 eats that trivially. A per-user upsert endpoint (`PUT /api/progress/:content_type/:content_id`) returns 204 fast; use `conflict ... do update` Drizzle pattern.

**Schema sketch (to add to `packages/db/src/schema.ts`):**
```typescript
export const progress = sqliteTable('progress', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  contentType: text('content_type', { enum: ['movie', 'comic'] }).notNull(),
  contentId: text('content_id').notNull(),
  position: integer('position').notNull(), // seconds for video, page index for comic
  duration: integer('duration'),           // total seconds / total pages
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.contentType, t.contentId] }),
  recentIdx: index('progress_user_updated_idx').on(t.userId, t.updatedAt),
}))
```

### Pattern 4: Wrangler Environments + Pages Branch Previews (Deploy Topology)

**What:** Two environments per Worker (production, staging) via `[env.staging]` blocks in `wrangler.toml`. Pages apps rely on Cloudflare's built-in per-branch preview URLs (free, automatic). No Docker, no separate staging account.

**Minimum viable setup:**

| Layer | Production | Preview/Staging | How |
|-------|-----------|-----------------|-----|
| API Worker | `api.starye.org` | `api-staging.starye.org` | `[env.staging]` in `apps/api/wrangler.toml` with staging D1 + KV + R2 bindings |
| Gateway Worker | `starye.org` | `staging.starye.org` | `[env.staging]` in `apps/gateway/wrangler.toml` pointing at staging origins |
| Pages apps | `starye-*.pages.dev` | `<branch>.starye-*.pages.dev` | Automatic — Pages deploys every branch; nothing to configure |
| Local dev | `localhost:8080` | same | `wrangler dev` + `.dev.vars` |

**Why this is enough:**
- Local `wrangler dev` already catches 90% of issues (Miniflare simulates D1/KV/R2).
- Pages branch previews catch frontend regressions per-PR at zero cost.
- Staging Workers only needed when testing destructive D1 migrations, auth flow changes, or cross-service contracts — all of which happen in this milestone.
- `CLOUDFLARE_ENV` variable ([changelog 2025-11-09](https://developers.cloudflare.com/changelog/post/2025-11-09-cloudflare-env-variable/)) simplifies CI: set per-job env and drop per-command `--env` flags.

**Config sketch:**
```toml
# apps/api/wrangler.toml (extend)
[env.staging]
name = "starye-api-staging"
vars = { WEB_URL = "https://staging.starye.org", ADMIN_URL = "https://staging.starye.org/dashboard" }

[[env.staging.d1_databases]]
binding = "DB"
database_name = "starye-db-staging"
database_id = "<NEW_STAGING_D1_ID>"

[[env.staging.kv_namespaces]]
binding = "CACHE"
id = "<NEW_STAGING_KV_ID>"

[[env.staging.r2_buckets]]
binding = "BUCKET"
bucket_name = "starye-media-staging"
```

**Trade-offs:**
- **Pro:** Zero new infrastructure. Everything scales within existing Cloudflare account.
- **Pro:** Staging D1 can be seeded from production via `wrangler d1 export` / `import`.
- **Con:** Duplicate R2 costs if many videos in staging — mitigate by using a `remote = true` binding in staging pointing at production read-only, or keeping staging bucket to test fixtures only.

### Pattern 5: User-Scoped Edge Cache with Post-Mutation Invalidation (Cache + Auth)

**What:** Keep existing `apps/gateway/src/cache-middleware.ts` two-scope model (public + private) and close the loop by (a) using user ID instead of cookie hash for private-scope keys, (b) wiring API mutations to call `invalidateCache(prefix)` automatically via middleware, (c) exposing a gateway-side purge endpoint for crawler batch imports.

**Why the current design is already right (and what to refine):**

The existing code already does the hard parts correctly:
- `NO_STORE_PREFIXES` prevents caching auth / admin / upload routes (`cache-middleware.ts:50`).
- `set-cookie` bypasses cache (`cache-middleware.ts:216`) — avoids leaking sessions.
- Private scope hashes the `Cookie` header into the cache key so different users hit different keys (`cache-middleware.ts:208-210`).
- `Vary: Cookie` is set on private responses (`cache-middleware.ts:358`).

**Refinements needed:**

1. **Use user ID, not cookie hash, for private keys.** A user who signs out and back in gets a new session cookie → new hash → duplicate cache entries. In the API middleware, resolve `userId` from the session and pass it to gateway via `X-User-Id` header (trusted because gateway is upstream of everything). Gateway then keys private entries by `userId` instead of `hashValue(cookie)`. Cleaner keys, higher hit rate, correct semantics.

2. **Automatic invalidation on mutation.** Add `apps/api/src/middleware/cache-invalidate.ts`:
   ```typescript
   // After successful 2xx response to POST/PUT/PATCH/DELETE on /admin/movies/*
   // → call gateway's purge endpoint with prefix "gateway-cache:v2:movies:"
   ```
   Gateway exposes `POST /__cache/invalidate` guarded by `CRAWLER_SECRET`-style shared secret; API calls it via fetch. Keeps invalidation close to the write path without coupling gateway and API deploys.

3. **Crawler batch purge.** After each daily crawl finishes in `packages/crawler`, POST to the gateway purge endpoint with `['movies', 'public-pages']` prefixes. This is more efficient than per-upsert purges during the batch.

**Why not use Cloudflare's native `Cache API`?** It's zone-scoped and already covers static assets via response `Cache-Control`. KV gives us explicit key control and the `list({prefix})` + `delete()` invalidation that the native Cache API can't do cleanly for prefix-based purges. Keep using both: native for static, KV for app-data JSON.

## Data Flow

### Request Flow (Authenticated Read)

```
Browser
  ├─ cookie: starye.session_token (domain=.starye.org)
  ▼
Gateway Worker (starye.org/api/movies/abc)
  ├─ resolveCachePolicy() → movies group, public scope
  ├─ KV get gateway-cache:v2:movies:public:<encoded-path>
  ├─ HIT → return cached JSON + X-Cache-Status: HIT
  └─ MISS →
       ▼
       API Worker (api.starye.org/movies/abc)
         ├─ requestId / logger / timing / secureHeaders middleware
         ├─ auth middleware → createAuth(env, req) → user on ctx
         ├─ handler → service → drizzle.select() → D1
         ▼
         JSON response (no set-cookie)
       ◀─
  ├─ KV put (ctx.waitUntil) with 300s TTL
  ▼
Browser
```

### Progress Write Flow (New)

```
Client: video.timeupdate fires every 250ms → debounce to 10s
  ▼
PUT /api/progress/movie/:id  body: { position, duration }
  ▼
Gateway (NO_STORE match → bypass cache, forward with cookie)
  ▼
API: auth middleware → user.id resolved
  ▼
progressService.upsert(db, user.id, 'movie', id, position)
  ▼
D1 INSERT ... ON CONFLICT DO UPDATE
  ▼
204 No Content
```

### Cache Invalidation Flow (New)

```
Admin: POST /api/admin/movies (create)
  ▼
API handler → D1 insert
  ▼
cacheInvalidate middleware (after 2xx)
  ▼
fetch(GATEWAY_URL + '/__cache/invalidate', {
  headers: { 'x-service-auth': CRAWLER_SECRET },
  body: { prefixes: ['movies'] }
})
  ▼
Gateway: invalidateCache(cache, 'gateway-cache:v2:movies:')
  ▼
KV list+delete loop → responds count
```

### Video Playback Flow (Refined)

```
Browser: /movie/:id view loads
  ▼
GET /api/stream/sign?key=videos/2026/abc.mp4
  ▼
API: auth + R18 gate → @aws-sdk/s3-request-presigner.getSignedUrl
  ▼
Response: { url: "https://cdn.starye.org/videos/2026/abc.mp4?X-Amz-Signature=..." }
  ▼
<video src={url}> → browser issues Range: bytes=0-
  ▼
Cloudflare CDN (cdn.starye.org) → 206 Partial Content
  │
  └─ Cache HIT on edge after first viewer (public bucket behavior)
```

## Scaling Considerations

| Scale | Adjustment |
|-------|-----------|
| Single user (current + foreseeable) | Current architecture is already right-sized. No changes. |
| If second user added (未来可能) | D1 already multi-user safe (user-scoped rows). Private cache keys (user-id-based, per Pattern 5 refinement) already isolate. |
| If video catalog > 10k items | Crawler batch purge needs paginated `cache.list({prefix})` loop (already implemented in `cache-middleware.ts:432-440`). R2 scales horizontally, no sharding needed. |
| If progress writes approach 1 write/sec on same key | Cannot happen in practice (same user can't watch two videos at once). KV would break here; D1 still fine. |

### Scaling Priorities

1. **First bottleneck (most likely):** D1 write concurrency on the single `session` table during active login burst. Non-issue for single user.
2. **Second bottleneck:** R2 egress if public URL gets scraped. Mitigate with WAF rule limiting requests/sec from non-Cloudflare IPs (the `cdn.starye.org` custom domain inherits zone WAF).
3. **Do not worry about:** API Worker cold starts (~10ms, already logged), gateway throughput (single user).

## Anti-Patterns

### Anti-Pattern 1: Proxying Video Through the API Worker

**What people do:** `GET /api/stream/:id` fetches from R2 via `env.BUCKET.get()` and streams back through the Worker.
**Why it's wrong:** Workers have a 30s wall time (`apps/api/src/index.ts:46`) and response size constraints; Range-request semantics are fragile when re-emitted from user code; bills Worker CPU + duration.
**Do this instead:** Issue a signed (or public) R2 URL and let the browser hit R2's edge directly. Pattern 2 / Pattern 2a.

### Anti-Pattern 2: Progress in KV "Because It's Faster"

**What people do:** `env.CACHE.put('progress:<user>:<id>', position)` on every `timeupdate`.
**Why it's wrong:** KV enforces 1 write/sec/key → `429` under bursts ([docs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)). Up to 60s global propagation means users see stale positions. No query support for "recent" lists. Tight daily quota on free tier.
**Do this instead:** D1 upsert with a client-side debounce (10s or event-triggered). Pattern 3.

### Anti-Pattern 3: Per-App Session Cookies

**What people do:** Each frontend mints its own cookie on `.pages.dev` or on its subdomain, then syncs via a custom token-relay endpoint.
**Why it's wrong:** Five apps × sync logic = five things to break. `SameSite=None` third-party cookies are being phased out. Better Auth on the apex already solves this; don't reinvent.
**Do this instead:** Gateway-as-sole-entry + apex-domain cookie. Pattern 1. Block direct `*.pages.dev` access.

### Anti-Pattern 4: Admin Mutations That Forget to Invalidate

**What people do:** `POST /api/admin/movies` writes to D1, but forgets to purge `gateway-cache:v2:movies:*`. Next public request serves stale JSON for up to 300s.
**Why it's wrong:** Invisible staleness; first-order bug in edge-cached architectures.
**Do this instead:** Hook invalidation into the middleware stack (`middleware/cache-invalidate.ts`), not handlers. Make it impossible to forget.

### Anti-Pattern 5: Environment Config Duplicated Across Files

**What people do:** `wrangler.toml`, `wrangler.staging.toml`, `wrangler.prod.toml` — separate files per env.
**Why it's wrong:** Drift over time; each file goes stale in subtle ways.
**Do this instead:** Single `wrangler.toml` with `[env.staging]` blocks. Official Cloudflare pattern ([Workers Environments](https://developers.cloudflare.com/workers/wrangler/environments/)).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Better Auth (GitHub OAuth) | Per-request factory (`apps/api/src/lib/auth.ts:34`) with dynamic baseURL from forwarded host | Cookie domain already derived from `WEB_URL` — correct for apex sharing |
| R2 (via S3 SDK) | Presigned GET for auth-gated content; public custom domain for open content | Range requests work with both; 1h signed URL TTL is standard |
| GitHub Actions (Puppeteer crawler) | POST to API with `CRAWLER_SECRET`; upload to R2 via multipart | New: add final step to POST gateway purge |
| Cloudflare KV | Read: synchronous; Write: via `ctx.waitUntil` to avoid blocking response | 60s global consistency — never use as source of truth |
| Cloudflare D1 | Via Drizzle, single-DB per env | No multi-statement transactions; batch via `db.batch()` |

### Internal Boundaries

| Boundary | Communication | Considerations |
|----------|---------------|----------------|
| Gateway ↔ API | HTTP proxy with forwarded headers | Gateway must pass `Cookie`, `X-Forwarded-Host`, `X-Forwarded-Proto` (all already done in `gateway/src/index.ts:134-135`) |
| Gateway ↔ KV | Direct binding | Graceful degrade if `CACHE` unbound — covered by `!cache` check in `cache-middleware.ts:389` |
| API ↔ Gateway (invalidation) | HTTP POST with shared secret | New boundary this milestone; reuse `CRAWLER_SECRET` pattern or add dedicated `CACHE_INVALIDATE_SECRET` |
| Frontend ↔ API | Hono RPC client (`packages/api-types`) | Type-safe; only reachable through gateway in prod |
| Crawler ↔ API | `POST /api/*/sync` with `x-service-auth: CRAWLER_SECRET` | Existing, working |
| Crawler ↔ Gateway | New: `POST /__cache/invalidate` with shared secret | Added this milestone for batch purge |

## Build Order

The five architectural questions have clear dependencies. This sequence minimizes rework:

### Phase A — Session Unification (foundation for everything else)
1. Add `_redirects` (or Access rules) on each Pages project to force traffic through `starye.org`.
2. Verify cookie flow with an E2E test: login → navigate across `/movie`, `/comic`, `/dashboard` without re-auth.
3. Add `requireAuth` guard to dashboard routes (already called out in `PROJECT.md` Active).

**Depends on:** existing Better Auth config (already correct).
**Unblocks:** everything else — progress tracking, gated video, admin cache invalidation all need reliable session.

### Phase B — Preview/Staging Environments (de-risk later phases)
1. Create staging D1 (`starye-db-staging`), KV namespace, R2 bucket.
2. Add `[env.staging]` blocks to `apps/api/wrangler.toml` and `apps/gateway/wrangler.toml`.
3. Add CI job `deploy-api-staging.yml` triggered on PR (not merge).
4. Pages branch previews: already automatic; document the URL convention.

**Depends on:** Phase A is nice-to-have but not strict.
**Unblocks:** safe validation of Phase C / D changes without risking production.

### Phase C — Video Playback Hardening (orthogonal to auth)
1. Confirm R2 custom domain (`cdn.starye.org`) returns `206` for range requests — quick curl test.
2. Add `GET /api/stream/sign?key=...` handler using `@aws-sdk/s3-request-presigner` (already a dep).
3. Gate signed URL issuance on auth + R18 verification for sensitive content.
4. Update movie-app `<video>` to fetch signed URL before setting `src`.
5. Leave public assets (covers, thumbnails) on unsigned `cdn.starye.org` URLs.

**Depends on:** Phase A (for R18 gating to mean something).
**Unblocks:** "播放稳定性" Active requirement.

### Phase D — Progress Tracking (requires auth from A)
1. Add `progress` table to `packages/db/src/schema.ts`; generate migration.
2. Implement `apps/api/src/routes/progress/` (GET list, PUT upsert, DELETE).
3. Add `usePlaybackProgress` composable in movie-app with 10s debounce + `pagehide` flush.
4. Add `useReadingProgress` composable in comic-app with page-turn trigger.
5. Expose "resume" list on movie/comic home pages.

**Depends on:** Phase A (user identity). Can parallelize with Phase C.
**Unblocks:** "comic-app 阅读进度 / movie-app 继续观看" Active requirements.

### Phase E — Cache Invalidation Refinement (depends on C+D surfacing mutations)
1. Refine private-scope key generation in `cache-middleware.ts` to use user-id from a trusted header.
2. Add `apps/gateway/src/invalidate.ts` — authenticated purge endpoint.
3. Add `apps/api/src/middleware/cache-invalidate.ts` — auto-purge after 2xx CUD.
4. Update crawler to POST purge after each batch.
5. Add cache observability: track HIT/MISS ratio from existing structured logs (already emitted).

**Depends on:** A (session for private keys), C/D (gives concrete mutations to purge).
**Unblocks:** guaranteed freshness for admin and crawler writes.

### Dependency Graph

```
         A (Session Unification)
        /  \
       /    \
      C      D      B (Preview envs — runs in parallel)
       \    /
        \  /
         E (Cache Invalidation Refinement)
```

## Sources

- [Cloudflare Workers Environments (wrangler.toml env.* syntax)](https://developers.cloudflare.com/workers/wrangler/environments/) — HIGH (Context7)
- [Cloudflare KV write-key-value-pairs (1 write/sec/key, 429 semantics)](https://developers.cloudflare.com/kv/api/write-key-value-pairs/) — HIGH (Context7)
- [Cloudflare KV Limits](https://developers.cloudflare.com/kv/platform/limits/) — HIGH (referenced, network fetch blocked from this sandbox; backed by Context7 snippets and changelog)
- [KV 30-second minimum cacheTtl (2026-01-30)](https://developers.cloudflare.com/changelog/post/2026-01-30-kv-reduced-minimum-cachettl/) — HIGH
- [CLOUDFLARE_ENV env variable for wrangler (2025-11-09)](https://developers.cloudflare.com/changelog/post/2025-11-09-cloudflare-env-variable/) — HIGH
- [Cloudflare R2 presigned URL examples (AWS SDK v3)](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) — HIGH (Context7)
- [Cloudflare R2 S3 presigned URLs (signature format)](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — HIGH (Context7)
- [Cloudflare R2 Workers API (range request support via `range: request.headers`)](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) — HIGH (Context7)
- [Cloudflare KV redesign / 60s consistency context](https://www.blog.cloudflare.com/rearchitecting-workers-kv-for-redundancy/) — MEDIUM
- [SameSite cookie interaction with Cloudflare](https://developers.cloudflare.com/waf/troubleshooting/samesite-cookie-interaction/) — HIGH
- Codebase evidence: `apps/api/src/lib/auth.ts` (cookie apex config), `apps/gateway/src/cache-middleware.ts` (two-scope cache), `apps/api/wrangler.toml` (existing bindings)

---
*Architecture research for: Cloudflare edge monorepo (starye)*
*Researched: 2026-05-10*
