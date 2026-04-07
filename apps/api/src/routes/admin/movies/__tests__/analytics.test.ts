/**
 * adminMoviesRoutes — GET /analytics 单测
 * 覆盖热门排行、Genre 分布、权限控制核心行为
 */

import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockUser } from '../../../../test/helpers'
import { adminMoviesRoutes } from '../index'

// ─── Mock DB 工厂 ─────────────────────────────────────────────────────────────

interface MockHotMovie {
  id: string
  code: string
  title: string
  coverImage: string | null
  viewCount: number
  isR18: boolean
}

interface MockGenreRow {
  genre: string
  count: number
}

function createAnalyticsDb(
  hotMovies: MockHotMovie[],
  genreRows: MockGenreRow[],
) {
  // select() 链：用于热门影片查询
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(hotMovies),
  }

  return {
    select: vi.fn().mockReturnValue(selectChain),
    // all() 用于 json_each Genre 分布查询
    all: vi.fn().mockResolvedValue(genreRows),
    // 以下方法在 analytics 路由中不使用，仅保证结构完整
    query: {
      movies: { findFirst: vi.fn(), findMany: vi.fn() },
    },
  } as any
}

// ─── App 工厂（含 requireResource 中间件的模拟）─────────────────────────────

function createApp(db: any, user?: ReturnType<typeof createMockUser> | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    // 测试环境下需要设置 env，否则 requireResource 中间件读取 c.env.CRAWLER_SECRET 会崩溃
    ;(c as any).env = {}
    if (user !== undefined && user !== null) {
      c.set('user', user as any)
    }
    await next()
  })
  app.route('/', adminMoviesRoutes)
  return app
}

// ─── 测试数据 ─────────────────────────────────────────────────────────────────

function makeHotMovie(overrides: Partial<MockHotMovie> = {}): MockHotMovie {
  return {
    id: 'movie-1',
    code: 'ABC-001',
    title: '测试电影',
    coverImage: null,
    viewCount: 100,
    isR18: false,
    ...overrides,
  }
}

// ─── 测试 ─────────────────────────────────────────────────────────────────────

describe('adminMoviesRoutes — GET /analytics', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('管理员可获取热门影片 Top 10（按 viewCount DESC）', async () => {
    const hotMovies: MockHotMovie[] = [
      makeHotMovie({ id: '1', code: 'ABC-001', title: '热门第一', viewCount: 500 }),
      makeHotMovie({ id: '2', code: 'ABC-002', title: '热门第二', viewCount: 300 }),
      makeHotMovie({ id: '3', code: 'ABC-003', title: '热门第三', viewCount: 200 }),
    ]
    const genreRows: MockGenreRow[] = [{ genre: '动作', count: 50 }]

    const db = createAnalyticsDb(hotMovies, genreRows)
    const adminUser = createMockUser({ role: 'admin' })
    const app = createApp(db, adminUser)

    const res = await app.fetch(new Request('http://localhost/analytics'))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.hotMovies).toHaveLength(3)
    expect(json.hotMovies[0].viewCount).toBe(500)
    expect(json.hotMovies[1].viewCount).toBe(300)
    expect(json.hotMovies[2].viewCount).toBe(200)
  })

  it('热门影片最多返回 10 条', async () => {
    // DB mock 模拟已限制为 10 条（由 .limit(10) 保证），此处验证 API 正常透传
    const hotMovies = Array.from({ length: 10 }, (_, i) =>
      makeHotMovie({ id: String(i), code: `A-00${i}`, viewCount: 1000 - i * 10 }))
    const db = createAnalyticsDb(hotMovies, [])
    const adminUser = createMockUser({ role: 'admin' })
    const app = createApp(db, adminUser)

    const res = await app.fetch(new Request('http://localhost/analytics'))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.hotMovies).toHaveLength(10)
  })

  it('非管理员访问应返回 403', async () => {
    const db = createAnalyticsDb([], [])
    // movie_viewer 角色无 movie 资源权限
    const normalUser = createMockUser({ role: 'user' })
    const app = createApp(db, normalUser)

    const res = await app.fetch(new Request('http://localhost/analytics'))

    expect(res.status).toBe(403)
  })

  it('未登录访问应返回 401', async () => {
    const db = createAnalyticsDb([], [])
    const app = createApp(db, null)

    const res = await app.fetch(new Request('http://localhost/analytics'))

    expect(res.status).toBe(401)
  })

  it('genreDistribution 含 R18 影片的 genre（全量，不过滤 R18）', async () => {
    const hotMovies: MockHotMovie[] = []
    const genreRows: MockGenreRow[] = [
      { genre: '剧情', count: 200 },
      { genre: '动作', count: 150 },
      { genre: 'R18专属', count: 80 }, // R18 内容，管理端全量返回
    ]

    const db = createAnalyticsDb(hotMovies, genreRows)
    const adminUser = createMockUser({ role: 'admin' })
    const app = createApp(db, adminUser)

    const res = await app.fetch(new Request('http://localhost/analytics'))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.genreDistribution).toHaveLength(3)
    // 确保 R18 专属 genre 被包含
    const r18Genre = json.genreDistribution.find((g: any) => g.genre === 'R18专属')
    expect(r18Genre).toBeDefined()
    expect(r18Genre.count).toBe(80)
  })

  it('空 genre（空字符串）应被 SQL WHERE 过滤，不出现在结果中', async () => {
    // json_each WHERE value != '' 由 SQL 层处理，此处验证 API 正常透传 DB 结果
    // （空 genre 已在 DB 查询中被过滤，API 层直接返回 DB 结果）
    const genreRows: MockGenreRow[] = [
      { genre: '动作', count: 100 },
      { genre: '剧情', count: 80 },
      // 空字符串不应出现（已由 SQL WHERE 过滤）
    ]

    const db = createAnalyticsDb([], genreRows)
    const adminUser = createMockUser({ role: 'admin' })
    const app = createApp(db, adminUser)

    const res = await app.fetch(new Request('http://localhost/analytics'))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    const emptyGenre = json.genreDistribution.find((g: any) => g.genre === '')
    expect(emptyGenre).toBeUndefined()
    expect(json.genreDistribution).toHaveLength(2)
  })

  it('dB 查询失败时应返回 500', async () => {
    const db = createAnalyticsDb([], [])
    // 模拟 select 链的最终 limit 调用抛出异常
    db.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockRejectedValue(new Error('DB connection error')),
    })

    const adminUser = createMockUser({ role: 'admin' })
    const app = createApp(db, adminUser)

    const res = await app.fetch(new Request('http://localhost/analytics'))

    expect(res.status).toBe(500)
    const json: any = await res.json()
    expect(json.error).toBeDefined()
  })
})
