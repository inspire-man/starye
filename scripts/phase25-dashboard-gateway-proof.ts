import type { Phase24ApiResponse, Phase24BrowserSession, Phase24Page } from './phase24-production-proof'
import { mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { defaultBrowserFactory } from './phase24-production-proof'
import {
  assertPhase25Redacted,
  boundedPhase25Identifier,
  createPhase25TaskOperationsFixture,
  redactedPhase25Summary,
  tupleFromPhase25TaskDetail,
} from './phase25-task-operations-fixture'

export const PHASE25_GATEWAY_ORIGIN = 'http://localhost:8080' as const
export const PHASE25_DASHBOARD_PATH = '/dashboard/crawlers' as const
export const PHASE25_DEFAULT_TIMEOUT_MS = 30_000

const PHASE25_HISTORY_OUTCOMES = ['duplicate', 'conflict', 'stale', 'late'] as const
const PHASE25_ACTION_NAMES = ['metadata', 'archive', 'supersede', 'cancel', 'retry'] as const
const PHASE25_ACTION_KINDS = new Set([
  'accepted',
  'archived',
  'cancel_requested',
  'conflict',
  'created',
  'duplicate',
  'existing_active_run',
  'idempotent',
  'late',
  'rejected',
  'stale',
  'updated',
])

type Phase25HistoryOutcome = typeof PHASE25_HISTORY_OUTCOMES[number]
export type Phase25CheckStatus = 'passed' | 'failed' | 'checkpoint' | 'pending'
export type Phase25ProofOutcome = Exclude<Phase25CheckStatus, 'pending'>
export type Phase25ActionName = typeof PHASE25_ACTION_NAMES[number]

export interface Phase25ApiRequestContext {
  readonly get: (url: string) => Promise<Phase24ApiResponse>
  readonly patch: (url: string, options: { readonly data: unknown }) => Promise<Phase24ApiResponse>
  readonly post: (url: string, options: { readonly data?: unknown }) => Promise<Phase24ApiResponse>
}

export interface Phase25BrowserFactoryInput {
  readonly browserProfile?: string
  readonly cdpUrl?: string
}

export type Phase25BrowserFactory = (input: Phase25BrowserFactoryInput) => Promise<Phase24BrowserSession>

export interface Phase25ProofInput {
  readonly browserProfile?: string
  readonly cdpUrl?: string
  readonly evidenceRoot?: string
  readonly gatewayOrigin: string
  readonly seed?: string
  readonly targetId?: string
  readonly timeoutMs?: number
  readonly pollIntervalMs?: number
}

export interface Phase25ProofDependencies {
  readonly browserFactory?: Phase25BrowserFactory
  readonly now?: () => number
  readonly refresh?: (page: Phase24Page) => Promise<void>
  readonly sleep?: (milliseconds: number) => Promise<void>
}

export interface Phase25ActionReadback {
  readonly httpStatus: number | null
  readonly kind: string | null
  readonly lifecycleStatus: string | null
  readonly runStatus: string | null
  readonly status: Phase25CheckStatus
  readonly taskId: string | null
}

interface Phase25ActionsResult {
  readonly actions: Readonly<Record<Phase25ActionName, Phase25ActionReadback>>
  readonly auditCount: number
  readonly authoritativeOwnerTaskId: string
}

export interface Phase25AvailabilityReadback {
  readonly current: {
    readonly freshness: string
    readonly observationIdentity: string
    readonly policyVersion: string
    readonly projectionVersion: number
    readonly reasonCode: string
    readonly sourceRevision: number
    readonly status: string
  }
  readonly historyOutcomes: readonly Phase25HistoryOutcome[]
  readonly historyObservationIdentities: readonly string[]
}

export interface Phase25CleanupReadback {
  readonly action: 'already_terminal' | 'cancelled' | 'not_started' | 'pending'
  readonly runId: string | null
  readonly runStatus: string | null
  readonly status: Phase25CheckStatus
  readonly taskId: string | null
}

export interface Phase25ProofMatrix {
  readonly schemaVersion: 1
  readonly outcome: Phase25ProofOutcome
  readonly gateway: typeof PHASE25_GATEWAY_ORIGIN
  readonly dashboardPath: typeof PHASE25_DASHBOARD_PATH
  readonly tuple: ReturnType<typeof tupleFromPhase25TaskDetail> | null
  readonly availability: Phase25AvailabilityReadback | null
  readonly auditCount: number
  readonly actions: Readonly<Record<Phase25ActionName, Phase25ActionReadback>>
  readonly checks: Readonly<Record<string, Phase25CheckStatus>>
  readonly cacheRefresh: Phase25CheckStatus
  readonly cleanup: Phase25CleanupReadback
  readonly matrixPath?: string
  readonly reason?: string
}

export class Phase25ProofCheckpointError extends Error {
  readonly outcome = 'checkpoint' as const

  constructor(message: string) {
    super(message)
    this.name = 'Phase25ProofCheckpointError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function boundedInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function recordString(record: Record<string, unknown>, key: string): string | null {
  return typeof record[key] === 'string' ? record[key] as string : null
}

function recordInteger(record: Record<string, unknown>, key: string): number | null {
  return boundedInteger(record[key])
}

function phase25Path(pathname: string, gatewayOrigin: string = PHASE25_GATEWAY_ORIGIN): string {
  if (!pathname.startsWith('/'))
    throw new Error('phase25_path_must_be_relative')
  return `${gatewayOrigin}${pathname}`
}

function pathIsCanonical(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.origin === PHASE25_GATEWAY_ORIGIN
  }
  catch {
    return false
  }
}

async function readJson(response: Phase24ApiResponse, action: string): Promise<unknown> {
  const status = response.status()
  if (status < 200 || status >= 300)
    throw new Phase25ProofCheckpointError(`${action}_http_${status}`)
  try {
    return await response.json()
  }
  catch {
    throw new Phase25ProofCheckpointError(`${action}_json_unavailable`)
  }
}

function actionKind(value: unknown): string | null {
  if (!isRecord(value))
    return null
  const kind = recordString(value, 'kind')
  if (kind && PHASE25_ACTION_KINDS.has(kind))
    return kind
  const decision = isRecord(value.decision) ? value.decision : null
  const decisionKind = decision ? recordString(decision, 'kind') : null
  if (decisionKind === 'transition')
    return 'accepted'
  return decisionKind && PHASE25_ACTION_KINDS.has(decisionKind) ? decisionKind : null
}

export function classifyPhase25ActionOutcome(status: number, value: unknown): Phase25CheckStatus {
  const kind = actionKind(value)
  if (kind)
    return PHASE25_ACTION_KINDS.has(kind) ? 'passed' : 'checkpoint'
  if (status >= 200 && status < 300)
    return 'passed'
  return 'checkpoint'
}

function taskIdFrom(value: unknown): string | null {
  if (!isRecord(value))
    return null
  const direct = boundedPhase25Identifier(value.taskId)
  if (direct)
    return direct
  const task = isRecord(value.task) ? boundedPhase25Identifier(value.task.id) : null
  if (task)
    return task
  const run = isRecord(value.run) ? boundedPhase25Identifier(value.run.taskId) : null
  return run
}

function runIdFromDetail(detail: unknown): string | null {
  if (!isRecord(detail))
    return null
  const task = isRecord(detail.task) ? detail.task : null
  const latestRunId = task ? boundedPhase25Identifier(task.latestRunId ?? task.latest_run_id) : null
  const runs = Array.isArray(detail.runs) ? detail.runs : []
  const latest = runs.find(candidate => isRecord(candidate) && candidate.id === latestRunId)
    ?? runs.find(isRecord)
  return isRecord(latest) ? boundedPhase25Identifier(latest.id) : null
}

function runForDetail(detail: unknown, runId: string | null): Record<string, unknown> | null {
  if (!isRecord(detail) || !Array.isArray(detail.runs))
    return null
  const candidate = detail.runs.find(run => isRecord(run) && (!runId || run.id === runId))
  return isRecord(candidate) ? candidate : null
}

function lifecycleForDetail(detail: unknown): string | null {
  if (!isRecord(detail))
    return null
  const lifecycle = isRecord(detail.lifecycle) ? detail.lifecycle : isRecord(detail.task) && isRecord(detail.task.lifecycle) ? detail.task.lifecycle : null
  return lifecycle ? recordString(lifecycle, 'status') : null
}

function availabilityForDetail(detail: unknown): Phase25AvailabilityReadback | null {
  if (!isRecord(detail) || !isRecord(detail.availability) || !isRecord(detail.availability.current))
    return null
  const current = detail.availability.current
  const projectionVersion = recordInteger(current, 'projectionVersion')
  const sourceRevision = recordInteger(current, 'sourceRevision')
  const observationIdentity = boundedPhase25Identifier(current.observationIdentity)
  const freshness = recordString(current, 'freshness')
  const policyVersion = boundedPhase25Identifier(current.policyVersion)
  const reasonCode = boundedPhase25Identifier(current.reasonCode)
  const status = boundedPhase25Identifier(current.status)
  const history = Array.isArray(detail.availability.history) ? detail.availability.history : []
  if (projectionVersion === null || sourceRevision === null || !observationIdentity || !freshness || !policyVersion || !reasonCode || !status)
    return null
  const historyOutcomes = history
    .map(entry => isRecord(entry) ? entry.kind : null)
    .filter((kind): kind is Phase25HistoryOutcome => typeof kind === 'string' && (PHASE25_HISTORY_OUTCOMES as readonly string[]).includes(kind))
  const historyObservationIdentities = history
    .map(entry => isRecord(entry) && isRecord(entry.observation) ? boundedPhase25Identifier(entry.observation.observationIdentity) : null)
    .filter((identity): identity is string => Boolean(identity))
  return {
    current: { freshness, observationIdentity, policyVersion, projectionVersion, reasonCode, sourceRevision, status },
    historyObservationIdentities,
    historyOutcomes,
  }
}

export function classifyPhase25CacheRefresh(before: unknown, after: unknown): Phase25CheckStatus {
  const previous = availabilityForDetail(before)
  const latest = availabilityForDetail(after)
  if (!previous || !latest)
    return 'checkpoint'
  const advanced = latest.current.projectionVersion > previous.current.projectionVersion
    && latest.current.observationIdentity !== previous.current.observationIdentity
  const retained = latest.historyObservationIdentities.includes(previous.current.observationIdentity)
  return advanced && retained ? 'passed' : 'checkpoint'
}

function actionBase(status: Phase25CheckStatus = 'pending'): Phase25ActionReadback {
  return { httpStatus: null, kind: null, lifecycleStatus: null, runStatus: null, status, taskId: null }
}

function matrixBase(_input: Phase25ProofInput): Phase25ProofMatrix {
  return {
    actions: Object.fromEntries(PHASE25_ACTION_NAMES.map(name => [name, actionBase()])) as Record<Phase25ActionName, Phase25ActionReadback>,
    auditCount: 0,
    availability: null,
    cacheRefresh: 'pending',
    cleanup: { action: 'not_started', runId: null, runStatus: null, status: 'pending', taskId: null },
    checks: {
      actionReadback: 'pending',
      availabilityCurrent: 'pending',
      availabilityHistory: 'pending',
      canonicalOrigin: 'pending',
      dashboardCommand: 'pending',
      dashboardSession: 'pending',
      dashboardTrace: 'pending',
      freshTuple: 'pending',
      redaction: 'pending',
      receiptReadback: 'pending',
      taskDetail: 'pending',
      taskList: 'pending',
    },
    dashboardPath: PHASE25_DASHBOARD_PATH,
    gateway: PHASE25_GATEWAY_ORIGIN,
    outcome: 'checkpoint',
    schemaVersion: 1,
    tuple: null,
  }
}

async function getTaskList(api: Phase25ApiRequestContext, gatewayOrigin: string): Promise<Set<string>> {
  const body = await readJson(await api.get(phase25Path('/api/admin/crawler-tasks?template=movie&limit=50', gatewayOrigin)), 'task_list')
  if (!isRecord(body) || !Array.isArray(body.tasks))
    throw new Phase25ProofCheckpointError('task_list_shape_invalid')
  return new Set(body.tasks.map(task => isRecord(task) ? boundedPhase25Identifier(task.id) : null).filter((id): id is string => Boolean(id)))
}

async function getTaskDetail(api: Phase25ApiRequestContext, gatewayOrigin: string, taskId: string): Promise<Record<string, unknown>> {
  const body = await readJson(await api.get(phase25Path(`/api/admin/crawler-tasks/${encodeURIComponent(taskId)}`, gatewayOrigin)), 'task_detail')
  if (!isRecord(body) || taskIdFrom(body) !== taskId)
    throw new Phase25ProofCheckpointError('task_detail_identity_mismatch')
  return body
}

async function preflightMovieTarget(api: Phase25ApiRequestContext, gatewayOrigin: string, targetId: string): Promise<void> {
  const body = await readJson(await api.get(phase25Path(`/api/admin/movies/${encodeURIComponent(targetId)}`, gatewayOrigin)), 'movie_target_preflight')
  if (!isRecord(body)
    || boundedPhase25Identifier(body.id) !== targetId
    || !boundedPhase25Identifier(body.code)
    || typeof body.title !== 'string'
    || body.title.trim().length === 0) {
    throw new Phase25ProofCheckpointError('proof_target_movie_not_found_or_invalid')
  }
}

function terminalRunStatus(value: string | null): boolean {
  return value === 'succeeded' || value === 'failed' || value === 'cancelled'
}

function hasCompleteAvailabilityReadback(detail: Record<string, unknown>): boolean {
  const availability = availabilityForDetail(detail)
  return Boolean(availability
    && availability.current.status === 'available'
    && PHASE25_HISTORY_OUTCOMES.every(outcome => availability.historyOutcomes.includes(outcome)))
}

function hasValidatedMovieReceipt(run: Record<string, unknown>, targetId: string, sourceRevision: number): boolean {
  const receipt = isRecord(run.receipt) ? run.receipt : null
  if (!receipt || recordString(receipt, 'primaryContentId') !== targetId || recordString(receipt, 'templateKey') !== 'movie')
    return false
  const source = isRecord(receipt.source) ? receipt.source : null
  const receiptSourceRevision = recordInteger(receipt, 'sourceRevision') ?? (source ? recordInteger(source, 'sourceRevision') : null)
  return receiptSourceRevision === sourceRevision
}

async function waitForTerminalReadback(
  api: Phase25ApiRequestContext,
  input: Phase25ProofInput,
  taskId: string,
  dependencies: Phase25ProofDependencies,
): Promise<Record<string, unknown>> {
  const now = dependencies.now ?? Date.now
  const deadline = now() + (input.timeoutMs ?? PHASE25_DEFAULT_TIMEOUT_MS)
  const sleep = dependencies.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))
  let latest: Record<string, unknown> | null = null
  while (now() <= deadline) {
    latest = await getTaskDetail(api, input.gatewayOrigin, taskId)
    const runId = runIdFromDetail(latest)
    const run = runForDetail(latest, runId)
    const status = run ? recordString(run, 'status') : null
    if (status === 'failed' || status === 'cancelled')
      return latest
    if (status === 'succeeded' && hasCompleteAvailabilityReadback(latest))
      return latest
    await sleep(Math.min(input.pollIntervalMs ?? 1_000, 1_000))
  }
  if (latest) {
    const runId = runIdFromDetail(latest)
    const status = runForDetail(latest, runId) ? recordString(runForDetail(latest, runId)!, 'status') : null
    if (status === 'succeeded') {
      const availability = availabilityForDetail(latest)
      if (!availability)
        throw new Phase25ProofCheckpointError('availability_projection_missing')
      if (!PHASE25_HISTORY_OUTCOMES.every(outcome => availability.historyOutcomes.includes(outcome)))
        throw new Phase25ProofCheckpointError('availability_history_outcomes_incomplete')
    }
    throw new Phase25ProofCheckpointError(terminalRunStatus(status) ? 'terminal_readback_did_not_converge' : 'task_did_not_reach_terminal_state')
  }
  throw new Phase25ProofCheckpointError('task_detail_was_never_read_back')
}

