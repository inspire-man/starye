import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { adminSyncRoutes } from '../index'

const syncCrawlerData = vi.hoisted(() => vi.fn(async (c: any) => c.json({
  accepted: true,
  payload: c.req.valid('json'),
})))

vi.mock('../handlers', () => ({ syncCrawlerData }))

const baseMovie = {
  title: 'Phase 20 route contract probe',
  slug: 'phase20-route-contract-probe',
  code: 'P20-ROUTE',
  sourceUrl: 'https://example.com/phase20-route-contract-probe',
  isR18: false,
}

function createApp() {
  const app = new Hono<AppEnv>()
  app.route('/api/admin/sync', adminSyncRoutes)
  return app
}

async function postMovie(data: Record<string, unknown>) {
  const app = createApp()
  return app.request('/api/admin/sync', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-service-token': 'test-secret',
    },
    body: JSON.stringify({ type: 'movie', data }),
  }, {
    CRAWLER_SECRET: 'test-secret',
  } as AppEnv['Bindings'])
}

describe('admin sync movie route contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts omitted players and preserves the field absence for the handler', async () => {
    const response = await postMovie({ ...baseMovie })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      payload: {
        type: 'movie',
        data: baseMovie,
      },
    })
    expect(syncCrawlerData).toHaveBeenCalledOnce()
    expect((syncCrawlerData.mock.results[0] as any).type).toBe('return')
  })

  it('accepts explicit empty players for stale-source reconciliation', async () => {
    const response = await postMovie({ ...baseMovie, players: [] })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      payload: {
        type: 'movie',
        data: { ...baseMovie, players: [] },
      },
    })
    expect(syncCrawlerData).toHaveBeenCalledOnce()
  })
})
