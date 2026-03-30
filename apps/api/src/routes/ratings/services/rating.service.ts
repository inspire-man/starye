import type { Database } from '@starye/db'
import { players, ratings } from '@starye/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// 评分统计数据
export interface RatingStats {
  averageRating: number
  ratingCount: number
  userScore?: number
  distribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
}

// 用户评分历史项
export interface UserRatingHistoryItem {
  id: string
  playerId: string
  movieCode: string
  movieTitle: string
  score: number
  createdAt: Date
}

// 热门评分项
export interface TopRatedItem {
  playerId: string
  movieCode: string
  movieTitle: string
  averageRating: number
  ratingCount: number
}

// 提交评分
export async function submitRating(options: {
  db: Database
  playerId: string
  userId: string
  score: 1 | 2 | 3 | 4 | 5
}): Promise<{ id: string, averageRating: number, ratingCount: number }> {
  const { db, playerId, userId, score } = options

  // 验证评分范围
  if (score < 1 || score > 5) {
    throw new Error('评分必须在 1-5 之间')
  }

  // 验证播放源存在
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  })

  if (!player) {
    throw new Error('播放源不存在')
  }

  const now = new Date()
  const ratingId = nanoid()

  // 检查是否已有评分
  const existingRating = await db.query.ratings.findFirst({
    where: and(
      eq(ratings.playerId, playerId),
      eq(ratings.userId, userId),
    ),
  })

  if (existingRating) {
    // 更新现有评分
    await db.update(ratings)
      .set({
        score,
        updatedAt: now,
      })
      .where(eq(ratings.id, existingRating.id))
  }
  else {
    // 插入新评分
    await db.insert(ratings).values({
      id: ratingId,
      playerId,
      userId,
      score,
      createdAt: now,
      updatedAt: now,
    })
  }

  // 重新计算聚合评分
  const aggregateResult = await db
    .select({
      avgRating: sql<number>`CAST(AVG(${ratings.score}) * 20 AS REAL)`, // 转换 1-5 星为 0-100 分
      count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
    })
    .from(ratings)
    .where(eq(ratings.playerId, playerId))

  const { avgRating, count: ratingCount } = aggregateResult[0]

  // 更新播放源的聚合数据
  await db.update(players)
    .set({
      averageRating: Math.round(avgRating || 0),
      ratingCount: ratingCount || 0,
      updatedAt: now,
    })
    .where(eq(players.id, playerId))

  return {
    id: existingRating?.id || ratingId,
    averageRating: Math.round(avgRating || 0),
    ratingCount: ratingCount || 0,
  }
}

// 获取播放源评分统计
export async function getPlayerRating(options: {
  db: Database
  playerId: string
  userId?: string
}): Promise<RatingStats> {
  const { db, playerId, userId } = options

  // 查询播放源聚合数据
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
    columns: {
      averageRating: true,
      ratingCount: true,
    },
  })

  // 如果有 userId，查询用户的评分
  let userScore: number | undefined
  if (userId) {
    const userRating = await db.query.ratings.findFirst({
      where: and(
        eq(ratings.playerId, playerId),
        eq(ratings.userId, userId),
      ),
      columns: {
        score: true,
      },
    })
    userScore = userRating?.score
  }

  // 查询评分分布
  const distribution = await db
    .select({
      score: ratings.score,
      count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
    })
    .from(ratings)
    .where(eq(ratings.playerId, playerId))
    .groupBy(ratings.score)

  // 构建分布对象
  const distObj: RatingStats['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const item of distribution) {
    distObj[item.score as 1 | 2 | 3 | 4 | 5] = item.count
  }

  return {
    averageRating: player?.averageRating || 0,
    ratingCount: player?.ratingCount || 0,
    userScore,
    distribution: distObj,
  }
}

// 获取用户评分历史
export async function getUserRatingHistory(options: {
  db: Database
  userId: string
  limit?: number
}): Promise<UserRatingHistoryItem[]> {
  const { db, userId, limit = 50 } = options

  const results = await db
    .select({
      id: ratings.id,
      playerId: ratings.playerId,
      movieCode: sql<string>`(SELECT code FROM movie WHERE id = (SELECT movie_id FROM player WHERE id = ${ratings.playerId}))`,
      movieTitle: sql<string>`(SELECT title FROM movie WHERE id = (SELECT movie_id FROM player WHERE id = ${ratings.playerId}))`,
      score: ratings.score,
      createdAt: ratings.createdAt,
    })
    .from(ratings)
    .where(eq(ratings.userId, userId))
    .orderBy(desc(ratings.createdAt))
    .limit(limit)

  return results.map(r => ({
    id: r.id,
    playerId: r.playerId,
    movieCode: r.movieCode || '',
    movieTitle: r.movieTitle || '',
    score: r.score,
    createdAt: r.createdAt,
  }))
}

// 获取热门评分播放源
export async function getTopRatedPlayers(options: {
  db: Database
  limit?: number
  minRatingCount?: number
}): Promise<TopRatedItem[]> {
  const { db, limit = 10, minRatingCount = 10 } = options

  const results = await db
    .select({
      playerId: players.id,
      movieCode: sql<string>`(SELECT code FROM movie WHERE id = ${players.movieId})`,
      movieTitle: sql<string>`(SELECT title FROM movie WHERE id = ${players.movieId})`,
      averageRating: players.averageRating,
      ratingCount: players.ratingCount,
    })
    .from(players)
    .where(sql`${players.ratingCount} >= ${minRatingCount}`)
    .orderBy(desc(players.averageRating))
    .limit(limit)

  return results.map(r => ({
    playerId: r.playerId,
    movieCode: r.movieCode || '',
    movieTitle: r.movieTitle || '',
    averageRating: r.averageRating || 0,
    ratingCount: r.ratingCount || 0,
  }))
}

// 检查用户评分频率限制
export async function checkRatingRateLimit(options: {
  db: Database
  userId: string
  windowMinutes?: number
  maxRatings?: number
}): Promise<boolean> {
  const { db, userId, windowMinutes = 1, maxRatings = 10 } = options

  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

  const recentRatings = await db
    .select({ count: sql<number>`CAST(COUNT(*) AS INTEGER)` })
    .from(ratings)
    .where(
      and(
        eq(ratings.userId, userId),
        sql`${ratings.createdAt} >= ${Math.floor(windowStart.getTime() / 1000)}`,
      ),
    )

  const ratingsCount = recentRatings[0]?.count || 0

  // 返回 true 表示未超限（可以继续评分）
  return ratingsCount < maxRatings
}