async function createFreshTask(
  api: Phase25ApiRequestContext,
  input: Phase25ProofInput,
  fixture: ReturnType<typeof createPhase25TaskOperationsFixture>,
  beforeIds: ReadonlySet<string>,
): Promise<{ readonly detail: Record<string, unknown>, readonly taskId: string }> {
  const targetId = input.targetId
  if (typeof targetId !== 'string' || !boundedPhase25Identifier(targetId))
    throw new Phase25ProofCheckpointError('proof_target_id_required')
  await preflightMovieTarget(api, input.gatewayOrigin, targetId)
  const command = {
    idempotencyKey: `dashboard:phase25:${fixture.tuple.taskId}`,
    intent: { kind: 'crawl' },
    operation: 'movie',
    policyReference: 'dashboard/phase25-gateway-proof',
    policyVersion: 'v1',
    target: { id: targetId, kind: 'movie' },
    template: 'movie',
  }
  const response = await api.post(phase25Path('/api/admin/crawler-tasks', input.gatewayOrigin), { data: command })
  const body = await readJson(response, 'dashboard_task_create')
  if (!isRecord(body) || body.kind !== 'created')
    throw new Phase25ProofCheckpointError('fresh_task_creation_not_confirmed')
  const dispatch = isRecord(body.dispatch) ? body.dispatch : null
  const association = dispatch && isRecord(dispatch.association) ? dispatch.association : null
  const provider = dispatch && isRecord(dispatch.provider) ? dispatch.provider : null
  if (!association || association.provider !== 'local-proof' || !provider || provider.kind !== 'local-proof_queued')
    throw new Phase25ProofCheckpointError(provider?.kind === 'provider_not_configured' ? 'local_proof_provider_not_configured' : 'local_proof_dispatch_binding_missing')
  const taskId = taskIdFrom(body)
  if (!taskId || beforeIds.has(taskId))
    throw new Phase25ProofCheckpointError('fresh_task_identity_not_observed')
  const detail = await getTaskDetail(api, input.gatewayOrigin, taskId)
  return { detail, taskId }
}

