# Pitfalls Research

**Domain:** Starye v1.5 crawler operations and content availability
**Researched:** 2026-08-10
**Confidence:** HIGH for repository-specific risks, MEDIUM for origin and provider behavior

## Critical Pitfalls

### Pitfall 1: Task CRUD Breaks Immutable Run Identity

**What goes wrong:**
A task target or policy is edited while a run is queued or active, or a task is hard-deleted while its provider can still send callbacks. The result is an orphaned callback, a wrong target attribution, or missing audit history.

**Why it happens:**
Task CRUD sounds like ordinary database CRUD, while the existing task row is also the parent of immutable run and attempt facts.

**How to avoid:**
Separate editable operator metadata from the immutable request snapshot. Allow archive or supersede semantics for a task with history, and gate hard deletion on terminal state plus dependent evidence policy. Every callback continues to bind task, run, attempt, operation, target, and revision.

**Warning signs:**
The API accepts a target update without creating a new snapshot, a deleted task still has a provider association, or a late callback returns a generic success instead of stale/ignored.

**Phase to address:**
Phase 25 task operations and availability contract.

---

### Pitfall 2: Execution Success Is Confused with Content Availability

**What goes wrong:**
A green crawler run, persisted movie row, crawlStatus complete, or non-empty player list is rendered as playable or readable content.

**Why it happens:**
The existing receipt and legacy counters were designed around ingestion. Source transport, magnet metadata, image readability, and browser playback are later facts.

**How to avoid:**
Separate run status, metadata persistence, source health, content integrity, and browser proof. Use explicit healthy, degraded, unavailable, unknown, and stale content statuses with bounded reason codes.

**Warning signs:**
players=0 is hidden by a successful receipt, an active magnet is shown beside a ready direct source, or a chapter with zero pages has complete crawlStatus.

**Phase to address:**
Phase 25 contract; Phase 26 video checks; Phase 27 and 28 content checks.

---

### Pitfall 3: Magnet Links Are Probed as HTTP URLs

**What goes wrong:**
A HEAD request or URL parser marks a magnet as alive even though it has no metadata, no peer availability, or no usable controlled stream.

**Why it happens:**
The current player model stores sourceUrl for direct and magnet rows and the common eligibility gate only checks active plus non-empty.

**How to avoid:**
Classify magnet first. Use the existing Aria2/TorrServer boundary to request bounded metadata or stream observations. Keep metadata available, transfer available, and browser playback verified as separate results.

**Warning signs:**
The checker reports an HTTP status for magnet, the result is healthy without a controlled resolver call, or a magnet is passed to the direct video player.

**Phase to address:**
Phase 26 video source and magnet availability.

---

### Pitfall 4: Chapter Sync Destroys the Comparison Baseline

**What goes wrong:**
The check reuses syncMangaData, deletes stored chapters, silently skips duplicate source slugs, then recreates rows. Missing and duplicate source entries disappear from the evidence, and a failed insert can leave a partial set.

**Why it happens:**
The current crawler optimizes for incremental ingestion and the existing chapter list has no durable source snapshot or observation identity.

**How to avoid:**
Persist a bounded source chapter snapshot before comparison. Keep source ordinal, normalized identity, explicit number, and source URL class. Generate set/order diagnostics first; apply a separate repair transaction with a baseline and rollback guard.

**Warning signs:**
The result contains only final stored chapter count, duplicate rows are absent, or a recrawl changes the diagnosis without a new source observation.

**Phase to address:**
Phase 27 comic chapter completeness.

---

### Pitfall 5: Count Equality Hides Duplicate or Reordered Chapters

**What goes wrong:**
Expected chapters and stored chapters have the same count, but one chapter is duplicated, another is missing, or sortOrder differs from source order.

**Why it happens:**
Count is cheap and the current getExistingChapters query uses count equal to sourcePageCount for page completeness, not source chapter identity.

**How to avoid:**
Compare normalized keys, explicit chapter number when known, source ordinal, and stored sortOrder. Treat special chapters and missing numbers as an explicit unknown-order case rather than fabricating a contiguous sequence.

