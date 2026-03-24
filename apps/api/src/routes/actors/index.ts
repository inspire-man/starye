import type { AppEnv } from '../../types'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { getActorDetail, getActorList } from './handlers/actors.handler'

/**
 * Actors 路由 - 使用链式调用以支持 RPC 类型推导
 */
export const actorsRoutes = new Hono<AppEnv>()
  .get(
    '/',
    zValidator('query', z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      sort: z.enum(['name', 'movieCount', 'createdAt']).default('name'),
      nationality: z.string().optional(),
      isActive: z.coerce.boolean().optional(),
      hasDetails: z.coerce.boolean().optional(),
    })),
    getActorList,
  )
  .get('/:slug', getActorDetail)
