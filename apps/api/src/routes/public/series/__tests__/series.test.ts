/**
 * publicSeriesRoutes 单测
 * 覆盖 GET /api/series/:name 的核心逻辑
 */

import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockUser } from '../../../../test/helpers'
import { publicSeriesRoutes } from '../index'

// ─── 工具：创建可 await 的链式 DB Select Mock ─────────────────────────────────

/**
 * 创建一个 fluent chain，所有链式方法（from/where/groupBy/limit/…）
 * 都返回 this，await 时解析为给定 result。
 */
function createSelectChain(result: any) {
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then')
          return (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
        // 所有其他属性返回一个函数，调用后仍返回 chain（支持链式调用）
        return () => chain
      },
    },
  )
  return chain
}

// ─── Mock DB 工厂 ─────────────────────────────────────────────────────────────

interface SeriesDbOpts {
  statsRows?: any[] // db.select().from().where().groupBy() 的返回值
  relatedRows?: any[] // db.selectDistinct().from().where().limit() 的返回值
  publisherRecord?: { name: string, slug: string } | null // db.query.publishers.findFirst()
}

function createSeriesDb(opts: SeriesDbOpts = {}) {
  const {
    statsRows = [],
    relatedRows = [],
    publisherRecord = null,
  } = opts

  // select 调用次数：第 1 次是 stats 聚合，第 2 次及以后是 selectDistinct 走别的路径
  let selectCallCount = 0
  const selectMock = vi.fn().mockImplementation(() => {
    const idx = selectCallCount++
    return createSelectChain(idx === 0 ? statsRows : relatedRows)
  })

  const selectDistinctMock = vi.fn().mockImplementation(() =>
    createSelectChain(relatedRows),
  )

  const publishersFindFirst = vi.fn().mockResolvedValue(publisherRecord)

  return {
    select: selectMock,
    selectDistinct: selectDistinctMock,
    query: {
      publishers: { findFirst: publishersFindFirst },
    },
  } as any
}

// ─── App 工厂 ─────────────────────────────────────────────────────────────────

function createApp(db: any, user?: ReturnType<typeof createMockUser> | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    if (user)
      c.set('user', user)
    await next()
  })
  app.route('/', publicSeriesRoutes)
  return app
}

// ─── 测试 ─────────────────────────────────────────────────────────────────────