**Warning signs:**
The only assertion is storedCount == expectedCount, or a new source order changes reader order without a recorded anomaly.

**Phase to address:**
Phase 27 comic chapter completeness.

---

### Pitfall 6: Image HTTP 200 Is Mistaken for a Readable Image

**What goes wrong:**
The origin returns an HTML challenge, a redirect, a placeholder, or a forbidden body with status below the probe threshold. A HEAD success also says nothing about browser image decoding.

**Why it happens:**
External image hosts differ in HEAD support, content type, referer requirements, anti-hotlink behavior, and redirect policy.

**How to avoid:**
Retain the existing HEAD then bounded Range fallback, but record redirect and response metadata and add content-type or bounded body sniffing where policy allows. Use browser image load only as a targeted follow-up. Treat ambiguous responses as unknown or failed, not healthy.

**Warning signs:**
All pages are green after HEAD, response content type is absent or text/html, or Reader failures are not linked to the last check.

**Phase to address:**
Phase 28 chapter image checks and Gateway evidence.

---

### Pitfall 7: Availability Probes Become an SSRF or Secret-Leak Surface

**What goes wrong:**
An operator or crawler causes the API to fetch a private address, or a signed image/media URL, cookie, or Referer is stored in D1 logs or Dashboard evidence.

**Why it happens:**
The current integrity route accepts stored external URLs and returns failure rows containing the URL. Source providers commonly use signed query material.

**How to avoid:**
Keep URL guard and redirect policy server-side, reject loopback/private/link-local/benchmark targets, cap response size and time, and redact URL query values before persistence or response. Store host/path class, hash, status, and bounded failure code.

**Warning signs:**
The probe follows arbitrary redirects, full URLs appear in audit logs, or an evidence artifact can be replayed as a credential-bearing request.

**Phase to address:**
Phase 25 contract and Phase 28 probe/evidence implementation.

---

### Pitfall 8: Stale Check or Repair Overwrites Newer Content

**What goes wrong:**
Two checks or a manual edit complete out of order. The older source revision replaces a newer source projection, or a retry writes duplicate observations.

**Why it happens:**
The work is asynchronous and provider callbacks can arrive after cancellation, retry, or a new content mutation.

**How to avoid:**
Bind every observation and repair to a content/source revision and task/run/attempt tuple. Use D1 CAS or a transaction for current projection updates, unique event identities for replay, and explicit stale/duplicate/late outcomes.

**Warning signs:**
The projection has no revision, a retry reuses the same event identity, or a late run can change the latest observedAt backwards.

**Phase to address:**
Phase 25 shared contract and every later check adapter.

---

### Pitfall 9: A Large Result Blob Exhausts D1 or Hides the Action

**What goes wrong:**
A full chapter list or thousands of page failures are placed in receipt_summary_json, logs, or a Dashboard response. The write fails, logs are truncated, or the operator cannot find the first repair target.

**Why it happens:**
JSON is convenient for a proof-of-concept and the current runner already caps safe logs, but availability checks multiply the number of items.

**How to avoid:**
Use bounded summary columns, capped anomaly rows, counts, sampled failures, and an artifact reference for the rest. Define per-run item and byte budgets and make truncation an explicit fact.

**Warning signs:**
Receipt validation depends on unbounded arrays, D1 batch size errors, or the UI shows only a total with no target identity.

**Phase to address:**
Phase 25 receipt contract and Phase 27/28 result storage.

---

### Pitfall 10: Provider Acceptance Is Treated as Execution Success

**What goes wrong:**
GitHub dispatch returns accepted or cancel returns accepted, then the Dashboard marks the task complete. A queued, cancelled, failed, or provider-lost run has no matching application receipt.

**Why it happens:**
The GitHub API is asynchronous and the existing client deliberately separates dispatch, run lookup, reconciliation, and signed receipt.

**How to avoid:**
Keep provider status, application run status, and content result separate. Reconcile the exact workflow path, provider run id, provider attempt, application attempt, and task tuple before projecting terminal success.

**Warning signs:**
A 204 dispatch or 202 cancel is shown as final, or a provider run from another workflow can be attached by id alone.

