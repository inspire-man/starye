/* eslint-disable node/prefer-global/process */
/**
 * 直接测试 fetchPendingActors 方法
 */
import { ApiClient } from '../src/utils/api-client'

async function test() {
  console.log('🧪 测试 fetchPendingActors\n')

  const apiClient = new ApiClient({
    url: process.env.API_URL || 'http://localhost:8787',
    token: process.env.CRAWLER_SECRET || '',
    timeout: 10000,
  })

  console.log('API URL:', process.env.API_URL || 'http://localhost:8787')
  console.log('Token:', process.env.CRAWLER_SECRET ? '已设置' : '未设置')

  try {
    console.log('\n📡 调用 fetchPendingActors(5)...')
    const actors = await apiClient.fetchPendingActors(5)
    console.log('✅ 成功获取:', actors.length, '个女优')
    if (actors.length > 0) {
      console.log('第一个:', actors[0])
    }
  }
  catch (error) {
    console.error('❌ 失败:', error)
  }
}

test().catch(console.error)
