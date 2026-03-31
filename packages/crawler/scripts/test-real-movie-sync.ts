/* eslint-disable node/prefer-global/process */
/**
 * 测试真实影片同步
 */

import 'dotenv/config'

const API_URL = process.env.API_URL || 'http://localhost:8787'
const API_TOKEN = process.env.CRAWLER_SECRET || ''

async function testRealMovieSync() {
  console.log('🧪 测试真实影片同步\n')

  // 模拟 JavBus 爬虫返回的 MovieInfo 格式
  const movieInfo = {
    title: 'TPI-227 わたしに向いている仕事って何だろう？-働く熟女の肉体労働-',
    code: 'TPI-227',
    coverImage: 'https://cdn.starye.org/movies/tpi-227/cover-preview.webp',
    releaseDate: 1743436800, // Unix timestamp
    duration: 120,
    genres: ['熟女', '巨乳'],
    publisher: 'SOD',
    actorDetails: [
      { name: '高星なぎさ', url: 'https://www.javbus.com/star/14fx' },
    ],
  }

  console.log('📤 发送同步请求（使用 syncMovie 格式）...')

  try {
    const response = await fetch(`${API_URL}/api/movies/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-token': API_TOKEN,
      },
      body: JSON.stringify({
        movies: [movieInfo],
        mode: 'upsert',
      }),
    })

    console.log(`\n📡 响应状态: ${response.status}`)
    const data = await response.json()
    console.log('📦 响应数据:', JSON.stringify(data, null, 2))

    if (response.ok) {
      console.log('\n✅ 同步成功')

      // 验证数据是否真的写入
      console.log('\n🔍 验证数据库...')
      const verifyResponse = await fetch(`${API_URL}/api/admin/movies?limit=5`, {
        headers: {
          'x-service-token': API_TOKEN,
        },
      })

      const verifyData = await verifyResponse.json()
      console.log('📦 数据库影片数:', verifyData.meta?.total || 0)

      if (verifyData.data && verifyData.data.length > 0) {
        console.log('\n最新影片:')
        verifyData.data.slice(0, 3).forEach((movie: any) => {
          console.log(`  - ${movie.code}: ${movie.title}`)
        })
      }
    }
    else {
      console.log('\n❌ 同步失败')
    }
  }
  catch (error) {
    console.error('\n❌ 请求失败:', error)
  }
}

testRealMovieSync().catch(console.error)
