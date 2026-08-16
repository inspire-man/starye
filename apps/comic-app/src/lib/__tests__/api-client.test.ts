import { afterEach, describe, expect, it, vi } from 'vitest'
import { comicApi } from '../api-client'

function mockJson(payload: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(payload),
  }
}

describe('comicApi public reads', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('serializes public list filters through the gateway API client', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJson({
      success: true,
      data: {
        data: [{ id: 'comic-1', title: 'Fixture', isR18: false }],
        pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await comicApi.getComics({
      page: 2,
      limit: 10,
      category: 'fixture',
      status: 'completed',
      search: 'phase 17',
      sortBy: 'title',
      sortOrder: 'asc',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/comics?page=2&limit=10&category=fixture&status=completed&search=phase+17&sortBy=title&sortOrder=asc',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 11, totalPages: 2 })
    expect(result.data[0]).toMatchObject({ id: 'comic-1', isR18: false })
  })

  it('uses encoded public detail and chapter paths', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockJson({ success: true, data: { id: 'comic-1', slug: 'comic/1', chapters: [] } }))
      .mockResolvedValueOnce(mockJson({ success: true, data: { id: 'chapter/1', images: [] } }))
    vi.stubGlobal('fetch', fetchMock)

    await comicApi.getComicDetail('comic/1')
    await comicApi.getChapterDetail('comic/1', 'chapter/1')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/public/comics/comic%2F1')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/public/comics/comic%2F1/chapters/chapter%2F1')
  })
})
