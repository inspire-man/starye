/* eslint-disable node/prefer-global/process */
import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'
/**
 * 测试真实的压缩响应处理
 */
import { ApiClient } from '../src/utils/api-client'

async function startCompressedServer() {
  const server = createServer((req, res) => {
    console.log(`\n📥 收到请求: ${req.url}`)
    console.log(`   Accept-Encoding: ${req.headers['accept-encoding']}`)

    // 模拟返回女优列表
    const responseData = {
      actors: [
        { id: '1', name: '测试女优1' },
        { id: '2', name: '测试女优2' },
      ],
    }

    const jsonData = JSON.stringify(responseData)

    // 压缩响应
    const compressed = gzipSync(jsonData)

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
    })
    res.end(compressed)

    console.log(`   ✅ 返回压缩响应 (${compressed.length} bytes, 原始: ${jsonData.length} bytes)`)
  })

  return new Promise<typeof server>((resolve) => {
    server.listen(38788, () => {
      console.log('🚀 压缩测试服务器运行在 http://localhost:38788')
      resolve(server)
    })
  })
}

async function test() {
  const server = await startCompressedServer()

  try {
    const apiClient = new ApiClient({
      url: 'http://localhost:38788',
      token: 'test-token',
      timeout: 5000,
    })

    console.log('\n🧪 测试压缩响应处理...\n')

    // 测试 fetchPendingActors
    const actors = await apiClient.fetchPendingActors(10)

    console.log(`\n✅ 测试成功！`)
    console.log(`   获取到 ${actors.length} 个女优`)
    console.log(`   数据:`, actors)

    console.log(`\n🎉 压缩响应处理完全正常！`)
  }
  catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
  finally {
    server.close()
  }
}

test().catch(console.error)
