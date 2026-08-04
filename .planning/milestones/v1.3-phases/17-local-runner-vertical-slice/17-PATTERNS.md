# Phase 17: Local Runner Vertical Slice - Pattern Map

**Mapped:** 2026-07-30  
**Files analyzed:** 32 planned new/modified files and test suites  
**Analogs found:** 24 / 32 (four new runner concerns and four receipt handoff concerns have only partial/no analogs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/crawler/src/task-runner/event-signer.ts` | utility | transform | `apps/api/src/domain/crawler-tasks/runner-event-auth.ts` | contract-match |
| `packages/crawler/src/task-runner/runner-client.ts` | service | request-response | `packages/crawler/src/utils/api-client.ts` | role-match |
| `packages/crawler/src/task-runner/local-runner.ts` | service / CLI loop | polling, event-driven | `scripts/local-dev.ts` | partial |
| `packages/crawler/src/task-runner/template-adapters.ts` | registry | transform | `apps/api/src/domain/crawler-tasks/template-registry.ts` | exact |
| `packages/crawler/src/task-runner/movie-adapter.ts` | adapter | file-I/O / event-driven | `packages/crawler/src/core/optimized-crawler.ts` | role-match |
| `packages/crawler/src/task-runner/manga-adapter.ts` | adapter | file-I/O / event-driven | `packages/crawler/src/crawlers/comic-crawler.ts` | role-match |
| `packages/crawler/src/task-runner/receipt-candidates.ts` | utility | transform | `packages/crawler/src/utils/api-client.ts` | partial |
| `packages/crawler/src/task-runner/controlled-adapter.ts` | adapter / test fixture | event-driven | — | none |
| `apps/api/src/domain/crawler-tasks/receipt-validation.ts` | service | CRUD / transform | `apps/api/src/domain/crawler-tasks/repository.ts` | partial |
| `apps/api/src/domain/crawler-tasks/types.ts` | model | transform | same file | exact extension |
| `apps/api/src/domain/crawler-tasks/repository.ts` | repository | CRUD / event-driven | same file | exact extension |
| `apps/api/src/schemas/crawler-run-events.ts` | validation | request-response | same file | exact extension |
| `apps/api/src/schemas/crawler-tasks.ts` | validation | request-response | same file | exact extension |
| `apps/api/src/routes/internal/crawler-runs/index.ts` | route / controller | request-response | same file | exact extension |
| `apps/api/src/routes/admin/crawler-tasks/index.ts` | route / controller | CRUD / request-response | same file | exact extension |
| `apps/api/src/routes/admin/comics/index.ts` | route | request-response | `apps/api/src/routes/admin/movies/index.ts` | role-match |
| `apps/api/src/routes/admin/comics/handlers.ts` | controller/service | CRUD | `apps/api/src/routes/admin/movies/index.ts` | role-match |
| `apps/dashboard/src/lib/api.ts` | client service | request-response | same file | exact extension |
| `apps/dashboard/src/views/Crawlers.vue` | component | polling / request-response | same file | exact extension |
| `apps/dashboard/src/views/Movies.vue` | component | CRUD / request-response | same file | exact extension |
| `apps/dashboard/src/views/Comics.vue` | component | CRUD / request-response | same file | exact extension |
| `scripts/local-task-runner.ts` (only if a root CLI wrapper is chosen) | CLI config | batch / process lifecycle | `scripts/local-dev.ts` | partial |
| `packages/crawler/package.json` | config | process launch | same file | exact extension |
| `packages/config/src/deployment-target/__tests__/crawler-source-entry-contract.test.ts` | contract test | static analysis | same file | exact extension |
| `packages/crawler/src/task-runner/__tests__/event-signer.test.ts` | unit test | transform | `apps/api/src/domain/crawler-tasks/__tests__/runner-event-auth.test.ts` | role-match |
| `packages/crawler/src/task-runner/__tests__/runner-client.test.ts` | unit test | request-response | `packages/crawler/src/utils/__tests__/api-client.test.ts` | role-match |
| `packages/crawler/src/task-runner/__tests__/local-runner.test.ts` | unit test | polling / event-driven | `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts` | partial |
| `packages/crawler/src/task-runner/__tests__/template-adapters.test.ts` | unit test | event-driven | `packages/crawler/src/crawlers/__tests__/optimized-crawler.e2e.test.ts` | role-match |
| `apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts` | integration/unit test | CRUD | `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts` | role-match |
| `apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts` | route test | request-response | same file | exact extension |
| `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` | route test | CRUD / request-response | same file | exact extension |
| `apps/dashboard/src/views/__test__/Crawlers.test.ts` | component test | polling / request-response | `apps/dashboard/src/views/__test__/Comics.test.ts` | role-match |
| `apps/dashboard/src/views/__test__/Movies.test.ts`, `apps/dashboard/src/views/__test__/Comics.test.ts` | component test | CRUD / request-response | same files | exact extension |

`apps/api/src/routes/admin/comics/__tests__/comics.route.test.ts` is an implied companion if `GET /admin/comics/:id` is added. Its closest test form is `crawler-tasks.route.test.ts` (Hono app + injected auth/DB doubles), but there is no current comics-route test directory.

## Pattern Assignments

### `packages/crawler/src/task-runner/event-signer.ts` and `runner-client.ts`

**Analogs:** `apps/api/src/domain/crawler-tasks/runner-event-auth.ts`, `apps/api/src/routes/internal/crawler-runs/index.ts`, and `packages/crawler/src/utils/api-client.ts`.

**Exact-byte signing contract** — `apps/api/src/routes/internal/crawler-runs/index.ts:45-75`:

```ts
const rawBody = await c.req.arrayBuffer()
const signature = await verifyRunnerEventSignature({
  body: rawBody,
  keyId: c.req.header('x-runner-key-id') ?? '',
  keys,
  now: currentNow,
  signature: c.req.header('x-runner-signature') ?? '',
})
if (!signature.valid)
  throw new HTTPException(401, { message: 'Invalid runner signature' })

const parsed = v.safeParse(CrawlerRunEventSchema, await new Response(rawBody).json())
if (!parsed.success)
  throw new HTTPException(400, { message: 'Invalid runner event envelope' })
```

The Node client serializes the envelope once, signs the resulting `string`/UTF-8 bytes, and sends that identical value in `body`; never stringify a reconstructed object after signing. Send `content-type`, `x-runner-key-id`, and `x-runner-signature`, matching `crawler-runs.route.test.ts:49-59`.

**Reusable HTTP error boundary** — `packages/crawler/src/utils/api-client.ts:23-68`:

```ts
const response = await fetch(url, {
  method: 'POST',
  headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
  body: JSON.stringify(data),
  signal: AbortSignal.timeout(this.config.timeout || 60000),
})
if (!response.ok) return null
return await response.json()
```

Copy the timeout/fetch shape, but do **not** reuse its service-token headers or `null`-means-success semantics for runner lifecycle events. A callback rejection/stale result must remain observable to `local-runner.ts`; HMAC lifecycle delivery is a strict protocol, not best-effort content sync.

**Tests:** follow `crawler-runs.route.test.ts:8-60` for deterministic raw-body HMAC construction and `runner-event-auth.test.ts:29-49` for current/previous-key boundary tests. Add tampered byte, expired timestamp, stale claim, and duplicate/conflicting `event_id`/nonce cases.

---

### `packages/crawler/src/task-runner/local-runner.ts`

**Closest analog:** `scripts/local-dev.ts` is a Node process-lifecycle analog only; no existing daemon polls and claims a crawler run.

**Process-entry pattern** — `scripts/local-dev.ts:79-86,371-383`:

```ts
return spawn(invocation.command, invocation.args, {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: service.environment ?? process.env,
  shell: false,
  stdio: 'inherit',
})

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
```

Use the explicit ESM entry guard and graceful shutdown pattern, but run the crawler in the same Node process and retain a single in-memory `activeRun`. The loop owns neither a queue nor a state machine: `poll` returns a server-owned candidate; a signed `claim` performs the only state change. Do not import `target-crawl-mutation.ts`, start a Worker child process, or dispatch GitHub Actions.

**State authority to call through** — `apps/api/src/domain/crawler-tasks/repository.ts:398-412`:

```ts
async function claimDispatch(runId: string): Promise<CrawlerRunTransitionDecision> {
  const run = await getRunRow(runId)
  if (!run) throw new Error(`Crawler run ${runId} was not found`)
  return applyTransition(runId, {
    actor: 'dispatcher',
    sequence: run.last_event_sequence + 1,
    type: 'dispatch_claim',
  })
}
```

Runner tests must fake the client and adapters, assert one active run, poll-after-terminal only, offline leaves the run `queued`, and cancellation is detected at heartbeat/checkpoint rather than by killing Puppeteer.

---

### `packages/crawler/src/task-runner/template-adapters.ts`, `movie-adapter.ts`, `manga-adapter.ts`, and `receipt-candidates.ts`

**Closed registry pattern** — `apps/api/src/domain/crawler-tasks/template-registry.ts:7-27`:

```ts
export const crawlerTaskTemplates = {
  manga: { entrypoint: 'manga-crawler', permissionResource: 'comic', templateKey: 'manga', templateVersion: 1 },
  movie: { entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 },
} as const satisfies Record<CrawlerTaskTemplateKey, CrawlerTaskTemplate>

export function createCrawlerTaskSnapshot(templateKey: CrawlerTaskTemplateKey): CrawlerTaskSnapshot {
  return Object.freeze({ ...getCrawlerTaskTemplate(templateKey) })
}
```

Mirror the discriminated `movie`/`manga` map locally. Its input is the API-issued snapshot only; it must not accept CLI argv, command, source URL, workflow, environment, key, or arbitrary crawler configuration.

**Movie thin-observation seam** — `packages/crawler/src/core/optimized-crawler.ts:87-116,150-167`:

```ts
const movieInfo = await this.getMovieInfo(url, page)
if (!movieInfo) return null
if (movieInfo.coverImage) await this.processImage(movieInfo)
await this.syncToApi(movieInfo)
return movieInfo

const result = await this.apiClient.syncMovie(movieInfo)
if (result) this.progressMonitor.incrementApiSynced()
```

The adapter should observe the candidate identifier and created/updated facts at this sync seam; it must not alter `ApiClient.syncMovie()` (`api-client.ts:71-76`) or infer receipt success from `run()` resolving. The existing class turns per-item failure into `null` at `optimized-crawler.ts:112-116`.

**Manga thin-observation seam** — `packages/crawler/src/crawlers/comic-crawler.ts:391-403,462-492`:

```ts
await this.syncToApi('/api/admin/sync', {
  type: 'manga',
  data: { ...info, chapters: info.chapters.map(c => ({ title: c.title, slug: c.slug, number: c.number, url: c.url })) },
})

const syncResult = await this.syncToApi('/api/admin/sync', {
  type: 'chapter',
  data: { title: content.title, comicSlug: info.slug, chapterSlug: chapter.slug, images: content.images },
})
```

Retain current crawler transport and only return a safe adapter result such as `{ outcome, candidates, summary }`. Keep raw crawler console data, HTML, headers, cookies, and URLs out of candidates/logs. `ComicCrawler.run()` catches crawler errors internally (`comic-crawler.ts:71-105`), so its return value is insufficient proof.

**Testing:** use local mocked fetch/fixtures as in `api-client.test.ts:96-127` and `optimized-crawler.e2e.test.ts:5-49`; real movie/manga execution is acceptance evidence, not the primary deterministic test.

---

### `packages/crawler/src/task-runner/controlled-adapter.ts`

**Analog:** none. This is a Phase 17 deterministic cancellation fixture.

Keep it an adapter behind the same closed registry interface, not a third template exposed to Dashboard/API. At each injected safe checkpoint: send a signed heartbeat, fetch current run state, then send `cancelled` and stop future units only when API reports `cancel_requested`. It must return zero receipt candidates after cancellation and must not terminate a browser process.

Test it beside `local-runner.test.ts` with controllable promises/checkpoints, asserting that pre-cancel candidate facts are retained in audit/logs while terminal status is `cancelled` and carries no success receipt.

---

### `apps/api/src/domain/crawler-tasks/receipt-validation.ts`, `types.ts`, and `repository.ts`

**Analogs:** `repository.ts`, `state-machine.ts`, and `packages/db/src/schema.ts`.

**Persistence model / no new task store** — `packages/db/src/schema.ts:353-418` fixes the contract:

```ts
export const crawlerRuns = sqliteTable('crawler_run', {
  status: text('status', { enum: ['queued', 'dispatching', 'running', 'cancel_requested', 'succeeded', 'failed', 'cancelled'] }).notNull(),
  stateVersion: integer('state_version').notNull().default(0),
  lastEventSequence: integer('last_event_sequence').notNull().default(0),
  receiptSummaryJson: text('receipt_summary_json', { mode: 'json' }),
})

export const crawlerRunnerEvents = sqliteTable('crawler_runner_event', {
  eventId: text('event_id').notNull(), nonce: text('nonce').notNull(),
  sequence: integer('sequence').notNull(), bodySha256: text('body_sha256').notNull(),
})
```

Use the existing JSON receipt field; a migration is not implied unless implementation proves that a queryable field is required. Extend the TypeScript receipt contract to distinguish runner candidates from a server `ValidatedCrawlerRunReceipt` holding `templateKey`, `primaryContentId`, `createdCount`, `updatedCount`, and only a safe verified aggregate.

**CAS transition pattern** — `repository.ts:279-395`:

```ts
const decision = decideCrawlerRunTransition(toCrawlerRunState(run, templateKey), event)
if (decision.kind !== 'transition') { /* write stale audit, return decision */ }

UPDATE crawler_run
SET status = ?, state_version = ?, last_event_sequence = ?, receipt_summary_json = ?
WHERE id = ? AND status = ? AND state_version = ? AND last_event_sequence = ?
```

Keep this single transition authority. Before accepting `runner_succeeded`, call the new validator with the frozen template key and DB, query only the matching `movie` or `comic` table (`schema.ts:98-120,153-181`), verify a non-empty matched summary and choose one stable primary ID. A missing/empty/wrong-table candidate must call the existing `runner_failed` path with safe code `receipt_missing`, preserve prior ingress/audit facts, and write no success receipt.

**Current defect to correct:** `repository.ts:577-620` persists `{ outcome: 'accepted' }` before calling `applyTransition()` and always returns that supplied outcome. Claim/event work must persist and replay the *actual* accepted/stale/rejected result after its CAS decision; test stale claim and conflicting replay explicitly.

**State-machine invariants** — `state-machine.ts:98-145`:

```ts
case 'admin_cancel':
  if (state.status === 'queued') return transition(state, 'cancelled', 'cancelled_before_dispatch')
  return state.status === 'dispatching' || state.status === 'running'
    ? transition(state, 'cancel_requested', 'cancel_requested')
    : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }

