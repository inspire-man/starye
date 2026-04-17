import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearGatewayCacheGroup } from '../../../api/src/lib/gateway-cache'
import { createCachedProxy } from '../cache-middleware'

function createMockKv() {
  const store = new Map<string, string>()

  const kv = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    list: vi.fn(async ({ prefix }: { prefix?: string } = {}) => {
      const keys = [...store.keys()]
        .filter(key => !prefix || key.startsWith(prefix))
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

  return { kv, store }
}

describe('gateway cache consistency e2e', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('serves fresh movie data after API-side invalidation clears the gateway cache group', async () => {
    const { kv, store } = createMockKv()
    let upstreamVersion = 1

    const cachedProxy = createCachedProxy(kv, async () => {
      return Response.json({
        version: upstreamVersion,
      })
    })

    const request = new Request('https://starye.org/api/movies?page=1')

    const firstResponse = await cachedProxy(request, 'https://api.starye.org')
    expect(firstResponse.headers.get('X-Cache-Status')).toBe('MISS')
    expect(await firstResponse.json()).toEqual({ version: 1 })
    expect(store.size).toBe(1)

    upstreamVersion = 2

    const staleResponse = await cachedProxy(request, 'https://api.starye.org')
    expect(staleResponse.headers.get('X-Cache-Status')).toBe('HIT')
    expect(await staleResponse.json()).toEqual({ version: 1 })

    await expect(clearGatewayCacheGroup(kv, 'movies')).resolves.toBe(1)
    expect(store.size).toBe(0)

    const freshResponse = await cachedProxy(request, 'https://api.starye.org')
    expect(freshResponse.headers.get('X-Cache-Status')).toBe('MISS')
    expect(await freshResponse.json()).toEqual({ version: 2 })
  })

  it('clears all user-scoped favorites caches so the next request reflects the latest state', async () => {
    const { kv } = createMockKv()
    const counters = {
      a: 0,
      b: 0,
    }

    const cachedProxy = createCachedProxy(kv, async (request) => {
      const cookie = request.headers.get('cookie') || ''
      const user = cookie.includes('user-b') ? 'b' : 'a'
      counters[user] += 1

      return Response.json({
        user,
        version: counters[user],
      })
    })

    const requestA = new Request('https://starye.org/api/favorites?page=1', {
      headers: {
        cookie: 'session=user-a',
      },
    })
    const requestB = new Request('https://starye.org/api/favorites?page=1', {
      headers: {
        cookie: 'session=user-b',
      },
    })

    await cachedProxy(requestA, 'https://api.starye.org')
    await cachedProxy(requestB, 'https://api.starye.org')

    const cachedA = await cachedProxy(requestA, 'https://api.starye.org')
    const cachedB = await cachedProxy(requestB, 'https://api.starye.org')
    expect(cachedA.headers.get('X-Cache-Status')).toBe('HIT')
    expect(cachedB.headers.get('X-Cache-Status')).toBe('HIT')

    await expect(clearGatewayCacheGroup(kv, 'favorites')).resolves.toBe(2)

    const refreshedA = await cachedProxy(requestA, 'https://api.starye.org')
    const refreshedB = await cachedProxy(requestB, 'https://api.starye.org')
    expect(refreshedA.headers.get('X-Cache-Status')).toBe('MISS')
    expect(refreshedB.headers.get('X-Cache-Status')).toBe('MISS')
    expect(await refreshedA.json()).toEqual({ user: 'a', version: 2 })
    expect(await refreshedB.json()).toEqual({ user: 'b', version: 2 })
  })
})
