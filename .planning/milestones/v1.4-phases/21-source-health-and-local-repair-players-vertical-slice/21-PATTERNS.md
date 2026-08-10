# Phase 21: Source Health And Local repair_players Vertical Slice - Pattern Map

**Mapped:** 2026-08-06
**Files analyzed:** 34 planned production/test/verification files
**Analogs found:** 34 / 34 (31 exact extensions, 3 role-match analogs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/db/src/schema.ts` | model/schema | CRUD/persistence | `packages/db/src/schema.ts:186-222,353-477` | exact extension |
| `packages/db/drizzle/0030_source_health_repair.sql` | migration | batch/persistence | `packages/db/drizzle/0029_source_contract_receipt_boundary.sql:1-18` | exact extension |
| `packages/db/src/__tests__/source-health-repair-migration.test.ts` | test | batch/persistence | `packages/db/src/__tests__/crawler-provider-association-migration.test.ts:6-115` | role-match |
| `apps/api/src/domain/movies/source-contract.ts` | utility/model | transform/request-response | same file `:1-258` | exact extension |
| `apps/api/src/domain/movies/source-reconciliation.ts` | service | CRUD/readback | same file `:1-202` | exact extension |
| `apps/api/src/domain/movies/__tests__/source-contract.test.ts` | test | transform | same file `:13-156` | exact extension |
| `apps/api/src/domain/movies/__tests__/source-reconciliation.test.ts` | test | CRUD/readback | `apps/api/src/routes/movies/__tests__/services/sync.service.test.ts:229-366` | role-match; new exact file |
| `apps/api/src/routes/movies/__tests__/services/sync.service.test.ts` | test | CRUD/readback | same file `:229-366` | exact extension |
| `apps/api/src/domain/crawler-tasks/types.ts` | model/contract | event-driven/request-response | same file `:41-205` | exact extension |
| `apps/api/src/schemas/crawler-tasks.ts` | config/validation | request-response | same file `:1-38` | exact extension |
| `apps/api/src/domain/crawler-tasks/template-registry.ts` | registry | transform/dispatch | same file `:7-32` | exact extension |
| `apps/api/src/domain/crawler-tasks/receipt-validation.ts` | service | CRUD/readback | same file `:77-186` | exact extension |
| `apps/api/src/domain/crawler-tasks/repository.ts` | repository/service | CRUD/event-driven | same file `:761-1134,1238-1330` | exact extension |
| `apps/api/src/domain/crawler-tasks/state-machine.ts` | utility/state machine | event-driven | same file `:31-155` | exact extension |
| `apps/api/src/routes/admin/crawler-tasks/index.ts` | route/controller | request-response | same file `:255-447` | exact extension |
| `apps/api/src/routes/internal/crawler-runs/index.ts` | route/controller | event-driven/request-response | same file `:101-350` | exact extension |
| `apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts` | test | CRUD/readback | same file `:88-248` | exact extension |
| `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts` | test | CRUD/event-driven | same file `:152-409` | exact extension |
| `apps/api/src/domain/crawler-tasks/__tests__/state-machine.test.ts` | test | event-driven | same file `:19-214` | exact extension |
| `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` | test | request-response | same file `:64-231` | exact extension |
| `apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts` | test | event-driven | same file `:141-360` | exact extension |
| `packages/crawler/src/task-runner/repair-adapter.ts` | adapter/service | request-response/file-I/O | `packages/crawler/src/task-runner/movie-adapter.ts:6-25` + `controlled-adapter.ts:3-16` | role-match; new exact file |
| `packages/crawler/src/task-runner/template-adapters.ts` | registry/adapter contract | transform/dispatch | same file `:3-32` | exact extension |
| `packages/crawler/src/task-runner/local-runner.ts` | runner/controller | event-driven/request-response | same file `:23-88` | exact extension |
| `packages/crawler/src/task-runner/runner-client.ts` | client | signed request-response | same file `:25-121` | exact extension |
| `packages/crawler/src/task-runner/__tests__/local-runner.test.ts` | test | event-driven | same file `:12-68` | exact extension |
| `packages/crawler/src/task-runner/__tests__/template-adapters.test.ts` | test | transform/dispatch | same file `:5-18` | exact extension |
| `packages/crawler/src/task-runner/__tests__/runner-client.test.ts` | test | signed request-response | same file `:4-12` | exact extension |
| `apps/dashboard/src/lib/api.ts` | client/contract | request-response | same file `:197-320,523-560` | exact extension |
| `apps/dashboard/src/views/Crawlers.vue` | component | request-response/polling | same file `:1-260,496-606` | exact extension |
| `apps/dashboard/src/views/__test__/Crawlers.test.ts` | test | request-response/polling | same file `:32-282` | exact extension |
| `apps/movie-app/src/views/MovieDetail.vue` | component | request-response/informational | same file `:21-124,735-872` | exact extension |
| `apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts` | test | request-response/informational | same file `:108-193` | exact extension |
| `scripts/local-task-runner.e2e.ts` | verification harness | request-response/e2e | same file `:7-261` | exact extension |

## Pattern Assignments

### Database And Source Projection

#### `packages/db/src/schema.ts` (model/schema, CRUD/persistence)

**Analog:** Extend the existing source projection and crawler lifecycle tables in `packages/db/src/schema.ts`.

**Schema pattern** (lines 186-201):

```typescript
export const movieSourceStates = sqliteTable('movie_source_state', {
  movieId: text('movie_id').primaryKey().references(() => movies.id, { onDelete: 'cascade' }),
  sourceRevision: integer('source_revision').notNull().default(0),
  disposition: text('disposition', { enum: ['ready', 'no_source', 'source_failed', 'repairing'] }).notNull(),
  eligibleCount: integer('eligible_count').notNull().default(0),
  repairable: integer('repairable', { mode: 'boolean' }).notNull().default(true),
  reasonCode: text('reason_code', { enum: [...] }),
  observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
}, table => [index('idx_movie_source_state_disposition').on(table.disposition)])
```

Add the observation fact and operation binding additively. Keep `movie_source_state` as the current projection, use foreign keys/indexes, and preserve `templateKey: movie` permission compatibility if operation is normalized. Add matching `relations()` entries; the existing relation pattern is `movieRelations` -> `sourceState` at lines 656-668 and `crawlerRunRelations` -> lifecycle children at lines 723-768.

**Crawler lifecycle columns to preserve** (lines 354-398, 461-474): `requestSnapshotJson` is server-owned immutable input; `stateVersion`/`lastEventSequence` guard CAS transitions; receipt fields are bounded indexed facts; runner event identity is unique by `(runId,eventId)` and `(runId,nonce)`.

#### `packages/db/drizzle/0030_source_health_repair.sql` (migration, batch/persistence)

**Analog:** `packages/db/drizzle/0029_source_contract_receipt_boundary.sql:1-18`.

```sql
ALTER TABLE `crawler_run` ADD `receipt_schema_version` integer;
--> statement-breakpoint
CREATE TABLE `movie_source_state` (...);
--> statement-breakpoint
CREATE INDEX `idx_movie_source_state_disposition` ON `movie_source_state` (`disposition`);
```

Use additive statements separated by `--> statement-breakpoint`. The migration must contain only bounded schema facts and no raw URL, page, exception, token, private key, or signed material. If adding a normalized operation column, update the Drizzle schema and migration together.

#### `packages/db/src/__tests__/source-health-repair-migration.test.ts` (test, batch/persistence)

**Analog:** `packages/db/src/__tests__/crawler-provider-association-migration.test.ts:6-21,63-115`.

```typescript
const migration = await readFile(
  fileURLToPath(new URL('../../drizzle/0028_crawler_provider_association.sql', import.meta.url)),
  'utf8',
)
const statements = migration.split('--> statement-breakpoint').map(statement => statement.trim()).filter(Boolean)
await client.batch(statements.map(sql => ({ sql })), 'write')
```

Copy the in-memory `@libsql/client` harness. Assert observation/fact/current-projection columns, foreign keys and unique indexes with `PRAGMA table_info`/`PRAGMA index_list`; assert migration text excludes sensitive sentinel words as the analog does at lines 90-91.

#### `apps/api/src/domain/movies/source-contract.ts` (utility/model, transform/request-response)

**Analog:** Existing bounded readiness contract, especially `isEligiblePlayer` and `deriveSourceReadiness` at lines 96-157 and server projection at lines 237-258.

```typescript
export function isEligiblePlayer(candidate: SourceCandidate): boolean {
  return candidate.isActive === true
    && typeof candidate.sourceUrl === 'string'
    && candidate.sourceUrl.trim().length > 0
}

export function deriveSourceReadiness(input: SourceReadinessInput): SourceReadinessProjection {
  const eligibleCount = input.candidates.filter(isEligiblePlayer).length
  if (input.failure) return { disposition: 'source_failed', eligibleCount, ... }
  if (input.repairRequested) return { disposition: 'repairing', eligibleCount, ... }
  if (eligibleCount === 0) return { disposition: 'no_source', eligibleCount, ... }
  return { disposition: 'ready', eligibleCount, ... }
}
```

Extend this boundary with `SourceType`, `SourceHealth`, bounded reason allowlists, and a per-source DTO. Keep inactive rows in the projection, but reuse one server-side eligible predicate for counts/actions. Classify magnet as `unverified`; do not infer browser playback from source health. Preserve `createServerReadinessProjection` as the redaction/metadata/source/playback layering boundary.

#### `apps/api/src/domain/movies/source-reconciliation.ts` (service, CRUD/readback)

**Analog:** Existing write -> readback -> derive -> persist flow at lines 138-200.

```typescript
const sourceRevision = input.players === undefined ? previousRevision : previousRevision + 1
...
await input.db.delete(players).where(eq(players.movieId, input.movieId))
...
const readback = await readPlayers(input.db, input.movieId)
const source = deriveSourceReadiness({ candidates: asCandidates(readback), ... })
if (input.players !== undefined)
  await persistState(input.db, input.movieId, source, observedAtDate)
return { source }
```

Add observation acceptance here or in a narrowly owned service beside it. Require movie ID, operation, run ID, attempt and source revision to match the immutable task snapshot before mutation. Persist an append-only bounded observation fact and atomically update the current projection; then read back the same movie/source revision and return only the bounded DTO. Keep raw source materials inside this service boundary and map failures through `failureProjection` (lines 63-70, 192-200).

#### `apps/api/src/domain/movies/__tests__/source-contract.test.ts` (test, transform)

**Analog:** Existing table-driven eligibility and redaction tests at lines 45-82, identity mapping at lines 95-139, and independent playback proof at lines 84-92.

```typescript
it.each([
  { candidates: [], name: 'empty players' },
  { candidates: [{ isActive: false, sourceUrl: 'source-a' }], name: 'inactive players' },
  { candidates: [{ isActive: true, sourceUrl: '   ' }], name: 'blank sourceUrl' },
])('$name is repairable no_source', ({ candidates }) => { ... })
```

Add direct/magnet/TorrServer classification, magnet `unverified`, inactive visibility, bounded failed reasons, and same movie/source revision readback assertions. Continue asserting raw exception/token sentinels are absent and playback remains independent.

#### `apps/api/src/domain/movies/__tests__/source-reconciliation.test.ts` (test, CRUD/readback)

**Analog:** `apps/api/src/routes/movies/__tests__/services/sync.service.test.ts:229-366`; no exact file currently exists.

Reuse its stateful fake DB shape and test names for empty players, duplicate/trimmed sources, write failure, readback failure, and bounded output. Add accepted observation, stale source revision/CAS rejection, append/current projection, and authoritative same-movie readback tests. Keep this new test focused on the service boundary rather than raw runner output.

#### `apps/api/src/routes/movies/__tests__/services/sync.service.test.ts` (test, CRUD/readback)

**Analog:** Existing source integration tests at lines 230-366.

```typescript
it('players 写入失败时保留 metadata success并返回 bounded source_failed', async () => { ... })
it('post-write readback failure returns bounded source_failed without raw error', async () => { ... })
```

Preserve the existing sync regression suite when changing reconciliation internals. Extend fixtures with active, inactive and blank rows; assert inactive rows are displayed but excluded from `eligibleCount`.

### API Task Contracts And Routes

#### `apps/api/src/domain/crawler-tasks/types.ts` (model/contract, event-driven/request-response)

**Analog:** Snapshot/read-model/receipt unions at lines 41-46, 95-126, 150-182 and stale decisions at lines 184-205.

```typescript
export interface CrawlerTaskSnapshot {
  readonly entrypoint: 'movie-crawler' | 'manga-crawler'
  readonly permissionResource: CrawlerPermissionResource
  readonly templateKey: CrawlerTaskTemplateKey
  readonly templateVersion: 1
}

export interface CrawlerRunReceiptCandidate {
  readonly contentIds: readonly string[]
  readonly templateKey: CrawlerTaskTemplateKey
}
```

Add a discriminated `operation: 'repair_players'` snapshot union bound to one `movieId`, `reason`, fixed `targetIntent`, and `sourceRevision`. Add a separate repair receipt version/union containing operation, movie ID, source revision, observedAt, and bounded source summary. Do not make ordinary `contentIds/templateKey` receipts prove repair success. Extend runner event types only where the state machine can validate the discriminator.

#### `apps/api/src/schemas/crawler-tasks.ts` (config/validation, request-response)

**Analog:** Strict Valibot request schemas at lines 3-36.

```typescript
export const CreateCrawlerTaskSchema = v.strictObject({
  template: v.picklist(['movie', 'manga']),
})
export const RetryCrawlerTaskSchema = v.strictObject({ confirmed: v.literal(true) })
```

Add a strict `repair-players` schema allowing only canonical movie identity, `reason` in `no_source|source_failed`, and literal `restore_playable_sources`. Reject URL, command, workflow, target, secret, and extra fields before repository mutation. Keep retry confirmation literal and bounded identifiers.

#### `apps/api/src/domain/crawler-tasks/template-registry.ts` (registry, transform/dispatch)

**Analog:** Closed template registry and frozen snapshot at lines 7-32.

```typescript
export const crawlerTaskTemplates = {
  manga: { entrypoint: 'manga-crawler', permissionResource: 'comic', templateKey: 'manga', templateVersion: 1 },
  movie: { entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 },
} as const satisfies Record<CrawlerTaskTemplateKey, CrawlerTaskTemplate>

export function createCrawlerTaskSnapshot(templateKey: CrawlerTaskTemplateKey) {
  return Object.freeze({ ...getCrawlerTaskTemplate(templateKey) })
}
```

Keep ordinary movie/manga templates closed. Add a separate operation registry or operation branch that validates operation/version/entrypoint/server-owned target before selecting `repair_players`; missing or mismatched operation must fail closed. Do not let `templateKey: movie` silently select the normal movie adapter for repair.

#### `apps/api/src/domain/crawler-tasks/receipt-validation.ts` (service, CRUD/readback)

**Analog:** API-owned receipt revalidation at lines 121-163 and source readback at lines 77-119.

```typescript
if (!candidate || candidate.templateKey !== input.templateKey)
  return missing()
const ids = candidateIds(candidate)
if (ids.length === 0)
  return missing()
...
const source = await readMovieSource(input.database, row.id)
return { ok: true, receipt: { primaryContentId: row.id, source, templateKey: input.templateKey, ... } }
```

Branch repair receipt validation by discriminator. Verify operation, one canonical movie ID, source revision, observation timestamp and bounded source summary against the persisted observation/readback. Return a sanitized receipt derived from D1; ordinary movie receipt validation stays unchanged. Use `safeCount`, `safeTimestamp`, `safeRevision`, deduplicated bounded IDs and `missing()` for invalid candidates.

#### `apps/api/src/domain/crawler-tasks/repository.ts` (repository/service, CRUD/event-driven)

**Analog:** Atomic task/run/snapshot creation at lines 761-826; transition CAS and safe receipt persistence at lines 865-999; replay/attempt binding at lines 1238-1330; manual retry at lines 1069-1134.

```typescript
const snapshot = createCrawlerTaskSnapshot(input.templateKey)
await d1.batch([
  d1.prepare(`INSERT INTO crawler_task (... request_snapshot_json, ...) VALUES (?, ...)`).bind(..., JSON.stringify(snapshot), ...),
  d1.prepare(`INSERT INTO crawler_run (... attempt_number, status, state_version, last_event_sequence, ...) VALUES (?, ?, 1, 'queued', 0, 0, ...)`).bind(...),
])
```

Repair creation must write one movie-bound immutable snapshot, source revision and task/run/lease rows in one batch. Re-read current disposition/revision before creation and again before manual retry. Reuse `findRunnerEvent`, `recordRunnerEvent`, `attempt_mismatch`, duplicate/conflict outcomes, state-version/sequence CAS, and safe transition audit rows. Auto-retry only an explicit transient set once; deterministic contract/source failures terminate. Persist the repair receipt only after observation write plus authoritative readback.

#### `apps/api/src/domain/crawler-tasks/state-machine.ts` (utility/state machine, event-driven)

**Analog:** Retry gating and lifecycle transition matrix at lines 31-45 and 90-153.

```typescript
export function createManualRetryAttempt(input: {...}) {
  if (input.status !== 'failed' && input.status !== 'cancelled')
    throw new Error('Only failed or cancelled runs may be retried')
  return { attemptNumber: input.attemptNumber + 1, snapshot: input.snapshot, status: 'queued' as const }
}
```

Extend transitions with operation-aware receipt validation and bounded retryable failure outcomes. Preserve stale/out-of-sequence results, terminal-state rejection, cancel race semantics, and the existing distinction between automatic attempt retry and manual new-task retry.

#### `apps/api/src/routes/admin/crawler-tasks/index.ts` (route/controller, request-response)

**Analog:** Session/resource guard and task mutation at lines 255-323; safe detail projection at lines 113-248; cancel/retry routes at lines 409-447.

```typescript
async function requireSessionUser(c: ...): Promise<SessionUser> {
  const session = await c.get('auth')?.api?.getSession({ headers: c.req.raw.headers })
  if (!session?.user) throw new HTTPException(401, { message: 'Unauthorized: Please login first' })
  return session.user as SessionUser
}

adminCrawlerTasksRoutes.post('/', validator('json', CreateCrawlerTaskSchema), async (c) => {
  const user = await requireSessionUser(c)
  requireTemplateAccess(user, template)
  const result = await repository.createOrGetActiveRun(...)
  return c.json({ dispatch, kind: result.kind, run: result.run, template })
})
```

Add `POST /api/admin/crawler-tasks/repair-players` with a strict validator, session/resource/movie access check, current canonical disposition/revision re-read, fixed intent, and server-owned snapshot/registry selection. Confirmed Dashboard input is the only client material. Return bounded task/run/readiness data; use `projectReceipt`, `projectReadiness`, and `projectRun` patterns to omit raw runner fields. Invalidate API detail and Gateway movies cache after accepted observation/readback.

#### `apps/api/src/routes/internal/crawler-runs/index.ts` (route/controller, event-driven/request-response)

**Analog:** Signed envelope verification at lines 101-128; poll/claim identity binding at lines 130-197; lifecycle event validation and repository handoff at lines 299-350.

```typescript
const signature = await verifyRunnerEventSignature({ body: rawBody, keyId: c.req.header('x-runner-key-id') ?? '', keys, now: currentNow, signature: c.req.header('x-runner-signature') ?? '' })
if (!signature.valid) throw new HTTPException(401, { message: 'Invalid runner signature' })
...
if (event.key_id !== signature.keyId || event.run_id !== c.req.param('runId'))
  throw new HTTPException(400, { message: 'Runner event identity mismatch' })
```

Keep raw-body hashing and `verifyRunnerEventSignature`; bind callback path, run ID, attempt, sequence, event ID, nonce and source revision. Poll must return only an API-owned snapshot. For repair terminal events, validate operation-specific receipt/readback before `processRunnerEvent`; exact duplicate returns stored outcome, conflicting replay returns 409, stale/attempt mismatch is controlled and does not mutate source state.

#### Route/repository test files

Use existing test harnesses as follows:

- `apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts:88-205`: fake D1 `Statement`, movie/source-state rows, canonical identity readback, no raw URL/error assertions. Add repair receipt/ordinary receipt rejection and bounded summary tests.
- `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts:152-236,270-409`: real in-memory LibSQL migration harness, atomic create, CAS stale audit, exact replay/conflict, attempt mismatch, validated receipt persistence, and manual retry. Add source revision conflict and one transient attempt tests.
- `apps/api/src/domain/crawler-tasks/__tests__/state-machine.test.ts:19-65,158-186`: closed snapshot, retry gate, stale/out-of-sequence transition assertions.
- `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts:32-108,168-231`: Hono app with mocked session/DB/repository; assert 401/403, strict extra-field rejection, and safe projection. Add exact repair path, current reason/revision gate, fixed intent, and no URL/command/workflow/secret fields.
- `apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts:141-249,251-360`: signed requests, fresh timestamp, path/body/attempt binding, duplicate/conflict replay, and terminal receipt requirements. Add operation/source-revision mismatch cases.

### Local Crawler Runner

#### `packages/crawler/src/task-runner/repair-adapter.ts` (adapter/service, request-response/file-I/O)

**Analog:** `movie-adapter.ts:6-25` for checkpoint/execute/test injection and `controlled-adapter.ts:3-16` for cooperative checkpoint behavior. No exact repair adapter exists.

```typescript
return {
  templateKey: 'movie',
  async execute(context) {
    if (await context.checkpoint()) return { contentIds: [] }
    if (execute) return execute(context)
    ...
    return { contentIds: [...contentIds] }
  },
}
```

The new adapter must inspect and validate `operation: repair_players`, one movie identity, source revision and server-owned target. It should call the controlled source-observation API/client boundary, never write D1 directly and never return raw URL/page/exception material. It should return a repair receipt payload for `RunnerClient`, with server readback authoritative before success. Keep cancellation at checkpoint boundaries and test execution with injected fetch/fixture callbacks.

#### `packages/crawler/src/task-runner/template-adapters.ts` (registry/adapter contract, transform/dispatch)

**Analog:** Registry validation and fail-closed lookup at lines 18-31.

```typescript
select(snapshot) {
  if ((snapshot.templateKey === 'movie' && snapshot.entrypoint !== 'movie-crawler') ...)
    throw new Error('Runner snapshot entrypoint does not match its template')
  const adapter = registry.get(snapshot.templateKey)
  if (!adapter) throw new Error(`Unsupported runner template: ${snapshot.templateKey}`)
  return adapter
}
```

Change selection to discriminate operation before template fallback. Validate repair operation/version/entrypoint and select only `repairPlayersAdapter`; ordinary movie/manga behavior remains unchanged. Missing operation must fail closed rather than silently selecting movie.

#### `packages/crawler/src/task-runner/local-runner.ts` (runner/controller, event-driven/request-response)

**Analog:** Serial poll/claim/checkpoint/terminal lifecycle at lines 23-76.

```typescript
if (this.activeRun || this.isPolling) return
const candidate = await this.options.client.poll()
if (!candidate) return
const claim = await this.options.client.claim(candidate)
if (!claim.accepted) return
this.activeRun = candidate
...
const result = await adapter.execute({ candidate, checkpoint, observe })
if (cancelled) await this.options.client.cancelled(candidate, sequence++)
else if (contentIds.size > 0) await this.options.client.succeeded(candidate, sequence++, [...contentIds])
else await this.options.client.failed(candidate, sequence++, 'receipt_missing')
```

Preserve exactly one active run, sequence increments and cooperative cancellation. For repair, terminal success must be driven by the adapter's validated repair receipt/readback result, not `contentIds.size` or process exit. Keep the catch path as a controlled `runner_failed` event and the outer loop retry behavior.

#### `packages/crawler/src/task-runner/runner-client.ts` (client, signed request-response)

**Analog:** Envelope/signing and event methods at lines 25-34, 50-102, 105-120.

```typescript
private async event(candidate, sequence, type, extra = {}) {
  return this.post(`/api/internal/crawler-runs/${candidate.runId}/events`, {
    ...this.controlEnvelope(), ...extra,
    attempt: candidate.attempt, run_id: candidate.runId, sequence, type,
  })
}

private async post(path, payload) {
  const body = JSON.stringify(payload)
  const response = await this.fetch(`${this.config.apiBaseUrl}${path}`, {
    body,
    headers: { 'content-type': 'application/json', 'x-runner-key-id': this.config.callbackKeyId, 'x-runner-signature': signRunnerBody(body, this.config.callbackSecret) },
    method: 'POST', signal: AbortSignal.timeout(this.timeoutMs),
  })
  if (!response.ok) throw new Error(`Runner control request failed: ${response.status}`)
  return response.json()
}
```

Extend `RunnerSnapshot`/candidate parsing for operation-aware repair snapshots and add a dedicated repair receipt envelope. Keep one serialized signed body, Gateway/API base URL configuration, timeout and no browser-visible callback secret.

#### Runner test files

- `packages/crawler/src/task-runner/__tests__/local-runner.test.ts:12-68`: deferred execution proves one active run; heartbeat returning `cancel_requested` proves no success receipt. Add repair selection, readback failure, success receipt handoff, missing-operation fail-closed and cancellation tests.
- `packages/crawler/src/task-runner/__tests__/template-adapters.test.ts:5-18`: matching entrypoint and unsupported registry tests. Add ordinary movie vs repair operation selection and operation mismatch rejection.
- `packages/crawler/src/task-runner/__tests__/runner-client.test.ts:4-12`: signed serialized poll request with mocked fetch. Add repair event body assertions and ensure raw source material is absent from terminal envelope.

### Dashboard And MovieDetail

#### `apps/dashboard/src/lib/api.ts` (client/contract, request-response)

**Analog:** Typed crawler DTOs at lines 197-320 and wrapper methods at lines 523-560.

```typescript
createCrawlerTask: (template: CrawlerTaskTemplate) =>
  apiFetch<{ kind: 'created' | 'existing_active_run', template: CrawlerTaskTemplate, run: CrawlerRun }>('/admin/crawler-tasks', {
    method: 'POST', body: JSON.stringify({ template }),
  }),
getCrawlerTask: (taskId: string) => apiFetch<CrawlerTaskDetail>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}`),
retryCrawlerRun: (...) => apiFetch(..., { method: 'POST', body: JSON.stringify({ confirmed: true }) }),
```

