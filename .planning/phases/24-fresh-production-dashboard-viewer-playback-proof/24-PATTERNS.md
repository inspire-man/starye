# Phase 24: Fresh Production Dashboard -> Viewer -> Playback Proof - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 28 likely new/modified files
**Analogs found:** 26 / 28 (17 exact, 9 role-match; 5 of the role matches are partial only)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/db/src/schema.ts` | model/config | CRUD + CAS persistence | `packages/db/src/schema.ts` crawler tables | exact |
| `packages/db/drizzle/00xx_playback_evidence.sql` | migration | batch/CRUD persistence | `0030_source_health_repair.sql` | exact |
| `packages/db/src/__tests__/playback-evidence-migration.test.ts` | test | CRUD/replay | `source-health-repair-migration.test.ts` | role-match |
| `apps/api/src/schemas/playback-evidence.ts` | model/validation | request-response | `schemas/crawler-tasks.ts` | role-match |
| `apps/api/src/schemas/index.ts` | config/barrel | transform | existing schema barrel | exact |
| `apps/api/src/domain/playback-evidence/types.ts` | model/utility | transform + request-response | `domain/crawler-tasks/types.ts` | role-match |
| `apps/api/src/domain/playback-evidence/redaction.ts` | utility | transform/file-I/O | `scripts/phase19-evidence.ts` | role-match |
| `apps/api/src/domain/playback-evidence/repository.ts` | service | CRUD + CAS + idempotency | `domain/crawler-tasks/repository.ts` | role-match |
| `apps/api/src/domain/playback-evidence/__tests__/playback-evidence.test.ts` | test | transform/CRUD | crawler repository tests | role-match |
| `apps/api/src/domain/crawler-tasks/types.ts` | model | request-response | same file's receipt projections | exact |
| `apps/api/src/domain/crawler-tasks/repository.ts` | service | CRUD + CAS | same repository's task/run methods | exact |
| `apps/api/src/domain/movies/source-contract.ts` | utility/model | transform | same file's `derivePlaybackProof` | exact |
| `apps/api/src/routes/admin/crawler-tasks/index.ts` | controller/route | request-response | existing repair command/detail routes | exact |
| `apps/api/src/routes/admin/crawler-tasks/playback-evidence.ts` | controller/route | request-response | `routes/internal/crawler-runs/index.ts` | role-match; optional split |
| `apps/api/src/index.ts` | route/config | request-response | existing `.route(...)` mount list | role-match; only if new top-level route |
| `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` | test | request-response | same route test | exact |
| `apps/dashboard/src/lib/api.ts` | client/model | request-response | existing crawler API wrappers | exact |
| `apps/dashboard/src/views/Crawlers.vue` | component | polling + request-response | current-attempt task panel | exact |
| `apps/dashboard/src/views/__test__/Crawlers.test.ts` | test | polling/request-response | existing Dashboard tests | exact |
| `apps/movie-app/src/types.ts` | model | request-response | existing `ReadinessProjection` | exact |
| `apps/movie-app/src/views/MovieDetail.vue` | component | request-response/navigation | existing readiness/source cards | exact |
| `apps/movie-app/src/views/Player.vue` | component | streaming + event-driven | existing xgplayer lifecycle | exact |
| `apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts` | test | request-response/navigation | existing DOM contract test | exact |
| `apps/movie-app/src/views/__tests__/Player.security.test.ts` | test | streaming/event-driven | existing Player security tests | exact |
| `apps/movie-app/src/utils/__tests__/playbackSources.test.ts` | test | transform | `playbackSources.ts` tests | exact |
| `scripts/phase24-evidence.ts` | utility/verifier | transform + file-I/O | `scripts/phase19-evidence.ts` | role-match |
| `scripts/phase24-production-proof.ts` | test/verifier | request-response + streaming + file-I/O | `scripts/local-task-runner.e2e.ts` | role-match |

The focused route module, evidence domain split, and exact migration number are discretionary. If evidence POST is added inside `admin/crawler-tasks/index.ts`, omit the focused route and top-level mount rows; retain the same auth and repository patterns.

## Pattern Assignments

### Persistence and domain contracts

**Analog:** `packages/db/src/schema.ts` lines 353-439, 757-794; `packages/db/drizzle/0030_source_health_repair.sql` lines 1-26.

Copy the existing Drizzle shape: typed enum text columns, explicit foreign keys, append-only facts, tuple-oriented unique indexes, and a separate current projection. Add `relations()` for every new foreign key. The migration test should apply SQL to an in-memory client, inspect columns/FKs/indexes, and assert duplicate tuple writes fail, following `packages/db/src/__tests__/source-health-repair-migration.test.ts` lines 15-24 and 46-92.

```typescript
export const movieSourceObservations = sqliteTable('movie_source_observation', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull().references(() => crawlerRuns.id, { onDelete: 'cascade' }),
  sourceRevision: integer('source_revision').notNull(),
}, table => [
  uniqueIndex('idx_movie_source_observation_identity').on(
    table.movieId, table.sourceRevision, table.runId, table.attemptNumber,
  ),
])
```

**Apply to:** `schema.ts`, the generated migration, migration test, and any new evidence model. D1 must store bounded summary/reference; immutable JSON/Markdown originals remain under the explicitly supplied evidence root.

**Analog:** `apps/api/src/domain/crawler-tasks/types.ts` lines 45-102, 183-206, 247-258.

Use literal unions for outcomes and separate projections for provider, receipt validation, source readback, playback, and bounded rejection history. Keep `taskId`, `runId`, `attemptNumber`, provider, `contentId`, and `sourceRevision` explicit in every evidence DTO; do not collapse them into one overall status.

```typescript
export type CrawlerBoundedOutcomeCode
  = 'accepted' | 'contract_failure' | 'duplicate' | 'stale' | 'late' | 'ignored' | 'conflict' | 'receipt_failure'