case 'runner_succeeded':
  return state.status === 'dispatching' || state.status === 'running' || state.status === 'cancel_requested'
    ? transition(state, 'succeeded', state.status === 'cancel_requested' ? 'cancel_not_effective' : 'runner_succeeded', { sequence: event.sequence })
    : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
```

Do not add a runner-owned status enum. Preserve the existing valid-receipt-wins cancel race only after API revalidation.

**Tests:** extend the LibSQL-backed repository setup in `repository.test.ts:18-60` with movie/comic seed rows. Cover: validated movie/manga success, empty candidate, missing ID, wrong-template ID, persisted `primaryContentId`/counts, stale CAS, exact duplicate replay, and `cancel_requested` plus validated success.

---

### `apps/api/src/schemas/crawler-run-events.ts` and `apps/api/src/routes/internal/crawler-runs/index.ts`

**Analog:** current signed event route is the exact boundary.

**Strict envelope pattern** — `crawler-run-events.ts:3-24`:

```ts
export const CrawlerRunEventSchema = v.strictObject({
  attempt: v.pipe(v.number(), v.integer(), v.minValue(1)),
  event_id: Identifier, key_id: Identifier, nonce: Identifier,
  run_id: Identifier, sequence: v.pipe(v.number(), v.integer(), v.minValue(1)),
  timestamp: v.pipe(v.number(), v.integer()),
  type: v.picklist(['heartbeat', 'progress', 'log', 'succeeded', 'failed', 'cancelled']),
})
```

Add poll/claim schemas/routes with the same strictness, run/attempt binding, nonce/event ID, current/previous key rotation, and five-minute timestamp window (`crawler-runs/index.ts:10-17,45-75`). Poll must be read-only; claim maps only to `repository.claimDispatch()`. Do not expose task command, URL, workflow, target profile, environment, secret, or free-form template input.

**Safe storage pattern** — `log-redaction.ts:14-44`:

```ts
const message = event.message ? truncateRunnerEventText(redactRunnerEventText(event.message)) : undefined
const log = message && event.code && event.level
  ? { code: event.code, counts: event.counts, level: event.level, message }
  : undefined
