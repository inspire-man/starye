import type { Context } from 'hono'
import type { AppEnv, SessionUser } from '../types'
import { actors as actorsTable, movies as moviesTable, players as playersTable, publishers as publishersTable } from '@starye/db/schema'
import { and, count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requireAuth } from '../middleware/guard'
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

  // 同步女优数据
  if (data.actors && Array.isArray(data.actors)) {
    for (const actorName of data.actors) {
      if (!actorName || !actorName.trim())
        continue

      const slug = actorName.toLowerCase().replace(/\s+/g, '-')

      // 检查是否存在
      const existingActor = await db.query.actors.findFirst({
        where: eq(actorsTable.name, actorName),
      })

      if (existingActor) {
        // 更新作品数量
        await db.update(actorsTable)
          .set({
            movieCount: sql`${actorsTable.movieCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(actorsTable.id, existingActor.id))
      }
      else {
        // 新增女优
        await db.insert(actorsTable).values({
          id: crypto.randomUUID(),
          name: actorName,
          slug,
          movieCount: 1,
          isR18: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
    }
  }

  // 同步厂商数据
  if (data.publisher && data.publisher.trim()) {
    const publisherName = data.publisher.trim()
    const slug = publisherName.toLowerCase().replace(/\s+/g, '-')

    // 检查是否存在
    const existingPublisher = await db.query.publishers.findFirst({
      where: eq(publishersTable.name, publisherName),
    })

    if (existingPublisher) {
      // 更新作品数量
      await db.update(publishersTable)
        .set({
          movieCount: sql`${publishersTable.movieCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(publishersTable.id, existingPublisher.id))
    }
    else {
      // 新增厂商
      await db.insert(publishersTable).values({
        id: crypto.randomUUID(),
        name: publisherName,
        slug,
        movieCount: 1,
        isR18: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
  }

  return c.json({ success: true, id: movieId })
})

// 1. 获取电影列表 (带分页和过滤)
movies.get('/', requireAuth(['movie_admin']), async (c) => {
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
movies.get('/:slug', requireAuth(['movie_admin']), async (c) => {
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

// 4. 获取热门电影（按创建时间排序，最新的）
movies.get('/featured/hot', requireAuth(['movie_admin']), async (c) => {
  const db = c.get('db')
  const isAdult = await checkIsAdult(c)

  const limit = Number(c.req.query('limit')) || 12

  const results = await db.query.movies.findMany({
    columns: {
      title: true,
      slug: true,
      code: true,
      coverImage: true,
      releaseDate: true,
      isR18: true,
      actors: true,
      genres: true,
    },
    orderBy: (movies, { desc }) => [desc(movies.createdAt)],
    limit,
  })

  // R18 保护
  const safeResults = results.map((movie) => {
    if (movie.isR18 && !isAdult) {
      return { ...movie, coverImage: null }
    }
    return movie
  })

  return c.json({ data: safeResults })
})

// 5. 获取所有女优列表（从独立表查询）
movies.get('/actors/list', requireAuth(['movie_admin']), async (c) => {
  const db = c.get('db')
  const isAdult = await checkIsAdult(c)

  if (!isAdult) {
    throw new HTTPException(403, { message: 'Adult verification required' })
  }

  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 50
  const offset = (page - 1) * limit

  const [results, totalResult] = await Promise.all([
    db.query.actors.findMany({
      columns: {
        id: true,
        name: true,
        slug: true,
        avatar: true,
        movieCount: true,
      },
      orderBy: (actors, { desc }) => [desc(actors.movieCount)],
      limit,
      offset,
    }),
    db.select({ value: count() }).from(actorsTable).then(res => res[0].value),
  ])

  return c.json({
    data: results,
    meta: {
      total: totalResult,
      page,
      limit,
      totalPages: Math.ceil(totalResult / limit),
    },
  })
})

// 6. 获取女优详情（包含作品列表）
movies.get('/actors/:slug', requireAuth(['movie_admin']), async (c) => {
  const db = c.get('db')
  const isAdult = await checkIsAdult(c)
  const actorSlug = c.req.param('slug')

  if (!isAdult) {
    throw new HTTPException(403, { message: 'Adult verification required' })
  }

  // 查询女优信息
  const actor = await db.query.actors.findFirst({
    where: eq(actorsTable.slug, actorSlug),
  })

  if (!actor) {
    throw new HTTPException(404, { message: 'Actor not found' })
  }

  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 24
  const offset = (page - 1) * limit

  // 查询包含该女优的所有电影
  const [results, totalResult] = await Promise.all([
    db.query.movies.findMany({
      where: sql`${moviesTable.actors} LIKE ${`%${actor.name}%`}`,
      columns: {
        title: true,
        slug: true,
        code: true,
        coverImage: true,
        releaseDate: true,
        isR18: true,
        actors: true,
        genres: true,
      },
      orderBy: (movies, { desc }) => [desc(movies.releaseDate)],
      limit,
      offset,
    }),
    db
      .select({ value: count() })
      .from(moviesTable)
      .where(sql`${moviesTable.actors} LIKE ${`%${actor.name}%`}`)
      .then(res => res[0].value),
  ])

  return c.json({
    data: {
      ...actor,
      movies: results,
    },
    meta: {
      total: totalResult,
      page,
      limit,
      totalPages: Math.ceil(totalResult / limit),
    },
  })
})

// 7. 获取所有厂商列表（从独立表查询）
movies.get('/publishers/list', requireAuth(['movie_admin']), async (c) => {
  const db = c.get('db')
  const isAdult = await checkIsAdult(c)

  if (!isAdult) {
    throw new HTTPException(403, { message: 'Adult verification required' })
  }

  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 50
  const offset = (page - 1) * limit

  const [results, totalResult] = await Promise.all([
    db.query.publishers.findMany({
      columns: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        movieCount: true,
      },
      orderBy: (publishers, { desc }) => [desc(publishers.movieCount)],
      limit,
      offset,
    }),
    db.select({ value: count() }).from(publishersTable).then(res => res[0].value),
  ])

  return c.json({
    data: results,
    meta: {
      total: totalResult,
      page,
      limit,
      totalPages: Math.ceil(totalResult / limit),
    },
  })
})

// 8. 获取厂商详情（包含作品列表）
movies.get('/publishers/:slug', requireAuth(['movie_admin']), async (c) => {
  const db = c.get('db')
  const isAdult = await checkIsAdult(c)
  const publisherSlug = c.req.param('slug')

  if (!isAdult) {
    throw new HTTPException(403, { message: 'Adult verification required' })
  }

  // 查询厂商信息
  const publisher = await db.query.publishers.findFirst({
    where: eq(publishersTable.slug, publisherSlug),
  })

  if (!publisher) {
    throw new HTTPException(404, { message: 'Publisher not found' })
  }

  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 24
  const offset = (page - 1) * limit

  // 查询该厂商的所有电影
  const [results, totalResult] = await Promise.all([
    db.query.movies.findMany({
      where: eq(moviesTable.publisher, publisher.name),
      columns: {
        title: true,
        slug: true,
        code: true,
        coverImage: true,
        releaseDate: true,
        isR18: true,
        actors: true,
        genres: true,
        publisher: true,
      },
      orderBy: (movies, { desc }) => [desc(movies.releaseDate)],
      limit,
      offset,
    }),
    db
      .select({ value: count() })
      .from(moviesTable)
      .where(eq(moviesTable.publisher, publisher.name))
      .then(res => res[0].value),
  ])

  return c.json({
    data: {
      ...publisher,
      movies: results,
    },
    meta: {
      total: totalResult,
      page,
      limit,
      totalPages: Math.ceil(totalResult / limit),
    },
  })
})

// 9. 获取所有类型/标签列表（从 genres 字段提取）
movies.get('/genres/list', requireAuth(['movie_admin']), async (c) => {
  const db = c.get('db')
  const isAdult = await checkIsAdult(c)

  if (!isAdult) {
    throw new HTTPException(403, { message: 'Adult verification required' })
  }

  // 获取所有电影的 genres 字段
  const allMovies = await db.query.movies.findMany({
    columns: {
      genres: true,
    },
  })

  // 提取并统计所有类型
  const genreCountMap = new Map<string, number>()

  allMovies.forEach((movie) => {
    const genres = movie.genres as string[] | null
    if (genres && Array.isArray(genres)) {
      genres.forEach((genre) => {
        if (genre && genre.trim()) {
          const count = genreCountMap.get(genre) || 0
          genreCountMap.set(genre, count + 1)
        }
      })
    }
  })

  // 转换为数组并排序（按作品数量降序）
  const genreList = Array.from(genreCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return c.json({ data: genreList })
})

// 10. 获取首页数据（热门影片 + 热门女优）
movies.get('/home/featured', requireAuth(['movie_admin']), async (c) => {
  const db = c.get('db')
  const isAdult = await checkIsAdult(c)

  // 获取最新的 12 部电影
  const latestMovies = await db.query.movies.findMany({
    columns: {
      title: true,
      slug: true,
      code: true,
      coverImage: true,
      releaseDate: true,
      isR18: true,
      actors: true,
    },
    orderBy: (movies, { desc }) => [desc(movies.createdAt)],
    limit: 12,
  })

  // R18 保护
  const safeMovies = latestMovies.map((movie) => {
    if (movie.isR18 && !isAdult) {
      return { ...movie, coverImage: null }
    }
    return movie
  })

  // 获取热门女优（作品数量最多的前 10 位）
  let topActors: Array<{ name: string, slug: string, avatar: string | null, count: number }> = []

  if (isAdult) {
    const actors = await db.query.actors.findMany({
      columns: {
        name: true,
        slug: true,
        avatar: true,
        movieCount: true,
      },
      orderBy: (actors, { desc }) => [desc(actors.movieCount)],
      limit: 10,
    })

    topActors = actors.map(actor => ({
      name: actor.name,
      slug: actor.slug,
      avatar: actor.avatar,
      count: actor.movieCount,
    }))
  }

  return c.json({
    data: {
      latestMovies: safeMovies,
      topActors,
    },
  })
})

export default movies