export interface CrawlerRunReadModel {
  readonly attemptNumber: number
  readonly provider: ProviderAssociationSummary | null
  readonly receipt: CrawlerReceiptUnion | null
  readonly receiptValidation?: CrawlerReceiptValidationProjection | null
  readonly outcome?: CrawlerAttemptOutcomeProjection | null
}
```

**Apply to:** `apps/api/src/domain/playback-evidence/types.ts`, `domain/crawler-tasks/types.ts`, Dashboard API types, and Movie App types. New status vocabulary should preserve `accepted`, `duplicate`, `conflict`, `stale`, `late`, and `checkpoint` semantics instead of inventing generic success.

### Validation, auth, and route boundary

**Analog:** `apps/api/src/schemas/crawler-tasks.ts` lines 1-46; `apps/api/src/routes/admin/crawler-tasks/index.ts` lines 1-22, 974-1012, 1026-1114.

Define a closed Valibot schema first. Bound IDs, integer attempt/revision, finite current times, event count/window, source type, and canonical relative viewer paths. Reject raw URL, cookie, token, signature, workflow, command, raw runner JSON, and media bytes at the boundary.

```typescript
export const CreateRepairPlayersTaskSchema = v.strictObject({
  movieId: MovieIdSchema,
  reason: v.picklist(['no_source', 'source_failed']),
  targetIntent: v.literal('restore_playable_sources'),
})
```

```typescript
async function requireSessionUser(c: { get: (key: 'auth') => any, req: { raw: Request } }): Promise<SessionUser> {
  const session = await c.get('auth')?.api?.getSession({ headers: c.req.raw.headers })
  if (!session?.user)
    throw new HTTPException(401, { message: 'Unauthorized: Please login first' })
  return session.user as SessionUser
}
```

```typescript
adminCrawlerTasksRoutes.post('/repair-players', validator('json', RepairPlayersCommandSchema), async (c) => {
  const user = await requireSessionUser(c)
  requireTemplateAccess(user, 'movie')
  const command = c.req.valid('json')
  // read movie, reject stale disposition, then create server-owned snapshot
})
```

**Apply to:** new evidence schema, evidence POST route, repair command integration, and route tests. The evidence endpoint should reuse the authenticated Gateway cookie and additionally load the task/run/current attempt before calling the repository.

**Tuple-binding analog:** `apps/api/src/routes/internal/crawler-runs/index.ts` lines 372-393 and 480-532. Reuse parse -> identity check -> current attempt/sequence check -> source revision check -> repository transaction. The internal route's `providerSnapshotMatches` (lines 167-178) is the model for server-owned target identity, while `projectRepairObservation` (lines 72-111) is the model for safe response projection.

### Repository and CAS

**Analog:** `apps/api/src/domain/crawler-tasks/repository.ts` lines 1-28, 692-743, 983-1030; `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts` lines 150-180, 558-597, 599-650.

Keep SQL and transaction behavior in a repository, not in the route. Use the existing D1 adapter (`prepare`, `bind`, `all`, `run`, `batch`), server-created IDs, current source revision readback, a unique accepted tuple row, and append-only rejection rows. The accepted path must be one CAS-gated transaction; duplicate payload returns stable `duplicate`, different payload returns `conflict`, and old attempt/revision returns `stale` or `late` without changing current projection.

```typescript
const currentState = await readRepairTaskState(input.movieId)
if (!currentState || currentState.reason !== input.reason)
  throw new Error('repair task source disposition is no longer repairable')

