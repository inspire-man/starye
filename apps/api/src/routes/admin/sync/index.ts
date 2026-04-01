import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { describeRoute, validator } from 'hono-openapi'
import { serviceAuth } from '../../../middleware/service-auth'
import { SubmitCrawlerDataSchema } from '../../../schemas/admin'
import { syncCrawlerData } from './handlers'

export const adminSyncRoutes = new Hono<AppEnv>()

// 同步路由 (由爬虫调用)
adminSyncRoutes.post(
  '/',
  describeRoute({
    summary: '同步爬虫数据',
    description: '爬虫提交抓取的数据到数据库',
    tags: ['Admin - Sync'],
    operationId: 'syncCrawlerData',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '同步成功' },
    },
  }),
  serviceAuth(['admin', 'comic_admin']),
  validator('json', SubmitCrawlerDataSchema),
  syncCrawlerData,
)
