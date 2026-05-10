# Codebase Concerns

**Analysis Date:** 2026-05-10

## Tech Debt

**R2 Upload Implementation Missing:**
- Issue: R2 upload endpoints return 501 Not Implemented stubs
- Files: `apps/api/src/routes/admin/movies/index.ts:523`, `apps/api/src/routes/admin/publishers/index.ts:525`, `apps/api/src/routes/admin/actors/index.ts:640`
- Impact: Cover image uploads for movies, publishers, and actors cannot be completed through admin interface
- Fix approach: Implement R2 upload logic using existing `apps/api/src/lib/r2.ts` utilities and `apps/api/src/routes/upload/index.ts` as reference

**Deprecated Authentication Middleware:**
- Issue: `serviceAuth` middleware marked as deprecated but still widely used
- Files: `apps/api/src/middleware/service-auth.ts:15`
- Impact: Inconsistent permission checking across admin routes; recommended migration to `requireAuth + requireResource` not completed
- Fix approach: Migrate all routes using `serviceAuth` to the newer `requireResource` pattern from `apps/api/src/middleware/resource-guard.ts`

**Incomplete Feedback System:**
- Issue: Feedback submission saves to logs but database persistence is commented out; admin role verification missing
- Files: `apps/api/src/routes/feedback/feedback.handler.ts:71`, `apps/api/src/routes/feedback/feedback.handler.ts:34-46`
- Impact: User feedback is not persisted; no admin interface to review feedback
- Fix approach: Create `feedback` table in schema, implement database insert, add admin verification

**Failed Task Recovery Not Implemented:**
- Issue: Crawler recovery mode loads failed tasks but conversion logic is stubbed
- Files: `packages/crawler/src/crawlers/actor-crawler.ts:202`, `packages/crawler/src/crawlers/publisher-crawler.ts:200`
- Impact: Failed crawl tasks cannot be automatically retried
- Fix approach: Implement conversion from `FailedTask` to `PendingActor`/`PendingPublisher` format

**Mapping URL Validation Missing:**
- Issue: Invalid mapping count tracked but URL validity not periodically verified
- Files: `apps/api/src/routes/admin/crawlers/index.ts:696`
- Impact: Broken mapping URLs may accumulate without detection
- Fix approach: Add scheduled job to validate mapping URLs and update metrics

**File Size Parsing Not Implemented:**
- Issue: Auto-rating calculation cannot extract file size from magnet links
- Files: `apps/movie-app/src/composables/useRating.ts:81`
- Impact: Rating algorithm missing file size factor, reducing accuracy
- Fix approach: Parse magnet link metadata or fetch torrent info to extract file size

**SQL Injection Risk in Query Builder:**
- Issue: `sql.raw()` used with user input in LIKE queries without proper escaping
- Files: `apps/api/src/services/query-builder.ts:33`
- Impact: Potential SQL injection if user input contains SQL metacharacters
- Fix approach: Use parameterized queries or Drizzle's `like()` helper instead of `sql.raw()`

**N+1 Query Pattern in Actor/Publisher Merging:**
- Issue: Related movies fetched using LIKE on denormalized text fields instead of JOIN
- Files: `apps/api/src/routes/admin/actors/index.ts:684`, `apps/api/src/routes/admin/publishers/index.ts:445`, `apps/api/src/routes/admin/publishers/index.ts:569`
- Impact: Slow performance when merging actors/publishers with many related movies
- Fix approach: Use proper JOIN through `movieActors` and `moviePublishers` relation tables

**Large Vue Components:**
- Issue: Several Vue components exceed 1000 lines, indicating high complexity
- Files: `apps/dashboard/src/views/Movies.vue:1443`, `apps/movie-app/src/views/MovieDetail.vue:1162`, `apps/dashboard/src/views/Comics.vue:1066`, `apps/dashboard/src/views/Actors.vue:919`, `apps/movie-app/src/views/Profile.vue:889`
- Impact: Difficult to maintain, test, and reason about; high cognitive load
- Fix approach: Extract reusable components, split into composition functions, separate concerns

