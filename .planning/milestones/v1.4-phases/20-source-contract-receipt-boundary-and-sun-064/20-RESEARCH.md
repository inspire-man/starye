# Phase 20: Source Contract, Receipt Boundary And SUN-064 - Research

**Researched:** 2026-08-05
**Domain:** D1/Drizzle crawler receipts, movie source projection, Vue/xgplayer playback boundary
**Confidence:** HIGH for repository seams; MEDIUM for recommended contract shape

## Summary

Phase 20 is a brownfield contract correction, not a new player implementation. The repository currently has three facts mixed together: a movie row can be persisted, a crawler can report a receipt, and a browser can start or advance media playback. The existing receipt validator resolves a movie identity but does not inspect player rows, and the current unit test intentionally accepts a persisted movie with `total_players=0` and `crawled_players=0`. [VERIFIED: apps/api/src/domain/crawler-tasks/receipt-validation.ts:50-109] [VERIFIED: apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts:44-79]

The source write and read seams have a second gap: crawler sync deletes/reinserts players only when the incoming array is non-empty, while public movie detail reads all player rows directly. This permits an empty crawler result to leave stale sources, and it gives the UI no server-owned readiness or repairable disposition. [VERIFIED: apps/api/src/routes/admin/sync/handlers.ts:16-47] [VERIFIED: apps/api/src/routes/public/movies/index.ts:453-479]

**Primary recommendation:** Keep `movie.id`/validated `primaryContentId` as the single content identity, derive source disposition from a fresh player-row query at the API receipt boundary, persist a versioned source summary/revision with the crawler run, and expose one shared readiness DTO to crawler task detail and MovieDetail. `ready` must mean an eligible candidate exists; `playback_verified` must remain a separate browser-evidence fact.

## User Constraints

- Phase scope is SRC-01 and SRC-03 only: distinguish metadata persistence, source readiness, and actual playback proof; make `players=0` read back as `no_source`/repairable; keep receipt/source summary tied to one content identity. [VERIFIED: .planning/REQUIREMENTS.md:10-12]
- Continue the v1.3 D1 task/run/attempt/lease, receipt, target-profile, and controlled-template boundaries. Production Puppeteer remains in GitHub Actions; the historical Phase 13 carrier is not v1.4 proof. [VERIFIED: .planning/ROADMAP.md:19-19]
- Reuse `primaryContentId` and the existing Movies CRUD/content editor; do not create a second movie management truth. [VERIFIED: .planning/REQUIREMENTS.md:48-52]
- Local verification uses the Gateway canonical entry `http://localhost:8080/...`; direct frontend ports are not canonical. [VERIFIED: AGENTS.md:20-20]

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRC-01 | Distinguish metadata persisted from playback readiness in task detail and MovieDetail, including ready/no_source/source_failed/repairing/playback_verified. | Add a server-owned source summary/readiness projection to crawler run and public movie detail DTOs; keep browser playback proof separate from source readiness. |
| SRC-03 | Every controlled video crawl reaches candidate-health-check or explicit no-source/repairable terminal state; SUN-064 players=0 is read back and classified. | Revalidate `primaryContentId` against movie plus eligible player rows after sync; persist no-source disposition and source summary in the same receipt-bound write/read path. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Metadata persistence and player-row reconciliation | Database / Storage | API / Backend | D1/Drizzle owns durable movie/player facts; API controls the consistency boundary. [VERIFIED: packages/db/src/schema.ts:153-205] |
| Receipt validation and source disposition | API / Backend | Database / Storage | Runner data is a candidate; the API can query the canonical movie and player rows before accepting a terminal receipt. [VERIFIED: apps/api/src/domain/crawler-tasks/receipt-validation.ts:50-109] |
| Task detail source summary | API / Backend | Browser / Client | The admin route already projects safe run fields and receipt JSON; the UI should consume a typed projection. [VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts:132-138,256-272] |
| MovieDetail readiness display | Browser / Client | API / Backend | Vue renders the API detail model, but readiness must come from server projection rather than `players.length` guessing. [VERIFIED: apps/movie-app/src/views/MovieDetail.vue:197-203,691-717] |
| Actual playback proof | Browser / Client | API / Backend | xgplayer events and `currentTime` are observed in Player; this is evidence after source selection, not metadata success. [VERIFIED: apps/movie-app/src/views/Player.vue:396-465] |

