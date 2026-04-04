import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { players } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'

// 上报阈值：超过此数量时自动将 player 标记为待审核（isActive=false）
const REPORT_THRESHOLD = 5

/**
 * POST /api/movies/players/:id/report
 * 已登录用户上报播放源失效
 */
export async function reportPlayer(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: '请先登录后再上报' })
  }

  const playerId = c.req.param('id')
  if (!playerId) {
    throw new HTTPException(400, { message: '缺少播放源 ID' })
  }

  // 查找 player
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
    columns: { id: true, reportCount: true, isActive: true },
  })

  if (!player) {
    throw new HTTPException(404, { message: '播放源不存在' })
  }

  // 递增 reportCount；超过阈值时置 isActive=false
  const newCount = (player.reportCount ?? 0) + 1
  const shouldDeactivate = newCount >= REPORT_THRESHOLD

  await db.update(players)
    .set({
      reportCount: newCount,
      isActive: shouldDeactivate ? false : (player.isActive ?? true),
      updatedAt: new Date(),
    })
    .where(eq(players.id, playerId))

  return c.json({
    success: true,
    reportCount: newCount,
    isActive: shouldDeactivate ? false : (player.isActive ?? true),
  })
}
