/**
 * 监控 API 路由
 *
 * 接收前端错误日志和性能指标
 */

import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { logClientError, logClientPerformance } from './monitoring.handler'

const monitoringRouter = new Hono<AppEnv>()

// 接收前端错误日志
monitoringRouter.post('/errors', logClientError)

// 接收前端性能指标
monitoringRouter.post('/performance', logClientPerformance)

export default monitoringRouter
