/* eslint-disable no-console */
/**
 * Admin Movies Service - 电影管理业务逻辑
 */

import type { Database } from '@starye/db'
import type { InferInsertModel, SQL } from 'drizzle-orm'
import { movies, players } from '@starye/db/schema'
import { and, count, desc, eq, gte, like, lte, or } from 'drizzle-orm'
import { z } from 'zod'

/**
 * 电影筛选参数 Schema
 */
export const MovieFilterSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  isR18: z.union([z.enum(['true', 'false', 'all']), z.literal('')]).optional().default('all'),
  crawlStatus: z.union([z.enum(['pending', 'partial', 'complete']), z.literal('')]).optional(),
  metadataLocked: z.union([z.enum(['true', 'false']), z.literal('')]).optional(),
  actor: z.string().optional(),
  publisher: z.string().optional(),
  genre: z.string().optional(),
  releaseDateFrom: z.string().optional(),
  releaseDateTo: z.string().optional(),
  createdAtFrom: z.string().optional(),
  createdAtTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['releaseDate', 'createdAt', 'updatedAt', 'sortOrder', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type MovieFilter = z.infer<typeof MovieFilterSchema>

/**
 * 构建电影筛选条件
 */
export function buildMovieFilters(filter: MovieFilter) {
  const conditions: SQL[] = []

  if (filter.isR18 === 'true') {
    conditions.push(eq(movies.isR18, true))
  }
  else if (filter.isR18 === 'false') {
    conditions.push(eq(movies.isR18, false))
  }

  if (filter.crawlStatus) {
    conditions.push(eq(movies.crawlStatus, filter.crawlStatus as 'pending' | 'partial' | 'complete'))
  }

  if (filter.metadataLocked && filter.metadataLocked === 'true') {
    conditions.push(eq(movies.metadataLocked, true))
  }
  else if (filter.metadataLocked && filter.metadataLocked === 'false') {
    conditions.push(eq(movies.metadataLocked, false))
  }

  if (filter.actor) {
    conditions.push(like(movies.actors, `%${filter.actor}%`))
  }

  if (filter.publisher) {
    conditions.push(like(movies.publisher, `%${filter.publisher}%`))
  }

  if (filter.genre) {
    conditions.push(like(movies.genres, `%${filter.genre}%`))
  }

  if (filter.releaseDateFrom) {
    const date = new Date(filter.releaseDateFrom)
    conditions.push(gte(movies.releaseDate, date))
  }

  if (filter.releaseDateTo) {
    const date = new Date(filter.releaseDateTo)
    conditions.push(lte(movies.releaseDate, date))
  }

  if (filter.createdAtFrom) {
    const date = new Date(filter.createdAtFrom)
    conditions.push(gte(movies.createdAt, date))
  }

  if (filter.createdAtTo) {
    const date = new Date(filter.createdAtTo)
    conditions.push(lte(movies.createdAt, date))
  }

  if (filter.search) {
    const searchCondition = or(
      like(movies.title, `%${filter.search}%`),
      like(movies.code, `%${filter.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

/**
 * 构建排序条件
 */
export function buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc') {
  const column = {
    releaseDate: movies.releaseDate,
    createdAt: movies.createdAt,
    updatedAt: movies.updatedAt,
    sortOrder: movies.sortOrder,
    title: movies.title,
  }[sortBy] || movies.updatedAt

  return sortOrder === 'desc' ? desc(column) : column
}

/**
 * 批量查询电影状态
 */
export interface BatchStatusOptions {
  db: Database
  codes: string[]
}

export async function getBatchMovieStatus(options: BatchStatusOptions) {
  const { db, codes } = options
  const startTime = Date.now()

  const results = await db.query.movies.findMany({
    where: (movies, { inArray }) => inArray(movies.code, codes),
    columns: {
      code: true,
      slug: true,
      updatedAt: true,
    },
  })

  const statusMap: Record<string, any> = {}
  for (const code of codes) {
    const result = results.find(r => r.code === code)
    if (result) {
      statusMap[code] = {
        exists: true,
        code: result.code,
        slug: result.slug,
        updatedAt: result.updatedAt?.toISOString(),
      }
    }
    else {
      statusMap[code] = {
        exists: false,
        code,
      }
    }
  }

  const elapsed = Date.now() - startTime
  console.log(`[BatchStatus] 批量查询 ${codes.length} 个电影，耗时 ${elapsed}ms`)

  if (elapsed > 1000) {
    console.warn(`[BatchStatus] ⚠️ 批量查询过慢，耗时 ${elapsed}ms`)
  }

  return statusMap
}

/**
 * 查询电影列表
 */
export interface GetMoviesOptions {
  db: Database
  filter: MovieFilter
}

export async function getAdminMovies(options: GetMoviesOptions) {
  const { db, filter } = options

  const whereClause = buildMovieFilters(filter)
  const orderByClause = buildOrderBy(filter.sortBy, filter.sortOrder)
  const offset = (filter.page - 1) * filter.limit

  const [results, totalResult] = await Promise.all([
    db.query.movies.findMany({
      where: whereClause,
      orderBy: orderByClause,
      limit: filter.limit,
      offset,
      with: {
        movieActors: {
          with: {
            actor: {
              columns: {
                id: true,
                name: true,
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
              },
            },
          },
        },
      },
    }),
    db
      .select({ value: count() })
      .from(movies)
      .where(whereClause)
      .then(res => res[0]?.value || 0),
  ])

  // 添加 actorNames 和 publisherNames 字段
  const enrichedResults = results.map((movie) => {
    const actorNames = movie.movieActors?.map(ma => ma.actor?.name).filter(Boolean) || []
    const publisherNames = movie.moviePublishers?.map(mp => mp.publisher?.name).filter(Boolean) || []

    return {
      ...movie,
      actorNames,
      publisherNames,
      movieActors: undefined,
      moviePublishers: undefined,
    }
  })

  return {
    data: enrichedResults,
    meta: {
      total: totalResult,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(totalResult / filter.limit),
    },
  }
}

/**
 * 获取单个电影详情
 */
export async function getAdminMovieById(db: Database, id: string) {
  return await db.query.movies.findFirst({
    where: eq(movies.id, id),
  })
}

/**
 * 更新电影信息
 */
export interface UpdateMovieOptions {
  db: Database
  id: string
  data: Partial<InferInsertModel<typeof movies>>
}

export async function updateMovie(options: UpdateMovieOptions) {
  const { db, id, data } = options

  await db.update(movies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(movies.id, id))

  return await getAdminMovieById(db, id)
}

/**
 * 删除电影
 */
export async function deleteMovie(db: Database, id: string) {
  await db.delete(movies).where(eq(movies.id, id))
}

/**
 * 获取电影的播放源列表
 */
export async function getMoviePlayers(db: Database, movieId: string) {
  return await db.query.players.findMany({
    where: eq(players.movieId, movieId),
    orderBy: (players, { asc }) => [asc(players.sortOrder)],
  })
}

/**
 * 创建播放源
 */
export interface CreatePlayerOptions {
  db: Database
  movieId: string
  data: {
    sourceName: string
    sourceUrl: string
    quality?: string
    sortOrder?: number
  }
}

export async function createPlayer(options: CreatePlayerOptions) {
  const { db, movieId, data } = options

  const [player] = await db.insert(players).values({
    id: crypto.randomUUID(),
    movieId,
    sourceName: data.sourceName,
    sourceUrl: data.sourceUrl,
    quality: data.quality || null,
    sortOrder: data.sortOrder || 0,
  }).returning()

  return player
}

/**
 * 更新播放源
 */
export interface UpdatePlayerOptions {
  db: Database
  id: string
  data: Partial<{
    sourceName: string
    sourceUrl: string
    quality: string | null
    sortOrder: number
  }>
}

export async function updatePlayer(options: UpdatePlayerOptions) {
  const { db, id, data } = options

  const [player] = await db.update(players)
    .set(data)
    .where(eq(players.id, id))
    .returning()

  return player
}

/**
 * 删除播放源
 */
export async function deletePlayer(db: Database, id: string) {
  await db.delete(players).where(eq(players.id, id))
}
