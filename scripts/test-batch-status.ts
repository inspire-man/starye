/**
 * 测试脚本：验证 batch-status API
 *
 * 用法:
 * API_URL=https://starye.org CRAWLER_SECRET=your-secret tsx scripts/test-batch-status.ts
 */

import process from 'node:process'

const API_URL = process.env.API_URL || 'http://localhost:8787'
const CRAWLER_SECRET = process.env.CRAWLER_SECRET

if (!CRAWLER_SECRET) {
  console.error('❌ 缺少 CRAWLER_SECRET 环境变量')
  process.exit(1)
}

async function testBatchStatus() {
  console.log('🧪 测试 batch-status API')
  console.log(`📍 API URL: ${API_URL}`)
  console.log(`🔑 Token: ${CRAWLER_SECRET.substring(0, 10)}...`)
  console.log()

  // 测试 1: 不带 token
  console.log('测试 1: 不带 token (应该返回 401)')
  try {
    const res1 = await fetch(`${API_URL}/api/admin/movies/batch-status?codes=TEST-001`)
    console.log(`  状态码: ${res1.status}`)
    if (res1.status !== 401) {
      console.error('  ❌ 预期返回 401，实际返回', res1.status)
    }
    else {
      console.log('  ✅ 正确返回 401')
    }
  }
  catch (error) {
    console.error('  ❌ 请求失败:', error)
  }
  console.log()

  // 测试 2: 带正确 token
  console.log('测试 2: 带正确 token (应该返回 200)')
  try {
    const res2 = await fetch(`${API_URL}/api/admin/movies/batch-status?codes=TEST-001,TEST-002`, {
      headers: {
        'x-service-token': CRAWLER_SECRET,
      },
    })
    console.log(`  状态码: ${res2.status}`)

    if (res2.status === 200) {
      const data = await res2.json()
      console.log('  ✅ 成功返回 200')
      console.log('  响应数据:', JSON.stringify(data, null, 2))
    }
    else {
      console.error('  ❌ 预期返回 200，实际返回', res2.status)
      const text = await res2.text()
      console.error('  响应内容:', text)
    }
  }
  catch (error) {
    console.error('  ❌ 请求失败:', error)
  }
  console.log()

  // 测试 3: 不带 codes 参数
  console.log('测试 3: 不带 codes 参数 (应该返回 400)')
  try {
    const res3 = await fetch(`${API_URL}/api/admin/movies/batch-status`, {
      headers: {
        'x-service-token': CRAWLER_SECRET,
      },
    })
    console.log(`  状态码: ${res3.status}`)
    if (res3.status !== 400) {
      console.error('  ❌ 预期返回 400，实际返回', res3.status)
    }
    else {
      console.log('  ✅ 正确返回 400')
    }
  }
  catch (error) {
    console.error('  ❌ 请求失败:', error)
  }
  console.log()

  // 测试 4: 使用爬虫相同的方式调用
  console.log('测试 4: 模拟爬虫调用方式')
  try {
    const testCodes = ['ABC-123', 'XYZ-456', 'DEF-789']
    const url = `${API_URL}/api/admin/movies/batch-status?codes=${testCodes.join(',')}`

    console.log(`  请求 URL: ${url}`)
    console.log(`  请求头: x-service-token: ${CRAWLER_SECRET.substring(0, 10)}...`)

    const res4 = await fetch(url, {
      method: 'GET',
      headers: {
        'x-service-token': CRAWLER_SECRET,
      },
      signal: AbortSignal.timeout(30000),
    })

    console.log(`  状态码: ${res4.status}`)

    if (res4.status === 200) {
      const data = await res4.json()
      console.log('  ✅ 成功')
      console.log('  响应数据:', JSON.stringify(data, null, 2))

      // 验证响应格式
      for (const code of testCodes) {
        if (!data[code]) {
          console.error(`  ❌ 缺少 ${code} 的状态信息`)
        }
        else if (typeof data[code].exists !== 'boolean') {
          console.error(`  ❌ ${code} 的 exists 字段类型错误`)
        }
      }
    }
    else {
      console.error('  ❌ 请求失败，状态码:', res4.status)
      try {
        const errorData = await res4.json()
        console.error('  错误信息:', errorData)
      }
      catch {
        const errorText = await res4.text()
        console.error('  错误内容:', errorText)
      }
    }
  }
  catch (error) {
    console.error('  ❌ 请求失败:', error)
  }

  console.log()
  console.log('🎉 测试完成')
}

testBatchStatus().catch(console.error)
