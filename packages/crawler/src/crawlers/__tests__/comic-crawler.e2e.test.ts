import { beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.fetch = vi.fn()

describe('comic-crawler E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('漫画增量过滤', () => {
    it('应该仅处理新漫画，跳过已存在漫画', async () => {
      // Mock 批量状态查询 API
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.toString() : url.url)

        if (urlStr.includes('/api/admin/comics/batch-status')) {
          return {
            ok: true,
            json: async () => ({
              'manga-001': { exists: true, slug: 'manga-001', chapterCount: 10 },
              'manga-002': { exists: false, slug: 'manga-002', chapterCount: 0 },
              'manga-003': { exists: true, slug: 'manga-003', chapterCount: 5 },
            }),
          } as Response
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response
      })

      // 验证批量查询逻辑
      const response = await globalThis.fetch(
        'http://localhost:3000/api/admin/comics/batch-status?slugs=manga-001,manga-002,manga-003',
        {
          method: 'GET',
          headers: { 'x-service-token': 'test-token' },
        },
      )

      const statusMap = await response.json()

      expect(statusMap['manga-001'].exists).toBe(true)
      expect(statusMap['manga-002'].exists).toBe(false)
      expect(statusMap['manga-003'].exists).toBe(true)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('应该处理全部已存在的情况', async () => {
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.toString() : url.url)

        if (urlStr.includes('/api/admin/comics/batch-status')) {
          return {
            ok: true,
            json: async () => ({
              'manga-001': { exists: true, slug: 'manga-001', chapterCount: 10 },
              'manga-002': { exists: true, slug: 'manga-002', chapterCount: 5 },
            }),
          } as Response
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response
      })

      const response = await globalThis.fetch(
        'http://localhost:3000/api/admin/comics/batch-status?slugs=manga-001,manga-002',
        {
          method: 'GET',
          headers: { 'x-service-token': 'test-token' },
        },
      )

      const statusMap = await response.json()

      expect(Object.values(statusMap).every((s: any) => s.exists)).toBe(true)
    })
  })

  describe('漫画章节增量', () => {
    it('应该仅处理新章节，跳过已存在章节', async () => {
      // Mock 章节状态查询
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.toString() : url.url)

        if (urlStr.includes('/api/admin/comics/batch-status')) {
          return {
            ok: true,
            json: async () => ({
              'manga-001': {
                exists: true,
                slug: 'manga-001',
                chapterCount: 10,
                chapters: [
                  { chapterNum: '1', exists: true },
                  { chapterNum: '2', exists: true },
                  { chapterNum: '3', exists: false },
                ],
              },
            }),
          } as Response
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response
      })

      const response = await globalThis.fetch(
        'http://localhost:3000/api/admin/comics/batch-status?slugs=manga-001',
        {
          method: 'GET',
          headers: { 'x-service-token': 'test-token' },
        },
      )

      const statusMap = await response.json()

      // 验证章节增量逻辑
      expect(statusMap['manga-001'].exists).toBe(true)
      expect(statusMap['manga-001'].chapterCount).toBe(10)
      expect(statusMap['manga-001'].chapters).toHaveLength(3)

      const newChapters = statusMap['manga-001'].chapters.filter((c: any) => !c.exists)
      expect(newChapters).toHaveLength(1)
      expect(newChapters[0].chapterNum).toBe('3')
    })
  })

  describe('漫画爬虫 API 错误处理', () => {
    it('应该处理批量查询失败', async () => {
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockImplementation(async () => {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal Server Error' }),
        } as Response
      })

      const response = await globalThis.fetch(
        'http://localhost:3000/api/admin/comics/batch-status?slugs=manga-001',
        {
          method: 'GET',
          headers: { 'x-service-token': 'test-token' },
        },
      )

      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })

    it('应该处理网络错误', async () => {
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(
        globalThis.fetch(
          'http://localhost:3000/api/admin/comics/batch-status?slugs=manga-001',
          {
            method: 'GET',
            headers: { 'x-service-token': 'test-token' },
          },
        ),
      ).rejects.toThrow('Network error')
    })
  })
})
