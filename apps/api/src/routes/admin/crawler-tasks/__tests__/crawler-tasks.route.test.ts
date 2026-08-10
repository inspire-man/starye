import type { PlaybackEvidenceRequest } from '../../../../domain/playback-evidence/types'
import type { AppEnv, SessionUser } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { adminCrawlerTasksRoutes } from '../index'

const crawlerTaskRepository = vi.hoisted(() => ({
  archiveTask: vi.fn(),
  applyTransition: vi.fn(),
  claimDispatch: vi.fn().mockResolvedValue({ kind: 'transition', nextStatus: 'dispatching' }),
  createOrGetActiveRun: vi.fn().mockResolvedValue({ kind: 'created', run: { id: 'run-movie' } }),
  ensureProviderAssociation: vi.fn().mockResolvedValue({ applicationAttempt: 1, runId: 'run-movie' }),
  getProviderAssociation: vi.fn(),
  getTaskDetail: vi.fn(),
  listTaskAudit: vi.fn(),
  listRunLogs: vi.fn(),
  listTasks: vi.fn(),
  retryRun: vi.fn(),
  supersedeTask: vi.fn(),
  updateTaskMetadata: vi.fn(),
}))

const playbackEvidenceRepository = vi.hoisted(() => ({
  accept: vi.fn(),
  getTaskEvidence: vi.fn().mockResolvedValue({ runs: [] }),
}))

const actionsClient = vi.hoisted(() => ({
  cancelWorkflowRun: vi.fn(),
  dispatchWorkflow: vi.fn(),
}))

vi.mock('../../../../domain/crawler-tasks/repository', () => ({
  createCrawlerTaskRepository: vi.fn(() => crawlerTaskRepository),
}))

vi.mock('../../../../domain/playback-evidence/repository', () => ({
  createPlaybackArtifactReference: vi.fn(async ({ attemptNumber, runId, taskId }) => ({
    hash: 'a'.repeat(64),
    reference: `phase24/${taskId}/${runId}/attempt-${attemptNumber}.json`,
    stem: `${taskId}_${runId}_attempt-${attemptNumber}`,
  })),
  createPlaybackEvidenceRepository: vi.fn(() => playbackEvidenceRepository),
}))

vi.mock('../../../../lib/github-app/github-actions-client', () => ({
  createGitHubActionsClient: vi.fn(() => actionsClient),
}))

function createApp(
  user: Partial<SessionUser> | null = {},
  results: Array<unknown[]> = [],
) {
  const prepare = vi.fn()
  const app = new Hono<AppEnv>()
  const statement = {
    all: vi.fn().mockImplementation(async () => ({ results: results.shift() ?? [] })),
    bind: vi.fn(),
  }
  statement.bind.mockReturnValue(statement)
  prepare.mockReturnValue(statement)
  const getSession = vi.fn().mockResolvedValue(user !== null
    ? {
        user: {
          id: 'admin-1',
          role: 'movie_admin',
          ...user,
        },
      }
    : null)

  app.use('*', async (c, next) => {
    c.set('auth', { api: { getSession } } as any)
    c.set('db', { $client: { batch: vi.fn().mockResolvedValue([]), prepare } } as any)
    await next()
  })
  app.route('/crawler-tasks', adminCrawlerTasksRoutes)

  return { app, getSession, prepare }
}

function createPlaybackEvidence(overrides: Partial<PlaybackEvidenceRequest> = {}): PlaybackEvidenceRequest {
  return {
    contentId: 'movie-1',
    events: [
      { event: 'canplay', observed: true, observedAt: 101 },
      { event: 'playing', observed: true, observedAt: 102 },
      { event: 'waiting', observed: false, observedAt: null },
      { event: 'stalled', observed: false, observedAt: null },
      { event: 'error', observed: false, observedAt: null },
    ],
    observedAt: 110,
    playback: {
      canplay: true,
      error: false,
      playing: true,
      progress: { currentTimeAfter: 3, currentTimeBefore: 1.5, currentTimeDelta: 1.5 },
      status: 'playback_verified',
    },
    provider: { provider: 'github-actions', status: 'succeeded' },
    repair: { sourceRevision: 7, status: 'succeeded' },
    schemaVersion: 1,
    source: { revision: 7, sourceType: 'direct', status: 'ready' },
    sourceRevision: 7,
    tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'run-movie', taskId: 'task-movie' },
    viewer: { path: '/movie/movie-1', targetLabel: 'selected-production-target' },
    ...overrides,
  }
}

