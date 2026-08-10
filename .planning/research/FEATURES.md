# Feature Research

**Domain:** Single-user crawler operations and content availability console
**Researched:** 2026-08-10
**Confidence:** HIGH for table stakes and repository gaps, MEDIUM for generic product comparisons

## Feature Landscape

### Table Stakes: Crawler Task Operations

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Task create, list, detail, update, archive/delete | An operator needs to control the unit of work, not only start a fixed template | HIGH | Current API creates template tasks and exposes list/detail, but has no task-level edit or delete/archive contract. Runs and snapshots must remain auditable. |
| Run history with attempt, provider, transition, and log facts | A failed crawl is a historical event, not just a red badge | MEDIUM | Existing D1 tables and detail endpoint already provide most of this. The Dashboard currently loads the detail for every visible task. |
| Cancel and retry with explicit outcome | Long crawls and provider failures need operator control | MEDIUM | Existing run-level cancel and retry are the baseline. v1.5 should preserve immutable attempt identity and explain whether a retry is application, provider, or remediation work. |
| Filters, pagination, active-run lock, and idempotent actions | Repeated clicks and many historical tasks must not create duplicate runs | MEDIUM | Existing cursor pagination and template lease are reusable. |
| Audit trail for task mutation and remediation | A content repair must explain who requested it and what changed | MEDIUM | audit_log exists for content admin actions; crawler task transitions and safe logs should be linked to the same task/run tuple. |

### Table Stakes: Video Data Availability

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Separate metadata, direct source, and magnet results | Metadata can be correct while every playable source is dead | HIGH | Current source projection distinguishes source disposition but treats any active non-empty source as eligible. |
| Direct source transport check | A URL that returns an error or challenge should not be offered as healthy | MEDIUM | Use bounded HEAD/Range observation. HTTP success remains preliminary until the existing browser playback proof is present. |
| Magnet availability check | A syntactically valid magnet may have no metadata, no peers, or a broken controlled stream | HIGH | Magnet needs Aria2/TorrServer adapter facts, not an HTTP request. |
| Failure reason, observed time, stale state, and retry action | An operator needs a next action instead of a boolean | MEDIUM | Use bounded reason codes and a check policy version. |
| Repair or recheck command with receipt | A green task run is not a source repair proof | HIGH | Reuse task/run/attempt, source revision, CAS, and bounded readback already established by repair_players. |

### Table Stakes: Manga Chapter Completeness

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Source chapter snapshot versus stored chapter set | Stored rows alone cannot identify what the source listed but the crawler missed | HIGH | Current manga sync deletes and rebuilds chapter rows; a check needs an independent source observation. |
| Missing and duplicate chapter diagnostics | A count can match while the set is wrong | MEDIUM | Compare normalized source identity, source number, and URL/slug where available. Keep duplicate rows visible rather than silently discarding them. |
| Sequence and ordering diagnostics | Reader navigation depends on stable order | MEDIUM | Preserve source ordinal and explicit chapter number. Do not assume every series is a contiguous 1..N sequence. |
| Crawl terminal state separate from completeness | A runner can exit after partial work or catch errors | MEDIUM | Report execution status and content status separately: complete crawl, partial crawl, source unavailable, and check inconclusive are different facts. |
| Recheck or targeted recrawl | Each anomaly should lead to a bounded action | HIGH | A check should identify target comic/chapter and policy, then create an idempotent task rather than mutate rows inline. |

### Table Stakes: Chapter Image Availability

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Expected versus stored page count | Empty or truncated chapters are common crawler failures | LOW | Existing sourcePageCount and page count are the starting facts. |
| Missing, invalid URL, duplicate page number, and order diagnostics | Count equality does not prove a readable ordered page set | MEDIUM | Validate URL scheme, page number sequence, uniqueness, and normalized URL identity. |
| Bounded HTTP or browser image probe | A URL can return HTML, a challenge, or a redirect instead of an image | HIGH | Existing integrity code has a useful HEAD/Range baseline but only returns a single-chapter read-only response. |
| Per-page failure reason and bounded sample | Operators need to know which page to retry | MEDIUM | Persist hashes, host/path class, status, and reason. Avoid storing signed query material in evidence. |
| Targeted chapter recrawl with overwrite guard | Repair must preserve a known-good page set when the incoming set is empty or smaller | MEDIUM | Existing syncChapterData protects against zero and regression; keep that guard in the repair path. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| One operations surface for task, check, result, repair, and evidence | The operator can follow one chain from failure to verified content | HIGH | This is the milestone's main differentiator and should be demonstrated through the canonical Gateway. |
| Freshness-aware availability dashboard | Unknown or stale results are not misrepresented as healthy | MEDIUM | Show last observed time, policy version, and next action. |
| Explainable anomaly diff | Missing, duplicate, reordered, and failed page rows can be acted on directly | HIGH | Use bounded result rows and stable target identities instead of an opaque summary blob. |
| Idempotent remediation with concurrency ownership | Repeated repairs do not overwrite newer source observations | HIGH | Reuse operation identity, source/content revision, D1 CAS, and active task locks. |
| Evidence linked to the exact task/run/attempt | A check result can be audited without replaying the crawler | MEDIUM | Use safe tuples, hashes, counts, reason codes, and artifact references. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Arbitrary command, URL, cookie, or schedule editing in Dashboard | It appears flexible | It bypasses target-profile, secret, and provider boundaries | Keep closed templates and versioned policy inputs |
| Automatic deletion of every detected duplicate or missing row | It appears to make data self-healing | Source snapshots and manual edits can be destroyed by a stale check | Generate a reviewable repair command with explicit ownership and receipt |
| Treating all active URLs as available | It simplifies the UI | It turns syntactic validity into false playback or image success | Use candidate, transport, browser, and content states separately |
| Live probing of every page on every Dashboard refresh | It appears current | It causes origin load, slow UI, rate limits, and non-repeatable results | Run bounded checks as tasks and read cached projections |
| Persisting raw URLs, cookies, or signed provider query strings in evidence | It helps debugging | It leaks credentials and makes long-lived audit rows unsafe | Store a redacted identity, hash, host class, status, and short-lived artifact reference |
| Real-time WebSocket orchestration | It appears responsive | It adds another lifecycle and does not solve provider truth | Use bounded polling of the canonical task detail endpoint |

