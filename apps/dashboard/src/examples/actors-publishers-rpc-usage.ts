/**
 * Hono RPC 类型推导示例 - Actors 和 Publishers 模块
 *
 * 本文件展示了重构后的 actors 和 publishers 模块的 RPC 类型推导
 */

/* eslint-disable no-console */

import type { AppType } from '@starye/api-types'
import { hc } from 'hono/client'

// 创建类型安全的 API 客户端
const apiClient = hc<AppType>('/api')

/**
 * Actors API 示例
 */
async function actorsExamples() {
  // ✅ 获取女优列表 - 带类型推导
  const actorListResponse = await apiClient.api.actors.$get({
    query: {
      page: '1',
      limit: '20',
      sort: 'movieCount',
      nationality: 'jp',
      isActive: 'true',
    },
  })

  if (actorListResponse.ok) {
    const data = await actorListResponse.json()
    // data 类型自动推导为 GetActorsResult
    console.log(`Total actors: ${data.meta.total}`)

    // TypeScript 会提示 data 的完整结构
    data.data.forEach((actor) => {
      console.log(`Actor: ${actor.name} (${actor.slug})`)
      console.log(`  Movies: ${actor.movieCount}`)
      console.log(`  Nationality: ${actor.nationality}`)
      // actor 的所有属性都有完整的类型提示
    })
  }

  // ✅ 获取女优详情
  const actorDetailResponse = await apiClient.api.actors[':slug'].$get({
    param: {
      slug: 'yui-hatano',
    },
  })

  if (actorDetailResponse.ok) {
    const actor = await actorDetailResponse.json()
    console.log(`Actor: ${actor.name}`)
    console.log(`Related Movies: ${actor.relatedMovies?.length ?? 0}`)

    // relatedMovies 的类型也完全推导
    actor.relatedMovies?.forEach((movie) => {
      console.log(`  - ${movie.title} (${movie.code})`)
    })
  }
}

/**
 * Publishers API 示例
 */
async function publishersExamples() {
  // ✅ 获取厂商列表 - 带类型推导
  const publisherListResponse = await apiClient.api.publishers.$get({
    query: {
      page: '1',
      limit: '20',
      sort: 'movieCount',
      country: 'jp',
    },
  })

  if (publisherListResponse.ok) {
    const data = await publisherListResponse.json()
    console.log(`Total publishers: ${data.meta.total}`)

    data.data.forEach((publisher) => {
      console.log(`Publisher: ${publisher.name}`)
      console.log(`  Movies: ${publisher.movieCount}`)
      console.log(`  Country: ${publisher.country}`)
    })
  }

  // ✅ 获取厂商详情
  const publisherDetailResponse = await apiClient.api.publishers[':slug'].$get({
    param: {
      slug: 's1-no1',
    },
  })

  if (publisherDetailResponse.ok) {
    const publisher = await publisherDetailResponse.json()
    console.log(`Publisher: ${publisher.name}`)
    console.log(`Related Movies: ${publisher.relatedMovies?.length ?? 0}`)
  }
}

/**
 * 类型安全的好处：
 *
 * 1. ✅ 自动完成：IDE 会提示所有可用的 API 路径和方法
 * 2. ✅ 参数校验：query/param 的类型都会被检查
 * 3. ✅ 响应类型：返回的 data 类型自动推导
 * 4. ✅ 编译时错误：拼写错误或类型不匹配会在编译时发现
 *
 * 例如：
 * - apiClient.api.actors.$get({ query: { page: 1 } })  // ❌ TypeScript 错误：page 应该是 string
 * - apiClient.api.actors.$get({ query: { page: '1' } }) // ✅ 正确
 *
 * - apiClient.api.actors[':slug'].$get({ param: { id: '123' } })  // ❌ 错误：应该是 slug 不是 id
 * - apiClient.api.actors[':slug'].$get({ param: { slug: 'yui-hatano' } }) // ✅ 正确
 */

// 导出示例函数
export { actorsExamples, publishersExamples }
