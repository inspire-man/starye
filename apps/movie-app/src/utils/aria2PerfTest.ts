/**
 * Aria2 连接性能测试工具
 *
 * 测试 WebSocket 连接延迟、RPC 调用响应时间、重连机制
 */

/* eslint-disable no-console */
/* eslint-disable unused-imports/no-unused-vars */

import type { Aria2Config } from '../types'
import { createAria2Client } from './aria2Client'

interface ConnectionTestResult {
  testName: string
  success: boolean
  latency?: number
  error?: string
}

interface RpcTestResult {
  method: string
  avgLatency: number
  minLatency: number
  maxLatency: number
  p95Latency: number
  successRate: number
}

/**
 * 测试 Aria2 连接
 */
export async function testAria2Connection(config: Aria2Config): Promise<ConnectionTestResult> {
  const startTime = performance.now()

  try {
    const client = createAria2Client(config)

    // 尝试调用 getVersion 测试连接
    await client.getVersion()

    const latency = performance.now() - startTime

    return {
      testName: 'Aria2 连接测试',
      success: true,
      latency,
    }
  }
  catch (error: any) {
    return {
      testName: 'Aria2 连接测试',
      success: false,
      error: error.message || String(error),
    }
  }
}

/**
 * 测试 RPC 调用性能
 */
export async function testRpcPerformance(
  config: Aria2Config,
  method: string,
  iterations: number = 50,
): Promise<RpcTestResult> {
  const client = createAria2Client(config)
  const latencies: number[] = []
  let successCount = 0

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now()

    try {
      if (method === 'tellActive') {
        await client.tellActive()
      }
      else if (method === 'tellWaiting') {
        await client.tellWaiting(0, 10)
      }
      else if (method === 'tellStopped') {
        await client.tellStopped(0, 10)
      }
      else if (method === 'getGlobalStat') {
        await client.getGlobalStat()
      }

      const latency = performance.now() - startTime
      latencies.push(latency)
      successCount++
    }
    catch (error) {
      // 记录失败但继续
    }
  }

  if (latencies.length === 0) {
    return {
      method,
      avgLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      p95Latency: 0,
      successRate: 0,
    }
  }

  const sorted = latencies.sort((a, b) => a - b)
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
  const min = sorted[0] ?? 0
  const max = sorted.at(-1) ?? 0
  const p95Index = Math.floor(sorted.length * 0.95)
  const p95 = sorted[p95Index] ?? 0

  return {
    method,
    avgLatency: avg,
    minLatency: min,
    maxLatency: max,
    p95Latency: p95,
    successRate: (successCount / iterations) * 100,
  }
}

/**
 * 运行完整的性能测试套件
 */
export async function runAria2PerfTestSuite(config: Aria2Config): Promise<{
  connection: ConnectionTestResult
  rpcTests: RpcTestResult[]
}> {
  console.log('🚀 开始 Aria2 性能测试套件...\n')

  // 1. 连接测试
  console.log('1️⃣ 测试连接...')
  const connection = await testAria2Connection(config)

  if (!connection.success) {
    console.error('❌ 连接失败，无法继续 RPC 测试')
    return {
      connection,
      rpcTests: [],
    }
  }

  console.log(`✅ 连接成功 (延迟: ${connection.latency?.toFixed(2)}ms)\n`)

  // 2. RPC 调用测试
  console.log('2️⃣ 测试 RPC 调用性能...')
  const rpcMethods = ['tellActive', 'tellWaiting', 'tellStopped', 'getGlobalStat']
  const rpcTests: RpcTestResult[] = []

  for (const method of rpcMethods) {
    console.log(`  测试 ${method}...`)
    const result = await testRpcPerformance(config, method, 50)
    rpcTests.push(result)

    const p95Status = result.p95Latency < 100 ? '✅' : result.p95Latency < 300 ? '⚠️' : '❌'
    console.log(`    平均: ${result.avgLatency.toFixed(2)}ms, P95: ${result.p95Latency.toFixed(2)}ms ${p95Status}, 成功率: ${result.successRate.toFixed(1)}%`)
  }

  return {
    connection,
    rpcTests,
  }
}

/**
 * 生成性能测试报告
 */
export function generateAria2PerfReport(testResults: {
  connection: ConnectionTestResult
  rpcTests: RpcTestResult[]
}): string {
  let report = '# Aria2 性能测试报告\n\n'
  report += `测试时间: ${new Date().toLocaleString('zh-CN')}\n\n`

  // 连接测试
  report += '## 连接测试\n\n'
  if (testResults.connection.success) {
    report += `✅ 连接成功\n`
    report += `- 连接延迟: ${testResults.connection.latency?.toFixed(2)}ms\n\n`
  }
  else {
    report += `❌ 连接失败\n`
    report += `- 错误: ${testResults.connection.error}\n\n`
    return report
  }

  // RPC 测试
  report += '## RPC 调用性能\n\n'
  report += '| 方法 | 平均延迟 | P95 | 成功率 | 状态 |\n'
  report += '|------|----------|-----|--------|------|\n'

  for (const result of testResults.rpcTests) {
    const p95Status = result.p95Latency < 100 ? '✅' : result.p95Latency < 300 ? '⚠️' : '❌'
    report += `| ${result.method} | ${result.avgLatency.toFixed(2)}ms | ${result.p95Latency.toFixed(2)}ms | ${result.successRate.toFixed(1)}% | ${p95Status} |\n`
  }

  report += '\n## 性能标准\n\n'
  report += '- ✅ 优秀: P95 < 100ms\n'
  report += '- ⚠️ 一般: P95 < 300ms\n'
  report += '- ❌ 需优化: P95 ≥ 300ms\n\n'

  report += '## 优化建议\n\n'

  const slowTests = testResults.rpcTests.filter(t => t.p95Latency >= 300)
  if (slowTests.length > 0) {
    report += '发现性能问题:\n\n'
    for (const test of slowTests) {
      report += `- **${test.method}**: P95 延迟 ${test.p95Latency.toFixed(2)}ms\n`
      report += '  - 建议: 检查网络连接、Aria2 服务器负载、考虑使用连接池\n'
    }
  }
  else {
    report += '✅ 所有测试均符合性能标准\n'
  }

  return report
}

/**
 * 测试 WebSocket 重连性能
 */
export async function testWebSocketReconnect(config: Aria2Config): Promise<{
  reconnectTime: number
  success: boolean
}> {
  console.log('🔄 测试 WebSocket 重连...')

  // 此测试需要真实的 WebSocket 环境
  console.log('⚠️  WebSocket 重连测试需要集成测试环境')

  return {
    reconnectTime: 0,
    success: false,
  }
}