async function createActionTask(
  api: Phase25ApiRequestContext,
  input: Phase25ProofInput,
  action: Phase25ActionName,
): Promise<{ readonly detail: Record<string, unknown>, readonly runId: string, readonly taskId: string }> {
  const seed = `phase25-action-${action}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`
  const beforeIds = await getTaskList(api, input.gatewayOrigin)
  const created = await createFreshTask(api, { ...input, seed }, createPhase25TaskOperationsFixture(seed, 'local-proof'), beforeIds)
  const runId = runIdFromDetail(created.detail)
  if (!runId)
    throw new Phase25ProofCheckpointError(`action_task_${action}_run_missing`)
  return { detail: created.detail, runId, taskId: created.taskId }
}

function supersededTaskId(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.task) || !isRecord(value.task.run))
    return null
  const candidates = [value.task.id, value.task.run.taskId]
    .map(boundedPhase25Identifier)
    .filter((taskId): taskId is string => Boolean(taskId))
  const distinct = new Set(candidates)
  return distinct.size === 1 ? [...distinct][0]! : null
}

async function cleanupActionTask(
  api: Phase25ApiRequestContext,
  input: Phase25ProofInput,
  taskId: string,
  dependencies: Phase25ProofDependencies,
): Promise<void> {
  try {
    await cleanupProofTask(api, input, taskId, dependencies)
    const detail = await getTaskDetail(api, input.gatewayOrigin, taskId)
    if (lifecycleForDetail(detail) === 'active')
      await api.post(phase25Path(`/api/admin/crawler-tasks/${encodeURIComponent(taskId)}/archive`, input.gatewayOrigin), {})
  }
  catch {
    // Cleanup is best effort; the proof matrix retains the primary tuple and checkpoint outcome.
  }
}

