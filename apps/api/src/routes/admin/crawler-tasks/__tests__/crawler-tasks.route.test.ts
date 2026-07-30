import type { AppEnv, SessionUser } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { adminCrawlerTasksRoutes } from '../index'

const crawlerTaskRepository = vi.hoisted(() => ({
  applyTransition: vi.fn(),
  createOrGetActiveRun: vi.fn().mockResolvedValue({ kind: 'created', run: { id: 'run-movie' } }),
  retryRun: vi.fn(),
}))

vi.mock('../../../../domain/crawler-tasks/repository', () => ({
  createCrawlerTaskRepository: vi.fn(() => crawlerTaskRepository),
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

describe('admin crawler task routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    await expect(response.json()).resolves.toEqual({ logs: [{ code: 'crawl_progress', sequence: 1 }] })
  })
})
