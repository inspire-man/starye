import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { adminActorsRoutes } from '../actors'
import { adminAuditLogsRoutes } from '../audit-logs'
import { adminCacheRoutes } from '../cache'
import { adminChaptersRoutes } from '../chapters'
import { adminComicsRoutes } from '../comics'
import { adminCrawlersRoutes } from '../crawlers'
import { adminMoviesRoutes } from '../movies'
import { adminPublishersRoutes } from '../publishers'
import { adminR18WhitelistRoutes } from '../r18-whitelist'
import { adminSettingsRoutes } from '../settings'
import { adminStatsRoutes } from '../stats'
import { adminSyncRoutes } from '../sync'
import { adminUsersRoutes } from '../users'

const admin = new Hono<AppEnv>()

// 挂载子路由
admin.route('/movies', adminMoviesRoutes)
admin.route('/crawlers', adminCrawlersRoutes)
admin.route('/actors', adminActorsRoutes)
admin.route('/publishers', adminPublishersRoutes)
admin.route('/audit-logs', adminAuditLogsRoutes)
admin.route('/r18-whitelist', adminR18WhitelistRoutes)
admin.route('/cache', adminCacheRoutes)
admin.route('/users', adminUsersRoutes)
admin.route('/comics', adminComicsRoutes)
admin.route('/chapters', adminChaptersRoutes)
admin.route('/sync', adminSyncRoutes)
admin.route('/stats', adminStatsRoutes)
admin.route('/settings', adminSettingsRoutes)

export default admin
