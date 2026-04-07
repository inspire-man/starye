/**
 * publicProgressRoutes 单测
 * 覆盖 GET /watching 的历史列表增强行为（无 movieCode 时 JOIN movies）
 */

import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockUser } from '../../../../test/helpers'
import { publicProgressRoutes } from '../index'

// ─── Fluent 链 Mock 工具 ───────────────────────────────────────────────────────

/**
 * 创建可 await 的 Drizzle fluent 链，所有链式方法均返回 this，
 * await 时解析为给定 result。
 */
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

// ─── Mock DB 工厂 ─────────────────────────────────────────────────────────────

interface WatchingProgressDbOpts {
  /** 无 movieCode 时 SELECT + JOIN 的结果 */
  historyRows?: any[]
  /** 有 movieCode 时 .get() 的结果 */
  singleRow?: any | null
  /** update 链（用于其他场景，此处备用） */
}

function createProgressDb(opts: WatchingProgressDbOpts = {}) {
  const { historyRows = [], singleRow = null } = opts

  const getMock = vi.fn().mockResolvedValue(singleRow)

  // 构建一个支持 .innerJoin().where().orderBy().limit() 的链，await 时返回 historyRows
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
            limit: vi.fn(() => ({
              get: getMock,
            })),
          })),
        })),
      })),
    })),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    query: {
      movies: { findFirst: vi.fn() },
    },
  } as any
}

// ─── App 工厂 ─────────────────────────────────────────────────────────────────

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

// ─── 测试 ─────────────────────────────────────────────────────────────────────

describe('publicProgressRoutes — GET /watching', () => {
  beforeEach(() => vi.restoreAllMocks())

  describe('认证守卫', () => {
    it('未登录时应返回 401', async () => {
      const db = createProgressDb()
      const app = createApp(db, null)

      const res = await app.fetch(new Request('http://localhost/watching'))

      expect(res.status).toBe(401)
      const json: any = await res.json()
      expect(json.success).toBe(false)
      expect(json.error).toBe('需要登录')
    })
  })

  describe('历史列表（无 movieCode）', () => {
    it('应返回含影片详情的历史列表', async () => {
      const mockHistory = [
        {
          id: 'prog-1',
          movieCode: 'TEST-001',
          progress: 1200,
          duration: 5400,
          updatedAt: new Date('2026-04-01'),
          title: '测试影片 001',
          coverImage: 'https://example.com/cover.jpg',
          isR18: false,
        },
        {
          id: 'prog-2',
          movieCode: 'TEST-002',
          progress: 600,
          duration: null,
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
      // 第一条含影片详情
      expect(json.data[0].title).toBe('测试影片 001')
      expect(json.data[0].coverImage).toBe('https://example.com/cover.jpg')
      expect(json.data[0].isR18).toBe(false)
      expect(json.data[0].progress).toBe(1200)
    })

    it('空历史时应返回空数组', async () => {
      const db = createProgressDb({ historyRows: [] })
      const user = createMockUser()
      const app = createApp(db, user)

      const res = await app.fetch(new Request('http://localhost/watching'))

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.success).toBe(true)
      expect(json.data).toEqual([])
    })

    it('limit 参数应被传递（默认 20）', async () => {
      const db = createProgressDb({ historyRows: [] })
      // 追踪 limit mock 调用
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

    it('limit 超过 50 时应被限制为 50', async () => {
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

      await app.fetch(new Request('http://localhost/watching?limit=200'))
      // valibot maxValue(50) 验证失败时会返回 400，handler 中使用 Math.min 保底
      // 主要验证不会超出 50
      const callArg = limitSpy.mock.calls[0]?.[0]
      if (callArg !== undefined) {
        expect(callArg).toBeLessThanOrEqual(50)
      }
    })
  })

  describe('单条查询（有 movieCode）', () => {
    /**
     * 单条查询链：db.select().from(watchingProgress).where(and(...)).get()
     * 注意：handler 中直接 .where().get()，不经 orderBy/limit
     */
    function createSingleQueryDb(singleRow: any) {
      const getMock = vi.fn().mockResolvedValue(singleRow)
      return {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              get: getMock,
            })),
            // 也支持 innerJoin（历史列表路径，不应在此被调用）
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => createSelectChain([])),
                })),
              })),
            })),
          })),
        })),
      } as any
    }

    it('有 movieCode 时应返回单条原始进度对象', async () => {
      const singleProgress = {
        id: 'prog-1',
        movieCode: 'TEST-001',
        progress: 1200,
        duration: 5400,
        updatedAt: new Date('2026-04-01'),
      }

      const db = createSingleQueryDb(singleProgress)
      const user = createMockUser()
      const app = createApp(db, user)

      const res = await app.fetch(
        new Request('http://localhost/watching?movieCode=TEST-001'),
      )

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.success).toBe(true)
      // 单条模式不含 title 字段（向后兼容）
      expect(json.data).toMatchObject({
        id: 'prog-1',
        movieCode: 'TEST-001',
        progress: 1200,
      })
      expect(json.data).not.toHaveProperty('title')
    })

    it('影片无进度记录时应返回 null', async () => {
      const db = createSingleQueryDb(undefined)
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
})
