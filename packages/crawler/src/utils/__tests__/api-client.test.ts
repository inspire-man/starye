import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api-client'

// Mock fetch
globalThis.fetch = vi.fn()

describe('apiClient', () => {
  let apiClient: ApiClient

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient = new ApiClient({
      url: 'http://test-api.com',
      token: 'test-token',
      timeout: 5000,
    })
  })

  describe('batchQueryMovieStatus', () => {
    it('should return empty object for empty codes', async () => {
      const result = await apiClient.batchQueryMovieStatus([])
      expect(result).toEqual({})
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should make correct API request', async () => {
      const mockResponse = {
        'ABC-123': { exists: true, code: 'ABC-123' },
        'XYZ-456': { exists: false, code: 'XYZ-456' },
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await apiClient.batchQueryMovieStatus(['ABC-123', 'XYZ-456'])

      expect(fetch).toHaveBeenCalledWith(
        'http://test-api.com/api/admin/movies/batch-status?codes=ABC-123,XYZ-456',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'x-service-token': 'test-token',
          },
        }),
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle 401 error gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await apiClient.batchQueryMovieStatus(['ABC-123'])

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  批量状态查询失败 401')
      expect(result).toEqual({})

      consoleSpy.mockRestore()
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await apiClient.batchQueryMovieStatus(['ABC-123'])

      expect(consoleSpy).toHaveBeenCalled()
      expect(result).toEqual({})

      consoleSpy.mockRestore()
    })

    it('should handle timeout', async () => {
      const timeoutError = new Error('timeout')
      timeoutError.name = 'AbortError'
      vi.mocked(fetch).mockRejectedValueOnce(timeoutError)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await apiClient.batchQueryMovieStatus(['ABC-123'])

      expect(result).toEqual({})
      consoleSpy.mockRestore()
    })
  })

  describe('syncMovie', () => {
    it('should make correct sync request', async () => {
      const movieData = {
        code: 'ABC-123',
        title: 'Test Movie',
        slug: 'test-movie',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await apiClient.syncMovie(movieData)

      expect(fetch).toHaveBeenCalledWith(
        'http://test-api.com/api/movies/sync',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/json',
            'x-service-token': 'test-token',
          },
          body: JSON.stringify({
            movies: [movieData],
            mode: 'upsert',
          }),
        }),
      )
    })
  })
})
