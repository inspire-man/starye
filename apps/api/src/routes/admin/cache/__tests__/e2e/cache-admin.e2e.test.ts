import type { AppEnv } from '../../../../../types'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminCacheRoutes } from '../../index'

function createMockKv(initialKeys: string[] = []) {
  const store = new Map(initialKeys.map(key => [key, key]))

  const kv = {
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    list: vi.fn(async ({ prefix, cursor }: { prefix?: string, cursor?: string } = {}) => {
      const filtered = [...store.keys()].filter(key => !prefix || key.startsWith(prefix))
      const offset = cursor ? Number(cursor) : 0
      const keys = filtered
        .slice(offset, offset + 100)
        .map(name => ({
          name,
          expiration: null,
          metadata: null,
        }))

      return {
        keys,
        list_complete: true,
        cursor: '',
      }
    }),
  } as unknown as KVNamespace

  return {
    kv,
    store,
  }
}

describe('admin cache routes e2e', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createApp() {
    const app = new Hono<AppEnv>()
    app.route('/api/admin/cache', adminCacheRoutes)
    return app
  }

  it('returns gateway cache stats when authenticated by service token', async () => {
    const app = createApp()
    const { kv } = createMockKv([
      'gateway-cache:v2:movies:public:%2Fapi%2Fmovies',
      'gateway-cache:v2:favorites:private:user-a:%2Fapi%2Ffavorites',
      'gateway-cache:v2:favorites:private:user-b:%2Fapi%2Ffavorites',
    ])

    const response = await app.request('/api/admin/cache/stats', {
      headers: {
        'x-service-token': 'test-secret',
      },
    }, {
      CACHE: kv,
      CRAWLER_SECRET: 'test-secret',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        groups: {
          favorites: 2,
          movies: 1,
        },
        headers: ['X-Cache-Status', 'X-Cache-Group', 'X-Cache-Policy', 'X-Cache-TTL', 'Age'],
        prefix: 'gateway-cache:v2',
      },
    })
  })

  it('clears only movie gateway cache entries via the admin endpoint', async () => {
    const app = createApp()
    const { kv, store } = createMockKv([
      'gateway-cache:v2:movies:public:%2Fapi%2Fmovies',
      'gateway-cache:v2:movies:public:%2Fapi%2Fpublic%2Fmovies',
      'gateway-cache:v2:favorites:private:user-a:%2Fapi%2Ffavorites',
    ])

    const response = await app.request('/api/admin/cache/clear/movies', {
      method: 'POST',
      headers: {
        'x-service-token': 'test-secret',
      },
    }, {
      CACHE: kv,
      CRAWLER_SECRET: 'test-secret',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: '电影缓存已清空',
      data: {
        deleted: 2,
      },
    })
    expect([...store.keys()]).toEqual(['gateway-cache:v2:favorites:private:user-a:%2Fapi%2Ffavorites'])
  })

  it('clears gateway, actor, and publisher cache families in one request', async () => {
    const app = createApp()
    const { kv, store } = createMockKv([
      'gateway-cache:v2:movies:public:%2Fapi%2Fmovies',
      'gateway-cache:v2:favorites:private:user-a:%2Fapi%2Ffavorites',
      'actors:list:1:20:{}',
      'actors:detail:act-1',
      'actors:stats',
      'actors:nationalities',
      'publishers:list:1:20:{}',
      'publishers:detail:pub-1',
      'publishers:stats',
      'publishers:countries',
      'unrelated:key',
    ])

    const response = await app.request('/api/admin/cache/clear', {
      method: 'POST',
      headers: {
        'x-service-token': 'test-secret',
      },
    }, {
      CACHE: kv,
      CRAWLER_SECRET: 'test-secret',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: '缓存已清空',
      data: {
        gatewayCache: {
          favorites: 1,
          movies: 1,
        },
      },
    })
    expect([...store.keys()]).toEqual(['unrelated:key'])
  })
})