await d1.batch([
  d1.prepare(`INSERT INTO crawler_task (...) VALUES (?, ?, ...)`).bind(...),
  d1.prepare(`INSERT INTO crawler_run (...) VALUES (?, ?, ...)`).bind(...),
])
```

Use the repository tests' deterministic `createId` and `now` injection (lines 157-166), then assert fresh attempt allocation, replay outcomes, current projection immutability, and bounded rejection history.

### Public playback projection

**Analog:** `apps/api/src/domain/movies/source-contract.ts` lines 194-238, 240-274, 318-330.

Keep `derivePlaybackProof` pure and conservative: it should project only validated persisted playback facts. Extend the input contract to require the Phase 24 event gate and one-second delta, while keeping playback separate from source readiness and receipt.

```typescript
export function derivePlaybackProof(evidence: unknown): PlaybackProjection {
  if (!evidence || typeof evidence !== 'object')
    return { status: 'unverified' }
  const candidate = evidence as { currentTime?: unknown, observedAt?: unknown, playing?: unknown }
  if (candidate.playing !== true || typeof candidate.currentTime !== 'number'
    || !Number.isFinite(candidate.currentTime) || candidate.currentTime <= 0)
    return { status: 'unverified' }
  return { evidence: { currentTime: candidate.currentTime }, status: 'playback_verified' }
}
```

### Dashboard client and task detail

**Analog:** `apps/dashboard/src/lib/api.ts` lines 8-21, 280-285, 346-393, 693-735; `apps/dashboard/src/views/Crawlers.vue` lines 173-220, 750-800, 807-840.

Extend the existing typed `apiFetch` wrappers and current-attempt response types. `Crawlers.vue` should select the latest run by `latestRunId`, keep prior attempts as bounded history, preserve same-movie navigation, and render provider, receipt/repair, source revision, playback evidence, artifact reference, and rejection history as separate sections.

```typescript
repairPlayers: (command: CrawlerRepairCommand) =>
  apiFetch<CrawlerRepairTaskResponse>('/admin/crawler-tasks/repair-players', {
    method: 'POST',
    body: JSON.stringify(command),
  }),

getCrawlerTask: (taskId: string) =>
  apiFetch<CrawlerTaskDetail>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}`),
```

The Dashboard must show bounded safe fields only. Follow `apps/dashboard/src/views/__test__/Crawlers.test.ts` lines 88-119 for visibility-aware polling and lines 326-398 / 400-430 for repair command, same-movie link, current attempt, and history assertions. Add assertions that no single overall-success badge is introduced.

### MovieDetail handoff and source policy

**Analog:** `apps/movie-app/src/views/MovieDetail.vue` lines 168-200, 926-997, 1095-1174; `apps/movie-app/src/utils/playbackSources.ts` lines 27-80.