async function runStatusForDetail(detail: unknown, runId: string | null): Promise<string | null> {
  const run = runForDetail(detail, runId)
  return run ? recordString(run, 'status') : null
}

async function executeAction(
  api: Phase25ApiRequestContext,
  input: Phase25ProofInput,
  taskId: string,
  runId: string,
  action: Phase25ActionName,
  request: () => Promise<Phase24ApiResponse>,
): Promise<Phase25ActionReadback> {
  try {
    const response = await request()
    const statusCode = response.status()
    let body: unknown = null
    try {
      body = await response.json()
    }
    catch {
      body = null
    }
    const detail = await getTaskDetail(api, input.gatewayOrigin, taskId)
    return {
      httpStatus: statusCode,
      kind: actionKind(body),
      lifecycleStatus: lifecycleForDetail(detail),
      runStatus: await runStatusForDetail(detail, runId),
      status: classifyPhase25ActionOutcome(statusCode, body),
      taskId: action === 'supersede' ? supersededTaskId(body) ?? taskId : taskIdFrom(body) ?? taskId,
    }
  }
  catch (error) {
    const candidate = error instanceof Error ? error.message.split('_http_')[0] : null
    const code = candidate && /^[a-z_]+$/iu.test(candidate) ? candidate : null
    return { ...actionBase('checkpoint'), kind: code ? `${action}:${code}` : null, taskId }
  }
}

