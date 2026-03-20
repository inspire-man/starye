/**
 * 任务 13.10 自动化测试脚本
 * 测试 Dashboard 电影编辑页选择器相关 API
 */

const API_BASE = 'http://localhost:8787/api'

// 从 .dev.vars 文件中获取的测试 token
const ADMIN_TOKEN = process.env.CRAWLER_SECRET || 'test-secret'

interface TestResult {
  name: string
  passed: boolean
  message?: string
  data?: any
}

const results: TestResult[] = []

async function fetchApi(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-service-token': ADMIN_TOKEN,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || `Request failed with status ${res.status}`)
  }

  return res.json()
}

// 测试 1: 搜索女优
async function testSearchActors() {
  console.log('\n[测试 1] 搜索女优...')
  try {
    const data = await fetchApi('/admin/actors?search=明&limit=5')
    const passed = Array.isArray(data.data) && data.data.length > 0

    results.push({
      name: '搜索女优',
      passed,
      message: passed ? `找到 ${data.data.length} 个女优` : '搜索结果为空',
      data: data.data?.slice(0, 2),
    })

    if (passed) {
      console.log(`  ✅ 通过 - 找到 ${data.data.length} 个女优`)
      console.log(`  示例: ${data.data[0].name}`)
    }
    else {
      console.log('  ❌ 失败 - 搜索结果为空')
    }
  }
  catch (e) {
    console.error('  ❌ 失败 -', e)
    results.push({ name: '搜索女优', passed: false, message: String(e) })
  }
}

// 测试 2: 搜索厂商
async function testSearchPublishers() {
  console.log('\n[测试 2] 搜索厂商...')
  try {
    const data = await fetchApi('/admin/publishers?search=&limit=5')
    const passed = Array.isArray(data.data)

    results.push({
      name: '搜索厂商',
      passed,
      message: passed ? `找到 ${data.data.length} 个厂商` : '搜索失败',
      data: data.data?.slice(0, 2),
    })

    if (passed) {
      console.log(`  ✅ 通过 - 找到 ${data.data.length} 个厂商`)
      if (data.data.length > 0) {
        console.log(`  示例: ${data.data[0].name}`)
      }
    }
    else {
      console.log('  ❌ 失败 - 搜索失败')
    }
  }
  catch (e) {
    console.error('  ❌ 失败 -', e)
    results.push({ name: '搜索厂商', passed: false, message: String(e) })
  }
}

// 测试 3: 创建女优
async function testCreateActor() {
  console.log('\n[测试 3] 创建女优...')
  const testName = `测试女优_${Date.now()}`

  try {
    const data = await fetchApi('/admin/actors', {
      method: 'POST',
      body: JSON.stringify({ name: testName }),
    })

    const passed = data.id && data.name === testName

    results.push({
      name: '创建女优',
      passed,
      message: passed ? `成功创建: ${data.name} (${data.id})` : '创建失败',
      data,
    })

    if (passed) {
      console.log(`  ✅ 通过 - 成功创建: ${data.name}`)
      console.log(`  ID: ${data.id}`)
      return data
    }
    else {
      console.log('  ❌ 失败 - 创建失败')
    }
  }
  catch (e) {
    console.error('  ❌ 失败 -', e)
    results.push({ name: '创建女优', passed: false, message: String(e) })
  }

  return null
}

// 测试 4: 创建厂商
async function testCreatePublisher() {
  console.log('\n[测试 4] 创建厂商...')
  const testName = `测试厂商_${Date.now()}`

  try {
    const data = await fetchApi('/admin/publishers', {
      method: 'POST',
      body: JSON.stringify({ name: testName }),
    })

    const passed = data.id && data.name === testName

    results.push({
      name: '创建厂商',
      passed,
      message: passed ? `成功创建: ${data.name} (${data.id})` : '创建失败',
      data,
    })

    if (passed) {
      console.log(`  ✅ 通过 - 成功创建: ${data.name}`)
      console.log(`  ID: ${data.id}`)
      return data
    }
    else {
      console.log('  ❌ 失败 - 创建失败')
    }
  }
  catch (e) {
    console.error('  ❌ 失败 -', e)
    results.push({ name: '创建厂商', passed: false, message: String(e) })
  }

  return null
}