return { log, receipt: event.receipt, terminalSummary }
```

Apply it before repository persistence. Keep the current 4 KiB and 500 ordinary-row caps from `repository.ts:476-526`.

**Tests:** extend `crawler-runs.route.test.ts:62-133`; create injected repository doubles for poll/claim and assert signature-before-parse, identity/timestamp rejection, stale claim response, no event field surplus, and no receipt on `cancelled`/`failed`.

---

### `apps/api/src/schemas/crawler-tasks.ts` and `apps/api/src/routes/admin/crawler-tasks/index.ts`

**Analog:** current authenticated task command/read-model route.

**Session and template authorization** — `crawler-tasks/index.ts:35-73`:

```ts
const session = await c.get('auth')?.api?.getSession({ headers: c.req.raw.headers })
if (!session?.user) throw new HTTPException(401, { message: 'Unauthorized: Please login first' })
requireTemplateAccess(user, task.template_key)

SELECT run.id
FROM crawler_run AS run
INNER JOIN crawler_task AS task ON task.id = run.task_id
WHERE task.id = ? AND run.id = ?
```

Keep this access check on every task/detail/log/cancel/retry endpoint. UI access hiding does not replace server authorization.

**Command/response pattern** — `crawler-tasks/index.ts:77-88,135-151`:

```ts
adminCrawlerTasksRoutes.post('/', validator('json', CreateCrawlerTaskSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { template } = c.req.valid('json')
  requireTemplateAccess(user, template)
  const result = await createCrawlerTaskRepository(c.get('db')).createOrGetActiveRun({ requestedByUserId: user.id, templateKey: template })
  return c.json({ kind: result.kind, run: result.run, template })
})
```

Use strict `CreateCrawlerTaskSchema` (`crawler-tasks.ts:6-12`) so only `movie`/`manga` fixed keys pass. Preserve the returned `existing_active_run` to select the current UI run rather than create another card.

**Latest-first log correction:** replace current `sequence > cursor / ORDER BY ASC` at `crawler-tasks/index.ts:120-132` with `sequence < oldestCursor / ORDER BY DESC`, limit default 50, and return `nextCursor` from the last returned row. Tests must prove first page is newest, second page is older, and pages do not overlap.

**Tests:** extend `crawler-tasks.route.test.ts:54-147`: closed-template rejection, cross-resource task/run guard, immediate queued cancel vs dispatched/running `cancel_requested`, retry only from allowed terminal states, latest-first cursor response, receipt summary visibility only after server validation.

---

### `apps/api/src/routes/admin/comics/index.ts`, `handlers.ts`, `apps/dashboard/src/views/Movies.vue`, and `Comics.vue`

**Analog for the missing comics detail route:** `apps/api/src/routes/admin/movies/index.ts:389-448`:

```ts
adminMovies.get('/:id', describeRoute({ /* summary, operationId, cookieAuth */ }), async (c) => {
  const movie = await db.query.movies.findFirst({ where: eq(movies.id, id), with: { /* relations */ } })
  if (!movie) return c.json({ error: 'Movie not found' }, 404)
  return c.json(movie)
})
```

Add only a resource-guarded `GET /admin/comics/:id` if required for direct receipt handoff; preserve `adminComicsRoutes` auth middleware and use a simple Drizzle `findFirst`/404 equivalent. Do not repurpose the paginated list as a receipt proof.

**Existing editable handoff patterns:**

```ts
// Movies.vue:229-237
async function openEditModal(movie: Movie) {
  editingMovie.value = { ...movie }
  isEditModalOpen.value = true
  const fullMovie = await api.admin.getMovie(movie.id)
  editingMovie.value = fullMovie
}

