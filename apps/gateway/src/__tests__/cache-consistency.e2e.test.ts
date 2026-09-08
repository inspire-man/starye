import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearGatewayCacheGroup } from '../../../api/src/lib/gateway-cache'
import { createCachedProxy } from '../cache-middleware'
import { defaultApiOrigin, defaultGatewayRequest } from './default-target.fixture'

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

  it('ignores old movie cache entries and serves current permissions before cache cleanup', async () => {
    const { kv, store } = createMockKv()
    store.set('gateway-cache:v2:movies:public:%2Fapi%2Fmovies%3Fpage%3D1', JSON.stringify({
      response: JSON.stringify({ coverImage: 'https://cdn.example/restricted.webp' }),
      headers: { 'content-type': 'application/json' },
      status: 200,
      statusText: 'OK',
      timestamp: Date.now(),
      ttl: 300,
      group: 'movies',
      scope: 'public',
    }))
    let upstreamVersion = 1

    const cachedProxy = createCachedProxy(kv, async () => {
      return Response.json({
        version: upstreamVersion,
      })
    })

    const request = defaultGatewayRequest('/api/movies?page=1')

    const firstResponse = await cachedProxy(request, defaultApiOrigin)
    expect(firstResponse.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(await firstResponse.json()).toEqual({ version: 1 })
    expect(store.size).toBe(1)

    upstreamVersion = 2

    const staleResponse = await cachedProxy(request, defaultApiOrigin)
    expect(staleResponse.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(await staleResponse.json()).toEqual({ version: 2 })
    expect(kv.get).not.toHaveBeenCalled()
    expect(kv.put).not.toHaveBeenCalled()

    await expect(clearGatewayCacheGroup(kv, 'movies')).resolves.toBe(1)
    expect(store.size).toBe(0)

    const freshResponse = await cachedProxy(request, defaultApiOrigin)
    expect(freshResponse.headers.get('X-Cache-Status')).toBe('BYPASS')
    expect(await freshResponse.json()).toEqual({ version: 2 })
  })

  // D-12：原 "clears all user-scoped favorites caches" 用例已删除。
  // 原测试依赖 private scope + userScope hash 切片，D-07 之后带 cookie 请求一律 bypass，
  // favorites scope 永远走不到；该测试的前提条件已被消除。
})
