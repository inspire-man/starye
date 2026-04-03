/**
 * Posts Handlers 扩展测试 — blog-enhance 变更
 * 覆盖：getPostList 新过滤参数透传 / getAdjacentPostsHandler
 */

import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { createMockAuth, createMockDb, createMockPost } from '../../../../test/helpers'
import { getAdjacentPostsHandler, getPostList } from '../../handlers/posts.handler'
import * as postService from '../../services/post.service'

// ─── getPostList — 新过滤参数透传 ─────────────────────────────────────────

describe('getPostList — blog-enhance 新过滤参数', () => {
  function buildApp(mockDb: ReturnType<typeof createMockDb>) {
    const app = new Hono<AppEnv>()
    app.use('*', async (c, next) => {
      c.set('db', mockDb)
      c.set('auth', createMockAuth(null))
      await next()
    })
    app.get('/posts', getPostList)
    return app
  }

  it('应该将 series 参数透传到 getPosts service', async () => {
    const mockGetPosts = vi.spyOn(postService, 'getPosts').mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    })

    const app = buildApp(createMockDb())
    const req = new Request('http://localhost/posts?series=ts-fullstack')
    await app.fetch(req)

    expect(mockGetPosts).toHaveBeenCalledWith(
      expect.objectContaining({ series: 'ts-fullstack' }),
    )
    mockGetPosts.mockRestore()
  })

  it('应该将 tag 参数透传到 getPosts service', async () => {
    const mockGetPosts = vi.spyOn(postService, 'getPosts').mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    })

    const app = buildApp(createMockDb())
    const req = new Request('http://localhost/posts?tag=typescript')
    await app.fetch(req)

    expect(mockGetPosts).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'typescript' }),
    )
    mockGetPosts.mockRestore()
  })

  it('应该将 q 参数透传到 getPosts service', async () => {
    const mockGetPosts = vi.spyOn(postService, 'getPosts').mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    })

    const app = buildApp(createMockDb())
    const req = new Request('http://localhost/posts?q=cloudflare')
    await app.fetch(req)

    expect(mockGetPosts).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'cloudflare' }),
    )
    mockGetPosts.mockRestore()
  })

  it('不传过滤参数时 series/tag/q 均为 undefined', async () => {
    const mockGetPosts = vi.spyOn(postService, 'getPosts').mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    })

    const app = buildApp(createMockDb())
    const req = new Request('http://localhost/posts')
    await app.fetch(req)

    expect(mockGetPosts).toHaveBeenCalledWith(
      expect.objectContaining({
        series: undefined,
        tag: undefined,
        q: undefined,
      }),
    )
    mockGetPosts.mockRestore()
  })
})

// ─── getAdjacentPostsHandler ──────────────────────────────────────────────

describe('getAdjacentPostsHandler', () => {
  function buildApp(mockDb: ReturnType<typeof createMockDb>) {
    const app = new Hono<AppEnv>()
    app.use('*', async (c, next) => {
      c.set('db', mockDb)
      c.set('auth', createMockAuth(null))
      await next()
    })
    // 注意：路由注册顺序与 posts/index.ts 一致
    app.get('/posts/:slug/adjacent', getAdjacentPostsHandler)
    return app
  }

  it('应该返回 { data: { prev, next } } 结构', async () => {
    const prevPost = createMockPost({ id: 'prev', title: 'Prev Post', slug: 'prev-post' })
    const nextPost = createMockPost({ id: 'next', title: 'Next Post', slug: 'next-post' })

    const mockGetAdjacent = vi.spyOn(postService, 'getAdjacentPosts').mockResolvedValue({
      prev: { title: prevPost.title, slug: prevPost.slug },
      next: { title: nextPost.title, slug: nextPost.slug },
    })

    const app = buildApp(createMockDb())
    const req = new Request('http://localhost/posts/current-post/adjacent')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data.prev.title).toBe('Prev Post')
    expect(json.data.next.title).toBe('Next Post')

    mockGetAdjacent.mockRestore()
  })

  it('无相邻文章时应返回 { data: { prev: null, next: null } }', async () => {
    const mockGetAdjacent = vi.spyOn(postService, 'getAdjacentPosts').mockResolvedValue({
      prev: null,
      next: null,
    })

    const app = buildApp(createMockDb())
    const req = new Request('http://localhost/posts/standalone-post/adjacent')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data.prev).toBeNull()
    expect(json.data.next).toBeNull()

    mockGetAdjacent.mockRestore()
  })

  it('应该将 slug 路由参数传入 getAdjacentPosts service', async () => {
    const mockGetAdjacent = vi.spyOn(postService, 'getAdjacentPosts').mockResolvedValue({
      prev: null,
      next: null,
    })

    const app = buildApp(createMockDb())
    await app.fetch(new Request('http://localhost/posts/my-post-slug/adjacent'))

    expect(mockGetAdjacent).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'my-post-slug' }),
    )

    mockGetAdjacent.mockRestore()
  })
})
