import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { describeRoute, validator } from 'hono-openapi'
import { serviceAuth } from '../../../middleware/service-auth'
import { BatchDeleteChaptersSchema, GetChapterInfoQuerySchema } from '../../../schemas/admin'
import { bulkDeleteChapters, checkChapterStatus, deleteChapter, getChapterDetail, getComicChapters, getExistingChapters } from './handlers'

export const adminChaptersRoutes = new Hono<AppEnv>()

// 获取漫画章节列表
adminChaptersRoutes.get('/comics/:id/chapters', serviceAuth(['admin', 'comic_admin']), getComicChapters)

// 获取章节详情（含图片）
adminChaptersRoutes.get('/:id', serviceAuth(['admin', 'comic_admin']), getChapterDetail)

// 删除章节
adminChaptersRoutes.delete('/:id', serviceAuth(['admin', 'comic_admin']), deleteChapter)

// 获取漫画已存在的章节列表（用于爬虫去重）
adminChaptersRoutes.get('/comics/:slug/existing-chapters', serviceAuth(['admin', 'comic_admin']), getExistingChapters)

// 检查章节状态
adminChaptersRoutes.get(
  '/check',
  describeRoute({
    summary: '检查章节状态',
    description: '检查指定章节的状态信息',
    tags: ['Admin - Chapters'],
    operationId: 'checkChapterStatus',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '章节状态' },
    },
  }),
  serviceAuth(['admin', 'comic_admin']),
  validator('query', GetChapterInfoQuerySchema),
  checkChapterStatus,
)

// 批量删除章节
adminChaptersRoutes.post(
  '/comics/:id/bulk-delete',
  describeRoute({
    summary: '批量删除章节',
    description: '批量删除指定漫画的章节',
    tags: ['Admin - Chapters'],
    operationId: 'bulkDeleteComicChapters',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '删除成功' },
    },
  }),
  serviceAuth(['admin', 'comic_admin']),
  validator('json', BatchDeleteChaptersSchema),
  bulkDeleteChapters,
)
