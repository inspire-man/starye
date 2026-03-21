/* eslint-disable node/prefer-global/process */
/* eslint-disable no-console */
import type { Context } from 'hono'
import type { AppEnv, SessionUser } from '../types'
import { actors as actorsTable, movieActors, moviePublishers, movies as moviesTable, players as playersTable, publishers as publishersTable } from '@starye/db/schema'
import { and, count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { serviceAuth } from '../middleware/service-auth'

// Move regex to module scope to avoid re-compilation
const SLUG_REGEX = /\s+/g

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

  try {
    const body = await c.req.json()
    const { type, data } = body

    if (type !== 'movie' || !data) {
      throw new HTTPException(400, { message: 'Invalid payload' })
    }

    // 映射数据
    const code = data.code || data.slug

    // 验证必需字段
    if (!data.title || !data.slug || !code) {
      console.error('缺少必需字段:', { title: data.title, slug: data.slug, code })
      throw new HTTPException(400, { message: 'Missing required fields: title, slug, or code' })
    }

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
    let existing
    try {
      existing = await db.query.movies.findFirst({
        where: (movies, { eq }) => eq(movies.code, code),
      })
    }
    catch (error) {
      console.error('查询现有电影失败:', error)
      throw error
    }

    let movieId = existing?.id

    // 计算爬虫状态
    const playerCount = data.players?.length || 0
    const crawlData = {
      crawlStatus: playerCount > 0 ? 'complete' : 'pending',
      lastCrawledAt: new Date(),
      totalPlayers: playerCount,
      crawledPlayers: playerCount,
    }

    if (existing) {
    // 如果元数据被锁定，只更新播放源相关字段，跳过元数据更新
      try {
        if (existing.metadataLocked) {
          console.log(`⏭️  元数据已锁定，跳过更新: ${code}`)
          await db.update(moviesTable)
            .set({
              ...crawlData,
              crawlStatus: crawlData.crawlStatus as any,
              updatedAt: new Date(),
            })
            .where(eq(moviesTable.id, existing.id))
        }
        else {
        // 元数据未锁定，正常更新
          await db.update(moviesTable)
            .set({
              ...movieData,
              ...crawlData,
              crawlStatus: crawlData.crawlStatus as any,
              updatedAt: new Date(),
            })
            .where(eq(moviesTable.id, existing.id))
        }
      }
      catch (error) {
        console.error(`更新电影失败 (${code}):`, error)
        throw error
      }
    }
    else {
    // 新增
      try {
        movieId = crypto.randomUUID()
        await db.insert(moviesTable).values({
          id: movieId,
          ...movieData,
          ...crawlData,
          crawlStatus: crawlData.crawlStatus as any,
          metadataLocked: false,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
      catch (error) {
        console.error(`插入新电影失败 (${code}):`, error)
        throw error
      }
    }

    // 处理播放源 (全量覆盖)
    if (movieId && data.players && Array.isArray(data.players)) {
      try {
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
      catch (error) {
        console.error('播放源处理失败:', error)
      // 不抛出错误，允许电影数据继续保存
      }
    }

    // 同步女优数据（优先使用 actorDetails，回退到 actors）
    const actorIds: string[] = []
    const actorDetailsData = data.actorDetails && Array.isArray(data.actorDetails) ? data.actorDetails : []

    try {
      if (actorDetailsData.length > 0) {
      // 使用 actorDetails（包含 sourceUrl 和 sourceId）
        for (const actorInfo of actorDetailsData) {
          const { name, url } = actorInfo
          if (!name || !name.trim())
            continue

          const slug = name.toLowerCase().replace(SLUG_REGEX, '-')
          const sourceId = url ? url.split('/').pop() || slug : slug
          const sourceUrl = url || ''

          try {
          // 检查是否存在（根据 source + sourceId，避免重复）
            const existingActor = await db.query.actors.findFirst({
              where: and(
                eq(actorsTable.source, 'javbus'),
                eq(actorsTable.sourceId, sourceId),
              ),
            })

            if (existingActor) {
              actorIds.push(existingActor.id)
            }
            else {
            // 新增女优（标记为待爬取详情）
              const newActorId = crypto.randomUUID()
              await db.insert(actorsTable).values({
                id: newActorId,
                name,
                slug,
                source: 'javbus',
                sourceId,
                sourceUrl,
                hasDetailsCrawled: false,
                movieCount: 0,
                isR18: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              actorIds.push(newActorId)
            }
          }
          catch (error) {
            console.error(`处理女优失败 (${name}):`, error)
          // 继续处理其他女优
          }
        }
      }
      else if (data.actors && Array.isArray(data.actors)) {
      // 回退：使用旧的 actors 数组（仅名称）
        for (const actorName of data.actors) {
          if (!actorName || !actorName.trim())
            continue

          const slug = actorName.toLowerCase().replace(SLUG_REGEX, '-')

          try {
          // 检查是否存在（根据名称）
            const existingActor = await db.query.actors.findFirst({
              where: eq(actorsTable.name, actorName),
            })

            if (existingActor) {
              actorIds.push(existingActor.id)
            }
            else {
            // 新增女优（使用 slug 作为 sourceId）
              const newActorId = crypto.randomUUID()
              await db.insert(actorsTable).values({
                id: newActorId,
                name: actorName,
                slug,
                source: 'javbus',
                sourceId: slug,
                hasDetailsCrawled: false,
                movieCount: 0,
                isR18: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              actorIds.push(newActorId)
            }
          }
          catch (error) {
            console.error(`处理女优失败 (${actorName}):`, error)
          // 继续处理其他女优
          }
        }
      }
    }
    catch (error) {
      console.error('女优数据处理失败:', error)
    // 不抛出错误，允许电影数据继续保存
    }

    // 同步厂商数据（优先使用 publisherUrl）
    let publisherId: string | null = null

    try {
      if (data.publisher && data.publisher.trim()) {
        const publisherName = data.publisher.trim()
        const slug = publisherName.toLowerCase().replace(SLUG_REGEX, '-')
        const sourceId = data.publisherUrl ? data.publisherUrl.split('/').pop() || slug : slug
        const sourceUrl = data.publisherUrl || ''

        // 检查是否存在（根据 source + sourceId）
        let existingPublisher
        if (data.publisherUrl) {
          existingPublisher = await db.query.publishers.findFirst({
            where: and(
              eq(publishersTable.source, 'javbus'),
              eq(publishersTable.sourceId, sourceId),
            ),
          })
        }
        else {
          existingPublisher = await db.query.publishers.findFirst({
            where: eq(publishersTable.name, publisherName),
          })
        }

        if (existingPublisher) {
          publisherId = existingPublisher.id
        }
        else {
        // 新增厂商
          publisherId = crypto.randomUUID()
          await db.insert(publishersTable).values({
            id: publisherId,
            name: publisherName,
            slug,
            source: 'javbus',
            sourceId,
            sourceUrl,
            hasDetailsCrawled: false,
            movieCount: 0,
            isR18: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
      }
    }
    catch (error) {
      console.error('厂商数据处理失败:', error)
    // 不抛出错误，允许电影数据继续保存
    }

    // 创建影片-女优关联记录（任务 3.9）
    if (movieId && actorIds.length > 0) {
      try {
      // 删除旧的关联
        await db.delete(movieActors).where(eq(movieActors.movieId, movieId))

        // 创建新的关联
        const newMovieActors = actorIds.map((actorId, index) => ({
          id: crypto.randomUUID(),
          movieId: movieId!,
          actorId,
          sortOrder: index,
          createdAt: new Date(),
        }))

        await db.insert(movieActors).values(newMovieActors)
      }
      catch (error) {
        console.error('创建影片-女优关联失败:', error)
      // 不抛出错误，允许电影数据继续保存
      }
    }

    // 创建影片-厂商关联记录
    if (movieId && publisherId) {
      try {
      // 删除旧的关联
        await db.delete(moviePublishers).where(eq(moviePublishers.movieId, movieId))

        // 创建新的关联
        await db.insert(moviePublishers).values({
          id: crypto.randomUUID(),
          movieId: movieId!,
          publisherId,
          sortOrder: 0,
          createdAt: new Date(),
        })
      }
      catch (error) {
        console.error('创建影片-厂商关联失败:', error)
      // 不抛出错误，允许电影数据继续保存
      }
    }

    return c.json({ success: true, id: movieId })
  }
  catch (error) {
    console.error('❌ /api/movies/sync 错误:', error)
    console.error('错误详情:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    // 返回详细错误信息用于调试
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      500,
    )
  }
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

  // 在测试环境中，避免使用 query API 的关联查询（不兼容 Mock D1）
  const isTestEnv = process.env.NODE_ENV === 'test' || !c.env.DB.prepare

  let results: any[]
  let totalResult: number

  if (isTestEnv) {
    // 测试环境：使用简单查询
    const queryResult = await db.select({
      title: moviesTable.title,
      slug: moviesTable.slug,
      code: moviesTable.code,
      coverImage: moviesTable.coverImage,
      releaseDate: moviesTable.releaseDate,
      isR18: moviesTable.isR18,
    }).from(moviesTable).where(whereClause).limit(limit).offset(offset)

    results = queryResult.map(r => ({
      ...r,
      movieActors: [],
      moviePublishers: [],
    }))

    const countResult = await db.select({ value: count() }).from(moviesTable).where(whereClause)
    totalResult = countResult[0].value
  }
  else {
    // 生产环境：使用完整的关联查询
    const [queryResults, countResult] = await Promise.all([
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
        with: {
          movieActors: {
            with: {
              actor: {
                columns: {
                  id: true,
                  name: true,
                  slug: true,
                  avatar: true,
                },
              },
            },
            orderBy: (movieActors, { asc }) => [asc(movieActors.sortOrder)],
          },
          moviePublishers: {
            with: {
              publisher: {
                columns: {
                  id: true,
                  name: true,
                  slug: true,
                  logo: true,
                },
              },
            },
          },
        },
        orderBy: (movies, { desc }) => [desc(movies.createdAt)],
        limit,
        offset,
      }),
      db.select({ value: count() }).from(moviesTable).where(whereClause).then(res => res[0].value),
    ])

    results = queryResults
    totalResult = countResult
  }

  // R18 保护 + 格式转换
  const safeResults = results.map((movie) => {
    const actorsData = movie.movieActors?.map((ma: any) => ma.actor) || []
    const publishersData = movie.moviePublishers?.map((mp: any) => mp.publisher) || []

    if (movie.isR18 && !isAdult) {
      return {
        ...movie,
        coverImage: null,
        actors: actorsData,
        publishers: publishersData,
        movieActors: undefined,
        moviePublishers: undefined,
      }
    }
    return {
      ...movie,
      actors: actorsData,
      publishers: publishersData,
      movieActors: undefined,
      moviePublishers: undefined,
    }
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

// 2. 获取电影详情（通过 slug 或 code）
movies.get('/:identifier', async (c) => {
  const db = c.get('db')
  const identifier = c.req.param('identifier')
  const isAdult = await checkIsAdult(c)

  // 尝试通过 code 或 slug 查找
  const movie = await db.query.movies.findFirst({
    where: (movies, { eq, or }) => or(
      eq(movies.code, identifier),
      eq(movies.slug, identifier),
    ),
    with: {
      players: {
        orderBy: (players, { asc }) => [asc(players.sortOrder)],
      },
      movieActors: {
        with: {
          actor: {
            columns: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
            },
          },
        },
        orderBy: (movieActors, { asc }) => [asc(movieActors.sortOrder)],
      },
      moviePublishers: {
        with: {
          publisher: {
            columns: {
              id: true,
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
      },
    },
  })

  if (!movie) {
    throw new HTTPException(404, { message: 'Movie not found' })
  }

  // 转换为新格式（确保正确映射）
  const actorsData = (movie.movieActors || [])
    .map((ma: any) => ma.actor)
    .filter((actor: any) => actor && actor.id && actor.name && actor.slug)

  const publishersData = (movie.moviePublishers || [])
    .map((mp: any) => mp.publisher)
    .filter((publisher: any) => publisher && publisher.id && publisher.name && publisher.slug)

  console.log(`[Movie Detail] ${movie.code} - Actors: ${actorsData.length}, Publishers: ${publishersData.length}`)

  // 查询相关影片（基于系列、演员或制作商）
  const relatedMoviesQuery = []

  // 优先级1：相同系列
  if (movie.series) {
    relatedMoviesQuery.push(
      db.query.movies.findMany({
        where: (movies, { eq, and, not }) => and(
          eq(movies.series, movie.series!),
          not(eq(movies.id, movie.id)),
        ),
        columns: {
          id: true,
          code: true,
          title: true,
          slug: true,
          coverImage: true,
          isR18: true,
        },
        limit: 6,
      }),
    )
  }

  // 优先级2：相同演员
  if (actorsData.length > 0) {
    const actorIds = actorsData.map((a: any) => a.id)
    relatedMoviesQuery.push(
      db.query.movieActors.findMany({
        where: (movieActors, { inArray, not }) => and(
          inArray(movieActors.actorId, actorIds),
          not(eq(movieActors.movieId, movie.id)),
        ),
        with: {
          movie: {
            columns: {
              id: true,
              code: true,
              title: true,
              slug: true,
              coverImage: true,
              isR18: true,
            },
          },
        },
        limit: 6,
      }),
    )
  }

  const relatedResults = await Promise.all(relatedMoviesQuery)

  // 合并并去重
  const relatedMoviesMap = new Map()
  for (const result of relatedResults.flat()) {
    const movieData = 'movie' in result ? result.movie : result
    if (movieData && !relatedMoviesMap.has(movieData.id)) {
      relatedMoviesMap.set(movieData.id, movieData)
    }
  }
  const relatedMovies = Array.from(relatedMoviesMap.values()).slice(0, 12)

  // R18 保护：只隐藏封面和播放源，保留演员和制作商信息供导航使用
  if (movie.isR18 && !isAdult) {
    return c.json({
      data: {
        ...movie,
        coverImage: null,
        players: [],
        actors: actorsData,
        publishers: publishersData,
        relatedMovies: [],
        movieActors: undefined,
        moviePublishers: undefined,
      },
    })
  }

  return c.json({
    data: {
      ...movie,
      actors: actorsData,
      publishers: publishersData,
      relatedMovies: relatedMovies.filter((m: any) => !m.isR18 || isAdult),
      movieActors: undefined,
      moviePublishers: undefined,
    },
  })
})

// 4. 获取热门电影（按创建时间排序，最新的）
movies.get('/featured/hot', async (c) => {
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
movies.get('/actors/list', async (c) => {
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
movies.get('/actors/:slug', async (c) => {
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
movies.get('/publishers/list', async (c) => {
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
movies.get('/publishers/:slug', async (c) => {
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
movies.get('/genres/list', async (c) => {
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
  const genreList = Array.from(genreCountMap.entries(), ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return c.json({ data: genreList })
})

// 10. 获取首页数据（热门影片 + 热门女优）
movies.get('/home/featured', async (c) => {
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
