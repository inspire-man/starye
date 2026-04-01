/**
 * Publishers Service 测试
 */

import type { Database } from '@starye/db'
import type { MockedFunction } from 'vitest'
import { describe, expect, it, vi } from 'vitest'
import { getPublisherBySlug, getPublishers } from '../../services/publisher.service'

describe('publishers Service', () => {
  describe('getPublishers', () => {
    it('应该返回出版商列表和分页信息', async () => {
      const mockPublishers = [
        {
          id: '1',
          name: 'Test Publisher 1',
          slug: 'test-publisher-1',
          logo: 'https://example.com/logo1.jpg',
          country: 'JP',
          movieCount: 100,
          hasDetailsCrawled: true,
        },
        {
          id: '2',
          name: 'Test Publisher 2',
          slug: 'test-publisher-2',
          logo: null,
          country: 'US',
          movieCount: 50,
          hasDetailsCrawled: false,
        },
      ]

      const mockDb = {
        query: {
          publishers: {
            findMany: vi.fn().mockResolvedValue(mockPublishers),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((callback: (result: { value: number }[]) => unknown) => callback([{ value: 30 }])),
            }),
          }),
        }),
      } as unknown as Database

      const result = await getPublishers({
        db: mockDb,
        page: 1,
        pageSize: 20,
      })

      expect(result.data).toHaveLength(2)
      expect(result.meta.total).toBe(30)
      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(20)
      expect(result.meta.totalPages).toBe(2)
      expect(mockDb.query.publishers.findMany).toHaveBeenCalled()
    })

    it('应该支持按国家筛选', async () => {
      const mockDb = {
        query: {
          publishers: {
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

      await getPublishers({
        db: mockDb,
        country: 'JP',
      })

      expect(mockDb.query.publishers.findMany).toHaveBeenCalled()
      const callArgs = (mockDb.query.publishers.findMany as MockedFunction<typeof mockDb.query.publishers.findMany>).mock.calls[0]?.[0]
      expect(callArgs).toBeDefined()
      expect(callArgs?.where).toBeDefined()
    })

    it('应该支持不同的排序方式', async () => {
      const mockDb = {
        query: {
          publishers: {
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

      await getPublishers({
        db: mockDb,
        sort: 'movieCount',
      })

      expect(mockDb.query.publishers.findMany).toHaveBeenCalled()
      const callArgs = (mockDb.query.publishers.findMany as MockedFunction<typeof mockDb.query.publishers.findMany>).mock.calls[0]?.[0]
      expect(callArgs).toBeDefined()
      expect(callArgs?.orderBy).toBeDefined()
    })
  })

  describe('getPublisherBySlug', () => {
    it('应该返回出版商详情和关联电影', async () => {
      const mockPublisher = {
        id: '1',
        name: 'Test Publisher',
        slug: 'test-publisher',
        logo: 'https://example.com/logo.jpg',
        country: 'JP',
        movieCount: 100,
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
          publishers: {
            findFirst: vi.fn().mockResolvedValue(mockPublisher),
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

      const result = await getPublisherBySlug({
        db: mockDb,
        slug: 'test-publisher',
      })

      expect(result).toBeDefined()
      expect(result?.name).toBe('Test Publisher')
      expect(result?.relatedMovies).toHaveLength(1)
      expect(result?.relatedMovies[0].code).toBe('TEST-001')
    })

    it('应该在出版商不存在时返回 null', async () => {
      const mockDb = {
        query: {
          publishers: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as unknown as Database

      const result = await getPublisherBySlug({
        db: mockDb,
        slug: 'non-existent',
      })

      expect(result).toBeNull()
    })
  })
})