// Comics.vue:184-192
function openEditModal(comic: Comic) {
  editingComic.value = { ...comic }
  isEditModalOpen.value = true
  activeTab.value = 'metadata'
  if (comic.id) loadChapters(comic.id)
}
```

Add an explicit receipt query parameter that is read once, validates the route-owned ID, fetches the direct resource, and opens this existing modal. The receipt link must use only API-validated `primaryContentId`; success UI must not synthesize navigation from a runner candidate. Keep normal update + refresh behavior (`Movies.vue:379-409`, `Comics.vue:225-250`) for the reversible edit/readback/restore acceptance step.

Extend the API wrapper instead of using raw fetch. `apps/dashboard/src/lib/api.ts:8-21,235-268` is the local convention:

```ts
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await credentialFetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Unknown error' }))).message || `Request failed with status ${res.status}`)
  return res.json()
}
```

Add typed task/run/log/receipt methods alongside the current `api.admin` methods. Test query-parameter driven receipt opening, API 404/error retention, reversible patch/readback/restore, and comic/movie resource boundaries using the mock structure in `Movies.test.ts:5-70` and `Comics.test.ts:13-141`.

---

### `apps/dashboard/src/views/Crawlers.vue` and `apps/dashboard/src/views/__test__/Crawlers.test.ts`

**Analog:** current component owns authentication, resource guard, request refresh, error routing, skeleton, and confirmation dialog.

**Imports / refresh / cleanup pattern** — `Crawlers.vue:6-62`:

```ts
import { ConfirmDialog, info, SkeletonCard, success } from '@starye/ui'
import { onMounted, onUnmounted, ref } from 'vue'
import { handleError } from '@/composables/useErrorHandler'
import { useResourceGuard } from '@/composables/useResourceGuard'
import { api } from '@/lib/api'

