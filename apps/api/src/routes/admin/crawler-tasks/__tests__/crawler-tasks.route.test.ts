import type { AppEnv, SessionUser } from '../../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { adminCrawlerTasksRoutes } from '../index'

function createApp(user: Partial<SessionUser> | null = {}) {
  const app = new Hono<AppEnv>()
  const statement = {
    all: vi.fn().mockResolvedValue({ results: [] }),
    bind: vi.fn(),
  }
  statement.bind.mockReturnValue(statement)
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
    c.set('db', { $client: { batch: vi.fn().mockResolvedValue([]), prepare: vi.fn().mockReturnValue(statement) } } as any)
    await next()
  })
  app.route('/crawler-tasks', adminCrawlerTasksRoutes)

  return { app, getSession }
}

describe('admin crawler task routes', () => {
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
})
