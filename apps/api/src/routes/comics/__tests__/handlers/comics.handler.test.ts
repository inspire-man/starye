/**
 * Comics Handlers 测试
 */

import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { getComicDetail, getComicList } from '../../handlers/comics.handler'
import * as authService from '../../services/auth.service'
import * as comicService from '../../services/comic.service'

describe('comics Handlers', () => {
  describe('getComicList', () => {
    it('应该返回漫画列表', async () => {
      const mockGetComics = vi.spyOn(comicService, 'getComics').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      })
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/comics', getComicList)

      const req = new Request('http://localhost/comics?page=1&limit=20')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockGetComics).toHaveBeenCalledWith({
        db: mockDb,
        isAdult: true,
        page: 1,
        pageSize: 20,
        region: undefined,
        genre: undefined,
        status: undefined,
      })

      mockGetComics.mockRestore()
    })

    it('应该解析查询参数', async () => {
      const mockGetComics = vi.spyOn(comicService, 'getComics').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      })
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/comics', getComicList)

      const req = new Request('http://localhost/comics?page=2&limit=50&region=JP&genre=action')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockGetComics).toHaveBeenCalledWith({
        db: mockDb,
        isAdult: true,
        page: 2,
        pageSize: 50,
        region: 'JP',
        genre: 'action',
        status: undefined,
      })

      mockGetComics.mockRestore()
    })
  })

  describe('getComicDetail', () => {
    it('应该返回漫画详情', async () => {
      const mockComic = {
        id: '1',
        title: 'Test Comic',
        slug: 'test-comic',
      }
      const mockGetComic = vi.spyOn(comicService, 'getComicBySlug').mockResolvedValue(mockComic as any)
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/comics/:slug', getComicDetail)

      const req = new Request('http://localhost/comics/test-comic')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json).toBeDefined()

      mockGetComic.mockRestore()
    })

    it('应该在漫画不存在时返回 404', async () => {
      const mockGetComic = vi.spyOn(comicService, 'getComicBySlug').mockResolvedValue(null)
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/comics/:slug', getComicDetail)

      const req = new Request('http://localhost/comics/non-existent')
      const res = await app.fetch(req)

      expect(res.status).toBe(404)

      mockGetComic.mockRestore()
    })
  })
})
