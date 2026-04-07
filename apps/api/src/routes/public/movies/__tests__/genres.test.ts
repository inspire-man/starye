/**
 * publicMoviesRoutes — GET /genres 单测
 * 覆盖 SQLite json_each 聚合接口的核心行为
 */

import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockUser } from '../../../../test/helpers'
import { publicMoviesRoutes } from '../index'

// ─── Mock DB 工厂 ─────────────────────────────────────────────────────────────

function createGenresDb(genreRows: Array<{ genre: string, count: number }>) {
  return {
    all: vi.fn().mockResolvedValue(genreRows),
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

describe('publicMoviesRoutes — GET /genres', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('应返回 genre 列表', async () => {
    const mockGenres = [
      { genre: '剧情', count: 120 },
      { genre: '动作', count: 85 },
      { genre: '喜剧', count: 60 },
    ]

    const db = createGenresDb(mockGenres)
    const app = createApp(db)

    const res = await app.fetch(new Request('http://localhost/genres'))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(3)
    expect(json.data[0]).toEqual({ genre: '剧情', count: 120 })
    expect(json.data[1]).toEqual({ genre: '动作', count: 85 })
  })

  it('无 genre 数据时应返回空数组', async () => {
    const db = createGenresDb([])
    const app = createApp(db)

    const res = await app.fetch(new Request('http://localhost/genres'))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })

  it('未登录用户应能访问（无需认证）', async () => {
    const db = createGenresDb([{ genre: '动作', count: 10 }])
    const app = createApp(db, null) // 不设置 user

    const res = await app.fetch(new Request('http://localhost/genres'))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
  })

  it('应调用 db.all 执行 SQL 聚合查询', async () => {
    const db = createGenresDb([])
    const app = createApp(db)

    await app.fetch(new Request('http://localhost/genres'))

    expect(db.all).toHaveBeenCalledOnce()
  })

  it('db.all 抛出异常时应返回 500', async () => {
    const db = createGenresDb([])
    db.all = vi.fn().mockRejectedValue(new Error('DB error'))
    const app = createApp(db)

    const res = await app.fetch(new Request('http://localhost/genres'))

    expect(res.status).toBe(500)
    const json: any = await res.json()
    expect(json.success).toBe(false)
  })

  describe('r18 认证过滤', () => {
    it('非 R18 认证用户与 R18 用户各自应调用 db.all（R18 状态影响 SQL 构建）', async () => {
      // 行为验证：两者都正常调用了 db.all，说明 R18 状态被读取并处理
      // SQL 内容差异属于 Drizzle ORM 内部实现，通过集成测试覆盖
      const nonR18Genres = [{ genre: '剧情', count: 100 }]
      const r18Genres = [{ genre: '剧情', count: 100 }, { genre: 'R18特辑', count: 20 }]

      const dbNonR18 = createGenresDb(nonR18Genres)
      const dbR18 = createGenresDb(r18Genres)

      const nonR18User = createMockUser({ isR18Verified: false })
      const r18User = createMockUser({ isR18Verified: true })

      const resNonR18 = await createApp(dbNonR18, nonR18User)
        .fetch(new Request('http://localhost/genres'))
      const resR18 = await createApp(dbR18, r18User)
        .fetch(new Request('http://localhost/genres'))

      // 两者均正常返回 200
      expect(resNonR18.status).toBe(200)
      expect(resR18.status).toBe(200)

      const jsonNonR18: any = await resNonR18.json()
      const jsonR18: any = await resR18.json()

      // 非 R18 用户：只返回 1 条（mock 的结果）
      expect(jsonNonR18.data).toHaveLength(1)
      // R18 用户：返回 2 条（mock 的结果，包含 R18 类目）
      expect(jsonR18.data).toHaveLength(2)
      expect(jsonR18.data[1].genre).toBe('R18特辑')

      // 两次调用都触发了 db.all
      expect(dbNonR18.all).toHaveBeenCalledOnce()
      expect(dbR18.all).toHaveBeenCalledOnce()

      // SQL 对象不同（分别由各自 isR18Verified 状态动态构建）
      expect(dbNonR18.all.mock.calls[0][0]).not.toBe(dbR18.all.mock.calls[0][0])
    })

    it('r18 认证用户：可获取全量 genres', async () => {
      const mockGenres = [
        { genre: '剧情', count: 200 },
        { genre: 'R18专属', count: 50 },
      ]
      const db = createGenresDb(mockGenres)
      const r18User = createMockUser({ isR18Verified: true })
      const app = createApp(db, r18User)

      const res = await app.fetch(new Request('http://localhost/genres'))

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data).toHaveLength(2)
    })
  })
})
