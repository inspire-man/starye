import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHotMoviesList, getMovieDetail, getMovieList } from '../../handlers/movies.handler'
import * as authService from '../../services/auth.service'
import * as movieService from '../../services/movie.service'

describe('movies handlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('getMovieList', () => {
    it('应该解析 query 参数并调用 getMovies service', async () => {
      const mockGetMovies = vi.spyOn(movieService, 'getMovies').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 24, totalPages: 0 },
      })
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = {} as any

      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        await next()
      })
      app.get('/movies', getMovieList)

      const req = new Request('http://localhost/movies?page=2&limit=10&genre=action&actor=test&publisherId=pub1&search=keyword')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(_mockCheckAdult).toHaveBeenCalled()
      expect(mockGetMovies).toHaveBeenCalledWith({
        db: mockDb,
        isAdult: true,
        page: 2,
        pageSize: 10,
        genre: 'action',
        actor: 'test',
        publisherId: 'pub1',
        searchKeyword: 'keyword',
      })
    })

    it('应该使用默认值处理缺失的 query 参数', async () => {
      const mockGetMovies = vi.spyOn(movieService, 'getMovies').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 24, totalPages: 0 },
      })
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(false)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = {} as any

      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        await next()
      })
      app.get('/movies', getMovieList)

      const req = new Request('http://localhost/movies')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockGetMovies).toHaveBeenCalledWith({
        db: mockDb,
        isAdult: false,
        page: 1,
        pageSize: 24,
        genre: undefined,
        actor: undefined,
        publisherId: undefined,
        searchKeyword: undefined,
      })
    })
  })

  describe('getMovieDetail', () => {
    it('应该返回电影详情', async () => {
      const mockMovie = { id: '1', title: 'Test Movie', isR18: false }
      const mockGetMovie = vi.spyOn(movieService, 'getMovieByIdentifier').mockResolvedValue(mockMovie as any)
      const _mockCheckAdult = vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = {
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      } as any

      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        await next()
      })
      app.get('/movies/:identifier', getMovieDetail)

      const req = new Request('http://localhost/movies/test-slug')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data).toEqual(mockMovie)
      expect(_mockCheckAdult).toHaveBeenCalled()
      expect(mockGetMovie).toHaveBeenCalledWith({
        db: mockDb,
        identifier: 'test-slug',
        isAdult: true,
        userId: undefined,
      })
    })

    it('应该在电影不存在时返回 404', async () => {
      vi.spyOn(movieService, 'getMovieByIdentifier').mockResolvedValue(null)
      vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = {
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      } as any

      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        await next()
      })
      app.get('/movies/:identifier', getMovieDetail)

      const req = new Request('http://localhost/movies/nonexistent')
      const res = await app.fetch(req)

      expect(res.status).toBe(404)
    })

    it('应该正确传递 isAdult 参数到 service', async () => {
      const mockGetMovie = vi.spyOn(movieService, 'getMovieByIdentifier').mockResolvedValue({ id: '1' } as any)
      vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(false)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = {
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      } as any

      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        await next()
      })
      app.get('/movies/:identifier', getMovieDetail)

      const req = new Request('http://localhost/movies/test')
      await app.fetch(req)

      expect(mockGetMovie).toHaveBeenCalledWith({
        db: mockDb,
        identifier: 'test',
        isAdult: false,
        userId: undefined,
      })
    })
  })

  describe('getHotMoviesList', () => {
    it('应该返回热门电影列表', async () => {
      const mockMovies = [{ id: '1', title: 'Hot Movie' }]
      const mockGetHot = vi.spyOn(movieService, 'getHotMovies').mockResolvedValue(mockMovies as any)
      vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(true)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = {} as any

      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        await next()
      })
      app.get('/movies/featured/hot', getHotMoviesList)

      const req = new Request('http://localhost/movies/featured/hot?limit=5')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data).toEqual(mockMovies)
      expect(mockGetHot).toHaveBeenCalledWith({
        db: mockDb,
        isAdult: true,
        limit: 5,
      })
    })

    it('应该使用默认 limit=12', async () => {
      const mockGetHot = vi.spyOn(movieService, 'getHotMovies').mockResolvedValue([])
      vi.spyOn(authService, 'checkUserAdultStatus').mockResolvedValue(false)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = {} as any

      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        await next()
      })
      app.get('/movies/featured/hot', getHotMoviesList)

      const req = new Request('http://localhost/movies/featured/hot')
      await app.fetch(req)

      expect(mockGetHot).toHaveBeenCalledWith({
        db: mockDb,
        isAdult: false,
        limit: 12,
      })
    })
  })
})
