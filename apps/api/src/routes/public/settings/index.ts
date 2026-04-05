/**
 * 公开系统设置 API 路由
 *
 * 仅暴露非敏感的系统配置供客户端读取，无需鉴权
 */

import type { AppEnv } from '../../../types'
import { systemSettings } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

export const publicSettingsRoutes = new Hono<AppEnv>()

/**
 * GET /api/public/settings/torrserver
 * 获取管理员配置的 TorrServer 默认地址
 * 供 movie-app 在用户未自定义时作为回落值
 */
publicSettingsRoutes.get('/torrserver', async (c) => {
  const db = c.get('db')

  try {
    const row = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'torrserver.default_url'))
      .get()

    return c.json({
      success: true,
      data: {
        defaultUrl: row?.value ?? null,
      },
    })
  }
  catch (error) {
    console.error('[Public/Settings] 查询 TorrServer 默认地址失败:', error)
    return c.json({
      success: true,
      data: { defaultUrl: null },
    })
  }
})
