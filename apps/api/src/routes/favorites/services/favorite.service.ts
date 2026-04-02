import type { Database } from '@starye/db'
import type { SQL } from 'drizzle-orm'
import { actors, comics, movies, publishers, userFavorites } from '@starye/db/schema'
import { and, count, desc, eq, inArray } from 'drizzle-orm'

export interface EntityInfo {
  name: string
  cover: string | null
  slug: string
}

export interface GetFavoritesOptions {
  db: Database
  userId: string
  page?: number
  pageSize?: number
  entityType?: 'actor' | 'publisher' | 'movie' | 'comic'
}

export interface GetFavoritesResult {
  data: Array<{
    id: string
    userId: string
    entityType: string
    entityId: string
    createdAt: number
    entity: EntityInfo | null
  }>
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// 按 entityType 分组批量查询关联实体信息
async function batchFetchEntities(
  db: Database,
  items: Array<{ entityType: string, entityId: string }>,
): Promise<Map<string, EntityInfo>> {
  const entityMap = new Map<string, EntityInfo>()
  const grouped: Record<string, string[]> = {}

  for (const item of items) {
    if (!grouped[item.entityType])
      grouped[item.entityType] = []
    grouped[item.entityType].push(item.entityId)
  }

  const queries: Promise<void>[] = []

  if (grouped.movie?.length) {
    queries.push(
      db.select({ id: movies.id, title: movies.title, coverImage: movies.coverImage, code: movies.code })
        .from(movies)
        .where(inArray(movies.id, grouped.movie))
        .then((rows) => {
          for (const r of rows)
            entityMap.set(`movie:${r.id}`, { name: r.title, cover: r.coverImage, slug: r.code })
        }),
    )
  }

  if (grouped.actor?.length) {
    queries.push(
      db.select({ id: actors.id, name: actors.name, avatar: actors.avatar, slug: actors.slug })
        .from(actors)
        .where(inArray(actors.id, grouped.actor))
        .then((rows) => {
          for (const r of rows)
            entityMap.set(`actor:${r.id}`, { name: r.name, cover: r.avatar, slug: r.slug })
        }),
    )
  }

  if (grouped.publisher?.length) {
    queries.push(
      db.select({ id: publishers.id, name: publishers.name, logo: publishers.logo, slug: publishers.slug })
        .from(publishers)
        .where(inArray(publishers.id, grouped.publisher))
        .then((rows) => {
          for (const r of rows)
            entityMap.set(`publisher:${r.id}`, { name: r.name, cover: r.logo, slug: r.slug })
        }),
    )
  }

  if (grouped.comic?.length) {
    queries.push(
      db.select({ id: comics.id, title: comics.title, coverImage: comics.coverImage, slug: comics.slug })
        .from(comics)
        .where(inArray(comics.id, grouped.comic))
        .then((rows) => {
          for (const r of rows)
            entityMap.set(`comic:${r.id}`, { name: r.title, cover: r.coverImage, slug: r.slug })
        }),
    )
  }

  await Promise.all(queries)
  return entityMap
}

export async function getFavorites(options: GetFavoritesOptions): Promise<GetFavoritesResult> {
  const {
    db,
    userId,
    page = 1,
    pageSize = 20,
    entityType,
  } = options

  const conditions: SQL[] = [eq(userFavorites.userId, userId)]

  if (entityType) {
    conditions.push(eq(userFavorites.entityType, entityType))
  }

  const whereClause = and(...conditions)

  const [results, totalResult] = await Promise.all([
    db.query.userFavorites.findMany({
      where: whereClause,
      orderBy: desc(userFavorites.createdAt),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db
      .select({ value: count() })
      .from(userFavorites)
      .where(whereClause)
      .then(res => res[0]?.value || 0),
  ])

  // 批量查询关联实体信息
  const entityMap = await batchFetchEntities(
    db,
    results.map(r => ({ entityType: r.entityType, entityId: r.entityId })),
  )

  return {
    data: results.map(r => ({
      id: r.id,
      userId: r.userId,
      entityType: r.entityType,
      entityId: r.entityId,
      createdAt: r.createdAt ? Math.floor(r.createdAt.getTime() / 1000) : 0,
      entity: entityMap.get(`${r.entityType}:${r.entityId}`) || null,
    })),
    meta: {
      total: totalResult,
      page,
      limit: pageSize,
      totalPages: Math.ceil(totalResult / pageSize),
    },
  }
}

export interface AddFavoriteOptions {
  db: Database
  userId: string
  entityType: 'actor' | 'publisher' | 'movie' | 'comic'
  entityId: string
}

export async function addFavorite(options: AddFavoriteOptions) {
  const { db, userId, entityType, entityId } = options

  // 检查是否已收藏
  const existing = await db.query.userFavorites.findFirst({
    where: and(
      eq(userFavorites.userId, userId),
      eq(userFavorites.entityType, entityType),
      eq(userFavorites.entityId, entityId),
    ),
  })

  if (existing) {
    return { success: true, alreadyExists: true, id: existing.id }
  }

  // 创建收藏记录
  const id = `fav_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = new Date()

  await db.insert(userFavorites).values({
    id,
    userId,
    entityType,
    entityId,
    createdAt: now,
  })

  return { success: true, alreadyExists: false, id }
}

export interface DeleteFavoriteOptions {
  db: Database
  userId: string
  favoriteId: string
}

export async function deleteFavorite(options: DeleteFavoriteOptions) {
  const { db, userId, favoriteId } = options

  // 验证收藏属于该用户
  const favorite = await db.query.userFavorites.findFirst({
    where: and(
      eq(userFavorites.id, favoriteId),
      eq(userFavorites.userId, userId),
    ),
  })

  if (!favorite) {
    return { success: false, error: 'Favorite not found or access denied' }
  }

  await db.delete(userFavorites).where(eq(userFavorites.id, favoriteId))

  return { success: true }
}

export interface CheckFavoriteOptions {
  db: Database
  userId: string
  entityType: 'actor' | 'publisher' | 'movie' | 'comic'
  entityId: string
}

export async function checkFavorite(options: CheckFavoriteOptions): Promise<{ isFavorited: boolean, favoriteId: string | null }> {
  const { db, userId, entityType, entityId } = options

  const favorite = await db.query.userFavorites.findFirst({
    where: and(
      eq(userFavorites.userId, userId),
      eq(userFavorites.entityType, entityType),
      eq(userFavorites.entityId, entityId),
    ),
  })

  return {
    isFavorited: !!favorite,
    favoriteId: favorite?.id ?? null,
  }
}