## Feature Dependencies

    Task snapshot and operation contract
        +--> run state, lease, attempt, audit, and evidence identity
        +--> availability check adapters
                    +--> current availability projections
                    +--> bounded observation history
                    +--> targeted remediation
                                  +--> canonical Gateway readback

    Manga source chapter snapshot
        +--> missing/duplicate/order comparison
                    +--> targeted chapter recrawl
                                  +--> page integrity check

    Chapter page identity and expected count
        +--> bounded URL/image probe
                    +--> page repair or recrawl

### Dependency Notes

- Task operations must be extended before checks become user-triggered tasks; otherwise check results cannot share lease, retry, or audit facts.
- Current source and chapter projections must be defined before Dashboard status labels are added; UI-derived health would recreate the current false-ready problem.
- Source observations must preserve the external chapter list before the existing delete-and-reinsert sync can be evaluated for missing or duplicate entries.
- Image checks depend on stable chapter/page identities and on a bounded probe policy. They should not run as unbounded requests inside a list endpoint.
- Evidence and Gateway acceptance depend on a terminal task receipt plus current projection readback. A provider green status alone is insufficient.

## MVP Definition

### Launch With: v1.5

- [ ] Task CRUD with archive semantics, immutable run snapshots, run history, cancel, retry, and audit facts.
- [ ] Video metadata/source/magnet check operations with distinct status, reason, freshness, and bounded remediation.
- [ ] Manga chapter set checks for missing, duplicate, ordering, and crawl terminal anomalies.
- [ ] Chapter page checks for count, URL, page-number/order, and bounded external image failures.
- [ ] Dashboard result views and actions through http://localhost:8080 with task/run/attempt evidence.

### Add After Validation: v1.x

- [ ] Scheduled availability sweeps selected by content collection and freshness policy.
- [ ] Aggregated trend view for failure rates by source host or crawler provider.
- [ ] Batch remediation with a preview and a capped target list.
- [ ] Reader-side inline chapter warning tied to the latest availability projection.

### Future Consideration: v2+

- [ ] Multi-user quotas, ownership, approval, and notification workflows.
- [ ] Provider abstraction beyond the current GitHub Actions runner.
- [ ] Cross-source chapter reconciliation with semantic title matching when explicit chapter numbers are missing.
- [ ] Dedicated event streaming or queue infrastructure for large concurrent workloads.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Task CRUD and run history closure | HIGH | HIGH | P1 |
| Video source and magnet checks | HIGH | HIGH | P1 |
| Manga chapter completeness | HIGH | HIGH | P1 |
| Chapter image availability | HIGH | HIGH | P1 |
| Evidence and canonical Gateway chain | HIGH | MEDIUM | P1 |
| Freshness dashboard and remediation preview | HIGH | MEDIUM | P2 |
| Scheduled sweeps and trends | MEDIUM | MEDIUM | P2 |
| Multi-user workflow | LOW for this product | HIGH | P3 |

## Competitor and Ecosystem Pattern Analysis

This is a private single-user console, so a competitor clone is not the right target. Mature job consoles consistently provide immutable execution history, explicit terminal states, retry/cancel actions, bounded logs, and a distinction between job success and downstream resource health. Mature data-quality tools similarly keep a current check result plus historical observations and expose the failing row or field rather than only a total count.

The Starye-specific advantage is combining those patterns with source-aware remediation: one task tuple can lead to an API readback, a content projection, and a Gateway browser proof. The product should avoid copying multi-tenant scheduling, notification, or workflow-builder features that do not serve the single-user core value.

## Sources

### Primary repository evidence

- .planning/PROJECT.md - v1.5 goal and active scope.
- apps/api/src/routes/admin/crawler-tasks/index.ts - current task API surface.
- apps/api/src/domain/crawler-tasks/repository.ts and state-machine.ts - run lifecycle and retry/cancel facts.
- packages/db/src/schema.ts - current content, source, task, run, observation, and audit models.
- apps/api/src/routes/admin/sync/handlers.ts - current chapter and player reconciliation behavior.
- apps/api/src/routes/admin/chapters/handlers.ts - existing chapter status and integrity probe.
- apps/dashboard/src/views/Crawlers.vue - current operator workflow and missing task CRUD controls.
- packages/crawler/src/crawlers/comic-crawler.ts - incremental chapter crawl and terminal behavior.

### Official standards and APIs

- https://docs.github.com/en/rest/actions/workflow-runs - status, cancellation, rerun, and provider run identity.
- https://docs.github.com/en/rest/actions/workflows - dispatch contract.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD - transport probe semantics.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests - partial content probing.
- https://www.sqlite.org/lang_select.html - query patterns for duplicates, gaps, and ordering.

---
*Feature research for: Starye v1.5 crawler operations and content availability*
*Researched: 2026-08-10*
