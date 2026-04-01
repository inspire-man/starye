/**
 * Actors Service 测试
 */

import type { Database } from '@starye/db'
import type { MockedFunction } from 'vitest'
import { describe, expect, it, vi } from 'vitest'
import { getActorBySlug, getActors } from '../../services/actor.service'

describe('actors Service', () => {
  describe('getActors', () => {
    it('应该返回演员列表和分页信息', async () => {
      const mockActors = [
        {
          id: '1',
          name: 'Test Actor 1',
          slug: 'test-actor-1',
          avatar: 'https://example.com/avatar1.jpg',
          nationality: 'JP',
          movieCount: 10,
          isActive: true,
          hasDetailsCrawled: true,
        },
        {
          id: '2',
          name: 'Test Actor 2',
          slug: 'test-actor-2',
          avatar: null,
          nationality: 'US',
          movieCount: 5,
          isActive: true,
          hasDetailsCrawled: false,
        },
      ]

      const mockDb = {
        query: {
          actors: {
            findMany: vi.fn().mockResolvedValue(mockActors),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((callback: (result: { value: number }[]) => unknown) => callback([{ value: 50 }])),
            }),
          }),
        }),
      } as unknown as Database

      const result = await getActors({
        db: mockDb,
        page: 1,
        pageSize: 20,
      })

      expect(result.data).toHaveLength(2)
      expect(result.meta.total).toBe(50)
      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(20)
      expect(result.meta.totalPages).toBe(3)
      expect(mockDb.query.actors.findMany).toHaveBeenCalled()
    })

    it('应该支持按国籍筛选', async () => {
      const mockDb = {
        query: {
          actors: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue([{ value: 0 }]),
            }),
          }),
        }),
      } as unknown as Database

      await getActors({
        db: mockDb,
        nationality: 'JP',
      })

      expect(mockDb.query.actors.findMany).toHaveBeenCalled()
      const callArgs = (mockDb.query.actors.findMany as MockedFunction<typeof mockDb.query.actors.findMany>).mock.calls[0]?.[0]
      expect(callArgs).toBeDefined()
      expect(callArgs?.where).toBeDefined()
    })

    it('应该支持按活跃状态筛选', async () => {
      const mockDb = {
        query: {
          actors: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue([{ value: 0 }]),
            }),
          }),
        }),
      } as unknown as Database

      await getActors({
        db: mockDb,
        isActive: true,
      })

      expect(mockDb.query.actors.findMany).toHaveBeenCalled()
    })

    it('应该支持不同的排序方式', async () => {
      const mockDb = {
        query: {
          actors: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue([{ value: 0 }]),
            }),
          }),
        }),
      } as unknown as Database

      await getActors({
        db: mockDb,
        sort: 'movieCount',
      })

      expect(mockDb.query.actors.findMany).toHaveBeenCalled()
      const callArgs = (mockDb.query.actors.findMany as MockedFunction<typeof mockDb.query.actors.findMany>).mock.calls[0]?.[0]
      expect(callArgs).toBeDefined()
      expect(callArgs?.orderBy).toBeDefined()
    })
  })

  describe('getActorBySlug', () => {
    it('应该返回演员详情和关联电影', async () => {
      const mockActor = {
        id: '1',
        name: 'Test Actor',
        slug: 'test-actor',
        avatar: 'https://example.com/avatar.jpg',
        nationality: 'JP',
        movieCount: 10,
        isActive: true,
        hasDetailsCrawled: true,
      }

      const mockRelatedMovies = [
        {
          id: 'm1',
          code: 'TEST-001',
          title: 'Test Movie 1',
          slug: 'test-movie-1',
          coverImage: 'cover1.jpg',
          releaseDate: new Date('2024-01-01'),
          duration: 120,
          sortOrder: 1,
        },
      ]

      const mockDb = {
        query: {
          actors: {
            findFirst: vi.fn().mockResolvedValue(mockActor),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockRelatedMovies),
                }),
              }),
            }),
          }),
        }),
      } as unknown as Database

      const result = await getActorBySlug({
        db: mockDb,
        slug: 'test-actor',
      })

      expect(result).toBeDefined()
      expect(result?.name).toBe('Test Actor')
      expect(result?.relatedMovies).toHaveLength(1)
      expect(result?.relatedMovies[0].code).toBe('TEST-001')
    })

    it('应该在演员不存在时返回 null', async () => {
      const mockDb = {
        query: {
          actors: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as unknown as Database

      const result = await getActorBySlug({
        db: mockDb,
        slug: 'non-existent',
      })

      expect(result).toBeNull()
    })
  })
})
