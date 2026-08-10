# Project Research Summary

**Project:** Starye v1.5 爬虫运管与内容可用性闭环
**Domain:** Brownfield single-user crawler operations, data quality, and availability remediation
**Researched:** 2026-08-10
**Confidence:** MEDIUM overall; HIGH for current repository boundaries and P1 gaps

## Executive Summary

Starye already has the right execution foundation for this milestone: D1-backed crawler_task and crawler_run facts, immutable template snapshots, leases, state-machine transitions, signed runner events, GitHub Actions provider association, bounded logs, source revisions, and a Dashboard task view. The missing capability is a shared content-availability contract on top of that control plane. Task CRUD, availability checks, repairs, and evidence should all use the same task/run/attempt identity rather than introducing a second scheduler.

The most important design decision is to keep execution state separate from content state. A successful crawl can persist metadata while leaving direct sources, magnet metadata, chapters, or external images unavailable. v1.5 needs current projections plus append-only bounded observations for movie metadata/source/magnet, comic chapter sets, and chapter pages. Remediation must be revision-bound and idempotent, and final acceptance must read through the canonical Gateway at http://localhost:8080.

No new production framework is justified. Reuse Hono, Valibot, D1/Drizzle, Node 24, got, Puppeteer, p-map/p-queue, Vue, and Playwright. The main uncertainty is external provider behavior: magnet resolver state, anti-hotlink image responses, source chapter ordering, and GitHub Actions queue/cancellation timing require targeted fixtures or production-like observations during phase planning.

## Key Findings

### Recommended Stack

- Hono 4.12.14 plus Valibot 1.3.1 owns the closed API and result contracts.
- D1/Drizzle 0.45.2 stores task/run history, current projections, and bounded observations with prepared statements, batches, and CAS.
- Node 24 with Puppeteer Core 24.41.0, got 15.0.2, p-map 7.0.4, and p-queue 9.1.2 remains the source and probe runtime.
- Vue 3.5.32, Vite 8.0.8, and Playwright 1.59.1 remain the Dashboard and Gateway proof surface.
- Native fetch with timeout, redirect, response-size, and concurrency limits covers direct/image transport probes. Magnet checks require the controlled Aria2/TorrServer path.

### Expected Features

**Must have:**

- Task create/list/detail/update/archive semantics with immutable run snapshots, history, cancel, retry, and audit.
- Separate metadata, direct source, magnet, chapter completeness, and image availability results.
- Missing, duplicate, order, count, invalid URL, load failure, stale, and inconclusive reason codes.
- Revision-bound recheck or repair actions with bounded receipt and current projection readback.
- Dashboard result and remediation views validated through the canonical Gateway.

**Should have:**

- An explainable anomaly diff that points to the first bounded repair target.
- Freshness-aware status with observed time, policy version, source/content revision, and next action.
- A single evidence chain from Dashboard command to runner result, D1 projection, content readback, and Gateway proof.

**Defer:**

- Multi-user approval or notification workflows, provider abstraction beyond GitHub Actions, large batch sweeps, real-time WebSockets, and a new queue/workflow engine.

### Architecture Approach

Use crawler_task and crawler_run as the operation boundary. Generalize the template registry so a check or repair stores target identity, policy version, revision, and intent in an immutable snapshot. The runner performs source-specific work and sends signed bounded events. The API validates the tuple and revision, writes append-only observations and a current projection in a CAS-protected transaction, invalidates the relevant cache, and returns a typed result. Dashboard reads the projection and invokes an explicit remediation task; it does not infer health from raw URLs, counts, or logs.

For comics, preserve the source chapter list before comparing it with stored rows. For pages, compare expected count and page identity before probing external URLs. For videos, classify direct, magnet, and TorrServer before selecting the probe adapter. Every layer exposes transport, content, and browser evidence as distinct facts.

## Critical Pitfalls

