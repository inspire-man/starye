import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHotMovies, getMovieByIdentifier, getMovies } from '../../routes/movies/services/movie.service'
import { createMockDb } from '../../test/helpers'

describe('movieService', () => {
  let mockDb: any

  beforeEach(() => {
    mockDb = createMockDb()
  })

  describe('getMovies', () => {
    it('应该返回电影列表和分页信息', async () => {
      const mockMovies = [
        {
          id: '1',
          title: 'Test Movie',
          slug: 'test-movie',
          code: 'TEST-001',
          coverImage: 'cover.jpg',
          releaseDate: new Date(),
          isR18: false,
          movieActors: [],
          moviePublishers: [],
        },
      ]

      mockDb.query.movies.findMany.mockReturnValue(mockMovies)
      mockDb.select().from().where().then = vi.fn(cb => cb([{ value: 10 }]))

      const result = await getMovies({
        db: mockDb,
        isAdult: true,
        page: 1,
        pageSize: 24,
      })

      expect(result.data).toHaveLength(1)
      expect(result.meta.total).toBe(10)
      expect(result.meta.page).toBe(1)
    })

    it('应该为非成人用户保留成人目录封面', async () => {
      const mockMovies = [
        {
          id: '1',
          title: 'Adult Movie',
          slug: 'adult-movie',
          code: 'ADULT-001',
          coverImage: 'cover.jpg',
          releaseDate: new Date(),
          isR18: true,
          movieActors: [],
          moviePublishers: [],
        },
      ]

      mockDb.query.movies.findMany.mockReturnValue(mockMovies)
      mockDb.select().from().where().then = vi.fn().mockResolvedValue([{ value: 1 }])

      const result = await getMovies({
        db: mockDb,
        isAdult: false,
        page: 1,
        pageSize: 24,
      })

      expect(result.data[0].coverImage).toBe('cover.jpg')
    })

    it('应该正确应用分页参数', async () => {
      const mockMovies = Array.from({ length: 5 }, (_, i) => ({
        id: String(i + 1),
        title: `Movie ${i + 1}`,
        slug: `movie-${i + 1}`,
        code: `M-00${i + 1}`,
        coverImage: `/cover${i + 1}.jpg`,
        releaseDate: new Date('2024-01-01'),
        isR18: false,
        movieActors: [],
        moviePublishers: [],
      }))

      mockDb.query.movies.findMany.mockReturnValue(mockMovies)
      mockDb.select().from().where().then = vi.fn().mockResolvedValue([{ value: 100 }])

      await getMovies({
        db: mockDb,
        isAdult: true,
        page: 2,
        pageSize: 10,
      })

      // 验证 findMany 被调用，并传入了 limit 和 offset
      expect(mockDb.query.movies.findMany).toHaveBeenCalled()
      const callArgs = mockDb.query.movies.findMany.mock.calls[0][0]
      expect(callArgs.limit).toBe(10)
      expect(callArgs.offset).toBe(10) // (2-1) * 10
    })
  })

  describe('getMovieByIdentifier', () => {
    it('应该通过 slug 查找电影', async () => {
      const mockMovie = {
        id: '1',
        title: 'Test Movie',
        slug: 'test-movie',
        code: 'TEST-001',
        isR18: false,
        movieActors: [],
        moviePublishers: [],
        players: [],
      }

      mockDb.query.movies.findFirst.mockResolvedValue(mockMovie)
      mockDb.query.movieActors.findMany.mockResolvedValue([])

      const result = await getMovieByIdentifier({
        db: mockDb,
        identifier: 'test-movie',
        isAdult: true,
      })

      expect(result).toBeDefined()
      expect(result?.slug).toBe('test-movie')
    })

    it('应该通过 code 查找电影', async () => {
      const mockMovie = {
        id: '1',
        title: 'Test Movie',
        slug: 'test-movie',
        code: 'TEST-001',
        isR18: false,
        movieActors: [],
        moviePublishers: [],
        players: [],
      }

      mockDb.query.movies.findFirst.mockResolvedValue(mockMovie)
      mockDb.query.movieActors.findMany.mockResolvedValue([])

      const result = await getMovieByIdentifier({
        db: mockDb,
        identifier: 'TEST-001',
        isAdult: true,
      })

      expect(result).toBeDefined()
      expect(result?.code).toBe('TEST-001')
    })

    it('应该在电影不存在时返回 null', async () => {
      mockDb.query.movies.findFirst.mockResolvedValue(null)

      const result = await getMovieByIdentifier({
        db: mockDb,
        identifier: 'nonexistent',
        isAdult: true,
      })

      expect(result).toBeNull()
    })

    it('应该在非成人用户访问成人内容时隐藏播放源', async () => {
      const mockMovie = {
        id: '1',
        title: 'Adult Movie',
        slug: 'adult-movie',
        code: 'ADULT-001',
        isR18: true,
        movieActors: [],
        moviePublishers: [],
        players: [{ id: '1', sourceName: 'Source 1' }],
      }

      mockDb.query.movies.findFirst.mockResolvedValue(mockMovie)
      mockDb.query.movieActors.findMany.mockResolvedValue([])

      const result = await getMovieByIdentifier({
        db: mockDb,
        identifier: 'adult-movie',
        isAdult: false,
      })

      expect(result?.players).toEqual([])
    })

    it('应该从 server-owned source state 返回独立 readiness projection', async () => {
      const mockMovie = {
        id: 'movie-1',
        title: 'SUN-064',
        slug: 'sun-064',
        code: 'SUN-064',
        isR18: false,
        updatedAt: new Date('2026-08-05T00:00:00.000Z'),
        sourceState: {
          sourceRevision: 8,
          disposition: 'no_source',
          eligibleCount: 0,
          repairable: true,
          reasonCode: 'no_eligible_source',
          observedAt: new Date('2026-08-05T00:00:00.000Z'),
        },
        movieActors: [],
        moviePublishers: [],
        players: [{ id: 'player-1', sourceName: 'candidate', sourceUrl: 'https://media.example/movie.m3u8', isActive: true }],
      }

      mockDb.query.movies.findFirst.mockResolvedValue(mockMovie)

      const result = await getMovieByIdentifier({
        db: mockDb,
        identifier: 'SUN-064',
        isAdult: true,
      })

      expect(result?.primaryContentId).toBe('movie-1')
      expect(result?.readiness).toMatchObject({
        metadata: { contentId: 'movie-1', persisted: false },
        source: { disposition: 'no_source', eligibleCount: 0, repairable: true },
        playback: { status: 'unverified' },
      })
    })
  })

  describe('getHotMovies', () => {
    it('应该返回热门电影列表', async () => {
      const mockMovies = [
        {
          id: '1',
          title: 'Hot Movie 1',
          slug: 'hot-movie-1',
          code: 'HOT-001',
          isR18: false,
          movieActors: [],
        },
        {
          id: '2',
          title: 'Hot Movie 2',
          slug: 'hot-movie-2',
          code: 'HOT-002',
          isR18: false,
          movieActors: [],
        },
      ]

      mockDb.query.movies.findMany.mockResolvedValue(mockMovies)

      const result = await getHotMovies({
        db: mockDb,
        isAdult: true,
        limit: 12,
      })

      expect(result).toHaveLength(2)
    })

    it('应该使用默认 limit 值', async () => {
      mockDb.query.movies.findMany.mockResolvedValue([])

      await getHotMovies({
        db: mockDb,
        isAdult: true,
      })

      expect(mockDb.query.movies.findMany).toHaveBeenCalled()
    })
  })
})
