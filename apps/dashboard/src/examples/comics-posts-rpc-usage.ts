/**
 * Hono RPC 类型推导示例 - Comics 和 Posts 模块
 *
 * 本文件展示了重构后的 comics 和 posts 模块的 RPC 类型推导
 */

/* eslint-disable no-console */

import type { AppType } from '@starye/api-types'
import { hc } from 'hono/client'

// 创建类型安全的 API 客户端
const apiClient = hc<AppType>('/api')

/**
 * Comics API 示例
 */
async function comicsExamples() {
  // ✅ 获取漫画列表 - 带类型推导
  const comicListResponse = await apiClient.api.comics.$get({
    query: {
      page: '1',
      limit: '20',
      region: 'jp',
      genre: 'action',
    },
  })

  if (comicListResponse.ok) {
    const data = await comicListResponse.json()
    // data 类型自动推导为 GetComicsResult
    console.log(`Total comics: ${data.meta.total}`)

    // TypeScript 会提示 data 的完整结构
    data.data.forEach((comic) => {
      console.log(`Comic: ${comic.title} (${comic.slug})`)
      // comic 的所有属性都有完整的类型提示
    })
  }

  // ✅ 获取漫画详情
  const comicDetailResponse = await apiClient.api.comics[':slug'].$get({
    param: {
      slug: 'one-piece',
    },
  })

  if (comicDetailResponse.ok) {
    const { data: comic } = await comicDetailResponse.json()
    console.log(`Comic: ${comic.title}`)
    console.log(`Chapters: ${comic.chapters?.length ?? 0}`)
  }
}

/**
 * Posts API 示例
 */
async function postsExamples() {
  // ✅ 获取文章列表 - 带类型推导
  const postListResponse = await apiClient.api.posts.$get({
    query: {
      page: '1',
      limit: '10',
      draft: 'false',
    },
  })

  if (postListResponse.ok) {
    const data = await postListResponse.json()
    console.log(`Total posts: ${data.meta.total}`)

    data.data.forEach((post) => {
      console.log(`Post: ${post.title} by ${post.author?.name}`)
      // TypeScript 自动推导 post 的类型
    })
  }

  // ✅ 获取文章详情（通过 slug）
  const postDetailResponse = await apiClient.api.posts[':slug'].$get({
    param: {
      slug: 'my-first-post',
    },
  })

  if (postDetailResponse.ok) {
    const { data: post } = await postDetailResponse.json()
    console.log(`Post: ${post.title}`)
    console.log(`Author: ${post.author?.name}`)
  }

  // ✅ 创建文章（需要 admin 权限）
  const createPostResponse = await apiClient.api.posts.$post({
    json: {
      title: 'New Post',
      slug: 'new-post',
      content: 'Post content...',
      published: false,
    },
  })

  if (createPostResponse.ok) {
    const { data: newPost } = await createPostResponse.json()
    console.log(`Created post: ${newPost.id}`)
  }

  // ✅ 删除文章
  const deletePostResponse = await apiClient.api.posts[':id'].$delete({
    param: {
      id: 'post-id-123',
    },
  })

  if (deletePostResponse.ok) {
    const result = await deletePostResponse.json()
    console.log(`Delete success: ${result.success}`)
  }
}

/**
 * 类型安全的好处：
 *
 * 1. ✅ 自动完成：IDE 会提示所有可用的 API 路径和方法
 * 2. ✅ 参数校验：query/param/json 的类型都会被检查
 * 3. ✅ 响应类型：返回的 data 类型自动推导
 * 4. ✅ 编译时错误：拼写错误或类型不匹配会在编译时发现
 *
 * 例如：
 * - apiClient.api.comics.$get({ query: { page: 1 } })  // ❌ TypeScript 错误：page 应该是 string
 * - apiClient.api.comics.$get({ query: { page: '1' } }) // ✅ 正确
 *
 * - apiClient.api.posts[':slug'].$get({ param: { id: '123' } })  // ❌ 错误：应该是 slug 不是 id
 * - apiClient.api.posts[':slug'].$get({ param: { slug: 'my-post' } }) // ✅ 正确
 */

// 导出示例函数
export { comicsExamples, postsExamples }
