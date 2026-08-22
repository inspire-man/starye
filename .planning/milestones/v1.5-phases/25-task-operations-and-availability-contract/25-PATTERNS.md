# Phase 25: Task Operations And Availability Contract - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 2 likely modified files
**Analogs found:** 2 / 2

## Scope

This map covers only G-25-1. The persisted contract is behaving as designed: `crawler_availability_current` has one row per target/content identity, and admin task detail reads that row through its current owning `task_id`. The proof loses that ownership transfer after auxiliary supersede work and then queries the original task.

The narrow 25-06 implementation should modify only the proof orchestrator and its deterministic test. No API route, repository, schema, Dashboard component, runner, migration, UAT, or verification change is needed to repair this orchestration mismatch.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/phase25-dashboard-gateway-proof.ts` | utility / integration proof | request-response plus event-driven browser refresh | `scripts/phase24-production-proof.ts` | exact flow match |
| `scripts/phase25-dashboard-gateway-proof.test.ts` | test | request-response simulation plus ownership state transition | `scripts/phase24-production-proof.test.ts` | exact test-pattern match |

## Pattern Assignments

### `scripts/phase25-dashboard-gateway-proof.ts` (utility / integration proof, request-response plus browser refresh)

**Primary analog:** `scripts/phase24-production-proof.ts`

**Fresh ownership discovery pattern** (`scripts/phase24-production-proof.ts`, lines 540-570):

```typescript
const initialTaskIds = await collectTaskIds(page)
// ...perform the ownership-changing command...
const currentIdentity = parseFocalIdentity(currentText)
if (currentIdentity.taskId && currentIdentity.movie?.id === identity.movie.id
  && currentIdentity.taskId !== identity.taskId
  && !initialTaskIds.has(currentIdentity.taskId)
  && currentText.includes('repair_players')) {
  return { initialTaskIds, movie: identity.movie, taskId: currentIdentity.taskId }
}
```

Copy the semantic shape: capture the pre-action owner, extract the newly created task identity from authoritative command/readback data, and return that identity to the caller. Do not continue using the pre-action task id after the command has transferred ownership.

**Existing Phase 25 new-owner parser** (`scripts/phase25-dashboard-gateway-proof.ts`, lines 433-437):

```typescript
function supersededTaskId(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.task) || !isRecord(value.task.run))
    return null
  return boundedPhase25Identifier(value.task.run.taskId)
}
```

The proof already knows how to parse the new owner. Reuse this result rather than adding a second response parser or querying D1 directly.

**Existing action readback carries the ownership result** (`scripts/phase25-dashboard-gateway-proof.ts`, lines 461-487):

```typescript
const detail = await getTaskDetail(api, input.gatewayOrigin, taskId)
return {
  httpStatus: statusCode,
  kind: actionKind(body),
  lifecycleStatus: lifecycleForDetail(detail),
  runStatus: await runStatusForDetail(detail, runId),
  status: classifyPhase25ActionOutcome(statusCode, body),
  taskId: action === 'supersede' ? supersededTaskId(body) ?? taskId : taskIdFrom(body) ?? taskId,
}
```

Keep `Phase25ActionReadback.taskId` as the bounded source of truth. The narrow extension should make `executeActions()` return both the action map and the final authoritative owner task id (derived from `supersede.taskId`). A small named result type is preferable to an untyped tuple because the action map is also written into the matrix.

**Ownership-changing action sequence** (`scripts/phase25-dashboard-gateway-proof.ts`, lines 495-540):

```typescript
const supersede = await executeAction(/* ... */)
const createdSupersedeTaskId = supersede.taskId
if (createdSupersedeTaskId && createdSupersedeTaskId !== supersedeTask.taskId) {
  auxiliaryTaskIds.add(createdSupersedeTaskId)
  await waitForTerminalReadback(api, input, createdSupersedeTaskId, dependencies)
}

return { archive, cancel, metadata, retry, supersede }
```

This is the exact handoff point. Preserve the bounded wait and cleanup set, but return `createdSupersedeTaskId` (with an explicit checkpoint if the accepted supersede response does not expose a distinct task) so subsequent current readback follows the final owner.

**Cache comparison is already owner-agnostic** (`scripts/phase25-dashboard-gateway-proof.ts`, lines 259-267):

```typescript
const previous = availabilityForDetail(before)
const latest = availabilityForDetail(after)
if (!previous || !latest)
  return 'checkpoint'
const advanced = latest.current.projectionVersion > previous.current.projectionVersion
  && latest.current.observationIdentity !== previous.current.observationIdentity