Add typed source-health rows, repair command input/output, operation/receipt union and bounded failure fields. The wrapper should send only movie identity/current reason/fixed intent after confirmation; encode IDs; use Gateway-relative `/admin/...` paths; never expose callback secrets or arbitrary command/url/workflow fields.

#### `apps/dashboard/src/views/Crawlers.vue` (component, request-response/polling)

**Analog:** State, visibility-aware polling and confirmation at lines 24-37, 124-195, 197-260; bounded readiness UI at lines 496-582.

```typescript
function startTaskPolling(): void {
  stopTaskPolling()
  if (document.visibilityState === 'visible') {
    void loadTaskPanel()
    taskRefreshInterval = setInterval(() => void loadTaskPanel(), 5000)
  }
}
...
function askRetry(task, run) { pendingAction.value = { task, run }; retryConfirmOpen.value = true }
```

Add the single-movie repair entry from a bounded readiness row. Show source type/health/observedAt/bounded reason, attempt and allowed next action; keep inactive rows visible but do not make them eligible. Require second confirmation before mutation, refresh task/readback after accepted command, and preserve raw runner output exclusion. Reuse `ConfirmDialog`, `useResourceGuard`, `info/success`, visible-only polling and HSL design tokens.

#### `apps/dashboard/src/views/__test__/Crawlers.test.ts` (test, request-response/polling)

