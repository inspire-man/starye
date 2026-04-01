import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { apiCache, CacheKeys, CacheTTL, InvalidateCache } from '../../../utils/cache'
import { checkRatingRateLimit, getPlayerRating, getTopRatedPlayers, getUserRatingHistory, submitRating } from '../services/rating.service'

// 提交评分
export async function submitPlayerRating(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')

  // 验证登录
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: '请先登录' })
  }

  const body = await c.req.json()
  const { playerId, score } = body

  if (!playerId || !score) {
    throw new HTTPException(400, { message: '缺少必需参数' })
  }

  if (score < 1 || score > 5 || !Number.isInteger(score)) {
    throw new HTTPException(400, { message: '评分必须是 1-5 的整数' })
  }

  // 检查频率限制
  const canRate = await checkRatingRateLimit({
    db,
    userId: session.user.id,
    windowMinutes: 1,
    maxRatings: 10,
  })

  if (!canRate) {
    throw new HTTPException(429, { message: '评分过于频繁，请稍后再试' })
  }

  try {
    const result = await submitRating({
      db,
      playerId,
      userId: session.user.id,
      score,
    })

    // 使相关缓存失效
    InvalidateCache.onRatingUpdate(playerId, undefined, session.user.id)

    return c.json({
      code: 0,
      message: '评分成功',
      data: result,
    })
  }
  catch (error) {
    if (error instanceof Error) {
      throw new HTTPException(400, { message: error.message })
    }
    throw error
  }
}

// 获取播放源评分（带缓存）
export async function getPlayerRatingStats(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')
  const playerId = c.req.param('playerId')

  if (!playerId) {
    throw new HTTPException(400, { message: '缺少播放源 ID' })
  }

  // 获取当前用户 ID（如已登录）
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  const userId = session?.user?.id

  // 尝试从缓存获取
  const cacheKey = CacheKeys.playerRating(playerId)
  const cached = apiCache.get(cacheKey)

  if (cached) {
    return c.json({
      code: 0,
      data: cached,
    })
  }

  // 从数据库查询
  const stats = await getPlayerRating({
    db,
    playerId,
    userId,
  })

  // 写入缓存
  apiCache.set(cacheKey, stats, CacheTTL.PLAYER_RATING)

  return c.json({
    code: 0,
    data: stats,
  })
}

// 获取用户评分历史
export async function getUserRatings(c: Context<AppEnv>) {
  const db = c.get('db')
  const auth = c.get('auth')

  // 验证登录
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: '请先登录' })
  }

  const limit = Number(c.req.query('limit')) || 50

  const history = await getUserRatingHistory({
    db,
    userId: session.user.id,
    limit,
  })

  return c.json({
    code: 0,
    data: history,
  })
}

// 获取评分统计（热门、趋势等）
export async function getRatingStats(c: Context<AppEnv>) {
  const db = c.get('db')
  const type = c.req.query('type') || 'top'
  const limit = Number(c.req.query('limit')) || 10

  if (type === 'top') {
    const minRatingCount = Number(c.req.query('minRatingCount')) || 10
    const topRated = await getTopRatedPlayers({
      db,
      limit,
      minRatingCount,
    })

    return c.json({
      code: 0,
      data: topRated,
    })
  }

  throw new HTTPException(400, { message: '不支持的统计类型' })
}
