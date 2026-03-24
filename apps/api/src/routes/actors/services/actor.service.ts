import type { Database } from '@starye/db'
import type { SQL } from 'drizzle-orm'
import { actors, movieActors, movies } from '@starye/db/schema'
import { and, count, desc, eq } from 'drizzle-orm'

interface ActorListItem {
  id: string
  name: string
  slug: string
  avatar: string | null
  nationality: string | null
  movieCount: number | null
  isActive: boolean
  hasDetailsCrawled: boolean
}

export interface GetActorsOptions {
  db: Database
  page?: number
  pageSize?: number
  sort?: 'name' | 'movieCount' | 'createdAt'
  nationality?: string
  isActive?: boolean
  hasDetails?: boolean
}

export interface GetActorsResult {
  data: ActorListItem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export async function getActors(options: GetActorsOptions): Promise<GetActorsResult> {
  const {
    db,
    page = 1,
    pageSize = 20,
    sort = 'name',
    nationality,
    isActive,
    hasDetails,
  } = options

  // 构建查询条件
  const conditions: SQL[] = []
  if (nationality) {
    conditions.push(eq(actors.nationality, nationality))
  }
  if (isActive !== undefined) {
    conditions.push(eq(actors.isActive, isActive))
  }
  if (hasDetails !== undefined) {
    conditions.push(eq(actors.hasDetailsCrawled, hasDetails))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // 确定排序字段
  let orderBy
  switch (sort) {
    case 'movieCount':
      orderBy = desc(actors.movieCount)
      break
    case 'createdAt':
      orderBy = desc(actors.createdAt)
      break
    case 'name':
    default:
      orderBy = actors.name
  }

  const [results, totalResult] = await Promise.all([
    db.query.actors.findMany({
      where: whereClause,
      orderBy,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      columns: {
        id: true,
        name: true,
        slug: true,
        avatar: true,
        nationality: true,
        movieCount: true,
        isActive: true,
        hasDetailsCrawled: true,
      },
    }),
    db
      .select({ value: count() })
      .from(actors)
      .where(whereClause)
      .then(res => res[0]?.value || 0),
  ])

  return {
    data: results as ActorListItem[],
    meta: {
      total: totalResult,
      page,
      limit: pageSize,
      totalPages: Math.ceil(totalResult / pageSize),
    },
  }
}

export interface GetActorBySlugOptions {
  db: Database
  slug: string
}

export async function getActorBySlug(options: GetActorBySlugOptions) {
  const { db, slug } = options

  // 查找女优
  const actor = await db.query.actors.findFirst({
    where: eq(actors.slug, slug),
  })

  if (!actor) {
    return null
  }

  // 查询关联电影（通过 movie_actors 表）
  const relatedMoviesData = await db
    .select({
      id: movies.id,
      code: movies.code,
      title: movies.title,
      slug: movies.slug,
      coverImage: movies.coverImage,
      releaseDate: movies.releaseDate,
      duration: movies.duration,
      sortOrder: movieActors.sortOrder,
    })
    .from(movieActors)
    .innerJoin(movies, eq(movieActors.movieId, movies.id))
    .where(eq(movieActors.actorId, actor.id))
    .orderBy(desc(movies.releaseDate))
    .limit(100)

  return {
    ...actor,
    relatedMovies: relatedMoviesData,
  }
}
