/**
 * Posts Service 扩展测试 — blog-enhance 变更
 * 覆盖：extractTocFromHtml / getPosts 新过滤参数 / getAdjacentPosts / getPostBySlug TOC
 */

import type { Database } from '@starye/db'
import { describe, expect, it, vi } from 'vitest'
import {
  extractTocFromHtml,
  getAdjacentPosts,
  getPostBySlug,
  getPosts,
} from '../../services/post.service'

// ─── extractTocFromHtml ────────────────────────────────────────────────────

describe('extractTocFromHtml', () => {
  it('应该提取 h2/h3 标题并注入 id', () => {
    const html = '<h2>Introduction</h2><p>text</p><h3>Details</h3>'
    const { toc, processedHtml } = extractTocFromHtml(html)

    expect(toc).toHaveLength(2)
    expect(toc[0]).toEqual({ id: 'introduction', text: 'Introduction', level: 2 })
    expect(toc[1]).toEqual({ id: 'details', text: 'Details', level: 3 })
    expect(processedHtml).toContain('id="introduction"')
    expect(processedHtml).toContain('id="details"')
  })

  it('应该正确处理中文标题', () => {
    const html = '<h2>项目启动</h2><h3>技术选型</h3>'
    const { toc, processedHtml } = extractTocFromHtml(html)

    expect(toc).toHaveLength(2)
    expect(toc[0].text).toBe('项目启动')
    expect(toc[0].level).toBe(2)
    expect(toc[1].text).toBe('技术选型')
    expect(processedHtml).toContain('id="项目启动"')
  })

  it('应该跳过内容为空的标题', () => {
    const html = '<h2></h2><h2>Valid</h2>'
    const { toc } = extractTocFromHtml(html)

    expect(toc).toHaveLength(1)
    expect(toc[0].text).toBe('Valid')
  })

  it('应该移除标题中的已有 id 属性并重新注入', () => {
    const html = '<h2 id="old-id" class="title">Section</h2>'
    const { processedHtml, toc } = extractTocFromHtml(html)

    expect(processedHtml).not.toContain('id="old-id"')
    expect(processedHtml).toContain(`id="${toc[0]!.id}"`)
  })

  it('应该保留标题中的内联 HTML 结构（strip 后计算 id）', () => {
    const html = '<h2><strong>Bold Title</strong></h2>'
    const { toc } = extractTocFromHtml(html)

    expect(toc[0]!.text).toBe('Bold Title')
    expect(toc[0]!.id).toBe('bold-title')
  })

  it('空 HTML 应返回空 toc', () => {
    const { toc, processedHtml } = extractTocFromHtml('')
    expect(toc).toHaveLength(0)
    expect(processedHtml).toBe('')
  })

  it('无标题 HTML 应返回空 toc', () => {
    const html = '<p>paragraph</p><div>content</div>'
    const { toc } = extractTocFromHtml(html)
    expect(toc).toHaveLength(0)
  })
})

// ─── getPosts 新过滤参数 ───────────────────────────────────────────────────

describe('getPosts — 新过滤参数', () => {
  function buildMockDb(posts: any[] = [], total = 0) {
    return {
      query: {
        posts: {
          findMany: vi.fn().mockResolvedValue(posts),
        },
      },
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(
            Promise.resolve([{ value: total }]),
          ),
        }),
      }),
    } as unknown as Database
  }

  it('传入 series 时应按 seriesOrder 升序排列', async () => {
    const seriesPosts = [
      { id: '1', title: 'Part 1', slug: 'part-1', series: 'my-series', seriesOrder: 1, published: true, tags: null, excerpt: null, coverImage: null, contentFormat: 'html', createdAt: new Date(), updatedAt: new Date(), author: null },
      { id: '2', title: 'Part 2', slug: 'part-2', series: 'my-series', seriesOrder: 2, published: true, tags: null, excerpt: null, coverImage: null, contentFormat: 'html', createdAt: new Date(), updatedAt: new Date(), author: null },
    ]
    const mockDb = buildMockDb(seriesPosts, 2)

    const result = await getPosts({ db: mockDb, series: 'my-series' })

    expect(result.data).toHaveLength(2)
    expect(mockDb.query.posts.findMany).toHaveBeenCalled()
  })

  it('传入 tag 时应通过 json_each 查询', async () => {
    const taggedPost = [
      { id: '1', title: 'TS Post', slug: 'ts-post', tags: ['typescript', 'hono'], series: null, seriesOrder: null, published: true, excerpt: null, coverImage: null, contentFormat: 'html', createdAt: new Date(), updatedAt: new Date(), author: null },
    ]
    const mockDb = buildMockDb(taggedPost, 1)

    const result = await getPosts({ db: mockDb, tag: 'typescript' })

    expect(result.data).toHaveLength(1)
    expect(mockDb.query.posts.findMany).toHaveBeenCalled()
  })

  it('传入 q 时应进行关键字搜索', async () => {
    const matchPost = [
      { id: '1', title: 'Cloudflare D1 Guide', slug: 'cf-d1', tags: null, series: null, seriesOrder: null, published: true, excerpt: 'About D1', coverImage: null, contentFormat: 'html', createdAt: new Date(), updatedAt: new Date(), author: null },
    ]
    const mockDb = buildMockDb(matchPost, 1)

    const result = await getPosts({ db: mockDb, q: 'cloudflare' })

    expect(result.data).toHaveLength(1)
    expect(mockDb.query.posts.findMany).toHaveBeenCalled()
  })

  it('不传过滤参数时应正常返回分页结果', async () => {
    const mockDb = buildMockDb([], 0)
    const result = await getPosts({ db: mockDb, page: 1, pageSize: 10 })

    expect(result.meta.page).toBe(1)
    expect(result.meta.limit).toBe(10)
  })
})

