import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { detailCache, listCache } from '../../middleware/cache'
import { serviceAuth } from '../../middleware/service-auth'
import { getComicDetail, getComicList } from './handlers/comics.handler'

/**
 * Comics 路由 - 使用链式调用以支持 RPC 类型推导
 */
export const comicsRoutes = new Hono<AppEnv>()
  .get('/', serviceAuth(['super_admin', 'admin', 'comic_admin']), listCache(), getComicList)
  .get('/:slug', serviceAuth(['super_admin', 'admin', 'comic_admin']), detailCache(), getComicDetail)