## Current Live Code Seams

| Seam | Current behavior | Phase 20 implication |
|---|---|---|
| `packages/db/src/schema.ts` `movies`/`players` | Movie has `totalPlayers` and `crawledPlayers`; player has `movieId`, URL, active flag, and ratings, but no source revision, disposition, observation, or playback readiness fields. [VERIFIED: packages/db/src/schema.ts:153-205] | Prefer a narrow source-summary/read-model migration or a dedicated observation table; do not overload `totalPlayers` as health or playback proof. |
| `apps/api/src/domain/crawler-tasks/receipt-validation.ts` `validateReceiptCandidate` | Resolves candidate IDs by movie id/code and returns a normalized `primaryContentId`; it does not query player rows. [VERIFIED: lines 54-109] | Extend validation to query the same canonical movie identity and active/eligible player count, then emit a versioned source disposition. |
| `apps/api/src/domain/crawler-tasks/types.ts` receipt/read models | `ValidatedCrawlerRunReceipt` only has counts, `primaryContentId`, and template key; run failure codes cover execution/receipt failures, not source disposition. [VERIFIED: lines 106-163,23-37] | Add closed unions for source disposition and readiness; keep execution status and source status as separate properties. |
| `apps/api/src/domain/crawler-tasks/repository.ts` terminal persistence | `receipt_summary_json` is stored on `crawler_run`; terminal receipt is serialized after validation. [VERIFIED: apps/api/src/domain/crawler-tasks/repository.ts:802-896,1204-1243] | Persist the source summary with the validated receipt and guard identity/revision in one repository operation. |
| `apps/api/src/routes/admin/crawler-tasks/index.ts` task detail | Task detail returns runs and projects `receipt_summary_json` into a limited receipt shape. [VERIFIED: lines 98-138,256-272] | Return metadata persisted status plus source summary/readiness; avoid exposing raw unvalidated JSON. |
| `apps/api/src/routes/public/movies/index.ts` `/:code` | Reads movie by code, then `players.findMany({ movieId })`, returning raw player rows. [VERIFIED: lines 453-479,608-620] | Join/derive a source summary from the same movie id and return a stable DTO for MovieDetail. |
| `apps/api/src/routes/movies/services/movie.service.ts` `getMovieByIdentifier` | Uses Drizzle relation `movies.players`, maps ratings and `isActive`, and returns players; no readiness projection. [VERIFIED: lines 228-277,379-410] | Keep this service and public route aligned or establish one canonical detail read model to prevent divergent readiness semantics. |
| `apps/api/src/routes/admin/sync/handlers.ts` `syncMovieData` | Upserts movie; deletes/reinserts players only when `playerData.length > 0`. An empty incoming array leaves existing rows untouched. [VERIFIED: lines 16-47] | Make empty source result explicit: reconcile/delete according to source revision and record `no_source`, while preserving receipt history. |
| `packages/crawler/src/lib/strategy.ts` `MovieInfo` | Crawler contract requires `players` array, but it has no source result/disposition or stable content identity beyond slug/code. [VERIFIED: lines 61-85] | Treat crawler players as candidate input; API must derive the authoritative disposition after persistence. |
| `apps/movie-app/src/views/MovieDetail.vue` | `sortedPlayers` returns empty for no rows; source section is hidden when empty; sort uses type/quality/rating and does not encode health. [VERIFIED: lines 197-203,691-717] | Consume readiness DTO and render no-source/source-failed/repairable states without equating an empty list to an unexplained UI gap. |
| `apps/movie-app/src/views/Player.vue` | Standard mode selects `movie.players[0]` unless a player id is supplied; initializes xgplayer; handles canplay/playing/waiting/error/timeupdate. [VERIFIED: lines 341-387,396-465] | Phase 20 only supplies honest readiness and prevents initialization on no-source; detailed fallback/retry belongs to Phase 22. |
| Existing tests | Receipt validation explicitly accepts persisted movie with zero players; MovieDetail DOM test checks content tuple; Player security tests check access/trusted stream gates and xgplayer initialization. [VERIFIED: apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts:44-79] [VERIFIED: apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts] [VERIFIED: apps/movie-app/src/views/__tests__/Player.security.test.ts] | Add regression tests for zero source, stale source cleanup, source summary identity, and no player initialization for no-source. |

