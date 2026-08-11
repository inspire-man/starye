import type { Phase24ApiResponse, Phase24BrowserSession, Phase24Locator, Phase24Page } from './phase24-production-proof'
import type { Phase25ApiRequestContext, Phase25ProofInput } from './phase25-dashboard-gateway-proof'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  classifyPhase25ActionOutcome,
  classifyPhase25CacheRefresh,
  Phase25ProofCheckpointError,
  runPhase25DashboardGatewayProof,
} from './phase25-dashboard-gateway-proof'
import { assertPhase25Redacted, createPhase25TaskOperationsFixture, tupleFromPhase25TaskDetail } from './phase25-task-operations-fixture'

const roots: string[] = []

class FakeResponse implements Phase24ApiResponse {
  constructor(private readonly responseStatus: number, private readonly responseBody: unknown) {}

  readonly json = async <T = unknown>(): Promise<T> => this.responseBody as T
  readonly status = (): number => this.responseStatus
}

interface FakeProofEnvironment {
  auditTaskIds: string[]
  cleanupDetailTaskIds: string[]
  createdTaskCount: number
  refreshed: boolean
  readonly taskId: string
  readonly runId: string
  readonly cancellationTaskId: string
  readonly cancellationRunId: string
  readonly supersedeSourceTaskId: string
  readonly supersedeSourceRunId: string
  readonly ownerTaskId: string
  readonly ownerRunId: string
  ownershipTransferred: boolean
  supersedeEvidence?: 'conflicting' | 'malformed' | 'missing' | 'non-distinct' | 'valid'
  runStatus?: string
  cancelCalls?: number
}

function detailFor(environment: FakeProofEnvironment, taskId: string = environment.taskId): Record<string, unknown> {
  const owner = taskId === environment.ownerTaskId
  const original = taskId === environment.taskId
  const cancellation = taskId === environment.cancellationTaskId
  const runId = owner
    ? environment.ownerRunId
    : cancellation
      ? environment.cancellationRunId
      : taskId === environment.supersedeSourceTaskId
        ? environment.supersedeSourceRunId
        : environment.runId
  const projectionVersion = owner ? 2 : 1
  const observationIdentity = owner ? 'availability-current-2' : 'availability-current-1'
  const current = {
    attemptNumber: 1,
    contentId: 'phase25-content',
    eventSequence: projectionVersion,
    freshness: 'fresh',
    nextAction: 'none',
    observationIdentity,
    observedAt: owner ? 200 : 100,
    policyVersion: 'v1',
    projectionVersion,
    provider: 'local-proof',
    reasonCode: 'available',
    runId,
    sourceRevision: 1,
    status: 'available',
    summary: { counts: { ready: 1 }, samples: [{ code: 'transport_ok', count: 1 }] },
    target: { id: 'phase25-content', kind: 'movie' },
    taskId,
  }
  const history = [
    { kind: 'duplicate', observation: null, reason: 'exact_replay' },
    { kind: 'conflict', observation: null, reason: 'identity_replay_conflict' },
    { kind: 'stale', observation: { observationIdentity: 'availability-stale', observedAt: 80, sourceRevision: 0, status: 'unknown', freshness: 'stale' }, reason: 'projection_version_mismatch' },
    { kind: 'late', observation: { observationIdentity: owner ? 'availability-current-1' : 'availability-late', observedAt: 90, sourceRevision: 1, status: 'unknown', freshness: 'late' }, reason: 'run_is_late_or_cancelled' },
  ]
  const run = {
    attemptNumber: 1,
    id: runId,
    provider: { provider: 'local-proof', providerConclusion: 'success', providerRunId: 'local-run-25', providerStatus: 'completed' },
    receipt: { primaryContentId: 'phase25-content', sourceRevision: 1, templateKey: 'movie' },
    receiptValidation: { status: 'validated' },
    status: cancellation || original ? environment.runStatus ?? 'succeeded' : 'succeeded',
  }
  return {
    availability: { current: original && environment.ownershipTransferred ? null : current, history },
    lifecycle: { changedAt: 100, status: taskId === environment.supersedeSourceTaskId && environment.ownershipTransferred ? 'superseded' : 'active', version: owner ? 1 : 0 },
    runs: [run],
    task: { id: taskId, latestRunId: runId, movie: { id: 'phase25-content', code: 'PHASE25', title: 'Phase 25' }, operation: 'movie', sourceRevision: 1 },
  }
}

