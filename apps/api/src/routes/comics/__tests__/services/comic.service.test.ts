/**
 * Comics Service 测试
 */

import type { Database } from '@starye/db'
import { describe, expect, it, vi } from 'vitest'
import { getComicBySlug, getComics } from '../../services/comic.service'

describe('comics Service', () => {
  describe('getComics', () => {
    it('应该返回漫画列表和分页信息', async () => {
      const mockComics = [
        {
          id: '1',
          title: 'Test Comic 1',
          slug: 'test-comic-1',
          coverImage: 'cover1.jpg',
          isR18: false,
          status: 'ongoing',
          chapterCount: 10,
        },
        {
          id: '2',
          title: 'Test Comic 2',
          slug: 'test-comic-2',
          coverImage: 'cover2.jpg',
          isR18: true,
          status: 'completed',
          chapterCount: 50,
        },
      ]

      const mockDb = {
        query: {
          comics: {
            findMany: vi.fn().mockResolvedValue(mockComics),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((callback: (result: { value: number }[]) => unknown) => callback([{ value: 100 }])),
            }),
          }),
        }),
      } as unknown as Database

      const result = await getComics({
        db: mockDb,
        isAdult: true,
        page: 1,
        pageSize: 20,
      })

      expect(result.data).toHaveLength(2)
      expect(result.meta.total).toBe(100)
      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(20)
      expect(result.meta.totalPages).toBe(5)
      expect(mockDb.query.comics.findMany).toHaveBeenCalled()
    })

    it('应该支持按 R18 筛选', async () => {
      const mockDb = {
        query: {
          comics: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((callback: (result: { value: number }[]) => unknown) => callback([{ value: 0 }])),
            }),
          }),
        }),
      } as unknown as Database

      await getComics({
        db: mockDb,
        isAdult: true,
        genre: 'action',
      })

      expect(mockDb.query.comics.findMany).toHaveBeenCalled()
    })
  })

  describe('getComicBySlug', () => {
    it('应该返回漫画详情', async () => {
      const mockComic = {
        id: '1',
        title: 'Test Comic',
        slug: 'test-comic',
        coverImage: 'cover.jpg',
        isR18: false,
        status: 'ongoing',
        description: 'Test description',
        chapterCount: 10,
      }

      const mockDb = {
        query: {
          comics: {
            findFirst: vi.fn().mockResolvedValue(mockComic),
          },
        },
      } as unknown as Database

      const result = await getComicBySlug({
        db: mockDb,
        slug: 'test-comic',
        isAdult: true,
      })

      expect(result).toBeDefined()
      expect(result?.title).toBe('Test Comic')
      expect(mockDb.query.comics.findFirst).toHaveBeenCalled()
    })

    it('应该在漫画不存在时返回 null', async () => {
      const mockDb = {
        query: {
          comics: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as unknown as Database

      const result = await getComicBySlug({
        db: mockDb,
        slug: 'non-existent',
        isAdult: true,
      })

      expect(result).toBeNull()
    })
  })
})
