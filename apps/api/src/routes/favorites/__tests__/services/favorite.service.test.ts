/**
 * Favorites Service 测试 — 覆盖 movie-client-polish 变更
 */

import type { Database } from '@starye/db'
import { describe, expect, it, vi } from 'vitest'
import { checkFavorite, getFavorites } from '../../services/favorite.service'

describe('favorites Service', () => {
  describe('getFavorites — entity 信息填充', () => {
    it('应该为 movie 类型的收藏返回 entity 信息', async () => {
      const mockFavorites = [
        { id: 'fav_1', userId: 'u1', entityType: 'movie', entityId: 'mv_1', createdAt: new Date('2026-01-01') },
      ]

      const mockDb = {
        query: {
          userFavorites: {
            findMany: vi.fn().mockResolvedValue(mockFavorites),
          },
        },
        select: vi.fn().mockImplementation((fields: Record<string, unknown>) => {
          // 判断是 count 查询还是 entity 查询
          if ('value' in fields) {
            // count 查询
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  then: vi.fn().mockImplementation((cb: (r: { value: number }[]) => unknown) => cb([{ value: 1 }])),
                }),
              }),
            }
          }
          // entity 查询（movies 表）
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: 'mv_1', title: 'Test Movie', coverImage: 'https://cdn.test/cover.jpg', code: 'ABC-001' },
              ]),
            }),
          }
        }),
      } as unknown as Database

      const result = await getFavorites({ db: mockDb, userId: 'u1' })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].entity).toBeDefined()
      expect(result.data[0].entity).toEqual({
        name: 'Test Movie',
        cover: 'https://cdn.test/cover.jpg',
        slug: 'ABC-001',
      })
    })

    it('entity 不存在时返回 null', async () => {
      const mockFavorites = [
        { id: 'fav_2', userId: 'u1', entityType: 'movie', entityId: 'mv_deleted', createdAt: new Date('2026-01-01') },
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
                  then: vi.fn().mockImplementation((cb: (r: { value: number }[]) => unknown) => cb([{ value: 1 }])),
                }),
              }),
            }
          }
          // entity 查询返回空
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }
        }),
      } as unknown as Database

      const result = await getFavorites({ db: mockDb, userId: 'u1' })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].entity).toBeNull()
    })

    it('应该为 actor 类型的收藏返回正确的 entity', async () => {
      const mockFavorites = [
        { id: 'fav_3', userId: 'u1', entityType: 'actor', entityId: 'act_1', createdAt: new Date('2026-02-01') },
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
                  then: vi.fn().mockImplementation((cb: (r: { value: number }[]) => unknown) => cb([{ value: 1 }])),
                }),
              }),
            }
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: 'act_1', name: 'Test Actor', avatar: 'https://cdn.test/actor.jpg', slug: 'test-actor' },
              ]),
            }),
          }
        }),
      } as unknown as Database

      const result = await getFavorites({ db: mockDb, userId: 'u1' })

      expect(result.data[0].entity).toEqual({
        name: 'Test Actor',
        cover: 'https://cdn.test/actor.jpg',
        slug: 'test-actor',
      })
    })

    it('空收藏列表返回空数组', async () => {
      const mockDb = {
        query: {
          userFavorites: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((cb: (r: { value: number }[]) => unknown) => cb([{ value: 0 }])),
            }),
          }),
        }),
      } as unknown as Database

      const result = await getFavorites({ db: mockDb, userId: 'u1' })

      expect(result.data).toHaveLength(0)
      expect(result.meta.total).toBe(0)
    })
  })

  describe('checkFavorite — 返回 favoriteId', () => {
    it('已收藏时应返回 isFavorited: true 和 favoriteId', async () => {
      const mockDb = {
        query: {
          userFavorites: {
            findFirst: vi.fn().mockResolvedValue({ id: 'fav_100', userId: 'u1', entityType: 'movie', entityId: 'mv_1' }),
          },
        },
      } as unknown as Database

      const result = await checkFavorite({
        db: mockDb,
        userId: 'u1',
        entityType: 'movie',
        entityId: 'mv_1',
      })

      expect(result.isFavorited).toBe(true)
      expect(result.favoriteId).toBe('fav_100')
    })

    it('未收藏时应返回 isFavorited: false 和 favoriteId: null', async () => {
      const mockDb = {
        query: {
          userFavorites: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as unknown as Database

      const result = await checkFavorite({
        db: mockDb,
        userId: 'u1',
        entityType: 'movie',
        entityId: 'mv_999',
      })

      expect(result.isFavorited).toBe(false)
      expect(result.favoriteId).toBeNull()
    })
  })
})