**Large TypeScript Files:**
- Issue: Several route handlers exceed 1000 lines
- Files: `apps/api/src/routes/admin/actors/index.ts:1213`, `apps/api/src/routes/admin/movies/index.ts:1158`, `apps/api/src/routes/admin/publishers/index.ts:862`, `apps/api/src/routes/admin/crawlers/index.ts:773`
- Impact: Difficult to navigate and maintain; violates single responsibility principle
- Fix approach: Extract service layer, split into multiple route files by feature

**Excessive Console Logging:**
- Issue: 100+ console.log/warn/error statements throughout codebase, many with eslint-disable
- Files: Widespread across `apps/api/src/`, `packages/crawler/src/`, `apps/movie-app/src/`
- Impact: Noisy logs in production; performance overhead; inconsistent logging format
- Fix approach: Implement structured logging library (e.g., pino, winston), remove console.* calls

**Test Coverage Gaps:**
- Issue: Only 87 test files for 286 source files (~30% coverage)
- Files: Test files in `apps/*/e2e/`, `packages/*/test/`
- Impact: High risk of regressions; difficult to refactor with confidence
- Fix approach: Add unit tests for services, composables, and utilities; increase E2E coverage

**Skipped E2E Tests:**
- Issue: Multiple E2E tests conditionally skipped with `test.skip()`
- Files: `apps/movie-app/e2e/series-page.spec.ts:96,113,131,196,238`, `apps/movie-app/e2e/rating-system.spec.ts:319,390,431`, `apps/movie-app/e2e/player-report.spec.ts:117,140,176,220,253`
- Impact: Incomplete test coverage; features may break without detection
- Fix approach: Fix underlying issues causing test failures, remove skip statements

## Known Bugs

**Hardcoded Base URL in Comic Strategy:**
- Issue: Base URL replacement uses strict string replace instead of dynamic parsing
- Files: `packages/crawler/src/strategies/site-92hm.ts:245`
- Impact: Comic chapter URLs may break if site structure changes
- Trigger: Site migration or URL format change
- Workaround: Manual URL correction in database

**Debug Mode Persists Across Sessions:**
- Issue: Debug mode stored in localStorage without expiration or UI toggle
- Files: `apps/movie-app/src/views/MovieDetail.vue:54`
- Impact: Users may accidentally enable debug mode and forget to disable it
- Trigger: Execute `localStorage.setItem('debugMode', 'true')` in console
- Workaround: Clear localStorage or execute `localStorage.setItem('debugMode', 'false')`

**Unsafe JSON Parsing:**
- Issue: JSON.parse used without try-catch in MovieDetail component
- Files: `apps/movie-app/src/views/MovieDetail.vue:99`
- Impact: App crashes if stored data is corrupted
- Trigger: Corrupted localStorage data
- Workaround: Clear browser storage

## Security Considerations

**SQL Injection via sql.raw():**
- Risk: User input interpolated into SQL queries without sanitization
- Files: `apps/api/src/services/query-builder.ts:33`
- Current mitigation: None
- Recommendations: Replace with parameterized queries; add input validation; use Drizzle's type-safe query builders

**XSS Risk in Blog Content:**
- Risk: Blog content rendered with v-html without sanitization
- Files: `apps/blog/app/pages/[slug].vue:229`
- Current mitigation: Content format controlled by backend; Shiki syntax highlighting applied
- Recommendations: Add DOMPurify or similar sanitization library; implement Content Security Policy

**Sensitive Data in Audit Logs:**
- Risk: Audit logs may capture sensitive fields before sanitization
- Files: `apps/api/src/middleware/audit-logger.ts:38`
- Current mitigation: SENSITIVE_FIELDS list filters password, tokens
- Recommendations: Expand sensitive field list; add encryption for audit log storage; implement log retention policy

**Service Token in Headers:**
- Risk: CRAWLER_SECRET passed in plaintext headers
- Files: `apps/api/src/middleware/service-auth.ts:19`, `packages/crawler/src/utils/api-client.ts:18`
- Current mitigation: HTTPS transport encryption
- Recommendations: Implement token rotation; add IP allowlist for crawler endpoints; consider mutual TLS

