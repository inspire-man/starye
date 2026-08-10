# Phase 23: GitHub Actions Production Repair And Reconciliation - Pattern Map

**Mapped:** 2026-08-07
**Phase:** `23-github-actions-production-repair-and-reconciliation`
**Files analyzed:** 26 likely source, workflow, Dashboard, and focused-test files
**Analogs found:** 26 / 26 (25 exact analogs, 1 role-match test analog)

## Scope Interpretation

- Phase scope is movie `repair_players` through the existing GitHub Actions movie workflow.
- The server-owned repair snapshot remains authoritative for `operation`, movie identity, source revision, reason, and target intent.
- Workflow dispatch carries the existing binding envelope: `run_id`, `attempt`, `template`, and `target`.
- Provider acceptance, provider observation, runner terminal event, validated repair receipt, source projection, and actual playback remain separate facts.
- There is no `23-RESEARCH.md` in the phase directory. The context's canonical implementation references are the primary pattern sources.

## File Classification

| Likely New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/api/src/domain/crawler-tasks/types.ts` | model / contract | request-response + event-driven | current task/run contract module | exact |
| `apps/api/src/domain/crawler-tasks/provider-association.ts` | config / utility | request-response | current immutable provider registry | exact |
| `apps/api/src/domain/crawler-tasks/state-machine.ts` | utility / state machine | event-driven | current run transition state machine | exact |
| `apps/api/src/domain/crawler-tasks/repository.ts` | service / repository | CRUD + event-driven | current D1 task repository | exact |
| `apps/api/src/domain/crawler-tasks/reconciliation.ts` | service | polling + request-response | current provider reconciliation service | exact |
| `apps/api/src/domain/movies/source-reconciliation.ts` | service | CRUD + CAS + event-driven | current source observation/readback service | exact |
| `apps/api/src/domain/crawler-tasks/receipt-validation.ts` | utility / service | transform + readback | current receipt validator | exact |
| `apps/api/src/routes/admin/crawler-tasks/index.ts` | controller / route | request-response | current admin task and repair routes | exact |
| `apps/api/src/routes/internal/crawler-runs/index.ts` | controller / callback route | signed event-driven | current signed runner callback routes | exact |
| `apps/api/src/schemas/crawler-run-events.ts` | validation / config | request-response + event-driven | current strict Valibot envelopes | exact |
| `apps/api/src/lib/github-app/github-actions-client.ts` | provider service | request-response | current closed GitHub Actions client | exact |
| `packages/crawler/src/task-runner/template-adapters.ts` | registry / utility | transform + dispatch | current operation-aware adapter registry | exact |
| `packages/crawler/src/task-runner/repair-adapter.ts` | runner adapter | event-driven + source I/O | current local `repair_players` adapter | exact |
| `packages/crawler/src/task-runner/actions-event-client.ts` | runner client | signed event-driven | current Actions callback client | exact |
| `packages/crawler/src/task-runner/runner-client.ts` | runner client | request-response + event-driven | current poll/claim/receipt client | exact |
| `packages/crawler/scripts/target-crawl-mutation.ts` | production entrypoint | event-driven + source I/O | current production mutation runner | exact |
| `.github/workflows/daily-movie-crawl.yml` | workflow config | dispatch + event-driven | existing fixed movie workflow | exact |
| `apps/dashboard/src/lib/api.ts` | frontend API contract | request-response | current crawler task API client | exact |
| `apps/dashboard/src/views/Crawlers.vue` | component | polling + request-response | current task detail and attempt selector | exact |
| `apps/api/src/domain/crawler-tasks/__tests__/production-orchestration.integration.test.ts` | integration test | CRUD + event-driven | current production lifecycle harness | exact |
| `apps/api/src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts` | integration test | signed event-driven | current callback harness | exact |
| `apps/api/src/domain/movies/__tests__/source-reconciliation.integration.test.ts` | integration test | CRUD + CAS | current D1 source batch harness | role-match |
| `apps/api/src/lib/github-app/__tests__/github-actions-client.test.ts` | provider test | request-response | current dispatch/readback tests | exact |
| `packages/crawler/src/task-runner/__tests__/production-workflow.integration.test.ts` | workflow test | dispatch + signed event-driven | current workflow contract tests | exact |
| `packages/crawler/src/task-runner/__tests__/production-adapter.test.ts` | runner test | event-driven + lease | current production adapter tests | exact |
| `apps/dashboard/src/views/__test__/Crawlers.test.ts` | component test | polling + request-response | current Dashboard history/readiness tests | exact |

## Pattern Assignments

### Control-plane contracts and provider association

#### `apps/api/src/domain/crawler-tasks/types.ts` (model, request-response + event-driven)

**Analog:** the existing task/run contract module itself.

**Contract pattern** (lines 10-42, 51-101): keep operation, provider, run, and failure domains as separate typed unions. The existing contract already separates `repair_players` from ordinary templates and keeps provider summary redacted.

```typescript
export type CrawlerTaskOperation = CrawlerTaskTemplateKey | 'repair_players'
export type RepairPlayersReason = 'no_source' | 'source_failed'
export type RepairPlayersTargetIntent = 'restore_playable_sources'
export type CrawlerRunStatus = 'queued' | 'dispatching' | 'running' | 'cancel_requested' | 'succeeded' | 'failed' | 'cancelled'
export type CrawlerRunFailureCode =
  = | 'runner_lost' | 'runner_failed' | 'cancelled_by_runner'
    | 'receipt_missing' | 'provider_lost' | 'provider_failed'
