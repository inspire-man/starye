# Phase 19: Dashboard Operations and End-to-End Proof - Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 19 planned/modified files or grouped test/evidence targets
**Analogs found:** 16 / 19 (complete history read model, production tuple capture, and manga add/restore proof are extensions or new concerns)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/api/src/routes/admin/crawler-tasks/index.ts` | controller / read-model route | request-response / CRUD | same file, current handlers | exact extension |
| `apps/api/src/schemas/crawler-tasks.ts` | validation | request-response / transform | same file | exact extension |
| `apps/api/src/domain/crawler-tasks/types.ts` | model / DTO contract | transform | same file, Phase 18 provider types | exact extension |
| `apps/api/src/domain/crawler-tasks/provider-association.ts` | model / mapper | transform / request-response | same file, Phase 18 | exact extension |
| `apps/api/src/domain/crawler-tasks/repository.ts` | repository / service | CRUD / event-driven / CAS | same file, Phase 16-18 | exact extension |
| `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` | route test | request-response | same file | exact extension |
| `apps/api/src/domain/crawler-tasks/__tests__/{repository,provider-association,receipt-validation}.test.ts` | domain tests | CRUD / event-driven / transform | same suites, Phase 16-18 | exact extension |
| `apps/dashboard/src/lib/api.ts` | client service / DTO mapper | request-response | same file | exact extension |
| `apps/dashboard/src/composables/useResourceGuard.ts` | authorization composable | transform / request-response | same file | exact extension |
| `apps/dashboard/src/views/Crawlers.vue` | component | polling / request-response | same file, Phase 17 | exact extension |
| `apps/dashboard/src/views/__test__/Crawlers.test.ts` | component test | polling / request-response | same file, `Comics.test.ts` mocks | exact extension |
| `apps/dashboard/src/views/{Movies,Comics}.vue` | component / existing editor | CRUD / request-response | same files, Phase 17 | exact extension |
| `apps/dashboard/src/views/__test__/{Movies,Comics}.test.ts` | component tests | CRUD / request-response | same files | exact extension |
| `scripts/local-task-runner.e2e.ts` | acceptance script | event-driven / request-response / file-I/O | same file, Phase 17-03 | exact extension |
| `scripts/data-chain-surface-observation.ts` | evidence orchestrator | request-response / file-I/O | same file, Phase 13 evidence | exact extension |
| `packages/config/src/deployment-target/data-chain-evidence.ts` | evidence schema / utility | transform / file-I/O | same file | exact extension |
| `.github/workflows/daily-{movie,manga}-crawl.yml` | workflow config | event-driven / file-I/O | each other, Phase 18 | role-match |
| `.planning/phases/19-dashboard-operations-and-end-to-end-proof/{local,production}/*` | acceptance evidence artifacts | file-I/O / event-driven | Phase 18 `COVERAGE.md` and local evidence | partial / no exact analog |
| `RUNBOOK.md` | operations documentation | manual request-response / file-I/O | current target/preflight/rollback sections | role-match |

## Pattern Assignments

### API route and validation boundary

**Files:** `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/api/src/schemas/crawler-tasks.ts`

**Analogs:** current crawler route lines 1-19, 145-183, 187-232, 234-292; schema lines 1-32.

**Imports and strict validators** (`index.ts:1-19`, `schemas/crawler-tasks.ts:1-32`):

```ts
import type { CrawlerTaskTemplateKey } from '../../../domain/crawler-tasks/types'
import type { AppEnv, SessionUser } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'

const TaskIdSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))
export const CreateCrawlerTaskSchema = v.strictObject({
  template: v.picklist(['movie', 'manga']),
})
export const RetryCrawlerTaskSchema = v.strictObject({ confirmed: v.literal(true) })
```

Extend the strict query schema with an opaque bounded keyset cursor and `limit` (max 50). Keep retry confirmation explicit. Do not accept workflow, URL, command, secret, callback payload, or provider credentials.

**Session and template/run authorization** (`index.ts:145-183`):

```ts
async function requireSessionUser(c: { get: (key: 'auth') => any, req: { raw: Request } }): Promise<SessionUser> {
  const session = await c.get('auth')?.api?.getSession({ headers: c.req.raw.headers })
  if (!session?.user)
    throw new HTTPException(401, { message: 'Unauthorized: Please login first' })
  return session.user as SessionUser
}

function requireTemplateAccess(user: SessionUser, templateKey: CrawlerTaskTemplateKey): void {
  const template = getCrawlerTaskTemplate(templateKey)
  if (!canAccessCrawler(user, template.permissionResource))
    throw new HTTPException(403, { message: 'Forbidden for crawler task template' })
}
```

Every list/detail/log/cancel/retry handler calls `requireSessionUser`, resolves the task template from D1, then rechecks `canAccessCrawler`; a client-side hidden card is only a usability mirror.

**Current list/detail/log shape to extend** (`index.ts:204-250`):

```ts
const { cursor, limit, template } = c.req.valid('query')
if (template)
  requireTemplateAccess(user, template)
const rows = await getD1(c).prepare(`
  SELECT id, template_key, latest_run_id, created_at, updated_at
  FROM crawler_task
  WHERE (? IS NULL OR template_key = ?) AND (? IS NULL OR id < ?)
  ORDER BY created_at DESC, id DESC LIMIT ?
`).bind(template ?? null, template ?? null, cursor ?? null, cursor ?? null, limit).all()
```

Replace only the unstable `id < cursor` portion with a server-encoded `(updated_at,id)` keyset and return `{ tasks, nextCursor }`. Detail should left-join or separately read the immutable provider association and project all attempts; log paging keeps the existing sequence cursor:

```ts
WHERE run.task_id = ? AND log.run_id = ? AND (? IS NULL OR log.sequence < ?)
ORDER BY log.sequence DESC LIMIT ?
// nextCursor = rows.length === limit ? Number(rows.at(-1)?.sequence) : null
```

Cancel/retry continue to delegate to repository state transitions before provider calls (`index.ts:253-292`). `cancel_requested` is returned as-is; retry inserts a new attempt and must not overwrite the old run.

### Domain types, provider projection, and repository history

**Files:** `types.ts`, `template-registry.ts`, `provider-association.ts`, `repository.ts`.

**Closed template registry** (`template-registry.ts:7-31`):

```ts
export const crawlerTaskTemplates = {
  manga: { entrypoint: 'manga-crawler', permissionResource: 'comic', templateKey: 'manga', templateVersion: 1 },
  movie: { entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 },
} as const satisfies Record<CrawlerTaskTemplateKey, CrawlerTaskTemplate>

export function createCrawlerTaskSnapshot(templateKey: CrawlerTaskTemplateKey): CrawlerTaskSnapshot {
  return Object.freeze({ ...getCrawlerTaskTemplate(templateKey) })
}
```

Keep `CrawlerTaskTemplateKey`, `CrawlerRunStatus`, `CrawlerRunFailureCode`, `ValidatedCrawlerRunReceipt`, and `ProviderAssociationSummary` as closed unions. Add read-model-only fields rather than widening to `Record<string, unknown>`.

**Immutable provider snapshot and safe summary** (`provider-association.ts:11-30,126-175`):

```ts
const providerWorkflowRegistry = Object.freeze({
  movie: Object.freeze({
    crawlerEntrypoint: 'crawler-optimized', environment: 'starye-org', provider: 'github-actions',
    ref: 'main', repository: 'inspire-man/starye', target: 'starye-org',
    workflow: '.github/workflows/daily-movie-crawl.yml',
  }),
  // manga mirrors the same closed shape
})

export function createProviderAssociationSummary(input: unknown): ProviderAssociationSummary {
  // requireExactKeys + bounded providerRunId/providerRunAttempt/status/conclusion/sha
  return Object.freeze({ provider: 'github-actions', ...safeFields })
}
```

For D-08, derive a fixed provider URL from this server-owned repository and numeric run ID; never persist or accept arbitrary URLs. Exclude tokens, headers, private keys, raw callback payloads, and workflow controls.

**Repository projection and retention** (`repository.ts:275-289,372-389,524-558,754-807,1361-1385`):

```ts
function toProviderAssociationRecord(row: CrawlerProviderRow): ProviderAssociationRecord {
  return {
    applicationAttempt: row.application_attempt,
    environment: row.environment,
    ...(row.provider_run_id ? { providerRunId: row.provider_run_id } : {}),
    ...(row.provider_run_attempt ? { providerRunAttempt: row.provider_run_attempt } : {}),
    ...(row.provider_status ? { providerStatus: row.provider_status } : {}),
  }
}

async function purgeExpiredRunLogs(at = now()): Promise<number> {
  const result = await d1.prepare('DELETE FROM crawler_run_log WHERE expires_at <= ?')
    .bind(toUnixSeconds(at)).run()
  return result.meta?.changes ?? 0
}
```

Use repository queries for task list/detail/provider read models, but keep state-machine/CAS as the only mutation owner. Preserve immutable runs, terminal failure/receipt summaries and old logs when `retryRun()` creates the next attempt. Retain the existing 90-day detail-log purge; task, attempt, terminal state, failure code and receipt summary remain durable.

### Dashboard client and crawler operations

**Files:** `apps/dashboard/src/lib/api.ts`, `useResourceGuard.ts`, `Crawlers.vue`.

**Credentialed API wrapper and DTOs** (`api.ts:8-21,197-244,447-479`):

```ts
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await credentialFetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' }, ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' })) as { message?: string }
    throw new Error(error.message || `Request failed with status ${res.status}`)
  }
  return res.json()
}
```

Extend `CrawlerTask`, `CrawlerRun`, `CrawlerTaskDetail`, and `CrawlerTaskLogsPage` with typed `nextCursor`, provider-safe summary, and controlled receipt source fields. Keep all crawler calls in `api.admin`; views must not use raw `fetch`.

**Client-side permission mirror** (`useResourceGuard.ts:19-47`):

```ts
const canAccessCrawler = (type: 'comic' | 'movie'): boolean => {
  if (userRole.value === 'admin' || userRole.value === 'super_admin') return true
  if (type === 'comic' && userRole.value === 'comic_admin') return true
  if (type === 'movie' && userRole.value === 'movie_admin') return true
  return false
}
```

Map `manga -> comic` and `movie -> movie`; hide inaccessible groups and actions, while preserving server 403 behavior.

**Existing polling, selection, safe log and action patterns** (`Crawlers.vue:6-12,60-134,156-208,329-402`):

```ts
async function loadTaskLogs(task: CrawlerTask, run: CrawlerRun, append = false): Promise<void> {
  const page = await api.admin.getCrawlerTaskLogs(task.id, run.id, append ? taskLogCursor.value ?? undefined : undefined)
  taskLogs.value = append ? [...taskLogs.value, ...page.logs] : page.logs
  taskLogCursor.value = page.nextCursor
}

function startTaskPolling(): void {
  stopTaskPolling()
  if (document.visibilityState === 'visible') {
    void loadTaskPanel()
    taskRefreshInterval = setInterval(() => void loadTaskPanel(), 5000)
  }
}
```

Preserve `onMounted`/`onUnmounted`, `visibilitychange`, manual refresh, stale-state retention on failed reload, `ConfirmDialog`, and `cancel_requested` wording. Extend the current one-task-per-template state to grouped cursor pages; preserve selected task and selected attempt when refresh responses arrive. Disable conflicting cancel/retry actions while cancellation is pending. Retry confirmation must include old status/failure/attempt and state that history is retained.

Receipt management remains allowlisted:

```ts
function managementPath(run: CrawlerRun): string | null {
  if (run.status !== 'succeeded' || !run.receipt) return null
  return run.receipt.templateKey === 'movie'
    ? `/dashboard/movies?receipt=${encodeURIComponent(run.receipt.primaryContentId)}`
    : `/dashboard/comics?receipt=${encodeURIComponent(run.receipt.primaryContentId)}`
}
```

Add only controlled task/run/attempt source query parameters; never put raw receipt JSON in the URL.

### Existing editor handoff and reversible CRUD

**Files:** `apps/dashboard/src/views/Movies.vue`, `Comics.vue`, and their tests.

**Receipt-only lookup** (`Movies.vue:84-87,286-300`; `Comics.vue:115-118,201-215`):

```ts
const receiptQuery = typeof route.query.receipt === 'string' && /^\w[\w-]{0,127}$/.test(route.query.receipt.trim())
  ? route.query.receipt.trim() : ''
let receiptHandled = false

async function openReceiptContent(): Promise<void> {
  if (receiptHandled || !receiptQuery) return
  receiptHandled = true
  const movie = await api.admin.getMovie(receiptQuery)
  await openEditModal(movie, movie)
}
```

Keep the existing editor as the only content owner. On lookup 403/404, use `useErrorHandler` and retain a controlled return-to-task affordance; do not fall back to an unrelated list or retry forever.

**Movie reversible mutation surface** (`Movies.vue:303-331,356-397,403-431`; `api.ts:313-346`):

```ts
await api.admin.updateMovie(editingMovie.value.id, payload)
await api.admin.addPlayer(editingMovie.value.id, { sourceName, sourceUrl, quality })
await api.admin.updatePlayer(playerId, data)
await api.admin.deletePlayer(playerId)
await loadPlayers(editingMovie.value.id)
```

Use a snapshot of original metadata/player state, perform the bounded add/update/delete/readback, then restore the original metadata and remove the acceptance player.

**Comic existing mutation surface** (`Comics.vue:218-228,249-274,315-340`; `api.ts:284-306`):

```ts
chapters.value = await api.admin.getChapters(comicId)
await api.admin.updateComic(editingComic.value.id, payload)
await api.admin.deleteChapter(chapterId)
await api.admin.bulkDeleteChapters(editingComic.value.id, chapterIds)
```

There is no current add-chapter route. Planner must choose an existing controlled sync/fixture owner or explicitly mark the manga child-subitem proof as unresolved; do not invent a direct D1 insert in the Dashboard.

### Tests and evidence scripts

**Dashboard tests:** `Crawlers.test.ts:1-150` uses hoisted API/permission mocks, fake timers, controlled `document.visibilityState`, and `flushPromises`. Extend it for cursor pages, selection preservation, stale responses, provider redaction, `cancel_requested`, retry explanation, and source query URL. `Movies.test.ts` and `Comics.test.ts` already assert valid receipt opens the editor and foreign URL-shaped receipts are ignored (`Movies.test.ts:139-159`, `Comics.test.ts:216-234`).

**API route tests:** `crawler-tasks.route.test.ts:1-59` builds an isolated Hono app with injected auth/session and D1 statement doubles. Existing cases at lines 66-163 cover closed inputs, session/role 401/403, task/run ID binding and sequence logs; lines 165-228 cover validated receipt projection and redaction; lines 230-262 cover provider association before dispatch and token redaction. Add deterministic tie-cursor, provider fields, retry history and `cancel_requested` assertions to this harness.

**Local E2E analog** (`scripts/local-task-runner.e2e.ts:68-131,133-196,198-240`):

```ts
const LOCAL_GATEWAY_ORIGIN = 'http://localhost:8080'
function requireLocalUrl(value: string, name: string): void { /* loopback HTTP only */ }
async function requestJson<T>(session: SessionConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${LOCAL_GATEWAY_ORIGIN}${path}`, { ...init, headers: { cookie: session.cookieHeader, ...init.headers } })
  if (!response.ok) throw new Error(`Local Gateway request failed: ${response.status}`)
  return response.json() as Promise<T>
}
```

Reuse task creation -> local runner -> detail/readback -> validated receipt for both movie and manga, and preserve the explicit real-crawl `receipt_missing` fact when a fixture adapter is needed. Keep cancellation as a separate cooperative checkpoint proof.

**Evidence pair schema and observer** (`data-chain-evidence.ts:416-429,761-866,895-930`; `data-chain-surface-observation.ts:190-240,243-265`):

```ts
export function createDataChainExecutionReceipt(input: CreateDataChainExecutionReceiptInput): DataChainExecutionReceipt {
  assertInputKeys(input, receiptInputKeys, 'data-chain receipt input')
  const receipt = { ...input, result: 'passed' as const }
  return { ...receipt, integrity: receiptIntegrity(receipt) }
}

export function serializeDataChainEvidenceJson(evidence: unknown): string {
  assertValidEvidence(evidence)
  return `${JSON.stringify(cloneEvidence(evidence), null, 2)}\n`
}

export function renderDataChainEvidenceMarkdown(evidence: unknown): string { /* same allowlisted projection */ }
```

Load both JSON and Markdown, validate the exact `(mode,target,runId)` tuple, require the expected runner receipt rows, then write both projections from the same typed evidence object. Local observations must use `http://localhost:8080`; remote URLs derive from the selected target profile and must be HTTPS origins without direct ports.

**Workflow analog:** `.github/workflows/daily-movie-crawl.yml:27-147` and the matching manga file use `register-schedule -> resolve-target -> GitHub Environment -> validate-dispatch -> prepare-mutation -> run-prepared-entry -> always cleanup`. Evidence may consume these fixed workflow fields, but Phase 19 must not add arbitrary workflow/target/secret inputs or redesign the workflows.

## Shared Patterns

### Closed Inputs and Resource Authorization

**Sources:** `template-registry.ts:7-31`, `provider-association.ts:126-175`, `index.ts:145-183`, `useResourceGuard.ts:19-47`.

Only `movie`/`manga` enters the API. Server resolves permission resource, provider workflow, repository, ref, Environment and target. Client hides inaccessible groups but server session/template/run checks remain authoritative.

### Immutable Attempts, CAS, Cancellation and Retry

**Sources:** `repository.ts:754-807`, `state-machine.ts` and Phase 16/18 patterns.

`cancel_requested` is an intermediate state; provider acknowledgement is not a terminal success. Validated success may win the cancel race and must be audited. Retry inserts a new attempt with the frozen snapshot; previous status, logs, failure code and receipt remain queryable.

### Safe Projection and Retention

**Sources:** `provider-association.ts:153-175`, `index.ts:103-138`, `types.ts:3-7`, `repository.ts:1361-1385`.

Allowlist receipt/provider/log fields, redact before D1 or JSON/Markdown output, cap safe logs at 4 KiB/500 rows, retain terminal facts permanently and purge only detail logs after 90 days.

### Visibility-Aware Polling and Cursor Paging

**Sources:** `Crawlers.vue:64-134`, `index.ts:234-250`, `Crawlers.test.ts:40-107`.

Use keyset `(updated_at,id)` for task history, separate sequence cursor for logs, 5-second refresh only while visible, immediate refresh on visibility restoration, and manual refresh at all times. Preserve selected task/attempt and last valid data when a refresh fails.

### Receipt Provenance and Evidence Separation

**Sources:** `Movies.vue:286-300`, `Comics.vue:201-215`, `data-chain-evidence.ts:761-866`, `local-task-runner.e2e.ts:219-240`.

Only an API-validated succeeded receipt can link to an existing editor. Local movie/manga tuples and the single credentialed production tuple must use separate evidence roots and labels; local fixtures are never production provider success.

### Target-First Operations and RUNBOOK Ownership

**Sources:** `RUNBOOK.md:30-97,301-318,382-388`, `docs/documentation-ownership.md`.

Validate selected target metadata and required-secret existence before provider operations. Keep active phase evidence under `.planning/phases/19...`; write durable secret-name metadata, 90-day cleanup, lost/cancel/retry/partial-ingest and rollback steps to `RUNBOOK.md` only at closeout.

## No Analog Found

| File / concern | Role | Data Flow | Planner direction |
|---|---|---|---|
| Stable `(updated_at,id)` task-history cursor and all-task grouped read model | API read model | CRUD / request-response | Extend current `index.ts`/`api.ts` contracts; encode/decode cursor server-side and return `nextCursor`. Do not reuse current `id < cursor` with `created_at` ordering. |
| Production credentialed provider tuple capture/validator | acceptance script/artifact | event-driven / file-I/O | Reuse Phase 18 provider snapshot, workflow fields, callback IDs/nonces and validated receipt; keep it separate from local fixture evidence and gated by target preflight/human credential step. |
| Manga add/delete/restore child-subitem proof | acceptance workflow | CRUD / request-response | Current `Comics.vue`/chapters API exposes read/delete/bulk-delete but no add route. Select a bounded existing sync/fixture owner before planning; never direct-insert D1 from Dashboard. |
| Phase 19 evidence JSON/Markdown filenames and production sign-off artifact | acceptance artifact | file-I/O | Follow `data-chain-evidence.ts` serializer/renderer and exact tuple validation; choose phase-local `local/` and `production/` roots with template + run identifiers. |

## Metadata

**Analog search scope:** `.planning/phases/{16-task-domain-foundation,17-local-runner-vertical-slice,18-github-actions-production-orchestration}`, `apps/api/src/{routes/admin/crawler-tasks,domain/crawler-tasks,schemas}`, `apps/dashboard/src/{views,lib,composables}`, `scripts`, `packages/config/src/deployment-target`, `.github/workflows`, `RUNBOOK.md`, and focused `__tests__` directories.
**Primary source files read:** current crawler API/domain/UI/evidence/workflow files plus Phase 16-18 context/research/pattern/summary artifacts.
**Pattern extraction date:** 2026-08-01.