// 测试 5: 获取一部电影
async function testGetMovie() {
  console.log('\n[测试 5] 获取电影列表...')
  try {
    const data = await fetchApi('/admin/movies?limit=1')
    const passed = Array.isArray(data.data) && data.data.length > 0

    if (passed) {
      console.log(`  ✅ 通过 - 找到电影: ${data.data[0].title}`)
      console.log(`  ID: ${data.data[0].id}`)
      return data.data[0]
    }
    else {
      console.log('  ❌ 失败 - 没有电影数据')
    }
  }
  catch (e) {
    console.error('  ❌ 失败 -', e)
  }

  return null
}

// 测试 6: 更新电影女优关联
async function testUpdateMovieActors(movieId: string, actors: any[]) {
  console.log('\n[测试 6] 更新电影女优关联...')
  try {
    const data = await fetchApi(`/admin/movies/${movieId}/actors`, {
      method: 'PUT',
      body: JSON.stringify({
        actors: actors.map((actor, index) => ({
          id: actor.id,
          sortOrder: index,
        })),
      }),
    })

    const passed = data.success === true

    results.push({
      name: '更新电影女优关联',
      passed,
      message: passed ? `成功更新 ${actors.length} 个女优` : '更新失败',
    })

    if (passed) {
      console.log(`  ✅ 通过 - 成功更新 ${actors.length} 个女优`)
    }
    else {
      console.log('  ❌ 失败 - 更新失败')
    }
  }
  catch (e) {
    console.error('  ❌ 失败 -', e)
    results.push({ name: '更新电影女优关联', passed: false, message: String(e) })
  }
}

// 测试 7: 更新电影厂商关联
async function testUpdateMoviePublishers(movieId: string, publishers: any[]) {
  console.log('\n[测试 7] 更新电影厂商关联...')
  try {
    const data = await fetchApi(`/admin/movies/${movieId}/publishers`, {
      method: 'PUT',
      body: JSON.stringify({
        publishers: publishers.map((publisher, index) => ({
          id: publisher.id,
          sortOrder: index,
        })),
      }),
    })

    const passed = data.success === true

    results.push({
      name: '更新电影厂商关联',
      passed,
      message: passed ? `成功更新 ${publishers.length} 个厂商` : '更新失败',
    })

    if (passed) {
      console.log(`  ✅ 通过 - 成功更新 ${publishers.length} 个厂商`)
    }
    else {
      console.log('  ❌ 失败 - 更新失败')
    }
  }
  catch (e) {
    console.error('  ❌ 失败 -', e)
    results.push({ name: '更新电影厂商关联', passed: false, message: String(e) })
  }
}

// 主测试流程
async function runTests() {
  console.log('='.repeat(60))
  console.log('任务 13.10 自动化测试')
  console.log('='.repeat(60))
  console.log(`API 地址: ${API_BASE}`)
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}`)

  // 基础 API 测试
  await testSearchActors()
  await testSearchPublishers()

  // 创建测试
  const newActor = await testCreateActor()
  const newPublisher = await testCreatePublisher()

  // 关联更新测试
  const movie = await testGetMovie()
  if (movie && newActor) {
    await testUpdateMovieActors(movie.id, [newActor])
  }
  if (movie && newPublisher) {
    await testUpdateMoviePublishers(movie.id, [newPublisher])
  }

  // 打印测试结果
  console.log('\n' + '='.repeat(60))
  console.log('测试结果汇总')
  console.log('='.repeat(60))

  const passed = results.filter(r => r.passed).length
  const total = results.length

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.name}: ${result.message || ''}`)
  })

  console.log('\n' + '-'.repeat(60))
  console.log(`通过: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`)
  console.log('='.repeat(60))

  // 退出码
  process.exit(passed === total ? 0 : 1)
}

// 运行测试
runTests().catch((e) => {
  console.error('测试运行失败:', e)
  process.exit(1)
})
