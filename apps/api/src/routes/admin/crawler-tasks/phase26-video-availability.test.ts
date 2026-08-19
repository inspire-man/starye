import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminCrawlerTasksRoutes } from './index'

const repository = vi.hoisted(() => ({
  createOrGetActiveRun: vi.fn(),
  ensureProviderAssociation: vi.fn(),
  getTaskDetail: vi.fn(),
}))
const playbackRepository = vi.hoisted(() => ({ getTaskEvidence: vi.fn() }))

vi.mock('../../../domain/crawler-tasks/repository', () => ({
  createCrawlerTaskRepository: vi.fn(() => repository),
}))
vi.mock('../../../domain/playback-evidence/repository', () => ({
  createPlaybackEvidenceRepository: vi.fn(() => playbackRepository),
}))

function createApp(results: Array<unknown[]> = []) {
  const app = new Hono<AppEnv>()
  const statement = { all: vi.fn(async () => ({ results: results.shift() ?? [] })), bind: vi.fn() }
  statement.bind.mockReturnValue(statement)
  app.use('*', async (c, next) => {
    c.set('auth', { api: { getSession: async () => ({ user: { id: 'admin-1', role: 'movie_admin' } }) } } as never)
    c.set('db', { $client: { prepare: vi.fn(() => statement) } } as never)
    await next()
  })
  app.route('/crawler-tasks', adminCrawlerTasksRoutes)
  return app
}

const command = {
  idempotencyKey: 'video:movie-1:7:magnet:stale',
  movieId: 'movie-1',
  reason: 'stale',
  sourceKind: 'magnet',
}