## Recommended Architecture And Data Flow

```text
crawler MovieInfo(players candidates)
        -> controlled sync/upsert movie + reconcile player rows
        -> D1 readback by canonical movie.id / code
        -> derive eligible source count + disposition + repairable reason + sourceRevision
        -> validate receipt and persist receipt v2/source summary on crawler_run
        -> admin task detail + public MovieDetail share the same source DTO
        -> Player may initialize xgplayer only for an eligible candidate
        -> browser events/currentTime proof remains a separate playback_verified evidence fact
```

Use a closed contract with three independent layers:

1. `metadata`: `persisted` plus `contentId` and metadata revision/readback facts.
2. `source`: `disposition` (`ready`, `no_source`, `source_failed`, `repairing`), `eligibleCount`, bounded reason, and `sourceRevision`. `players=0` is `no_source` and `repairable=true` unless a stronger write/read failure is observed.
3. `playback`: `playback_verified` only after the browser evidence contract records the required playback signal; `ready` alone is not playback proof. The existing Player event seam already has `canplay`, `playing`, `waiting`, `error`, and `timeupdate`, but Phase 20 should only define the boundary and no-source guard. [VERIFIED: apps/movie-app/src/views/Player.vue:419-465]

The receipt boundary should accept runner counts only as candidate facts. After sync, query the canonical movie row and player rows, calculate the disposition, and serialize a receipt version containing `templateKey`, `primaryContentId`, `sourceRevision`, `sourceSummary`, and metadata counts. Reject or downgrade a receipt whose content identity cannot be read back. Keep source summary and receipt bound to the same `primaryContentId`; never infer identity from a title, source URL, or array position.

## Schema / Migration Implications

- Existing `movie.total_players`/`movie.crawled_players` are crawler aggregate counters, not sufficient readiness state. [VERIFIED: packages/db/src/schema.ts:174-180] Add explicit source fields or a normalized source observation/current-summary table rather than changing their meaning.
- A minimal Phase 20 migration should support: canonical `content_id`, source revision/generation, current disposition, eligible player count, bounded failure/repair code, observed timestamp, and receipt schema version. Preserve historical crawler receipt JSON for audit; do not overwrite old attempts with a new source state.
- If current projection is stored on `movie`, enforce one row per movie and update it after player reconciliation. If history is required for later Phase 21/23 health and retry work, use an append-only observation table plus a current projection keyed by movie id. The choice must keep `primaryContentId` equal to `movie.id`.
- Existing `crawler_run.receipt_summary_json` is the natural receipt storage boundary. Extend its validated shape before changing admin projection; raw runner JSON must remain untrusted. [VERIFIED: packages/db/drizzle/0027_crawler_task_domain_foundation.sql] [VERIFIED: apps/api/src/domain/crawler-tasks/repository.ts:839-896]
- Follow the repository migration procedure: edit schema, generate SQL with `pnpm --filter=@starye/db run generate`, apply locally and smoke, run destructive SQL checks, back up before any remote apply, then apply and run schema/API smoke. [VERIFIED: packages/db/MIGRATION.md]
- The sync path must define empty-array semantics explicitly. The current `if (playerData && playerData.length > 0)` branch is the main stale-source risk; a planned migration/readback test must cover a previously sourced movie receiving `players=[]`.

## Standard Stack

| Component | Local version | Use in Phase 20 | Provenance |
|---|---:|---|---|
| Drizzle ORM | 0.45.2 | typed SQLite/D1 schema and relation queries | [VERIFIED: apps/api/package.json; packages/db/package.json] |
| Drizzle Kit | 0.31.10 | generate repository migration SQL | [VERIFIED: packages/db/package.json] |
| Hono | 4.12.14 | API route/read-model boundary | [VERIFIED: apps/api/package.json] |
| Valibot | 1.3.1 | existing request/schema validation conventions | [VERIFIED: apps/api/package.json; packages/crawler/package.json] |
| Vitest | 4.1.4 | API, crawler, and frontend regression tests | [VERIFIED: apps/api/package.json] |
| Vue + xgplayer | xgplayer 3.0.24 | consume source DTO; retain existing player lifecycle seam | [VERIFIED: apps/movie-app/package.json; pnpm-lock.yaml] |