```

```typescript
export interface ProviderAssociationSummary {
  readonly provider: ProviderName
  readonly providerRunId?: string
  readonly providerRunAttempt?: number
  readonly providerStatus?: ProviderRunStatus
  readonly providerConclusion?: ProviderRunConclusion
  readonly providerRunUrl?: string
  readonly repository?: 'inspire-man/starye'
  readonly workflow?: '.github/workflows/daily-manga-crawl.yml' | '.github/workflows/daily-movie-crawl.yml'
}
```

**Planner rule:** model task-level retry as an aggregate/history projection. Keep run status values unchanged; represent current attempt and older attempts through `CrawlerTaskDetailReadModel.runs` (lines 122-140), rather than adding a run-level `retry` enum.

#### `apps/api/src/domain/crawler-tasks/provider-association.ts` (config / utility, request-response)

**Analog:** `providerWorkflowRegistry`, `createProviderSnapshot`, and `createProviderDispatchInput` in the same file.

**Immutable registry** (lines 11-30, 134-158):

```typescript
const providerWorkflowRegistry = Object.freeze({
  movie: Object.freeze({
    crawlerEntrypoint: 'crawler-optimized',
    environment: 'starye-org', provider: 'github-actions', ref: 'main',
    repository: 'inspire-man/starye', target: 'starye-org',
    workflow: '.github/workflows/daily-movie-crawl.yml',
  }),
} as const satisfies Record<CrawlerTaskTemplateKey, Omit<ProviderSnapshot, 'templateKey'>>)
```

```typescript
export function createProviderDispatchInput(input: unknown): ProviderDispatchInput {
  const record = asRecord(input, 'provider_dispatch_input_invalid')
  requireExactKeys(record, ['attempt', 'runId', 'templateKey'], 'provider_dispatch_input_invalid')
  const snapshot = createProviderSnapshot(record.templateKey)
  return Object.freeze({
    attempt: requirePositiveInteger(record.attempt, 'provider_dispatch_input_invalid'),
    runId: requireRunId(record.runId, 'provider_dispatch_input_invalid'),
    target: snapshot.target,
    template: snapshot.templateKey,
  })
}
```

**Projection pattern** (lines 161-213): accept only allowlisted provider fields, reconstruct `providerRunUrl` from the fixed repository and numeric provider run ID, and reject a caller-supplied URL. Apply the same summary shape to every attempt, including retry attempts.

#### `apps/api/src/domain/crawler-tasks/state-machine.ts` (utility / state machine, event-driven)

**Analog:** `createManualRetryAttempt` and `decideCrawlerRunTransition` (lines 43-51, 112-183).

```typescript
export function createManualRetryAttempt(input: {
  readonly attemptNumber: number
  readonly snapshot: CrawlerTaskSnapshotUnion
  readonly status: CrawlerRunStatus
}) {
  if (input.status !== 'failed' && input.status !== 'cancelled')
    throw new Error('Only failed or cancelled runs may be retried')
  return { attemptNumber: input.attemptNumber + 1, snapshot: input.snapshot, status: 'queued' as const }
}
```

```typescript
case 'provider_lost':
  return transition(state, 'failed', 'provider_lost', { failureCode: 'provider_lost' })
case 'lease_expired':
  return transition(state, 'failed', 'runner_lost', { failureCode: 'runner_lost' })
