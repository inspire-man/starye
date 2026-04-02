/**
 * useFavorites composable 单元测试 — 验证 checkIsFavorited 返回 favoriteId
 */

import { describe, expect, it, vi } from 'vitest'

import { favoritesApi } from '../../api'
import { useFavorites } from '../useFavorites'

// Mock favoritesApi
vi.mock('../../api', () => ({
  favoritesApi: {
    checkFavorite: vi.fn(),
    getFavorites: vi.fn(),
    addFavorite: vi.fn(),
    deleteFavorite: vi.fn(),
  },
}))

describe('useFavorites', () => {
  describe('checkIsFavorited', () => {
    it('已收藏时应返回 { isFavorited: true, favoriteId }', async () => {
      vi.mocked(favoritesApi.checkFavorite).mockResolvedValue({
        isFavorited: true,
        favoriteId: 'fav_123',
      })

      const { checkIsFavorited } = useFavorites()
      const result = await checkIsFavorited('movie', 'mv_1')

      expect(result.isFavorited).toBe(true)
      expect(result.favoriteId).toBe('fav_123')
    })

    it('未收藏时应返回 { isFavorited: false, favoriteId: null }', async () => {
      vi.mocked(favoritesApi.checkFavorite).mockResolvedValue({
        isFavorited: false,
        favoriteId: null,
      })

      const { checkIsFavorited } = useFavorites()
      const result = await checkIsFavorited('movie', 'mv_999')

      expect(result.isFavorited).toBe(false)
      expect(result.favoriteId).toBeNull()
    })

    it('aPI 异常时应返回 { isFavorited: false, favoriteId: null }', async () => {
      vi.mocked(favoritesApi.checkFavorite).mockRejectedValue(new Error('Network error'))

      const { checkIsFavorited } = useFavorites()
      const result = await checkIsFavorited('actor', 'act_1')

      expect(result.isFavorited).toBe(false)
      expect(result.favoriteId).toBeNull()
    })
  })

  describe('removeFavorite', () => {
    it('删除成功后从列表中移除', async () => {
      vi.mocked(favoritesApi.deleteFavorite).mockResolvedValue({
        success: true,
      })

      const { removeFavorite } = useFavorites()
      const result = await removeFavorite('fav_123')

      expect(result.success).toBe(true)
      expect(favoritesApi.deleteFavorite).toHaveBeenCalledWith('fav_123')
    })

    it('删除失败时返回错误', async () => {
      vi.mocked(favoritesApi.deleteFavorite).mockResolvedValue({
        success: false,
      })

      const { removeFavorite } = useFavorites()
      const result = await removeFavorite('fav_invalid')

      expect(result.success).toBe(false)
    })
  })
})
