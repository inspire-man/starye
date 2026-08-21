import type { JavDBMovieImageSearchResult } from './javdb-parser'
import { gotScraping } from 'got-scraping'
import { Window } from 'happy-dom'
import { parseJavDBMovieDetail, parseJavDBMovieImageSearch } from './javdb-parser'

export const JAVDB_BASE_URL = 'https://javdb.com'

export interface JavDBMovieImageUrls {
  cover: string
  preview: string
}

export type JavDBTextFetcher = (url: string) => Promise<string>
export type JavDBImageProbe = (url: string) => Promise<boolean>

const JAVDB_REQUEST_HEADERS = {
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
}

async function fetchJavDBHtml(url: string): Promise<string> {
  const response = await gotScraping({
    url,
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      ...JAVDB_REQUEST_HEADERS,
    },
    timeout: { request: 15000 },
    retry: { limit: 0 },
    throwHttpErrors: false,
  })

  if (response.statusCode < 200 || response.statusCode >= 300)
    return ''

  return response.body
}

async function probeJavDBImage(url: string): Promise<boolean> {
  try {
    const response = await gotScraping({
      url,
      method: 'HEAD',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        ...JAVDB_REQUEST_HEADERS,
      },
      timeout: { request: 5000 },
      retry: { limit: 0 },
      throwHttpErrors: false,
    })
    const contentType = response.headers['content-type']
    return response.statusCode >= 200
      && response.statusCode < 300
      && typeof contentType === 'string'
      && contentType.toLowerCase().startsWith('image/')
  }
  catch {
    return false
  }
}

export class JavDBImageStrategy {
  readonly name = 'javdb-image'
  readonly baseUrl = JAVDB_BASE_URL

  constructor(
    private readonly requestHtml: JavDBTextFetcher = fetchJavDBHtml,
    private readonly probeImage: JavDBImageProbe = probeJavDBImage,
  ) {}

  async findMovieImages(movieCode: string): Promise<JavDBMovieImageUrls | null> {
    const searchUrl = new URL('/search', this.baseUrl)
    searchUrl.searchParams.set('q', movieCode.trim())

    try {
      const searchHtml = await this.requestHtml(searchUrl.toString())
      if (!searchHtml)
        return null

      const searchWindow = new Window({ url: searchUrl.toString() })
      let searchResult: JavDBMovieImageSearchResult | null
      try {
        searchWindow.document.write(searchHtml)
        searchResult = parseJavDBMovieImageSearch(
          searchWindow.document as unknown as Document,
          searchUrl.toString(),
          movieCode,
        )
      }
      finally {
        searchWindow.close()
      }

      if (!searchResult)
        return null

      let cover = searchResult.cover
      let preview = cover
      try {
        const detailHtml = await this.requestHtml(searchResult.detailUrl)
        if (detailHtml) {
          const detailWindow = new Window({ url: searchResult.detailUrl })
          try {
            detailWindow.document.write(detailHtml)
            const detail = parseJavDBMovieDetail(
              detailWindow.document as unknown as Document,
              searchResult.detailUrl,
            )
            if (detail?.coverImage)
              cover = detail.coverImage
            if (detail?.previewImages?.[0])
              preview = detail.previewImages[0]
          }
          finally {
            detailWindow.close()
          }
        }
      }
      catch (error) {
        console.warn(`[JavDB] 详情页图片解析失败 (${movieCode}): ${error instanceof Error ? error.message : String(error)}`)
      }

      if (!(await this.probeImage(cover)))
        return null
      if (!(await this.probeImage(preview)))
        preview = cover

      return { cover, preview }
    }
    catch (error) {
      console.warn(`[JavDB] 影片搜索失败 (${movieCode}): ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }
}
