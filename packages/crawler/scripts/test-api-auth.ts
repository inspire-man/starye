/**
 * API 认证测试脚本
 * 验证爬虫端口是否可以通过 x-service-token 认证
 */

import process from 'node:process'
import 'dotenv/config'

interface TestResult {
  endpoint: string
  method: string
  status: number
  success: boolean
  error?: string
}

async function testEndpoint(
  url: string,
  method: string,
  token: string,
): Promise<TestResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'x-service-token': token,
      },
      signal: AbortSignal.timeout(10000),
    })

    const success = response.ok
    let error: string | undefined

    if (!success) {
      try {
        const body: any = await response.json()
        error = body.error || body.message || `HTTP ${response.status}`
      }
      catch {
        error = `HTTP ${response.status}`
      }
    }

    return {
      endpoint: url,
      method,
      status: response.status,
      success,
      error,
    }
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      endpoint: url,
      method,
      status: 0,
      success: false,
      error: message,
    }
  }
}

async function main() {
  const apiUrl = process.env.API_URL || 'http://localhost:3000'
  const token = process.env.CRAWLER_SECRET

  if (!token) {
    console.error('❌ CRAWLER_SECRET 环境变量未设置')
    process.exit(1)
  }

  console.log('🧪 API 认证测试')
  console.log(`📡 API URL: ${apiUrl}`)
  console.log(`🔑 Token: ${token.substring(0, 8)}...`)
  console.log()

  // 测试端口列表
  const tests = [
    { url: `${apiUrl}/api/health`, method: 'GET', description: 'API 健康检查' },
    { url: `${apiUrl}/api/admin/actors/pending?limit=1`, method: 'GET', description: '女优待爬取列表' },
    { url: `${apiUrl}/api/admin/publishers/pending?limit=1`, method: 'GET', description: '厂商待爬取列表' },
    { url: `${apiUrl}/api/admin/actors/batch-status?ids=test-id`, method: 'GET', description: '女优批量状态查询' },
    { url: `${apiUrl}/api/admin/publishers/batch-status?ids=test-id`, method: 'GET', description: '厂商批量状态查询' },
  ]

  const results: TestResult[] = []

  for (const test of tests) {
    console.log(`📍 测试: ${test.description}`)
    console.log(`   ${test.method} ${test.url}`)

    const result = await testEndpoint(test.url, test.method, token)
    results.push(result)

    if (result.success) {
      console.log(`   ✅ 成功 (HTTP ${result.status})`)
    }
    else {
      console.log(`   ❌ 失败 (${result.error})`)
    }
    console.log()
  }

  // 统计结果
  const successCount = results.filter(r => r.success).length
  const totalCount = results.length
  const successRate = (successCount / totalCount) * 100

  console.log('============================================================')
  console.log('📊 测试结果汇总')
  console.log('============================================================')
  console.log(`总数: ${totalCount}`)
  console.log(`成功: ${successCount} ✅`)
  console.log(`失败: ${totalCount - successCount} ❌`)
  console.log(`成功率: ${successRate.toFixed(0)}%`)
  console.log('============================================================')
  console.log()

  // 失败详情
  const failed = results.filter(r => !r.success)
  if (failed.length > 0) {
    console.log('❌ 失败的端口:')
    for (const result of failed) {
      console.log(`   - ${result.endpoint}`)
      console.log(`     错误: ${result.error}`)
    }
    console.log()
    process.exit(1)
  }

  console.log('✅ 所有端口认证测试通过！')
  process.exit(0)
}

main()
