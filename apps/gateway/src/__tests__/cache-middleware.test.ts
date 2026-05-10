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

  // ─── D-11 Nyquist 采样骨架（Plan 02 填断言）─────────────────────────────────
  // 来源：.planning/phases/01-auth-gateway/01-VALIDATION.md L57-66 + 01-RESEARCH.md §Gateway Cache Bypass Implementation
  // 激活方式：Plan 02 删除 `.todo` 并补全 async 实现体。保持 title 中 `D-11 #N` 前缀稳定以便追溯。
  /* eslint-disable test/prefer-lowercase-title -- D-11 matrix identifier must remain uppercase for traceability */

  // D-11 #1: baseline regression — 无头 public group 仍走 MISS→HIT（Plan 02 实现后激活）
  it.todo('D-11 #1: caches /api/movies on public group when no auth headers present (MISS then HIT)')

  // D-11 #2: AUTH-07 — 带 session cookie → BYPASS + X-Cache-Reason
  it.todo('D-11 #2: bypasses KV on /api/movies when request has Cookie header (BYPASS, X-Cache-Reason=auth-headers)')

  // D-11 #3: AUTH-07 — 带 Authorization → BYPASS + X-Cache-Reason
  it.todo('D-11 #3: bypasses KV on /api/movies when request has Authorization header (BYPASS, X-Cache-Reason=auth-headers)')

  // D-11 #4: AUTH-06 — /api/auth/* 无论头都 BYPASS（NO_STORE_PREFIXES 独立命中）
  it.todo('D-11 #4: bypasses /api/auth/get-session regardless of request headers')
  /* eslint-enable test/prefer-lowercase-title */
})