function environmentFor(overrides: Partial<FakeProofEnvironment> = {}): FakeProofEnvironment {
  return {
    auditTaskIds: [],
    cancellationRunId: 'cancel-run',
    cancellationTaskId: 'cancel-task',
    cleanupDetailTaskIds: [],
    createdTaskCount: 0,
    ownerRunId: 'owner-run',
    ownerTaskId: 'owner-task',
    ownershipTransferred: false,
    refreshed: false,
    runId: 'fresh-run',
    supersedeEvidence: 'valid',
    supersedeSourceRunId: 'supersede-source-run',
    supersedeSourceTaskId: 'supersede-source-task',
    taskId: 'fresh-task',
    ...overrides,
  }
}

class FakeApi implements Phase25ApiRequestContext {
  constructor(private readonly environment: FakeProofEnvironment) {}

  get = async (url: string): Promise<Phase24ApiResponse> => {
    const taskId = url.match(/\/api\/admin\/crawler-tasks\/([^/?]+)/u)?.[1]
    if (url.includes('/audit')) {
      if (taskId)
        this.environment.auditTaskIds.push(taskId)
      return new FakeResponse(200, { audits: [{ action: 'UPDATE', createdAt: 100, id: 'audit-1', outcome: 'updated', reason: 'metadata_update' }], nextCursor: null })
    }
    if (url.includes('/admin/crawler-tasks?'))
      return new FakeResponse(200, { nextCursor: null, tasks: [{ id: 'old-task' }] })
    if (url.includes('/api/admin/movies/'))
      return new FakeResponse(200, { code: 'PHASE25', id: 'phase25-content', title: 'Phase 25' })
    if (taskId) {
      this.environment.cleanupDetailTaskIds.push(taskId)
      return new FakeResponse(200, detailFor(this.environment, taskId))
    }
    return new FakeResponse(404, { kind: 'not_found' })
  }

  readonly patch = async (): Promise<Phase24ApiResponse> => new FakeResponse(200, { kind: 'updated', taskId: this.environment.taskId })

  readonly post = async (url: string): Promise<Phase24ApiResponse> => {
    if (url.endsWith('/admin/crawler-tasks')) {
      const identities = [
        [this.environment.taskId, this.environment.runId],
        [this.environment.cancellationTaskId, this.environment.cancellationRunId],
        [this.environment.supersedeSourceTaskId, this.environment.supersedeSourceRunId],
      ] as const
      const identity = identities[this.environment.createdTaskCount++] ?? identities.at(-1)!
      return new FakeResponse(200, {
        dispatch: { association: { provider: 'local-proof' }, provider: { accepted: true, kind: 'local-proof_queued' } },
        kind: 'created',
        run: { id: identity[1], taskId: identity[0] },
      })
    }
    if (url.includes('/cancel')) {
      this.environment.runStatus = 'cancelled'
      this.environment.cancelCalls = (this.environment.cancelCalls ?? 0) + 1
    }
    if (url.includes('/supersede')) {
      this.environment.ownershipTransferred = true
      const taskId = this.environment.supersedeEvidence === 'non-distinct'
        ? this.environment.supersedeSourceTaskId
        : this.environment.supersedeEvidence === 'malformed'
          ? 'cookie=SECRET'
          : this.environment.ownerTaskId
      if (this.environment.supersedeEvidence === 'missing')
        return new FakeResponse(200, { kind: 'created', task: { run: {} } })
      if (this.environment.supersedeEvidence === 'conflicting')
        return new FakeResponse(200, { kind: 'created', task: { id: 'conflicting-owner', run: { taskId } } })
      return new FakeResponse(200, { kind: 'created', task: { run: { taskId } } })
    }
    const kind = url.includes('/archive')
      ? 'archived'
      : url.includes('/cancel')
        ? 'cancel_requested'
        : 'existing_active_run'
    return new FakeResponse(200, { kind, taskId: url.match(/\/api\/admin\/crawler-tasks\/([^/]+)/u)?.[1] ?? this.environment.taskId })
  }
}

