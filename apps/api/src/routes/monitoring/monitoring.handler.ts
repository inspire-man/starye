/**
 * 监控处理器
 *
 * 处理前端发送的错误和性能日志
 */

import type { Context } from 'hono'
import type { AppEnv } from '../../types'
import { HTTPException } from 'hono/http-exception'

interface ErrorLogRequest {
  timestamp: number
  message: string
  stack?: string
  context?: Record<string, any>
  userAgent: string
  url: string
}

interface PerformanceLogRequest {
  timestamp: number
  operation: string
  duration: number
  success: boolean
  context?: Record<string, any>
}

/**
 * 接收客户端错误日志
 */
export async function logClientError(c: Context<AppEnv>) {
  const body = await c.req.json<ErrorLogRequest>()

  // 验证必需字段
  if (!body.message || !body.timestamp) {
    throw new HTTPException(400, { message: '缺少必需参数' })
  }

  try {
    // 输出到服务器日志
    console.error('🔴 客户端错误', {
      message: body.message,
      url: body.url,
      userAgent: body.userAgent,
      timestamp: new Date(body.timestamp).toISOString(),
      stack: body.stack?.substring(0, 200),
    })

    // 可选：保存到 D1 数据库或日志服务
    // const db = c.get('db')
    // await db.insert(errorLogs).values({
    //   id: crypto.randomUUID(),
    //   message: body.message,
    //   stack: body.stack,
    //   context: JSON.stringify(body.context),
    //   userAgent: body.userAgent,
    //   url: body.url,
    //   createdAt: new Date(body.timestamp).toISOString(),
    // })

    return c.json({
      code: 0,
      message: '错误已记录',
    })
  }
  catch (error) {
    console.error('记录客户端错误失败', error)
    return c.json({
      code: 500,
      message: '记录失败',
    }, 500)
  }
}

/**
 * 接收客户端性能日志
 */
export async function logClientPerformance(c: Context<AppEnv>) {
  const body = await c.req.json<PerformanceLogRequest>()

  // 验证必需字段
  if (!body.operation || !body.timestamp || body.duration === undefined) {
    throw new HTTPException(400, { message: '缺少必需参数' })
  }

  try {
    // 如果性能较差，输出警告
    if (body.duration > 1000) {
      console.warn('⚠️ 客户端慢操作', {
        operation: body.operation,
        duration: `${body.duration.toFixed(2)}ms`,
        success: body.success,
        context: body.context,
      })
    }

    // 可选：保存到时序数据库或分析服务
    // 这里简化处理，只记录到控制台

    return c.json({
      code: 0,
      message: '性能指标已记录',
    })
  }
  catch (error) {
    console.error('记录客户端性能失败', error)
    return c.json({
      code: 500,
      message: '记录失败',
    }, 500)
  }
}
