import type { Player } from '../types'
import { calculateAutoScore } from './ratingAlgorithm'

/**
 * 排序方式
 */
export type SortMethod = 'default' | 'rating' | 'quality' | 'latest'

/**
 * 计算综合评分
 * 评分人数 < 10：自动评分 40% + 用户评分 60%
 * 评分人数 ≥ 10：自动评分 20% + 用户评分 80%
 */
export function calculateCombinedScore(source: Player): number {
  // 计算自动评分（0-100）
  const autoScore = calculateAutoScore(
    source.quality || '',
    extractFileSize(source.sourceName),
    source.sourceName || null,
  )

  // 如果没有用户评分，返回自动评分
  if (!source.averageRating || !source.ratingCount) {
    return autoScore
  }

  // 用户评分转换为 0-100 分制
  const userScore = (source.averageRating / 5) * 100

  // 根据评分人数调整权重
  const ratingCount = source.ratingCount
  if (ratingCount < 10) {
    return autoScore * 0.4 + userScore * 0.6
  }
  else {
    return autoScore * 0.2 + userScore * 0.8
  }
}

/**
 * 从播放源名称中提取文件大小（GB）
 */
export function extractFileSize(sourceName: string): number | undefined {
  const sizeMatch = sourceName.match(/(\d+(?:\.\d+)?)\s*GB/i)
  return sizeMatch ? Number.parseFloat(sizeMatch[1]) : undefined
}

/**
 * 播放源排序函数
 * 支持多种排序方式：默认、评分、画质、最新
 */
export function sortPlaybackSources(sources: Player[], sortMethod: SortMethod = 'default'): Player[] {
  const typeWeight: Record<string, number> = {
    magnet: 3,
    online: 2,
    other: 1,
  }

  const qualityWeight: Record<string, number> = {
    '4K': 4,
    '1080P': 3,
    '720P': 2,
    'HD': 3,
    'SD': 1,
  }

  return [...sources].sort((a, b) => {
    // 按综合评分排序
    if (sortMethod === 'rating') {
      const scoreA = calculateCombinedScore(a)
      const scoreB = calculateCombinedScore(b)

      if (scoreA !== scoreB) {
        return scoreB - scoreA
      }

      // 同分时按画质排序
      const qualityA = qualityWeight[a.quality || ''] || 0
      const qualityB = qualityWeight[b.quality || ''] || 0
      return qualityB - qualityA
    }

    // 按画质排序
    if (sortMethod === 'quality') {
      const qualityA = qualityWeight[a.quality || ''] || 0
      const qualityB = qualityWeight[b.quality || ''] || 0

      if (qualityA !== qualityB) {
        return qualityB - qualityA
      }

      // 同画质按评分排序
      return calculateCombinedScore(b) - calculateCombinedScore(a)
    }

    // 按最新排序（sortOrder 越小越新）
    if (sortMethod === 'latest') {
      return a.sortOrder - b.sortOrder
    }

    // 默认排序：类型 > 画质 > 评分
    // 1. 按类型排序（磁力链接优先）
    const typeA = a.sourceUrl?.startsWith('magnet:') || a.sourceName.includes('磁力') ? 'magnet' : 'online'
    const typeB = b.sourceUrl?.startsWith('magnet:') || b.sourceName.includes('磁力') ? 'magnet' : 'online'

    const weightA = typeWeight[typeA] || typeWeight.other
    const weightB = typeWeight[typeB] || typeWeight.other

    if (weightA !== weightB) {
      return weightB - weightA
    }

    // 2. 按画质排序
    const qualityA = qualityWeight[a.quality || ''] || 0
    const qualityB = qualityWeight[b.quality || ''] || 0

    if (qualityA !== qualityB) {
      return qualityB - qualityA
    }

    // 3. 按综合评分排序
    const scoreA = calculateCombinedScore(a)
    const scoreB = calculateCombinedScore(b)

    if (scoreA !== scoreB) {
      return scoreB - scoreA
    }

    // 4. 按sortOrder排序（数据库中的顺序）
    return a.sortOrder - b.sortOrder
  })
}

/**
 * 判断是否为磁力链接
 */
export function isMagnetLink(url: string): boolean {
  return url?.startsWith('magnet:') || false
}

/**
 * 获取播放源类型图标
 */
export function getSourceTypeIcon(source: Player): string {
  if (isMagnetLink(source.sourceUrl)) {
    return '🧲'
  }
  if (source.sourceName.includes('在线') || source.sourceName.includes('播放')) {
    return '▶️'
  }
  return '📺'
}

/**
 * 获取画质标签样式类
 */
export function getQualityBadgeClass(quality?: string): string {
  if (!quality)
    return 'bg-gray-600 text-gray-300'

  const q = quality.toUpperCase()

  if (q === '4K' || q === 'UHD') {
    return 'bg-purple-600 text-white'
  }

  if (q === '1080P' || q === 'HD' || q === 'FHD') {
    return 'bg-green-600 text-white'
  }

  if (q === '720P' || q === 'SD') {
    return 'bg-gray-500 text-white'
  }

  return 'bg-blue-600 text-white'
}
