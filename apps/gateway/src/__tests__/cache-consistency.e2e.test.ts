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

  // D-12：原 "clears all user-scoped favorites caches" 用例已删除。
  // 原测试依赖 private scope + userScope hash 切片，D-07 之后带 cookie 请求一律 bypass，
  // favorites scope 永远走不到；该测试的前提条件已被消除。
})
