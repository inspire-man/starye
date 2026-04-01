import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { publicCache, userCache } from '../../middleware/cache'
import { requireAuth } from '../../middleware/guard'
import { getPlayerRatingStats, getRatingStats, getUserRatings, submitPlayerRating } from './handlers/rating.handler'

const ratingsRoutes = new Hono<AppEnv>()

// 提交评分（需要认证）
ratingsRoutes.post('/', requireAuth(), submitPlayerRating)

// 获取播放源评分统计（公开）
ratingsRoutes.get('/player/:playerId', publicCache(), getPlayerRatingStats)

// 获取用户评分历史（需要认证）
ratingsRoutes.get('/user', requireAuth(), userCache(), getUserRatings)

// 获取评分统计（公开）
ratingsRoutes.get('/stats', publicCache(), getRatingStats)

export default ratingsRoutes
