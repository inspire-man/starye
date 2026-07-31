# Phase 18: GitHub Actions Production Orchestration - Pattern Map

**Mapped:** 2026-07-31  
**Files analyzed:** 30 planned new/modified files and test suites  
**Analogs found:** 24 / 30 (GitHub App provider modules and production provider evidence are new concerns)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| apps/api/src/domain/crawler-tasks/provider-association.ts | domain model / mapper | transform / CAS | template-registry.ts | role-match |
| apps/api/src/domain/crawler-tasks/reconciliation.ts | service | polling / event-driven | repository.ts | partial |
| apps/api/src/lib/github-app/{jwt,installation-token,github-actions-client}.ts | utility / service | crypto / request-response | runner-event-auth.ts, aria2-proxy.service.ts | partial |
| apps/api/src/domain/crawler-tasks/{types,template-registry,state-machine,repository}.ts | model / registry / state / repository | transform / CRUD / event-driven | same files | exact extension |
| apps/api/src/schemas/crawler-run-events.ts | validation | request-response | same file | exact extension |
| apps/api/src/routes/admin/crawler-tasks/index.ts | controller | request-response | same file | exact extension |
| apps/api/src/routes/internal/crawler-runs/index.ts | controller | event-driven | same file | exact extension |
| apps/api/src/lib/auth.ts | config / binding contract | transform | same Env interface | exact extension |
| apps/api/src/index.ts | scheduler / worker entry | event-driven | existing scheduled cleanup | role-match |
| packages/crawler/src/task-runner/actions-event-client.ts | service / callback adapter | request-response / event-driven | runner-client.ts | contract-match |
| packages/crawler/src/task-runner/runner-client.ts | service | request-response | same file | exact extension |
| packages/crawler/scripts/target-crawl-mutation.ts | controlled CLI / adapter boundary | file-I/O / event-driven | same file | exact extension |
| packages/crawler/src/task-runner/{movie,manga}-adapter.ts | adapter | streaming / event-driven | same files | exact extension |
| packages/config/src/deployment-target/mutation-entry.ts | config / registry | transform | same file | exact extension |
| .github/workflows/daily-{movie,manga}-crawl.yml | workflow | event-driven / file-I/O | each other | role-match |
| packages/db/src/schema.ts | model / persistence schema | CRUD | existing crawler tables | exact extension |
| packages/db/drizzle/0028_<provider-association>.sql | migration | CRUD / schema evolution | 0027_crawler_task_domain_foundation.sql | role-match |
| apps/api/src/domain/crawler-tasks/__tests__/{provider-association,reconciliation}.test.ts | unit test | transform / polling | state-machine.test.ts, repository.test.ts | role/partial |
| apps/api/src/lib/github-app/__tests__/*.test.ts | unit test | request-response / crypto | runner-event-auth.test.ts | role-match |
| apps/api/src/domain/crawler-tasks/__tests__/{repository,state-machine}.test.ts | unit/integration test | CRUD / event-driven | same suites | exact extension |
| apps/api/src/routes/{admin/crawler-tasks,internal/crawler-runs}/__tests__/*.test.ts | route test | request-response / event-driven | same suites | exact extension |
| packages/crawler/src/task-runner/__tests__/actions-event-client.test.ts | contract test | request-response | runner-client.test.ts | role-match |
| packages/config/src/deployment-target/__tests__/{workflow-contract,mutation-entry,crawler-source-entry-contract}.test.ts | contract test | static / file-I/O | same suites | exact extension |

## Pattern Assignments

### Provider association, registry, and types

**Files:** apps/api/src/domain/crawler-tasks/provider-association.ts, types.ts, template-registry.ts.

**Analog:** template-registry.ts:7-28 and types.ts:9-33.

~~~
export const crawlerTaskTemplates = {
  manga: {
    entrypoint: 'manga-crawler',
    permissionResource: 'comic',
    templateKey: 'manga',
    templateVersion: 1,
  },
  movie: {
    entrypoint: 'movie-crawler',
    permissionResource: 'movie',
    templateKey: 'movie',
    templateVersion: 1,
  },
} as const satisfies Record<CrawlerTaskTemplateKey, CrawlerTaskTemplate>

export function createCrawlerTaskSnapshot(templateKey: CrawlerTaskTemplateKey): CrawlerTaskSnapshot {
  return Object.freeze({ ...getCrawlerTaskTemplate(templateKey) })
}
~~~

Keep template/entrypoint/permission unions closed (types.ts:9-19), use satisfies and Object.freeze, and add a separate provider snapshot type rather than accepting Record<string, unknown>. The provider mapper should hold fixed workflow path, repository, ref, Environment, target, template, SHA, GitHub run ID and GitHub run attempt. The API accepts only movie or manga; caller workflow, ref, URL, command, and secret fields are rejected.

### apps/api/src/domain/crawler-tasks/reconciliation.ts

**Analog:** repository.ts:766-784 (bounded sweep) and repository.ts:696-763 (event/replay/CAS path).

~~~
const currentNow = toUnixSeconds(now())
const expired = await d1.prepare('SELECT id FROM crawler_run WHERE status IN (dispatching, running, cancel_requested) AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?')
  .bind(currentNow).all()

for (const run of expired.results ?? []) {
  const decision = await applyTransition(run.id, { actor: 'scheduler', type: 'lease_expired' })
  if (decision.kind === 'transition' && decision.nextStatus === 'failed')
    failed.push(run.id)
}
~~~

Compose repository/state-machine methods; do not add a second state machine. Poll only the already-bound provider run. Append redacted provider_mismatch and provider_lost facts, use finite timeout/5xx retries, and fail closed after a named reconciliation window. Inject clock/fetch for tests.

### GitHub App JWT and token/client modules

**Files:** apps/api/src/lib/github-app/jwt.ts, installation-token.ts, github-actions-client.ts.

**Crypto analog:** runner-event-auth.ts:12-17,53-73.

~~~
export function base64UrlEncode(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  let encoded = ''
  for (const byte of bytes) encoded += String.fromCharCode(byte)
  return btoa(encoded).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(keyConfig.secret),
  { hash: 'SHA-256', name: 'HMAC' },
  false,
  ['verify'],
)
~~~

Use Web Crypto in the same runtime style, but import PKCS#8 RSA and sign compact JWT header/claims with RSASSA-PKCS1-v1_5/SHA-256. Claims are short-lived, with backdated iat, bounded exp, and App ID iss. Unit-test claim bounds and malformed key handling.

**HTTP analog:** apps/api/src/routes/aria2/services/aria2-proxy.service.ts:47-78.

~~~
const response = await fetch(config.rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
  signal: AbortSignal.timeout(10000),
})
if (!response.ok)
  throw new Error('provider_request_failed')
~~~

Copy the timeout/response/error boundary for installation-token exchange and Actions REST operations. Mint one installation token per request, restrict repository/actions permission, and discard token material after the operation. Return safe reason codes: 408/429/5xx are bounded retryable; 401/403, invalid identity/template/target, or binding mismatch stop immediately. Never persist token, JWT, private key, response body, or Authorization header.

### apps/api/src/domain/crawler-tasks/state-machine.ts

**Analog:** state-machine.ts:31-45,90-145.

~~~
export function createManualRetryAttempt(input: {
  readonly attemptNumber: number
  readonly snapshot: CrawlerTaskSnapshot
  readonly status: CrawlerRunStatus
}) {
  if (input.status !== 'failed' && input.status !== 'cancelled')
    throw new Error('Only failed or cancelled runs may be retried')
  return { attemptNumber: input.attemptNumber + 1, snapshot: input.snapshot, status: 'queued' as const }
}
~~~

Preserve the transition matrix: queued cancel becomes cancelled; dispatching/running cancel becomes cancel_requested; a validated success receipt wins a cancel race with cancel_not_effective; stale/out-of-sequence events are audited. Provider cancel acknowledgement is not terminal. Keep business retry as a new attempt/new workflow run.

### apps/api/src/domain/crawler-tasks/repository.ts

**Analog:** repository.ts:271-337,339-464,466-527,533-593,648-763.

**Atomic task/run/lease creation** — repository.ts:271-316:

~~~
const existing = await findActiveLease(input.templateKey, currentNow)
if (existing)
  return { kind: 'existing_active_run', run: existing }
const snapshot = createCrawlerTaskSnapshot(input.templateKey)
await d1.batch([
  d1.prepare('INSERT INTO crawler_task (...) VALUES (...)').bind(...),
  d1.prepare('INSERT INTO crawler_run (...) VALUES (...)').bind(...),
  d1.prepare('INSERT INTO crawler_template_lease (...) VALUES (...)').bind(...),
])
~~~

**CAS update** — repository.ts:389-447:

~~~
UPDATE crawler_run
SET status = ?, state_version = ?, last_event_sequence = ?,
    lease_expires_at = ?, failure_code = ?, receipt_summary_json = ?,
    terminal_at = ?, updated_at = ?
WHERE id = ? AND status = ? AND state_version = ? AND last_event_sequence = ?
~~~

Add provider association writes to the same transaction/CAS boundary. Use typed lookup columns for GitHub run ID/attempt and immutable snapshot fields; keep redacted mismatch/reconciliation facts in existing transition/event audit tables. Preserve old logs and receipts on retry.

**Replay and receipt gate** — repository.ts:696-763:

~~~
if (run.attempt_number !== input.attempt)
  return { kind: 'attempt_mismatch' }
if (input.receipt && input.receipt.templateKey !== templateKey)
  return { kind: 'receipt_template_mismatch' }
const existing = await findRunnerEvent(input.runId, input.eventId, input.nonce)
if (existing)
  return classifyExistingRunnerEvent(existing, input)
~~~

Check provider association before this path, then reuse API-side receipt validation. Provider success alone is never enough.

### apps/api/src/schemas/crawler-run-events.ts

**Analog:** crawler-run-events.ts:1-20,25-33,49-70; schemas/crawler-tasks.ts:1-32.

~~~
const Identifier = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))
const Attempt = v.pipe(v.number(), v.integer(), v.minValue(1))

export const CrawlerRunEventSchema = v.strictObject({
  attempt: Attempt,
  event_id: Identifier,
  key_id: Identifier,
  nonce: Identifier,
  run_id: Identifier,
  sequence: v.pipe(v.number(), v.integer(), v.minValue(1)),
  timestamp: v.pipe(v.number(), v.integer()),
  type: v.picklist(['heartbeat', 'progress', 'log', 'succeeded', 'failed', 'cancelled']),
})
~~~

Extend with strict, discriminated schedule_register and provider_started objects. Bound workflow/repository/ref/Environment/template/target/SHA lengths and picklists. Reject arbitrary command, URL, workflow, or secret fields before repository mutation.

### apps/api/src/routes/admin/crawler-tasks/index.ts

**Analog:** index.ts:80-105,120-132,184-200.

~~~
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
~~~

Keep Better Auth session and template resource checks before dispatch/cancel/retry. Delegate lifecycle changes to repository first; only then call the provider client using the server-owned snapshot. Return D1 decision plus redacted provider outcome.

### apps/api/src/routes/internal/crawler-runs/index.ts

**Analog:** index.ts:60-77,89-108,111-156,158-208.

~~~
const rawBody = await c.req.arrayBuffer()
const signature = await verifySignedRequest(c, rawBody, currentNow)
const parsed = v.safeParse(CrawlerRunEventSchema, await parseRawJson(rawBody))
if (!parsed.success)
  throw new HTTPException(400, { message: 'Invalid runner event envelope' })
if (parsed.output.key_id !== signature.keyId || parsed.output.run_id !== c.req.param('runId'))
  throw new HTTPException(400, { message: 'Runner event identity mismatch' })
if (Math.abs(currentNow - parsed.output.timestamp) > MAX_EVENT_AGE_MS)
  throw new HTTPException(400, { message: 'Runner event timestamp expired' })
~~~

Reuse exact raw-body HMAC, key rotation, freshness, path/body identity, nonce/event ID, and sequence checks for schedule registration/provider-started callbacks. Redact provider metadata before repository writes and keep cancel_requested in responses so Actions can checkpoint cooperatively.

### apps/api/src/lib/auth.ts and apps/api/src/index.ts

**Analogs:** auth.ts:13-39 and index.ts:237-258.

Extend the explicit Worker Env interface with App ID, installation ID, private-key binding, repository owner/name/ID, and fixed workflow metadata. Keep provider secrets out of session DTOs.

For scheduled reconciliation copy the existing waitUntil handler:

~~~
export function createCrawlerTaskLogCleanupHandler(cleanup = purgeCrawlerTaskLogDetails) {
  return (_controller: unknown, env: AppEnv['Bindings'], context: ScheduledTaskContext) => {
    context.waitUntil(cleanup(env, new Date()))
  }
}
~~~

Compose reconciliation with the scheduled cleanup without replacing it; inject DB/clock/provider client and keep the polling window finite.

### packages/crawler/src/task-runner/actions-event-client.ts and runner-client.ts

**Analog:** runner-client.ts:17-23,30-37,39-96,99-115; event-signer.ts:3-9.

~~~
export interface RunnerClientConfig {
  readonly apiBaseUrl: string
  readonly callbackKeyId: string
  readonly callbackSecret: string
  readonly fetch?: typeof fetch
  readonly timeoutMs?: number
}

private async post(path: string, payload: Record<string, unknown>): Promise<unknown> {
  const body = JSON.stringify(payload)
  const response = await this.fetch(path, {
    body,
    headers: {
      'content-type': 'application/json',
      'x-runner-key-id': this.config.callbackKeyId,
      'x-runner-signature': signRunnerBody(body, this.config.callbackSecret),
    },
    method: 'POST',
    signal: AbortSignal.timeout(this.timeoutMs),
  })
  if (!response.ok)
    throw new Error('Runner control request failed')
  return response.json()
}
~~~

Keep one serialization/signature operation and an incrementing sequence. Add Actions methods for schedule registration, provider-started, progress/log, cancelled/failed, and terminal receipt. Reuse RunnerCandidate/snapshot; return cancel_requested from heartbeat/registration responses.

### packages/crawler/scripts/target-crawl-mutation.ts, movie/manga adapters

**Analogs:** target-crawl-mutation.ts:62-109,111-120; movie-adapter.ts:6-24; manga-adapter.ts:8-26.

~~~
const contextPath = environment.STARYE_PREPARED_CONTEXT_PATH
const entry = environment.STARYE_PREPARED_ENTRY
const operation = environment.STARYE_PREPARED_OPERATION
if (!contextPath || !entry?.startsWith('crawler-') || !operation)
  throw new Error('target-crawl-mutation requires a registry-owned prepared context.')
...
if (entry !== 'crawler-smoke-fixture' || operation !== 'smoke-fixture')
  throw new Error('target-crawl-mutation requires the registry-owned smoke operation.')
~~~

Preserve absolute context/config path checks, declared-secret checks, injected ApiClient, and guarded process.argv execution. Add only registry-owned optimized/comic production operations, with Actions event checkpoints and observed content IDs. Keep existing site-specific crawler constructors and synchronization callbacks; do not move Puppeteer into the Worker or duplicate transport.

### Workflows and target mutation registry

**Files:** .github/workflows/daily-movie-crawl.yml, .github/workflows/daily-manga-crawl.yml, packages/config/src/deployment-target/mutation-entry.ts.

**Analog:** each current workflow and mutation-entry.ts:17-112.

The workflow pattern is target input → resolve-target → target-profile validate → GitHub Environment → prepare-mutation → run-prepared-entry → if: always() cleanup (daily-movie-crawl.yml:3-65, manga:3-69). Keep STARYE_TARGET_ID: starye-org, fixed prepared entries (crawler-optimized/crawler-comic), generated config paths, and cleanup. Add registration/dispatch validation before crawler startup; remove manga's legacy free-form target_url.

mutation-entry.ts:66-112 already uses crawlerEntry(id, childOperation, mode, allowedOptions, requiredSecretKeys). Add no arbitrary options; update workflow/source contract tests to enumerate new callback steps while preserving closed entry and secret allowlists.

### Database schema and migration

**Files:** packages/db/src/schema.ts, packages/db/drizzle/0028_<provider-association>.sql.

**Analog:** schema.ts:334-439,651-696; 0027_crawler_task_domain_foundation.sql:1-98.

Copy typed Drizzle columns, enum constraints, indexes, relations, and generated SQL statement-breakpoints. Add provider lookup fields (GitHub run ID/attempt, workflow/repository/ref/Environment/SHA/status/conclusion) as typed columns or a one-to-one provider table; bounded JSON is for redacted provider facts only. Add uniqueness/index conditions for provider run ID + attempt and relations to crawlerRuns.

### Imports, validation, and test harnesses

**Domain/repository imports** — apps/api/src/domain/crawler-tasks/repository.ts:1-12:

~~~
import type { Database } from '@starye/db'
import type { CrawlerRunFailureCode, CrawlerRunReceipt, CrawlerRunState, CrawlerRunTransitionDecision } from './types'
import { validateReceiptCandidate } from './receipt-validation'
import { createManualRetryAttempt, decideCrawlerRunTransition, isTerminalCrawlerRunStatus } from './state-machine'
import { createCrawlerTaskSnapshot } from './template-registry'
~~~

Keep type-only imports for DB/domain contracts and import pure validators/state decisions before repository code. Route modules follow the same project aliases and Hono/Valibot boundary:

~~~
import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
~~~

**Test harness** — apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts:62-127:

~~~
async function createTestDatabase() {
  const client = createClient({ url: 'file::memory:' })
  const migration = await readFile(new URL('../../../../../../packages/db/drizzle/0027_crawler_task_domain_foundation.sql', import.meta.url), 'utf8')
  const statements = migration.split('--> statement-breakpoint').map(statement => statement.trim()).filter(Boolean)
  await client.batch(statements.map(sql => ({ sql })), 'write')
  return { client, db: createDb(new LibsqlD1(client) as never) }
}
~~~

For provider/reconciliation tests, retain the in-memory LibSQL/D1 adapter, inject deterministic createId/now, stub fetch responses, and assert SQL/event facts rather than relying on live GitHub. Route tests should use a Hono app with injected env/db/session doubles as in crawler-runs.route.test.ts:54-68 and crawler-tasks.route.test.ts:17-46. Workflow/static tests should read files from the repository and assert closed entries/environment/cleanup as in workflow-contract.test.ts:19-75.

## Shared Patterns

### Closed input and immutable provider snapshot

**Sources:** template-registry.ts:7-28, types.ts:21-33, mutation-entry.ts:84-112.

- API accepts only movie/manga; server resolves workflow, repository, main, target, Environment, and controlled entry.
- Dispatch carries only run_id, attempt, template, and target; workflow validates all four against the API association.
- No caller-provided command, URL, workflow, ref, Environment, or secret enters schemas or provider payloads.

### Independent HMAC, replay, and sequence

**Sources:** runner-event-auth.ts:53-73, routes/internal/crawler-runs/index.ts:60-77,158-208, runner-client.ts:79-115.

- Sign exact serialized bytes; include key ID, timestamp, nonce, event ID, run ID, attempt, and sequence.
- Verify current/previous key, freshness, strict schema, path/body identity, replay conflict, and sequence before D1 mutation.
- Keep provider callbacks on runner-event HMAC; never reuse CRAWLER_SECRET.

### D1 CAS, idempotency, and evidence

**Sources:** repository.ts:389-464,648-763, state-machine.ts:90-145, schema.ts:353-439.

- Repository/state machine are the lifecycle authority; provider APIs are evidence.
- Every transition uses status/version/sequence CAS; events use INSERT OR IGNORE plus body-hash conflict detection.
- Success requires provider success, exact app run/attempt/provider binding, and API-validated non-empty receipt.
- Dispatch HTTP success, process exit, provider conclusion alone, or late callback never creates a success receipt.

### Cancellation, retry, and provider loss

**Sources:** state-machine.ts:107-145, repository.ts:533-593, local-runner.ts:23-77.

- Cancel first records cancel_requested; provider cancel is asynchronous.
- Runner checkpoints and emits signed cancelled; validated success wins a cancel race and records cancel_not_effective.
- Manual retry creates a new D1 attempt/workflow run; old logs and receipts remain queryable.
- Reconciliation records provider_mismatch/provider_lost, then fail-closes after a finite window; automatic business retry stays off.

### Secrets, redaction, and target boundary

**Sources:** log-redaction.ts:14-45, auth.ts:13-39, target-profile.schema.ts:121-180, target-crawl-mutation.ts:31-39,86-109.

- Persist only reason codes, redacted IDs, safe summaries, and validated receipt fields.
- App private key/installation token stay in Worker/request or Environment scope; never D1/logs/receipt/session DTO.
- Continue validate → prepare-mutation → run-prepared-entry and always cleanup.
- Local acceptance uses Gateway http://localhost:8080; provider-backed evidence remains separate production proof.

## No Analog Found

| File / concern | Role | Data Flow | Planner direction |
|---|---|---|---|
| apps/api/src/lib/github-app/jwt.ts | utility | crypto / transform | No App JWT implementation exists. Copy Web Crypto/base64url mechanics from runner-event-auth.ts, add RS256/PKCS#8 claims, and test bounds. |
| apps/api/src/lib/github-app/installation-token.ts | service | request-response | No GitHub provider client exists. Copy aria2-proxy.service.ts timeout/response shape; mint and discard token per request. |
| apps/api/src/lib/github-app/github-actions-client.ts | service | request-response | No Actions REST wrapper exists. Use a closed method surface and provider failure classification; never scan arbitrary/latest runs. |
| apps/api/src/domain/crawler-tasks/reconciliation.ts | service | polling / event-driven | No provider polling loop exists. Compose repository CAS, state machine, and scheduled waitUntil with injected clock/fetch. |
| apps/api/src/domain/crawler-tasks/provider-association.ts | model | transform / persistence | No provider snapshot schema exists. Extend immutable task snapshots and add typed D1 association fields/indexes. |
| packages/crawler/src/task-runner/actions-event-client.ts | service | event-driven | Existing RunnerClient has local poll/claim/events only. Reuse signing/sequence and add schedule/provider event methods. |
| Production provider evidence / remote fixture | acceptance test | request-response / event-driven | Existing tests are local/stubbed. Keep Gateway/local contract tests separate from credentialed Actions proof; Phase 19 owns full sign-off. |

## Metadata

**Analog search scope:** apps/api/src/domain/crawler-tasks, apps/api/src/routes/{admin/crawler-tasks,internal/crawler-runs,aria2}, apps/api/src/{lib,schemas,index.ts}, packages/crawler/src/task-runner, packages/crawler/scripts, packages/config/src/deployment-target, packages/db/src/schema.ts, packages/db/drizzle, .github/workflows, and their __tests__ directories.  
**Primary source files read:** 32; current Phase 16/17 domain, route, runner, target, migration, workflow, and test analogs were read directly.  
**Pattern extraction date:** 2026-07-31.