class FakeLocator implements Phase24Locator {
  constructor(private readonly environment: FakeProofEnvironment, private readonly selector: string) {}

  readonly click = async (): Promise<void> => undefined
  readonly count = async (): Promise<number> => 1
  readonly filter = (): Phase24Locator => this
  readonly first = (): Phase24Locator => this
  readonly getAttribute = async (): Promise<string | null> => null
  readonly isVisible = async (): Promise<boolean> => true
  readonly locator = (selector: string): Phase24Locator => new FakeLocator(this.environment, selector)
  readonly nth = (): Phase24Locator => this
  readonly textContent = async (): Promise<string> => {
    const detail = detailFor(this.environment, this.environment.ownershipTransferred ? this.environment.ownerTaskId : this.environment.taskId)
    const current = (detail.availability as Record<string, unknown>).current as Record<string, unknown>
    if (this.selector.includes('data-current-attempt-focal'))
      return `task ${current.taskId} run ${current.runId} attempt #1 content ${current.contentId}`
    if (this.selector.includes('data-availability-current'))
      return `${current.status} ${current.observationIdentity} ${current.projectionVersion}`
    if (this.selector.includes('data-availability-history'))
      return 'duplicate conflict stale late'
    if (this.selector.includes('data-evidence-section="audit"'))
      return 'metadata_update updated'
    if (this.selector.includes('task-lifecycle'))
      return 'active'
    return ''
  }
}

class FakePage implements Phase24Page {
  constructor(private readonly environment: FakeProofEnvironment, readonly api: FakeApi) {}

  private currentUrl = 'http://localhost:8080/dashboard/crawlers'

  readonly getByRole = (): Phase24Locator => new FakeLocator(this.environment, 'role')
  readonly goto = async (url: string): Promise<void> => { this.currentUrl = url }
  readonly locator = (selector: string): Phase24Locator => new FakeLocator(this.environment, selector)
  readonly reload = async (): Promise<void> => { this.environment.refreshed = true }
  readonly url = (): string => this.currentUrl
  readonly waitForLoadState = async (): Promise<void> => undefined
  readonly waitForTimeout = async (): Promise<void> => undefined
}

function input(root: string): Phase25ProofInput {
  return { evidenceRoot: root, gatewayOrigin: 'http://localhost:8080', seed: 'phase25-test', targetId: 'phase25-content' }
}

