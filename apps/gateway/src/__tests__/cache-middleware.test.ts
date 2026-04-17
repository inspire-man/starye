import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCachedProxy, invalidateCache } from '../cache-middleware'

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
    list: vi.fn(async ({ prefix, cursor }: { prefix?: string, cursor?: string } = {}) => {
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
        cursor: cursor || '',
      }
    }),
  } as unknown as KVNamespace

  return { kv, store }
}

describe('gateway cache middleware', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('caches movie list responses in KV and returns HIT on repeat requests', async () => {
    const { kv } = createMockKv()
    let calls = 0

    const cachedProxy = createCachedProxy(kv, async () => {
      calls += 1
      return Response.json({ calls })
    })

    const request = new Request('https://starye.org/api/movies?page=1')

    const missResponse = await cachedProxy(request, 'https://api.starye.org')
    expect(missResponse.headers.get('X-Cache-Status')).toBe('MISS')
    expect(missResponse.headers.get('X-Cache-Group')).toBe('movies')
    expect(missResponse.headers.get('X-Cache-Policy')).toBe('public')
    expect(missResponse.headers.get('Cache-Control')).toContain('max-age=300')

    const hitResponse = await cachedProxy(request, 'https://api.starye.org')
    expect(hitResponse.headers.get('X-Cache-Status')).toBe('HIT')
    expect(await hitResponse.json()).toEqual({ calls: 1 })
    expect(calls).toBe(1)
  })

  it('isolates favorites cache per user cookie', async () => {
    const { kv } = createMockKv()
    let calls = 0

    const cachedProxy = createCachedProxy(kv, async (request) => {
      calls += 1
      return Response.json({
        calls,
        cookie: request.headers.get('cookie'),
      })
    })

    const firstUserRequest = new Request('https://starye.org/api/favorites?page=1', {
      headers: {
        cookie: 'session=user-a',
      },
    })
    const secondUserRequest = new Request('https://starye.org/api/favorites?page=1', {
      headers: {
        cookie: 'session=user-b',
      },
    })

    const firstMiss = await cachedProxy(firstUserRequest, 'https://api.starye.org')
    expect(firstMiss.headers.get('X-Cache-Status')).toBe('MISS')
    expect(firstMiss.headers.get('Cache-Control')).toContain('private')
    expect(firstMiss.headers.get('Vary')).toContain('Cookie')

    const secondMiss = await cachedProxy(secondUserRequest, 'https://api.starye.org')
    expect(secondMiss.headers.get('X-Cache-Status')).toBe('MISS')

    const firstHit = await cachedProxy(firstUserRequest, 'https://api.starye.org')
    expect(firstHit.headers.get('X-Cache-Status')).toBe('HIT')
    expect(await firstHit.json()).toEqual({
      calls: 1,
      cookie: 'session=user-a',
    })
    expect(calls).toBe(2)
  })

  it('applies immutable cache headers to static assets without KV storage', async () => {
    const { kv } = createMockKv()

    const cachedProxy = createCachedProxy(kv, async () => {
      return new Response('console.log("asset")', {
        headers: {
          'content-type': 'application/javascript',
        },
      })
    })

    const response = await cachedProxy(
      new Request('https://starye.org/movie/assets/app.js'),
      'https://movie.starye.org',
    )

    expect(response.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
  })

  it('marks dashboard routes as no-store', async () => {
    const { kv } = createMockKv()

    const cachedProxy = createCachedProxy(kv, async () => {
      return new Response('<html>dashboard</html>', {
        headers: {
          'content-type': 'text/html',
        },
      })
    })

    const response = await cachedProxy(
      new Request('https://starye.org/dashboard/settings'),
      'https://dashboard.starye.org',
      undefined,
      { bypassCache: true },
    )

    expect(response.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('invalidates cache entries by prefix', async () => {
    const { kv, store } = createMockKv()

    store.set('gateway-cache:v2:movies:public:%2Fapi%2Fmovies', 'movie-cache')
    store.set('gateway-cache:v2:favorites:private:abc:%2Fapi%2Ffavorites', 'favorite-cache')

    const deleted = await invalidateCache(kv, 'gateway-cache:v2:movies:')

    expect(deleted).toBe(1)
    expect([...store.keys()]).toEqual(['gateway-cache:v2:favorites:private:abc:%2Fapi%2Ffavorites'])
  })
})
