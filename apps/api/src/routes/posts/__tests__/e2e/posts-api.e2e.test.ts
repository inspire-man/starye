/**
 * Posts API E2E 测试 — blog-enhance 变更
 * 通过 Hono handler 直接调用验证完整 request → response 链路
 * 覆盖：series/tag/q 过滤、adjacent、HTML 文章 TOC
 */

import type { Database } from '@starye/db'
import type { Context } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { getAdjacentPostsHandler, getPostDetailBySlug, getPostList } from '../../handlers/posts.handler'

// ─── Mock Context 工厂 ────────────────────────────────────────────────────

function createMockContext(overrides: {
  db: Database
  user?: { id: string, role?: string } | null
  query?: Record<string, string>
  params?: Record<string, string>
}): Context<any> {
  const { db, user = null, query = {}, params = {} } = overrides

  return {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'db')
        return db
      if (key === 'user')
        return user
      return undefined
    }),
    req: {
      query: vi.fn().mockImplementation((key: string) => query[key]),
      param: vi.fn().mockImplementation((key: string) => params[key]),
    },
    json: vi.fn().mockImplementation((body: unknown, status?: number) => ({ body, status: status ?? 200 })),
  } as unknown as Context<any>
}

// ─── GET /posts?series= ────────────────────────────────────────────────────

describe('gET /posts?series= — 系列过滤', () => {
  it('应返回该系列的文章列表', async () => {
    const seriesPosts = [
      { id: '1', title: 'Part 1', slug: 'part-1', series: 'ts-fullstack', seriesOrder: 1, published: true, tags: null, excerpt: null, coverImage: null, contentFormat: 'html', createdAt: new Date(), updatedAt: new Date(), author: null },
      { id: '2', title: 'Part 2', slug: 'part-2', series: 'ts-fullstack', seriesOrder: 2, published: true, tags: null, excerpt: null, coverImage: null, contentFormat: 'html', createdAt: new Date(), updatedAt: new Date(), author: null },
    ]

    const mockDb = {
      query: {
        posts: {
          findMany: vi.fn().mockResolvedValue(seriesPosts),
        },
      },
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 2 }]),
        }),
      }),
    } as unknown as Database

    const c = createMockContext({
      db: mockDb,
      query: { series: 'ts-fullstack', page: '1', limit: '10' },
    })

    await getPostList(c)

    expect(c.json).toHaveBeenCalled()
    const callArg = (c.json as ReturnType<typeof vi.fn>).mock.calls[0]![0] as any
    expect(callArg.data).toHaveLength(2)
    expect(callArg.data[0].series).toBe('ts-fullstack')
  })
})

// ─── GET /posts?tag= ───────────────────────────────────────────────────────

describe('gET /posts?tag= — 标签过滤', () => {
  it('应返回含该 tag 的文章', async () => {
    const taggedPosts = [
      { id: '1', title: 'TypeScript Post', slug: 'ts-post', tags: ['typescript', 'hono'], series: null, seriesOrder: null, published: true, excerpt: null, coverImage: null, contentFormat: 'html', createdAt: new Date(), updatedAt: new Date(), author: null },
    ]

    const mockDb = {
      query: {
        posts: {
          findMany: vi.fn().mockResolvedValue(taggedPosts),
        },
      },
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 1 }]),
        }),
      }),
    } as unknown as Database

    const c = createMockContext({
      db: mockDb,
      query: { tag: 'typescript' },
    })

    await getPostList(c)

    const callArg = (c.json as ReturnType<typeof vi.fn>).mock.calls[0]![0] as any
    expect(callArg.data).toHaveLength(1)
    expect(callArg.data[0].tags).toContain('typescript')
  })
})

// ─── GET /posts?q= ────────────────────────────────────────────────────────

describe('gET /posts?q= — 关键字搜索', () => {
  it('应返回 title/excerpt 包含关键字的文章', async () => {
    const matchedPosts = [
      { id: '1', title: 'Cloudflare D1 Guide', slug: 'cf-d1', tags: null, series: null, seriesOrder: null, published: true, excerpt: 'Learn about Cloudflare D1', coverImage: null, contentFormat: 'html', createdAt: new Date(), updatedAt: new Date(), author: null },
    ]

    const mockDb = {
      query: {
        posts: {
          findMany: vi.fn().mockResolvedValue(matchedPosts),
        },
      },
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 1 }]),
        }),
      }),
    } as unknown as Database

    const c = createMockContext({
      db: mockDb,
      query: { q: 'cloudflare' },
    })

    await getPostList(c)

    const callArg = (c.json as ReturnType<typeof vi.fn>).mock.calls[0]![0] as any
    expect(callArg.data).toHaveLength(1)
    expect(callArg.data[0].title.toLowerCase()).toContain('cloudflare')
  })
})

