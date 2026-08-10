# Architecture Research

**Domain:** Starye v1.5 crawler operations and content availability
**Researched:** 2026-08-10
**Confidence:** HIGH for existing boundaries, MEDIUM for the new availability projection shape

## Standard Architecture

### System Overview

    Dashboard
        |
        v
    Gateway http://localhost:8080
        |
        +--> Hono admin API
        |       |
        |       +--> Task command and permission boundary
        |       +--> Availability query and remediation boundary
        |       +--> Evidence and audit projection
        |                       |
        |                       v
        |                   D1 / Drizzle
        |        task -> run -> attempt -> observation -> projection
        |
        +--> Public content APIs and Reader / Viewer

    Local runner or GitHub Actions runner
        |
        +--> claims the same D1 run and lease
        +--> discovers or probes source data
        +--> posts signed bounded events and a terminal receipt
        +--> API validates tuple and commits facts with CAS

### Component Responsibilities

| Component | Responsibility | Existing or New |
|-----------|----------------|-----------------|
| Crawler task control plane | Closed operation templates, immutable snapshot, task/run/attempt identity, lease, transition, retry, cancel, provider association | Existing, extend |
| Availability operation registry | Maps check or repair operation to permission, target shape, policy version, runner entrypoint, and receipt schema | New capability inside crawler-tasks |
| Runner adapters | Executes provider-specific crawl, direct source probe, magnet resolution, chapter snapshot, or page probe with bounded budgets | Existing task-runner and crawler packages, extend |
| Validation and receipt boundary | Validates signed event sequence, target tuple, result shape, source/content revision, and redaction limits | Existing, extend |
| Observation store | Append-only per-check facts keyed by task/run/attempt and stable content identity | New migrations |
| Current availability projection | Latest status, freshness, counts, reason code, repairability, and current revision for Dashboard queries | New migrations or carefully extended source state tables |
| Remediation service | Creates an idempotent targeted task from a failing projection and rejects stale ownership | Existing repair_players pattern, generalize |
| Dashboard operations view | Lists tasks, details, history, result anomalies, next action, and evidence | Existing Crawlers view, extend |
| Content admin/editor | Human CRUD remains the authoritative manual content mutation path | Existing; do not bypass |

## Recommended Project Structure

    apps/api/src/domain/crawler-tasks/
        repository.ts             task/run/lease/CAS and history
        state-machine.ts          execution lifecycle
        template-registry.ts      closed operation snapshots
        receipt-validation.ts     terminal result validation
        availability-registry.ts  check operation metadata

    apps/api/src/domain/availability/
        types.ts                  status and reason contracts
        projections.ts            current state read/write
        observations.ts           append-only result persistence
        movie-checks.ts           metadata/source/magnet result logic
        comic-checks.ts            chapter set comparison
        page-checks.ts             page/image comparison
        remediation.ts            idempotent check and repair commands

    apps/api/src/routes/admin/
        crawler-tasks/             task and run operations
        availability/              result queries and check commands
        chapters/                  existing chapter CRUD and image probe boundary

    packages/crawler/src/task-runner/
        template-adapters.ts       common runner adapter boundary
        availability-adapter.ts    bounded check execution
        repair-adapter.ts          existing repair pattern

    packages/crawler/src/availability/
        source-probes.ts            direct and image transport probes
        magnet-probes.ts            controlled Aria2/TorrServer observations
        chapter-snapshot.ts         source chapter identity and order
        bounded-results.ts          caps and redaction

    apps/dashboard/src/
        views/Crawlers.vue          task operations and history
        views/Availability.vue      result filters and remediation
        components/Availability*   status and anomaly detail
        lib/api.ts                  typed Gateway-relative client

    packages/db/drizzle/
        <next migration>.sql        current projections and observation tables

### Structure Rationale

- Keep execution lifecycle in crawler-tasks. Availability checks are another operation with the same task/run/attempt/lease contract, not a separate queue.
- Keep content comparison and projection in an API domain so the Dashboard does not infer health from raw rows.
- Keep source-specific fetch and browser behavior in packages/crawler, where Node, Puppeteer, got, cookies, and anti-detection already exist.
- Keep current projections small and queryable. Store detailed rows as bounded observations or artifact references, rather than growing task JSON indefinitely.
- Keep manual content CRUD and automated repair separate. A check may propose or create a controlled task; it should not silently edit content during a read-only diagnostic.

