import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { createMockUser } from '../../../../test/helpers'
import { publicComicsRoutes } from '../index'

function createComic(overrides: Record<string, any> = {}) {
  return {
    id: 'comic-1',
    slug: 'comic-1',
    isR18: false,
    ...overrides,
  }
}

function createChapter(overrides: Record<string, any> = {}) {
  return {
    id: 'comic-1-chapter-1',
    title: 'Chapter 1',
    chapterNumber: 1,
    comicId: 'comic-1',
    pages: [
      {
        id: 'page-2',
        pageNumber: 2,
        imageUrl: 'https://img.example.com/page-2.jpg?token=2',
      },
      {
        id: 'page-1',
        pageNumber: 1,
        imageUrl: 'https://cdn.source.example.org/page-1.webp?token=1&quality=90',
      },
    ],
    ...overrides,
  }
}

function createDb(options: { comic?: any, chapter?: any } = {}) {
  const { comic = createComic(), chapter = createChapter() } = options

  return {
    query: {
      comics: {
        findFirst: vi.fn().mockResolvedValue(comic),
      },
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
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  } as any
}

function createApp(db: any, user?: ReturnType<typeof createMockUser> | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    if (user !== undefined) {
      c.set('user', user as any)
    }
    await next()
  })
  app.route('/', publicComicsRoutes)
  return app
}

describe('publicComicsRoutes chapter contract', () => {
  it('成功返回时保持 images 原样外链 URL，且按页码顺序输出', async () => {
    const db = createDb()
    const user = createMockUser({ isR18Verified: true })
    const app = createApp(db, user)

    const res = await app.fetch(new Request('http://localhost/comic-1/chapters/chapter-1'))

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({
      id: 'comic-1-chapter-1',
      title: 'Chapter 1',
      chapterNumber: 1,
    })
    expect(json.data.images).toEqual([
      'https://cdn.source.example.org/page-1.webp?token=1&quality=90',
      'https://img.example.com/page-2.jpg?token=2',
    ])
  })

  it('r18 漫画在未验证用户下返回 403', async () => {
    const db = createDb({
      comic: createComic({ isR18: true }),
    })
    const user = createMockUser({ isR18Verified: false })
    const app = createApp(db, user)

    const res = await app.fetch(new Request('http://localhost/comic-1/chapters/chapter-1'))

    expect(res.status).toBe(403)
    const json: any = await res.json()
    expect(json).toMatchObject({
      success: false,
      error: '需要 R18 访问权限',
    })
  })

  it('漫画不存在时返回 404', async () => {
    const db = createDb({ comic: null })
    const app = createApp(db, null)

    const res = await app.fetch(new Request('http://localhost/comic-1/chapters/chapter-1'))

    expect(res.status).toBe(404)
    const json: any = await res.json()
    expect(json.error).toBe('漫画不存在')
  })

  it('章节不存在时返回 404', async () => {
    const db = createDb({ chapter: null })
    const app = createApp(db, null)

    const res = await app.fetch(new Request('http://localhost/comic-1/chapters/chapter-1'))

    expect(res.status).toBe(404)
    const json: any = await res.json()
    expect(json.error).toBe('章节不存在')
  })
})