// ─── getAdjacentPosts ─────────────────────────────────────────────────────

describe('getAdjacentPosts', () => {
  it('slug 不存在时应返回 { prev: null, next: null }', async () => {
    const mockDb = {
      query: {
        posts: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    } as unknown as Database

    const result = await getAdjacentPosts({ db: mockDb, slug: 'non-existent' })

    expect(result).toEqual({ prev: null, next: null })
  })

  it('系列文章应按 seriesOrder ±1 查询上下篇', async () => {
    const currentPost = {
      id: 'post-2',
      series: 'my-series',
      seriesOrder: 2,
      createdAt: new Date('2024-06-01'),
    }
    const prevPost = { title: 'Part 1', slug: 'part-1' }
    const nextPost = { title: 'Part 3', slug: 'part-3' }

    const findFirst = vi.fn()
      .mockResolvedValueOnce(currentPost)
      .mockResolvedValueOnce(prevPost)
      .mockResolvedValueOnce(nextPost)

    const mockDb = {
      query: {
        posts: { findFirst },
      },
    } as unknown as Database

    const result = await getAdjacentPosts({ db: mockDb, slug: 'part-2' })

    expect(result.prev).toEqual(prevPost)
    expect(result.next).toEqual(nextPost)
    // 系列模式：调用了 3 次（当前 + prev + next 并发，但 findFirst 是顺序调用的 mock）
    expect(findFirst).toHaveBeenCalledTimes(3)
  })

  it('非系列文章应按 createdAt 全局查询上下篇', async () => {
    const currentPost = {
      id: 'post-global',
      series: null,
      seriesOrder: null,
      createdAt: new Date('2024-06-01'),
    }

    const findFirst = vi.fn().mockResolvedValueOnce(currentPost)

    const prevResult = [{ title: 'Older Post', slug: 'older-post' }]
    const nextResult = [{ title: 'Newer Post', slug: 'newer-post' }]

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    }
    selectChain.limit
      .mockResolvedValueOnce(prevResult)
      .mockResolvedValueOnce(nextResult)

    const mockDb = {
      query: {
        posts: { findFirst },
      },
      select: vi.fn().mockReturnValue(selectChain),
    } as unknown as Database

    const result = await getAdjacentPosts({ db: mockDb, slug: 'global-post' })

    expect(result.prev).toEqual(prevResult[0])
    expect(result.next).toEqual(nextResult[0])
  })

  it('系列首篇的 prev 应为 null', async () => {
    const currentPost = {
      id: 'post-1',
      series: 'my-series',
      seriesOrder: 1,
      createdAt: new Date('2024-01-01'),
    }
    const nextPost = { title: 'Part 2', slug: 'part-2' }

    const findFirst = vi.fn()
      .mockResolvedValueOnce(currentPost)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(nextPost)

    const mockDb = {
      query: {
        posts: { findFirst },
      },
    } as unknown as Database

    const result = await getAdjacentPosts({ db: mockDb, slug: 'part-1' })

    expect(result.prev).toBeNull()
    expect(result.next).toEqual(nextPost)
  })
})

// ─── getPostBySlug TOC 提取 ───────────────────────────────────────────────

describe('getPostBySlug — TOC 提取', () => {
  it('hTML 格式文章应提取 toc 并注入标题 id', async () => {
    const htmlPost = {
      id: 'post-1',
      slug: 'html-post',
      title: 'HTML Post',
      content: '<h2>Chapter 1</h2><p>text</p><h3>Section A</h3>',
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

    const result = await getPostBySlug({ db: mockDb, slug: 'html-post' })

    expect(result).not.toBeNull()
    expect(result!.toc).toHaveLength(2)
    expect(result!.toc[0]).toMatchObject({ text: 'Chapter 1', level: 2 })
    expect(result!.content).toContain('id="chapter-1"')
  })

  it('markdown 格式文章应返回空 toc 且不修改内容', async () => {
    const mdPost = {
      id: 'post-2',
      slug: 'md-post',
      title: 'Markdown Post',
      content: '## Chapter 1\n\nSome text',
      contentFormat: 'markdown',
      published: true,
      author: null,
    }

    const mockDb = {
      query: {
        posts: {
          findFirst: vi.fn().mockResolvedValue(mdPost),
        },
      },
    } as unknown as Database

    const result = await getPostBySlug({ db: mockDb, slug: 'md-post' })

    expect(result!.toc).toEqual([])
    expect(result!.content).toBe('## Chapter 1\n\nSome text')
  })

  it('contentFormat 为 null 时应返回空 toc', async () => {
    const legacyPost = {
      id: 'post-3',
      slug: 'legacy-post',
      content: '<h2>Test</h2>',
      contentFormat: null,
      published: true,
      author: null,
    }

    const mockDb = {
      query: {
        posts: {
          findFirst: vi.fn().mockResolvedValue(legacyPost),
        },
      },
    } as unknown as Database

    const result = await getPostBySlug({ db: mockDb, slug: 'legacy-post' })

    expect(result!.toc).toEqual([])
  })

  it('slug 不存在时应返回 null', async () => {
    const mockDb = {
      query: {
        posts: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    } as unknown as Database

    const result = await getPostBySlug({ db: mockDb, slug: 'not-found' })

    expect(result).toBeNull()
  })
})
