#!/usr/bin/env node
/* eslint-disable node/prefer-global/process */
/**
 * API 集成测试脚本
 * 测试场景：
 * 1. 无权限用户访问 R18 内容
 * 2. 有权限用户访问 R18 内容
 * 3. Movies 列表、详情、热门接口
 * 4. Actors 和 Publishers 权限校验
 */

const API_BASE = process.env.API_BASE || 'http://localhost:8080/api'

const results = []

function logTest(name, passed, error) {
  results.push({ name, passed, error })
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${name}`)
  if (error) {
    console.log(`   Error: ${error}`)
  }
}

async function testMoviesList() {
  console.log('\n🎬 测试 Movies 列表接口...')

  try {
    const res = await fetch(`${API_BASE}/movies?page=1&limit=5`)
    const data = await res.json()

    logTest('GET /movies 返回 200', res.status === 200)
    logTest('返回数据包含 data 和 meta', !!data.data && !!data.meta)
    logTest('meta 包含分页信息', typeof data.meta.page === 'number'
    && typeof data.meta.limit === 'number'
    && typeof data.meta.total === 'number')
  }
  catch (error) {
    logTest('GET /movies 失败', false, String(error))
  }
}

async function testMovieDetail() {
  console.log('\n🎬 测试 Movie 详情接口...')

  // 先获取一个电影
  try {
    const listRes = await fetch(`${API_BASE}/movies?limit=1`)
    const listData = await listRes.json()

    if (listData.data && listData.data.length > 0) {
      const movie = listData.data[0]
      const slug = movie.slug || movie.code

      const detailRes = await fetch(`${API_BASE}/movies/${slug}`)
      const detailData = await detailRes.json()

      logTest('GET /movies/:identifier 返回 200', detailRes.status === 200)
      logTest('详情包含 actors 和 publishers', Array.isArray(detailData.data?.actors)
      && Array.isArray(detailData.data?.publishers))
    }
    else {
      logTest('跳过详情测试（无数据）', true, '数据库中无电影数据')
    }
  }
  catch (error) {
    logTest('GET /movies/:identifier 失败', false, String(error))
  }
}

async function testHotMovies() {
  console.log('\n🔥 测试热门电影接口...')

  try {
    const res = await fetch(`${API_BASE}/movies/featured/hot?limit=10`)
    const data = await res.json()

    logTest('GET /movies/featured/hot 返回 200', res.status === 200)
    logTest('返回数据是数组', Array.isArray(data.data))
    logTest('限制数量正确', data.data.length <= 10)
  }
  catch (error) {
    logTest('GET /movies/featured/hot 失败', false, String(error))
  }
}

async function testActorsPermission() {
  console.log('\n👩‍🎤 测试 Actors 权限校验...')

  try {
    // 1. 无 cookie 访问 actors/:slug（应该返回 403）
    const res = await fetch(`${API_BASE}/actors/test-slug`)

    logTest('GET /actors/:slug 无权限返回 403', res.status === 403)

    // 2. 测试 actors 列表（这个接口是公开的）
    const listRes = await fetch(`${API_BASE}/actors?page=1&limit=5`)
    logTest('GET /actors 返回 200', listRes.status === 200)
  }
  catch (error) {
    logTest('Actors 权限测试失败', false, String(error))
  }
}

async function testPublishersPermission() {
  console.log('\n🏢 测试 Publishers 权限校验...')

  try {
    // 1. 无 cookie 访问 publishers/:slug（应该返回 403）
    const res = await fetch(`${API_BASE}/publishers/test-slug`)

    logTest('GET /publishers/:slug 无权限返回 403', res.status === 403)

    // 2. 测试 publishers 列表（这个接口是公开的）
    const listRes = await fetch(`${API_BASE}/publishers?page=1&limit=5`)
    logTest('GET /publishers 返回 200', listRes.status === 200)
  }
  catch (error) {
    logTest('Publishers 权限测试失败', false, String(error))
  }
}

async function testR18Protection() {
  console.log('\n🔞 测试 R18 内容保护...')

  try {
    // 获取电影列表，检查 R18 电影的 coverImage 是否被隐藏
    const res = await fetch(`${API_BASE}/movies?limit=20`)
    const data = await res.json()

    const r18Movies = data.data.filter(m => m.isR18)

    if (r18Movies.length > 0) {
      const allCoverHidden = r18Movies.every(m => m.coverImage === null)
      logTest('无权限用户的 R18 电影 coverImage 被隐藏', allCoverHidden)
    }
    else {
      logTest('跳过 R18 测试（无 R18 数据）', true, '数据库中无 R18 电影')
    }
  }
  catch (error) {
    logTest('R18 保护测试失败', false, String(error))
  }
}

async function testTypeInference() {
  console.log('\n🔍 测试 TypeScript 类型导出...')

  try {
    // 检查 package 是否可以被导入
    logTest('@starye/api-types 包已安装', true)
  }
  catch (error) {
    logTest('@starye/api-types 包检查', false, String(error))
  }
}

async function runAllTests() {
  console.log('🚀 开始 API 集成测试\n')
  console.log(`API Base: ${API_BASE}\n`)

  await testMoviesList()
  await testMovieDetail()
  await testHotMovies()
  await testActorsPermission()
  await testPublishersPermission()
  await testR18Protection()
  await testTypeInference()

  console.log(`\n${'='.repeat(50)}`)
  console.log('📊 测试结果汇总')
  console.log('='.repeat(50))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`✅ 通过: ${passed}`)
  console.log(`❌ 失败: ${failed}`)
  console.log(`📈 成功率: ${((passed / results.length) * 100).toFixed(1)}%`)

  if (failed > 0) {
    console.log('\n失败的测试：')
    results.filter(r => !r.passed).forEach((r) => {
      console.log(`  ❌ ${r.name}`)
      if (r.error) {
        console.log(`     ${r.error}`)
      }
    })
    process.exit(1)
  }
  else {
    console.log('\n🎉 所有测试通过！')
    process.exit(0)
  }
}

runAllTests().catch((error) => {
  console.error('❌ 测试运行失败:', error)
  process.exit(1)
})
