import type { JavBusCrawlerConfig } from '../javbus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JavBusCrawler } from '../javbus'

globalThis.fetch = vi.fn()

describe('optimized-crawler E2E', () => {
  let config: JavBusCrawlerConfig

  beforeEach(() => {
    vi.clearAllMocks()
    config = {
      r2: {
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        bucketName: 'test-bucket',
        publicUrl: 'https://test.com',
      },
      api: {
        url: 'http://localhost:3000',
        token: 'test-token',
      },
      puppeteer: {
        executablePath: '/usr/bin/chrome',
      },
      limits: {
        maxMovies: 10,
        maxPages: 1,
      },
      concurrency: {
        listPage: 1,
        detailPage: 1,
        image: 1,
        api: 1,
      },
      delay: {
        listPage: 0,
        detailPage: 0,
        image: 0,
        api: 0,
      },
      options: {
        showProgress: false,
        showStats: false,
        statsInterval: 10000,
      },
    }
  })

  describe('批量查询增量逻辑', () => {
    it('应该过滤已存在内容', async () => {
      // Mock 批量状态查询 API 返回部分已存在
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.toString() : url.url)

        if (urlStr.includes('/api/admin/movies/batch-status')) {
          return {
            ok: true,
            json: async () => ({
              'ABC-001': { exists: true, code: 'ABC-001' },
              'ABC-002': { exists: false, code: 'ABC-002' },
              'ABC-003': { exists: true, code: 'ABC-003' },
            }),
          } as Response
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response
      })

      // 验证：批量查询被调用，且过滤逻辑正确
      // 注意：实际测试需要 mock Puppeteer 页面和爬取逻辑
      // 这里仅测试 ApiClient 的批量查询功能

      const crawler = new JavBusCrawler(config)
      const apiClient = (crawler as any).apiClient

      const statusMap = await apiClient.batchQueryMovieStatus(['ABC-001', 'ABC-002', 'ABC-003'])

      expect(statusMap['ABC-001'].exists).toBe(true)
      expect(statusMap['ABC-002'].exists).toBe(false)
      expect(statusMap['ABC-003'].exists).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/movies/batch-status?codes=ABC-001,ABC-002,ABC-003'),
        expect.any(Object),
      )
    })

    it('应该处理全部已存在的情况', async () => {
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.toString() : url.url)

        if (urlStr.includes('/api/admin/movies/batch-status')) {
          return {
            ok: true,
            json: async () => ({
              'ABC-001': { exists: true, code: 'ABC-001' },
              'ABC-002': { exists: true, code: 'ABC-002' },
            }),
          } as Response
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response
      })

      const crawler = new JavBusCrawler(config)
      const apiClient = (crawler as any).apiClient

      const statusMap = await apiClient.batchQueryMovieStatus(['ABC-001', 'ABC-002'])

      expect(statusMap['ABC-001'].exists).toBe(true)
      expect(statusMap['ABC-002'].exists).toBe(true)
      expect(Object.values(statusMap).every((s: any) => s.exists)).toBe(true)
    })

    it('应该处理无已存在内容的情况', async () => {
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.toString() : url.url)

        if (urlStr.includes('/api/admin/movies/batch-status')) {
          return {
            ok: true,
            json: async () => ({
              'ABC-001': { exists: false, code: 'ABC-001' },
              'ABC-002': { exists: false, code: 'ABC-002' },
            }),
          } as Response
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response
      })

      const crawler = new JavBusCrawler(config)
      const apiClient = (crawler as any).apiClient

      const statusMap = await apiClient.batchQueryMovieStatus(['ABC-001', 'ABC-002'])

      expect(statusMap['ABC-001'].exists).toBe(false)
      expect(statusMap['ABC-002'].exists).toBe(false)
      expect(Object.values(statusMap).every((s: any) => !s.exists)).toBe(true)
    })
  })

  describe('批量查询 API 错误处理', () => {
    it('应该处理 401 未授权错误并回退到全量爬取', async () => {
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.toString() : url.url)

        if (urlStr.includes('/api/admin/movies/batch-status')) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
          } as Response
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response
      })

      const crawler = new JavBusCrawler(config)
      const apiClient = (crawler as any).apiClient

      // 批量查询失败时应返回空对象，表示所有影片都需要爬取
      const statusMap = await apiClient.batchQueryMovieStatus(['ABC-001', 'ABC-002'])

      expect(statusMap).toEqual({})
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/movies/batch-status'),
        expect.any(Object),
      )
    })

    it('应该处理网络超时错误并回退到全量爬取', async () => {
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockRejectedValue(new Error('Network timeout'))

      const crawler = new JavBusCrawler(config)
      const apiClient = (crawler as any).apiClient

      const statusMap = await apiClient.batchQueryMovieStatus(['ABC-001', 'ABC-002'])

      expect(statusMap).toEqual({})
    })

    it('应该处理网络错误并回退到全量爬取', async () => {
      const mockFetch = vi.mocked(globalThis.fetch)
      mockFetch.mockRejectedValue(new Error('fetch failed'))

      const crawler = new JavBusCrawler(config)
      const apiClient = (crawler as any).apiClient

      const statusMap = await apiClient.batchQueryMovieStatus(['ABC-001', 'ABC-002'])

      expect(statusMap).toEqual({})
    })
  })
})
