import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { getPlayerRatingStats, getRatingStats, getUserRatings, submitPlayerRating } from './handlers/rating.handler'

const ratingsRoutes = new Hono<AppEnv>()

// 提交评分
ratingsRoutes.post('/', submitPlayerRating)

// 获取播放源评分统计
ratingsRoutes.get('/player/:playerId', getPlayerRatingStats)

// 获取用户评分历史
ratingsRoutes.get('/user', getUserRatings)

// 获取评分统计（热门、趋势等）
ratingsRoutes.get('/stats', getRatingStats)

export default ratingsRoutes