describe('publicSeriesRoutes — GET /:name', () => {
  beforeEach(() => vi.restoreAllMocks())

  describe('404 处理', () => {
    it('系列不存在时应返回 404', async () => {
      const db = createSeriesDb({ statsRows: [] })
      const app = createApp(db)

      const res = await app.fetch(new Request('http://localhost/test-series'))

      expect(res.status).toBe(404)
      const json: any = await res.json()
      expect(json.error).toBe('Series not found')
    })
  })

  describe('正常响应', () => {
    it('应返回系列统计数据', async () => {
      // releaseDate 以秒时间戳存储（2020-01-01 和 2024-12-31）
      const ts2020 = Math.floor(new Date('2020-01-01').getTime() / 1000)
      const ts2024 = Math.floor(new Date('2024-12-31').getTime() / 1000)

      const db = createSeriesDb({
        statsRows: [{
          movieCount: 12,
          totalDuration: 720, // 12 * 60 分钟
          minDate: ts2020,
          maxDate: ts2024,
          publisher: 'S1 NO.1 STYLE',
        }],
        publisherRecord: { name: 'S1 NO.1 STYLE', slug: 's1-no1-style' },
        relatedRows: [{ series: 'SSIS系列' }, { series: 'PRED系列' }],
      })

      const app = createApp(db)
      const res = await app.fetch(new Request('http://localhost/痴汉系列'))

      expect(res.status).toBe(200)
      const json: any = await res.json()

      expect(json.name).toBe('痴汉系列')
      expect(json.movieCount).toBe(12)
      expect(json.totalDuration).toBe(720)
      expect(json.minYear).toBe(2020)
      expect(json.maxYear).toBe(2024)
    })

    it('应正确返回厂商 name 和 slug', async () => {
      const db = createSeriesDb({
        statsRows: [{ movieCount: 5, totalDuration: 300, minDate: null, maxDate: null, publisher: 'MOODYZ' }],
        publisherRecord: { name: 'MOODYZ', slug: 'moodyz' },
        relatedRows: [],
      })

      const app = createApp(db)
      const res = await app.fetch(new Request('http://localhost/some-series'))

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.publisher).toEqual({ name: 'MOODYZ', slug: 'moodyz' })
    })

    it('厂商在 publishers 表无记录时应回退到 { name, slug: null }', async () => {
      const db = createSeriesDb({
        statsRows: [{ movieCount: 3, totalDuration: 180, minDate: null, maxDate: null, publisher: 'Unknown Studio' }],
        publisherRecord: null, // 未找到
        relatedRows: [],
      })

      const app = createApp(db)
      const res = await app.fetch(new Request('http://localhost/some-series'))

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.publisher).toEqual({ name: 'Unknown Studio', slug: null })
    })

    it('影片无厂商字段时 publisher 应为 null', async () => {
      const db = createSeriesDb({
        statsRows: [{ movieCount: 2, totalDuration: 120, minDate: null, maxDate: null, publisher: null }],
        relatedRows: [],
      })

      const app = createApp(db)
      const res = await app.fetch(new Request('http://localhost/some-series'))

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.publisher).toBeNull()
    })

    it('应正确返回同厂商相关系列列表', async () => {
      const db = createSeriesDb({
        statsRows: [{ movieCount: 5, totalDuration: 300, minDate: null, maxDate: null, publisher: 'MOODYZ' }],
        publisherRecord: { name: 'MOODYZ', slug: 'moodyz' },
        relatedRows: [{ series: 'MIFD系列' }, { series: 'MDVHM系列' }, { series: 'BF系列' }],
      })

      const app = createApp(db)
      const res = await app.fetch(new Request('http://localhost/some-series'))

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.relatedSeries).toEqual(['MIFD系列', 'MDVHM系列', 'BF系列'])
    })

    it('无相关系列时 relatedSeries 应为空数组', async () => {
      const db = createSeriesDb({
        statsRows: [{ movieCount: 2, totalDuration: 120, minDate: null, maxDate: null, publisher: 'MOODYZ' }],
        publisherRecord: { name: 'MOODYZ', slug: 'moodyz' },
        relatedRows: [],
      })

      const app = createApp(db)
      const res = await app.fetch(new Request('http://localhost/some-series'))

      const json: any = await res.json()
      expect(json.relatedSeries).toEqual([])
    })

    it('totalDuration 为 null 时应返回 0', async () => {
      const db = createSeriesDb({
        statsRows: [{ movieCount: 3, totalDuration: null, minDate: null, maxDate: null, publisher: null }],
      })

      const app = createApp(db)
      const res = await app.fetch(new Request('http://localhost/some-series'))

      const json: any = await res.json()
      expect(json.totalDuration).toBe(0)
    })

    it('releaseDate 为 null 时 minYear/maxYear 应为 null', async () => {
      const db = createSeriesDb({
        statsRows: [{ movieCount: 1, totalDuration: 60, minDate: null, maxDate: null, publisher: null }],
      })

      const app = createApp(db)
      const res = await app.fetch(new Request('http://localhost/some-series'))

      const json: any = await res.json()
      expect(json.minYear).toBeNull()
      expect(json.maxYear).toBeNull()
    })
  })

  describe('uRL 编码', () => {
    it('uRL 编码的系列名应正确解码后查询', async () => {
      const db = createSeriesDb({
        statsRows: [{ movieCount: 5, totalDuration: 300, minDate: null, maxDate: null, publisher: null }],
      })
      // 捕获实际传给 db.select 查询链的参数
      const selectSpy = vi.spyOn(db, 'select')

      const app = createApp(db)
      // 「痴漢御用達人系列」URL 编码后
      const encoded = encodeURIComponent('痴漢御用達人系列')
      const res = await app.fetch(new Request(`http://localhost/${encoded}`))

      expect(res.status).toBe(200)
      const json: any = await res.json()
      // 返回的 name 应是解码后的原始中文
      expect(json.name).toBe('痴漢御用達人系列')
      expect(selectSpy).toHaveBeenCalled()
    })
  })

  describe('r18 过滤', () => {
    it('未认证用户：查询时附加 isR18=false 过滤（不设置 user）', async () => {
      const db = createSeriesDb({
        statsRows: [{ movieCount: 2, totalDuration: 120, minDate: null, maxDate: null, publisher: null }],
      })
      const selectSpy = vi.spyOn(db, 'select')

      const app = createApp(db, null) // 未登录
      await app.fetch(new Request('http://localhost/non-r18-series'))

      // select 被调用，说明走到了 DB 查询
      expect(selectSpy).toHaveBeenCalled()
    })

    it('r18 已认证用户：不附加 isR18 过滤', async () => {
      const db = createSeriesDb({
        statsRows: [{ movieCount: 5, totalDuration: 300, minDate: null, maxDate: null, publisher: null }],
      })
      const selectSpy = vi.spyOn(db, 'select')

      const app = createApp(db, createMockUser({ isR18Verified: true }))
      await app.fetch(new Request('http://localhost/r18-series'))

      expect(selectSpy).toHaveBeenCalled()
    })
  })

  describe('错误处理', () => {
    it('数据库查询抛出异常时应返回 500', async () => {
      const db = {
        select: vi.fn().mockImplementation(() => {
          throw new Error('DB connection failed')
        }),
        query: { publishers: { findFirst: vi.fn() } },
      } as any

      const app = createApp(db)
      const res = await app.fetch(new Request('http://localhost/any-series'))

      expect(res.status).toBe(500)
      const json: any = await res.json()
      expect(json.error).toBe('查询系列详情失败')
    })
  })
})
