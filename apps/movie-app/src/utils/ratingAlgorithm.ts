/**
 * 播放源自动评分算法
 *
 * 综合评分 = 画质分(60%) + 文件大小合理性(20%) + 来源可信度(20%)
 * 最终分数范围：0-100 分
 */

export type Quality = '4K' | '1080P' | 'HD' | '720P' | 'SD' | '未知'

// 已知可信来源列表
const TRUSTED_SOURCES = new Set([
  'javbus',
  'javdb',
  'dmm',
  'fanza',
  'sukebei',
  'nyaa',
])

// 可疑来源列表
const SUSPICIOUS_SOURCES = new Set([
  'spam',
  'fake',
  'scam',
])

/**
 * 画质评分（基础分）
 * 60% 权重
 */
export function scoreByQuality(quality: Quality | string | null): number {
  const normalizedQuality = quality?.toUpperCase() || '未知'

  const qualityScores: Record<string, number> = {
    '4K': 100,
    '1080P': 85,
    '1080': 85,
    'HD': 75,
    '720P': 60,
    '720': 60,
    'SD': 40,
    '480P': 40,
    '360P': 30,
    '未知': 50, // 默认中等分数
  }

  return qualityScores[normalizedQuality] || 50
}

/**
 * 文件大小合理性评分
 * 20% 权重，返回调整分数（-20 到 +10）
 *
 * @param quality 画质
 * @param fileSizeGB 文件大小（GB）
 */
export function scoreByFileSize(quality: Quality | string | null, fileSizeGB: number | null): number {
  if (fileSizeGB === null || fileSizeGB <= 0) {
    return 0 // 无文件大小信息，不调整
  }

  const normalizedQuality = quality?.toUpperCase() || '未知'

  // 合理的文件大小范围（GB）
  const reasonableRanges: Record<string, { min: number, max: number, ideal: number }> = {
    '4K': { min: 8, max: 30, ideal: 15 },
    '1080P': { min: 4, max: 15, ideal: 8 },
    '1080': { min: 4, max: 15, ideal: 8 },
    'HD': { min: 2, max: 10, ideal: 5 },
    '720P': { min: 1, max: 6, ideal: 3 },
    '720': { min: 1, max: 6, ideal: 3 },
    'SD': { min: 0.5, max: 3, ideal: 1.5 },
  }

  const range = reasonableRanges[normalizedQuality]

  if (!range) {
    return 0 // 未知画质，无法判断
  }

  // 过小：质量差或假种子
  if (fileSizeGB < range.min) {
    return -20
  }

  // 过大：可能包含多余文件或冗余数据
  if (fileSizeGB > range.max) {
    return -10
  }

  // 理想范围：加分
  const idealMin = range.ideal * 0.8
  const idealMax = range.ideal * 1.2
  if (fileSizeGB >= idealMin && fileSizeGB <= idealMax) {
    return +10
  }

  // 合理但不理想：不调整
  return 0
}

/**
 * 来源可信度评分
 * 20% 权重，返回调整分数（-20 到 +15）
 *
 * @param sourceUrl 来源 URL
 */
export function scoreBySource(sourceUrl: string | null): number {
  if (!sourceUrl) {
    return 0
  }

  const url = sourceUrl.toLowerCase()

  // 检查可信来源
  for (const trusted of TRUSTED_SOURCES) {
    if (url.includes(trusted)) {
      return +15
    }
  }

  // 检查可疑来源
  for (const suspicious of SUSPICIOUS_SOURCES) {
    if (url.includes(suspicious)) {
      return -20
    }
  }

  // 未知来源：不调整
  return 0
}

/**
 * 计算综合自动评分
 *
 * @param quality 画质
 * @param fileSizeGB 文件大小（GB），可选
 * @param sourceUrl 来源 URL，可选
 * @returns 综合评分（0-100 分）
 */
