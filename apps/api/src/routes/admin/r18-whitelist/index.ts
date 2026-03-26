import type { AppEnv } from '../../../types'
import { user } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute, validator } from 'hono-openapi'
import { captureResourceState, computeChanges, createAuditLog } from '../../../middleware/audit-logger'
import { requireResource } from '../../../middleware/resource-guard'
import { AddR18WhitelistSchema } from '../../../schemas/admin'

const r18Whitelist = new Hono<AppEnv>()

// 仅 admin 和 super_admin 可访问
r18Whitelist.use('*', requireResource('global'))

// 获取白名单用户列表
r18Whitelist.get('/', async (c) => {
  const db = c.get('db')

  try {
    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        isR18Verified: user.isR18Verified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.isR18Verified, true))
      .orderBy(user.updatedAt)

    return c.json({
      success: true,
      data: users,
    })
  }
  catch (error) {
    console.error('[R18Whitelist] Failed to fetch whitelist:', error)
    return c.json({
      success: false,
      error: '查询白名单失败',
    }, 500)
  }
})

// 添加用户到白名单
r18Whitelist.post(
  '/',
  describeRoute({
    summary: '添加用户到 R18 白名单',
    description: '将指定用户添加到 R18 内容访问白名单',
    tags: ['Admin'],
    operationId: 'addToR18Whitelist',
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: '添加成功' },
    },
  }),
  validator('json', AddR18WhitelistSchema),
  async (c) => {
    const db = c.get('db')
    const currentUser = c.get('user')
    const { userId, email } = c.req.valid('json')

    if (!currentUser) {
      return c.json({ success: false, error: '未登录' }, 401)
    }

    try {
    // 查找目标用户
      let targetUser
      if (userId) {
        targetUser = await db.select().from(user).where(eq(user.id, userId)).get()
      }
      else if (email) {
        targetUser = await db.select().from(user).where(eq(user.email, email)).get()
      }

      if (!targetUser) {
        return c.json({ success: false, error: '用户不存在' }, 404)
      }

      if (targetUser.isR18Verified) {
        return c.json({ success: false, error: '该用户已在白名单中' }, 400)
      }

      // 捕获变更前状态
      const before = await captureResourceState(c, 'user', targetUser.id)

      // 更新用户
      await db
        .update(user)
        .set({ isR18Verified: true, updatedAt: new Date() })
        .where(eq(user.id, targetUser.id))

      // 捕获变更后状态并计算差异
      const after = await captureResourceState(c, 'user', targetUser.id)
      const changes = computeChanges(before, after)

      // 记录审计日志
      await createAuditLog(c, {
        action: 'UPDATE',
        resourceType: 'user',
        resourceId: targetUser.id,
        resourceIdentifier: targetUser.email,
        affectedCount: 1,
        changes,
      })

      return c.json({
        success: true,
        message: `已将用户 ${targetUser.email} 添加到 R18 白名单`,
      })
    }
    catch (error) {
      console.error('[R18Whitelist] Failed to add user to whitelist:', error)
      return c.json({
        success: false,
        error: '添加白名单失败',
      }, 500)
    }
  },
)

// 移除白名单用户
r18Whitelist.delete('/:userId', async (c) => {
  const db = c.get('db')
  const currentUser = c.get('user')
  const { userId } = c.req.param()

  if (!currentUser) {
    return c.json({ success: false, error: '未登录' }, 401)
  }

  try {
    // 查找目标用户
    const targetUser = await db.select().from(user).where(eq(user.id, userId)).get()

    if (!targetUser) {
      return c.json({ success: false, error: '用户不存在' }, 404)
    }

    if (!targetUser.isR18Verified) {
      return c.json({ success: false, error: '该用户不在白名单中' }, 400)
    }

    // 捕获变更前状态
    const before = await captureResourceState(c, 'user', targetUser.id)

    // 更新用户
    await db
      .update(user)
      .set({ isR18Verified: false, updatedAt: new Date() })
      .where(eq(user.id, targetUser.id))

    // 捕获变更后状态并计算差异
    const after = await captureResourceState(c, 'user', targetUser.id)
    const changes = computeChanges(before, after)

    // 记录审计日志
    await createAuditLog(c, {
      action: 'UPDATE',
      resourceType: 'user',
      resourceId: targetUser.id,
      resourceIdentifier: targetUser.email,
      affectedCount: 1,
      changes,
    })

    return c.json({
      success: true,
      message: `已将用户 ${targetUser.email} 从 R18 白名单中移除`,
    })
  }
  catch (error) {
    console.error('[R18Whitelist] Failed to remove user from whitelist:', error)
    return c.json({
      success: false,
      error: '移除白名单失败',
    }, 500)
  }
})

export const adminR18WhitelistRoutes = r18Whitelist