**localStorage for Sensitive Config:**
- Risk: Aria2 and TorrServer credentials stored in browser localStorage
- Files: `apps/movie-app/src/composables/useAria2.ts:60`, `apps/movie-app/src/composables/useTorrServer.ts:55`
- Current mitigation: None
- Recommendations: Store credentials server-side; use encrypted session storage; implement credential vault

**R2 Credentials in Environment:**
- Risk: R2 access keys stored in environment variables
- Files: `apps/api/src/lib/r2.ts:10-11`, `apps/api/src/lib/auth.ts:27-28`
- Current mitigation: Environment variable isolation
- Recommendations: Use Cloudflare Workers Secrets; implement key rotation; add audit logging for R2 access

## Performance Bottlenecks

**LIKE Queries on Denormalized Fields:**
- Problem: Actor and publisher searches use LIKE on comma-separated text fields
- Files: `apps/api/src/routes/admin/movies/index.ts:136,140`, `apps/api/src/routes/public/movies/index.ts:83,92`
- Cause: Denormalized `movies.actors` and `movies.publisher` fields instead of proper JOINs
- Improvement path: Use relation tables (`movieActors`, `moviePublishers`) with indexed foreign keys; add full-text search index

**Crawler Rate Limiting:**
- Problem: Fixed delays between requests regardless of server response time
- Files: `packages/crawler/src/lib/queue-manager.ts:45-48`, `packages/crawler/src/strategies/javbus.ts:57`
- Cause: Static delay configuration without adaptive throttling
- Improvement path: Implement adaptive rate limiting based on response times and error rates; add exponential backoff

**Large File Transfers:**
- Problem: No streaming or chunking for large image uploads
- Files: `apps/api/src/routes/upload/index.ts:93`
- Cause: Entire file loaded into memory before R2 upload
- Improvement path: Implement streaming uploads; add multipart upload for files >5MB; implement client-side compression

**Gateway Cache Invalidation:**
- Problem: Cache invalidation requires listing all keys with prefix (expensive operation)
- Files: `apps/gateway/src/cache-middleware.ts:436`
- Cause: KV namespace lacks efficient prefix deletion
- Improvement path: Maintain cache key registry; implement cache versioning; use cache tags for grouped invalidation

**Unoptimized Image Loading:**
- Problem: Full-size images loaded without responsive variants
- Files: `packages/db/src/schema.ts:89` (variants field exists but unused)
- Cause: Image variant generation not implemented
- Improvement path: Generate thumbnails on upload; use Cloudflare Image Resizing; implement lazy loading with blur placeholders

## Fragile Areas

**Anti-Detection System:**
- Files: `packages/crawler/src/lib/anti-detection.ts`
- Why fragile: Complex retry logic with multiple backoff strategies; relies on heuristics to detect rate limiting
- Safe modification: Test thoroughly with real crawl targets; add comprehensive logging; implement dry-run mode
- Test coverage: Limited unit tests; relies on integration testing

**Queue Manager:**
- Files: `packages/crawler/src/lib/queue-manager.ts`
- Why fragile: Four-stage pipeline with interdependent queues; complex delay and retry logic
- Safe modification: Modify one queue at a time; preserve delay calculations; test with small batches first
- Test coverage: No unit tests found

**Better Auth Integration:**
- Files: `apps/api/src/lib/auth.ts`, `apps/api/src/middleware/service-auth.ts`
- Why fragile: Complex cookie domain logic; multiple authentication methods; cross-origin considerations
- Safe modification: Test in all environments (local, staging, production); verify cookie behavior; check CORS settings
- Test coverage: No dedicated auth tests

**Gateway Cache Middleware:**
- Files: `apps/gateway/src/cache-middleware.ts`
- Why fragile: Complex cache key generation; scope-based isolation; background task management
- Safe modification: Test cache hit/miss scenarios; verify invalidation logic; check memory usage
- Test coverage: No unit tests; relies on integration testing

**Aria2 WebSocket Connection:**
- Files: `apps/movie-app/src/composables/useAria2WebSocket.ts`
- Why fragile: Manual reconnection logic; notification state management; event handling
- Safe modification: Test connection loss scenarios; verify notification delivery; check memory leaks
- Test coverage: No unit tests; manual testing required

