/**
 * api-client 单测
 * 覆盖 genreApi.getGenres()、progressApi.getWatchingHistory()、movieApi.trackView()
 */

import { readFileSync } from 'node:fs'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { genreApi, movieApi, progressApi } from '../api-client'

// ─── fetch Mock ───────────────────────────────────────────────────────────────

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

function mockFetchError(status = 500, message = 'Server error') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
  })
}

// ─── 测试 ─────────────────────────────────────────────────────────────────────

describe('genreApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchOk({ success: true, data: [] }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getGenres', () => {
    it('应请求 /api/public/movies/genres', async () => {
      const fetchMock = mockFetchOk({
        success: true,
        data: [{ genre: '剧情', count: 100 }],
      })
      vi.stubGlobal('fetch', fetchMock)

      await genreApi.getGenres()

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/public/movies/genres')
    })

    it('应返回 genre 数组', async () => {
      const mockData = [
        { genre: '剧情', count: 120 },
        { genre: '动作', count: 85 },
      ]
      vi.stubGlobal('fetch', mockFetchOk({ success: true, data: mockData }))

      const result = await genreApi.getGenres()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData)
    })

    it('服务器错误时应抛出异常', async () => {
      vi.stubGlobal('fetch', mockFetchError(500))

      await expect(genreApi.getGenres()).rejects.toThrow()
    })
  })
})

describe('progressApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getWatchingHistory', () => {
    it('应请求 /api/public/progress/watching?limit=N', async () => {
      const fetchMock = mockFetchOk({ success: true, data: [] })
      vi.stubGlobal('fetch', fetchMock)

      await progressApi.getWatchingHistory(20)

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/public/progress/watching?limit=20')
    })

    it('默认 limit 为 20', async () => {
      const fetchMock = mockFetchOk({ success: true, data: [] })
      vi.stubGlobal('fetch', fetchMock)

      await progressApi.getWatchingHistory()

      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain('limit=20')
    })

    it('limit 超过 50 时应被限制为 50', async () => {
      const fetchMock = mockFetchOk({ success: true, data: [] })
      vi.stubGlobal('fetch', fetchMock)

      await progressApi.getWatchingHistory(100)

      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain('limit=50')
    })

    it('应返回含影片详情的历史条目', async () => {
      const mockHistory = [
        {
          id: 'p1',
          contentType: 'movie',
          contentId: 'TEST-001',
          movieCode: 'TEST-001',
          title: '测试影片',
          coverImage: null,
          isR18: false,
          position: 600,
          progress: 600,
          duration: 5400,
          completed: false,
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ]
      vi.stubGlobal('fetch', mockFetchOk({ success: true, data: mockHistory }))

      const result = await progressApi.getWatchingHistory()

      expect(result.success).toBe(true)
      expect(result.data?.[0]).toMatchObject({
        movieCode: 'TEST-001',
        contentType: 'movie',
        contentId: 'TEST-001',
        title: '测试影片',
        progress: 600,
        completed: false,
      })
    })
  })
})

describe('movieApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the typed public movie detail RPC without a broad double cast', () => {
    const source = readFileSync(`${process.cwd()}/src/lib/api-client.ts`, 'utf8')
    const getMovieDetail = source.slice(source.indexOf('async getMovieDetail'), source.indexOf('async submitVideoAvailabilityCommand'))
    expect(getMovieDetail).toContain('client.api.public.movies[\':code\'].$get')
    expect(getMovieDetail).not.toContain('as unknown as MovieDetail')
    expect(getMovieDetail).not.toContain('/admin/crawler-tasks')
  })

  it('submits the minimal video availability command and returns the server binding', async () => {
    const fetchMock = mockFetchOk({
      binding: { movieId: 'movie-1', movieRevision: 4, policyVersion: 'video-source-probe/v1', sourceRevision: 9 },
      kind: 'created',
      run: { attemptNumber: 1, id: 'run-1', status: 'queued', taskId: 'task-1' },
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await movieApi.submitVideoAvailabilityCommand({
      idempotencyKey: 'movie-detail:video-availability:movie-1:9:stale',
      movieId: 'movie-1',
      reason: 'stale',
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/crawler-tasks/video-availability')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      idempotencyKey: 'movie-detail:video-availability:movie-1:9:stale',
      movieId: 'movie-1',
      reason: 'stale',
    })
    expect(result.binding).toEqual({ movieId: 'movie-1', movieRevision: 4, policyVersion: 'video-source-probe/v1', sourceRevision: 9 })
  })

  describe('trackView', () => {
    it('应请求 POST /api/public/movies/:code/view', async () => {
      const fetchMock = mockFetchOk({ success: true, data: null })
      vi.stubGlobal('fetch', fetchMock)

      movieApi.trackView('TEST-001')

      // 等待微任务队列（fire-and-forget）
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/public/movies/TEST-001/view')
      expect(init?.method).toBe('POST')
    })

    it('请求失败时应静默忽略（不抛出）', async () => {
      vi.stubGlobal('fetch', mockFetchError(500))

      // trackView 不应抛出异常
      expect(() => movieApi.trackView('TEST-001')).not.toThrow()

      // 等待 Promise 链完成，确认无 unhandled rejection
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('网络错误时应静默忽略', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      expect(() => movieApi.trackView('TEST-001')).not.toThrow()
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('code 应经过 encodeURIComponent 编码', async () => {
      const fetchMock = mockFetchOk({ success: true, data: null })
      vi.stubGlobal('fetch', fetchMock)

      movieApi.trackView('TEST 001')
      await new Promise(resolve => setTimeout(resolve, 0))

      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/public/movies/TEST%20001/view')
    })
  })
})