function sessionFor(environment: FakeProofEnvironment): Phase24BrowserSession {
  const api = new FakeApi(environment)
  const page = new FakePage(environment, api)
  return {
    context: { newPage: async () => page, request: api },
    dashboardPage: page,
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('phase25 Dashboard Gateway proof', () => {
  it('rejects direct origins and dangerous fixture fields', () => {
    expect(classifyPhase25ActionOutcome(409, { kind: 'duplicate' })).toBe('passed')
    expect(classifyPhase25ActionOutcome(409, { kind: 'conflict' })).toBe('passed')
    expect(classifyPhase25ActionOutcome(409, { kind: 'stale' })).toBe('passed')
    expect(classifyPhase25ActionOutcome(409, { kind: 'late' })).toBe('passed')
    expect(() => assertPhase25Redacted({ signed_url: 'https://TARGET', raw_response: 'TARGET' })).toThrow('phase25_forbidden_field')
    expect(() => assertPhase25Redacted({ authorization: 'Bearer TOKEN', browserSession: 'SESSION', cookie: 'COOKIE' })).toThrow('phase25_forbidden_field')
    expect(() => assertPhase25Redacted({ payload: 'x'.repeat(513) })).toThrow('phase25_forbidden_or_unbounded_value')
  })

  it('checkpoints before opening a non-canonical direct origin', async () => {
    const result = await runPhase25DashboardGatewayProof({ gatewayOrigin: 'http://localhost:3000' })

    expect(result.outcome).toBe('checkpoint')
    expect(result.gateway).toBe('http://localhost:8080')
    expect(result.reason).toContain('canonical_gateway_origin')
  })

  it('requires an explicit target id before opening an authenticated browser session', async () => {
    const result = await runPhase25DashboardGatewayProof({ gatewayOrigin: 'http://localhost:8080' })

    expect(result.outcome).toBe('checkpoint')
    expect(result.reason).toContain('proof_target_id_required')
  })

  it('proves a fresh bounded tuple, actions, cache refresh, history and Dashboard trace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'phase25-dashboard-proof-'))
    roots.push(root)
    const environment = environmentFor()
    const result = await runPhase25DashboardGatewayProof(input(root), { browserFactory: async () => sessionFor(environment) })

    expect(result.outcome).toBe('passed')
    expect(result.gateway).toBe('http://localhost:8080')
    expect(result.tuple).toMatchObject({ attemptNumber: 1, provider: 'local-proof', runId: 'fresh-run', taskId: 'fresh-task' })
    expect(result.actions.supersede.taskId).toBe('owner-task')
    expect(result.availability?.current).toMatchObject({ observationIdentity: 'availability-current-2', projectionVersion: 2 })
    expect(result.cacheRefresh).toBe('passed')
    expect(result.checks).toMatchObject({ actionReadback: 'passed', availabilityCurrent: 'passed', availabilityHistory: 'passed', canonicalOrigin: 'passed', dashboardCommand: 'passed', dashboardTrace: 'passed', freshTuple: 'passed', redaction: 'passed' })
    expect(Object.values(result.actions).every(action => action.status === 'passed')).toBe(true)
    expect(result.availability?.historyOutcomes).toEqual(['duplicate', 'conflict', 'stale', 'late'])
    expect(result.auditCount).toBe(3)
    expect(new Set(environment.auditTaskIds)).toEqual(new Set(['fresh-task', 'cancel-task', 'supersede-source-task']))
    expect(environment.auditTaskIds).not.toContain('owner-task')
    for (const taskId of ['fresh-task', 'cancel-task', 'supersede-source-task', 'owner-task'])
      expect(environment.cleanupDetailTaskIds).toContain(taskId)
    expect(result.matrixPath).toBeDefined()
    const artifact = JSON.parse(await readFile(result.matrixPath!, 'utf8')) as Record<string, unknown>
    expect(artifact).not.toHaveProperty('signed_url')
    expect(artifact).not.toHaveProperty('raw_response')
  })

  it('keeps local-proof and production GitHub provider identities distinct at tuple readback', () => {
    const local = tupleFromPhase25TaskDetail(detailFor(environmentFor({ runId: 'local-run', taskId: 'local-task' })))
    const productionDetail = detailFor(environmentFor({ runId: 'production-run', taskId: 'production-task' }))
    const productionRun = (productionDetail.runs as Record<string, unknown>[])[0]
    const production = tupleFromPhase25TaskDetail({
      ...productionDetail,
      runs: [{ ...productionRun, provider: { provider: 'github-actions', providerRunId: 'github-run-25' } }],
    })

    expect(local.provider).toBe('local-proof')
    expect(production.provider).toBe('github-actions')
  })

  it('cancels an unfinished proof task and records the terminal cleanup readback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'phase25-dashboard-cleanup-'))
    roots.push(root)
    const environment = environmentFor({ cancelCalls: 0, runId: 'running-run', runStatus: 'running', taskId: 'running-task' })
    const result = await runPhase25DashboardGatewayProof({ ...input(root), timeoutMs: 1_000 }, { browserFactory: async () => sessionFor(environment) })

    expect(result.outcome).toBe('checkpoint')
    expect(result.cleanup).toMatchObject({ action: 'cancelled', runStatus: 'cancelled', status: 'passed', taskId: 'running-task' })
    expect(environment.cancelCalls).toBe(1)
  })

  it('retains failed authoritative evidence and still runs original-task cleanup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'phase25-dashboard-failed-'))
    roots.push(root)
    const environment = environmentFor({ runStatus: 'failed' })

    const result = await runPhase25DashboardGatewayProof(input(root), { browserFactory: async () => sessionFor(environment) })

    expect(result.outcome).toBe('failed')
    expect(result.cleanup).toMatchObject({ action: 'already_terminal', runStatus: 'failed', status: 'passed', taskId: 'fresh-task' })
    expect(environment.cleanupDetailTaskIds).toContain('fresh-task')
  })

  it('returns a checkpoint when the authoritative detail has no availability projection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'phase25-dashboard-checkpoint-'))
    roots.push(root)
    const environment = environmentFor()
    const session = sessionFor(environment)
    const originalGet = (session.context.request as FakeApi).get
    ;(session.context.request as unknown as FakeApi).get = async (url: string) => {
      const response = await originalGet(url)
      if (url.includes('/admin/crawler-tasks?') || url.includes('/audit'))
        return response
      const body = await response.json<Record<string, unknown>>()
      const { availability: _availability, ...withoutAvailability } = body
      return new FakeResponse(200, withoutAvailability)
    }
    const result = await runPhase25DashboardGatewayProof({ ...input(root), timeoutMs: 1_000 }, { browserFactory: async () => session })

    expect(result.outcome).toBe('checkpoint')
    expect(result.reason).toContain('availability_projection_missing')
  })

  it.each(['missing', 'malformed', 'conflicting', 'non-distinct'] as const)(
    'checkpoints when supersede ownership evidence is %s and still cleans every known task',
    async (supersedeEvidence) => {
      const root = await mkdtemp(join(tmpdir(), `phase25-dashboard-owner-${supersedeEvidence}-`))
      roots.push(root)
      const environment = environmentFor({ supersedeEvidence })

      const result = await runPhase25DashboardGatewayProof(input(root), { browserFactory: async () => sessionFor(environment) })

      expect(result.outcome).toBe('checkpoint')
      expect(result.reason).toContain('supersede_authoritative_owner')
      expect(result.actions.supersede.status).not.toBe('passed')
      for (const taskId of ['fresh-task', 'cancel-task', 'supersede-source-task'])
        expect(environment.cleanupDetailTaskIds).toContain(taskId)
    },
  )

  it('keeps cache refresh gated on a newer current projection and retained history', () => {
    const fixture = createPhase25TaskOperationsFixture('cache-refresh')
    const before = {
      availability: {
        current: { freshness: 'fresh', observationIdentity: 'current-1', policyVersion: 'v1', projectionVersion: 1, reasonCode: 'available', sourceRevision: 1, status: 'available' },
        history: [],
      },
      task: { id: fixture.tuple.taskId },
    }
    const after = {
      availability: {
        current: { freshness: 'fresh', observationIdentity: 'current-2', policyVersion: 'v1', projectionVersion: 2, reasonCode: 'available', sourceRevision: 1, status: 'available' },
        history: [{ kind: 'late', observation: { observationIdentity: 'current-1' } }],
      },
      task: { id: fixture.tuple.taskId },
    }
    expect(classifyPhase25CacheRefresh(before, after)).toBe('passed')
    expect(tupleFromPhase25TaskDetail).toBeTypeOf('function')
    expect(Phase25ProofCheckpointError).toBeDefined()
  })
})
