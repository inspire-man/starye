import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb, createMockUser } from '../../../../test/helpers'
import { recordPlayerPlaybackFailure } from '../../handlers/player-playback-failure.handler'

function createApp(opts: { user?: ReturnType<typeof createMockUser> | null, db?: ReturnType<typeof createMockDb> } = {}) {
  const { user = null, db = createMockDb() } = opts
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    if (user)
      c.set('user', user)
    await next()
  })
  app.post('/players/:id/playback-failure', recordPlayerPlaybackFailure)
  return { app, db }
}

describe('recordPlayerPlaybackFailure', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('未登录返回 401', async () => {
    const { app } = createApp({ user: null })
    const res = await app.fetch(new Request('http://localhost/players/player-1/playback-failure', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'playback_failed' }),
    }))
    expect(res.status).toBe(401)
  })

  it('写入失败原因并读回', async () => {
    const db = createMockDb()
    const observedAt = new Date('2026-09-10T00:00:00.000Z')
    ;(db.query as any).players.findFirst = vi.fn()
      .mockResolvedValueOnce({ id: 'player-1', movieId: 'movie-1' })
      .mockResolvedValueOnce({
        id: 'player-1',
        movieId: 'movie-1',
        lastPlaybackStatus: 'failed',
        lastPlaybackReason: 'playback_failed',
        lastPlaybackAt: observedAt,
      })
    const where = vi.fn().mockResolvedValue(undefined)
    const set = vi.fn().mockReturnValue({ where })
    ;(db.update as any) = vi.fn().mockReturnValue({ set })
    const { app } = createApp({ user: createMockUser(), db })

    const res = await app.fetch(new Request('http://localhost/players/player-1/playback-failure', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'playback_failed' }),
    }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: {
        playerId: 'player-1',
        movieId: 'movie-1',
        lastPlaybackStatus: 'failed',
        lastPlaybackReason: 'playback_failed',
        lastPlaybackAt: Math.floor(observedAt.getTime() / 1000),
      },
    })
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      lastPlaybackStatus: 'failed',
      lastPlaybackReason: 'playback_failed',
    }))
  })
})