```

**Planner rule:** extend failure classification at the repository/reconciliation boundary while preserving this run transition contract. Deterministic snapshot, authorization, identity, and receipt-contract failures stay terminal; transient dispatch/transport, timeout, provider lost, and lease expiry feed the single bounded retry policy.

#### `apps/api/src/domain/crawler-tasks/repository.ts` (service / repository, CRUD + event-driven)

**Analog:** the current repository is the primary analog for every control-plane change.

**Server-owned repair snapshot** (lines 930-963): validate the movie/reason/target tuple, reread `movie_source_state`, then create the snapshot from persisted `sourceRevision` before the D1 batch creates task, run, lease, and creation transition.

```typescript
if (operation === 'repair_players') {
  if (input.templateKey !== 'movie' || !input.movieId
    || input.targetIntent !== 'restore_playable_sources'
    || (input.reason !== 'no_source' && input.reason !== 'source_failed')) {
    throw new Error('repair task input is invalid')
  }
  const currentState = await readRepairTaskState(input.movieId)
  if (!currentState || currentState.reason !== input.reason)
    throw new Error('repair task source disposition is no longer repairable')
  snapshot = createCrawlerTaskSnapshot({
    movieId: input.movieId, operation: 'repair_players', reason: currentState.reason,
    sourceRevision: currentState.sourceRevision, targetIntent: 'restore_playable_sources',
  })
}
```

**Association and dispatch CAS** (lines 1022-1055, 1201-1262): insert provider association from `createProviderSnapshot`, claim the run with `dispatch_claim`, and persist the signed claim outcome through `INSERT OR IGNORE` runner-event storage.

**Run CAS transition** (lines 1058-1199): use `state_version` and `last_event_sequence` in both the transition audit insert and `UPDATE crawler_run`; on zero changed rows, reread and return `{ kind: 'stale', reasonCode: 'stale_event' }`. Keep this gate around callbacks from old attempts.

**Automatic/manual retry** (lines 642-652, 1268-1381): the current bounded predicate is the copy point for a one-time repair retry, while `createAutomaticRetryRun` and `retryRun` show the required new run ID, incremented attempt, fresh lease, task `latest_run_id`, and preserved old run facts.

```typescript
async function createAutomaticRetryRun(run: CrawlerRunRow, snapshot: CrawlerTaskSnapshotUnion): Promise<void> {
  const nextRunId = createId()
  const retry = createManualRetryAttempt({ attemptNumber: run.attempt_number, snapshot, status: 'failed' })
  await d1.batch([
    /* INSERT new queued crawler_run and crawler_template_lease */
    /* INSERT automatic_retry_created transition */
    /* UPDATE crawler_task.latest_run_id */
  ])
}
```

**Idempotent/stale event processing** (lines 1436-1614): first look up `(runId, eventId, nonce)`, classify identical body as `duplicate`, body/identity mismatch as `conflict`, validate provider association and repair source revision, then call `validateReceiptCandidate` before applying the transition. Keep accepted, duplicate, rejected, and conflict outcomes persisted as bounded facts.

**Provider success boundary** (lines 1817-1942): `recordProviderObservation` updates only the bound `(runId, applicationAttempt, providerRunId)` association; provider `completed/success` records `provider_success_pending_receipt`, while receipt success remains a separate signed application event.

**Task detail projection** (lines 768-828): query all runs ordered by `attempt_number DESC`, load each association, pass only allowlisted fields to `createProviderAssociationSummary`, and parse validated receipts. This is the server-side source for current-attempt focus plus bounded old-attempt history.

### Reconciliation, source CAS, and receipt validation

#### `apps/api/src/domain/crawler-tasks/reconciliation.ts` (service, polling + request-response)

**Analog:** `createCrawlerTaskReconciliationService` (lines 43-108).

```typescript
const result = await options.client.getWorkflowRun({
  providerRunId: candidate.providerRunId,
  snapshot: createProviderSnapshot(candidate.template),
})
if (result.ok) {
  await options.repository.recordProviderObservation({
    attempt: candidate.applicationAttempt,
    providerRunId: candidate.providerRunId,
    runId: candidate.runId,
    status: result.value.status,
    ...(result.value.conclusion ? { conclusion: result.value.conclusion } : {}),
  })
  return
}
if (shouldFailImmediately(result))
  await options.repository.failProviderReconciliation(candidate.runId, candidate.applicationAttempt, result.code)
if (result.retryable && candidate.reconciliationWindowEndsAt !== undefined && currentNow < candidate.reconciliationWindowEndsAt)
  return
await options.repository.expireProviderReconciliation(candidate.runId, candidate.applicationAttempt)
```

**Planner rule:** polling a transient error inside the window records a skipped observation; expiry invokes provider-lost/lease recovery after the window. The service itself does not create a business retry. Retry creation belongs to the repository lifecycle after the bounded failure fact is committed.

#### `apps/api/src/domain/movies/source-reconciliation.ts` (service, CRUD + CAS + event-driven)

**Analog:** `readRepairSourceReadback` and `acceptRepairSourceObservation`.

**Authoritative readback** (lines 319-345): reread `movie_source_state`, enforce the requested revision, cap rows, read append-only observations, and return only bounded health facts and counts. Raw player URLs stay inside this module.

```typescript
const state = await readState(input.db, input.movieId)
if (!state || boundedRevision(state.sourceRevision) !== boundedRevision(input.sourceRevision))
  throw new Error('source readback revision mismatch')
