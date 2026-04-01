/**
 * 评分系统性能测试工具
 *
 * 测试评分计算、UI 渲染、API 调用等性能
 */

/* eslint-disable no-console */

import type { Player } from '../types'
import { extractFileSize } from './playbackSources'
import { calculateAutoScore } from './ratingAlgorithm'

interface PerfTestResult {
  testName: string
  avgTime: number
  p95Time: number
  samples: number
}

/**
 * 测试自动评分算法性能
 */
export async function testAutoRatingPerformance(
  players: Player[],
  iterations: number = 1000,
): Promise<PerfTestResult> {
  const times: number[] = []

  for (let i = 0; i < iterations; i++) {
    const player = players[Math.floor(Math.random() * players.length)]
    const start = performance.now()

    calculateAutoScore(
      player.quality || '',
      extractFileSize(player.sourceName),
      player.sourceName || null,
    )

    const end = performance.now()
    times.push(end - start)
  }

  const sorted = times.sort((a, b) => a - b)
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const p95Index = Math.floor(sorted.length * 0.95)
  const p95 = sorted[p95Index]

  return {
    testName: '自动评分算法',
    avgTime: avg,
    p95Time: p95,
    samples: times.length,
  }
}

/**
 * 测试评分列表渲染性能
 */
export async function testRatingListRenderPerformance(
  playerCount: number,
): Promise<PerfTestResult> {
  console.log(`🎨 测试渲染 ${playerCount} 个评分组件...`)

  // 此测试需要在实际浏览器环境中运行
  // 这里只是提供模拟框架

  return {
    testName: `评分列表渲染 (${playerCount} 项)`,
    avgTime: 0,
    p95Time: 0,
    samples: 0,
  }
}

/**
 * 批量评分计算性能测试
 */
export async function testBatchRatingCalculation(
  players: Player[],
): Promise<PerfTestResult> {
  const start = performance.now()

  // 批量计算所有播放源的自动评分
  void players.map(player => calculateAutoScore(
    player.quality || '',
    extractFileSize(player.sourceName),
    player.sourceName || null,
  ))

  const end = performance.now()
  const time = end - start

  return {
    testName: `批量评分计算 (${players.length} 项)`,
    avgTime: time,
    p95Time: time,
    samples: 1,
  }
}

/**
 * 运行所有评分性能测试
 */
export async function runRatingPerfTests(players: Player[]): Promise<PerfTestResult[]> {
  console.log('🚀 开始评分系统性能测试...\n')

  const results: PerfTestResult[] = []

  // 1. 自动评分算法
  console.log('1️⃣ 测试自动评分算法...')
  const autoRatingResult = await testAutoRatingPerformance(players, 1000)
  results.push(autoRatingResult)
  console.log(`  平均: ${autoRatingResult.avgTime.toFixed(3)}ms, P95: ${autoRatingResult.p95Time.toFixed(3)}ms`)

  // 2. 批量计算
  console.log('\n2️⃣ 测试批量评分计算...')
  const batchResult = await testBatchRatingCalculation(players)
  results.push(batchResult)
  console.log(`  总时间: ${batchResult.avgTime.toFixed(2)}ms (${players.length} 项)`)
  console.log(`  平均每项: ${(batchResult.avgTime / players.length).toFixed(3)}ms`)

  return results
}

/**
 * 生成评分性能测试报告
 */
export function generateRatingPerfReport(results: PerfTestResult[]): string {
  let report = '# 评分系统性能测试报告\n\n'
  report += `测试时间: ${new Date().toLocaleString('zh-CN')}\n\n`
  report += '## 测试结果\n\n'
  report += '| 测试项 | 样本数 | 平均时间 | P95 | 状态 |\n'
  report += '|--------|--------|----------|-----|------|\n'

  for (const result of results) {
    const p95Status = result.p95Time < 10 ? '✅' : result.p95Time < 50 ? '⚠️' : '❌'
    report += `| ${result.testName} | ${result.samples} | ${result.avgTime.toFixed(3)}ms | ${result.p95Time.toFixed(3)}ms | ${p95Status} |\n`
  }

  report += '\n## 性能标准\n\n'
  report += '- ✅ 优秀: P95 < 10ms (前端算法)\n'
  report += '- ⚠️ 一般: P95 < 50ms\n'
  report += '- ❌ 需优化: P95 ≥ 50ms\n'

  return report
}

/**
 * 在浏览器控制台运行性能测试
 *
 * 使用方式：
 * ```
 * import { runBrowserPerfTest } from '@/utils/ratingPerfTest'
 * await runBrowserPerfTest()
 * ```
 */
export async function runBrowserPerfTest(): Promise<void> {
  console.log('🎯 浏览器性能测试')
  console.log('请确保在实际应用环境中运行此测试\n')

  // 模拟播放源数据
  const mockPlayers: Player[] = Array.from({ length: 100 }, (_, i) => ({
    id: `player-${i}`,
    movieId: `movie-${Math.floor(i / 10)}`,
    type: ['磁力链接', '网盘', '直链'][Math.floor(Math.random() * 3)],
    name: `播放源 ${i + 1}`,
    url: `http://example.com/${i}`,
    sourceName: `播放源 ${i + 1} ${['4K', '1080P', '720P', '480P'][Math.floor(Math.random() * 4)]} ${(Math.random() * 10 + 1).toFixed(2)}GB`,
    sourceUrl: `http://example.com/${i}`,
    quality: ['4K', '1080P', '720P', '480P'][Math.floor(Math.random() * 4)],
    size: `${(Math.random() * 10 + 1).toFixed(2)}GB`,
    uploadAt: new Date().toISOString(),
    sortOrder: i,
    averageRating: Math.random() * 5,
    ratingCount: Math.floor(Math.random() * 100),
  }))

  const results = await runRatingPerfTests(mockPlayers)
  const report = generateRatingPerfReport(results)

  console.log(`\n${report}`)
}