// ─── GET /posts/:slug/adjacent ─────────────────────────────────────────────

describe('gET /posts/:slug/adjacent — 相邻文章', () => {
  it('应返回 { data: { prev, next } } 结构', async () => {
    const mockDb = {
      query: {
        posts: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: 'curr', series: 'my-series', seriesOrder: 2, createdAt: new Date() })
            .mockResolvedValueOnce({ title: 'Prev', slug: 'prev-post' })
            .mockResolvedValueOnce({ title: 'Next', slug: 'next-post' }),
        },
      },
    } as unknown as Database

    const c = createMockContext({
      db: mockDb,
      params: { slug: 'current-post' },
    })

    await getAdjacentPostsHandler(c)

    expect(c.json).toHaveBeenCalled()
    const callArg = (c.json as ReturnType<typeof vi.fn>).mock.calls[0]![0] as any
    expect(callArg.data).toHaveProperty('prev')
    expect(callArg.data).toHaveProperty('next')
    expect(callArg.data.prev.slug).toBe('prev-post')
    expect(callArg.data.next.slug).toBe('next-post')
  })

  it('孤立文章应返回 { data: { prev: null, next: null } }', async () => {
    const mockDb = {
      query: {
        posts: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    } as unknown as Database

    const c = createMockContext({
      db: mockDb,
      params: { slug: 'orphan-post' },
    })

    await getAdjacentPostsHandler(c)

    const callArg = (c.json as ReturnType<typeof vi.fn>).mock.calls[0]![0] as any
    expect(callArg.data.prev).toBeNull()
    expect(callArg.data.next).toBeNull()
  })
})

// ─── GET /posts/:slug — HTML 文章含 TOC ────────────────────────────────────

describe('gET /posts/:slug — HTML 文章含 TOC', () => {
  it('hTML 格式文章响应应包含 toc 数组', async () => {
    const htmlPost = {
      id: 'post-1',
      slug: 'html-article',
      title: 'HTML Article',
      content: '<h2>Chapter One</h2><p>text</p><h3>Sub Section</h3>',
      contentFormat: 'html',
      published: true,
      author: { id: 'u1', name: 'Author', image: null },
    }

    const mockDb = {
      query: {
        posts: {
          findFirst: vi.fn().mockResolvedValue(htmlPost),
        },
      },
    } as unknown as Database

    const c = createMockContext({
      db: mockDb,
      params: { slug: 'html-article' },
    })

    await getPostDetailBySlug(c)

    expect(c.json).toHaveBeenCalled()
    const callArg = (c.json as ReturnType<typeof vi.fn>).mock.calls[0]![0] as any
    expect(callArg.data.toc).toBeDefined()
    expect(Array.isArray(callArg.data.toc)).toBe(true)
    expect(callArg.data.toc).toHaveLength(2)
    expect(callArg.data.toc[0]).toMatchObject({ text: 'Chapter One', level: 2 })
    // 注入的 id 应存在于 content 中
    expect(callArg.data.content).toContain('id="chapter-one"')
  })

  it('未发布文章对匿名用户应返回 403', async () => {
    const draftPost = {
      id: 'draft',
      slug: 'draft-post',
      content: '',
      contentFormat: 'html',
      published: false,
      toc: [],
    }

    const mockDb = {
      query: {
        posts: {
          findFirst: vi.fn().mockResolvedValue(draftPost),
        },
      },
    } as unknown as Database

    // 使用真实 Hono app 以触发 HTTPException
    const { Hono } = await import('hono')
    const { getPostDetailBySlug: handler } = await import('../../handlers/posts.handler')
    const app = new Hono<any>()
    app.use('*', async (ctx, next) => {
      ctx.set('db', mockDb)
      ctx.set('user', null)
      await next()
    })
    app.get('/posts/:slug', handler)

    const res = await app.fetch(new Request('http://localhost/posts/draft-post'))
    expect(res.status).toBe(403)
  })
})
