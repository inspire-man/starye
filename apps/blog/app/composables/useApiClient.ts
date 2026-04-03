/**
 * Hono RPC 类型安全 API 客户端 composable
 *
 * 使用 hc<AppType>() 创建完全类型安全的 API 客户端。
 * 与 Nuxt 的 useAsyncData / useFetch 配合使用，兼顾 SSR hydration 与类型推导。
 *
 * 用法示例（useAsyncData 方式，完整类型推导）：
 * ```ts
 * const client = useApiClient()
 * const { data } = await useAsyncData('posts', () =>
 *   client.api.posts.$get({ query: { limit: 9 } }).then(r => r.json()),
 * )
 * ```
 *
 * 用法示例（useFetch 兼容方式，借助 $url 生成类型安全的 URL）：
 * ```ts
 * const client = useApiClient()
 * const url = client.api.posts.$url().toString()
 * const { data } = await useFetch<ApiResponse<Post[]>>(url)
 * ```
 */
import type { AppType } from '@starye/api-types'
import { hc } from 'hono/client'

export function useApiClient() {
  const config = useRuntimeConfig()
  return hc<AppType>(config.public.apiUrl as string)
}