Use the existing packages and routes. Phase 20 does not need a new media service, queue, player library, or second content editor. [VERIFIED: .planning/REQUIREMENTS.md:48-52]

## Don't Hand-Roll

| Problem | Don't build | Use instead |
|---|---|---|
| D1 schema evolution | ad-hoc production SQL or rollback guessing | Drizzle schema + generated migration + repository migration checklist. [VERIFIED: packages/db/MIGRATION.md] |
| Receipt identity | trust runner `contentIds`/counts as final | `validateReceiptCandidate`-style API readback against movie id/code, then derive `primaryContentId`. [VERIFIED: apps/api/src/domain/crawler-tasks/receipt-validation.ts:50-109] |
| Playback readiness | use `players.length`, rating, HTTP status, or page load as proof | server-owned source disposition plus separate browser evidence contract |
| Source sorting/health | add health meaning to rating or sort order | explicit eligibility/disposition fields; existing sorter remains presentation-only. [VERIFIED: apps/movie-app/src/utils/playbackSources.ts:52-132] |

## Tests And Verification Commands

Existing local package scripts identify the focused commands:

```powershell
pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/receipt-validation.test.ts
pnpm --filter api exec vitest run src/routes/movies/__tests__/handlers/movies.handler.test.ts
pnpm --filter api exec vitest run src/routes/movies/__tests__/services/sync.service.test.ts
pnpm --filter @starye/crawler exec vitest run test/optimized-crawler.test.ts
pnpm --filter movie-app exec vitest run src/views/__tests__/MovieDetail.dom-contract.test.ts src/views/__tests__/Player.security.test.ts
pnpm --filter @starye/db type-check
pnpm --filter api type-check
pnpm --filter movie-app type-check
```

Phase-specific regression cases to plan:

- Persisted movie with `players=[]` yields `metadata.persisted`, `source.disposition=no_source`, `repairable=true`, and never `ready`. [VERIFIED: current zero-player receipt test demonstrates the present incorrect acceptance boundary]
- Existing player rows followed by an empty crawler result are reconciled according to the chosen source revision policy; no stale source is returned by public detail.
- Receipt candidate resolving by movie code returns the same `primaryContentId` as public MovieDetail and source summary; a missing row returns receipt failure, not a source success.
- Source write/read failure yields `source_failed` with bounded reason and does not become metadata success or playback readiness.
- MovieDetail renders a no-source/repairable state while preserving the content tuple marker; Player does not construct xgplayer when no eligible source exists.
- Run the API/crawler focused suites first, then type-check affected packages. For UI smoke, use the Gateway path `http://localhost:8080/...` per `AGENTS.md`; a direct Vite port is not canonical. [VERIFIED: AGENTS.md:20-20]

## Common Pitfalls

1. **Receipt existence mistaken for source readiness.** Current validation accepts a persisted movie with zero players. [VERIFIED: apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts:44-79] Derive source state from post-write player readback.
2. **Empty array leaves stale players.** `syncMovieData` only deletes/reinserts on non-empty input. [VERIFIED: apps/api/src/routes/admin/sync/handlers.ts:34-43] Define empty input semantics and test an existing-source-to-zero-source transition.
3. **Inactive rows counted as playable.** `players.isActive` exists, but the public detail query returns rows without an eligibility projection. [VERIFIED: packages/db/src/schema.ts:186-202] Define one explicit eligible predicate and use it consistently.
4. **Metadata/source/browser statuses collapsed.** Player events are runtime observations; `canplay` or page load does not establish sustained playback. [VERIFIED: apps/movie-app/src/views/Player.vue:419-465] Keep playback evidence separate for later phases.
5. **Two detail implementations drift.** Public route and `movie.service.ts` both build movie detail models. [VERIFIED: apps/api/src/routes/public/movies/index.ts:453-620] Plan one shared projection/helper or contract tests across both paths.
6. **Identity drift.** Receipt validation normalizes `contentIds` to a movie row id, while the crawler uses slug/code and sync uses slug as id. [VERIFIED: apps/api/src/domain/crawler-tasks/receipt-validation.ts:63-85] Make the final `movie.id` the only cross-surface content identity and test code/slug lookup equivalence.
7. **Cache returns old zero-source detail.** The movie route has existing cache middleware in the route layer. [VERIFIED: apps/api/src/routes/movies/index.ts:20-22] Any source-bearing detail response needs revision-aware invalidation or no-store behavior after reconciliation.