async function executeActions(
  api: Phase25ApiRequestContext,
  input: Phase25ProofInput,
  taskId: string,
  runId: string,
  dependencies: Phase25ProofDependencies = {},
): Promise<Phase25ActionsResult> {
  const targetId = input.targetId ?? taskId
  const auxiliaryTaskIds = new Set<string>()
  try {
    const metadata = await executeAction(api, input, taskId, runId, 'metadata', () => api.patch(phase25Path(`/api/admin/crawler-tasks/${encodeURIComponent(taskId)}`, input.gatewayOrigin), { data: { description: 'phase25 fresh bounded proof', intent: 'availability-readback' } }))

    const cancellationTask = await createActionTask(api, input, 'cancel')
    auxiliaryTaskIds.add(cancellationTask.taskId)
    const cancel = await executeAction(api, input, cancellationTask.taskId, cancellationTask.runId, 'cancel', () => api.post(phase25Path(`/api/admin/crawler-tasks/${encodeURIComponent(cancellationTask.taskId)}/runs/${encodeURIComponent(cancellationTask.runId)}/cancel`, input.gatewayOrigin), {}))
    const cancelledDetail = await waitForTerminalReadback(api, input, cancellationTask.taskId, dependencies)
    const cancelledRunId = runIdFromDetail(cancelledDetail) ?? cancellationTask.runId
    const retry = await executeAction(api, input, cancellationTask.taskId, cancellationTask.runId, 'retry', () => api.post(phase25Path(`/api/admin/crawler-tasks/${encodeURIComponent(cancellationTask.taskId)}/runs/${encodeURIComponent(cancellationTask.runId)}/retry`, input.gatewayOrigin), { data: { confirmed: true } }))
    const retriedDetail = await waitForTerminalReadback(api, input, cancellationTask.taskId, dependencies)
    const retriedRunId = runIdFromDetail(retriedDetail) ?? cancelledRunId
    const archive = await executeAction(api, input, cancellationTask.taskId, retriedRunId, 'archive', () => api.post(phase25Path(`/api/admin/crawler-tasks/${encodeURIComponent(cancellationTask.taskId)}/archive`, input.gatewayOrigin), {}))

    const supersedeTask = await createActionTask(api, input, 'supersede')
    auxiliaryTaskIds.add(supersedeTask.taskId)
    await waitForTerminalReadback(api, input, supersedeTask.taskId, dependencies)
    const supersede = await executeAction(api, input, supersedeTask.taskId, supersedeTask.runId, 'supersede', () => api.post(phase25Path(`/api/admin/crawler-tasks/${encodeURIComponent(supersedeTask.taskId)}/supersede`, input.gatewayOrigin), {
      data: {
        idempotencyKey: `dashboard:phase25:supersede:${supersedeTask.taskId}`,
        intent: { kind: 'crawl' },
        operation: 'movie',
        policyReference: 'dashboard/phase25-gateway-proof',
        policyVersion: 'v1',
        target: { id: targetId, kind: 'movie' },
      },
    }))
    const authoritativeOwnerTaskId = boundedPhase25Identifier(supersede.taskId)
    if (supersede.status !== 'passed'
      || !authoritativeOwnerTaskId
      || authoritativeOwnerTaskId === taskId
      || authoritativeOwnerTaskId === supersedeTask.taskId) {
      throw new Phase25ProofCheckpointError('supersede_authoritative_owner_missing_ambiguous_or_non_distinct')
    }
    auxiliaryTaskIds.add(authoritativeOwnerTaskId)
    await waitForTerminalReadback(api, input, authoritativeOwnerTaskId, dependencies)

    const auditCounts = await Promise.all([
      readAuditCount(api, input, taskId),
      readAuditCount(api, input, cancellationTask.taskId),
      readAuditCount(api, input, supersedeTask.taskId),
    ])
    if (auditCounts.some(count => count <= 0))
      throw new Phase25ProofCheckpointError('task_scoped_action_audit_missing')

    return {
      actions: { archive, cancel, metadata, retry, supersede },
      auditCount: auditCounts.reduce((sum, count) => sum + count, 0),
      authoritativeOwnerTaskId,
    }
  }
  finally {
    await Promise.all([...auxiliaryTaskIds].map(auxiliaryTaskId => cleanupActionTask(api, input, auxiliaryTaskId, dependencies)))
  }
}

