import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { serviceAuth } from '../../../middleware/service-auth'
import { getAdminStats } from './handlers'

export const adminStatsRoutes = new Hono<AppEnv>()

// 管理后台统计信息
adminStatsRoutes.get('/', serviceAuth(), getAdminStats)
