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
    store.set('gateway-cache:v2:movies:public:%2Fapi%2Fmovies%3Fpage%3D2', 'movie-cache-page-2')
    store.set('gateway-cache:v2:public-pages:bypass:%2Fblog%2Findex.html', 'page-cache')

    const deleted = await invalidateCache(kv, 'gateway-cache:v2:movies:')

    expect(deleted).toBe(2)
    expect([...store.keys()]).toEqual(['gateway-cache:v2:public-pages:bypass:%2Fblog%2Findex.html'])
  })

  // ─── D-11 Nyquist 采样骨架（Plan 02 填断言）─────────────────────────────────
  // 来源：.planning/phases/01-auth-gateway/01-VALIDATION.md L57-66 + 01-RESEARCH.md §Gateway Cache Bypass Implementation
  // 激活方式：Plan 02 删除 `.todo` 并补全 async 实现体。保持 title 中 `D-11 #N` 前缀稳定以便追溯。
  /* eslint-disable test/prefer-lowercase-title -- D-11 matrix identifier must remain uppercase for traceability */

  // D-11 #1: baseline regression — 无头 public group 仍走 MISS→HIT（Plan 02 实现后激活）
  it('D-11 #1: caches /api/movies on public group when no auth headers present (MISS then HIT)', async () => {
    const { kv } = createMockKv()
    let calls = 0
    const cachedProxy = createCachedProxy(kv, async () => {
      calls += 1
      return Response.json({ calls })
    })
    const request = new Request('https://starye.org/api/movies')

    const miss = await cachedProxy(request, 'https://api.starye.org')
    expect(miss.headers.get('X-Cache-Status')).toBe('MISS')
    const hit = await cachedProxy(request, 'https://api.starye.org')
    expect(hit.headers.get('X-Cache-Status')).toBe('HIT')
    expect(calls).toBe(1)
  })

  // D-11 #2: AUTH-07 — 带 session cookie → BYPASS + X-Cache-Reason
  it('D-11 #2: bypasses KV on /api/movies when request has Cookie header (BYPASS, X-Cache-Reason=auth-headers)', async () => {
    const { kv } = createMockKv()
    let calls = 0
    const cachedProxy = createCachedProxy(kv, async () => {
      calls += 1
      return Response.json({ calls })
    })
    const request = new Request('https://starye.org/api/movies', {
      headers: { cookie: 'starye.session_token=xxx' },
    })

    const r1 = await cachedProxy(request, 'https://api.starye.org')
    expect(r1.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(r1.headers.get('X-Cache-Reason')).toBe('auth-headers')
    // CR-01：public 基线翻 bypass 时必须降级 Cache-Control，禁止泄漏 public 指令给共享缓存
    expect(r1.headers.get('Cache-Control')).not.toContain('public')
    expect(r1.headers.get('Cache-Control')).toContain('no-store')
    // WR-02：BYPASS 响应不得下发 X-Cache-TTL，避免监控面板误报
    expect(r1.headers.get('X-Cache-TTL')).toBeNull()

    const r2 = await cachedProxy(request, 'https://api.starye.org')
    expect(r2.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(calls).toBe(2) // 不写 KV → 每次都穿透
  })

  // D-11 #3: AUTH-07 — 带 Authorization → BYPASS + X-Cache-Reason
  it('D-11 #3: bypasses KV on /api/movies when request has Authorization header (BYPASS, X-Cache-Reason=auth-headers)', async () => {
    const { kv } = createMockKv()
    let calls = 0
    const cachedProxy = createCachedProxy(kv, async () => {
      calls += 1
      return Response.json({ calls })
    })
    const request = new Request('https://starye.org/api/movies', {
      headers: { authorization: 'Bearer xxx' },
    })

    const r1 = await cachedProxy(request, 'https://api.starye.org')
    expect(r1.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(r1.headers.get('X-Cache-Reason')).toBe('auth-headers')
    // CR-01：public 基线翻 bypass 时必须降级 Cache-Control，禁止泄漏 public 指令给共享缓存
    expect(r1.headers.get('Cache-Control')).not.toContain('public')
    expect(r1.headers.get('Cache-Control')).toContain('no-store')
    // WR-02：BYPASS 响应不得下发 X-Cache-TTL，避免监控面板误报
    expect(r1.headers.get('X-Cache-TTL')).toBeNull()

    // 二次调用：确保不走 KV 缓存（calls 必须递增）
    await cachedProxy(request, 'https://api.starye.org')
    expect(calls).toBe(2)
  })

  // D-11 #4: AUTH-06 — /api/auth/* 无论头都 BYPASS（NO_STORE_PREFIXES 独立命中）
  it('D-11 #4: bypasses /api/auth/get-session regardless of request headers', async () => {
    const { kv } = createMockKv()
    const cachedProxy = createCachedProxy(kv, async () =>
      Response.json({ session: null }))

    // 无 cookie — NO_STORE_PREFIXES 命中
    const noCookie = await cachedProxy(
      new Request('https://starye.org/api/auth/get-session'),
      'https://api.starye.org',
    )
    expect(noCookie.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(noCookie.headers.get('X-Cache-Reason')).toBe('no-store-path')
    // CR-01/NO_STORE 基线：no-store 必须原样下发，不得含 public
    expect(noCookie.headers.get('Cache-Control')).toBe('no-store')

    // 带 cookie — auth-headers 优先级高于 no-store-path
    const withCookie = await cachedProxy(
      new Request('https://starye.org/api/auth/get-session', {
        headers: { cookie: 'starye.session_token=xxx' },
      }),
      'https://api.starye.org',
    )
    expect(withCookie.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(withCookie.headers.get('X-Cache-Reason')).toBe('auth-headers')
    expect(withCookie.headers.get('Cache-Control')).not.toContain('public')
  })

  // D-11 #5: CR-02 — Set-Cookie 响应下发 private, no-store，不泄漏 public Cache-Control
  it('D-11 #5: Set-Cookie 响应下发 private, no-store 不下发 public Cache-Control', async () => {
    const { kv } = createMockKv()
    const cachedProxy = createCachedProxy(kv, async () =>
      new Response(JSON.stringify({ user: 'ok' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'starye.session_token=xxx; Path=/; HttpOnly',
        },
      }))
    const request = new Request('https://starye.org/api/movies')
    const r = await cachedProxy(request, 'https://api.starye.org')
    expect(r.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(r.headers.get('X-Cache-Reason')).toBe('set-cookie-response')
    expect(r.headers.get('Cache-Control')).not.toContain('public')
    expect(r.headers.get('Cache-Control')).toContain('no-store')
    expect(r.headers.get('X-Cache-TTL')).toBeNull()
  })
  /* eslint-enable test/prefer-lowercase-title */
})
