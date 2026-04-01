/**
 * 播放源评分 Composable
 */

import type { Player } from '../types'
import { onMounted, ref } from 'vue'
import {
  cachePendingAction,
  getPendingActions,
  retryPendingActions,
} from '../utils/errorHandler'
import {
  calculateAutoScore,
  calculateCompositeScore,
  generateRecommendationTag,
  generateWarningTag,
} from '../utils/ratingAlgorithm'
import { useToast } from './useToast'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// 播放源评分数据
export interface PlayerRating {
  playerId: string
  autoScore: number // 自动评分 (0-100)
  averageRating?: number // 平均用户评分 (1-5)
  ratingCount?: number // 评分人数
  userScore?: number // 当前用户的评分 (1-5)
  compositeScore?: number // 综合评分
  recommendationTag?: string // 推荐标签
  warningTag?: string // 警告标签
}

// 评分请求负载
interface SubmitRatingPayload {
  playerId: string
  score: number
}

// 评分统计
export interface RatingStats {
  averageRating: number
  ratingCount: number
  distribution: {
    star1: number
    star2: number
    star3: number
    star4: number
    star5: number
  }
}

// 全局评分统计
export interface GlobalRatingStats {
  totalRatings: number
  averageScore: number
  topRatedPlayers: Array<{
    playerId: string
    playerName: string
    averageRating: number
    ratingCount: number
  }>
}

export function useRating() {
  const toast = useToast()
  const isLoading = ref(false)

  /**
   * 计算播放源的自动评分
   */
  function calculatePlayerAutoScore(player: Player): number {
    // 解析文件大小（如果 magnetLink 中包含大小信息）
    const fileSizeGB = null // TODO: 从 magnetLink 解析文件大小

    return calculateAutoScore(
      player.quality ?? null,
      fileSizeGB,
      player.sourceUrl,
    )
  }

  /**
   * 获取播放源的完整评分数据
   */
  function getPlayerRating(player: Player): PlayerRating {
    const autoScore = calculatePlayerAutoScore(player)
    const compositeScore = calculateCompositeScore(
      autoScore,
      player.averageRating,
      player.ratingCount,
    )

    return {
      playerId: player.id,
      autoScore,
      averageRating: player.averageRating,
      ratingCount: player.ratingCount,
      userScore: player.userScore,
      compositeScore,
      recommendationTag: generateRecommendationTag(compositeScore, player.ratingCount),
      warningTag: generateWarningTag(compositeScore, player.ratingCount),
    }
  }

  /**
   * 获取播放源列表的评分数据（批量）
   */
  function getPlayersRatings(players: Player[]): PlayerRating[] {
    return players.map(player => getPlayerRating(player))
  }

  /**
   * 提交用户评分（支持本地缓存和重试）
   */
  async function submitRating(playerId: string, score: number): Promise<boolean> {
    if (score < 1 || score > 5) {
      toast.error('评分必须在 1-5 星之间')
      return false
    }

    isLoading.value = true

    try {
      const payload: SubmitRatingPayload = {
        playerId,
        score,
      }

      const response = await fetch(`${API_BASE_URL}/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '提交评分失败')
      }

      const result = await response.json()

      if (result.code === 0) {
        toast.success('评分已提交')
        return true
      }
      else {
        toast.error(result.message || '提交评分失败')
        return false
      }
    }
    catch (error) {
      // 网络错误时保存到本地，稍后重试
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        const actionId = cachePendingAction('rating', payload)
        if (actionId) {
          toast.error('网络错误，评分已保存到本地，将在网络恢复后自动提交')
        }
        else {
          toast.error('提交失败，请稍后重试')
        }
      }
      else if (error instanceof Error) {
        toast.error(error.message)
      }
      return false
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * 重试所有待处理的评分
   */
  async function retryPendingRatings(): Promise<void> {
    const pendingActions = getPendingActions().filter(a => a.type === 'rating')

    if (pendingActions.length === 0) {
      return
    }

    const result = await retryPendingActions(async (action) => {
      try {
        const { playerId, score } = action.data
        const response = await fetch(`${API_BASE_URL}/ratings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ playerId, score }),
        })

        const result = await response.json()
        return response.ok && result.code === 0
      }
      catch {
        return false
      }
    })

    if (result.success > 0) {
      toast.success(`已提交 ${result.success} 个待处理评分`)
    }
  }

  // 初始化时尝试重试待处理的评分
  onMounted(() => {
    const pendingCount = getPendingActions().filter(a => a.type === 'rating').length
    if (pendingCount > 0) {
      retryPendingRatings()
    }
  })

  /**
   * 获取播放源的评分统计
   */
  async function getPlayerRatingStats(playerId: string): Promise<RatingStats | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/ratings/player/${playerId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('获取评分统计失败')
      }

      const result = await response.json()

      if (result.code === 0) {
        return result.data
      }
    }
    catch (error) {
      console.error('获取评分统计失败', error)
    }

    return null
  }

  /**
   * 获取当前用户的评分历史
   */
  async function getUserRatingHistory(): Promise<Array<{
    playerId: string
    movieCode?: string
    movieTitle?: string
    score: number
    createdAt: string
    updatedAt: string
  }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/ratings/user`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('获取评分历史失败')
      }

      const result = await response.json()

      if (result.code === 0) {
        return result.data || []
      }
    }
    catch (error) {
      console.error('获取评分历史失败', error)
    }

    return []
  }

  /**
   * 获取全局评分统计
   */
  async function getGlobalRatingStats(): Promise<GlobalRatingStats | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/ratings/stats`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('获取全局统计失败')
      }

      const result = await response.json()

      if (result.code === 0) {
        return result.data
      }
    }
    catch (error) {
      console.error('获取全局统计失败', error)
    }

    return null
  }

  /**
   * 对播放源列表进行智能排序
   */
  function sortPlayersByScore(players: Player[]): Player[] {
    const playersWithRatings = players.map((player) => {
      const rating = getPlayerRating(player)
      return {
        player,
        compositeScore: rating.compositeScore || 0,
      }
    })

    // 按综合评分降序排序
    playersWithRatings.sort((a, b) => b.compositeScore - a.compositeScore)

    return playersWithRatings.map(item => item.player)
  }

  /**
   * 获取推荐的播放源（综合评分最高的）
   */
  function getRecommendedPlayer(players: Player[]): Player | null {
    if (players.length === 0)
      return null

    const sorted = sortPlayersByScore(players)
    return sorted[0]
  }

  /**
   * 过滤高质量播放源（综合评分 >= 70）
   */
  function filterHighQualityPlayers(players: Player[]): Player[] {
    return players.filter((player) => {
      const rating = getPlayerRating(player)
      return (rating.compositeScore || 0) >= 70
    })
  }

  return {
    // 状态
    isLoading,

    // 评分计算
    calculatePlayerAutoScore,
    getPlayerRating,
    getPlayersRatings,

    // 评分提交
    submitRating,
    retryPendingRatings,

    // 评分查询
    getPlayerRatingStats,
    getUserRatingHistory,
    getGlobalRatingStats,

    // 智能推荐
    sortPlayersByScore,
    getRecommendedPlayer,
    filterHighQualityPlayers,
  }
}
