/**
 * Actors Handlers 测试
 */

import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { getActorDetail, getActorList } from '../../handlers/actors.handler'
import * as actorService from '../../services/actor.service'
import * as authService from '../../services/auth.service'

describe('actors Handlers', () => {
  describe('getActorList', () => {
    it('应该返回演员列表', async () => {
      const mockGetActors = vi.spyOn(actorService, 'getActors').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      })

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/actors', getActorList)

      const req = new Request('http://localhost/actors?page=1&limit=20')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockGetActors).toHaveBeenCalledWith({
        db: mockDb,
        page: 1,
        pageSize: 20,
        sort: 'name',
        nationality: undefined,
        isActive: undefined,
        hasDetails: undefined,
      })

      mockGetActors.mockRestore()
    })

    it('应该解析查询参数', async () => {
      const mockGetActors = vi.spyOn(actorService, 'getActors').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      })

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/actors', getActorList)

      const req = new Request('http://localhost/actors?page=2&limit=50&sort=movieCount&nationality=JP&isActive=true')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockGetActors).toHaveBeenCalledWith({
        db: mockDb,
        page: 2,
        pageSize: 50,
        sort: 'movieCount',
        nationality: 'JP',
        isActive: true,
        hasDetails: undefined,
      })

      mockGetActors.mockRestore()
    })

    it('应该处理数据库错误', async () => {
      const mockGetActors = vi.spyOn(actorService, 'getActors').mockRejectedValue(new Error('DB Error'))

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/actors', getActorList)

      const req = new Request('http://localhost/actors')
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const json: any = await res.json()
      expect(json.error).toBe('Database operation failed')

      mockGetActors.mockRestore()
    })
  })

  describe('getActorDetail', () => {
    it('应该返回演员详情', async () => {
      const mockActor = {
        id: '1',
        name: 'Test Actor',
        slug: 'test-actor',
        relatedMovies: [],
      }
      const mockGetActor = vi.spyOn(actorService, 'getActorBySlug').mockResolvedValue(mockActor as any)
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/actors/:slug', getActorDetail)

      const req = new Request('http://localhost/actors/test-actor')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.name).toBe('Test Actor')
      expect(mockGetActor).toHaveBeenCalledWith({
        db: mockDb,
        slug: 'test-actor',
      })

      mockGetActor.mockRestore()
    })

    it('应该在演员不存在时返回 404', async () => {
      const mockGetActor = vi.spyOn(actorService, 'getActorBySlug').mockResolvedValue(null)
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/actors/:slug', getActorDetail)

      const req = new Request('http://localhost/actors/non-existent')
      const res = await app.fetch(req)

      expect(res.status).toBe(404)

      mockGetActor.mockRestore()
    })

    it('应该验证 R18 权限', async () => {
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(false)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/actors/:slug', getActorDetail)

      const req = new Request('http://localhost/actors/test-actor')
      const res = await app.fetch(req)

      expect(res.status).toBe(403)
      const json: any = await res.json()
      expect(json.error).toBe('Adult verification required')
    })
  })
})
