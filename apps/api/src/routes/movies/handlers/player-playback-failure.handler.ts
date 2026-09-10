import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { players } from '@starye/db/schema'
import { eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'

export const PLAYBACK_FAILURE_REASONS = [
  'playback_failed',
  'source_candidate_invalid',
  'stream_failed',
  'direct_transport_failed',
] as const

export type PlaybackFailureReason = typeof PLAYBACK_FAILURE_REASONS[number]

export const PlaybackFailureBodySchema = v.object({
  reason: v.picklist(PLAYBACK_FAILURE_REASONS),
})

/**
 * POST /api/movies/players/:id/playback-failure
 * Persist a source-level playback failure for admin/detail availability.
 */
export async function recordPlayerPlaybackFailure(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')
  if (!user)
    throw new HTTPException(401, { message: '请先登录后再记录播放失败' })

  const playerId = c.req.param('id')
  if (!playerId)
    throw new HTTPException(400, { message: '缺少播放源 ID' })

  const parsed = v.safeParse(PlaybackFailureBodySchema, await c.req.json().catch(() => null))
  if (!parsed.success)
    throw new HTTPException(400, { message: '播放失败原因无效' })

  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
    columns: { id: true, movieId: true },
  })
  if (!player)
    throw new HTTPException(404, { message: '播放源不存在' })

  const observedAt = new Date()
  await db.update(players)
    .set({
      lastPlaybackStatus: 'failed',
      lastPlaybackReason: parsed.output.reason,
      lastPlaybackAt: observedAt,
      updatedAt: observedAt,
    })
    .where(eq(players.id, playerId))

  const readback = await db.query.players.findFirst({
    where: eq(players.id, playerId),
    columns: {
      id: true,
      movieId: true,
      lastPlaybackStatus: true,
      lastPlaybackReason: true,
      lastPlaybackAt: true,
    },
  })
  if (!readback || readback.lastPlaybackStatus !== 'failed' || readback.lastPlaybackReason !== parsed.output.reason)
    throw new HTTPException(409, { message: '播放失败状态读回不一致' })

  const lastPlaybackAt = readback.lastPlaybackAt instanceof Date
    ? Math.floor(readback.lastPlaybackAt.getTime() / 1000)
    : Number(readback.lastPlaybackAt ?? 0)

  return c.json({
    success: true,
    data: {
      playerId: readback.id,
      movieId: readback.movieId,
      lastPlaybackStatus: readback.lastPlaybackStatus,
      lastPlaybackReason: readback.lastPlaybackReason,
      lastPlaybackAt,
    },
  })
}
