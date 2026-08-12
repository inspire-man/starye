import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminCrawlerTasksRoutes } from './index'

const repository = vi.hoisted(() => ({
  createOrGetActiveRun: vi.fn(),
  ensureProviderAssociation: vi.fn(),
}))

vi.mock('../../../domain/crawler-tasks/repository', () => ({
  createCrawlerTaskRepository: vi.fn(() => repository),
}))

function createApp() {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('auth', { api: { getSession: async () => ({ user: { id: 'admin-1', role: 'movie_admin' } }) } } as never)
    c.set('db', { $client: { prepare: vi.fn() } } as never)
    await next()
  })
  app.route('/crawler-tasks', adminCrawlerTasksRoutes)
  return app
}

const command = {
  idempotencyKey: 'video:movie-1:7:stale',
  movieId: 'movie-1',
  movieRevision: 3,
  policyVersion: 'video-source-probe/v1',
  reason: 'stale',
  sourceRevision: 7,
}

describe('phase 26 admin video availability boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repository.createOrGetActiveRun.mockResolvedValue({
      kind: 'duplicate',
      run: { attemptNumber: 1, id: 'run-1', taskId: 'task-1' },
    })
  })

  it('derives a revision-bound recheck operation and returns an existing identity', async () => {
    const response = await createApp().request('/crawler-tasks/video-availability', {
      body: JSON.stringify(command),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    expect(repository.createOrGetActiveRun).toHaveBeenCalledWith(expect.objectContaining({
      operationCommand: expect.objectContaining({
        idempotencyKey: command.idempotencyKey,
        intent: expect.objectContaining({ kind: 'recheck_video_source', movieRevision: 3, reason: 'stale', sourceRevision: 7 }),
        operation: 'recheck_video_source',
        policyVersion: 'video-source-probe/v1',
        target: { id: 'movie-1', kind: 'movie' },
      }),
      requestedByUserId: 'admin-1',
      templateKey: 'movie',
    }))
    await expect(response.json()).resolves.toMatchObject({ kind: 'duplicate', run: { id: 'run-1' } })
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
