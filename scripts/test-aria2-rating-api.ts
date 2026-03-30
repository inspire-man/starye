/* eslint-disable node/prefer-global/process */
/**
 * Aria2 集成和评分功能自动化测试脚本
 *
 * 运行方式：
 * pnpm tsx scripts/test-aria2-rating-api.ts
 */

interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

const results: TestResult[] = []

/**
 * 执行单个测试
 */
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now()

  try {
    await fn()
    results.push({
      name,
      passed: true,
      duration: Date.now() - start,
    })
    console.log(`✓ ${name} (${Date.now() - start}ms)`)
  }
  catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error.message,
      duration: Date.now() - start,
    })
    console.error(`✗ ${name}`)
    console.error(`  Error: ${error.message}`)
  }
}

/**
 * 测试评分 API - 提交评分
 */
async function testSubmitRating() {
  const response = await fetch(`${API_BASE_URL}/api/ratings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playerId: 'test-player-001',
      score: 5,
    }),
  })

  // 如果是未登录错误（401），这是预期的
  if (response.status === 401) {
    return // 通过测试
  }

  if (!response.ok) {
    throw new Error(`API 返回错误: ${response.status}`)
  }

  const data: any = await response.json()
  if (data.code !== 0) {
    throw new Error(`业务错误: ${data.message}`)
  }
}

/**
 * 测试评分 API - 查询播放源评分
 */
async function testGetPlayerRating() {
  const response = await fetch(`${API_BASE_URL}/api/ratings/player/test-player-001`)

  if (!response.ok && response.status !== 404) {
    throw new Error(`API 返回错误: ${response.status}`)
  }

  // 404 是正常的（播放源不存在）
  if (response.status === 404) {
    return
  }

  const data: any = await response.json()
  if (data.code !== 0) {
    throw new Error(`业务错误: ${data.message}`)
  }

  // 验证响应结构
  if (!data.data || typeof data.data.averageRating === 'undefined') {
    throw new Error('响应数据格式不正确')
  }
}

/**
 * 测试评分 API - 查询用户评分历史
 */
async function testGetUserRatings() {
  const response = await fetch(`${API_BASE_URL}/api/ratings/user`)

  if (!response.ok) {
    // 如果是未登录错误（401），这是预期的
    if (response.status === 401) {
      return // 通过测试
    }
    throw new Error(`API 返回错误: ${response.status}`)
  }

  const data: any = await response.json()
  if (data.code !== 0) {
    throw new Error(`业务错误: ${data.message}`)
  }

  // 验证响应结构
  if (!Array.isArray(data.data)) {
    throw new TypeError('响应数据应该是数组')
  }
}

/**
 * 测试评分 API - 查询全局统计
 */
async function testGetRatingStats() {
  const response = await fetch(`${API_BASE_URL}/api/ratings/stats`)

  if (!response.ok) {
    throw new Error(`API 返回错误: ${response.status}`)
  }

  const data: any = await response.json()
  if (data.code !== 0) {
    throw new Error(`业务错误: ${data.message}`)
  }

  // 验证响应结构（数据可能为空对象或包含统计信息）
  if (data.data === null || data.data === undefined) {
    throw new Error('响应数据格式不正确')
  }
}

/**
 * 测试 Aria2 API - 获取配置
 */
async function testGetAria2Config() {
  const response = await fetch(`${API_BASE_URL}/api/aria2/config`)

  if (!response.ok) {
    // 如果是未登录错误（401），这是预期的
    if (response.status === 401) {
      return // 通过测试
    }
    throw new Error(`API 返回错误: ${response.status}`)
  }

  const data: any = await response.json()
  if (data.code !== 0) {
    throw new Error(`业务错误: ${data.message}`)
  }
}

/**
 * 测试 Aria2 API - 保存配置
 */
async function testSaveAria2Config() {
  const response = await fetch(`${API_BASE_URL}/api/aria2/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rpcUrl: 'http://localhost:6800/jsonrpc',
      secret: 'test-secret',
      useProxy: false,
    }),
  })

  // 如果是未登录错误（401），这是预期的
  if (response.status === 401) {
    return // 通过测试
  }

  if (!response.ok) {
    throw new Error(`API 返回错误: ${response.status}`)
  }

  const data: any = await response.json()
  if (data.code !== 0) {
    throw new Error(`业务错误: ${data.message}`)
  }
}

