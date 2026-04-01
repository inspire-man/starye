/**
 * 性能测试脚本
 *
 * 测试评分查询和 Aria2 任务查询的性能
 */

import { performance } from 'node:perf_hooks'

interface PerformanceResult {
  operation: string
  samples: number
  avgTime: number
  minTime: number
  maxTime: number
  p95Time: number
  success: boolean
}

/**
 * 运行性能测试
 */
async function runPerfTest(
  name: string,
  testFn: () => Promise<void>,
  iterations: number = 100,
): Promise<PerformanceResult> {
  const times: number[] = []
  let errors = 0

  console.log(`\n开始测试: ${name} (${iterations} 次)...`)

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()

    try {
      await testFn()
      const end = performance.now()
      times.push(end - start)
    }
    catch (error) {
      errors++
      console.error(`测试 ${i + 1} 失败`, error)
    }

    // 每 20 次输出进度
    if ((i + 1) % 20 === 0) {
      console.log(`  进度: ${i + 1}/${iterations}`)
    }
  }

  if (times.length === 0) {
    return {
      operation: name,
      samples: 0,
      avgTime: 0,
      minTime: 0,
      maxTime: 0,
      p95Time: 0,
      success: false,
    }
  }

  // 计算统计数据
  const sorted = times.sort((a, b) => a - b)
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const min = sorted[0] ?? 0
  const max = sorted.at(-1) ?? 0
  const p95Index = Math.floor(sorted.length * 0.95)
  const p95 = sorted[p95Index] ?? 0

  const result: PerformanceResult = {
    operation: name,
    samples: times.length,
    avgTime: avg,
    minTime: min,
    maxTime: max,
    p95Time: p95,
    success: errors === 0,
  }

  console.log(`\n✅ ${name} 完成`)
  console.log(`  样本数: ${result.samples}`)
  console.log(`  平均时间: ${result.avgTime.toFixed(2)}ms`)
  console.log(`  最小时间: ${result.minTime.toFixed(2)}ms`)
  console.log(`  最大时间: ${result.maxTime.toFixed(2)}ms`)
  console.log(`  P95: ${result.p95Time.toFixed(2)}ms`)
  console.log(`  错误数: ${errors}`)

  return result
}

/**
 * 测试评分查询性能
 */
export async function testRatingQueryPerformance(
  db: any,
  playerIds: string[],
): Promise<PerformanceResult> {
  if (playerIds.length === 0) {
    console.warn('没有播放源 ID 可测试')
    return {
      operation: '评分查询',
      samples: 0,
      avgTime: 0,
      minTime: 0,
      maxTime: 0,
      p95Time: 0,
      success: false,
    }
  }

  return runPerfTest('评分查询性能测试', async () => {
    // 随机选择一个播放源 ID
    const playerId = playerIds[Math.floor(Math.random() * playerIds.length)]

    // 模拟查询评分
    await db.query.player.findFirst({
      where: (player: any, { eq }: any) => eq(player.id, playerId),
      columns: {
        id: true,
        averageRating: true,
        ratingCount: true,
      },
    })
  }, 100)
}

/**
 * 测试 Aria2 RPC 性能（模拟）
 */
export async function testAria2RpcPerformance(): Promise<PerformanceResult> {
  console.log('\n⚠️  Aria2 RPC 性能测试需要实际的 Aria2 服务')
  console.log('请使用独立的测试脚本，连接到真实 Aria2 服务器')

  return {
    operation: 'Aria2 RPC 调用',
    samples: 0,
    avgTime: 0,
    minTime: 0,
    maxTime: 0,
    p95Time: 0,
    success: false,
  }
}

/**
 * 生成性能测试报告
 */
export function generatePerformanceReport(results: PerformanceResult[]): string {
  let report = '# 性能测试报告\n\n'
  report += `测试时间: ${new Date().toLocaleString('zh-CN')}\n\n`
  report += '## 测试结果\n\n'
  report += '| 测试项 | 样本数 | 平均时间 | P95 | 状态 |\n'
  report += '|--------|--------|----------|-----|------|\n'

  for (const result of results) {
    const status = result.success ? '✅ 通过' : '❌ 失败'
    const p95Status = result.p95Time < 200 ? '✅' : result.p95Time < 500 ? '⚠️' : '❌'
    report += `| ${result.operation} | ${result.samples} | ${result.avgTime.toFixed(2)}ms | ${result.p95Time.toFixed(2)}ms ${p95Status} | ${status} |\n`
  }

  report += '\n## 性能标准\n\n'
  report += '- ✅ 优秀: P95 < 200ms\n'
  report += '- ⚠️ 一般: P95 < 500ms\n'
  report += '- ❌ 需优化: P95 ≥ 500ms\n'

  return report
}

/**
 * 主测试函数
 */
export async function runPerformanceTests(db: any): Promise<void> {
  console.log('🚀 开始性能测试...\n')

  const results: PerformanceResult[] = []

  // 1. 准备测试数据
  console.log('准备测试数据...')
  const players = await db.query.player.findMany({
    limit: 100,
    columns: { id: true },
  })
  const playerIds = players.map((p: any) => p.id)

  console.log(`找到 ${playerIds.length} 个播放源用于测试`)

  // 2. 测试评分查询
  const ratingResult = await testRatingQueryPerformance(db, playerIds)
  results.push(ratingResult)

  // 3. 测试 Aria2 RPC（跳过，需真实服务）
  // const aria2Result = await testAria2RpcPerformance()
  // results.push(aria2Result)

  // 4. 生成报告
  const report = generatePerformanceReport(results)
  console.log(`\n${report}`)

  // 保存报告到文件
  const fs = await import('node:fs/promises')
  await fs.writeFile('performance-test-report.md', report, 'utf-8')
  console.log('\n📊 报告已保存到 performance-test-report.md')
}
