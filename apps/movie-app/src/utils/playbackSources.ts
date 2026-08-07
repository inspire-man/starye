import type { Player } from '../types'
import { calculateAutoScore } from './ratingAlgorithm'

export type PlaybackSourceType = 'direct' | 'magnet' | 'TorrServer'

export interface PlaybackSourceInput {
  readonly isActive?: boolean | null
  readonly source?: string | null
  readonly sourceUrl?: string | null
}

export interface PlaybackSourceGroups {
  readonly eligibleDirect: Player[]
  readonly eligibleMagnet: Player[]
  readonly ineligible: Player[]
}

/**
 * 排序方式
 */
export type SortMethod = 'default' | 'rating' | 'quality' | 'latest'

/**
 * 按服务端 source 标记和 URL 推断来源类型。
 * TorrServer 是受控流入口，必须先于 URL 推断处理。
 */
export function classifyPlaybackSource(source: PlaybackSourceInput): PlaybackSourceType {
  if (source.source === 'TorrServer') {
    return 'TorrServer'
  }

  return isMagnetLink(source.sourceUrl) ? 'magnet' : 'direct'
}

/**
 * 判断来源是否通过客户端可见的最小 eligibility gate。
 * 健康、评分和排序字段不参与此决定。
 */
export function isEligiblePlaybackSource(source: PlaybackSourceInput): boolean {
  return source.isActive === true
    && typeof source.sourceUrl === 'string'
    && source.sourceUrl.trim().length > 0
}

/**
 * 选择服务端顺序中的首个 eligible direct 来源。
 * magnet 和 TorrServer 只能通过各自的受控入口处理。
 */
export function selectDirectPlaybackSource(sources: readonly Player[]): Player | null {
  return sources.find(source => isEligiblePlaybackSource(source)
    && classifyPlaybackSource(source) === 'direct') ?? null
}

/**
 * 按播放类型和 eligibility 投影默认来源组。
 * eligible TorrServer 保留在末组，避免被浏览器 direct 播放路径消费。
 */
export function groupPlaybackSources(sources: readonly Player[]): PlaybackSourceGroups {
  const groups: PlaybackSourceGroups = {
    eligibleDirect: [],
    eligibleMagnet: [],
    ineligible: [],
  }

  for (const source of sources) {
    const eligible = isEligiblePlaybackSource(source)
    const type = classifyPlaybackSource(source)

    if (eligible && type === 'direct') {
      groups.eligibleDirect.push(source)
    }
    else if (eligible && type === 'magnet') {
      groups.eligibleMagnet.push(source)
    }
    else {
      groups.ineligible.push(source)
    }
  }

  return groups
}

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
  const qualityWeight: Record<string, number> = {
    '4K': 4,
    '1080P': 3,
    '720P': 2,
    'HD': 3,
    'SD': 1,
  }

  const groups = groupPlaybackSources(sources)
  if (sortMethod === 'default') {
    return [
      ...groups.eligibleDirect,
      ...groups.eligibleMagnet,
      ...groups.ineligible,
    ]
  }

  const sortGroup = (group: Player[]): Player[] => group
    .map((source, index) => ({ source, index }))
    .sort((a, b) => {
      let result = 0

      if (sortMethod === 'rating') {
        result = calculateCombinedScore(b.source) - calculateCombinedScore(a.source)
        if (result === 0) {
          result = (qualityWeight[b.source.quality || ''] || 0)
            - (qualityWeight[a.source.quality || ''] || 0)
        }
      }
      else if (sortMethod === 'quality') {
        result = (qualityWeight[b.source.quality || ''] || 0)
          - (qualityWeight[a.source.quality || ''] || 0)
        if (result === 0) {
          result = calculateCombinedScore(b.source) - calculateCombinedScore(a.source)
        }
      }
      else if (sortMethod === 'latest') {
        result = a.source.sortOrder - b.source.sortOrder
      }

      return result === 0 ? a.index - b.index : result
    })
    .map(({ source }) => source)

  return [
    ...sortGroup(groups.eligibleDirect),
    ...sortGroup(groups.eligibleMagnet),
    ...sortGroup(groups.ineligible),
  ]
}

/**
 * 判断是否为磁力链接
 */
export function isMagnetLink(url?: string | null): boolean {
  return typeof url === 'string' && url.trim().toLowerCase().startsWith('magnet:')
}

/**
 * 获取播放源类型图标
 */
export function getSourceTypeIcon(source: Player): string {
  if (classifyPlaybackSource(source) === 'magnet') {
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
