import type { CrawlStrategy } from '../../lib/strategy'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ComicCrawler } from '../comic-crawler'

const baseConfig = {
  r2: {
    accountId: 'test-account',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
    publicUrl: 'https://media.example.com',
  },
  api: {
    url: 'http://localhost:8787',
    token: 'crawler-secret',
  },
}

function createStrategy(): CrawlStrategy {
  return {
    name: 'test-strategy',
    baseUrl: 'https://source.example.com',
    match: () => true,
    getMangaInfo: vi.fn().mockResolvedValue({
      title: 'Test Comic',
      slug: 'comic-1',
      cover: 'https://source.example.com/covers/cover.jpg',
      chapters: [
        {
          title: 'Chapter 1',
          slug: 'chapter-1',
          url: 'https://source.example.com/read/chapter-1',
          number: 1,
        },
      ],
    }),
    getChapterContent: vi.fn().mockResolvedValue({
      title: 'Chapter 1',
      comicSlug: 'comic-1',
      chapterSlug: 'chapter-1',
      images: [
        'https://img.example.com/page-1.jpg?token=1',
        'https://img.example.com/page-2.jpg?token=2',
      ],
    }),
  }
}

function createCrawler(options: { uploadCoversToR2?: boolean } = {}) {
  const strategy = createStrategy()
  const crawler = new ComicCrawler(
    baseConfig,
    strategy,
    'https://source.example.com/book/comic-1',
    options,
  )

  const syncToApi = vi.fn(async (endpoint: string, data: any) => {
    if (endpoint === '/api/admin/sync' && data?.type === 'manga') {
      return { success: true }
    }

    if (endpoint.includes('/existing-chapters')) {
      return []
    }

    if (endpoint === '/api/admin/sync' && data?.type === 'chapter') {
      return { success: true }
    }

    if (endpoint.includes('/progress')) {
      return { success: true }
    }

    return null
  })

  const processImage = vi.fn().mockResolvedValue([
    {
      variant: 'preview',
      url: 'https://media.example.com/comics/comic-1/cover-preview.webp',
    },
  ])

  ;(crawler as any).syncToApi = syncToApi
  ;(crawler as any).imageProcessor = { process: processImage }

  return { crawler, strategy, syncToApi, processImage }
}

describe('comicCrawler chapter flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('默认不上传封面，正文图保持源站外链', async () => {
    const { crawler, syncToApi, processImage } = createCrawler()

    await (crawler as any).processManga('https://source.example.com/book/comic-1', {} as any, {})

    expect(processImage).not.toHaveBeenCalled()

    const mangaSyncCall = syncToApi.mock.calls.find(
      ([endpoint, payload]) => endpoint === '/api/admin/sync' && payload?.type === 'manga',
    )
    expect(mangaSyncCall?.[1].data.cover).toBe('https://source.example.com/covers/cover.jpg')

    const chapterSyncCall = syncToApi.mock.calls.find(
      ([endpoint, payload]) => endpoint === '/api/admin/sync' && payload?.type === 'chapter',
    )
    expect(chapterSyncCall?.[1].data.images).toEqual([
      'https://img.example.com/page-1.jpg?token=1',
      'https://img.example.com/page-2.jpg?token=2',
    ])
  })

  it('显式开启时只上传封面，不处理章节正文图', async () => {
    const { crawler, syncToApi, processImage } = createCrawler({ uploadCoversToR2: true })

    await (crawler as any).processManga('https://source.example.com/book/comic-1', {} as any, {})

    expect(processImage).toHaveBeenCalledTimes(1)
    expect(processImage).toHaveBeenCalledWith(
      'https://source.example.com/covers/cover.jpg',
      'comics/comic-1',
      'cover',
    )

    const mangaSyncCall = syncToApi.mock.calls.find(
      ([endpoint, payload]) => endpoint === '/api/admin/sync' && payload?.type === 'manga',
    )
    expect(mangaSyncCall?.[1].data.cover).toBe('https://media.example.com/comics/comic-1/cover-preview.webp')

    const chapterSyncCall = syncToApi.mock.calls.find(
      ([endpoint, payload]) => endpoint === '/api/admin/sync' && payload?.type === 'chapter',
    )
    expect(chapterSyncCall?.[1].data.images).toEqual([
      'https://img.example.com/page-1.jpg?token=1',
      'https://img.example.com/page-2.jpg?token=2',
    ])
  })
})
