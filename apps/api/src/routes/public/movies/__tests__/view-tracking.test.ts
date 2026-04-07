/**
 * publicMoviesRoutes — POST /movies/:code/view 单测
 * 覆盖观看埋点接口的核心行为（原子自增、静默成功）
 */

import type { createMockUser } from '../../../../test/helpers'
import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publicMoviesRoutes } from '../index'

// ─── Mock DB 工厂 ─────────────────────────────────────────────────────────────

function createViewTrackingDb(updateResult?: unknown) {
  const runMock = vi.fn().mockResolvedValue(updateResult ?? { rowsAffected: 1 })

  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: runMock,
          then: (resolve: any) => Promise.resolve(runMock()).then(resolve),
        })),
      })),
    })),
    all: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    query: {
      movies: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    _updateRunMock: runMock,
  } as any
}

// ─── App 工厂 ─────────────────────────────────────────────────────────────────

function createApp(db: any, user?: ReturnType<typeof createMockUser> | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    if (user !== undefined && user !== null) {
      c.set('user', user as any)
    }
    await next()
  })
  app.route('/', publicMoviesRoutes)
  return app
}

// ─── 测试 ─────────────────────────────────────────────────────────────────────

describe('publicMoviesRoutes — POST /:code/view', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('应返回 200 { success: true }', async () => {
    const db = createViewTrackingDb()
    const app = createApp(db)

    const res = await app.fetch(
      new Request('http://localhost/TEST-001/view', { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
  })

  it('无需登录即可调用（匿名上报）', async () => {
    const db = createViewTrackingDb()
    const app = createApp(db, null) // 未登录

    const res = await app.fetch(
      new Request('http://localhost/TEST-001/view', { method: 'POST' }),
    )

    expect(res.status).toBe(200)
  })

  it('影片番号不存在时仍应返回 200（静默成功）', async () => {
    // UPDATE 影响 0 行，不应报错
    const db = createViewTrackingDb({ rowsAffected: 0 })
    const app = createApp(db, null)

    const res = await app.fetch(
      new Request('http://localhost/NONEXISTENT-999/view', { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
  })

  it('应调用 db.update 对正确的 code 执行自增', async () => {
    const db = createViewTrackingDb()
    const app = createApp(db)

    await app.fetch(
      new Request('http://localhost/SSIS-001/view', { method: 'POST' }),
    )

    expect(db.update).toHaveBeenCalledOnce()
    // set 中使用原子 sql 表达式
    const setMock = db.update.mock.results[0].value.set
    expect(setMock).toHaveBeenCalledOnce()
    const setArg = setMock.mock.calls[0][0]
    // viewCount 字段存在于 set 调用中
    expect(setArg).toHaveProperty('viewCount')
  })

  it('db.update 抛出异常时仍应返回 200（静默捕获）', async () => {
    const db = createViewTrackingDb()
    db.update = vi.fn(() => {
      throw new Error('DB connection error')
    })
    const app = createApp(db)

    const res = await app.fetch(
      new Request('http://localhost/TEST-001/view', { method: 'POST' }),
    )

    // 即使 DB 错误，接口应静默并返回成功（不影响播放体验）
    expect(res.status).toBe(200)
  })
})