**Phase to address:**
Phase 25 contract and the first production-like check.

---

### Pitfall 11: Crawler Error Handling Reports a False Terminal State

**What goes wrong:**
The crawler catches per-manga or per-chapter errors, logs them, and exits with a summary that looks successful even though the content is partial.

**Why it happens:**
ComicCrawler intentionally continues after item failures and updates partial progress, while runner success semantics are separate from content completeness.

**How to avoid:**
Receipt validation must include bounded item outcome counts and terminal completeness disposition. A runner may finish its process successfully while the content result is partial or failed.

**Warning signs:**
processedChapters plus failedChapters is not included in the receipt, or complete is derived from a zero-error process exit only.

**Phase to address:**
Phase 25 result contract and Phase 27 comic adapter.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep all check details in receipt_summary_json | No migration | Weak filtering, size risk, and poor history | Only for a small bounded summary alongside queryable findings |
| Reuse crawlStatus as availability | No new field | False-ready UI and impossible freshness semantics | Never as the sole availability fact |
| Use current chapter rows as source snapshot | No new table | Missing and duplicate source chapters cannot be reconstructed | Only for a display-only count with an explicit incomplete label |
| Return raw image URL in integrity failures | Easy debugging | Secret and privacy exposure | Only in short-lived local diagnostics, never in persisted evidence |
| Probe every URL serially in an API request | Simple handler | Worker timeout and origin rate-limit failures | Only for a tiny, explicitly capped fixture |
| Auto-retry every failure with the same policy | Better apparent success | Provider bans, duplicate runs, and cost spikes | Only within a capped attempt budget with reason classification |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Actions | Assume dispatch or cancel response means the work completed | Track provider run and application attempt, then wait for a matching receipt |
| Direct video origin | Use HEAD or HTTP 200 as playback proof | Use bounded transport observation, then browser media event and progress proof |
| Magnet / Aria2 / TorrServer | Treat the magnet string as a media URL | Resolve metadata and controlled stream separately, then verify playback if required |
| Manga origin | Parse a source page but lose source ordinal or source identity | Persist normalized chapter snapshot with source ordinal and policy version |
| External image origin | Follow redirects indefinitely or accept HTML challenge pages | Cap redirects/time/body, inspect response, and use source-specific browser fallback |
| Gateway cache | Read an old movie/comic detail after a successful repair | Invalidate the correct cache group and verify fresh Gateway readback |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N x M page probes on every dashboard load | Slow page, origin throttling | Check tasks plus cached projection and capped concurrency | A single comic with hundreds of pages |
| One D1 insert per item without a budget | Timeouts and partial receipts | Prepared batches with a per-run row cap | Large chapter lists or many failed pages |
| Full provider polling for every historical run | GitHub rate-limit pressure | Poll only active/reconciliation candidates | Dozens of retained provider runs |
| Re-running a whole comic to repair one chapter | Long feedback loop | Targeted chapter task with source snapshot | Large serializing comics |
| Browser fallback for every HTTP image response | High runner cost | Use transport first, browser only for ambiguous or known session-bound hosts | Anti-hotlink origins |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Server fetches an unchecked URL or redirect | SSRF and internal service exposure | URL allowlist, private-network rejection, manual redirect policy, timeout |
| Signed source URL stored in D1 or evidence | Credential replay or leakage | Redact queries and headers; retain hash and bounded identity |
| Availability route returns raw URLs to every admin surface | Wider exposure than the Reader needs | Return source type, stable id, host/path class, and failure facts |
| Check action lacks resource permission or target re-read | Cross-resource mutation | Use existing movie/comic permissions and re-read current revision before creation |
| Raw provider HTML is uploaded as an artifact by default | Cookies and challenge tokens may be embedded | Keep artifacts short-lived, scrubbed, and opt-in for diagnosis |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| One green/red badge for a multi-layer result | Operator cannot choose the next action | Show execution, metadata, source, integrity, and freshness separately |
| Failure row exposes only a total | Repair starts from guesswork | Show the first bounded sample with stable target identity and reason code |
| Stale result looks current | Operator trusts old data | Display observedAt, policy version, and stale/unknown state |
| Retry and repair use the same label | Wrong operation is repeated | Explain whether the action retries the run, rechecks content, or mutates source rows |
| Long task history is hidden behind a generic log | Audit path is lost | Show current run, attempts, transition outcome, receipt, and evidence links |

