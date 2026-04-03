import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { serviceAuth } from '../../middleware/service-auth'
import {
  createPostHandler,
  deletePostHandler,
  getAdjacentPostsHandler,
  getPostDetailById,
  getPostDetailBySlug,
  getPostList,
  updatePostHandler,
} from './handlers/posts.handler'

/**
 * Posts 路由 - 使用链式调用以支持 RPC 类型推导
 * 注意：/:slug/adjacent 必须在 /:slug 之前注册，避免路由冲突
 */
export const postsRoutes = new Hono<AppEnv>()
  .get('/', getPostList)
  .get('/admin/:id', serviceAuth(['admin']), getPostDetailById)
  .post('/', serviceAuth(['admin']), createPostHandler)
  .patch('/:id', serviceAuth(['admin']), updatePostHandler)
  .delete('/:id', serviceAuth(['admin']), deletePostHandler)
  .get('/:slug/adjacent', getAdjacentPostsHandler)
  .get('/:slug', getPostDetailBySlug)
