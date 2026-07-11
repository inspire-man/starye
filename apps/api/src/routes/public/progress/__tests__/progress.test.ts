import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockUser } from '../../../../test/helpers'
import { publicProgressRoutes } from '../index'

function createSelectChain(result: unknown) {
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: any, reject: any) =>
            Promise.resolve(result).then(resolve, reject)
        }
        return () => chain
      },
    },
  )
  return chain
}

interface ProgressDbOpts {
  historyRows?: any[]
  singleRow?: any | null
}

function createProgressDb(opts: ProgressDbOpts = {}) {
  const { historyRows = [], singleRow = null } = opts
  const getMock = vi.fn().mockResolvedValue(singleRow)
  const limitChain = createSelectChain(historyRows)

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => limitChain),
            })),
          })),
        })),
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => limitChain),
          })),
          get: getMock,
        })),
      })),
    })),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    query: {
      movies: { findFirst: vi.fn() },
      chapters: { findFirst: vi.fn(), findMany: vi.fn() },
      comics: { findFirst: vi.fn() },
    },
  } as any
}

function createApp(db: any, user?: ReturnType<typeof createMockUser> | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    if (user !== undefined) {
      c.set('user', user as any)
    }
    await next()
  })
  app.route('/', publicProgressRoutes)
  return app
}

describe('publicProgressRoutes — GET /watching', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('未登录时应返回 401', async () => {
    const db = createProgressDb()
    const app = createApp(db, null)

    const res = await app.fetch(new Request('http://localhost/watching'))

    expect(res.status).toBe(401)
    const json: any = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('需要登录')
  })

  it('历史列表应返回 unified movie contract 且包含 completed', async () => {
    const mockHistory = [
      {
        id: 'prog-1',
        contentId: 'TEST-001',
        position: 1200,
        duration: 5400,
        completed: false,
        updatedAt: new Date('2026-04-01'),
        title: '测试影片 001',
        coverImage: 'https://example.com/cover.jpg',
        isR18: false,
      },
      {
        id: 'prog-2',
        contentId: 'TEST-002',
        position: 600,
        duration: null,
        completed: true,
        updatedAt: new Date('2026-03-28'),
        title: '测试影片 002',
        coverImage: null,
        isR18: true,
      },
    ]

    const db = createProgressDb({ historyRows: mockHistory })
    const user = createMockUser()
    const app = createApp(db, user)

    const res = await app.fetch(new Request('http://localhost/watching'))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(2)
    expect(json.data[0]).toMatchObject({
      movieCode: 'TEST-001',
      contentType: 'movie',
      contentId: 'TEST-001',
      progress: 1200,
      position: 1200,
      completed: false,
      title: '测试影片 001',
    })
    expect(json.data[1].completed).toBe(true)
  })

  it('默认 limit 为 20', async () => {
    const db = createProgressDb({ historyRows: [] })
    const limitSpy = vi.fn().mockReturnValue(createSelectChain([]))
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: limitSpy,
            })),
          })),
        })),
      })),
    }))

    const user = createMockUser()
    const app = createApp(db, user)

    await app.fetch(new Request('http://localhost/watching'))
    expect(limitSpy).toHaveBeenCalledWith(20)
  })

  it('limit=5 时应传递正确的 limit 值', async () => {
    const db = createProgressDb({ historyRows: [] })
    const limitSpy = vi.fn().mockReturnValue(createSelectChain([]))
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: limitSpy,
            })),
          })),
        })),
      })),
    }))

    const user = createMockUser()
    const app = createApp(db, user)

    await app.fetch(new Request('http://localhost/watching?limit=5'))
    expect(limitSpy).toHaveBeenCalledWith(5)
  })

  it('单条查询应返回 unified item 且包含 completed', async () => {
    const singleProgress = {
      id: 'prog-1',
      contentId: 'TEST-001',
      position: 1200,
      duration: 5400,
      completed: true,
      updatedAt: new Date('2026-04-01'),
    }

    const db = createProgressDb({ singleRow: singleProgress })
    const user = createMockUser()
    const app = createApp(db, user)

    const res = await app.fetch(
      new Request('http://localhost/watching?movieCode=TEST-001'),
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({
      id: 'prog-1',
      movieCode: 'TEST-001',
      contentType: 'movie',
      contentId: 'TEST-001',
      progress: 1200,
      position: 1200,
      completed: true,
    })
  })

  it('影片无进度记录时应返回 null', async () => {
    const db = createProgressDb({ singleRow: undefined })
    const user = createMockUser()
    const app = createApp(db, user)

    const res = await app.fetch(
      new Request('http://localhost/watching?movieCode=NONEXISTENT-001'),
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toBeNull()
  })
})
