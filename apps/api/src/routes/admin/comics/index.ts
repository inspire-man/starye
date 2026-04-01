import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { describeRoute, validator } from 'hono-openapi'
import { serviceAuth } from '../../../middleware/service-auth'
import { BatchOperationComicsSchema, UpdateComicMetadataSchema, UpdateComicProgressSchema } from '../../../schemas/admin'
import { bulkOperateComics, getBatchComicStatus, getComicList, getCrawlStats, updateComicMetadata, updateComicProgress } from './handlers'

export const adminComicsRoutes = new Hono<AppEnv>()

// 获取漫画列表（管理员视图）
adminComicsRoutes.get('/', serviceAuth(['admin', 'comic_admin']), getComicList)

// 更新漫画信息
adminComicsRoutes.patch(
  '/:id',
  describeRoute({
    summary: '更新漫画信息',
    description: '更新指定漫画的元数据',
    tags: ['Admin - Comics'],
    operationId: 'updateComicMetadata',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '更新成功' },
    },
  }),
  serviceAuth(['admin', 'comic_admin']),
  validator('json', UpdateComicMetadataSchema),
  updateComicMetadata,
)

// 批量获取漫画状态
adminComicsRoutes.get('/batch-status', serviceAuth(['admin', 'comic_admin']), getBatchComicStatus)

// 更新漫画爬取进度
adminComicsRoutes.post(
  '/:slug/progress',
  describeRoute({
    summary: '更新漫画爬取进度',
    description: '更新指定漫画的爬取进度',
    tags: ['Admin - Comics'],
    operationId: 'updateComicProgress',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '更新成功' },
    },
  }),
  serviceAuth(['admin', 'comic_admin']),
  validator('json', UpdateComicProgressSchema),
  updateComicProgress,
)

// 获取爬取统计
adminComicsRoutes.get('/crawl-stats', serviceAuth(['admin', 'comic_admin']), getCrawlStats)

// 批量操作漫画
adminComicsRoutes.post(
  '/bulk-operation',
  describeRoute({
    summary: '批量操作漫画',
    description: '批量更新漫画状态或元数据',
    tags: ['Admin - Comics'],
    operationId: 'bulkOperateComics',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '操作成功' },
    },
  }),
  serviceAuth(['admin', 'comic_admin']),
  validator('json', BatchOperationComicsSchema),
  bulkOperateComics,
)