async function refresh() {
  loading.value = true
  try { await Promise.all([loadStats(), loadFailedTasks()]) }
  finally { loading.value = false }
}
```

Extend the page below its header with the Phase 17 local-task section while retaining existing stats/failure areas. Replace the page's 30-second task refresh only for the new panel with a visibility-aware five-second interval: clear on hidden/unmount, refresh immediately when visible and after create/cancel/retry, and retain prior loaded data during refresh.

**Confirmation pattern** — `Crawlers.vue:75-94,232-239`:

```ts
const clearConfirmOpen = ref(false)
function handleClearFailed(type: 'comic' | 'movie') {
  clearConfirmType.value = type
  clearConfirmOpen.value = true
}
<ConfirmDialog v-model:open="clearConfirmOpen" title="确认清空失败任务" variant="danger" @confirm="executeClearFailed" />
```

Mirror this state/handler separation for cancel and retry, but use the UI-SPEC copy and variants: cancellation confirmation is destructive, displays `cancel_requested` as “已请求取消，等待 runner 确认。”, and does not optimistically render `cancelled`; retry confirmation is non-destructive.

**UI-specific override:** do not copy the legacy scoped hard-coded color styles in `Crawlers.vue:242-448`. New local-task markup follows `17-UI-SPEC.md`: `@starye/ui` semantic tokens, 44px controls, two-column/one-column responsive cards, no emoji-only state, no raw crawler output, 448px log container, and `SkeletonCard`/`ErrorDisplay` for first-load/error states.

**Tests:** copy component mocks from `Comics.test.ts:19-141`. Assert resource-gated cards; exact creation payload `{ template }`; active-run selection; 5-second visible-only polling with fake timers; immediate refresh; latest-50 plus older-cursor append; confirmation semantics; receipt link visibility only for `succeeded` plus validated receipt; and safe error retention.

---

### `scripts/local-task-runner.ts`, `packages/crawler/package.json`, and `crawler-source-entry-contract.test.ts`

**Only if an explicit CLI wrapper is used.** `packages/crawler/package.json` currently distinguishes target-managed `crawl:*` entries from `local:*` commands. Add a clearly named local runner command that launches the new local Node process; do not alter `crawl:comic`, `crawl:optimized`, `smoke:fixture`, `target-remote-entry`, or production Worker/Pages commands.

Add the wrapper to `trackedEntries` and `directEntryClassifications` as `local-or-external-only`, preserving the static guard at `crawler-source-entry-contract.test.ts:105-131`:

```ts
const directCandidates = program.getRootFileNames().flatMap((filePath) => {
  const source = program.getSourceFile(filePath)
  if (!source || !hasDirectProcessArgvDispatch(source)) return []
  return [path.relative(crawlerRoot, filePath).replaceAll('\\', '/')]
}).sort()
expect(directCandidates).toEqual(Object.keys(directEntryClassifications).sort())
```

The wrapper loads only ignored local runner configuration, never public target projections, and never logs callback/crawler credentials. It remains outside Worker/Pages and does not execute or dispatch GitHub Actions.

## Shared Patterns

### Authentication, authorization, and trust boundary

**Sources:** `apps/api/src/routes/admin/crawler-tasks/index.ts:35-73`, `apps/api/src/routes/internal/crawler-runs/index.ts:45-75`.

- Dashboard mutations require the Better Auth session plus `canAccessCrawler` template/resource authorization.
- Runner is not a browser session: authenticate every poll/claim/event via exact raw-body HMAC, active/previous key IDs, five-minute timestamp, nonce, `event_id`, run ID, attempt, and sequence.
- Browser visibility must never be used as authorization; Dashboard must never send executable inputs.

### Lifecycle, idempotency, logs, and cancellation

**Sources:** `state-machine.ts:90-145`, `repository.ts:279-395,476-526,577-620`.

- Repository/state machine is the only lifecycle authority; runner emits events and observes their result.
- Preserve D1 CAS and terminal immutability. Store actual transition outcome for a replay; avoid the current pre-CAS `accepted` persistence defect.
- Persist only normalized structured logs. The safe message has a 4 KiB ceiling and only 500 ordinary rows; task UI shows API-projected values only.
- Queued cancellation becomes `cancelled`; dispatched/running cancellation stays `cancel_requested` until the signed cooperative terminal event. Do not force-stop Puppeteer.

### Receipt validity and management handoff

**Sources:** `packages/db/src/schema.ts:98-120,153-181,353-418`; `Movies.vue:229-237`; `Comics.vue:184-192`.

- Runner candidates are evidence to validate, never proof. API re-queries the template-matched table and stores one verified primary ID plus safe created/updated summary before terminal success.
- No verified candidate means terminal `failed` with `receipt_missing`; cancelled runs have no success receipt even if earlier input was ingested.
- Management navigation is rendered only for validated succeeded receipts and opens the existing movie/comic editor. Acceptance must edit a reversible field, read it back, then restore it.

### Gateway acceptance

**Sources:** `scripts/local-dev.ts:145-181,371-375`; `scripts/data-chain-smoke.ts:996-1035`; `scripts/data-chain-surface-observation.ts:321-378`.

Use local supervisor topology, but treat `http://localhost:8080` as the sole browser acceptance origin. `8787` API and `5173` Dashboard are supporting processes only. Completion evidence should bind run/template/validated content ID at D1/API, then perform the receipt link plus reversible CRUD through Gateway; do not report a direct Vite/API check as canonical UI proof.

