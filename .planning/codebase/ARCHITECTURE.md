<!-- refreshed: 2026-05-10 -->
# Architecture

**Analysis Date:** 2026-05-10

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Gateway (Cloudflare Worker)                          │
│                         `apps/gateway/src/index.ts`                          │
│  Routes: /api → API | /dashboard → Dashboard | /movie → Movie | /blog → Blog│
│         /comic → Comic | /auth → Auth | /tavern → Tavern                    │
└────────┬────────────────────────────────────────────────────────────────────┘
         │
         ├──────────────────────────────────────────────────────────────────┐
         │                                                                  │
         ▼                                                                  ▼
┌─────────────────────────┐                                    ┌──────────────────────┐
│   API (Hono + D1)       │                                    │  Frontend Apps       │
│  `apps/api/src/`        │                                    │  (Vue 3 / Nuxt 4)    │
│                         │                                    │                      │
│  ┌──────────────────┐   │                                    │  • Dashboard (Vue)   │
│  │ Middleware Stack │   │                                    │  • Movie App (Vue)   │
│  │ - Auth           │   │                                    │  • Comic App (Vue)   │
│  │ - Database       │   │                                    │  • Blog (Nuxt)       │
│  │ - CORS           │   │                                    │  • Auth (Nuxt)       │
│  │ - Cache          │   │                                    └──────────────────────┘
│  │ - Error Handler  │   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ Routes           │   │
│  │ - /movies        │   │
│  │ - /actors        │   │
│  │ - /comics        │   │
│  │ - /admin/*       │   │
│  │ - /auth/*        │   │
│  │ - /public/*      │   │
│  └──────────────────┘   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ D1 Database  │  │ R2 Storage   │  │ KV Cache     │      │
│  │ (SQLite)     │  │ (Media)      │  │ (Gateway)    │      │
│  │ @starye/db   │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
         ▲
         │
┌────────┴────────────────────────────────────────────────────┐
│              Crawler (Node.js + Puppeteer)                   │
│              `packages/crawler/src/`                         │
│  Scheduled via GitHub Actions (UTC 00:00, 08:00, 16:00)     │
└──────────────────────────────────────────────────────────────┘
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

**Overall:** Microservices + Monorepo + Edge-First

**Key Characteristics:**
- Cloudflare Workers for serverless compute (API + Gateway)
- Turborepo for build orchestration across apps/packages
- Shared packages for code reuse (db, ui, api-types, config)
- Gateway-based routing for unified domain (starye.org)
- Better Auth for session management with cookie-based auth
- Drizzle ORM with D1 (SQLite) for data persistence

## Layers

**Gateway Layer:**
- Purpose: Unified entry point, traffic routing, caching
- Location: `apps/gateway/src/`
- Contains: Proxy logic, cache middleware, path rewriting
- Depends on: KV namespace for cache storage
- Used by: All frontend apps and API consumers

**API Layer:**
- Purpose: Business logic, data access, authentication
- Location: `apps/api/src/`
- Contains: Hono routes, middleware, handlers, services
- Depends on: D1 database, R2 storage, Better Auth
- Used by: Frontend apps via RPC (Hono client)

**Frontend Layer:**
- Purpose: User interfaces for different audiences
- Location: `apps/{dashboard,movie-app,comic-app,blog,auth}/`
- Contains: Vue/Nuxt components, views, stores, composables
- Depends on: API layer, shared UI package
- Used by: End users via browser

**Data Layer:**
- Purpose: Persistence, schema management
- Location: `packages/db/src/`
- Contains: Drizzle schema, migrations, DB client factory
- Depends on: D1 binding from Cloudflare
- Used by: API layer

**Shared Layer:**
- Purpose: Reusable code across apps
- Location: `packages/{ui,api-types,config,locales}/`
- Contains: Components, types, configs, i18n
- Depends on: Framework-specific dependencies
- Used by: All apps

**Crawler Layer:**
- Purpose: External data ingestion
- Location: `packages/crawler/src/`
- Contains: Puppeteer crawlers, strategies, image processing
- Depends on: API layer (for data sync), R2 (for media upload)
- Used by: GitHub Actions scheduled workflows

## Data Flow

### Primary Request Path

1. **User Request** → Gateway Worker (`apps/gateway/src/index.ts:23`)
2. **Gateway Routing** → Proxy to target service based on path prefix (`apps/gateway/src/index.ts:40-106`)
3. **API Middleware Stack** → Auth, DB, CORS, Cache (`apps/api/src/index.ts:40-50`)
4. **Route Handler** → Business logic in handlers (`apps/api/src/routes/movies/handlers/movies.handler.ts:7`)
5. **Service Layer** → Data access via Drizzle (`apps/api/src/routes/movies/services/movie.service.ts`)
6. **Response** → JSON with type-safe schema (`apps/api/src/schemas/movie.ts`)

### Authentication Flow

1. **Login Request** → `/auth/login` page (`apps/auth/app/pages/login.vue`)
2. **GitHub OAuth** → Better Auth handles OAuth flow (`apps/api/src/lib/auth.ts:58`)
3. **Session Creation** → Cookie set with domain-wide scope (`apps/api/src/lib/auth.ts:98-106`)
4. **Session Validation** → Middleware checks cookie on each request (`apps/api/src/middleware/auth.ts:6`)
5. **User Context** → Attached to Hono context (`apps/api/src/types.ts:8`)

### Crawler Sync Flow

1. **GitHub Action Trigger** → Scheduled cron (`.github/workflows/daily-movie-crawl.yml`)
2. **Puppeteer Scrape** → Extract data from target sites (`packages/crawler/src/crawlers/javbus.ts`)
3. **Image Processing** → Sharp resize, R2 upload (`packages/crawler/src/lib/image-processor.ts`)
4. **API Sync** → POST to `/api/movies/sync` with service auth (`packages/crawler/src/utils/api-client.ts`)
5. **Database Update** → Upsert movies, actors, publishers (`apps/api/src/routes/movies/handlers/sync.handler.ts`)

**State Management:**
- Frontend: Pinia stores for client state (`apps/movie-app/src/stores/user.ts`)
- Backend: Stateless (session in D1, cache in KV)

## Key Abstractions

**Hono Context (AppEnv):**
- Purpose: Type-safe request context with bindings
- Examples: `apps/api/src/types.ts:12`
- Pattern: Middleware extends context with db, auth, user

**Database Client:**
- Purpose: Drizzle ORM instance with schema
- Examples: `packages/db/src/index.ts:11`
- Pattern: Factory function creates client from D1 binding

**Better Auth Instance:**
- Purpose: Authentication provider with session management
- Examples: `apps/api/src/lib/auth.ts:34`
- Pattern: Created per-request with dynamic baseURL

**Route Handlers:**
- Purpose: HTTP endpoint logic separated from routing
- Examples: `apps/api/src/routes/movies/handlers/movies.handler.ts`
- Pattern: Handler functions receive Hono context, return JSON

**Service Layer:**
- Purpose: Reusable business logic and data access
- Examples: `apps/api/src/routes/movies/services/movie.service.ts`
- Pattern: Pure functions accepting db and parameters

**Middleware Stack:**
- Purpose: Cross-cutting concerns (auth, logging, errors)
- Examples: `apps/api/src/middleware/auth.ts`, `apps/api/src/middleware/error-handler.ts`
- Pattern: Hono middleware with `createMiddleware<AppEnv>()`

**RPC Client:**
- Purpose: Type-safe API calls from frontend
- Examples: `apps/movie-app/src/lib/api-client.ts:29`
- Pattern: Hono client with inferred types from API routes

## Entry Points

**Gateway Worker:**
- Location: `apps/gateway/src/index.ts`
- Triggers: HTTP requests to starye.org
- Responsibilities: Route to appropriate service, cache responses

**API Worker:**
- Location: `apps/api/src/index.ts`
- Triggers: HTTP requests to /api/*
- Responsibilities: Handle business logic, auth, data access

**Dashboard App:**
- Location: `apps/dashboard/src/main.ts`
- Triggers: Browser navigation to /dashboard/*
- Responsibilities: Admin UI for content management

**Movie App:**
- Location: `apps/movie-app/src/main.ts`
- Triggers: Browser navigation to /movie/*
- Responsibilities: Public movie browsing and playback

**Comic App:**
- Location: `apps/comic-app/src/main.ts`
- Triggers: Browser navigation to /comic/*
- Responsibilities: Public comic reading

**Blog App:**
- Location: `apps/blog/nuxt.config.ts`
- Triggers: Browser navigation to /blog/*
- Responsibilities: Personal blog content

**Auth App:**
- Location: `apps/auth/nuxt.config.ts`
- Triggers: Browser navigation to /auth/*
- Responsibilities: Login/logout UI

**Crawler:**
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

**What happens:** Route files directly import and query database tables
**Why it's wrong:** Violates separation of concerns, makes testing harder, duplicates logic
**Do this instead:** Use service layer functions in `apps/api/src/routes/*/services/*.service.ts`

### Bypassing Gateway in Development

**What happens:** Accessing apps directly via localhost:3000, localhost:5173, etc.
**Why it's wrong:** Cookies won't be shared across ports, auth breaks, CORS issues
**Do this instead:** Always use Gateway at `http://localhost:8080` (see `AGENTS.md:52-59`)

### Hardcoded Environment URLs

**What happens:** Frontend apps hardcode API URLs instead of using env vars
**Why it's wrong:** Breaks in different environments, requires code changes for deployment
**Do this instead:** Use `VITE_API_URL` or `NUXT_PUBLIC_API_URL` environment variables

### Missing Service Auth

**What happens:** Crawler endpoints accessible without authentication
**Why it's wrong:** Anyone can trigger expensive operations or inject malicious data
**Do this instead:** Use `serviceAuth()` middleware (`apps/api/src/middleware/service-auth.ts`)

## Error Handling

**Strategy:** Centralized error handler with typed error codes

**Patterns:**
- Valibot validation errors → 400 with field-level details
- Better Auth errors → 401 Unauthorized
- Drizzle constraint violations → 409 Conflict or 400 Bad Request
- HTTPException → Status code from exception
- Unknown errors → 500 Internal Server Error

**Implementation:** `apps/api/src/middleware/error-handler.ts:18`

## Cross-Cutting Concerns

**Logging:** Hono logger middleware with request ID (`apps/api/src/index.ts:41`)
**Validation:** Valibot schemas in `apps/api/src/schemas/`
**Authentication:** Better Auth with GitHub OAuth (`apps/api/src/lib/auth.ts`)
**Authorization:** Role-based guards in `apps/api/src/middleware/guard.ts`
**Caching:** KV-based cache in Gateway (`apps/gateway/src/cache-middleware.ts`)
**Audit Logging:** Automatic CUD operation tracking (`apps/api/src/middleware/audit-logger.ts`)
**Performance:** Timing middleware, ETag support (`apps/api/src/index.ts:42,50`)
**Security:** Secure headers, CORS, timeout protection (`apps/api/src/index.ts:43,46`)

---

*Architecture analysis: 2026-05-10*
