/* eslint-disable node/prefer-global/process */
/**
 * API Integration Test Script
 * 测试 Aria2 和评分系统的 API 端点
 *
 * 运行方式:
 * 1. 启动 API 服务: pnpm --filter api run dev
 * 2. 运行测试: tsx scripts/test-api-integration.ts
 */

const API_BASE_URL = 'http://localhost:8788'

// 测试统计
let passCount = 0
let failCount = 0

// 测试辅助函数
async function testEndpoint(
  name: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: {
    body?: unknown
    headers?: Record<string, string>
    expectStatus?: number
    expectJson?: boolean
  },
) {
  const url = `${API_BASE_URL}${path}`
  console.log(`\n测试: ${name}`)
  console.log(`  请求: ${method} ${path}`)

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    }

    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body)
    }

    const response = await fetch(url, fetchOptions)
    const status = response.status
    const expectedStatus = options?.expectStatus ?? 200

    // 检查状态码
    if (status !== expectedStatus) {
      console.log(`  [✗] 失败: 期望状态码 ${expectedStatus}, 实际 ${status}`)
      failCount++
      return
    }

    // 检查响应类型
    if (options?.expectJson !== false) {
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        console.log(`  [✗] 失败: 期望 JSON 响应, 实际 ${contentType}`)
        failCount++
        return
      }

      const data = await response.json()
      console.log(`  响应:`, `${JSON.stringify(data).substring(0, 100)}...`)
    }

    console.log(`  [✓] 通过 (${status})`)
    passCount++
  }
  catch (error) {
    console.log(`  [✗] 失败: ${error instanceof Error ? error.message : String(error)}`)
    failCount++
  }
}

// 主测试函数
async function runTestsApi() {
  console.log('=== API Integration Tests ===\n')

  // 检查 API 服务是否运行
  console.log('检查 API 服务...')
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`)
    if (!response.ok) {
      throw new Error(`API 服务响应异常: ${response.status}`)
    }
    console.log('[✓] API 服务运行正常\n')
  }
  catch (error) {
    console.error('[✗] API 服务未运行，请先启动: pnpm --filter api run dev')
    console.error(`错误: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  // ============================================
  // 评分 API 测试
  // ============================================
  console.log('\n--- 评分 API 测试 ---')

  // 获取播放源评分（应该返回 401 未授权，因为需要登录）
  await testEndpoint(
    '获取播放源评分（未登录）',
    'GET',
    '/api/ratings/player/test-player-id',
    { expectStatus: 401 },
  )

  // ============================================
  // Aria2 配置 API 测试
  // ============================================
  console.log('\n--- Aria2 配置 API 测试 ---')

  // 获取 Aria2 配置（应该返回 401 未授权）
  await testEndpoint(
    '获取 Aria2 配置（未登录）',
    'GET',
    '/api/aria2/config',
    { expectStatus: 401 },
  )

  // ============================================
  // 电影 API 测试（验证评分信息集成）
  // ============================================
  console.log('\n--- 电影 API 测试 ---')

  // 获取电影列表
  await testEndpoint(
    '获取电影列表',
    'GET',
    '/api/movies?page=1&limit=10',
  )

  // ============================================
  // 测试总结
  // ============================================
  console.log('\n=== 测试总结 ===')
  console.log(`通过: ${passCount}`)
  console.log(`失败: ${failCount}`)
  console.log(`总计: ${passCount + failCount}`)

  if (failCount > 0) {
    console.log('\n❌ 存在失败的测试')
    process.exit(1)
  }
  else {
    console.log('\n✅ 所有测试通过！')
    process.exit(0)
  }
}

// 运行测试
runTestsApi().catch((error) => {
  console.error('测试执行失败:', error)
  process.exit(1)
})
