/**
 * Hono RPC Client - 完整的类型安全 API 客户端
 *
 * 基于 Hono 官方文档的最佳实践实现
 * 参考: https://hono.dev/docs/guides/rpc#using-rpc-with-larger-applications
 */

import type { AppType } from '@starye/api-types'
import { hc } from 'hono/client'

/**
 * 创建 Hono RPC Client
 *
 * 根据 Hono 文档，通过链式调用端点（chaining）注册路由后，
 * AppType 应该能够正确推导出所有路由的类型信息
 *
 * 使用方式:
 * ```typescript
 * const client = createApiClient('/api')
 *
 * // 访问 movies 路由
 * const res = await client.api.movies.$get({
 *   query: { page: 1, limit: 24 }
 * })
 * ```
 */
export function createApiClient(baseUrl: string = '/api') {
  return hc<AppType>(baseUrl)
}

// 默认客户端实例
export const apiClient = createApiClient()

/**
 * 使用示例:
 *
 * ```typescript
 * import { apiClient } from '@/lib/hono-rpc-client'
 *
 * // 1. 获取电影列表
 * const moviesRes = await apiClient.api.movies.$get({
 *   query: {
 *     page: 1,
 *     limit: 24,
 *     genre: 'action'
 *   }
 * })
 *
 * if (moviesRes.ok) {
 *   const data = await moviesRes.json()
 *   console.log('Movies:', data.data)
 *   console.log('Total:', data.meta.total)
 * }
 *
 * // 2. 获取电影详情
 * const movieRes = await apiClient.api.movies[':identifier'].$get({
 *   param: {
 *     identifier: 'movie-slug'
 *   }
 * })
 *
 * if (movieRes.ok) {
 *   const { data: movie } = await movieRes.json()
 *   console.log('Movie:', movie)
 * }
 *
 * // 3. 获取热门电影
 * const hotRes = await apiClient.api.movies.featured.hot.$get({
 *   query: {
 *     limit: '12'
 *   }
 * })
 *
 * // 4. 获取 Actors 列表（需要 R18 权限）
 * const actorsRes = await apiClient.api.movies.actors.list.$get({
 *   query: {
 *     page: '1',
 *     limit: '50'
 *   }
 * })
 *
 * if (actorsRes.status === 403) {
 *   console.error('需要成人验证权限')
 * }
 *
 * // 5. 获取 Actor 详情
 * const actorRes = await apiClient.api.movies.actors[':slug'].$get({
 *   param: {
 *     slug: 'actor-slug'
 *   },
 *   query: {
 *     page: '1',
 *     limit: '24'
 *   }
 * })
 * ```
 */

/**
 * 类型安全的优势:
 *
 * 1. ✅ **路由自动完成**: 输入 apiClient.api. 时自动提示所有可用路由
 * 2. ✅ **参数类型检查**: query/param 参数会被自动验证
 * 3. ✅ **响应类型推导**: res.json() 返回正确的类型
 * 4. ✅ **重构安全**: API 变更后客户端代码会立即报错
 * 5. ✅ **零配置**: 不需要手动维护类型定义
 *
 * 为什么现在可以工作了?
 *
 * 关键在于 apps/api/src/index.ts 中使用了链式调用:
 *
 * ```typescript
 * const routes = app
 *   .get('/', handler)
 *   .route('/api/movies', moviesRoutes)
 *   .route('/api/actors', actorsRoutes)
 *   // ... 更多路由
 *
 * export type AppType = typeof routes  // ← 导出 routes，而不是 app
 * ```
 *
 * 这样 TypeScript 就能正确推导出完整的路由树结构！
 */
