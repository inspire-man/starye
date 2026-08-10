# Stack Research

**Domain:** Starye v1.5 crawler operations and content availability
**Researched:** 2026-08-10
**Confidence:** HIGH for repository facts, MEDIUM for external source behavior

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Hono + Valibot | Hono 4.12.14, Valibot 1.3.1 | Admin and internal API contracts | Already owns the Gateway-facing API and validates crawler envelopes. Extending the existing schemas keeps task, check, receipt, and permission boundaries in one place. |
| Cloudflare D1 + Drizzle | Drizzle 0.45.2 | Current projections, observations, task history, and audit queries | The repository already uses D1 as the crawler control-plane fact store, with prepared statements, batch writes, CAS updates, and migrations. |
| Node 24 + Puppeteer | Node 24, Puppeteer 24.41.0 | Source discovery, browser-only providers, and bounded content probes | Existing GitHub Actions crawler runtime already owns browser sessions, cookies, anti-detection, and provider-specific parsing. |
| Vue 3 + Vite | Vue 3.5.32, Vite 8.0.8 | Dashboard task operations and availability result views | The existing Crawlers view already polls task detail, renders run history, and starts cancel/retry/repair actions. |
| Playwright Test | 1.59.1 | Gateway-level acceptance and browser evidence | Existing tests use the canonical Gateway path and already distinguish page load from media evidence. The same boundary should cover check results and remediation. |

### Supporting Libraries and Runtime APIs

| Library or API | Version | Purpose | When to Use |
|---------------|---------|---------|-------------|
| Native fetch, URL, AbortController | Node 24 / Workers runtime | HEAD plus bounded Range or GET probes | Use for direct media and chapter image observations with a hard timeout, redirect policy, response size limit, and a per-run concurrency budget. |
| got | 15.0.2 | Existing crawler fast-path page fetch | Reuse for source pages that already use the Site92Hm fast path. Do not introduce a second HTTP client for the same provider. |
| Puppeteer Core | 24.41.0 | Cookie-bound AJAX and browser-only checks | Use when a source requires the existing browser session, Referer, challenge handling, or an actual media/image browser observation. |
| p-map and p-queue | p-map 7.0.4, p-queue 9.1.2 | Bounded crawler and probe concurrency | Reuse existing concurrency controls. A single-user system still needs bounds because one task can touch many chapters or pages. |
| SQLite aggregates, CTEs, and window functions | D1 SQLite | Duplicate, gap, ordering, and count diagnostics | Compute chapter/page diagnostics in SQL where possible, then return bounded rows for remediation. |
| Existing GitHub Actions client | Native fetch, GitHub REST API | Dispatch, cancel, run lookup, and provider reconciliation | Keep the closed snapshot-bound client. A provider response is an observation, not a successful content check until a matching signed receipt is accepted. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm 10.33.0 + Turborepo | Workspace execution | Preserve current scripts and lockfile. No new queue or orchestration package is needed. |
| Vitest 4.1.4 | Domain, route, migration, and adapter tests | Add fixtures for each availability disposition and each integrity anomaly. |
| GitNexus | Impact and change-scope checks | Any implementation change to a shared function, route, or schema symbol requires impact analysis first and detect-changes before commit. |
| Gateway at http://localhost:8080 | Canonical local acceptance boundary | Dashboard, API, and browser checks must be exercised through Gateway paths, not app dev ports. |

## Recommended Availability Probe Model

1. A direct video or external chapter image starts with a bounded HEAD request where supported.
2. If HEAD is rejected, use a bounded GET with Range bytes=0-0. Record status, content type when available, redirect outcome, elapsed time, and a bounded failure code.
3. A successful HTTP response is only transport evidence. A direct video requires browser media evidence for playback readiness; a chapter image requires an image-compatible response or an explicit browser load observation when transport is ambiguous.
4. A magnet URI is not an HTTP resource. Do not send it to HEAD or treat a non-empty magnet string as available. Resolve it through the existing controlled Aria2 or TorrServer path and record metadata or stream observations with a bounded timeout.
5. Store current health as a projection and retain append-only bounded observations keyed by content identity, check operation, source revision, task, run, and attempt.

## Data Model Guidance

The existing crawler_task, crawler_run, crawler_run_transition, crawler_runner_event, crawler_run_log, and audit_log tables remain the execution and operator-history base.

For v1.5, add availability operations through the same task/run contract rather than inventing a second queue. Each operation snapshot must include the target identity, check policy version, source revision or content revision where applicable, and the intended remediation. The snapshot is immutable after a run starts.

Availability needs two layers:

- Current projection: one bounded status per movie/source, comic/chapter collection, or chapter/page set for Dashboard filtering and action gating.
- Observation history: append-only bounded facts for each check result or repair result, including task/run/attempt identity, reason code, observed time, and redacted source identity.