**Analog:** Mocked API/resource guard harness at lines 5-56; fixed-input and polling tests at lines 58-126; readiness/redaction tests at lines 183-281.

```typescript
expect(wrapper.find('input[type="url"]').exists()).toBe(false)
expect(wrapper.find('textarea').exists()).toBe(false)
...
expect(rendered).not.toContain('rawRunnerField')
expect(rendered).not.toContain('https://source.example')
```

Add tests for second confirmation, exact repair request fields, movie identity/source revision, source type health rows including inactive/magnet/unverified, bounded failed reasons, attempt/observedAt polling, and no arbitrary URL/command/workflow/secret inputs.

#### `apps/movie-app/src/views/MovieDetail.vue` (component, request-response/informational)

**Analog:** Existing readiness-only boundary at lines 112-124 and 735-872.

```typescript
function showRepairIntent() {
  if (!readiness.value?.source.repairable) return
  showToast('当前来源状态可由受控修复任务处理')
}
```

Keep MovieDetail informational: display source health/readiness and route/link to Dashboard repair/task state if needed, but do not call the admin repair mutation here. Preserve independent `ready`, source health and browser playback proof. Do not show playback source actions when readiness is not ready; preserve current data attributes and status roles for DOM tests.

#### `apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts` (test, request-response/informational)