const observations = await readPersistedObservations(input.db, input.movieId, input.sourceRevision)
const sources = observations.map(boundedReadbackSource)
return {
  movieId: input.movieId,
  sourceRevision: boundedRevision(state.sourceRevision),
  observedAt: observedSeconds(state.observedAt, 0),
  sources,
  summary: { sourceCount: sources.length, eligibleCount: sources.filter(source => source.eligible).length },
}
```

**CAS batch** (lines 449-494, 497-599): update `movie_source_state` only when the expected source revision matches, optionally require run state/sequence CAS, append `movie_source_observation`, replace player rows only after the guarded change, and classify zero-change results as `duplicate` or `stale`.

**Post-commit projection** (lines 604-648): read the committed revision, return readback for accepted/duplicate/stale outcomes, and invalidate API/Gateway movie caches only after an accepted write. Preserve the returned `outcome`, `errorCode`, source projection, and readback as separate fields.

#### `apps/api/src/domain/crawler-tasks/receipt-validation.ts` (utility / service, transform + readback)

**Analog:** `validateReceiptCandidate` (lines 206-304) and `repairReceiptFromReadback` (lines 124-160).

```typescript
const repairCandidate = asRepairReceiptCandidate(candidate)
if (repairCandidate) {
  if (input.templateKey !== 'movie')
    return missing()
  if (snapshot && snapshot.operation !== 'repair_players')
    return missing()
  try {
    const readback = await readRepairSourceReadback({
      db: input.database as unknown as Parameters<typeof readRepairSourceReadback>[0]['db'],
      movieId: repairCandidate.movieId,
      sourceRevision: repairCandidate.sourceRevision,
    })
    const receipt = repairReceiptFromReadback(repairCandidate, readback)
    return receipt ? { ok: true, receipt } : missing()
  }
  catch {
    return missing()
  }
}
```

Match `movieId`, `sourceRevision`, `observedAt`, source count, and every bounded source health field before producing `RepairPlayersReceipt`. A runner-supplied success payload alone never becomes a validated receipt.

### API routes and signed callback envelopes

#### `apps/api/src/routes/admin/crawler-tasks/index.ts` (controller, request-response)

**Analog:** `dispatchCreatedRun` and the existing repair command/detail routes.

**Dispatch composition** (lines 67-93): resolve the GitHub client from server bindings, ensure association, claim the run, build snapshot-bound dispatch input, dispatch the fixed workflow, and map provider errors to bounded fields.

```typescript
const association = await repository.ensureProviderAssociation?.({
  attempt: input.attempt, runId: input.runId, template: input.template,
})
const decision = await repository.claimDispatch?.(input.runId)
const snapshot = createProviderSnapshot(input.template)
const result = await provider.dispatchWorkflow({
  dispatch: createProviderDispatchInput({ attempt: input.attempt, runId: input.runId, templateKey: input.template }),
  snapshot,
})
return { ...(association ? { association: { runId: association.runId, applicationAttempt: association.applicationAttempt } } : {}),
  ...(decision ? { decision } : {}), provider: projectProviderResult(result) }
```

**Repair command boundary** (lines 531-575): read current movie source disposition, compare the submitted reason, pass the fixed `operation` and `targetIntent` into `createOrGetActiveRun`, and return the bounded task/run projection. Reuse the same `dispatchCreatedRun` path for the resulting run.

**History projection** (lines 395-455, 618-658): for repair tasks, read all runs ordered by attempt, expose attempt/status/failure/receipt/source revision, and choose `runs[0]` as current. Extend this projection with provider/lease/reconciliation summaries while retaining the existing allowlist and same-movie identity.

#### `apps/api/src/routes/internal/crawler-runs/index.ts` (controller, signed event-driven)

**Analog:** `verifySignedRequest`, `provider-started`, `source-observation`, and lifecycle event routes.

**Signature and age guard** (lines 218-245, 295-334): verify the raw body before JSON parsing, select current/valid previous HMAC key, bind path/run/attempt/key ID, and enforce the five-minute request age.

```typescript
const signature = await verifyRunnerEventSignature({
  body: rawBody,
  keyId: c.req.header('x-runner-key-id') ?? '',
  keys,
  now: currentNow,
  signature: c.req.header('x-runner-signature') ?? '',
})
if (!signature.valid)
  throw new HTTPException(401, { message: 'Invalid runner signature' })