Per-item anomaly details should be queryable in D1 or stored as a bounded artifact reference. A single unbounded JSON result on crawler_task is insufficient for history, filtering, and targeted repair.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Existing D1 task/run control plane | Cloudflare Queues or Durable Objects | Consider only if concurrent users or very high check volume becomes a real bottleneck. Current single-user scope does not justify a second scheduler. |
| Native fetch plus existing Puppeteer | Octokit | Use Octokit only if the GitHub surface expands beyond the existing dispatch, cancel, and run lookup boundary. |
| Existing p-map/p-queue budgets | BullMQ, Temporal, or a new worker framework | Use a dedicated workflow engine only for a materially larger multi-tenant workload. |
| Source observation plus actual browser proof | URL-only health flag | URL-only is acceptable as a preliminary candidate state, never as playback-ready or image-readable proof. |
| External image URLs with bounded probes | R2 ingestion or Worker image proxy | R2 is for allowed assets; chapter body images remain external per the v1.1 cost policy. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| HTTP probing of magnet: URLs | Magnet URIs have no HTTP response and a probe can only create a false result | Controlled Aria2/TorrServer metadata and stream checks |
| A second task queue | Splits lease, retry, audit, and provider identity across two facts | Extend crawler_task and crawler_run operations |
| Blind chapter delete-and-reinsert during a check | Destroys the source snapshot needed to identify missing, duplicate, or reordered chapters | Persist source observations, compare identities, and only mutate through an explicit repair operation |
| Cloudflare Worker media or image proxy | Converts external reading traffic into Cloudflare request and bandwidth cost and changes source semantics | Store external URL, diagnose with bounded probes, and let the Reader surface failure |
| New dependency for generic SQL or HTTP behavior | Increases lockfile and runtime surface without solving a current boundary | Existing D1/Drizzle, fetch, got, Puppeteer, and test fixtures |

## Stack Patterns by Variant

**If a source is direct HTTP media:**
- Use transport probe for triage and browser canplay/playing plus currentTime movement for final playback proof.
- Keep source type, health, and playback proof separate.

**If a source is magnet:**
- Use the configured controlled transfer adapter.
- Report metadata unavailable, stream unavailable, and playback not yet observed as distinct states.

**If a chapter image host rejects HEAD or requires browser headers:**
- Fall back to a bounded Range GET or browser load observation using the source-specific session.
- Keep the result as unknown or probe_failed when the observation is inconclusive; do not upgrade it to healthy.

**If an external source URL contains credentials or signed query material:**
- Persist only a stable source identity, host/path class, hash, or redacted URL.
- Keep raw source material inside the short-lived runner boundary only.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Drizzle ORM 0.45.2 | Cloudflare D1 SQLite | Continue using prepared statements and bounded batches; migration tests must cover the deployed schema shape. |
| Hono 4.12.14 | hono-openapi 1.3.0 and Valibot 1.3.1 | New admin routes and result envelopes should use the existing validation and OpenAPI patterns. |
| Puppeteer Core 24.41.0 | Node 24 and GitHub Actions Chrome | Reuse current browser lifecycle and target-profile environment instead of running Puppeteer in the Worker. |
| Vue 3.5.32 | vue-router 5.0.4 and Playwright 1.59.1 | Dashboard polling and action feedback fit the current view/test setup. |
| GitHub REST API | Existing GitHub App installation client | Cancel accepts the provider request; dispatch acceptance and run success still require provider reconciliation and an application receipt. |

## Sources

### Primary repository evidence

- packages/db/src/schema.ts - movie/player, comic/chapter/page, crawler task/run/transition/event/log, source observation, and audit tables.
- apps/api/src/domain/crawler-tasks/repository.ts - D1 task lifecycle, immutable snapshots, leases, retries, CAS transitions, provider reconciliation, and bounded logs.
- apps/api/src/routes/admin/crawler-tasks/index.ts - current create/list/detail/log/cancel/retry/repair API surface.
- apps/api/src/routes/admin/chapters/handlers.ts - existing chapter status and bounded HEAD/Range integrity probe.
- apps/api/src/routes/admin/sync/handlers.ts - chapter replacement guards, sourcePageCount update, and movie source reconciliation.
- packages/crawler/src/crawlers/comic-crawler.ts and packages/crawler/src/strategies/site-92hm.ts - source chapter/page extraction and incremental crawl behavior.
- apps/dashboard/src/views/Crawlers.vue and apps/dashboard/src/lib/api.ts - current operator controls, polling, run history, and relative /api client.

### Official documentation

- https://docs.github.com/en/rest/actions/workflow-runs - workflow run status, cancellation, rerun and run identity semantics.
- https://docs.github.com/en/rest/actions/workflows - workflow dispatch semantics.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD - HEAD response semantics.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests - bounded range request semantics.
- https://www.sqlite.org/lang_select.html - SQL aggregation and selection behavior used for integrity diagnostics.
- https://developers.cloudflare.com/d1/platform/limits/ - D1 statement, row, and request budgeting constraints.

---
*Stack research for: Starye v1.5 crawler operations and content availability*
*Researched: 2026-08-10*
