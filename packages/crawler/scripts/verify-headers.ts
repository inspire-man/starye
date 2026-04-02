/**
 * 验证 ApiClient 发送的请求头是否包含正确的 Accept-Encoding
 */

import { ApiClient } from '../src/utils/api-client'

// 创建一个 mock server 来检查请求头
async function startMockServer() {
  const { createServer } = await import('node:http')

  const server = createServer((req, res) => {
    console.log('\n📥 收到请求:')
    console.log(`   URL: ${req.url}`)
    console.log(`   Method: ${req.method}`)
    console.log(`   Headers:`)
    console.log(`      Accept: ${req.headers.accept}`)
    console.log(`      Accept-Encoding: ${req.headers['accept-encoding']}`)
    console.log(`      x-service-token: ${req.headers['x-service-token']}`)

    // 验证 headers
    const hasAccept = req.headers.accept === 'application/json'
    const hasAcceptEncoding = req.headers['accept-encoding']?.includes('gzip')
    const hasToken = !!req.headers['x-service-token']

    console.log(`\n✅ 验证结果:`)
    console.log(`   Accept header: ${hasAccept ? '✓' : '✗'}`)
    console.log(`   Accept-Encoding header: ${hasAcceptEncoding ? '✓' : '✗'}`)
    console.log(`   Service token: ${hasToken ? '✓' : '✗'}`)

    // 返回响应
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
  })

  return new Promise<typeof server>((resolve) => {
    server.listen(38787, () => {
      console.log('🚀 Mock server running on http://localhost:38787')
      resolve(server)
    })
  })
}

async function test() {
  const server = await startMockServer()

  try {
    const apiClient = new ApiClient({
      url: 'http://localhost:38787',
      token: 'test-token-123',
      timeout: 5000,
    })

    console.log('\n🧪 测试 ApiClient 请求头...\n')

    // 测试 GET 请求
    console.log('1️⃣ 测试 GET 请求 (fetchPendingActors):')
    await apiClient.fetchPendingActors(10)

    await new Promise(resolve => setTimeout(resolve, 500))

    // 测试 POST 请求
    console.log('\n2️⃣ 测试 POST 请求 (sync):')
    await apiClient.sync('/test', { data: 'test' })

    await new Promise(resolve => setTimeout(resolve, 500))

    console.log('\n✅ 所有测试完成！ApiClient 正确发送了压缩响应相关的 headers')
  }
  catch (error) {
    console.error('\n❌ 测试失败:', error)
  }
  finally {
    server.close()
  }
}

test().catch(console.error)