```

**Source observation boundary** (lines 464-561): validate the strict envelope, replay lookup by event ID/nonce/body hash, bind the event to the repair snapshot and expected source revision/sequence, invoke `acceptRepairSourceObservation`, then store and return a bounded observation outcome.

**Lifecycle boundary** (lines 564-615): normalize logs before repository processing, require a receipt only on `succeeded`, map the event to the state-machine event, and return the repository outcome with current cancel state. Keep `duplicate`, `stale`, and `conflict` responses stable for late callbacks.

#### `apps/api/src/schemas/crawler-run-events.ts` (validation / config, signed event-driven)

**Analog:** strict Valibot schemas in the same file (lines 24-64, 106-194).

```typescript
const RepairReceiptSchema = v.strictObject({
  movieId: Identifier,
  observedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  operation: v.literal('repair_players'),
  sourceRevision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
  sourceSummary: v.pipe(v.array(v.strictObject({
    eligible: v.boolean(), health: v.picklist(['inactive', 'unverified', 'failed']),
    observedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
    reasonCode: v.picklist(['source_inactive', 'source_unverified', 'source_candidate_invalid', 'source_read_failed', 'source_write_failed']),
    sourceType: v.picklist(['direct', 'magnet', 'TorrServer']),
  })), v.minLength(1), v.maxLength(50)),
})
```

Keep the repair snapshot strict and server-owned: `movie-crawler`, `movie`, `repair_players`, bounded `sourceRevision`, and `restore_playable_sources`. Dispatch fields stay limited to the existing `run_id`, `attempt`, `template`, and `target` workflow inputs.

### GitHub Actions provider and runner path

#### `apps/api/src/lib/github-app/github-actions-client.ts` (provider service, request-response)

**Analog:** `createGitHubActionsClient` (lines 107-118, 161-169, 174-229, 231-293).

**Binding validation:** `isSnapshotBound` validates provider, repository, environment, ref, and template workflow. `isDispatchBound` validates only the dispatch envelope against the snapshot. The client owns the installation token and HTTP headers.

**Bounded provider retry** (lines 180-218): classify abort/network/5xx responses as retryable, invoke `onRetry`, cap attempts, and map authorization, snapshot mismatch, invalid run ID, and malformed response to stable non-retryable codes.

**Dispatch body** (lines 232-259):

```typescript
body: JSON.stringify({
  inputs: {
    attempt: String(dispatch.attempt),
    run_id: dispatch.runId,
    target: dispatch.target,
    template: dispatch.template,
  },
  ref: snapshot.ref,
})
```

The client returns `dispatch_accepted` as provider acceptance only. `getWorkflowRun` returns status/conclusion/run attempt/head SHA/path for reconciliation; it does not upgrade crawler or repair state.

#### `packages/crawler/src/task-runner/template-adapters.ts` (registry / utility, transform + dispatch)

**Analog:** `createTemplateAdapterRegistry` (lines 25-60).

```typescript
if (snapshot.operation === 'repair_players') {
  if (snapshot.templateKey !== 'movie'
    || snapshot.entrypoint !== 'movie-crawler'
    || snapshot.permissionResource !== 'movie'
    || !snapshot.movieId.trim()
    || !Number.isSafeInteger(snapshot.sourceRevision)
    || snapshot.sourceRevision < 0
    || snapshot.targetIntent !== 'restore_playable_sources') {
    throw new Error('Repair runner snapshot does not match its operation')
  }
  if (!repairAdapter)
    throw new Error('Unsupported runner operation: repair_players')
  return repairAdapter
}
```

Ordinary template selection remains a separate branch. The production path should select from the claimed server snapshot after claim, preserving fail-closed operation/entrypoint/template checks.

#### `packages/crawler/src/task-runner/repair-adapter.ts` (runner adapter, event-driven + source I/O)

**Analog:** `createRepairPlayersAdapter` and `boundedReceipt` (lines 35-82, 99-133).

```typescript
if (receipt.operation !== 'repair_players'
  || receipt.movieId !== snapshot.movieId
  || receipt.sourceRevision <= snapshot.sourceRevision
  || receipt.observedAt !== response.readback.observedAt
  || response.readback.movieId !== snapshot.movieId
  || response.readback.sourceRevision !== receipt.sourceRevision
  || response.readback.sources.length !== receipt.sourceSummary.length) {
  throw new Error('repair_readback_identity_mismatch')
}
```

The adapter checkpoints before discovery, before callback, and before returning; empty sources map to `receipt_missing`; source stale/read/write errors map to bounded failure codes. Reuse this adapter contract for production and keep raw source details inside the controlled source client.

#### `packages/crawler/src/task-runner/actions-event-client.ts` (runner client, signed event-driven)

**Analog:** `ActionsEventClient.providerStarted`, `validateDispatch`, `lifecycle`, and `request` (lines 81-165, 167-197).

```typescript
private lifecycle(sequence: number, type: TerminalType | 'heartbeat' | 'log' | 'progress', extra = {}) {
  if (!this.config.runId || !this.config.attempt)
    throw new Error('Actions callback run binding missing')
  return this.request(`/api/internal/crawler-runs/${encodeURIComponent(this.config.runId)}/events`, {
    ...this.providerEnvelope(this.config.runId, this.config.attempt, {
      ...extra, attempt: this.config.attempt, run_id: this.config.runId, sequence, type,
    }),
  }, false)
}
```

`request` signs the exact JSON body and retries only retryable callback transport/5xx failures. Extend the client for `source_observation` through `RunnerClient` rather than adding an unsigned or unbound callback.

#### `packages/crawler/src/task-runner/runner-client.ts` (runner client, request-response + event-driven)

**Analog:** `parseRunnerSnapshot`, `poll`, `succeededRepair`, and `observeRepairSource` (lines 183-251, 274-310).

```typescript
async observeRepairSource(candidate: RunnerCandidate, sequence: number, input: RepairSourceObservationInput) {
  if (!isRepairRunnerSnapshot(candidate.snapshot))
    throw new Error('Source observation requires a repair runner snapshot')
  return this.post(`/api/internal/crawler-runs/${encodeURIComponent(candidate.runId)}/source-observation`, {
    ...this.controlEnvelope(),
    attempt: candidate.attempt,
    observed_at: input.observedAt ?? Math.floor(Date.now() / 1000),
    operation: 'repair_players', run_id: candidate.runId, sequence,
    source_revision: candidate.snapshot.sourceRevision, sources: input.sources,
    type: 'source_observation',
  }, { allowNonOk: true })
}
```

`parseRunnerSnapshot` is the validation source for the production candidate. Preserve `succeededRepair`'s movie/revision check and return sanitized receipt fields only.

#### `packages/crawler/scripts/target-crawl-mutation.ts` (production entrypoint, event-driven + source I/O)

**Analog:** `assertProductionBinding` and `runProductionCrawlerMutation` (lines 186-228, 268-356).

```typescript
const binding = assertProductionBinding(context, environment, production)
const client = dependencies.createActionsEventClient?.(environment) ?? createActionsEventClientFromEnvironment(environment)
const started = await client.providerStarted(binding)
if (!started.accepted)
  throw new Error('target-crawl-mutation rejected an unbound production provider.')
