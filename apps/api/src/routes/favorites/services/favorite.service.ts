import type { Database } from '@starye/db'
import type { SQL } from 'drizzle-orm'
import { userFavorites } from '@starye/db/schema'
import { and, count, desc, eq } from 'drizzle-orm'

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
  }>
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export async function getFavorites(options: GetFavoritesOptions): Promise<GetFavoritesResult> {
  const {
    db,
    userId,
    page = 1,
    pageSize = 20,
    entityType,
  } = options

  // 构建查询条件
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

  return {
    data: results.map(r => ({
      id: r.id,
      userId: r.userId,
      entityType: r.entityType,
      entityId: r.entityId,
      createdAt: r.createdAt ? Math.floor(r.createdAt.getTime() / 1000) : 0,
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

export async function checkFavorite(options: CheckFavoriteOptions): Promise<boolean> {
  const { db, userId, entityType, entityId } = options

  const favorite = await db.query.userFavorites.findFirst({
    where: and(
      eq(userFavorites.userId, userId),
      eq(userFavorites.entityType, entityType),
      eq(userFavorites.entityId, entityId),
    ),
  })

  return !!favorite
}