export function calculateAutoScore(
  quality: Quality | string | null,
  fileSizeGB?: number | null,
  sourceUrl?: string | null,
): number {
  // 画质基础分（60% 权重）
  const qualityScore = scoreByQuality(quality)

  // 文件大小调整分（20% 权重）
  const sizeAdjustment = scoreByFileSize(quality, fileSizeGB || null)

  // 来源可信度调整分（20% 权重）
  const sourceAdjustment = scoreBySource(sourceUrl || null)

  // 计算加权分数
  const baseScore = qualityScore * 0.6
  const sizeScore = sizeAdjustment * 0.2
  const sourceScore = sourceAdjustment * 0.2

  const finalScore = baseScore + sizeScore + sourceScore

  // 限制在 0-100 范围
  return Math.max(0, Math.min(100, Math.round(finalScore)))
}

/**
 * 从磁力链接提取文件大小（如果包含在 dn 参数或其他元数据中）
 * 注意：标准 magnet link 不包含文件大小，此函数为扩展功能
 */
export function extractFileSizeFromMagnet(magnetLink: string): number | null {
  try {
    const url = new URL(magnetLink)
    const dn = url.searchParams.get('dn') // Display Name

    if (!dn) {
      return null
    }

    // 尝试从文件名提取大小（如：[1.2GB]、(2.5GB)）
    const sizeMatch = dn.match(/[[(](\d+(?:\.\d*)?)\s*(GB|MB)[\])]/i)

    if (sizeMatch) {
      const size = Number.parseFloat(sizeMatch[1])
      const unit = sizeMatch[2].toUpperCase()

      if (unit === 'GB') {
        return size
      }
      if (unit === 'MB') {
        return size / 1024
      }
    }

    return null
  }
  catch {
    return null
  }
}

/**
 * 计算综合评分（自动评分 + 用户评分）
 *
 * @param autoScore 自动评分（0-100）
 * @param userAverageRating 用户平均评分（0-100，由 1-5 星转换）
 * @param ratingCount 评分人数
 * @returns 综合评分（0-100）
 */
export function calculateCompositeScore(
  autoScore: number,
  userAverageRating?: number,
  ratingCount?: number,
): number {
  if (!userAverageRating || !ratingCount) {
    // 无用户评分，使用自动评分
    return autoScore
  }

  // 根据评分人数动态调整权重
  let autoWeight = 0.4
  let userWeight = 0.6

  if (ratingCount >= 20) {
    // 评分人数足够多，用户评分占主导
    autoWeight = 0.2
    userWeight = 0.8
  }
  else if (ratingCount >= 10) {
    // 评分人数中等，用户评分权重增加
    autoWeight = 0.3
    userWeight = 0.7
  }

  const compositeScore = autoScore * autoWeight + userAverageRating * userWeight

  return Math.round(compositeScore)
}

/**
 * 生成推荐标签
 *
 * @param compositeScore 综合评分
 * @param ratingCount 评分人数
 * @returns 推荐标签类型
 */
export function generateRecommendationTag(
  compositeScore: number,
  ratingCount?: number,
): 'highly-recommended' | 'recommended' | 'none' {
  if (compositeScore >= 90 && (ratingCount || 0) >= 10) {
    return 'highly-recommended' // 🏆 强烈推荐
  }

  if (compositeScore >= 80) {
    return 'recommended' // 👍 推荐
  }

  return 'none'
}

/**
 * 生成警告标签
 *
 * @param compositeScore 综合评分
 * @param ratingCount 评分人数
 * @returns 警告标签类型
 */
export function generateWarningTag(
  compositeScore: number,
  ratingCount?: number,
): 'low-quality' | 'new' | 'none' {
  if (compositeScore < 40 && (ratingCount || 0) >= 5) {
    return 'low-quality' // ⚠️ 质量较差
  }

  if (!ratingCount || ratingCount === 0) {
    return 'new' // 🆕 新资源
  }

  return 'none'
}