1. **Task CRUD breaks run identity:** archive or supersede active definitions and preserve immutable snapshots; test late callbacks and concurrent actions.
2. **Green execution is false availability:** keep run, metadata, source, integrity, and playback states separate.
3. **Magnet is treated as HTTP:** use the controlled resolver and distinguish metadata, stream, and playback outcomes.
4. **Chapter sync destroys the source baseline:** persist source observations before any repair and retain duplicates/order information.
5. **HTTP 200 is false image success:** use bounded HEAD/Range/browser checks and content-type or decode evidence for ambiguous origins.
6. **Stale results overwrite newer state:** use revision, event identity, D1 CAS, and explicit stale/duplicate/late outcomes.
7. **Evidence leaks source material:** store redacted identity, hash, host/path class, status, reason, counts, and short-lived artifact references.
8. **Provider acceptance is final success:** dispatch/cancel/run status must reconcile with the exact application attempt and receipt.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 25: Task Operations and Availability Contract

**Rationale:** All later checks need one task/run/attempt identity, immutable snapshots, archive/delete semantics, and a shared result model.

**Delivers:** Task CRUD/archive API and Dashboard controls; operation registry; check result and evidence contracts; current projection plus observation primitives; revision/CAS and redaction rules; canonical Gateway task/evidence readback.

**Addresses:** Task management, history, audit, freshness, idempotency, and the execution/content boundary.

**Avoids:** Mutable snapshots, duplicate active runs, provider acceptance false positives, stale overwrites, and unbounded result blobs.

### Phase 26: Video Metadata, Source and Magnet Availability

**Rationale:** Existing source readiness and repair_players facts provide the closest vertical slice, but active source currently means only non-empty and active.

**Delivers:** Metadata/source/magnet check operations; direct transport and controlled magnet resolver adapters; per-source reason and freshness projection; bounded repair/recheck; source revision readback and Dashboard actions.

**Uses:** movie_source_state, movie_source_observation, player rows, existing repair adapter, GitHub Actions runner boundary, and MovieDetail source classification.

**Avoids:** URL-only readiness, magnet HTTP probes, inactive-source selection, and metadata success hiding no-source.

### Phase 27: Comic Chapter Completeness

**Rationale:** Chapter comparison needs a source snapshot and identity/order semantics before page-level checks can name the correct chapter repair target.

**Delivers:** Source chapter observation; missing/duplicate/sequence/order diagnostics; independent crawl terminal result; partial/unknown/stale projection; targeted chapter recrawl with existing non-empty and non-regression guards.

**Uses:** ComicCrawler source list, MangaInfoSchema, comic/chapter rows, existing chapters endpoint, and task runner receipt boundary.

**Avoids:** delete-and-reinsert baseline loss, silent duplicate dropping, count-only completeness, and a green process exit masking partial chapters.

### Phase 28: Chapter Image Availability and Full Gateway Acceptance

**Rationale:** Page/image checks depend on stable comic chapter identities, and the final user value is the Dashboard -> check -> repair -> Reader readback chain.

**Delivers:** Count, page-number, URL, duplicate, order, HTTP, and browser image observations; bounded failure samples; targeted page/chapter repair; Dashboard result and evidence surface; canonical Gateway local proof and cache freshness verification.

**Uses:** existing getChapterIntegrity HEAD/Range probe, sourcePageCount, page rows, external URL guard, comic admin permissions, and Playwright Gateway projects.

**Avoids:** HTTP 200 false success, SSRF, signed URL leakage, unbounded fan-out, stale comic cache, and read-only diagnostics with no next action.

### Phase Ordering Rationale

- Phase 25 establishes the identity, status, observation, revision, and evidence contracts that every later operation needs.
- Phase 26 reuses the existing source health and repair vertical slice, adding the missing transport-aware and magnet-aware checks.
- Phase 27 records the source chapter set before comparing it, which gives page checks stable and explainable targets.
- Phase 28 adds the larger page fan-out only after result budgets, redaction, and repair ownership are established, then closes the chain through the canonical Gateway.

## Research Flags

Phases likely needing deeper research during planning:

- **Phase 25:** exact task update/archive semantics, whether availability results need separate D1 tables or bounded per-check rows, and compatibility with existing receipt versions.
- **Phase 26:** selected direct source behavior, magnet resolver/TorrServer metadata and stream states, provider-specific rate limits, and browser playback fixtures.
- **Phase 27:** source chapter identity for providers with missing or non-numeric chapter numbers, special chapters, and source list pagination/terminal detection.
- **Phase 28:** image host HEAD/Range/content-type behavior, anti-hotlink browser requirements, redirect policy, and selected local/production-like external image fixtures.

Phases with established patterns:

- **Phase 25 execution lifecycle:** existing crawler repository, state machine, signed callback, provider association, and audit patterns cover the base.
- **Phase 28 Gateway proof mechanics:** existing Dashboard polling, Playwright projects, cache invalidation, and canonical local URL patterns cover the test harness; only new result assertions are needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions and runtime boundaries are present in the lockfile and package manifests; no dependency addition is indicated. |
| Features | HIGH | Scope is explicit in PROJECT.md and the current API/UI gaps are directly visible. |
| Architecture | MEDIUM | The task/run extension and projection pattern fit the repository, but exact schema granularity needs phase-level design. |
| Pitfalls | MEDIUM | Repository hazards are clear; external anti-hotlink, magnet resolver, and provider timing need fresh observations. |

**Overall confidence:** MEDIUM. The milestone shape and ordering are actionable, while provider-specific states must remain explicitly provisional until target fixtures are selected.

### Gaps to Address

- **Magnet truth:** choose the configured Aria2/TorrServer observation path and define bounded success/failure states before implementation.
- **Chapter source identity:** confirm how the selected comic source represents special, duplicate, and missing chapter numbers.
- **Image response semantics:** collect representative HEAD, Range, redirect, HTML challenge, and browser-load fixtures.
- **Projection schema:** decide which summaries need first-class D1 columns and which anomaly rows can be capped or artifact-backed.
- **Task delete semantics:** confirm archive versus hard deletion rules for tasks with runs, receipts, and audit history.

## Sources

### Primary (HIGH confidence)

- .planning/PROJECT.md and .planning/STATE.md - v1.5 scope, constraints, Gateway rule, and previous milestone handoff.
- packages/db/src/schema.ts - current content, source, task/run, observation, and audit tables.
- apps/api/src/domain/crawler-tasks/repository.ts and state-machine.ts - task/run lifecycle, leases, CAS, retries, and history.
- apps/api/src/routes/admin/crawler-tasks/index.ts - current admin operation surface.
- apps/api/src/domain/movies/source-contract.ts and source-reconciliation.ts - current source/readiness distinction and repair revision behavior.
- apps/api/src/routes/admin/sync/handlers.ts - movie and comic mutation guards.
- apps/api/src/routes/admin/chapters/handlers.ts - current chapter status and external image integrity probe.
- packages/crawler/src/crawlers/comic-crawler.ts and strategies/site-92hm.ts - actual chapter extraction, deduplication, page normalization, and partial processing behavior.
- apps/dashboard/src/views/Crawlers.vue and apps/dashboard/src/lib/api.ts - actual operator surface and typed API calls.

### Secondary (MEDIUM confidence)

- https://docs.github.com/en/rest/actions/workflow-runs - asynchronous run, cancel, rerun, status, conclusion, and attempt behavior.
- https://docs.github.com/en/rest/actions/workflows - dispatch behavior and accepted-response boundary.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD - HEAD response semantics.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests - bounded range response semantics.
- https://www.sqlite.org/lang_select.html - aggregation, grouping, and ordering behavior.
- https://developers.cloudflare.com/d1/platform/limits/ - D1 operational limits.

### Tertiary (LOW confidence)

- No unverified competitor or community claim is used as a roadmap requirement. Provider-specific behavior remains a research flag until a selected target is observed.

---
*Research completed: 2026-08-10*
*Ready for roadmap: yes*