const retained = latest.historyObservationIdentities.includes(previous.current.observationIdentity)
return advanced && retained ? 'passed' : 'checkpoint'
```

Do not weaken this classifier. It can compare details owned by different tasks because it compares persisted projection identity/version/history, not task identity. Feed it the original pre-action detail and the authoritative new-owner detail.

**Current broken caller to replace** (`scripts/phase25-dashboard-gateway-proof.ts`, lines 685-710):

```typescript
const actions = await executeActions(api, { ...input, targetId }, tuple.taskId, tuple.runId, dependencies)
const actionStatus = Object.values(actions).every(action => action.status === 'passed') ? 'passed' : 'checkpoint'
const beforeRefresh = await getTaskDetail(api, input.gatewayOrigin, tuple.taskId)
await (dependencies.refresh ?? (async currentPage => currentPage.reload({ waitUntil: 'domcontentloaded', timeout: input.timeoutMs ?? PHASE25_DEFAULT_TIMEOUT_MS })))(page)
const afterRefresh = await getTaskDetail(api, input.gatewayOrigin, tuple.taskId)
const cacheRefresh = classifyPhase25CacheRefresh(beforeRefresh, afterRefresh)
const afterAvailability = availabilityForDetail(afterRefresh)
if (!afterAvailability)
  throw new Phase25ProofCheckpointError('cache_refresh_availability_projection_missing')
const refreshedTuple = tupleFromPhase25TaskDetail(afterRefresh)
if (refreshedTuple.taskId !== tuple.taskId || refreshedTuple.runId !== tuple.runId || refreshedTuple.provider !== tuple.provider)
  throw new Phase25ProofCheckpointError('cache_refresh_tuple_changed')
```

Use the original terminal detail as the `before` availability snapshot. After `executeActions`, read and refresh through the returned owner task id. Replace the old invariant `refreshedTuple.taskId === tuple.taskId` with an ownership-aware invariant: target/content/provider/policy/revision continuity plus equality to the returned authoritative owner. Preserve the original fresh tuple separately if the matrix needs both proof origin and post-action owner; do not relabel the original tuple silently.

**Error handling pattern** (`scripts/phase25-dashboard-gateway-proof.ts`, lines 715-729):

```typescript
catch (error) {
  matrix = { ...matrix, outcome: 'checkpoint', reason: error instanceof Error ? error.message : String(error) }
}
finally {
  if (api && createdTaskId)
    matrix = { ...matrix, cleanup: await cleanupProofTask(api, input, createdTaskId, dependencies) }
  await session?.close?.()
}
```

Keep checkpoint semantics and final cleanup. The owner-tracking change must not turn a missing/ambiguous supersede identity into a pass. Auxiliary cleanup remains best effort, while the primary proof task cleanup remains matrix-visible.

---

### `scripts/phase25-dashboard-gateway-proof.test.ts` (test, request-response simulation plus ownership transition)

**Primary analog:** `scripts/phase24-production-proof.test.ts`

**Model old and new identities explicitly** (`scripts/phase24-production-proof.test.ts`, lines 28-65):

```typescript
interface FakeEnvironment {
  readonly freshTaskId: string
  dashboardFresh: boolean
  // ...
}

function focalText(environment: FakeEnvironment): string {
  const taskId = environment.dashboardFresh ? environment.freshTaskId : 'old-task'
  const runId = environment.dashboardFresh ? 'fresh-run' : 'old-run'
  return `...task ${taskId}\nrun ${runId}...`
}
```

Copy this state-transition pattern into the Phase 25 fake. Give it distinct original, auxiliary supersede-source, and superseded-owner task/run identities. The fake API should parse the requested task id from the URL and return the matching detail; it must return `current: null` for the original task after target-current ownership moves.

**Current fake anti-pattern to correct** (`scripts/phase25-dashboard-gateway-proof.test.ts`, lines 74-108):

```typescript
get = async (url: string): Promise<Phase24ApiResponse> => {
  // ...
  return new FakeResponse(200, detailFor(this.environment))
}

