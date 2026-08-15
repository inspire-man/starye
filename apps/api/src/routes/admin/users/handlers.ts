import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { user } from '@starye/db/schema'
import { count } from 'drizzle-orm'

/**
 * 获取用户列表
 */
export async function getUserList(c: Context<AppEnv>) {
  const db = c.get('db')
  const pageParam = c.req.query('page')
  const limitParam = c.req.query('limit')

  // 保留旧数组响应，供 R18 白名单等小型选择器继续使用；带分页参数时返回统一 meta。
  if (!pageParam && !limitParam) {
    const results = await db.query.user.findMany({
      orderBy: (user, { desc }) => [desc(user.createdAt)],
      limit: 100,
    })
    return c.json(results)
  }

  const page = Math.max(1, Number(pageParam) || 1)
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20))
  const offset = (page - 1) * limit
  const [results, totalResult] = await Promise.all([
    db.query.user.findMany({
      orderBy: (user, { desc }) => [desc(user.createdAt)],
      limit,
      offset,
    }),
    db.select({ value: count() }).from(user).then(rows => rows[0]?.value ?? 0),
  ])

  return c.json({
    data: results,
    meta: {
      total: totalResult,
      page,
      limit,
      totalPages: Math.ceil(totalResult / limit),
    },
  })
}

/**
 * 更新用户角色
 */
export async function updateUserRole(c: Context<AppEnv>) {
  const { user } = await import('@starye/db/schema')
  const { eq } = await import('drizzle-orm')

  const email = c.req.param('email')!
  const { role } = (c.req as any).valid('json')
  const db = c.get('db')

  try {
    const result = await db.update(user)
      .set({ role, updatedAt: new Date() })
      .where(eq(user.email, email))
      .returning({ id: user.id, email: user.email, role: user.role })

    if (result.length === 0) {
      return c.json({ success: false, error: 'User not found' }, 404)
    }

    // console.log(`[Admin] Updated role for ${email} to ${role}`)
    return c.json({ success: true, user: result[0] })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Admin] Failed to update role for ${email}:`, message)
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * 更新用户状态
 */
export async function updateUserStatus(c: Context<AppEnv>) {
  const { user } = await import('@starye/db/schema')
  const { eq } = await import('drizzle-orm')

  const email = c.req.param('email')!
  const { isAdult } = (c.req as any).valid('json')
  const db = c.get('db')

  if (isAdult === undefined) {
    return c.json({ success: false, error: 'isAdult is required' }, 400)
  }

  try {
    const result = await db.update(user)
      .set({ isAdult, updatedAt: new Date() })
      .where(eq(user.email, email))
      .returning({ id: user.id, email: user.email, isAdult: user.isAdult })

    if (result.length === 0) {
      return c.json({ success: false, error: 'User not found' }, 404)
    }

    // console.log(`[Admin] Updated isAdult for ${email} to ${isAdult}`)
    return c.json({ success: true, user: result[0] })
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[Admin] Failed to update status for ${email}:`, message)
    return c.json({ success: false, error: message }, 500)
  }
}