describe('admin crawler task routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    crawlerTaskRepository.createOrGetActiveRun.mockResolvedValue({ kind: 'created', run: { id: 'run-movie' } })
    crawlerTaskRepository.getTaskDetail.mockReset()
    crawlerTaskRepository.getTaskDetail.mockResolvedValue(undefined)
    crawlerTaskRepository.archiveTask.mockReset()
    crawlerTaskRepository.archiveTask.mockResolvedValue({ kind: 'updated', lifecycle: { changedAt: 100, status: 'archived', version: 1 }, taskId: 'task-movie' })
    crawlerTaskRepository.listTaskAudit.mockReset()
    crawlerTaskRepository.listTaskAudit.mockResolvedValue({ audits: [], nextCursor: null })
    crawlerTaskRepository.supersedeTask.mockReset()
    crawlerTaskRepository.updateTaskMetadata.mockReset()
    crawlerTaskRepository.updateTaskMetadata.mockResolvedValue({ kind: 'updated', lifecycle: { changedAt: 100, status: 'active', version: 0 }, taskId: 'task-movie' })
    playbackEvidenceRepository.accept.mockReset()
    playbackEvidenceRepository.getTaskEvidence.mockResolvedValue({ runs: [] })
  })

  it('accepts only a registry template and resolves access from the session role', async () => {
    const { app } = createApp()
    const response = await app.request('/crawler-tasks', {
      body: JSON.stringify({ template: 'movie' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      template: 'movie',
    })
  })

  it('rejects executable and secret-shaped create fields before reaching the task command', async () => {
    const { app } = createApp()
    const response = await app.request('/crawler-tasks', {
      body: JSON.stringify({ command: 'pnpm crawl:movie', template: 'movie', workflow: 'daily.yml' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it('requires a session and rejects a service token or wrong template resource role', async () => {
    const noSession = createApp(null)
    await expect(noSession.app.request('/crawler-tasks', {
      body: JSON.stringify({ template: 'movie' }),
      headers: { 'authorization': 'Bearer legacy-service-token', 'content-type': 'application/json' },
      method: 'POST',
    })).resolves.toMatchObject({ status: 401 })

    const comicOnly = createApp({ role: 'comic_admin' })
    await expect(comicOnly.app.request('/crawler-tasks', {
      body: JSON.stringify({ template: 'movie' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })).resolves.toMatchObject({ status: 403 })
  })

  it('rejects a movie administrator reading a manga run through their own movie task', async () => {
    const { app, prepare } = createApp({}, [
      [{ template_key: 'movie' }],
      [],
    ])

    const response = await app.request('/crawler-tasks/task-movie/runs/run-manga/logs')

    expect(response.status).toBe(404)
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(prepare.mock.calls[1]?.[0]).toContain('INNER JOIN crawler_task')
  })

  it('rejects a movie administrator cancelling a manga run through their own movie task before the repository mutation', async () => {
    const { app } = createApp({}, [
      [{ template_key: 'movie' }],
      [],
    ])

    const response = await app.request('/crawler-tasks/task-movie/runs/run-manga/cancel', { method: 'POST' })

    expect(response.status).toBe(404)
    expect(crawlerTaskRepository.applyTransition).not.toHaveBeenCalled()
  })

  it('rejects a movie administrator retrying a manga run through their own movie task before the repository mutation', async () => {
    const { app } = createApp({}, [
      [{ template_key: 'movie' }],
      [],
    ])

    const response = await app.request('/crawler-tasks/task-movie/runs/run-manga/retry', {
      body: JSON.stringify({ confirmed: true }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(404)
    expect(crawlerTaskRepository.retryRun).not.toHaveBeenCalled()
  })

  it('keeps the 403 template boundary and accepts a matching task/run combination', async () => {
    const forbidden = createApp({ role: 'comic_admin' }, [[{ template_key: 'movie' }]])
    await expect(forbidden.app.request('/crawler-tasks/task-movie/runs/run-movie/logs')).resolves.toMatchObject({ status: 403 })

    const allowed = createApp({}, [
      [{ template_key: 'movie' }],
      [{ id: 'run-movie' }],
      [{ code: 'crawl_progress', sequence: 1 }],
    ])
    const response = await allowed.app.request('/crawler-tasks/task-movie/runs/run-movie/logs')

    await expect(response.json()).resolves.toEqual({
      logs: [{ code: 'crawl_progress', sequence: 1 }],
      nextCursor: null,
    })
  })

  it('projects only validated success receipts and pages logs newest-first', async () => {
    const { app } = createApp({}, [
      [{ template_key: 'movie' }],
      [{
        id: 'run-movie',
        template_key: 'movie',
        latest_run_id: 'run-movie',
        created_at: 0,
        updated_at: 0,
        attempt_number: 1,
        status: 'succeeded',
        state_version: 1,
        receipt_summary_json: JSON.stringify({
          createdCount: 2,
          primaryContentId: 'movie-1',
          templateKey: 'movie',
          updatedCount: 1,
          rawRunnerField: 'hidden',
        }),
      }],
      [{
        id: 'run-movie',
        template_key: 'movie',
        latest_run_id: 'run-movie',
        created_at: 0,
        updated_at: 0,
        attempt_number: 1,
        status: 'succeeded',
        state_version: 1,
        receipt_summary_json: JSON.stringify({
          createdCount: 2,
          primaryContentId: 'movie-1',
          templateKey: 'movie',
          updatedCount: 1,
          rawRunnerField: 'hidden',
        }),
      }],
    ])

    const detail = await app.request('/crawler-tasks/task-movie')
    const detailBody = await detail.json()
    expect(detailBody).toMatchObject({
      runs: [{
        id: 'run-movie',
        receipt: {
          createdCount: 2,
          primaryContentId: 'movie-1',
          templateKey: 'movie',
          updatedCount: 1,
        },
      }],
    })
    expect(JSON.stringify(detailBody.runs)).not.toContain('rawRunnerField')

    const logsApp = createApp({}, [
      [{ template_key: 'movie' }],
      [{ id: 'run-movie' }],
      [{ code: 'crawl_progress', sequence: 19 }],
    ])
    const logs = await logsApp.app.request('/crawler-tasks/task-movie/runs/run-movie/logs?cursor=20&limit=2')
    expect(logs.status).toBe(200)
    expect(logsApp.prepare.mock.calls.at(-1)?.[0]).toContain('log.sequence < ?')
    expect(logsApp.prepare.mock.calls.at(-1)?.[0]).toContain('ORDER BY log.sequence DESC')
  })

  it('returns an opaque updated-at/id cursor and complete attempt/provider projections', async () => {
    crawlerTaskRepository.listTasks.mockResolvedValueOnce({
      nextCursor: 'eyJ1cGRhdGVkQXQiOjEwMCwiaWQiOiJ0YXNrLTIifQ',
      tasks: [{ id: 'task-1', templateKey: 'movie', updatedAt: 100 }],
    })
    crawlerTaskRepository.getTaskDetail.mockResolvedValueOnce({
      runs: [{
        attemptNumber: 2,
        failureCode: 'provider_failed',
        id: 'run-2',
        provider: {
          environment: 'starye-org',
          providerRunAttempt: 1,
          providerRunId: '123',
          providerRunUrl: 'https://github.com/inspire-man/starye/actions/runs/123',
          repository: 'inspire-man/starye',
          sha: 'a'.repeat(40),
          workflow: '.github/workflows/daily-movie-crawl.yml',
        },
        receipt: null,
        status: 'failed',
      }, {
        attemptNumber: 1,
        failureCode: 'runner_failed',
        id: 'run-1',
        provider: null,
        receipt: null,
        status: 'failed',
      }],
      task: { id: 'task-1', templateKey: 'movie' },
    })

    const { app } = createApp({}, [[{ template_key: 'movie' }]])
    const list = await app.request('/crawler-tasks?template=movie&limit=1')
    expect(list.status).toBe(200)
    await expect(list.json()).resolves.toEqual({
      nextCursor: 'eyJ1cGRhdGVkQXQiOjEwMCwiaWQiOiJ0YXNrLTIifQ',
      tasks: [{ id: 'task-1', templateKey: 'movie', updatedAt: 100 }],
    })

    const detail = await app.request('/crawler-tasks/task-1')
    expect(detail.status).toBe(200)
    await expect(detail.json()).resolves.toMatchObject({
      runs: [
        { attemptNumber: 2, failureCode: 'provider_failed', provider: { providerRunUrl: expect.stringContaining('/actions/runs/123') } },
        { attemptNumber: 1, failureCode: 'runner_failed', provider: null },
      ],
    })
  })

  it('accepts only allowlisted metadata and exposes bounded task lifecycle audit routes', async () => {
    const updateApp = createApp({}, [[{ template_key: 'movie', operation: 'movie' }]])
    const updated = await updateApp.app.request('/crawler-tasks/task-movie', {
      body: JSON.stringify({ description: 'bounded note' }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    })
    expect(updated.status).toBe(200)
    expect(crawlerTaskRepository.updateTaskMetadata).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { description: 'bounded note' },
      taskId: 'task-movie',
    }))

    const forbidden = await updateApp.app.request('/crawler-tasks/task-movie', {
      body: JSON.stringify({ workflow: 'caller-controlled' }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    })
    expect(forbidden.status).toBe(400)
    expect(crawlerTaskRepository.updateTaskMetadata).toHaveBeenCalledTimes(1)

    const archive = await createApp({}, [[{ template_key: 'movie' }]]).app.request('/crawler-tasks/task-movie/archive', { method: 'POST' })
    expect(archive.status).toBe(200)
    await expect(archive.json()).resolves.toMatchObject({ kind: 'updated', lifecycle: { status: 'archived' } })

    const auditApp = createApp({}, [[{ template_key: 'movie' }]])
    const audit = await auditApp.app.request('/crawler-tasks/task-movie/audit?limit=2', { method: 'GET' })
    expect(audit.status).toBe(200)
    expect(crawlerTaskRepository.listTaskAudit).toHaveBeenCalledWith({ cursor: undefined, limit: 2, taskId: 'task-movie' })
  })

  it('rejects malformed task history cursors before the repository query', async () => {
    const { app } = createApp()
    const response = await app.request('/crawler-tasks?cursor=not-a-valid-cursor')
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(crawlerTaskRepository.listTasks).not.toHaveBeenCalled()
  })

  it('keeps log cursors sequence-based and rejects token/header-shaped log fields', async () => {
    crawlerTaskRepository.listRunLogs.mockResolvedValueOnce({
      logs: [{ code: 'crawl_progress', level: 'info', sequence: 9 }],
      nextCursor: 9,
    })
    const { app } = createApp({}, [[{ template_key: 'movie' }], [{ id: 'run-movie' }]])
    const response = await app.request('/crawler-tasks/task-movie/runs/run-movie/logs?cursor=10&limit=2')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      logs: [{ code: 'crawl_progress', level: 'info', sequence: 9 }],
      nextCursor: 9,
    })
    const injected = await app.request('/crawler-tasks/task-movie/runs/run-movie/logs?authorization=Bearer%20TOKEN&cursor=10')
    expect(injected.status).toBeGreaterThanOrEqual(400)
  })

  it('creates the D1 association before a fixed provider dispatch and never projects token-shaped provider fields', async () => {
    crawlerTaskRepository.createOrGetActiveRun.mockResolvedValueOnce({
      kind: 'created',
      run: { attemptNumber: 1, id: 'run-movie', taskId: 'task-movie' },
    })
    actionsClient.dispatchWorkflow.mockResolvedValueOnce({
      ok: true,
      value: { kind: 'dispatch_accepted', token: 'ghs_hidden-value' },
    })
    const { app } = createApp()

    const response = await app.request('/crawler-tasks', {
      body: JSON.stringify({ template: 'movie' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }, {
      GITHUB_ACTIONS_ENVIRONMENT: 'starye-org',
      GITHUB_ACTIONS_OWNER: 'inspire-man',
      GITHUB_ACTIONS_REPOSITORY: 'starye',
      GITHUB_APP_ID: '1',
      GITHUB_APP_INSTALLATION_ID: '2',
      GITHUB_APP_PRIVATE_KEY: 'test-key',
    } as any)

    const body = await response.json()
    expect(crawlerTaskRepository.ensureProviderAssociation).toHaveBeenCalledBefore(actionsClient.dispatchWorkflow)
    expect(crawlerTaskRepository.claimDispatch).toHaveBeenCalledWith('run-movie')
    expect(actionsClient.dispatchWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      dispatch: expect.objectContaining({ attempt: 1, runId: 'run-movie', template: 'movie' }),
    }))
    expect(body).toMatchObject({ dispatch: { provider: { accepted: true, kind: 'dispatch_accepted' } } })
    expect(JSON.stringify(body)).not.toContain('ghs_hidden-value')
  })

  it('leaves a locally runnable run queued when the provider is not configured', async () => {
    crawlerTaskRepository.createOrGetActiveRun.mockResolvedValueOnce({
      kind: 'created',
      run: { attemptNumber: 1, id: 'run-local', status: 'queued', taskId: 'task-local' },
    })
    const { app } = createApp()

    const response = await app.request('/crawler-tasks', {
      body: JSON.stringify({ template: 'movie' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      dispatch: { kind: 'provider_not_configured' },
      run: { id: 'run-local', status: 'queued' },
    })
    expect(crawlerTaskRepository.ensureProviderAssociation).not.toHaveBeenCalled()
    expect(crawlerTaskRepository.claimDispatch).not.toHaveBeenCalled()
    expect(actionsClient.dispatchWorkflow).not.toHaveBeenCalled()
  })

  it('requires confirmation and current repairable movie state before creating a repair_players task', async () => {
    const noConfirm = createApp()
    const noConfirmResponse = await noConfirm.app.request('/crawler-tasks/repair-players', {
      body: JSON.stringify({
        movieId: 'movie-1',
        reason: 'no_source',
        targetIntent: 'restore_playable_sources',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(noConfirmResponse.status).toBeGreaterThanOrEqual(400)
    expect(crawlerTaskRepository.createOrGetActiveRun).not.toHaveBeenCalled()

    const mismatch = createApp({}, [[{
      id: 'movie-1',
      source_revision: 7,
      source_reason: 'source_failed',
      source_disposition: 'source_failed',
      title: 'Repair Movie',
    }]])
    const mismatchResponse = await mismatch.app.request('/crawler-tasks/repair-players', {
      body: JSON.stringify({
        confirmed: true,
        movieId: 'movie-1',
        reason: 'no_source',
        targetIntent: 'restore_playable_sources',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(mismatchResponse.status).toBe(409)
    expect(crawlerTaskRepository.createOrGetActiveRun).not.toHaveBeenCalled()
  })

  it('rejects a repair command for a missing movie or forbidden role before repository mutation', async () => {
    const missingMovie = createApp({}, [[]])
    const notFound = await missingMovie.app.request('/crawler-tasks/repair-players', {
      body: JSON.stringify({
        confirmed: true,
        movieId: 'movie-missing',
        reason: 'no_source',
        targetIntent: 'restore_playable_sources',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(notFound.status).toBe(404)

    const forbidden = createApp({ role: 'comic_admin' }, [[{
      id: 'movie-1',
      source_revision: 7,
      source_reason: 'no_source',
      source_disposition: 'no_source',
      title: 'Repair Movie',
    }]])
    const denied = await forbidden.app.request('/crawler-tasks/repair-players', {
      body: JSON.stringify({
        confirmed: true,
        movieId: 'movie-1',
        reason: 'no_source',
        targetIntent: 'restore_playable_sources',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(denied.status).toBe(403)
    expect(crawlerTaskRepository.createOrGetActiveRun).not.toHaveBeenCalled()
  })

  it('creates a single-movie repair task with fixed server-owned inputs and bounded response fields', async () => {
    crawlerTaskRepository.createOrGetActiveRun.mockResolvedValueOnce({
      kind: 'created',
      run: { attemptNumber: 1, id: 'run-repair', taskId: 'task-repair' },
    })
    crawlerTaskRepository.getTaskDetail.mockResolvedValueOnce({
      runs: [{
        attemptNumber: 1,
        cancelRequestedAt: null,
        createdAt: 100,
        failureCode: null,
        id: 'run-repair',
        provider: {
          providerRunId: '123',
          providerRunUrl: 'https://github.com/inspire-man/starye/actions/runs/123',
          workflow: '.github/workflows/daily-movie-crawl.yml',
        },
        receipt: null,
        stateVersion: 0,
        status: 'queued',
        taskId: 'task-repair',
        terminalAt: null,
        updatedAt: 100,
      }],
      task: {
        createdAt: 100,
        id: 'task-repair',
        latestRunId: 'run-repair',
        templateKey: 'movie',
        updatedAt: 100,
      },
    })
    const { app } = createApp({}, [[{
      code: 'SUN-064',
      id: 'movie-1',
      source_revision: 7,
      source_reason: 'no_source',
      source_disposition: 'no_source',
      title: 'Repair Movie',
    }], [], [{
      code: 'SUN-064',
      id: 'movie-1',
      source_revision: 7,
      source_reason: 'no_source',
      source_disposition: 'no_source',
      title: 'Repair Movie',
    }], [{
      created_at: 100,
      id: 'task-repair',
      latest_run_id: 'run-repair',
      operation: 'repair_players',
      request_snapshot_json: JSON.stringify({
        entrypoint: 'movie-crawler',
        movieId: 'movie-1',
        operation: 'repair_players',
        permissionResource: 'movie',
        reason: 'no_source',
        sourceRevision: 7,
        targetIntent: 'restore_playable_sources',
        templateKey: 'movie',
        templateVersion: 1,
      }),
      template_key: 'movie',
      updated_at: 100,
    }], [{
      attempt_number: 1,
      cancel_requested_at: null,
      created_at: 100,
      failure_code: null,
      id: 'run-repair',
      receipt_summary_json: null,
      status: 'queued',
      task_id: 'task-repair',
      terminal_at: null,
      updated_at: 100,
    }]])

    const response = await app.request('/crawler-tasks/repair-players', {
      body: JSON.stringify({
        confirmed: true,
        movieId: 'movie-1',
        reason: 'no_source',
        targetIntent: 'restore_playable_sources',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    expect(crawlerTaskRepository.createOrGetActiveRun).toHaveBeenCalledWith(expect.objectContaining({
      movieId: 'movie-1',
      operation: 'repair_players',
      reason: 'no_source',
      requestedByUserId: 'admin-1',
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
    }))

    const body = await response.json()
    expect(body).toMatchObject({
      kind: 'created',
      task: {
        allowedNextAction: 'wait_for_observation',
        id: 'task-repair',
        movie: { code: 'SUN-064', id: 'movie-1', title: 'Repair Movie' },
        operation: 'repair_players',
        reason: 'no_source',
        sourceRevision: 7,
        targetIntent: 'restore_playable_sources',
      },
      run: {
        attemptNumber: 1,
        id: 'run-repair',
        status: 'queued',
      },
    })
    expect(JSON.stringify(body)).not.toContain('providerRunUrl')
    expect(JSON.stringify(body)).not.toContain('workflow')
    expect(JSON.stringify(body)).not.toContain('command')
    expect(JSON.stringify(body)).not.toContain('signature')
  })

  it('returns the same bounded movie identity for repair detail and preserves history', async () => {
    const latestReceipt = JSON.stringify({
      movieId: 'movie-1',
      observedAt: 200,
      operation: 'repair_players',
      rawRunnerField: 'hidden-runner-value',
      sourceRevision: 8,
      sourceSummary: [{ eligible: true, health: 'unverified', observedAt: 200, reasonCode: 'source_unverified', sourceType: 'direct' }],
    })
    const previousReceipt = JSON.stringify({
      movieId: 'movie-1',
      observedAt: 150,
      operation: 'repair_players',
      sourceRevision: 7,
      sourceSummary: [{ eligible: false, health: 'failed', observedAt: 150, reasonCode: 'source_read_failed', sourceType: 'direct' }],
    })
    const snapshot = JSON.stringify({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'no_source',
      sourceRevision: 8,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    })
    const { app } = createApp({}, [[{
      operation: 'repair_players',
      request_snapshot_json: snapshot,
      template_key: 'movie',
    }], [{
      code: 'SUN-064',
      id: 'movie-1',
      source_disposition: 'no_source',
      source_reason: 'no_eligible_source',
      source_revision: 8,
      title: 'Repair Movie',
    }], [{
      created_at: 200,
      id: 'task-repair',
      latest_run_id: 'run-repair-2',
      operation: 'repair_players',
      request_snapshot_json: snapshot,
      template_key: 'movie',
      updated_at: 200,
    }], [{
      attempt_number: 2,
      cancel_requested_at: null,
      created_at: 200,
      failure_code: null,
      id: 'run-repair-2',
      receipt_summary_json: latestReceipt,
      status: 'succeeded',
      task_id: 'task-repair',
      terminal_at: 200,
      updated_at: 200,
    }, {
      attempt_number: 1,
      cancel_requested_at: null,
      created_at: 150,
      failure_code: 'source_read_failed',
      id: 'run-repair-1',
      receipt_summary_json: previousReceipt,
      status: 'failed',
      task_id: 'task-repair',
      terminal_at: 150,
      updated_at: 150,
    }]])

    const response = await app.request('/crawler-tasks/task-repair')

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      run: {
        id: 'run-repair-2',
        receipt: { movieId: 'movie-1', sourceRevision: 8 },
      },
      runs: [
        { id: 'run-repair-2', receipt: { movieId: 'movie-1', sourceRevision: 8 } },
        { failureCode: 'source_read_failed', id: 'run-repair-1', receipt: { movieId: 'movie-1', sourceRevision: 7 } },
      ],
      task: {
        id: 'task-repair',
        movie: { code: 'SUN-064', id: 'movie-1', title: 'Repair Movie' },
        operation: 'repair_players',
      },
    })
    expect(JSON.stringify(body)).not.toContain('rawRunnerField')
    expect(JSON.stringify(body)).not.toContain('hidden-runner-value')
  })

  it('locks an active same-movie repair and focuses its current attempt without creating a duplicate', async () => {
    const snapshot = JSON.stringify({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'no_source',
      sourceRevision: 7,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    })
    const { app } = createApp({}, [[{
      code: 'SUN-064',
      id: 'movie-1',
      source_disposition: 'no_source',
      source_reason: 'no_eligible_source',
      source_revision: 7,
      title: 'Repair Movie',
    }], [{
      created_at: 100,
      id: 'task-repair-active',
      latest_run_id: 'run-repair-active',
      operation: 'repair_players',
      request_snapshot_json: snapshot,
      template_key: 'movie',
      updated_at: 100,
    }], [{
      created_at: 100,
      id: 'task-repair-active',
      latest_run_id: 'run-repair-active',
      operation: 'repair_players',
      request_snapshot_json: snapshot,
      template_key: 'movie',
      updated_at: 100,
    }], [{
      attempt_number: 1,
      cancel_requested_at: null,
      created_at: 100,
      failure_code: null,
      id: 'run-repair-active',
      receipt_summary_json: null,
      status: 'running',
      task_id: 'task-repair-active',
      terminal_at: null,
      updated_at: 100,
    }]])

    const response = await app.request('/crawler-tasks/repair-players', {
      body: JSON.stringify({ confirmed: true, movieId: 'movie-1', reason: 'no_source', targetIntent: 'restore_playable_sources' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      currentAttempt: { id: 'run-repair-active', status: 'running' },
      kind: 'existing_active_run',
      task: {
        activeDuplicateLock: { locked: true },
        id: 'task-repair-active',
      },
    })
    expect(crawlerTaskRepository.createOrGetActiveRun).not.toHaveBeenCalled()
  })

  it('rereads a terminal repair disposition before allowing a new task', async () => {
    const { app } = createApp({}, [[{
      code: 'SUN-064',
      id: 'movie-1',
      source_disposition: 'no_source',
      source_revision: 7,
      title: 'Repair Movie',
    }], [], [{
      code: 'SUN-064',
      id: 'movie-1',
      source_disposition: 'ready',
      source_revision: 8,
      title: 'Repair Movie',
    }]])

    const response = await app.request('/crawler-tasks/repair-players', {
      body: JSON.stringify({ confirmed: true, movieId: 'movie-1', reason: 'no_source', targetIntent: 'restore_playable_sources' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(409)
    expect(crawlerTaskRepository.createOrGetActiveRun).not.toHaveBeenCalled()
  })

  it('projects provider, lease, reconciliation, receipt, source readback, and safe cursor facts separately', async () => {
    const receipt = JSON.stringify({
      movieId: 'movie-1',
      observedAt: 200,
      operation: 'repair_players',
      sourceRevision: 8,
      sourceSummary: [{ eligible: true, health: 'unverified', observedAt: 200, reasonCode: 'source_unverified', sourceType: 'direct' }],
    })
    const snapshot = JSON.stringify({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'no_source',
      sourceRevision: 7,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    })
    const { app } = createApp({}, [[{
      operation: 'repair_players',
      request_snapshot_json: snapshot,
      template_key: 'movie',
    }], [{
      code: 'SUN-064',
      id: 'movie-1',
      source_disposition: 'ready',
      source_reason: null,
      source_revision: 8,
      title: 'Repair Movie',
    }], [{
      created_at: 200,
      id: 'task-repair',
      latest_run_id: 'run-repair',
      operation: 'repair_players',
      request_snapshot_json: snapshot,
      template_key: 'movie',
      updated_at: 200,
    }], [{
      active_lease_expires_at: null,
      active_lease_renewed_at: null,
      attempt_number: 1,
      cancel_requested_at: null,
      created_at: 100,
      failure_code: null,
      id: 'run-repair',
      last_heartbeat_at: 150,
      provider: 'github-actions',
      provider_conclusion: 'success',
      provider_environment: 'starye-org',
      provider_reconciliation_window_ends_at: 500,
      provider_ref: 'main',
      provider_repository: 'inspire-man/starye',
      provider_run_attempt: 1,
      provider_run_id: '123',
      provider_sha: 'a'.repeat(40),
      provider_status: 'completed',
      provider_updated_at: 200,
      provider_workflow: '.github/workflows/daily-movie-crawl.yml',
      receipt_primary_content_id: 'movie-1',
      receipt_schema_version: 2,
      receipt_source_revision: 8,
      receipt_summary_json: receipt,
      state_version: 2,
      status: 'succeeded',
      task_id: 'task-repair',
      terminal_at: 200,
      updated_at: 200,
    }], [{
      disposition: 'ready',
      eligible_count: 1,
      observed_at: 200,
      reason_code: null,
      repairable: 0,
      source_revision: 8,
    }], [{
      eligible: 1,
      health: 'unverified',
      observed_at: 200,
      reason_code: 'source_unverified',
      source_type: 'direct',
    }], [{
      created_at: 200,
      reason_code: 'provider_success_pending_receipt',
      run_id: 'run-repair',
      safe_summary: 'hidden safe summary',
    }], []])

    const response = await app.request('/crawler-tasks/task-repair')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      currentAttempt: {
        lease: { outcome: 'released' },
        provider: {
          providerRunId: '123',
          providerRunUrl: 'https://github.com/inspire-man/starye/actions/runs/123',
        },
        receiptValidation: { identityMatch: true, readbackMatch: true, status: 'validated' },
        reconciliation: { outcome: 'observed' },
        repair: { status: 'validated' },
        safeLogCursor: null,
        sourceReadback: { movieId: 'movie-1', sourceRevision: 8 },
      },
      task: {
        sameMovieIdentity: true,
        source: { disposition: 'ready', sourceRevision: 8 },
      },
    })
    expect(JSON.stringify(body)).not.toContain('hidden safe summary')
    expect(JSON.stringify(body)).not.toContain('safe_facts_json')
  })

  it('keeps a repair receipt failed when the current authoritative readback is incomplete', async () => {
    const receipt = JSON.stringify({
      movieId: 'movie-1',
      observedAt: 200,
      operation: 'repair_players',
      sourceRevision: 8,
      sourceSummary: [{ eligible: true, health: 'unverified', observedAt: 200, reasonCode: 'source_unverified', sourceType: 'direct' }],
    })
    const snapshot = JSON.stringify({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'no_source',
      sourceRevision: 7,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    })
    const { app } = createApp({}, [[{
      operation: 'repair_players',
      request_snapshot_json: snapshot,
      template_key: 'movie',
    }], [{
      code: 'SUN-064',
      id: 'movie-1',
      source_disposition: 'ready',
      source_reason: null,
      source_revision: 8,
      title: 'Repair Movie',
    }], [{
      created_at: 200,
      id: 'task-repair',
      latest_run_id: 'run-repair',
      operation: 'repair_players',
      request_snapshot_json: snapshot,
      template_key: 'movie',
      updated_at: 200,
    }], [{
      attempt_number: 1,
      cancel_requested_at: null,
      created_at: 100,
      failure_code: null,
      id: 'run-repair',
      receipt_summary_json: receipt,
      status: 'succeeded',
      task_id: 'task-repair',
      terminal_at: 200,
      updated_at: 200,
    }], [{
      disposition: 'ready',
      eligible_count: 1,
      observed_at: 200,
      reason_code: null,
      repairable: 0,
      source_revision: 8,
    }], [], [], []])

    const response = await app.request('/crawler-tasks/task-repair')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      currentAttempt: {
        receiptValidation: {
          failureCode: 'receipt_readback_mismatch',
          readbackMatch: false,
          status: 'failed',
        },
        repair: { failureCode: 'receipt_readback_mismatch', status: 'failed' },
      },
      task: { sameMovieIdentity: true },
    })
  })

  it('blocks a repair run retry when the current source disposition is no longer repairable', async () => {
    const snapshot = JSON.stringify({
      entrypoint: 'movie-crawler',
      movieId: 'movie-1',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'no_source',
      sourceRevision: 7,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    })
    const { app } = createApp({}, [[{
      operation: 'repair_players',
      request_snapshot_json: snapshot,
      template_key: 'movie',
    }], [{ id: 'run-repair' }], [{
      id: 'movie-1',
      source_disposition: 'ready',
      source_revision: 8,
    }]])

    const response = await app.request('/crawler-tasks/task-repair/runs/run-repair/retry', {
      body: JSON.stringify({ confirmed: true }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(409)
    expect(crawlerTaskRepository.retryRun).not.toHaveBeenCalled()
  })

  it('protects playback evidence with the session and task/run ownership boundary', async () => {
    const noSession = createApp(null)
    const noSessionResponse = await noSession.app.request('/crawler-tasks/task-movie/runs/run-movie/playback-evidence', {
      body: JSON.stringify(createPlaybackEvidence()),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(noSessionResponse.status).toBe(401)

    const wrongRun = createApp({}, [[{ template_key: 'movie' }], []])
    const wrongRunResponse = await wrongRun.app.request('/crawler-tasks/task-movie/runs/run-manga/playback-evidence', {
      body: JSON.stringify(createPlaybackEvidence({ tuple: { ...createPlaybackEvidence().tuple, runId: 'run-manga' } })),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(wrongRunResponse.status).toBe(404)
    expect(playbackEvidenceRepository.accept).not.toHaveBeenCalled()

    const sensitive = createApp({}, [[{ template_key: 'movie' }], [{ id: 'run-movie' }], [{ attempt_number: 1 }]])
    const sensitiveResponse = await sensitive.app.request('/crawler-tasks/task-movie/runs/run-movie/playback-evidence', {
      body: JSON.stringify({
        ...createPlaybackEvidence(),
        command: 'pnpm run crawler',
        environment: 'production',
        repository: 'owner/repository',
        secret: 'TOKEN',
        target: 'TARGET',
        url: 'https://example.invalid/media.m3u8',
        workflow: 'workflow.yml',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(sensitiveResponse.status).toBeGreaterThanOrEqual(400)
    expect(playbackEvidenceRepository.accept).not.toHaveBeenCalled()

    const tupleMismatch = createApp({}, [[{ template_key: 'movie' }], [{ id: 'run-movie' }], [{ attempt_number: 1 }]])
    const tupleMismatchResponse = await tupleMismatch.app.request('/crawler-tasks/task-movie/runs/run-movie/playback-evidence', {
      body: JSON.stringify(createPlaybackEvidence({ tuple: { ...createPlaybackEvidence().tuple, taskId: 'task-other' } })),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(tupleMismatchResponse.status).toBe(409)
    expect(playbackEvidenceRepository.accept).not.toHaveBeenCalled()
  })

  it('uses the server attempt identity and preserves stable playback outcomes', async () => {
    playbackEvidenceRepository.accept
      .mockResolvedValueOnce({ kind: 'accepted', summary: { outcome: 'accepted' } })
      .mockResolvedValueOnce({ kind: 'duplicate', summary: { outcome: 'duplicate' } })
      .mockResolvedValueOnce({ artifact: { reference: 'phase24/task-movie/run-movie/attempt-1.json' }, kind: 'conflict', reason: 'same_evidence_identity_hash_conflict' })
      .mockResolvedValueOnce({ artifact: { reference: 'phase24/task-movie/run-movie/attempt-1.json' }, kind: 'rejected', outcome: 'stale', reason: 'source_revision_changed', rejection: { outcome: 'stale' } })

    const makeRequest = async () => {
      const { app } = createApp({}, [[{ template_key: 'movie' }], [{ id: 'run-movie' }], [{ attempt_number: 1 }]])
      return app.request('/crawler-tasks/task-movie/runs/run-movie/playback-evidence', {
        body: JSON.stringify(createPlaybackEvidence()),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    }

    await expect((await makeRequest()).json()).resolves.toMatchObject({ kind: 'accepted' })
    await expect((await makeRequest()).json()).resolves.toMatchObject({ kind: 'duplicate' })
    await expect((await makeRequest()).json()).resolves.toMatchObject({ kind: 'conflict' })
    await expect((await makeRequest()).json()).resolves.toMatchObject({ kind: 'rejected', outcome: 'stale' })
    expect(playbackEvidenceRepository.accept).toHaveBeenCalledWith(expect.objectContaining({
      artifact: expect.objectContaining({ reference: 'phase24/task-movie/run-movie/attempt-1.json' }),
      runId: 'run-movie',
      taskId: 'task-movie',
    }))
  })

  it('projects current playback evidence separately from bounded attempt history', async () => {
    crawlerTaskRepository.getTaskDetail.mockResolvedValueOnce({
      runs: [{ id: 'run-movie', status: 'succeeded' }],
      task: { id: 'task-movie', latestRunId: 'run-movie' },
    })
    playbackEvidenceRepository.getTaskEvidence.mockResolvedValueOnce({
      runs: [
        { runId: 'run-movie', rejections: [{ outcome: 'duplicate' }], summary: { artifact: { reference: 'phase24/current.json' }, outcome: 'accepted' } },
        { runId: 'run-old', rejections: [{ outcome: 'stale' }], summary: null },
      ],
    })

    const { app } = createApp({}, [[{ template_key: 'movie' }]])
    const response = await app.request('/crawler-tasks/task-movie')

    expect(response.status).toBe(200)
    expect(crawlerTaskRepository.getTaskDetail).toHaveBeenCalledWith('task-movie')
    await expect(response.json()).resolves.toMatchObject({
      playbackEvidence: {
        current: { runId: 'run-movie', summary: { outcome: 'accepted' }, rejections: [{ outcome: 'duplicate' }] },
        history: [{ runId: 'run-old', summary: null, rejections: [{ outcome: 'stale' }] }],
      },
    })
  })
})