**Analog:** Existing DTO-only state/action contract at lines 108-193.

```typescript
expect(summary.text()).toContain('查看修复意图')
expect(summary.text()).toContain('重试读取')
expect(wrapper.text()).not.toContain('▶️ 播放')
```

Assert source type/health/bounded reason rendering and Dashboard handoff only. Add a spy/assertion that no direct admin mutation client is called from MovieDetail; keep `repairing` disabled refresh and independent playback labels.

### Verification And Cache Boundary

#### `scripts/local-task-runner.e2e.ts` (verification harness, request-response/e2e)

**Analog:** Existing canonical Gateway harness at lines 7-25, 116-150, 156-218 and cancellation proof at lines 221-261.

```typescript
const LOCAL_GATEWAY_ORIGIN = 'http://localhost:8080'
async function requestJson<T>(session, path, init = {}) {
  const response = await fetch(`${LOCAL_GATEWAY_ORIGIN}${path}`, { ...init, headers: { accept: 'application/json', cookie: session.cookieHeader, ...init.headers } })
  if (!response.ok) throw new Error(`Local Gateway request failed: ${response.status}`)
  return response.json() as Promise<T>
}
```

Extend the harness with the SUN-064/no-source repair fixture: POST through `/api/admin/crawler-tasks/repair-players`, run the local repair adapter, poll the same task/run, verify repair receipt -> source observation -> same movie readback and fresh source health through the Gateway. Keep session cookie, runner config and callback secret in ignored files; do not print them or raw runner/source material in evidence. Preserve local-only URL checks and evidence status distinction.

