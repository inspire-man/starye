import { describe, expect, it, vi } from 'vitest'
import {
  clearGatewayCacheGroup,
  clearGatewayCacheGroups,
  countGatewayCacheGroup,
  getGatewayCacheStats,
} from '../gateway-cache'

function createMockKv(initialKeys: string[] = []) {
  const store = new Map(initialKeys.map(key => [key, key]))
  const pageSize = 2

  const kv = {
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    list: vi.fn(async ({ prefix, cursor }: { prefix?: string, cursor?: string } = {}) => {
      const filtered = [...store.keys()].filter(key => !prefix || key.startsWith(prefix))
      const offset = cursor ? Number(cursor) : 0
      const keys = filtered
        .slice(offset, offset + pageSize)
        .map(name => ({
          name,
          expiration: null,
          metadata: null,
        }))
      const nextOffset = offset + keys.length

      return {
        keys,
        list_complete: nextOffset >= filtered.length,
        cursor: nextOffset >= filtered.length ? '' : `${nextOffset}`,
      }
    }),
  } as unknown as KVNamespace

  return {
    kv,
    store,
  }
}

describe('gateway-cache helper', () => {
  it('counts cache entries for a target group across paginated KV results', async () => {
    const { kv } = createMockKv([
      'gateway-cache:v2:movies:public:%2Fapi%2Fmovies%3Fpage%3D1',
      'gateway-cache:v2:movies:public:%2Fapi%2Fmovies%3Fpage%3D2',
      'gateway-cache:v2:movies:public:%2Fapi%2Fpublic%2Fmovies',
      'gateway-cache:v2:favorites:private:a:%2Fapi%2Ffavorites',
    ])

    await expect(countGatewayCacheGroup(kv, 'movies')).resolves.toBe(3)
    expect((kv.list as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1)
  })

  it('clears only the requested cache group', async () => {
    const { kv, store } = createMockKv([
      'gateway-cache:v2:movies:public:%2Fapi%2Fmovies',
      'gateway-cache:v2:movies:public:%2Fapi%2Fpublic%2Fmovies',
      'gateway-cache:v2:favorites:private:a:%2Fapi%2Ffavorites',
    ])

    await expect(clearGatewayCacheGroup(kv, 'movies')).resolves.toBe(2)
    expect([...store.keys()]).toEqual(['gateway-cache:v2:favorites:private:a:%2Fapi%2Ffavorites'])
  })

  it('deduplicates group deletion requests', async () => {
    const { kv, store } = createMockKv([
      'gateway-cache:v2:movies:public:%2Fapi%2Fmovies',
      'gateway-cache:v2:favorites:private:a:%2Fapi%2Ffavorites',
      'gateway-cache:v2:favorites:private:b:%2Fapi%2Ffavorites',
    ])

    const result = await clearGatewayCacheGroups(kv, ['favorites', 'favorites', 'movies'])

    expect(result).toEqual({
      favorites: 2,
      movies: 1,
    })
    expect(store.size).toBe(0)
  })

  it('returns stable stats payload and handles missing KV bindings', async () => {
    const { kv } = createMockKv([
      'gateway-cache:v2:movies:public:%2Fapi%2Fmovies',
      'gateway-cache:v2:favorites:private:a:%2Fapi%2Ffavorites',
    ])

    await expect(getGatewayCacheStats(kv)).resolves.toEqual({
      groups: {
        favorites: 1,
        movies: 1,
      },
      headers: ['X-Cache-Status', 'X-Cache-Group', 'X-Cache-Policy', 'X-Cache-TTL', 'Age'],
      prefix: 'gateway-cache:v2',
    })

    await expect(clearGatewayCacheGroup(undefined, 'movies')).resolves.toBe(0)
    await expect(countGatewayCacheGroup(undefined, 'favorites')).resolves.toBe(0)
  })
})