## Architectural Patterns

### Pattern 1: Immutable Operation Snapshot plus Versioned Attempt

**What:** A task stores the operation, target, policy, and source/content revision in an immutable request snapshot. Every execution is a run/attempt with its own provider identity, transition sequence, and receipt.

**When to use:** All operator-triggered and scheduled checks, retries, and repairs.

**Trade-offs:** More identifiers and joins, but stale callbacks and old checks can be rejected instead of overwriting current content facts.

### Pattern 2: Current Projection plus Append-Only Observation

**What:** A successful or failed check writes a current bounded status for fast Dashboard reads and an immutable observation for history. The projection is derived from the committed observation and is not trusted from crawler counters alone.

**When to use:** Movie source health, magnet metadata, chapter set comparison, and page/image probe results.

**Trade-offs:** Requires migrations and reconciliation logic, but makes freshness, history, audit, and repair decisions explicit.

### Pattern 3: Three-State Health, Not a Boolean

**What:** Separate execution status from content status. Execution can be queued, running, succeeded, failed, or cancelled. Content can be healthy, degraded, unavailable, unknown, or stale; repairability and reason code are separate fields.

**When to use:** Any check where an inconclusive probe, blocked origin, missing source snapshot, or old observation is possible.

**Trade-offs:** More UI states, but it prevents metadata success, HTTP 200, or an old green result from being rendered as current availability.

### Pattern 4: Compare Source Identity, Not Only Counts

**What:** A chapter check records source ordinal, normalized slug or URL identity, explicit chapter number when known, and stored identity. A page check records page number plus normalized URL identity. Diagnostics are set differences, duplicates, and order differences.

**When to use:** Manga chapter completeness and chapter page integrity.

**Trade-offs:** Source snapshots consume bounded D1 rows or artifacts, but they are the only reliable basis for missing and duplicate diagnostics.

### Pattern 5: Check then Repair

**What:** A read-only check produces a stable finding and a bounded remediation intent. The repair action creates a new task tied to the finding's revision and rejects it if the current projection has changed.

**When to use:** Source re-crawl, magnet re-resolution, chapter recrawl, and page refresh.

**Trade-offs:** The operator performs one extra step, but accidental destructive fixes and stale overwrites are avoided.

## Data Flow