## Scaling Limits

**D1 Database Write Throughput:**
- Current capacity: ~1000 writes/second per database
- Limit: Cloudflare D1 has per-database write limits
- Scaling path: Implement write batching; add read replicas; consider sharding by resource type

**KV Cache Storage:**
- Current capacity: Unlimited keys, 25MB per value
- Limit: Gateway cache entries may exceed 25MB for large list responses
- Scaling path: Implement pagination for cached lists; compress cache entries; use Durable Objects for large datasets

**R2 Bandwidth:**
- Current capacity: Unlimited egress within Cloudflare network
- Limit: High traffic may incur costs; no built-in CDN caching
- Scaling path: Enable Cloudflare CDN caching; implement image optimization; add lazy loading

**Crawler Concurrency:**
- Current capacity: 1-3 concurrent requests per queue
- Limit: Low throughput for large-scale crawling
- Scaling path: Distribute crawling across multiple workers; implement distributed queue; add proxy rotation

**localStorage Size:**
- Current capacity: 5-10MB per origin
- Limit: Download list and error cache may exceed quota
- Scaling path: Implement IndexedDB for large datasets; add automatic cleanup; compress stored data

## Dependencies at Risk

**better-sqlite3:**
- Risk: Ignored in build dependencies but required for local development
- Impact: Local development may fail if not manually installed
- Migration plan: Document manual installation requirement; consider alternative local database

**puppeteer:**
- Risk: Large dependency (~300MB); requires Chrome binary
- Impact: Slow crawler startup; high memory usage; deployment complexity
- Migration plan: Evaluate puppeteer-core with external Chrome; consider playwright; implement headless mode optimization

**@aws-sdk/client-s3:**
- Risk: Large bundle size for R2 operations
- Impact: Increased cold start time for API workers
- Migration plan: Use Cloudflare R2 native bindings; implement lazy loading; tree-shake unused SDK features

**wrangler:**
- Risk: Frequent breaking changes in Cloudflare tooling
- Impact: CI/CD pipeline may break on updates
- Migration plan: Pin wrangler version; test updates in staging; maintain migration guide

## Missing Critical Features

**Rate Limiting:**
- Problem: No rate limiting on public API endpoints
- Blocks: Abuse prevention, DDoS protection
- Priority: High

**Error Monitoring:**
- Problem: No centralized error tracking (Sentry, Rollbar, etc.)
- Blocks: Production debugging, error trend analysis
- Priority: High

**Backup Strategy:**
- Problem: No automated database backups
- Blocks: Disaster recovery, data loss prevention
- Priority: High

**API Versioning:**
- Problem: No API version strategy
- Blocks: Breaking changes, backward compatibility
- Priority: Medium

**Health Check Endpoints:**
- Problem: No standardized health checks for services
- Blocks: Load balancer integration, monitoring
- Priority: Medium

**Metrics and Observability:**
- Problem: Limited structured logging; no metrics collection
- Blocks: Performance monitoring, capacity planning
- Priority: Medium

## Test Coverage Gaps

**API Route Handlers:**
- What's not tested: Most admin routes lack unit tests
- Files: `apps/api/src/routes/admin/*`
- Risk: Breaking changes in CRUD operations go undetected
- Priority: High

**Crawler Strategies:**
- What's not tested: Site-specific parsing logic
- Files: `packages/crawler/src/strategies/*`
- Risk: Site changes break crawling without detection
- Priority: High

**Vue Composables:**
- What's not tested: Business logic in composables
- Files: `apps/movie-app/src/composables/*`, `apps/dashboard/src/composables/*`
- Risk: State management bugs, memory leaks
- Priority: Medium

**Database Migrations:**
- What's not tested: Migration rollback scenarios
- Files: `packages/db/drizzle/*`
- Risk: Failed migrations in production
- Priority: Medium

**Error Handlers:**
- What's not tested: Edge cases in error formatting
- Files: `apps/api/src/middleware/error-handler.ts`
- Risk: Unhandled error types crash workers
- Priority: Low

---

*Concerns audit: 2026-05-10*
