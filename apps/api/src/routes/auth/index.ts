/* eslint-disable no-console */
import type { Context } from 'hono'
import type { AppEnv } from '../../types'
// Note: schema export might be 'user' not 'users'
import { user } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'

/**
 * Auth 路由 - 使用链式调用以支持 RPC 类型推导
 */
async function resolveSession(c: Context<AppEnv>) {
  const authInstance = c.get('auth')
  const db = c.get('db')
  const cookies = c.req.header('cookie')
  console.log('[Auth Debug] Cookies:', cookies)

  try {
    const session = await authInstance.api.getSession({ headers: c.req.raw.headers })
    console.log('[Auth Debug] Session result:', session ? 'found' : 'null')
    if (session) {
      const githubAccount = await db.query.account.findFirst({
        where: (account, { and, eq: eqOp }) => and(
          eqOp(account.userId, session.user.id),
          eqOp(account.providerId, 'github'),
        ),
      })

      return c.json({
        user: {
          ...session.user,
          githubId: githubAccount?.accountId ?? null,
        },
        session: session.session,
      })
    }
    return c.json(null)
  }
  catch (error) {
    console.error('[Auth] Session error:', error)
    return c.json(null)
  }
}

const auth = new Hono<AppEnv>()
  .get(
    '/session',
    describeRoute({
      summary: '获取当前会话信息',
      description: '返回当前登录用户的会话信息，如果未登录则返回 null',
      tags: ['Auth'],
      operationId: 'getSession',
      responses: {
        200: {
          description: '会话信息或 null',
        },
      },
    }),
    resolveSession,
  )
  .get(
    '/get-session',
    describeRoute({
      summary: '获取当前会话信息（兼容 Better Auth 客户端）',
      description: '兼容 `/api/auth/get-session` 调用，返回注入 githubId 后的 session 结果。',
      tags: ['Auth'],
      operationId: 'getSessionCompat',
      responses: {
        200: {
          description: '会话信息或 null',
        },
      },
    }),
    resolveSession,
  )
  .post(
    '/verify-age',
    describeRoute({
      summary: '验证用户年龄',
      description: '用户确认年满 18 岁，更新账户的成人内容访问权限',
      tags: ['Auth'],
      operationId: 'verifyAge',
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: '验证成功',
        },
        401: {
          description: '未登录',
        },
      },
    }),
    async (c) => {
      const authInstance = c.get('auth')
      const session = await authInstance.api.getSession({ headers: c.req.raw.headers })

      if (!session) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const db = c.get('db')
      const userId = session.user.id

      await db.update(user)
        .set({ isAdult: true })
        .where(eq(user.id, userId))

      return c.json({ success: true })
    },
  )
  .on(['POST', 'GET'], '/*', (c) => {
    // Better Auth Routes (Catch-all)
    const authInstance = c.get('auth')
    return authInstance.handler(c.req.raw)
  })

export const authRoutes = auth
