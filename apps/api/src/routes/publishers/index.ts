import type { AppEnv } from '../../types'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { getPublisherDetail, getPublisherList } from './handlers/publishers.handler'

/**
 * Publishers 路由 - 使用链式调用以支持 RPC 类型推导
 */
export const publishersRoutes = new Hono<AppEnv>()
  .get(
    '/',
    zValidator('query', z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      sort: z.enum(['name', 'movieCount', 'createdAt']).default('name'),
      country: z.string().optional(),
      hasDetails: z.coerce.boolean().optional(),
    })),
    getPublisherList,
  )
  .get('/:slug', getPublisherDetail)