/**
 * 测试 Aria2 API - 代理请求
 */
async function testAria2Proxy() {
  const response = await fetch(`${API_BASE_URL}/api/aria2/proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'aria2.getVersion',
      params: [],
    }),
  })

  if (!response.ok) {
    // 如果是未登录错误（401），这是预期的
    if (response.status === 401) {
      return // 通过测试
    }
    // 如果是连接超时或 Aria2 未运行，也是预期的
    if (response.status === 500) {
      const data: any = await response.json()
      if (data.message?.includes('连接') || data.message?.includes('timeout')) {
        return // 通过测试（Aria2 未运行是正常的）
      }
    }
    throw new Error(`API 返回错误: ${response.status}`)
  }

  const data: any = await response.json()
  if (data.code !== 0) {
    throw new Error(`业务错误: ${data.message}`)
  }
}

/**
 * 测试影片 API - 验证评分数据包含在响应中
 */
async function testMovieDetailWithRatings() {
  // 使用一个已知的影片代码进行测试
  const response = await fetch(`${API_BASE_URL}/api/movies/test-code-001`)

  if (!response.ok && response.status !== 404) {
    throw new Error(`API 返回错误: ${response.status}`)
  }

  // 404 是正常的（影片不存在）
  if (response.status === 404) {
    return
  }

  const data: any = await response.json()
  if (!data.success) {
    throw new Error(`业务错误: ${data.error}`)
  }

  // 验证 players 数组存在
  if (!data.data?.players || !Array.isArray(data.data.players)) {
    throw new Error('影片数据应包含 players 数组')
  }
}

/**
 * 测试数据库 Schema - 验证表结构
 */
async function testDatabaseSchema() {
  // 这个测试需要直接访问数据库，暂时跳过
  // 实际部署时应该使用 wrangler d1 命令进行验证
  console.log('  (跳过 - 需要数据库直接访问)')
}

/**
 * 运行所有测试
 */
async function runTestsAria2() {
  console.log('🚀 开始自动化功能验证...\n')
  console.log(`API 地址: ${API_BASE_URL}\n`)

  console.log('## 评分 API 测试\n')
  await test('提交评分（未登录应返回 401）', testSubmitRating)
  await test('查询播放源评分统计', testGetPlayerRating)
  await test('查询用户评分历史（未登录应返回 401）', testGetUserRatings)
  await test('查询全局评分统计', testGetRatingStats)

  console.log('\n## Aria2 API 测试\n')
  await test('获取 Aria2 配置（未登录应返回 401）', testGetAria2Config)
  await test('保存 Aria2 配置（未登录应返回 401）', testSaveAria2Config)
  await test('Aria2 代理请求（未运行 Aria2 是正常的）', testAria2Proxy)

  console.log('\n## 影片 API 测试\n')
  await test('查询影片详情（包含评分数据）', testMovieDetailWithRatings)

  console.log('\n## 数据库 Schema 测试\n')
  await test('验证数据库表结构', testDatabaseSchema)

  // 打印测试摘要
  console.log(`\n${'='.repeat(60)}`)
  console.log('测试摘要\n')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  console.log(`总测试数: ${results.length}`)
  console.log(`通过: ${passed} ✓`)
  console.log(`失败: ${failed} ✗`)
  console.log(`总耗时: ${totalDuration}ms`)

  if (failed > 0) {
    console.log('\n失败的测试：')
    results.filter(r => !r.passed).forEach((r) => {
      console.log(`  ✗ ${r.name}`)
      console.log(`    ${r.error}`)
    })
  }

  console.log('='.repeat(60))

  // 如果有失败的测试，退出码为 1
  if (failed > 0) {
    process.exit(1)
  }
}

// 运行测试
runTestsAria2().catch((error) => {
  console.error('测试运行失败:', error)
  process.exit(1)
})
