/**
 * Favorites API E2E 测试 — 验证 movie-client-polish 变更
 * 通过 Hono app 实例直接发请求，不需要外部服务器
 */

import type { Database } from '@starye/db'
import type { Context } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { checkFavoriteHandler, getFavoriteList } from '../../handlers/favorite.handler'

function createMockContext(overrides: {
  db: Database
  user?: { id: string, isR18Verified?: boolean } | null
  query?: Record<string, string>
  params?: Record<string, string>
}): Context<any> {
  const { db, user = null, query = {}, params = {} } = overrides

  return {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'db')
        return db
      if (key === 'user')
        return user
      return undefined
    }),
    req: {
      query: vi.fn().mockImplementation((key: string) => query[key]),
      param: vi.fn().mockImplementation((key: string) => params[key]),
    },
    json: vi.fn().mockImplementation((body: unknown, _status?: number) => body),
  } as unknown as Context<any>
}

describe('favorites API E2E', () => {
  describe('gET /favorites — 收藏列表返回 entity', () => {
    it('未认证时应返回 401', async () => {
      const mockDb = {} as Database
      const c = createMockContext({ db: mockDb, user: null })

      await expect(getFavoriteList(c)).rejects.toThrow()
    })

    it('认证后应返回包含 entity 的收藏列表', async () => {
      const mockFavorites = [
        { id: 'fav_1', userId: 'u1', entityType: 'movie', entityId: 'mv_1', createdAt: new Date('2026-01-15') },
        { id: 'fav_2', userId: 'u1', entityType: 'actor', entityId: 'act_1', createdAt: new Date('2026-02-01') },
      ]

      const mockDb = {
        query: {
          userFavorites: {
            findMany: vi.fn().mockResolvedValue(mockFavorites),
          },
        },
        select: vi.fn().mockImplementation((fields: Record<string, unknown>) => {
          if ('value' in fields) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  then: vi.fn().mockImplementation((cb: (r: { value: number }[]) => unknown) => cb([{ value: 2 }])),
                }),
              }),
            }
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockImplementation(() => {
                return Promise.resolve([
                  { id: 'mv_1', title: 'Movie 1', coverImage: 'https://cdn.test/mv.jpg', code: 'ABC-001', name: 'Actor 1', avatar: 'https://cdn.test/act.jpg', slug: 'actor-1' },
                ])
              }),
            }),
          }
        }),
      } as unknown as Database

      const c = createMockContext({ db: mockDb, user: { id: 'u1' } })
      await getFavoriteList(c)

      expect(c.json).toHaveBeenCalled()
      const response = (c.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(response.success).toBe(true)
      expect(response.data).toBeDefined()
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.length).toBe(2)

      // 每条记录都有 entity 字段
      for (const item of response.data) {
        expect(item).toHaveProperty('entity')
        expect(item).toHaveProperty('entityType')
        expect(item).toHaveProperty('entityId')
        expect(item).toHaveProperty('createdAt')
      }
    })
  })

  describe('gET /favorites/check/:entityType/:entityId — 返回 favoriteId', () => {
    it('未认证时应抛出异常', async () => {
      const mockDb = {} as Database
      const c = createMockContext({ db: mockDb, user: null, params: { entityType: 'movie', entityId: 'mv_1' } })

      await expect(checkFavoriteHandler(c)).rejects.toThrow()
    })

    it('已收藏时应返回 isFavorited: true 和 favoriteId', async () => {
      const mockDb = {
        query: {
          userFavorites: {
            findFirst: vi.fn().mockResolvedValue({ id: 'fav_42', userId: 'u1', entityType: 'movie', entityId: 'mv_1' }),
          },
        },
      } as unknown as Database

      const c = createMockContext({
        db: mockDb,
        user: { id: 'u1' },
        params: { entityType: 'movie', entityId: 'mv_1' },
      })

      await checkFavoriteHandler(c)

      const response = (c.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(response.success).toBe(true)
      expect(response.data.isFavorited).toBe(true)
      expect(response.data.favoriteId).toBe('fav_42')
    })

    it('未收藏时应返回 isFavorited: false 和 favoriteId: null', async () => {
      const mockDb = {
        query: {
          userFavorites: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as unknown as Database

      const c = createMockContext({
        db: mockDb,
        user: { id: 'u1' },
        params: { entityType: 'movie', entityId: 'mv_999' },
      })

      await checkFavoriteHandler(c)

      const response = (c.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(response.success).toBe(true)
      expect(response.data.isFavorited).toBe(false)
      expect(response.data.favoriteId).toBeNull()
    })
  })
})
