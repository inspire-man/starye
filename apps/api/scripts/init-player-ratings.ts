/**
 * 初始化播放源评分脚本
 *
 * 为所有现有播放源计算自动评分并更新到数据库
 */

import * as schema from '@starye/db/schema'
import { eq } from 'drizzle-orm'

// 自动评分算法（与前端一致）
interface AutoScoreInput {
  quality?: string
  fileSize?: number // GB
  sourceName: string
}

function calculateAutoScore(input: AutoScoreInput): number {
  let score = 0

  // 1. 画质评分（权重 60%）
  const qualityScores: Record<string, number> = {
    '4K': 100,
    'UHD': 100,
    '1080P': 85,
    'FHD': 85,
    'HD': 75,
    '720P': 60,
    'SD': 40,
  }

  const quality = input.quality?.toUpperCase()
  const qualityScore = quality ? (qualityScores[quality] || 50) : 50
  score += qualityScore * 0.6

  // 2. 文件大小合理性评分（权重 20%）
  if (input.fileSize) {
    let sizeScore = 0

    if (quality === '4K' || quality === 'UHD') {
      // 4K: 8-25GB 合理
      if (input.fileSize >= 8 && input.fileSize <= 25) {
        sizeScore = 10
      }
      else if (input.fileSize < 5) {
        sizeScore = -20 // 太小，可能质量差
      }
      else if (input.fileSize > 30) {
        sizeScore = -10 // 太大，可能冗余
      }
    }
    else if (quality === '1080P' || quality === 'FHD') {
      // 1080P: 4-12GB 合理
      if (input.fileSize >= 4 && input.fileSize <= 12) {
        sizeScore = 10
      }
      else if (input.fileSize < 2) {
        sizeScore = -20
      }
      else if (input.fileSize > 15) {
        sizeScore = -10
      }
    }
    else {
      // 其他画质：合理范围 ±20%
      if (input.fileSize >= 2 && input.fileSize <= 8) {
        sizeScore = 5
      }
    }

    score += sizeScore * 0.2
  }

  // 3. 来源可信度评分（权重 20%）
  const trustedSources = [
    'javbus',
    'javdb',
    'dmm',
    'fanza',
    'mgstage',
    'r18',
    'prestige',
    's1',
  ]

  const sourceLower = input.sourceName.toLowerCase()
  const isTrusted = trustedSources.some(s => sourceLower.includes(s))
  const sourceScore = isTrusted ? 15 : 0
  score += sourceScore * 0.2

  // 确保分数在 0-100 范围内
  return Math.max(0, Math.min(100, score))
}

/**
 * 从播放源名称中提取文件大小（GB）
 */
function extractFileSize(sourceName: string): number | undefined {
  const sizeMatch = sourceName.match(/(\d+(?:\.\d+)?)\s*GB/i)
  return sizeMatch ? Number.parseFloat(sizeMatch[1]) : undefined
}

/**
 * 初始化评分
 */
export async function initPlayerRatings(db: any) {
  console.log('开始初始化播放源评分...')

  try {
    // 1. 查询所有播放源
    const playersList = await db.select().from(schema.players).all()
    console.log(`找到 ${playersList.length} 个播放源`)

    let updatedCount = 0

    // 2. 为每个播放源计算自动评分
    for (const player of playersList) {
      // 只更新还没有评分的播放源
      if (player.averageRating !== null && player.averageRating !== undefined) {
        continue
      }

      const autoScore = calculateAutoScore({
        quality: player.quality || undefined,
        fileSize: extractFileSize(player.sourceName),
        sourceName: player.sourceName,
      })

      // 转换为 1-5 星评分
      const rating = (autoScore / 100) * 5

      // 更新数据库
      await db
        .update(schema.players)
        .set({
          averageRating: rating,
          ratingCount: 0, // 初始化为 0，表示仅有自动评分
        })
        .where(eq(schema.players.id, player.id))

      updatedCount++

      if (updatedCount % 100 === 0) {
        console.log(`已更新 ${updatedCount}/${playersList.length} 个播放源`)
      }
    }

    console.log(`评分初始化完成！更新了 ${updatedCount} 个播放源`)
    return { total: playersList.length, updated: updatedCount }
  }
  catch (error) {
    console.error('初始化评分失败', error)
    throw error
  }
}

// 如果直接运行此脚本
// eslint-disable-next-line node/prefer-global/process
if (import.meta.url === `file://${process.argv[1]}`) {
  // 需要在 API 服务器中运行此脚本
}