## Security Domain

| ASVS category | Applies | Phase 20 control |
|---|---|---|
| V2 Authentication | yes | Reuse existing authenticated/admin route guards for crawler task detail; public MovieDetail keeps existing R18 gate. [VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts:145-168] |
| V3 Session Management | yes | Do not add source URLs, signed material, or provider secrets to the DTO; preserve existing session boundary. |
| V4 Access Control | yes | Keep source summary scoped to the same task/content identity and existing crawler permission resource. [VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts:153-168] |
| V5 Input Validation | yes | Validate new enums/reason codes through existing Hono route validators and Valibot schemas; runner receipt remains server revalidated. [VERIFIED: apps/api/src/domain/crawler-tasks/receipt-validation.ts:54-75] |
| V6 Cryptography | yes | Do not introduce cryptography in this phase; do not expose or reimplement existing signed callback material. [VERIFIED: .planning/ROADMAP.md:19-19] |

## Project Constraints (from AGENTS.md)

- Default communication, analysis, verification, and delivery are Chinese.
- Use GSD before repository changes; this artifact is the Phase 20 research output.
- Trust current `.planning/*` for active constraints; update only canonical documentation owners.
- Canonical local verification URL is `http://localhost:8080/...`.
- Preserve unrelated dirty worktree changes; do not perform repo-wide cleanup.
- Before editing any function/class/method, run GitNexus impact analysis and report blast radius; warn on HIGH/CRITICAL.
- Before committing, run GitNexus detect-changes and confirm only intended symbols/flows are affected.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | `ready` should require at least one active, eligible player row, while `playback_verified` remains a later browser-evidence state. [ASSUMED] | A different product predicate would change schema fields, API DTOs, and tests. |
| A2 | A normalized current projection plus append-only observation history is preferable if Phase 21 needs health history. [ASSUMED] | More tables than needed could increase migration and read complexity; planner should keep Phase 20 minimal. |
| A3 | The existing route cache can return source-bearing stale detail unless source revision is included or invalidation is added. [ASSUMED] | If cache middleware already varies on source mutation elsewhere, planned invalidation may be redundant. |

## Open Questions

1. **What exactly makes a player eligible?** The schema has `isActive`, but source-type and URL eligibility rules are not centralized in the current code. Phase 20 should lock one predicate and leave network health probing to Phase 21.
2. **Should source summary live on `movie` or in a dedicated current projection?** Favor the smallest migration that preserves future observation history and avoids adding a second content identity.
3. **Which source-write failure codes are stable enough for the v1 DTO?** Use bounded server-owned codes, not raw exception text or provider secrets.
4. **How should the existing detail cache be invalidated after a crawler sync?** Verify middleware behavior and add a source revision/cache test before planning the migration task.

## Sources

### Primary: repository evidence (HIGH confidence)

- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, and existing `.planning/research/SUMMARY.md` for locked milestone scope and requirements.
- `packages/db/src/schema.ts`, `packages/db/drizzle/0027_crawler_task_domain_foundation.sql`, and `packages/db/MIGRATION.md` for D1/Drizzle schema and migration seams.
- `apps/api/src/domain/crawler-tasks/{types,receipt-validation,repository}.ts` and related tests for receipt identity and terminal persistence.
- `apps/api/src/routes/{admin/crawler-tasks,admin/sync,public/movies,movies}` for task/detail/sync read-write boundaries.
- `apps/movie-app/src/views/{MovieDetail,Player}.vue`, `src/utils/playbackSources.ts`, and focused tests for client/player behavior.
- `packages/crawler/src/lib/strategy.ts` and `test/optimized-crawler.test.ts` for crawler payload shape.

### External research

None used. Web search, MCP research providers, and external fetches were intentionally skipped per phase scope. Any general recommendation not directly proven by repository evidence is marked `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Current code seams: HIGH - directly inspected local source and tests.
- Schema/migration implications: HIGH for existing process; MEDIUM for the new projection choice.
- Recommended readiness predicate: MEDIUM - product contract is inferred from SRC-01/SRC-03 and requires planner/user confirmation if a different eligibility rule is desired.

**Research date:** 2026-08-05
**Valid until:** 2026-09-04 for stable repository seams; recheck package versions if implementation is delayed.