function assertAvailabilityOwnerContinuity(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  originalTuple: ReturnType<typeof tupleFromPhase25TaskDetail>,
): ReturnType<typeof tupleFromPhase25TaskDetail> {
  const previousAvailability = availabilityForDetail(before)
  const ownerAvailability = availabilityForDetail(after)
  if (!previousAvailability || !ownerAvailability)
    throw new Phase25ProofCheckpointError('availability_owner_projection_missing')
  const ownerTuple = tupleFromPhase25TaskDetail(after)
  const failedChecks = [
    ownerTuple.taskId !== originalTuple.taskId ? null : 'owner_task',
    ownerAvailability.current.policyVersion === previousAvailability.current.policyVersion ? null : 'policy_version',
    ownerAvailability.current.sourceRevision === previousAvailability.current.sourceRevision ? null : 'source_revision',
    ownerAvailability.current.observationIdentity !== previousAvailability.current.observationIdentity ? null : 'observation_identity',
    ownerAvailability.current.projectionVersion > previousAvailability.current.projectionVersion ? null : 'projection_version',
  ].filter((reason): reason is string => reason !== null)
  if (failedChecks.length > 0)
    throw new Phase25ProofCheckpointError(`availability_owner_projection_continuity_mismatch_${failedChecks.join('_')}`)
  return ownerTuple
}

async function readAuditCount(api: Phase25ApiRequestContext, input: Phase25ProofInput, taskId: string): Promise<number> {
  const body = await readJson(await api.get(phase25Path(`/api/admin/crawler-tasks/${encodeURIComponent(taskId)}/audit?limit=50`, input.gatewayOrigin)), 'task_audit')
  if (!isRecord(body) || !Array.isArray(body.audits) || body.audits.length > 50)
    throw new Phase25ProofCheckpointError('task_audit_shape_invalid')
  return body.audits.length
}

async function assertDashboardTrace(
  page: Phase24Page,
  tuple: ReturnType<typeof tupleFromPhase25TaskDetail>,
  availability: Phase25AvailabilityReadback,
  timeoutMs: number,
): Promise<void> {
  const focal = page.locator('[data-current-attempt-focal]')
  const lifecycle = page.locator('[data-section="task-lifecycle"]')
  const current = page.locator('[data-availability-current]')
  const history = page.locator('[data-availability-history]')
  const audit = page.locator('[data-evidence-section="audit"]')
  const required = [tuple.taskId, tuple.runId, String(tuple.attemptNumber), tuple.contentId, availability.current.observationIdentity, ...PHASE25_HISTORY_OUTCOMES]
  const pollIntervalMs = 250
  const attempts = Math.max(1, Math.ceil(timeoutMs / pollIntervalMs))
  let sectionsVisible = false

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    sectionsVisible = await focal.isVisible()
      && await lifecycle.isVisible()
      && await current.isVisible()
      && await history.isVisible()
      && await audit.isVisible()
    if (sectionsVisible) {
      const text = `${await focal.textContent() ?? ''} ${await current.textContent() ?? ''} ${await history.textContent() ?? ''} ${await audit.textContent() ?? ''}`
      if (required.every(value => text.includes(value))) {
        assertPhase25Redacted({ tuple, availability, history: PHASE25_HISTORY_OUTCOMES })
        return
      }
    }
    if (attempt + 1 < attempts)
      await page.waitForTimeout(pollIntervalMs)
  }

  throw new Phase25ProofCheckpointError(sectionsVisible ? 'dashboard_bounded_evidence_trace_mismatch' : 'dashboard_bounded_evidence_sections_missing')
}

async function cleanupProofTask(
  api: Phase25ApiRequestContext,
  input: Phase25ProofInput,
  taskId: string,
  dependencies: Phase25ProofDependencies,
): Promise<Phase25CleanupReadback> {
  try {
    let detail = await getTaskDetail(api, input.gatewayOrigin, taskId)
    let runId = runIdFromDetail(detail)
    let run = runForDetail(detail, runId)
    let runStatus = run ? recordString(run, 'status') : null
    if (!runId || !runStatus)
      return { action: 'pending', runId, runStatus, status: 'checkpoint', taskId }
    if (terminalRunStatus(runStatus))
      return { action: 'already_terminal', runId, runStatus, status: 'passed', taskId }

    const response = await api.post(phase25Path(`/api/admin/crawler-tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/cancel`, input.gatewayOrigin), {})
    if (response.status() < 200 || response.status() >= 300)
      return { action: 'cancelled', runId, runStatus, status: 'checkpoint', taskId }

    const cleanupInput = { ...input, timeoutMs: Math.min(input.timeoutMs ?? PHASE25_DEFAULT_TIMEOUT_MS, 5_000) }
    detail = await waitForTerminalReadback(api, cleanupInput, taskId, dependencies)
    runId = runIdFromDetail(detail)
    run = runForDetail(detail, runId)
    runStatus = run ? recordString(run, 'status') : null
    return {
      action: 'cancelled',
      runId,
      runStatus,
      status: runStatus === 'cancelled' ? 'passed' : 'checkpoint',
      taskId,
    }
  }
  catch {
    return { action: 'cancelled', runId: null, runStatus: null, status: 'checkpoint', taskId }
  }
}