readonly post = async (url: string): Promise<Phase24ApiResponse> => {
  // ...
  return new FakeResponse(200, { kind, taskId: this.environment.taskId })
}
```

This collapses every task URL and supersede response into one identity, so it cannot reproduce G-25-1. Replace the single-detail fake with an id-keyed task map or a small route-aware state machine. For supersede, return the real response shape expected by `supersededTaskId()` (`task.run.taskId`) and move the target's current projection to that owner.

**Passed proof assertion pattern** (`scripts/phase25-dashboard-gateway-proof.test.ts`, lines 194-212):

```typescript
expect(result.outcome).toBe('passed')
expect(result.cacheRefresh).toBe('passed')
expect(result.checks).toMatchObject({
  actionReadback: 'passed',
  dashboardTrace: 'passed',
})
expect(result.auditCount).toBe(1)
```

Extend this test to assert that the supersede action reports the new task id, the post-refresh readback uses that id, and the matrix retains the intended original fresh tuple plus explicit authoritative-owner evidence. Keep the artifact forbidden-field assertions.

**Regression test required for the live failure:** add a focused case where:

1. The original task initially owns projection version 1.
2. Auxiliary actions culminate in a distinct superseded task owning projection version 2.
3. The original task detail returns `availability.current: null` after the move.
4. The new owner history retains the original observation identity.
5. The proof passes only by reading the new owner; forcing the original id yields `cache_refresh_availability_projection_missing` or a bounded ownership checkpoint.

## Shared Patterns

### Target-Unique Current, Task-Scoped Readback

**Schema source:** `packages/db/src/schema.ts`, lines 441-466

```typescript
/** One bounded current row per target/content identity; promotion is revision/policy CAS guarded by the API contract. */
export const crawlerAvailabilityCurrent = sqliteTable('crawler_availability_current', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => crawlerTasks.id),
  runId: text('run_id').notNull().references(() => crawlerRuns.id),
  attemptNumber: integer('attempt_number').notNull(),
  provider: text('provider', { enum: ['github-actions', 'local-proof'] }).notNull(),
  targetKind: text('target_kind', { enum: ['movie', 'manga', 'video', 'chapter', 'image'] }).notNull(),
  targetId: text('target_id').notNull(),
  contentId: text('content_id').notNull(),
```

```typescript
}, table => [
  uniqueIndex('idx_crawler_availability_current_target').on(table.targetKind, table.targetId, table.contentId),
  uniqueIndex('idx_crawler_availability_current_observation').on(table.observationIdentity),
  index('idx_crawler_availability_current_task_attempt').on(table.taskId, table.runId, table.attemptNumber),
  index('idx_crawler_availability_current_target_revision').on(table.targetKind, table.targetId, table.contentId, table.sourceRevision),
```

**Read-model source:** `apps/api/src/routes/admin/crawler-tasks/index.ts`, lines 555-567

```typescript
async function readTaskAvailability(c: any, taskId: string): Promise<{ current: AvailabilityCurrentProjection | null, history: AvailabilityHistoryEntry[] }> {
  const d1 = getD1(c)
  const [currentResult, observationsResult, eventsResult] = await Promise.all([
    d1.prepare(`
      SELECT task_id, run_id, attempt_number, provider, target_kind, target_id,
        content_id, source_revision, policy_version, observation_identity,
        event_sequence, projection_version, freshness, status, reason_code,
        next_action, summary_json, observed_at
      FROM crawler_availability_current
      WHERE task_id = ?
      ORDER BY observed_at DESC, projection_version DESC
      LIMIT 1
    `).bind(taskId).all<AvailabilityCurrentRow>().catch(() => ({ results: [] as AvailabilityCurrentRow[] })),
```

Apply this contract to all proof assertions: supersede can replace the target-unique current row's `task_id`, so old task detail correctly has no current. Do not change the API to make old tasks expose a current owned by another task.

### Canonical Boundary And Bounded Evidence

Retain the existing proof constants and guards at `scripts/phase25-dashboard-gateway-proof.ts:15-17, 635-649`, and retain `assertPhase25Redacted()` before matrix writes at lines 611-625. Ownership tracking adds only bounded task/run/observation identifiers; it must not add URLs, response bodies, cookies, tokens, signatures, provider payloads, or runtime paths.

### Cleanup Ownership

`executeActions()` already tracks every auxiliary task in `auxiliaryTaskIds` and cleans them in `finally` (`scripts/phase25-dashboard-gateway-proof.ts:503-540`). Preserve that set when returning the new owner. Archiving an auxiliary owner does not restore the old current owner, so cleanup and readback order must be explicit: obtain the final owner detail needed for proof before discarding its identity, then perform best-effort archive/cancel cleanup without pretending ownership reverted.

## No Analog Found

None. Both files have strong in-repository analogs. The required behavior is a composition of already-existing patterns: parse the supersede-created task id, follow a fresh task identity after an ownership-changing command, compare bounded projection versions/history, and keep cleanup/redaction intact.

## Metadata

**Analog search scope:** `scripts/*.ts`, `scripts/*.test.ts`, `apps/api/src/routes/admin/crawler-tasks/index.ts`, `packages/db/src/schema.ts`
**Files inspected for primary and supporting patterns:** 6
**Primary files:** `scripts/phase25-dashboard-gateway-proof.ts`, `scripts/phase25-dashboard-gateway-proof.test.ts`
**Supporting contract sources:** `scripts/phase24-production-proof.ts`, `scripts/phase24-production-proof.test.ts`, `apps/api/src/routes/admin/crawler-tasks/index.ts`, `packages/db/src/schema.ts`
**Pattern extraction date:** 2026-08-11