let sequence = 2
```

Preserve the existing provider-start, sequence-2 heartbeat, periodic lease heartbeat, cancellation checkpoint, bounded log, progress, and terminal callback order. The production extension point is the adapter selection: carry the polled repair snapshot into the candidate and select the registry-owned `repair_players` adapter after claim; avoid reconstructing an ordinary movie snapshot that drops movie identity/source revision.

`productionErrorDiagnostic` (lines 118-126) and the catch block (lines 358-370) are the redaction/error analog: redact declared secret values and emit bounded failure codes while keeping detailed crawler errors out of signed callbacks.

#### `.github/workflows/daily-movie-crawl.yml` (workflow config, dispatch + event-driven)

**Analog:** the existing movie workflow (lines 6-24, 62-107, 109-150).

**Input contract:** keep `run_id`, `attempt`, `template`, and `target` as the manual dispatch inputs. The `resolve-target` job validates the fixed target and produces the GitHub environment, run, attempt, and template outputs. The crawl job then binds secrets/environment and runs `validate-dispatch`, target preparation, entry execution, and cleanup in that order.

```yaml
inputs:
  run_id: { required: true, type: string }
  attempt: { required: true, type: string }
  template: { required: true, type: choice, options: [movie] }
  target: { required: true, type: string }
```

```yaml
- name: Validate manual dispatch binding
  if: github.event_name == 'workflow_dispatch'
  run: pnpm exec tsx packages/crawler/src/task-runner/actions-event-client.ts validate-dispatch
- id: prepare
  run: pnpm target-profile prepare-mutation --scope ci --target "${{ needs.resolve-target.outputs.target }}" --ci-environment "${{ needs.resolve-target.outputs.github_environment }}" --command crawler-optimized --run-id "${{ needs.resolve-target.outputs.run_id }}" --github-output "$GITHUB_OUTPUT"
- name: Run selected movie entry
  run: pnpm target-profile run-prepared-entry --entry crawler-optimized --prepared-context "${{ steps.prepare.outputs.prepared_context_path }}"
- name: Remove generated target files
  if: always()
  run: rm -f "${{ steps.prepare.outputs.api_config_path }}" "${{ steps.prepare.outputs.gateway_config_path }}" "${{ steps.prepare.outputs.prepared_context_path }}"
```

Production repair data comes from the claimed snapshot/callback path. Workflow inputs remain binding fields only; operation, movie identity, reason, source revision, and target intent stay server-owned.

### Dashboard projection and history

#### `apps/dashboard/src/lib/api.ts` (frontend API contract, request-response)

**Analog:** crawler types and methods (lines 197-373, 598-641).

Keep the typed split between `CrawlerProviderSummary`, `CrawlerRepairReceipt`, `CrawlerRun`, and `CrawlerTaskDetail`. `CrawlerRun` carries provider/readiness/receipt projections; `CrawlerRepairRun` carries attempt/status/failure/receipt/source revision. Extend these types with allowlisted lease/reconciliation/outcome fields rather than a raw provider payload.

```typescript
export interface CrawlerTaskDetail {
  task: CrawlerTask
  runs: CrawlerRun[]
}

getCrawlerTask: (taskId: string) =>
  apiFetch<CrawlerTaskDetail>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}`),
```

Use the existing encoded task/run paths for detail, safe logs, cancel, retry, and fixed repair command calls. `repairPlayers` receives only `confirmed`, `movieId`, `reason`, and `targetIntent`.

#### `apps/dashboard/src/views/Crawlers.vue` (component, polling + request-response)

**Analog:** `loadTaskPanel`, `latestRunFor`, current attempt selector, provider summary, and bounded source health blocks (lines 171-243, 265-278, 621-783).

```typescript
function latestRunFor(task: CrawlerTask): CrawlerRun | null {
  const runs = taskRuns(task)
  if (!runs.length)
    return null
  return runs.find(run => run.id === taskLatestRunId(task)) ?? runs[0] ?? null
}

if (document.visibilityState === 'visible') {
  void loadTaskPanel()
  taskRefreshInterval = setInterval(() => void loadTaskPanel(), 5000)
}
```

Current detail already focuses the latest run, lets the user select all attempts, renders provider status/conclusion/provider attempt, and renders bounded source health. Extend this surface so the current attempt remains focal while old attempts become expandable summaries containing attempt, run status, provider status/conclusion, lease result, receipt validation result, source revision, and late/stale outcome. Keep raw URL, command, secret, signature material, and raw runner JSON out of the component state and template.

The repair action pattern (lines 387-417) is the copy point for same-movie fixed command submission: derive reason/content ID from server readiness, call `api.admin.repairPlayers`, reload task detail, prepend the returned task, and select its current run.

### Cross-cutting redaction

#### `apps/api/src/domain/crawler-tasks/log-redaction.ts` (shared utility, transform)

**Analog:** `normalizeRunnerEventForStorage` (lines 9-37).