async function writeMatrix(root: string, matrix: Phase25ProofMatrix): Promise<string> {
  if (!isAbsolute(root))
    throw new Phase25ProofCheckpointError('evidence_root_must_be_absolute')
  await mkdir(root, { recursive: true })
  const stem = matrix.tuple
    ? `${matrix.tuple.taskId}_${matrix.tuple.runId}_attempt-${matrix.tuple.attemptNumber}`
    : `checkpoint-${Date.now()}`
  const path = join(root, `phase25-dashboard-${stem.replace(/[^\w.-]+/gu, '-').slice(0, 160)}.matrix.json`)
  const evidence = {
    actions: matrix.actions,
    availability: matrix.availability,
    auditCount: matrix.auditCount,
    cacheRefresh: matrix.cacheRefresh,
    checks: matrix.checks,
    cleanup: matrix.cleanup,
    dashboardPath: matrix.dashboardPath,
    gateway: matrix.gateway,
    outcome: matrix.outcome,
    schemaVersion: matrix.schemaVersion,
    tuple: matrix.tuple,
  }
  assertPhase25Redacted({ actions: matrix.actions, availability: matrix.availability, auditCount: matrix.auditCount, cacheRefresh: matrix.cacheRefresh, checks: matrix.checks, cleanup: matrix.cleanup, tuple: matrix.tuple })
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  return path
}

export async function runPhase25DashboardGatewayProof(input: Phase25ProofInput, dependencies: Phase25ProofDependencies = {}): Promise<Phase25ProofMatrix> {
  let matrix = matrixBase(input)
  let session: Phase24BrowserSession | null = null
  let api: Phase25ApiRequestContext | undefined
  let createdTaskId: string | null = null
  try {
    if (input.gatewayOrigin !== PHASE25_GATEWAY_ORIGIN || !pathIsCanonical(input.gatewayOrigin))
      throw new Phase25ProofCheckpointError('canonical_gateway_origin_must_be_http_localhost_8080')
    matrix = { ...matrix, checks: { ...matrix.checks, canonicalOrigin: 'passed' } }
    const targetId = input.targetId
    if (!boundedPhase25Identifier(targetId))
      throw new Phase25ProofCheckpointError('proof_target_id_required')
    session = await (dependencies.browserFactory ?? (defaultBrowserFactory as unknown as Phase25BrowserFactory))({ browserProfile: input.browserProfile, cdpUrl: input.cdpUrl })
    const page = session.dashboardPage
    api = session.context.request as unknown as Phase25ApiRequestContext | undefined
    if (!api)
      throw new Phase25ProofCheckpointError('authenticated_dashboard_request_boundary_missing')
    await page.goto(phase25Path(PHASE25_DASHBOARD_PATH, input.gatewayOrigin), { waitUntil: 'domcontentloaded', timeout: input.timeoutMs ?? PHASE25_DEFAULT_TIMEOUT_MS })
    if (!pathIsCanonical(page.url()) || !await page.locator('.local-task-panel').isVisible())
      throw new Phase25ProofCheckpointError('dashboard_gateway_session_missing')
    matrix = { ...matrix, checks: { ...matrix.checks, dashboardSession: 'passed' } }

    const fixture = createPhase25TaskOperationsFixture(input.seed)
    const beforeIds = await getTaskList(api, input.gatewayOrigin)
    matrix = { ...matrix, checks: { ...matrix.checks, taskList: 'passed', dashboardCommand: 'passed' } }
    const created = await createFreshTask(api, { ...input, targetId }, fixture, beforeIds)
    createdTaskId = created.taskId
    matrix = { ...matrix, checks: { ...matrix.checks, taskDetail: 'passed' } }
    const terminalDetail = await waitForTerminalReadback(api, { ...input, targetId }, created.taskId, dependencies)
    const availability = availabilityForDetail(terminalDetail)
    if (!availability)
      throw new Phase25ProofCheckpointError('task_detail_availability_projection_missing')
    const tuple = tupleFromPhase25TaskDetail(terminalDetail)
    if (tuple.contentId !== targetId)
      throw new Phase25ProofCheckpointError('task_detail_content_identity_mismatch')
    const run = runForDetail(terminalDetail, tuple.runId)
    const receiptReadback = Boolean(run && hasValidatedMovieReceipt(run, targetId, tuple.sourceRevision))
    matrix = {
      ...matrix,
      availability,
      checks: { ...matrix.checks, availabilityCurrent: availability.current.status === 'available' ? 'passed' : 'failed', freshTuple: 'passed', receiptReadback: receiptReadback ? 'passed' : 'failed', redaction: 'passed' },
      tuple,
    }
    const runStatus = run ? recordString(run, 'status') : null
    if (!run || runStatus === null)
      throw new Phase25ProofCheckpointError('task_detail_latest_run_missing')
    if (runStatus === 'failed' || runStatus === 'cancelled' || availability.current.status === 'unavailable') {
      matrix = { ...matrix, checks: { ...matrix.checks, availabilityHistory: 'failed' }, outcome: 'failed', reason: 'fresh_tuple_authoritative_fact_failed' }
    }
    else if (runStatus !== 'succeeded' || !receiptReadback) {
      throw new Phase25ProofCheckpointError('provider_receipt_readback_not_converged')
    }
    else {
      if (!PHASE25_HISTORY_OUTCOMES.every(outcome => availability.historyOutcomes.includes(outcome)))
        throw new Phase25ProofCheckpointError('availability_history_outcomes_incomplete')
      matrix = { ...matrix, checks: { ...matrix.checks, availabilityHistory: 'passed' } }

      const beforeRefresh = terminalDetail
      const actionResult = await executeActions(api, { ...input, targetId }, tuple.taskId, tuple.runId, dependencies)
      const { actions, auditCount, authoritativeOwnerTaskId } = actionResult
      const actionStatus = Object.values(actions).every(action => action.status === 'passed') ? 'passed' : 'checkpoint'
      await (dependencies.refresh ?? (async currentPage => currentPage.reload({ waitUntil: 'domcontentloaded', timeout: input.timeoutMs ?? PHASE25_DEFAULT_TIMEOUT_MS })))(page)
      const afterRefresh = await getTaskDetail(api, input.gatewayOrigin, authoritativeOwnerTaskId)
      const afterAvailability = availabilityForDetail(afterRefresh)
      if (!afterAvailability)
        throw new Phase25ProofCheckpointError('cache_refresh_availability_projection_missing')
      const ownerTuple = assertAvailabilityOwnerContinuity(beforeRefresh, afterRefresh, tuple)
      const cacheRefresh = ownerTuple.taskId === tuple.taskId
        ? classifyPhase25CacheRefresh(beforeRefresh, afterRefresh)
        : 'passed'
      await assertDashboardTrace(page, ownerTuple, afterAvailability, input.timeoutMs ?? PHASE25_DEFAULT_TIMEOUT_MS)
      const safeSummary = redactedPhase25Summary(ownerTuple, afterRefresh)
      assertPhase25Redacted({ actions, auditCount, availability: afterAvailability, cacheRefresh, summary: safeSummary, tuple })
      matrix = {
        ...matrix,
        actions,
        auditCount,
        availability: afterAvailability,
        cacheRefresh,
        checks: { ...matrix.checks, actionReadback: actionStatus, dashboardTrace: 'passed', redaction: 'passed' },
        outcome: actionStatus === 'passed' && cacheRefresh === 'passed' && auditCount > 0 ? 'passed' : 'checkpoint',
        tuple,
      }
      if (matrix.outcome !== 'passed')
        matrix = { ...matrix, reason: 'action_or_cache_refresh_readback_incomplete' }
    }
  }
  catch (error) {
    matrix = { ...matrix, outcome: 'checkpoint', reason: error instanceof Error ? error.message : String(error) }
  }
  finally {
    if (api && createdTaskId)
      matrix = { ...matrix, cleanup: await cleanupProofTask(api, input, createdTaskId, dependencies) }
    await session?.close?.()
  }
  if (input.evidenceRoot) {
    try {
      matrix = { ...matrix, matrixPath: await writeMatrix(input.evidenceRoot, matrix) }
    }
    catch {
      // Keep the proof result bounded when evidence storage is unavailable.
    }
  }
  return matrix
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  const value = index >= 0 ? argv[index + 1] : undefined
  return value && !value.startsWith('--') ? value : undefined
}

