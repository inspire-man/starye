import { describe, expect, it, vi } from 'vitest'
import { syncChapterData } from '../handlers'

interface StoredPage {
  id: string
  chapterId: string
  pageNumber: number
  imageUrl: string
  width: number
  height: number
}

interface ChapterFixture {
  id: string
  sourcePageCount: number | null
  pages: StoredPage[]
}

function createChapterFixture(overrides: Partial<ChapterFixture> = {}): ChapterFixture {
  return {
    id: 'comic-1-chapter-1',
    sourcePageCount: 2,
    pages: [
      {
        id: 'comic-1-chapter-1-1',
        chapterId: 'comic-1-chapter-1',
        pageNumber: 1,
        imageUrl: 'https://old.example.com/1.jpg',
        width: 0,
        height: 0,
      },
      {
        id: 'comic-1-chapter-1-2',
        chapterId: 'comic-1-chapter-1',
        pageNumber: 2,
        imageUrl: 'https://old.example.com/2.jpg',
        width: 0,
        height: 0,
      },
    ],
    ...overrides,
  }
}

function createSyncDb(options: { chapter?: ChapterFixture | null, failInsertCall?: number } = {}) {
  const { chapter = createChapterFixture(), failInsertCall } = options
  const state = {
    pages: chapter?.pages.map(page => ({ ...page })) ?? [],
  }
  let insertCallCount = 0

  const deleteWhere = vi.fn().mockImplementation(async () => {
    state.pages = []
  })

  const insertValues = vi.fn().mockImplementation(async (values: StoredPage[]) => {
    insertCallCount++

    if (failInsertCall && insertCallCount === failInsertCall) {
      throw new Error('insert failed')
    }

    state.pages.push(...values.map(page => ({ ...page })))
  })

  const updateWhere = vi.fn().mockResolvedValue(undefined)
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere })

  const db = {
    query: {
      chapters: {
        findFirst: vi.fn().mockImplementation(async () => {
          if (!chapter) {
            return undefined
          }

          return {
            ...chapter,
            pages: state.pages.map(page => ({ ...page })),
          }
        }),
      },
    },
    delete: vi.fn().mockReturnValue({ where: deleteWhere }),
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    update: vi.fn().mockReturnValue({ set: updateSet }),
  } as any

  return { db, state, spies: { deleteWhere, insertValues, updateSet, updateWhere } }
}

async function runSyncChapterData(db: any, images: string[]) {
  const c = {
    get: vi.fn().mockReturnValue(db),
    json: (body: any, status = 200) => ({ status, body }),
  } as any

  return syncChapterData(c, {
    data: {
      comicSlug: 'comic-1',
      chapterSlug: 'chapter-1',
      title: 'Chapter 1',
      images,
    },
  }) as Promise<{ status: number, body: any }>
}

describe('syncChapterData', () => {
  it('空图片集返回 409，不覆盖已有页面', async () => {
    const { db, state } = createSyncDb()

    const response = await runSyncChapterData(db, [])

    expect(response.status).toBe(409)
    expect(response.body.success).toBe(false)
    expect(state.pages.map(page => page.imageUrl)).toEqual([
      'https://old.example.com/1.jpg',
      'https://old.example.com/2.jpg',
    ])
  })

  it('回退到低于 baseline 的图片集返回 409', async () => {
    const { db, state } = createSyncDb({
      chapter: createChapterFixture({
        sourcePageCount: 4,
      }),
    })

    const response = await runSyncChapterData(db, [
      'https://new.example.com/1.jpg',
      'https://new.example.com/2.jpg',
      'https://new.example.com/3.jpg',
    ])

    expect(response.status).toBe(409)
    expect(response.body.success).toBe(false)
    expect(response.body.baseline).toBe(4)
    expect(state.pages).toHaveLength(2)
  })

  it('same count 允许替换并更新 sourcePageCount', async () => {
    const { db, state, spies } = createSyncDb()

    const response = await runSyncChapterData(db, [
      'https://new.example.com/1.jpg',
      'https://new.example.com/2.jpg',
    ])

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ success: true, count: 2 })
    expect(state.pages.map(page => page.imageUrl)).toEqual([
      'https://new.example.com/1.jpg',
      'https://new.example.com/2.jpg',
    ])
    expect(spies.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      sourcePageCount: 2,
      updatedAt: expect.any(Date),
    }))
  })

  it('expanded count 允许替换为更完整页面集', async () => {
    const { db, state } = createSyncDb()

    const response = await runSyncChapterData(db, [
      'https://new.example.com/1.jpg',
      'https://new.example.com/2.jpg',
      'https://new.example.com/3.jpg',
    ])

    expect(response.status).toBe(200)
    expect(response.body.count).toBe(3)
    expect(state.pages.map(page => page.imageUrl)).toEqual([
      'https://new.example.com/1.jpg',
      'https://new.example.com/2.jpg',
      'https://new.example.com/3.jpg',
    ])
  })

  it('替换插入中途失败时回滚旧页面', async () => {
    const { db, state, spies } = createSyncDb({ failInsertCall: 2 })
    const incomingImages = Array.from({ length: 12 }, (_, index) => `https://new.example.com/${index + 1}.jpg`)

    const response = await runSyncChapterData(db, incomingImages)

    expect(response.status).toBe(500)
    expect(response.body.success).toBe(false)
    expect(state.pages.map(page => page.imageUrl)).toEqual([
      'https://old.example.com/1.jpg',
      'https://old.example.com/2.jpg',
    ])
    expect(spies.insertValues).toHaveBeenCalledTimes(3)
    expect(spies.updateSet).not.toHaveBeenCalled()
  })
})
