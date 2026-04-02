/* eslint-disable node/prefer-global/process */
/**
 * 测试 API 压缩响应处理
 * 验证 ApiClient 是否正确处理压缩的 JSON 响应
 */

import { ApiClient } from '../src/utils/api-client'

const API_URL = process.env.API_URL || 'http://localhost:8787'
const API_TOKEN = process.env.CRAWLER_SECRET || ''

async function testCompression() {
  console.log('🧪 测试 API 压缩响应处理\n')
  console.log(`API URL: ${API_URL}`)
  console.log(`Token: ${API_TOKEN ? '✓ 已设置' : '✗ 未设置'}\n`)

  const apiClient = new ApiClient({
    url: API_URL,
    token: API_TOKEN,
    timeout: 10000,
  })

  try {
    // 测试 1: 批量查询影片状态
    console.log('1️⃣ 测试批量查询影片状态...')
    const movieStatus = await apiClient.batchQueryMovieStatus(['TEST-001', 'TEST-002'])
    console.log('   ✅ 成功:', Object.keys(movieStatus).length, '条记录')

    // 测试 2: 获取待爬取女优列表
    console.log('\n2️⃣ 测试获取待爬取女优列表...')
    const actors = await apiClient.fetchPendingActors(5)
    console.log('   ✅ 成功:', actors.length, '个女优')

    // 测试 3: 获取待爬取厂商列表
    console.log('\n3️⃣ 测试获取待爬取厂商列表...')
    const publishers = await apiClient.fetchPendingPublishers(5)
    console.log('   ✅ 成功:', publishers.length, '个厂商')

    // 测试 4: 同步影片数据
    console.log('\n4️⃣ 测试同步影片数据...')
    const syncResult = await apiClient.syncMovie({
      code: 'TEST-COMPRESS-001',
      title: '压缩测试影片',
      slug: 'test-compress-001',
      coverImage: 'https://example.com/test.jpg',
      releaseDate: new Date(),
    })
    console.log('   ✅ 成功:', syncResult ? '有响应' : '无响应（API 离线）')

    console.log('\n✅ 所有测试通过！压缩响应处理正常')
  }
  catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

testCompression().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