Use `pnpm dev:clean` to start the stack and `pnpm local:task-runner:e2e --target local --template movie --evidence-dir TARGET` for the vertical proof. The canonical proof URL is always `http://localhost:8080/...`; direct API/Vite ports are implementation targets only.

#### Gateway cache analogs (read-only references)

Use `apps/api/src/lib/gateway-cache.ts:32-60` for `clearGatewayCacheGroup(kv, 'movies')`, and `apps/gateway/src/__tests__/cache-consistency.e2e.test.ts:47-76` for stale HIT -> group clear -> fresh MISS/readback. The repair success path must invalidate API detail/cache state and the Gateway movies group before asserting the same movie identity through Gateway.

## Shared Patterns

### Server-Owned And Redacted Boundaries

**Sources:** `source-contract.ts:102-111,237-258`, `receipt-validation.ts:121-163`, `admin/crawler-tasks/index.ts:113-242`, `internal/crawler-runs/index.ts:317-349`.

- Accept allowlisted DTOs; reject extra executable/secret-shaped fields with strict Valibot schemas.
- Derive readiness/health/receipt fields from persisted D1 facts, never from runner logs or raw input.
- Keep bounded reason codes, source type/health, attempt, observedAt, source revision and allowed next action; omit raw URLs, page content, exception text, callback signature and secrets.
- Test with sentinel values such as `rawRunnerField`, `source.example`, `token=hidden`, and assert they are absent from every public response/evidence receipt.

