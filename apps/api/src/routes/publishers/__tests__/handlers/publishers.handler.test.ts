/**
 * Publishers Handlers 测试
 */

import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { createMockDb, createMockPublisher } from '../../../../test/helpers'
import { getPublisherDetail, getPublisherList } from '../../handlers/publishers.handler'
import * as authService from '../../services/auth.service'
import * as publisherService from '../../services/publisher.service'

describe('publishers Handlers', () => {
  describe('getPublisherList', () => {
    it('应该返回出版商列表', async () => {
      const mockGetPublishers = vi.spyOn(publisherService, 'getPublishers').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      })

      const app = new Hono<AppEnv>()
      const mockDb = createMockDb()
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/publishers', getPublisherList)

      const req = new Request('http://localhost/publishers?page=1&limit=20')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockGetPublishers).toHaveBeenCalledWith({
        db: mockDb,
        page: 1,
        pageSize: 20,
        sort: 'name',
        country: undefined,
        hasDetails: undefined,
      })

      mockGetPublishers.mockRestore()
    })

    it('应该解析查询参数', async () => {
      const mockGetPublishers = vi.spyOn(publisherService, 'getPublishers').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      })

      const app = new Hono<AppEnv>()
      const mockDb = createMockDb()
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/publishers', getPublisherList)

      const req = new Request('http://localhost/publishers?page=2&limit=50&sort=movieCount&country=JP')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockGetPublishers).toHaveBeenCalledWith({
        db: mockDb,
        page: 2,
        pageSize: 50,
        sort: 'movieCount',
        country: 'JP',
        hasDetails: undefined,
      })

      mockGetPublishers.mockRestore()
    })

    it('应该处理数据库错误', async () => {
      const mockGetPublishers = vi.spyOn(publisherService, 'getPublishers').mockRejectedValue(new Error('DB Error'))

      const app = new Hono<AppEnv>()
      const mockDb = createMockDb()
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/publishers', getPublisherList)

      const req = new Request('http://localhost/publishers')
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const json: any = await res.json()
      expect(json.error).toBe('Database operation failed')

      mockGetPublishers.mockRestore()
    })
  })

  describe('getPublisherDetail', () => {
    it('应该返回出版商详情', async () => {
      const mockPublisher = createMockPublisher({
        id: '1',
        name: 'Test Publisher',
        slug: 'test-publisher',
        relatedMovies: [],
      })
      const mockGetPublisher = vi.spyOn(publisherService, 'getPublisherBySlug').mockResolvedValue(mockPublisher)
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockReturnValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = createMockDb()
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/publishers/:slug', getPublisherDetail)

      const req = new Request('http://localhost/publishers/test-publisher')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.name).toBe('Test Publisher')
      expect(mockGetPublisher).toHaveBeenCalledWith({
        db: mockDb,
        slug: 'test-publisher',
      })

      mockGetPublisher.mockRestore()
    })

    it('应该在出版商不存在时返回 404', async () => {
      const mockGetPublisher = vi.spyOn(publisherService, 'getPublisherBySlug').mockResolvedValue(null)
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockReturnValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = createMockDb()
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/publishers/:slug', getPublisherDetail)

      const req = new Request('http://localhost/publishers/non-existent')
      const res = await app.fetch(req)

      expect(res.status).toBe(404)

      mockGetPublisher.mockRestore()
    })

    it('应该验证 R18 权限', async () => {
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockReturnValue(false)

      const app = new Hono<AppEnv>()
      const mockDb = createMockDb()
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/publishers/:slug', getPublisherDetail)

      const req = new Request('http://localhost/publishers/test-publisher')
      const res = await app.fetch(req)

      expect(res.status).toBe(403)
      const json: any = await res.json()
      expect(json.error).toBe('Adult verification required')
    })
  })
})