```typescript
export function normalizeRunnerEventForStorage(event: StorageSafeRunnerEvent) {
  const message = event.message ? truncateRunnerEventText(redactRunnerEventText(event.message)) : undefined
  const log = message && event.code && event.level
    ? { code: event.code, counts: event.counts, level: event.level, message }
    : undefined
  const terminalSummary = event.type === 'failed' || event.type === 'succeeded' || event.type === 'cancelled'
    ? message ?? event.code
    : undefined
  return { log, receipt: event.receipt, terminalSummary }
}
```

Reuse the safe-message and byte-bound limits for provider/runner failure facts. Provider summary construction and Dashboard DTO projection are additional allowlists, not raw JSON pass-through.

## Focused Test Pattern Assignments

### `apps/api/src/domain/crawler-tasks/__tests__/production-orchestration.integration.test.ts`

**Analog:** current libSQL/D1 harness and lifecycle tests (lines 51-112, 115-210, 213-315). Copy the fixture style: load the existing crawler/provider migrations, inject deterministic IDs and clock, create task, associate provider, claim dispatch, provider-start, runner sequence, validated receipt, and provider poll. Add Phase 23 cases for one automatic retry after the allowed transient/lease/provider-lost boundary, new provider association per attempt, old facts retained, and late callback rejection/append-only audit.

```typescript
await expect(repository.recordProviderObservation({
  attempt: 1, conclusion: 'success', providerRunAttempt: 1,
  providerRunId: '12345', runId, status: 'completed',
})).resolves.toEqual({ kind: 'updated', status: 'completed', conclusion: 'success' })
```

### `apps/api/src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts`

**Analog:** signed Hono harness, HMAC helper, and provider callback order (lines 101-147, 191-273). Extend with repair source-observation, identical replay, body-conflict replay, stale/out-of-sequence event, source revision mismatch, and old-attempt callback cases. Assert the route status/outcome and repository facts, not only response JSON.

### `apps/api/src/domain/movies/__tests__/source-reconciliation.integration.test.ts`

**Analog:** native D1 batch CAS test (lines 140-184). Use the existing `expectedRunStateVersion`, `expectedLastEventSequence`, `expectedSourceRevision` fixture and assert state revision, player rows, append-only observations, run version/sequence, and transition reason. Add a second attempt race where the older observation returns stale/duplicate and current projection remains at the winning revision.

### `apps/api/src/lib/github-app/__tests__/github-actions-client.test.ts`

**Analog:** fixed dispatch body, separated provider facts, and failure mapping (lines 32-160).

```typescript
expect(JSON.parse(String(calls[1].init?.body))).toEqual({
  inputs: { attempt: '2', run_id: 'run-1', target: 'starye-org', template: 'movie' },
  ref: 'main',
})
```

Retain tests for snapshot mismatch, one bounded 5xx retry, authorization failure, timeout/network retryability, and provider success as an observation rather than crawler success.

### `packages/crawler/src/task-runner/__tests__/production-workflow.integration.test.ts`

**Analog:** source-order assertions and signed event sequence (lines 35-70, 72-133). Assert the movie workflow still contains only the four fixed inputs, fixed target/environment, dispatch validation before execution, callback configuration, and cleanup. Add repair snapshot/adapter assertions while retaining the order `dispatch_validate -> provider_started -> heartbeat/checkpoints -> source_observation -> terminal receipt`.

### `packages/crawler/src/task-runner/__tests__/production-adapter.test.ts`

**Analog:** production binding fixture and event recorder (lines 17-112, 114-179, 223-270). Extend the fixture with a repair runner snapshot and `observeRepairSource`, then assert same run/attempt/provider tuple, fresh source revision/readback receipt, heartbeat renewal, cancellation checkpoint, bounded errors, and no secret/signature material in serialized callback requests.

### `apps/dashboard/src/views/__test__/Crawlers.test.ts`

**Analog:** visible polling and history tests (lines 88-141, 168-196, 198-254, 298-398, 400-430). Add current-attempt focal rendering plus expandable bounded older-attempt facts, provider/lease/reconciliation outcome separation, late/stale labels, same-movie navigation, and redaction sentinels. Preserve assertions that source readiness/readback and playback proof remain distinct.

## Shared Patterns

### Immutable provider registry

**Source:** `apps/api/src/domain/crawler-tasks/provider-association.ts:11-30,134-158`; `apps/api/src/lib/github-app/github-actions-client.ts:107-118,232-259`.

**Apply to:** admin dispatch, reconciliation, provider-started validation, workflow inputs, runner binding, and all provider DTOs.

- Resolve workflow/repository/ref/environment/target from the closed registry.
- Accept only `run_id`, `attempt`, and template identity from the dispatch command; derive target/template from the snapshot.
- Build provider run links from the allowlisted repository and numeric run ID.
- Keep `providerRunAttempt` separate from application `attempt`.

### Signed callback identity and replay

**Source:** `apps/api/src/routes/internal/crawler-runs/index.ts:218-235,464-561`; `apps/api/src/domain/crawler-tasks/runner-event-auth.ts:42-74`; `apps/api/src/domain/crawler-tasks/repository.ts:1436-1614`.