### Request Flow

    Operator action
        -> Dashboard typed API client
        -> Gateway /api/admin/*
        -> requireAuth / resource permission
        -> create or read task/run
        -> D1 transaction and lease
        -> local or GitHub Actions runner
        -> signed events and bounded terminal receipt
        -> tuple, revision, and state validation
        -> observations and current projection
        -> Gateway readback
        -> Dashboard status and next action

### Check Data Flow

    Movie check:
      movie metadata -> source rows -> direct probe or controlled magnet probe
      -> per-source observation -> source availability projection

    Comic check:
      source page -> source chapter snapshot -> stored chapter set
      -> missing/duplicate/order/terminal findings -> comic projection

    Page check:
      chapter pages -> URL/page-number validation -> bounded HEAD/Range/browser probe
      -> per-page observation -> chapter image projection

### State Management

The API is the owner of current availability state. The Dashboard reads projections and never promotes a raw URL, count, or crawler log to healthy. Runner progress remains append-only operational evidence; a terminal receipt is accepted only when it is bound to the task, run, attempt, target, policy, and current revision.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| One operator, tens of tasks | D1 projections, bounded batches, cursor pagination, and polling are sufficient. |
| Hundreds of checks per day | Add per-origin rate budgets, result retention cleanup, and a scheduled sweep index. Keep the same task/run model. |
| Many concurrent users or large collections | Revisit D1 write contention and provider scheduling; only then consider Queues or Durable Objects. |

### Scaling Priorities

1. The first bottleneck is external origin rate limits and probe fan-out, not Dashboard rendering. Enforce per-run and per-origin concurrency and cache recent observations.
2. The second bottleneck is D1 result volume. Cap per-item details, retain summary plus sampled failures, and expire raw artifacts.
3. Provider queue delay is evidence that reconciliation is pending, not a reason to increase timeouts without a bounded deadline.

## Anti-Patterns

### Anti-Pattern 1: Task Mutation after Dispatch

**What people do:** Edit the target or policy fields on a task while an old runner is active.

**Why it is wrong:** The runner and callback no longer agree on the snapshot; late results can be attributed to the wrong target.

**Do this instead:** Archive or supersede the definition and create a new immutable task version. Allow only safe labels or operator notes to change in place.

### Anti-Pattern 2: Delete and Rebuild as a Read Check

**What people do:** Reuse manga sync code to delete current chapters before comparing the newly observed source list.

**Why it is wrong:** Missing and duplicate information disappears, and a failed insert can leave a partial collection.

**Do this instead:** Save a source snapshot, compare first, and mutate only in a bounded repair transaction with a baseline guard.

### Anti-Pattern 3: One Global Healthy Flag

**What people do:** Set movie or comic crawlStatus to complete and use it as content availability.

**Why it is wrong:** Crawl execution, metadata persistence, source transport, image readability, and reader playback are different facts.

**Do this instead:** Keep explicit projections and show the strongest verified state available.

### Anti-Pattern 4: Raw Evidence as a Debug Dump

**What people do:** Store full signed URLs, cookies, provider HTML, or all page rows in D1 or a long-lived artifact.

**Why it is wrong:** It increases secret exposure, D1 cost, and accidental replay risk.

**Do this instead:** Store stable redacted identities, status/reason codes, counts, hashes, and short-lived artifact references.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Actions | Existing GitHub App client, immutable workflow snapshot, dispatch/cancel/run lookup, scheduled reconciliation | Dispatch and cancel are accepted commands. Matching signed application receipts decide content success. |
| Manga origin | Existing Puppeteer session or got fast path | Source-specific cookies, challenge pages, and rate limits mean a generic Worker fetch is not a complete crawler contract. |
| Direct media origin | Node bounded HEAD/Range plus browser playback observation | CORS, Range, content type, and challenge responses can differ between runner and Viewer. |
| Aria2/TorrServer | Controlled client or existing browser action | Magnet metadata and stream readiness need a protocol-aware path; never send magnet to a generic HTTP image/video probe. |
| Cloudflare D1/R2/KV | D1 facts, R2 allowed assets only, KV/API cache invalidation | Chapter body images remain external under the v1.1 storage policy. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Dashboard <-> API | Gateway-relative JSON routes | Add typed contracts and preserve resource-specific authorization. |
| API <-> D1 | Drizzle plus prepared D1 statements and CAS | Projection update and observation insert must share the same revision/tuple boundary. |
| API <-> runner | Signed callback events | Sequence, nonce, attempt, and target checks reject replay or late events. |
| Availability <-> content editor | Readback and explicit remediation command | Automated checks do not silently replace manual content edits. |
| API <-> Gateway cache | Targeted invalidation after projection or content mutation | A fresh result must not be hidden by movie/comic detail cache. |

## Suggested Build Order

1. Generalize the operation registry, task CRUD/archive semantics, check result contract, and observation/projection primitives.
2. Deliver video metadata, direct source, and magnet checks using source revision and controlled probe adapters.
3. Deliver comic source chapter snapshot comparison and targeted chapter recrawl.
4. Deliver page/image checks, Dashboard result and remediation views, and the canonical Gateway evidence chain.

This order keeps all checks on one lifecycle and puts the most reusable identity and freshness contracts before source-specific work.

## Sources

### Primary repository evidence

- packages/db/src/schema.ts
- apps/api/src/domain/crawler-tasks/repository.ts
- apps/api/src/domain/crawler-tasks/state-machine.ts
- apps/api/src/domain/crawler-tasks/template-registry.ts
- apps/api/src/routes/admin/crawler-tasks/index.ts
- apps/api/src/domain/movies/source-contract.ts
- apps/api/src/domain/movies/source-reconciliation.ts
- apps/api/src/routes/admin/sync/handlers.ts
- apps/api/src/routes/admin/chapters/handlers.ts
- packages/crawler/src/crawlers/comic-crawler.ts
- packages/crawler/src/strategies/site-92hm.ts
- apps/dashboard/src/views/Crawlers.vue

### Official documentation

- https://docs.github.com/en/rest/actions/workflow-runs
- https://docs.github.com/en/rest/actions/workflows
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests
- https://www.sqlite.org/lang_select.html
- https://developers.cloudflare.com/d1/platform/limits/

---
*Architecture research for: Starye v1.5 crawler operations and content availability*
*Researched: 2026-08-10*
