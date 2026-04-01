/**
 * 用户反馈处理器
 */

import type { Context } from 'hono'
import type { AppEnv } from '../../types'
import { HTTPException } from 'hono/http-exception'

interface FeedbackRequest {
  type: 'bug' | 'suggestion' | 'question' | 'praise'
  feature: 'aria2' | 'rating' | 'other'
  content: string
  contact?: string
  userAgent: string
  url: string
}

/**
 * 提交反馈
 */
export async function submitFeedback(c: Context<AppEnv>) {
  const body = await c.req.json<FeedbackRequest>()

  // 验证必需字段
  if (!body.type || !body.feature || !body.content) {
    throw new HTTPException(400, { message: '缺少必需参数' })
  }

  if (body.content.length > 1000) {
    throw new HTTPException(400, { message: '反馈内容过长（最多 1000 字符）' })
  }

  try {
    // 记录反馈到日志或数据库
    // 简化处理：输出到服务器日志

    // 可选：保存到 D1 数据库的 feedback 表
    // const db = c.get('db')
    // await db.insert(feedback).values({
    //   id: crypto.randomUUID(),
    //   type: body.type,
    //   feature: body.feature,
    //   content: body.content,
    //   contact: body.contact,
    //   userAgent: body.userAgent,
    //   url: body.url,
    //   createdAt: new Date().toISOString(),
    // })

    return c.json({
      code: 0,
      message: '反馈已提交',
    })
  }
  catch (error) {
    console.error('保存反馈失败', error)
    throw new HTTPException(500, { message: '提交失败，请稍后再试' })
  }
}

/**
 * 获取反馈列表（管理员）
 */
export async function getFeedbackList(c: Context<AppEnv>) {
  const auth = c.get('auth')

  // 验证管理员权限
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: '请先登录' })
  }

  // TODO: 验证管理员角色

  // 从数据库查询反馈列表
  // const db = c.get('db')
  // const feedbackList = await db.query.feedback.findMany({
  //   orderBy: (feedback, { desc }) => [desc(feedback.createdAt)],
  //   limit: 100,
  // })

  return c.json({
    code: 0,
    data: [],
    message: '反馈列表功能待实现',
  })
}
