/* eslint-disable no-console */
/**
 * 系统设置管理 API 路由
 *
 * 提供系统级键值配置的读写接口
 * 权限要求：service token
 */

import type { AppEnv } from '../../../types'
import { systemSettings } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireResource } from '../../../middleware/resource-guard'

const adminSettings = new Hono<AppEnv>()

adminSettings.use('/*', requireResource('global'))

/**
 * GET /api/admin/settings
 * 获取所有系统设置
 */
adminSettings.get('/', async (c) => {
  const db = c.get('db')

  try {
    const settings = await db
      .select()
      .from(systemSettings)
      .all()

    return c.json({
      success: true,
      data: settings,
    })
  }
  catch (error) {
    console.error('[Admin/Settings] 查询系统设置失败:', error)
    return c.json({ success: false, error: '查询系统设置失败' }, 500)
  }
})

/**
 * PUT /api/admin/settings
 * 批量更新系统设置（逐条 upsert）
 * Body: { settings: Array<{ key: string, value: string }> }
 */
adminSettings.put('/', async (c) => {
  const db = c.get('db')

  let body: { settings: Array<{ key: string, value: string }> }
  try {
    body = await c.req.json()
  }
  catch {
    return c.json({ success: false, error: '请求体格式不正确' }, 400)
  }

  const { settings } = body

  if (!Array.isArray(settings) || settings.length === 0) {
    return c.json({ success: false, error: '参数 settings 必须为非空数组' }, 400)
  }

  // 校验每条记录
  for (const item of settings) {
    if (typeof item.key !== 'string' || !item.key.trim()) {
      return c.json({ success: false, error: 'settings 每项必须包含非空 key' }, 400)
    }
    if (typeof item.value !== 'string') {
      return c.json({ success: false, error: 'settings 每项的 value 必须为字符串' }, 400)
    }
  }

  try {
    for (const item of settings) {
      await db
        .insert(systemSettings)
        .values({
          key: item.key.trim(),
          value: item.value,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: item.value,
            updatedAt: new Date(),
          },
        })
    }

    console.log(`[Admin/Settings] 已更新 ${settings.length} 条系统设置`)

    return c.json({
      success: true,
      message: `已更新 ${settings.length} 条系统设置`,
    })
  }
  catch (error) {
    console.error('[Admin/Settings] 更新系统设置失败:', error)
    return c.json({ success: false, error: '更新系统设置失败' }, 500)
  }
})

/**
 * DELETE /api/admin/settings/:key
 * 删除指定 key 的系统设置
 */
adminSettings.delete('/:key', async (c) => {
  const db = c.get('db')
  const { key } = c.req.param()

  try {
    await db.delete(systemSettings).where(eq(systemSettings.key, key))

    return c.json({
      success: true,
      message: `已删除设置 ${key}`,
    })
  }
  catch (error) {
    console.error('[Admin/Settings] 删除系统设置失败:', error)
    return c.json({ success: false, error: '删除系统设置失败' }, 500)
  }
})

export const adminSettingsRoutes = adminSettings