describe('phase 26 admin video availability boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repository.createOrGetActiveRun.mockResolvedValue({
      kind: 'duplicate',
      run: { attemptNumber: 1, id: 'run-1', taskId: 'task-1' },
    })
    repository.getTaskDetail.mockResolvedValue(undefined)
    playbackRepository.getTaskEvidence.mockResolvedValue({ runs: [] })
  })

  it('returns stable same-revision four-layer current/history facts', async () => {
    const snapshot = JSON.stringify({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      movieRevision: 3,
      operation: 'recheck_video_source',
      permissionResource: 'movie',
      policyVersion: 'video-source-probe/v1',
      reason: 'direct_transport_failed',
      sourceKind: 'direct',
      sourceRevision: 7,
      templateKey: 'movie',
      templateVersion: 1,
    })
    repository.getTaskDetail.mockResolvedValueOnce({
      runs: [{
        attemptNumber: 1,
        id: 'run-1',
        receipt: {
          createdCount: 0,
          primaryContentId: 'movie-1',
          receiptSchemaVersion: 2,
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 200, reasonCode: null, repairable: false, sourceRevision: 7 },
          templateKey: 'movie',
          updatedCount: 1,
        },
        status: 'succeeded',
        terminalAt: 200,
      }],
      task: { id: 'task-1', latestRunId: 'run-1' },
    })
    playbackRepository.getTaskEvidence.mockResolvedValueOnce({
      runs: [{ rejections: [], runId: 'run-1', summary: { observedAt: 210, playback: { status: 'playback_verified' }, sourceRevision: 7 } }],
    })
    const row = {
      attempt_number: 1,
      content_id: 'movie-1',
      event_sequence: 2,
      freshness: 'fresh',
      next_action: 'recheck',
      observation_identity: 'direct-current',
      observed_at: 205,
      policy_version: 'video-source-probe/v1',
      provider: 'github-actions',
      reason_code: 'transport_failed',
      run_id: 'run-1',
      source_revision: 7,
      status: 'degraded',
      summary_json: JSON.stringify({ counts: { checked: 1 }, samples: [] }),
      target_id: 'movie-1',
      target_kind: 'movie',
      task_id: 'task-1',
    }
    const app = createApp([
      [{ operation: 'recheck_video_source', request_snapshot_json: snapshot, template_key: 'movie' }],
      [{ ...row, projection_version: 1 }],
      [{ ...row, event_sequence: 1, freshness: 'stale', observation_identity: 'old-direct', source_revision: 6 }],
      [],
    ])
    const response = await app.request('/crawler-tasks/task-1')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ availability: { layers: {
      direct: { current: { layer: 'direct', sourceRevision: 7, status: 'degraded' }, history: [{ sourceRevision: 6 }] },
      magnet: { current: null, history: [] },
      metadata: { current: { status: 'unknown', reason: 'metadata_unresolved' } },
      playback: { current: { status: 'available' } },
    } } })
  })

  it('does not infer metadata persistence from a legacy receipt or run timestamps', async () => {
    repository.getTaskDetail.mockResolvedValueOnce({
      runs: [{
        id: 'run-legacy',
        receipt: {
          createdCount: 1,
          primaryContentId: 'movie-1',
          templateKey: 'movie',
          updatedCount: 0,
        },
        status: 'succeeded',
        terminalAt: 999,
        updatedAt: 999,
      }],
      task: { id: 'task-1', latestRunId: 'run-legacy' },
    })
    const app = createApp([
      [{ operation: 'movie', template_key: 'movie' }],
      [],
      [],
      [],
    ])

    const response = await app.request('/crawler-tasks/task-1')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      runs: [{ readiness: {
        metadata: { observedAt: null, persisted: false },
      } }],
    })
  })

  it('routes an explicit stale magnet snapshot to the magnet layer', async () => {
    const snapshot = JSON.stringify({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      movieRevision: 3,
      operation: 'recheck_video_source',
      permissionResource: 'movie',
      policyVersion: 'video-source-probe/v1',
      reason: 'stale',
      sourceKind: 'magnet',
      sourceRevision: 7,
      templateKey: 'movie',
      templateVersion: 1,
    })
    repository.getTaskDetail.mockResolvedValueOnce({
      runs: [{ id: 'run-1', status: 'succeeded', terminalAt: 200 }],
      task: { id: 'task-1', latestRunId: 'run-1' },
    })
    const row = {
      attempt_number: 1,
      content_id: 'movie-1',
      event_sequence: 2,
      freshness: 'fresh',
      next_action: 'recheck',
      observation_identity: 'magnet-current',
      observed_at: 205,
      policy_version: 'video-source-probe/v1',
      provider: 'local-proof',
      reason_code: 'content_missing',
      run_id: 'run-1',
      source_revision: 7,
      status: 'degraded',
      summary_json: JSON.stringify({ counts: { metadata_ready: 1, peers: 1, progress_bytes: 1024, stream_ready: 1 }, samples: [{ code: 'playback_unverified' }] }),
      target_id: 'movie-1',
      target_kind: 'movie',
      task_id: 'task-1',
    }
    const app = createApp([
      [{ operation: 'recheck_video_source', request_snapshot_json: snapshot, template_key: 'movie' }],
      [{ ...row, projection_version: 1 }],
      [{ ...row, event_sequence: 1, freshness: 'stale', observation_identity: 'magnet-old', source_revision: 6 }],
      [],
    ])

    const response = await app.request('/crawler-tasks/task-1')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ availability: { layers: {
      direct: { current: null, history: [] },
      magnet: { current: { layer: 'magnet', sourceRevision: 7, status: 'degraded' }, history: [{ layer: 'magnet' }] },
    } } })
  })

  it('derives a revision-bound recheck operation and returns an existing identity', async () => {
    const response = await createApp([[{ id: 'movie-1', source_revision: 7 }]]).request('/crawler-tasks/video-availability', {
      body: JSON.stringify(command),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    expect(repository.createOrGetActiveRun).toHaveBeenCalledWith(expect.objectContaining({
      operationCommand: expect.objectContaining({
        idempotencyKey: command.idempotencyKey,
        intent: expect.objectContaining({ kind: 'recheck_video_source', movieRevision: 7, reason: 'stale', sourceKind: 'magnet', sourceRevision: 7 }),
        operation: 'recheck_video_source',
        policyVersion: 'video-source-probe/v1',
        target: { id: 'movie-1', kind: 'movie' },
      }),
      requestedByUserId: 'admin-1',
      templateKey: 'movie',
    }))
    await expect(response.json()).resolves.toMatchObject({
      binding: { movieId: 'movie-1', movieRevision: 7, policyVersion: 'video-source-probe/v1', sourceKind: 'magnet', sourceRevision: 7 },
      kind: 'duplicate',
      run: { id: 'run-1' },
    })
  })

  it('associates a created availability command with the enabled local runner', async () => {
    repository.createOrGetActiveRun.mockResolvedValueOnce({
      kind: 'created',
      run: { attemptNumber: 1, id: 'run-1', taskId: 'task-1' },
    })
    repository.ensureProviderAssociation.mockResolvedValueOnce({
      applicationAttempt: 1,
      provider: 'local-proof',
      providerRunId: 'local-run-1',
      runId: 'run-1',
    })
    const app = createApp([[{ id: 'movie-1', source_revision: 7 }]])

    const response = await app.request('/crawler-tasks/video-availability', {
      body: JSON.stringify(command),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }, {
      CRAWLER_LOCAL_PROOF_ENABLED: 'true',
      TASK_RUNNER_CALLBACK_KEY_ID_CURRENT: 'local-test-key',
      TASK_RUNNER_CALLBACK_SECRET_CURRENT: 'local-test-secret',
    })

    expect(response.status).toBe(200)
    expect(repository.ensureProviderAssociation).toHaveBeenCalledWith({
      attempt: 1,
      provider: 'local-proof',
      runId: 'run-1',
      template: 'movie',
    })
    await expect(response.json()).resolves.toMatchObject({
      binding: { movieId: 'movie-1', movieRevision: 7, policyVersion: 'video-source-probe/v1', sourceKind: 'magnet', sourceRevision: 7 },
      dispatch: { provider: { accepted: true, kind: 'local-proof_queued' } },
      kind: 'created',
    })
  })

  it('rejects a command when the target movie no longer exists', async () => {
    const response = await createApp([[]]).request('/crawler-tasks/video-availability', {
      body: JSON.stringify(command),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(404)
    expect(repository.createOrGetActiveRun).not.toHaveBeenCalled()
  })

  it('rejects reason/action mismatches and caller-controlled provider material', async () => {
    for (const body of [
      { ...command, reason: 'no_source', operation: 'recheck_video_source' },
      { ...command, providerConfig: { endpoint: 'http://TARGET', token: 'TOKEN' } },
      { ...command, reason: 'provider_failed' },
    ]) {
      const response = await createApp().request('/crawler-tasks/video-availability', {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      expect(response.status).toBe(400)
    }
    expect(repository.createOrGetActiveRun).not.toHaveBeenCalled()
  })
})