Preserve server readiness/source revision as display facts and route the same movie identity to the existing Player path. Use `selectDirectPlaybackSource` and `isEligiblePlaybackSource`; do not select by score, array position, raw URL, or magnet type. Record the selected source type and source revision through bounded UI markers.

```typescript
export function selectDirectPlaybackSource(sources: readonly Player[]): Player | null {
  return sources.find(source => isEligiblePlaybackSource(source)
    && classifyPlaybackSource(source) === 'direct') ?? null
}
```

```vue
<RouterLink
  v-if="group.key === 'eligible-direct'"
  :to="`/movie/${movie.code}/play?player=${encodeURIComponent(player.id)}`"
  data-source-action="play"
>
  播放
</RouterLink>
```

`MovieDetail.dom-contract.test.ts` lines 109-208 and 210-261 are the verification analog: assert content identity, source revision, independent playback label, visible source type, canonical Player href, repair Dashboard href, and raw-field absence.

### Player event collector and bounded retry

**Analog:** `apps/movie-app/src/views/Player.vue` lines 32-74, 255-334, 495-559, 572-663, 775-805, 871-960; `apps/movie-app/src/views/__tests__/Player.security.test.ts` lines 1-106 and 345-414.

Extend the existing Player lifecycle rather than creating another player instance. Keep `autoplay: false`, collect only allowlisted `canplay`, `playing`, `waiting`, `stalled`, `error` and bounded relative event times, sample `currentTime` before/after visible Play, and submit only a terminal summary. Preserve the current source identity/session token and the two-retry cap.

```typescript
player = new Player({
  id: 'player-container',
  url: normalizedUrl,
  autoplay: false,
  playsinline: true,
})

player.on('canplay', () => markPlaybackRecovered())
player.on('playing', () => markPlaybackRecovered())
player.on('waiting', () => scheduleWaitingTimeout())
player.on('error', () => showPlayerError(getPlaybackErrorState().kind, getPlaybackErrorState().message))
```

The browser proof must click the visible player control and use event-driven bounded waits. It must not call `evaluate().play()`, inject readyState, or infer success from page load/screenshot/HTTP status. Extend Player security tests for event collection, terminal error, progress delta, and no sensitive marker leakage; retain existing retry assertions at lines 345-414.

### Evidence pair and canonical verifier

**Analog:** `scripts/phase19-evidence.ts` lines 23-94; `packages/config/src/deployment-target/data-chain-evidence.ts` lines 64-102 and 894-930; `scripts/local-task-runner.e2e.ts` lines 282-290, 366-373, 468-524, 527-589, 717-750.

`phase24-evidence.ts` should follow artifact-first order: construct closed object, redact, validate schema, scan forbidden keys/values, serialize deterministic JSON, render Markdown from the same object, assert pair stability, then write an immutable tuple-bound stem under the supplied evidence root. D1 receives only bounded summary/hash/reference. Apply the same `passed`/`failed`/`checkpoint` vocabulary and preserve artifacts on D1 failure.

```typescript
const pair = {
  evidence,
  json: serializePhase19EvidenceJson(evidence),
  markdown: renderPhase19EvidenceMarkdown(evidence),
}
assertPairStable(pair)
assertSafeEvidence(JSON.parse(pair.json))
```

```typescript
const serialized = JSON.stringify(evidence)
for (const forbidden of ['cookieHeader', 'callbackSecret', 'sourceUrl', 'rawRunner', 'rawSource', 'signature', 'exception']) {
  assertCondition(!serialized.includes(forbidden), `Repair evidence contains forbidden field: ${forbidden}`)
}
```

`phase24-production-proof.ts` should reuse the local runner's Gateway request shape and fresh command/readback assertions, but add one authenticated Playwright context, Dashboard -> same MovieDetail -> source card -> Player, visible click, media event/time capture, evidence POST, and a machine-readable matrix comparing live UI, D1 summary, JSON, and Markdown. Missing session/target/run allocation/evidence root/browser entry is `checkpoint`; bounded terminal provider/media failure is `failed`.

Use the existing Playwright config shape in `apps/dashboard/playwright.config.ts` lines 4-37 and `apps/movie-app/playwright.config.ts` lines 7-54, but force the canonical `BASE_URL=http://localhost:8080`; direct app ports are not proof origins.