**Apply to:** provider-started, source observation, heartbeat, progress, log, and terminal events.

- Verify raw-body HMAC with current or still-valid previous key before parsing.
- Bind path run ID, application attempt, provider run ID/attempt, sequence, event ID, nonce, timestamp, and body hash.
- Persist identical replay as a stable duplicate outcome; persist body/identity mismatch as conflict; classify old/ordered events as stale/out-of-sequence.
- Keep late facts append-only while CAS prevents them from changing current task/source state.

### Attempt, lease, and retry lifecycle

**Source:** `repository.ts:642-652,1268-1381`; `state-machine.ts:43-51,112-183`; `reconciliation.ts:85-96`.

| Trigger | Current run fact | Retry timing | New records |
|---|---|---|---|
| transient dispatch/transport | bounded provider failure | one immediate retry | same task, new run/attempt/lease/provider association |
| timeout/provider lost/lease expiry | failed with provider/runner lost fact | after reconciliation window | same task, new run/attempt/lease/provider association |
| snapshot/authorization/receipt contract failure | terminal deterministic failure | no automatic retry | old run remains queryable; manual retry rereads disposition |
| provider completed/success | provider observation only | wait for matching signed validated receipt | receipt/source projection decides repair success |

The current attempt owns the task-level projection. Old runs retain logs, provider facts, receipts, source observations, and bounded rejection outcomes.

### Receipt and source readback boundary

**Source:** `apps/api/src/domain/crawler-tasks/receipt-validation.ts:124-160,206-245`; `apps/api/src/domain/movies/source-reconciliation.ts:324-345,449-648`; `packages/crawler/src/task-runner/repair-adapter.ts:41-82`.

**Apply to:** repair adapter, source-observation route, terminal callback, repository success, and Dashboard readiness.

- Require same `movieId`, a source revision greater than the snapshot revision, matching `observedAt`, equal source count, equal eligible count, and equal bounded source summaries.
- Write `movie_source_state`, player rows, and append-only observations under source/run CAS.
- Construct the public receipt only from committed readback.
- Keep source disposition, provider conclusion, receipt validation, repair status, and browser playback status as separate projections.

### Safe provider and Dashboard projection

**Source:** `provider-association.ts:161-213`; `repository.ts:768-828`; `apps/api/src/domain/crawler-tasks/log-redaction.ts:9-37`; `Crawlers.vue:776-797`.

**Apply to:** API DTOs, task history, attempt details, logs, and provider links.

- Allowlist provider, repository, workflow, ref, environment, provider run ID/attempt, status, conclusion, SHA, lease result, reconciliation result, receipt result, and source revision.
- Use bounded safe messages and log cursors; preserve older logs behind the existing bounded log endpoint.
- Exclude raw runner JSON, source URLs, commands, workflow controls, secrets, callback signatures, and authorization material.

### Dashboard polling and bounded history

**Source:** `apps/dashboard/src/views/Crawlers.vue:202-278,621-783`; `apps/dashboard/src/lib/api.ts:261-373,598-641`.

**Apply to:** current attempt focus and old-attempt expansion.

- Poll visible task details every five seconds and stop polling when hidden/unmounted.
- Select the run matching `latestRunId` as the focal current attempt; retain all bounded `runs` returned by the API for history.
- Render provider accepted/running/completed, repair success/failure, receipt validated/failed, and source revision separately.
- Keep same-movie navigation and fixed repair command inputs; the client supplies no provider controls.

## No Exact Analog / Planner Notes

| Concern | Closest pattern | Planning implication |
|---|---|---|
| Provider-lost or lease-expiry automatic retry after a reconciliation window | `reconciliation.ts` plus `repository.ts:createAutomaticRetryRun` | Compose the two existing boundaries; keep reconciliation polling free of direct business retry creation. |
| Operation-aware production adapter selection | `template-adapters.ts` plus `repair-adapter.ts`; current `target-crawl-mutation.ts` ordinary snapshot path | Thread the claimed repair snapshot through the existing production entrypoint and select the adapter after claim. |
| Expandable bounded old-attempt projection with lease/reconciliation fields | `repository.ts:getTaskDetail`, admin repair response, and current Dashboard attempt selector | Extend the existing safe DTOs and UI state; avoid a second history API unless the bounded payload becomes insufficient. |
| New schema or migration | Existing `0027`-`0030` crawler/provider/source migrations exercised by focused integration fixtures | No new schema file is implied by the phase context. First verify existing columns/indexes; introduce a migration only for a demonstrated missing fact. |

## Metadata

**Analog search scope:** `apps/api/src/domain/crawler-tasks`, `apps/api/src/domain/movies`, `apps/api/src/routes/admin/crawler-tasks`, `apps/api/src/routes/internal/crawler-runs`, `apps/api/src/lib/github-app`, `packages/crawler/src/task-runner`, `packages/crawler/scripts`, `apps/dashboard/src/lib`, `apps/dashboard/src/views`, `.github/workflows`.

**Files scanned:** the 26 candidate files above plus supporting `state-machine.ts` and `log-redaction.ts` references.
**Pattern extraction date:** 2026-08-07
