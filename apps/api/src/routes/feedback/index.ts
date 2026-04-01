/**
 * 用户反馈 API 路由
 */

import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { getFeedbackList, submitFeedback } from './feedback.handler'

const feedbackRouter = new Hono<AppEnv>()

// 提交反馈
feedbackRouter.post('/', submitFeedback)

// 获取反馈列表（管理员）
feedbackRouter.get('/', getFeedbackList)

export default feedbackRouter