## Shared Patterns

### Authentication and authorization

**Sources:** `apps/api/src/routes/admin/crawler-tasks/index.ts:974-1012`, `apps/dashboard/src/lib/api.ts:8-21`, `scripts/local-task-runner.e2e.ts:282-290`.

Apply the same Gateway session cookie across Dashboard, MovieDetail, Player, and evidence POST. Server loads permissions and tuple facts; client supplies only allowlisted movie identity/reason/intent and bounded terminal playback facts.

### Independent fact layers

**Sources:** `apps/api/src/domain/movies/source-contract.ts:194-274`, `apps/api/src/domain/crawler-tasks/types.ts:183-206`, `apps/dashboard/src/views/Crawlers.vue:888-940`.

Provider association, validated receipt/repair, source revision/readback, and actual playback remain separate DTO fields and UI sections. `playback_verified` is only a matching tuple projection and never rewrites source health or receipt.

### Redaction and deterministic artifacts

**Sources:** `scripts/phase19-evidence.ts:23-94`, `scripts/local-task-runner.e2e.ts:356-373`, `packages/config/src/deployment-target/data-chain-evidence.ts:900-930`.

Only IDs, revisions, status layers, relative paths, allowlisted events, times/delta, and artifact references survive. Scan both JSON and Markdown for raw URL, token, cookie, authorization, signature, workflow/command, runner payload, exception, HTML, and media bytes.

### CAS, replay, and bounded outcomes

**Sources:** `apps/api/src/routes/internal/crawler-runs/index.ts:480-532`, `apps/api/src/domain/crawler-tasks/repository.ts:983-1030`, `packages/db/src/schema.ts:404-439`.

Compare task/run/attempt, content ID, source revision, terminal/readback status, and evidence-window bounds before persistence. Identical replay is `duplicate`; conflicting payload is `conflict`; old/revision-mismatched evidence is `stale`/`late`; rejected submissions are history only.

### Verification implications

- Contract tests: schema closure, finite/bounded times, event allowlist, redaction, deterministic pair.
- D1 tests: migration, foreign keys/indexes, accepted-once, duplicate/conflict, stale/late, unchanged current projection.
- API tests: same authenticated session, task/run access, tuple/content/source revision binding, separate layer projections.
- UI tests: current-attempt focus, bounded history, same-movie path, independent sections, no raw fields or overall-success badge.
- Browser proof: Gateway origin, one session, fresh IDs, visible Play click, `canplay` + `playing`, no terminal `error`, `currentTimeAfter - currentTimeBefore >= 1`, D1/artifact/Dashboard equality.

## No Exact Analog

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/api/src/domain/playback-evidence/types.ts` | model | transform/request-response | No tuple-bound playback evidence contract exists; use crawler type unions as a partial analog. |
| `apps/api/src/domain/playback-evidence/redaction.ts` | utility | transform/file-I/O | Existing redaction is split between scripts and crawler logs; no playback-specific closed DTO. |
| `apps/api/src/domain/playback-evidence/repository.ts` | service | CRUD/CAS/idempotency | Existing repository has crawler/source CAS, but no terminal browser evidence acceptance or rejection history. |
| `scripts/phase24-evidence.ts` | utility/verifier | transform/file-I/O | Phase 19 pair is closest, but Phase 24 adds media events, delta, and D1 reference semantics. |
| `scripts/phase24-production-proof.ts` | test/verifier | request-response/streaming/file-I/O | Existing local runner is API/fixture E2E; no fresh production Dashboard -> Viewer -> visible Play flow exists. |

## Metadata

**Analog search scope:** `apps/api/src/domain`, `apps/api/src/routes`, `apps/api/src/schemas`, `packages/db/src`, `packages/db/drizzle`, `apps/dashboard/src`, `apps/movie-app/src`, `scripts`, Playwright configs, and GitNexus execution-flow queries.
**Files scanned:** 23 strong analog files plus focused tests/configs.
**Pattern extraction date:** 2026-08-08
