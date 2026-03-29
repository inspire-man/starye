import type { Player } from '../types'

/**
 * 播放源排序函数
 * 优先级：类型（磁力 > 在线） > 画质（4K > 1080P > 720P） > 创建时间
 */
export function sortPlaybackSources(sources: Player[]): Player[] {
  const typeWeight: Record<string, number> = {
    'magnet': 3,
    'online': 2,
    'other': 1,
  }

  const qualityWeight: Record<string, number> = {
    '4K': 4,
    '1080P': 3,
    'HD': 3,
    '720P': 2,
    'SD': 1,
  }

  return [...sources].sort((a, b) => {
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

    // 3. 按sortOrder排序（数据库中的顺序）
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