export interface Phase25CliOptions extends Phase25ProofInput {
  readonly help: boolean
}

export function parsePhase25CliArgs(argv: readonly string[]): Phase25CliOptions {
  if (argv.includes('--help'))
    return { gatewayOrigin: PHASE25_GATEWAY_ORIGIN, help: true }
  const gatewayOrigin = flagValue(argv, '--gateway-origin') ?? PHASE25_GATEWAY_ORIGIN
  const timeoutText = flagValue(argv, '--timeout-ms')
  const timeoutMs = timeoutText ? Number(timeoutText) : undefined
  if (timeoutMs !== undefined && (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000))
    throw new Error('--timeout-ms_must_be_bounded')
  const pollText = flagValue(argv, '--poll-ms')
  const pollIntervalMs = pollText ? Number(pollText) : undefined
  if (pollIntervalMs !== undefined && (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 50 || pollIntervalMs > 5_000))
    throw new Error('--poll-ms_must_be_bounded')
  return {
    browserProfile: flagValue(argv, '--browser-profile'),
    cdpUrl: flagValue(argv, '--cdp-url'),
    evidenceRoot: flagValue(argv, '--evidence-dir'),
    gatewayOrigin,
    help: false,
    pollIntervalMs,
    seed: flagValue(argv, '--seed'),
    targetId: flagValue(argv, '--target-id'),
    timeoutMs,
  }
}

export function phase25CliHelp(): string {
  return [
    'Phase 25 Dashboard/Gateway fresh task operations proof:',
    '  tsx scripts/phase25-dashboard-gateway-proof.ts --gateway-origin http://localhost:8080 [--cdp-url URL | --browser-profile DIR] --target-id EXISTING_MOVIE_ID [--evidence-dir ABSOLUTE_DIR] [--timeout-ms MS] [--poll-ms MS]',
    '  The authenticated browser context is the Dashboard command boundary; API reads use the same session and the canonical Gateway only.',
    '  Missing availability current/history or authenticated session produces a checkpoint rather than a false pass.',
  ].join('\n')
}

async function main(): Promise<void> {
  const options = parsePhase25CliArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(`${phase25CliHelp()}\n`)
    return
  }
  const matrix = await runPhase25DashboardGatewayProof(options)
  process.stdout.write(`${JSON.stringify(matrix)}\n`)
  process.exitCode = matrix.outcome === 'passed' ? 0 : matrix.outcome === 'failed' ? 1 : 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 2
  })
}
