import type { Player } from '../../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRating } from '../useRating'

// Mock fetch
globalThis.fetch = vi.fn()

// Mock useToast
vi.mock('./useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

describe('useRating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('自动评分计算', () => {
    it('应该计算播放源的自动评分', () => {
      const { calculatePlayerAutoScore } = useRating()

      const player: Player = {
        id: 'player-1',
        movieId: 'movie-1',
        sourceName: 'Test Source',
        sourceUrl: 'https://javbus.com/ABC-123',
        quality: '1080P',
        sortOrder: 1,
      }

      const score = calculatePlayerAutoScore(player)

      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('应该为高质量源返回高分', () => {
      const { calculatePlayerAutoScore } = useRating()

      const player: Player = {
        id: 'player-1',
        movieId: 'movie-1',
        sourceName: 'Test',
        sourceUrl: 'https://javbus.com',
        quality: '4K',
        sortOrder: 1,
      }

      const score = calculatePlayerAutoScore(player)

      expect(score).toBeGreaterThan(60)
    })

    it('应该处理缺失的画质信息', () => {
      const { calculatePlayerAutoScore } = useRating()

      const player: Player = {
        id: 'player-1',
        movieId: 'movie-1',
        sourceName: 'Test',
        sourceUrl: 'https://test.com',
        quality: undefined,
        sortOrder: 1,
      }

      const score = calculatePlayerAutoScore(player)

      expect(score).toBeGreaterThan(0)
    })
  })

  describe('播放源评分信息', () => {
    it('应该获取播放源的完整评分信息', () => {
      const { getPlayerRating } = useRating()

      const player: Player = {
        id: 'player-1',
        movieId: 'movie-1',
        sourceName: 'Test',
        sourceUrl: 'https://javbus.com',
        quality: '1080P',
        sortOrder: 1,
        averageRating: 85,
        ratingCount: 10,
      }

      const rating = getPlayerRating(player)

      expect(rating.autoScore).toBeGreaterThan(0)
      expect(rating.compositeScore).toBeGreaterThan(0)
      expect(rating.recommendationTag).toBeDefined()
      expect(rating.warningTag).toBeDefined()
    })

    it('应该为高综合评分生成推荐标签', () => {
      const { getPlayerRating } = useRating()

      const player: Player = {
        id: 'player-1',
        movieId: 'movie-1',
        sourceName: 'Test',
        sourceUrl: 'https://javbus.com',
        quality: '4K',
        sortOrder: 1,
        averageRating: 100,
        ratingCount: 20,
      }

      const rating = getPlayerRating(player)

      expect(rating.compositeScore).toBeGreaterThan(90)
      expect(rating.recommendationTag).not.toBe('none')
    })

    it('应该为低综合评分生成警告标签', () => {
      const { getPlayerRating } = useRating()

      const player: Player = {
        id: 'player-1',
        movieId: 'movie-1',
        sourceName: 'Test',
        sourceUrl: 'https://unknown.com',
        quality: 'SD',
        sortOrder: 1,
        averageRating: 30,
        ratingCount: 10,
      }

      const rating = getPlayerRating(player)

      expect(rating.compositeScore).toBeLessThan(50)
      expect(rating.warningTag).toBe('low-quality')
    })
  })

  describe('评分提交', () => {
    it('应该验证评分范围（1-5 星）', async () => {
      const { submitRating } = useRating()

      const result1 = await submitRating('player-1', 6 as any)
      expect(result1).toBe(false)

      const result2 = await submitRating('player-1', 0 as any)
      expect(result2).toBe(false)
    })

    it('应该成功提交有效评分', async () => {
      const { submitRating } = useRating()

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 0, data: {} }),
      } as Response)

      const result = await submitRating('player-1', 4)
      expect(result).toBe(true)
    })
  })

  describe('播放源排序', () => {
    it('应该按综合评分排序播放源', () => {
      const { sortPlayersByScore } = useRating()

      const players: Player[] = [
        {
          id: 'player-1',
          movieId: 'movie-1',
          sourceName: 'Low',
          sourceUrl: 'http://test.com',
          quality: 'SD',
          sortOrder: 1,
          averageRating: 40,
          ratingCount: 5,
        },
        {
          id: 'player-2',
          movieId: 'movie-1',
          sourceName: 'High',
          sourceUrl: 'https://javbus.com',
          quality: '4K',
          sortOrder: 2,
          averageRating: 95,
          ratingCount: 20,
        },
        {
          id: 'player-3',
          movieId: 'movie-1',
          sourceName: 'Medium',
          sourceUrl: 'http://test.com',
          quality: '1080P',
          sortOrder: 3,
          averageRating: 70,
          ratingCount: 10,
        },
      ]

      const sorted = sortPlayersByScore(players)

      // 应该按综合评分降序排列
      expect(sorted[0].id).toBe('player-2') // High
      expect(sorted[1].id).toBe('player-3') // Medium
      expect(sorted[2].id).toBe('player-1') // Low
    })

    it('应该处理单个播放源', () => {
      const { sortPlayersByScore } = useRating()

      const players: Player[] = [
        {
          id: 'player-1',
          movieId: 'movie-1',
          sourceName: 'Test',
          sourceUrl: 'http://test.com',
          quality: '1080P',
          sortOrder: 1,
        },
      ]

      const sorted = sortPlayersByScore(players)

      expect(sorted).toHaveLength(1)
      expect(sorted[0].id).toBe('player-1')
    })
  })

  describe('工具函数', () => {
    it('应该提供必要的状态和方法', () => {
      const rating = useRating()

      expect(rating.isLoading).toBeDefined()

      expect(typeof rating.calculatePlayerAutoScore).toBe('function')
      expect(typeof rating.getPlayerRating).toBe('function')
      expect(typeof rating.sortPlayersByScore).toBe('function')
      expect(typeof rating.submitRating).toBe('function')
      expect(typeof rating.getPlayerRatingStats).toBe('function')
      expect(typeof rating.getUserRatingHistory).toBe('function')
    })
  })
})
