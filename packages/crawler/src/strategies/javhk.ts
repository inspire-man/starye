import type { JavHkActorSearchResult, JavHkMovieSearchResult } from './javhk-parser'
import { gotScraping } from 'got-scraping'
import { Window } from 'happy-dom'
import { parseJavHkActorSearch, parseJavHkMovieSearch } from './javhk-parser'

export const JAVHK_BASE_URL = 'https://jav.hk'
export const JAVHK_IMAGE_BASE_URL = 'https://i.jav.hk'
export const JAVHK_SEARCH_API_PATH = '/api/search'
export const JAVHK_LOCALE = 'en'

export interface JavHkMovieImageUrls {
  cover: string
  preview: string
}

export type JavHkTextFetcher = (url: string) => Promise<string>
export type JavHkJsonFetcher = (url: string) => Promise<unknown>
export type JavHkImageProbe = (url: string) => Promise<boolean>

const JAVHK_REQUEST_HEADERS = {
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Cookie': 'javhk_age_verified=1',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
}

function normalizeMovieCode(code: string): string | null {
  const trimmed = code.trim()
  if (!/^\w[\w\s-]{1,39}$/iu.test(trimmed))
    return null

  const normalized = trimmed.toLowerCase().replace(/[^a-z\d]/gu, '')
  return normalized.length >= 2 ? normalized : null
}

export function buildJavHkMovieImageUrls(code: string): JavHkMovieImageUrls | null {
  const normalizedCode = normalizeMovieCode(code)
  if (!normalizedCode)
    return null

  return {
    cover: `${JAVHK_IMAGE_BASE_URL}/movie/${normalizedCode}/small/${normalizedCode}pl.jpg`,
    preview: `${JAVHK_IMAGE_BASE_URL}/movie/${normalizedCode}/small/${normalizedCode}ps.jpg`,
  }
}

async function fetchJavHkText(url: string): Promise<string> {
  const response = await gotScraping({
    url,
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      ...JAVHK_REQUEST_HEADERS,
    },
    timeout: { request: 15000 },
    retry: { limit: 1 },
    throwHttpErrors: false,
  })

  if (response.statusCode < 200 || response.statusCode >= 300)
    return ''

  return response.body
}

async function fetchJavHkJson(url: string): Promise<unknown> {
  const response = await gotScraping({
    url,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      ...JAVHK_REQUEST_HEADERS,
    },
    timeout: { request: 10000 },
    retry: { limit: 0 },
    throwHttpErrors: false,
  })

  if (response.statusCode < 200 || response.statusCode >= 300)
    return null

  try {
    return JSON.parse(response.body) as unknown
  }
  catch {
    return null
  }
}

export async function probeJavHkImage(url: string): Promise<boolean> {
  try {
    const response = await gotScraping({
      url,
      method: 'HEAD',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        ...JAVHK_REQUEST_HEADERS,
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

export class JavHkStrategy {
  readonly name = 'javhk'
  readonly baseUrl = JAVHK_BASE_URL

  constructor(
    private readonly requestText: JavHkTextFetcher = fetchJavHkText,
    private readonly requestJson: JavHkJsonFetcher = fetchJavHkJson,
    private readonly probeImage: JavHkImageProbe = probeJavHkImage,
  ) {}

  async findMovieImages(movieCode: string): Promise<JavHkMovieImageUrls | null> {
    const normalizedCode = normalizeMovieCode(movieCode)
    if (!normalizedCode)
      return null

    const searchUrl = new URL(JAVHK_SEARCH_API_PATH, this.baseUrl)
    searchUrl.searchParams.set('q', movieCode.trim())
    searchUrl.searchParams.set('category', 'video')
    searchUrl.searchParams.set('offset', '0')
    searchUrl.searchParams.set('limit', '20')
    searchUrl.searchParams.set('lang', JAVHK_LOCALE)
    searchUrl.searchParams.set('record', '0')

    let apiResult: JavHkMovieSearchResult | null = null
    try {
      apiResult = parseJavHkMovieSearch(
        await this.requestJson(searchUrl.toString()),
        movieCode,
        this.baseUrl,
      )
    }
    catch (error) {
      console.warn(`[JAV.hk] 影片搜索失败 (${movieCode}): ${error instanceof Error ? error.message : String(error)}`)
    }

    const candidates = [
      apiResult
        ? { cover: apiResult.cover, preview: apiResult.preview }
        : null,
      buildJavHkMovieImageUrls(movieCode),
    ].filter((value): value is JavHkMovieImageUrls => Boolean(value))

    for (const candidate of candidates) {
      const available = await Promise.all([
        this.probeImage(candidate.cover),
        this.probeImage(candidate.preview),
      ])
      if (available.every(Boolean))
        return candidate
    }

    return null
  }

  async findActor(actorName: string): Promise<JavHkActorSearchResult | null> {
    const name = actorName.trim()
    if (!name)
      return null

    const url = new URL(`/${JAVHK_LOCALE}/actresses`, this.baseUrl)
    url.searchParams.set('q', name)

    try {
      const html = await this.requestText(url.toString())
      if (!html)
        return null

      const window = new Window({ url: url.toString() })
      try {
        window.document.write(html)
        return parseJavHkActorSearch(window.document as unknown as Document, url.toString(), name)
      }
      finally {
        window.close()
      }
    }
    catch (error) {
      console.warn(`[JAV.hk] 女优搜索失败 (${name}): ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }
}
