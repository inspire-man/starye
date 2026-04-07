/**
 * publicMoviesRoutes — GET /:code 相关影片 genre fallback 单测
 * 覆盖：merged < 4 时触发 fallback、>= 4 时不触发、genres 为空时静默跳过、fallback 结果去重
 */

import type { createMockUser } from '../../../../test/helpers'
import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publicMoviesRoutes } from '../index'

// ─── 基础 movie 数据工厂 ──────────────────────────────────────────────────────

function makeMovie(overrides: Record<string, unknown> = {}) {
  return {
    id: 'movie-1',
    title: '测试影片',
    slug: 'test-movie',
    code: 'TEST-001',
    description: null,
    coverImage: null,
    releaseDate: null,
    duration: null,
    sourceUrl: null,
    actors: ['actress-a'],
    genres: ['动作', '剧情'] as unknown as string,
    series: null,
    publisher: null,
    isR18: false,
    metadataLocked: false,
    sortOrder: 0,
    viewCount: 10,
    crawlStatus: 'complete',
    lastCrawledAt: null,
    totalPlayers: 0,
    crawledPlayers: 0,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  }
}

function makeRelatedMovie(id: string, code: string) {
  return {
    id,
    code,
    title: `影片 ${code}`,
    slug: code.toLowerCase(),
    coverImage: null,
    isR18: false,
    series: null,
    releaseDate: null,
    genres: null,
    viewCount: 5,
    description: null,
    duration: null,
    sourceUrl: null,
    actors: null,
    publisher: null,
    metadataLocked: false,
    sortOrder: 0,
    crawlStatus: 'complete',
    lastCrawledAt: null,
    totalPlayers: 0,
    crawledPlayers: 0,
    createdAt: null,
    updatedAt: null,
  }
}

// ─── DB Mock 工厂 ─────────────────────────────────────────────────────────────

/**
 * 构建单次 select 链，在调用 .limit() 时 resolve 给定数组
 */
function makeSelectChain(result: unknown[]) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  }
  return chain
}

/**
 * 创建支持相关影片查询的 mock DB
 * actorRelated  : 演员关联查询结果（actorIds.length > 0 时第一次 select）
 * genreFallback : genre fallback 查询结果（merged < 4 时最后一次 select）
 * movieOverrides: 覆盖默认 movie 字段
 * movieActors   : mock findFirst 返回的 movieActors 结构（含 actor 对象）
 */
function createMockDb(options: {
  movieOverrides?: Record<string, unknown>
  movieActors?: Array<{ actorId: string, actor: { id: string, name: string, slug: string, avatar: null } }>
  actorRelated?: ReturnType<typeof makeRelatedMovie>[]
  genreFallback?: ReturnType<typeof makeRelatedMovie>[]
}) {
  const {
    movieOverrides = {},
    movieActors = [{ actorId: 'actor-1', actor: { id: 'actor-1', name: '女优A', slug: 'actress-a', avatar: null } }],
    actorRelated = [],
    genreFallback = [],
  } = options

  const movie = makeMovie(movieOverrides)

  // 按调用顺序分配 selectChain：
  // - actorRelated 有效时第 1 次为演员查询
  // - 第 2 次（或第 1 次，若无演员）为 genre fallback
  const chains = [
    makeSelectChain(actorRelated),
    makeSelectChain(genreFallback),
    makeSelectChain([]),
  ]
  let chainIdx = 0

  return {
    select: vi.fn(() => chains[Math.min(chainIdx++, chains.length - 1)]),
    query: {
      movies: {
        findFirst: vi.fn().mockResolvedValue({
          ...movie,
          movieActors,
          moviePublishers: [],
        }),
      },
      players: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  } as any
}

// ─── App 工厂 ─────────────────────────────────────────────────────────────────

function createApp(db: any, user?: ReturnType<typeof createMockUser> | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    if (user !== undefined && user !== null)
      c.set('user', user as any)
    await next()
  })
  app.route('/', publicMoviesRoutes)
  return app
}

// ─── 测试 ─────────────────────────────────────────────────────────────────────

describe('publicMoviesRoutes — GET /:code 相关影片 genre fallback', () => {
  beforeEach(() => vi.restoreAllMocks())

  describe('场景 1：演员+系列结果 < 4 条时触发 genre fallback', () => {
    it('merged < 4 时应执行 genre fallback 补充结果', async () => {
      const fallbackMovies = [makeRelatedMovie('fb-1', 'FB-001'), makeRelatedMovie('fb-2', 'FB-002')]
      const db = createMockDb({
        actorRelated: [makeRelatedMovie('r-1', 'REL-001')], // 只有 1 条演员结果
        genreFallback: fallbackMovies,
      })
      const app = createApp(db)

      const res = await app.request('/TEST-001')
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.success).toBe(true)
      // fallback 结果应出现在 relatedMovies 中
      const relatedIds = body.data.relatedMovies.map((m: any) => m.id)
      expect(relatedIds).toContain('fb-1')
      expect(relatedIds).toContain('fb-2')
    })
  })

  describe('场景 2：演员+系列结果 >= 4 条时不触发 genre fallback', () => {
    it('merged >= 4 时 genre fallback 影片不应出现', async () => {
      const actorMovies = [
        makeRelatedMovie('r-1', 'REL-001'),
        makeRelatedMovie('r-2', 'REL-002'),
        makeRelatedMovie('r-3', 'REL-003'),
        makeRelatedMovie('r-4', 'REL-004'),
      ]
      const db = createMockDb({
        actorRelated: actorMovies,
        genreFallback: [makeRelatedMovie('fb-1', 'FB-001')],
      })
      const app = createApp(db)

      const res = await app.request('/TEST-001')
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.success).toBe(true)
      // genre fallback 的影片不应出现（因为 merged 已 >= 4）
      const relatedIds = body.data.relatedMovies.map((m: any) => m.id)
      expect(relatedIds).not.toContain('fb-1')
    })
  })

  describe('场景 3：genres 为空时静默跳过 fallback', () => {
    it('genres 为 null 时不触发 fallback，返回 200 不报错', async () => {
      const db = createMockDb({
        movieOverrides: { genres: null },
        movieActors: [], // 无演员 → actorIds 为空 → 演员查询跳过
        genreFallback: [makeRelatedMovie('fb-1', 'FB-001')],
      })
      const app = createApp(db)

      const res = await app.request('/TEST-001')
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.success).toBe(true)
      // fb-1 不应出现（genres 为空，fallback 跳过）
      const relatedIds = body.data.relatedMovies.map((m: any) => m.id)
      expect(relatedIds).not.toContain('fb-1')
    })
  })

  describe('场景 4：fallback 结果不与演员/系列结果重复', () => {
    it('genre fallback 中 id 已存在的影片应被去重', async () => {
      const existingMovie = makeRelatedMovie('r-1', 'REL-001')
      // fallback 返回 r-1（已存在）+ fb-2（新）
      const db = createMockDb({
        actorRelated: [existingMovie],
        genreFallback: [existingMovie, makeRelatedMovie('fb-2', 'FB-002')],
      })
      const app = createApp(db)

      const res = await app.request('/TEST-001')
      expect(res.status).toBe(200)
      const body = await res.json() as any
      const relatedIds: string[] = body.data.relatedMovies.map((m: any) => m.id)
      // r-1 只应出现一次
      expect(relatedIds.filter(id => id === 'r-1').length).toBe(1)
      // fb-2 应出现
      expect(relatedIds).toContain('fb-2')
    })
  })
})
