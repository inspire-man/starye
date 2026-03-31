/* eslint-disable node/prefer-global/process */
/**
 * 测试影片同步接口
 */

import 'dotenv/config'

const API_URL = process.env.API_URL || 'http://localhost:8787'
const API_TOKEN = process.env.CRAWLER_SECRET || ''

async function testMovieSync() {
  console.log('🧪 测试影片同步接口\n')

  const testMovie = {
    code: 'TEST-001',
    title: '测试影片',
    coverImage: 'https://example.com/cover.jpg',
    releaseDate: new Date().toISOString(),
    duration: 120,
    description: '这是一个测试影片',
    genres: ['测试', '验证'],
    actors: ['测试女优'],
    publisher: '测试厂商',
    isR18: true,
  }

  console.log('📤 发送同步请求...')
  console.log(JSON.stringify({ movies: [testMovie] }, null, 2))

  try {
    const response = await fetch(`${API_URL}/api/movies/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-token': API_TOKEN,
      },
      body: JSON.stringify({
        movies: [testMovie],
        mode: 'upsert',
      }),
    })

    console.log(`\n📡 响应状态: ${response.status}`)
    const data = await response.json()
    console.log('📦 响应数据:', JSON.stringify(data, null, 2))

    if (response.ok) {
      console.log('\n✅ 同步成功')
    }
    else {
      console.log('\n❌ 同步失败')
    }
  }
  catch (error) {
    console.error('\n❌ 请求失败:', error)
  }
}

testMovieSync().catch(console.error)