## "Looks Done But Isn't" Checklist

- [ ] Task CRUD preserves immutable snapshots and dependent run/evidence history.
- [ ] Cancel and retry have provider/application reconciliation and exact tuple checks.
- [ ] Metadata success does not imply direct source, magnet, image, or playback success.
- [ ] Magnet checks use a controlled resolver and have bounded terminal outcomes.
- [ ] Chapter checks preserve source identity, duplicates, order, and missing items before repair.
- [ ] Page checks validate URL, page number, count, response type, and failure sample.
- [ ] Every current projection has observedAt, revision, reason, and repairability.
- [ ] Raw URLs, cookies, signatures, and provider artifacts are redacted.
- [ ] Dashboard evidence is proven through http://localhost:8080 and a fresh task tuple.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Task snapshot changed during active run | MEDIUM | Mark the run stale, preserve provider facts, archive the definition, and create a new task from a fresh snapshot |
| Source or page projection overwritten by old check | HIGH | Restore the latest revision from observation history, mark the old result stale, and block the old task from retrying |
| Chapter list was rebuilt before comparison | HIGH | Re-crawl the source into a new snapshot, compare against the current/manual rows, and avoid auto-deleting until the diff is reviewed |
| Probe flooded an origin | MEDIUM | Stop the run, record rate-limit outcome, apply per-origin cooldown, and use the last known state as stale |
| Evidence contains sensitive URL material | HIGH | Revoke or expire the artifact, redact persisted rows, rotate provider material where applicable, and retain only the bounded fact |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Task CRUD breaks run identity | Phase 25 | Concurrent update/archive plus late callback fixture |
| Execution success becomes availability success | Phase 25 | Independent status matrix and receipt assertions |
| Magnet is probed as HTTP | Phase 26 | Magnet adapter tests for no metadata, metadata only, stream failure, and success |
| Chapter comparison loses source baseline | Phase 27 | Source snapshot diff with missing and duplicate fixtures |
| Count hides chapter order anomaly | Phase 27 | Same-count reordered and special-number fixture |
| HTTP 200 is not an image | Phase 28 | HEAD, Range, redirect, HTML challenge, and browser-load fixtures |
| Probe leaks or reaches private URL | Phase 25/28 | URL guard, redirect, redaction, and artifact inspection tests |
| Stale result overwrites newer state | Phase 25 | CAS, duplicate event, late attempt, and manual-edit conflict tests |
| Result blob exceeds budget | Phase 25/27/28 | Max rows/bytes and truncation receipt assertions |
| Provider acceptance is final success | Phase 25 | Dispatch accepted, queued, cancelled, failed, lost, and receipt-missing flows |
| Crawler exits green with partial content | Phase 27 | Per-item outcome counts and partial terminal receipt fixture |

## Sources

### Primary repository evidence

- packages/db/src/schema.ts
- apps/api/src/domain/crawler-tasks/repository.ts
- apps/api/src/domain/crawler-tasks/state-machine.ts
- apps/api/src/routes/admin/crawler-tasks/index.ts
- apps/api/src/domain/movies/source-contract.ts
- apps/api/src/domain/movies/source-reconciliation.ts
- apps/api/src/routes/admin/sync/handlers.ts
- apps/api/src/routes/admin/chapters/handlers.ts
- packages/crawler/src/crawlers/comic-crawler.ts
- packages/crawler/src/strategies/javbus.ts
- apps/dashboard/src/views/Crawlers.vue

### Official documentation

- https://docs.github.com/en/rest/actions/workflow-runs
- https://docs.github.com/en/rest/actions/workflows
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests
- https://developers.cloudflare.com/d1/platform/limits/

---
*Pitfalls research for: Starye v1.5 crawler operations and content availability*
*Researched: 2026-08-10*