## No Analog Found

| File / concern | Role | Data Flow | Planner direction |
|---|---|---|---|
| `local-runner.ts` serial poll/claim daemon | service | polling | New local-only process; copy `scripts/local-dev.ts` entry/cleanup style only, while delegating all state to API. |
| `controlled-adapter.ts` | adapter / fixture | event-driven | Create deterministic safe checkpoints solely for cancellation tests; hide it from API/UI template selection. |
| `receipt-validation.ts` | service | CRUD/transform | New server-side template-aware D1 read model; use schema/repository CAS contracts, not runner process outcome. |
| `receipt-candidates.ts` | utility | transform | New narrow observation data model; keep current shared `ApiClient` behavior unchanged. |
| validated receipt deep link in `Movies.vue` / `Comics.vue` | component | request-response | Existing edit modals exist, but no receipt query contract exists. Add explicit query parsing and direct comics detail retrieval. |
| latest-first log cursor | route/read model | request-response | Current route is oldest-first; reverse SQL/cursor direction and add non-overlap tests. |
| Phase 17 Gateway E2E evidence | acceptance test | request-response | Existing Phase 13 data-chain scripts are reference patterns only. Keep Phase 17 proof local/Gateway-scoped and do not widen remote/production orchestration. |

## Metadata

**Analog search scope:** `apps/api/src/domain/crawler-tasks`, `apps/api/src/routes/{internal/crawler-runs,admin/crawler-tasks,admin/comics,admin/movies}`, `apps/dashboard/src/{views,lib}`, `packages/crawler/src/{core,crawlers,utils}`, `packages/config/src/deployment-target/__tests__`, and `scripts/`.  
**Primary source files read:** 26; route/domain/component/test analogs read directly.  
**GitNexus:** query/context located the Phase 16 `claimDispatch → applyTransition → decideCrawlerRunTransition` flow. The local index refresh was attempted but exceeded the 64-second command limit, so all implementation claims above are grounded in the current source reads.  
**Pattern extraction date:** 2026-07-30.

**Phase boundary reminder:** The runner is local Node data-plane work. Worker/Pages must not execute Node/Puppeteer, and this phase must not dispatch or orchestrate GitHub Actions.
