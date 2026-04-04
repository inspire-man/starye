import type { Database } from '@starye/db'
import type { SQL } from 'drizzle-orm'
import { actors, movieActors, movies } from '@starye/db/schema'
import { and, count, desc, eq, like } from 'drizzle-orm'

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
  isR18Verified?: boolean
}

export async function getActorBySlug(options: GetActorBySlugOptions) {
  const { db, slug, isR18Verified = false } = options

  // 查找女优
  const actor = await db.query.actors.findFirst({
    where: eq(actors.slug, slug),
  })

  if (!actor) {
    return null
  }

  // 优先从 movie_actor 关联表查询（新数据）
  const movieConditions: SQL[] = [eq(movieActors.actorId, actor.id)]
  if (!isR18Verified) {
    movieConditions.push(eq(movies.isR18, false))
  }

  const joinMovies = await db
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
    .where(and(...movieConditions))
    .orderBy(desc(movies.releaseDate))
    .limit(100)

  // fallback：若关联表为空，从 movies.actors JSON 字段 LIKE 查询（兼容存量数据）
  let relatedMoviesData = joinMovies
  if (joinMovies.length === 0) {
    const likeConditions: SQL[] = [like(movies.actors, `%${actor.name}%`)]
    if (!isR18Verified) {
      likeConditions.push(eq(movies.isR18, false))
    }

    const likeMovies = await db
      .select({
        id: movies.id,
        code: movies.code,
        title: movies.title,
        slug: movies.slug,
        coverImage: movies.coverImage,
        releaseDate: movies.releaseDate,
        duration: movies.duration,
      })
      .from(movies)
      .where(and(...likeConditions))
      .orderBy(desc(movies.releaseDate))
      .limit(100)

    relatedMoviesData = likeMovies.map(m => ({ ...m, sortOrder: 0 }))
  }

  return {
    ...actor,
    relatedMovies: relatedMoviesData,
  }
}

export interface ActorRelation {
  partnerId: string
  partnerName: string
  partnerSlug: string
  partnerAvatar: string | null
  collaborationCount: number
  sharedMovieIds: string[]
}

export interface GetActorRelationsOptions {
  db: Database
  actorId: string
  minCollaborations?: number
  limit?: number
}

export async function getActorRelations(options: GetActorRelationsOptions): Promise<ActorRelation[]> {
  const { db, actorId, minCollaborations = 3, limit = 20 } = options

  // 1. 获取该女优参与的所有电影
  const actorMoviesData = await db
    .select({
      movieId: movieActors.movieId,
    })
    .from(movieActors)
    .where(eq(movieActors.actorId, actorId))

  const movieIds = actorMoviesData.map(m => m.movieId)

  if (movieIds.length === 0) {
    return []
  }

  // 2. 获取这些电影的所有女优（除自己外）
  const collaborators = await db
    .select({
      actorId: movieActors.actorId,
      movieId: movieActors.movieId,
      name: actors.name,
      slug: actors.slug,
      avatar: actors.avatar,
    })
    .from(movieActors)
    .innerJoin(actors, eq(movieActors.actorId, actors.id))
    .where(and(
      eq(actors.isActive, true),
    ))

  // 3. 统计合作频率
  const collaborationMap = new Map<string, {
    partner: { id: string, name: string, slug: string, avatar: string | null }
    count: number
    movieIds: string[]
  }>()

  for (const collab of collaborators) {
    // 跳过自己
    if (collab.actorId === actorId)
      continue
    // 只统计目标女优参与的电影
    if (!movieIds.includes(collab.movieId))
      continue

    const partnerId = collab.actorId
    const existing = collaborationMap.get(partnerId)

    if (existing) {
      existing.count++
      if (!existing.movieIds.includes(collab.movieId)) {
        existing.movieIds.push(collab.movieId)
      }
    }
    else {
      collaborationMap.set(partnerId, {
        partner: {
          id: collab.actorId,
          name: collab.name,
          slug: collab.slug,
          avatar: collab.avatar,
        },
        count: 1,
        movieIds: [collab.movieId],
      })
    }
  }

  // 4. 转换为结果数组
  const relations: ActorRelation[] = Array.from(collaborationMap.values())
    .filter(item => item.count >= minCollaborations)
    .map(item => ({
      partnerId: item.partner.id,
      partnerName: item.partner.name,
      partnerSlug: item.partner.slug,
      partnerAvatar: item.partner.avatar,
      collaborationCount: item.count,
      sharedMovieIds: item.movieIds,
    }))
    .sort((a, b) => b.collaborationCount - a.collaborationCount)
    .slice(0, limit)

  return relations
}
