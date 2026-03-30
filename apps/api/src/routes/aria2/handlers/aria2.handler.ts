import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { getUserAria2Config, saveAria2Config } from '../services/aria2-config.service'
import { proxyAria2Request } from '../services/aria2-proxy.service'

// 获取 Aria2 配置
export async function getAria2Config(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')

  // 验证登录
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: '请先登录' })
  }

  const config = await getUserAria2Config({
    db,
    userId: session.user.id,
  })

  return c.json({
    code: 0,
    data: config || null,
  })
}

// 更新 Aria2 配置
export async function updateAria2Config(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')

  // 验证登录
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: '请先登录' })
  }

  const body = await c.req.json()
  const { rpcUrl, secret, useProxy } = body

  if (!rpcUrl) {
    throw new HTTPException(400, { message: '缺少 RPC URL' })
  }

  try {
    const config = await saveAria2Config({
      db,
      userId: session.user.id,
      rpcUrl,
      secret,
      useProxy,
    })

    return c.json({
      code: 0,
      message: '配置已保存',
      data: config,
    })
  }
  catch (error) {
    if (error instanceof Error) {
      throw new HTTPException(400, { message: error.message })
    }
    throw error
  }
}

// Aria2 RPC 代理
export async function proxyAria2Rpc(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')

  // 验证登录
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: '请先登录' })
  }

  const body = await c.req.json()
  const { method, params } = body

  if (!method) {
    throw new HTTPException(400, { message: '缺少 RPC 方法名' })
  }

  try {
    const response = await proxyAria2Request({
      db,
      userId: session.user.id,
      method,
      params,
    })

    return c.json({
      code: 0,
      data: response,
    })
  }
  catch (error) {
    if (error instanceof Error) {
      throw new HTTPException(500, { message: error.message })
    }
    throw error
  }
}
