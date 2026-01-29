import type { Context } from 'hono'
import type { AppEnv, SessionUser } from '../types'
import { movies as moviesTable, players as playersTable } from '@starye/db/schema'
import { and, count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { serviceAuth } from '../middleware/service-auth'

const movies = new Hono<AppEnv>()

// --- 辅助函数：检查成人状态 ---
async function checkIsAdult(c: Context<AppEnv>) {
  const auth = c.get('auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  const user = session?.user as SessionUser | undefined
  return user?.isAdult === true
}

// 3. 同步电影数据 (Crawler)
movies.post('/sync', serviceAuth(), async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const { type, data } = body

  if (type !== 'movie' || !data) {
    throw new HTTPException(400, { message: 'Invalid payload' })
  }

  // 映射数据
  const code = data.code || data.slug
  const movieData = {
    title: data.title,
    slug: data.slug,
    code,
    description: data.description,
    coverImage: data.coverImage,
    releaseDate: data.releaseDate ? new Date(data.releaseDate * 1000) : null,
    duration: data.duration,
    sourceUrl: data.sourceUrl,
    actors: data.actors || [],
    genres: data.genres || [],
    series: data.series,
    publisher: data.publisher,
    isR18: data.isR18,
  }

  // 查找是否存在 (优先匹配 code)
  const existing = await db.query.movies.findFirst({
    where: (movies, { eq }) => eq(movies.code, code),
  })

  let movieId = existing?.id

  if (existing) {
    // 更新
    await db.update(moviesTable)
      .set({
        ...movieData,
        updatedAt: new Date(),
      })
      .where(eq(moviesTable.id, existing.id))
  }
  else {
    // 新增
    movieId = crypto.randomUUID()
    await db.insert(moviesTable).values({
      id: movieId,
      ...movieData,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  // 处理播放源 (全量覆盖)
  if (movieId && data.players && Array.isArray(data.players)) {
    // 删除旧的
    await db.delete(playersTable).where(eq(playersTable.movieId, movieId))

    // 插入新的
    if (data.players.length > 0) {
      const newPlayers = data.players.map((p: any, index: number) => ({
        id: crypto.randomUUID(),
        movieId: movieId!,
        sourceName: p.sourceName || 'Unknown',
        sourceUrl: p.sourceUrl,
        quality: p.quality,
        sortOrder: p.sortOrder || index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      await db.insert(playersTable).values(newPlayers)
    }
  }

  return c.json({ success: true, id: movieId })
})

// 1. 获取电影列表 (带分页和过滤)
movies.get('/', async (c) => {
  const db = c.get('db')
  const isAdult = await checkIsAdult(c)

  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 24
  const offset = (page - 1) * limit

  const genre = c.req.query('genre')
  const actor = c.req.query('actor')

  const conditions = []
  if (genre)
    conditions.push(sql`${moviesTable.genres} LIKE ${`%${genre}%`}`)
  if (actor)
    conditions.push(sql`${moviesTable.actors} LIKE ${`%${actor}%`}`)

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [results, totalResult] = await Promise.all([
    db.query.movies.findMany({
      where: whereClause,
      columns: {
        title: true,
        slug: true,
        code: true,
        coverImage: true,
        releaseDate: true,
        isR18: true,
      },
      orderBy: (movies, { desc }) => [desc(movies.createdAt)],
      limit,
      offset,
    }),
    db.select({ value: count() }).from(moviesTable).where(whereClause).then(res => res[0].value),
  ])

  // R18 保护
  const safeResults = results.map((movie) => {
    if (movie.isR18 && !isAdult) {
      return { ...movie, coverImage: null }
    }
    return movie
  })

  return c.json({
    data: safeResults,
    meta: {
      total: totalResult,
      page,
      limit,
      totalPages: Math.ceil(totalResult / limit),
    },
  })
})

// 2. 获取电影详情
movies.get('/:slug', async (c) => {
  const db = c.get('db')
  const slug = c.req.param('slug')
  const isAdult = await checkIsAdult(c)

  const movie = await db.query.movies.findFirst({
    where: (movies, { eq }) => eq(movies.slug, slug),
    with: {
      players: {
        orderBy: (players, { asc }) => [asc(players.sortOrder)],
      },
    },
  })

  if (!movie) {
    throw new HTTPException(404, { message: 'Movie not found' })
  }

  // R18 保护
  if (movie.isR18 && !isAdult) {
    return c.json({
      data: {
        ...movie,
        coverImage: null,
        players: [],
      },
    })
  }

  return c.json({ data: movie })
})

export default movies
