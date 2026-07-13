import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminChaptersRoutes } from '../index'

function createChapterRecord(overrides: Record<string, any> = {}) {
  return {
    id: 'comic-1-chapter-1',
    title: 'Chapter 1',
    sourcePageCount: 2,
    pages: [
      {
        id: 'comic-1-chapter-1-1',
        pageNumber: 1,
        imageUrl: 'https://img.example.com/1.jpg?token=1',
      },
      {
        id: 'comic-1-chapter-1-2',
        pageNumber: 2,
        imageUrl: 'https://img.example.com/2.jpg?token=2',
      },
    ],
    ...overrides,
  }
}

function createDb(chapter: any) {
  return {
    query: {
      chapters: {
        findFirst: vi.fn().mockImplementation(async (args: any) => {
          if (!chapter) {
            return undefined
          }

          const pages = [...chapter.pages]
          const orderBy = args?.with?.pages?.orderBy
          const sortedPages = orderBy ? pages.sort((a, b) => a.pageNumber - b.pageNumber) : pages

          return {
            ...chapter,
            pages: sortedPages,
          }
        }),
      },
    },
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  } as any
}

function createApp(db: any) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    ;(c as any).env = { CRAWLER_SECRET: 'secret-token' }
    await next()
  })
  app.route('/', adminChaptersRoutes)
  return { app }
}

describe('adminChaptersRoutes integrity probe', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('/check 仍然是 cheap local check，不触发远程探测', async () => {
    const db = createDb(createChapterRecord())
    const { app } = createApp(db)

    const res = await app.fetch(new Request('http://localhost/check?comicSlug=comic-1&chapterSlug=chapter-1', {
      headers: { 'x-service-token': 'secret-token' },
    }))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json).toMatchObject({
      exists: true,
      count: 2,
      hasFailures: false,
      status: 'complete',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('integrity route 只读返回失败样本，不写库', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))

    const db = createDb(createChapterRecord())
    const { app } = createApp(db)

    const res = await app.fetch(new Request('http://localhost/comic-1-chapter-1/integrity', {
      headers: { 'x-service-token': 'secret-token' },
    }))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({
      chapterId: 'comic-1-chapter-1',
      totalPages: 2,
      checkedPages: 2,
      okCount: 1,
      failureCount: 1,
      status: 'degraded',
    })
    expect(json.data.failures).toEqual([
      expect.objectContaining({
        pageNumber: 2,
        url: 'https://img.example.com/2.jpg?token=2',
        status: 503,
        reason: 'http_503',
      }),
    ])
    expect(db.update).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('dangerous URL 会被 SSRF 守卫拒绝，且不发起 fetch', async () => {
    const db = createDb(createChapterRecord({
      pages: [
        {
          id: 'comic-1-chapter-1-1',
          pageNumber: 1,
          imageUrl: 'http://localhost:3000/internal-only.jpg',
        },
      ],
    }))
    const { app } = createApp(db)

    const res = await app.fetch(new Request('http://localhost/comic-1-chapter-1/integrity', {
      headers: { 'x-service-token': 'secret-token' },
    }))

    expect(res.status).toBe(400)
    const json: any = await res.json()
    expect(json.success).toBe(false)
    expect(json.blockedCount).toBe(1)
    expect(json.blockedPages[0]).toMatchObject({
      pageNumber: 1,
      reason: 'blocked_by_url_guard',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
