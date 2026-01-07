#!/usr/bin/env tsx

/**
 * 测试 API 连接和认证
 */
import process from 'node:process'
import got from 'got'
import 'dotenv/config'

async function testApiConnection() {
  const apiUrl = process.env.API_URL || 'http://localhost:8787'
  const token = process.env.CRAWLER_SECRET

  console.log('\n🔍 API 连接诊断工具\n')
  console.log('━'.repeat(50))

  // 1. 检查环境变量
  console.log('\n📋 环境变量检查:')
  console.log(`  API_URL: ${apiUrl}`)
  console.log(`  CRAWLER_SECRET: ${token ? `${token.substring(0, 20)}... (长度: ${token.length})` : '❌ 未设置'}`)

  if (!token) {
    console.error('\n❌ 错误: CRAWLER_SECRET 未设置')
    console.log('请在 .env 文件中设置 CRAWLER_SECRET')
    return
  }

  if (token.length < 8) {
    console.error('\n❌ 错误: CRAWLER_SECRET 太短（需要至少 8 个字符）')
    return
  }

  // 2. 测试健康检查
  console.log('\n🏥 测试健康检查...')
  try {
    const healthResponse = await got.get(`${apiUrl}/`).json<any>()
    console.log('  ✅ 健康检查成功:', healthResponse)
  }
  catch (e: any) {
    console.error('  ❌ 健康检查失败:', e.message)
    return
  }

  // 3. 测试认证
  console.log('\n🔐 测试认证...')
  try {
    const testData = {
      type: 'manga',
      data: {
        title: '测试漫画',
        slug: 'test-manga',
        chapters: [
          {
            title: '第1话',
            slug: 'chapter-1',
            url: 'https://example.com/chapter-1',
            number: 1,
          },
        ],
      },
    }

    const response = await got.post(`${apiUrl}/api/admin/sync`, {
      json: testData,
      headers: {
        'x-service-token': token,
      },
    }).json<any>()

    console.log('  ✅ 认证成功!')
    console.log('  📊 响应:', response)
  }
  catch (e: any) {
    console.error('  ❌ 认证失败:')
    if (e.response) {
      console.error(`     状态码: ${e.response.statusCode}`)
      console.error(`     响应体:`, e.response.body)
    }
    else {
      console.error(`     错误: ${e.message}`)
    }
    return
  }

  console.log('\n━'.repeat(50))
  console.log('✅ 所有测试通过! API 连接正常。\n')
}

testApiConnection().catch(console.error)