### Identity, Revision And Replay

**Sources:** `repository.ts:1238-1330`, `internal/crawler-runs/index.ts:152-197,299-350`, `schema.ts:373-474`.

Bind every repair mutation and callback to one movie ID, task ID, run ID, attempt, sequence, event ID, nonce and source revision. Exact duplicate replay returns the stored outcome. Different body/event identity, stale attempt, wrong sequence or source revision conflict becomes duplicate/conflict/stale without applying a newer source mutation.

### Retry Separation

**Sources:** `state-machine.ts:31-45`, `repository.ts:1069-1134`, research D-14/D-15.

Automatic retry is one additional attempt only for an explicit transient execution/write/readback classification. Deterministic contract, input and source-state failures terminate. Manual retry creates a new task after current disposition/source revision re-read. Transport retry reuses event identity.

### Focused Verification Commands

Use the package scripts already present:

```powershell
pnpm --filter api exec vitest run src/domain/movies/__tests__/source-contract.test.ts src/domain/movies/__tests__/source-reconciliation.test.ts src/domain/crawler-tasks/__tests__/receipt-validation.test.ts src/domain/crawler-tasks/__tests__/repository.test.ts src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts
pnpm --filter @starye/crawler exec vitest run src/task-runner/__tests__/local-runner.test.ts src/task-runner/__tests__/template-adapters.test.ts src/task-runner/__tests__/runner-client.test.ts
pnpm --filter dashboard exec vitest run src/views/__test__/Crawlers.test.ts
pnpm --filter @starye/movie-app exec vitest run src/views/__tests__/MovieDetail.dom-contract.test.ts
pnpm --filter @starye/db exec vitest run src/__tests__/source-health-repair-migration.test.ts
pnpm --filter api type-check
pnpm --filter @starye/crawler type-check
pnpm --filter dashboard type-check
pnpm --filter @starye/movie-app exec vue-tsc --noEmit
pnpm --filter @starye/db type-check
pnpm dev:clean
pnpm local:task-runner:e2e --target local --template movie --evidence-dir TARGET
```

For focused tests run from the package directory when the workspace filter does not resolve path aliases. Before final phase commit, follow AGENTS.md and run GitNexus detect-changes; this pattern artifact itself does not modify product symbols.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/api/src/domain/movies/__tests__/source-reconciliation.test.ts` | test | CRUD/readback | No dedicated source-reconciliation test file exists; use the sync service fake DB and source-contract tests. |
| `packages/crawler/src/task-runner/repair-adapter.ts` | adapter/service | request-response/file-I/O | No operation-discriminated repair adapter exists; compose the checkpoint/injection shape from movie and controlled adapters, with the new controlled observation API as the contract. |

## Metadata

**Analog search scope:** `packages/db`, `apps/api/src/domain`, `apps/api/src/routes`, `apps/api/src/schemas`, `packages/crawler/src/task-runner`, `apps/dashboard/src`, `apps/movie-app/src`, `apps/gateway/src`, `scripts`, and focused test directories.
**Files scanned:** 38 source/test files plus phase context/research and project instruction/skill files.
**Pattern extraction date:** 2026-08-06
**Implementation note:** Names/fields marked as new in research are recommendations; preserve locked D-01 through D-16 semantics if the planner chooses a nearby existing seam.
