import type { Database } from '@starye/db'
import { getDecryptedAria2Config } from './aria2-config.service'

// Aria2 JSON-RPC 请求格式
export interface Aria2RpcRequest {
  jsonrpc: '2.0'
  method: string
  id: string | number
  params?: unknown[]
}

// Aria2 JSON-RPC 响应格式
export interface Aria2RpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: {
    code: number
    message: string
  }
}

// 代理 Aria2 RPC 请求
export async function proxyAria2Request(options: {
  db: Database
  userId: string
  method: string
  params?: unknown[]
}): Promise<Aria2RpcResponse> {
  const { db, userId, method, params = [] } = options

  // 获取用户的解密配置
  const config = await getDecryptedAria2Config({ db, userId })

  if (!config) {
    throw new Error('未配置 Aria2 连接')
  }

  // 构建 JSON-RPC 请求
  const requestBody: Aria2RpcRequest = {
    jsonrpc: '2.0',
    method,
    id: Date.now(),
    params: config.secret ? [`token:${config.secret}`, ...params] : params,
  }

  try {
    // 发送请求到 Aria2 RPC 服务
    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000), // 10 秒超时
    })

    if (!response.ok) {
      throw new Error(`Aria2 RPC 请求失败: ${response.status} ${response.statusText}`)
    }

    const data: Aria2RpcResponse = await response.json()

    if (data.error) {
      throw new Error(`Aria2 错误: ${data.error.message} (代码: ${data.error.code})`)
    }

    return data
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        throw new Error('Aria2 RPC 请求超时')
      }
      throw error
    }
    throw new Error('Aria2 RPC 请求失败')
  }
}
