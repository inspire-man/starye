import type { JavHkActorSearchResult, JavHkMovieSearchResult } from './javhk-parser'
import { Buffer } from 'node:buffer'
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

const JAVHK_SEARCH_PAGE_SIZE = 20
const JAVHK_MAX_SEARCH_PAGES = 7
const JAVHK_MAX_RETRY_AFTER_MS = 1500
const JAVHK_DEFAULT_COOLDOWN_MS = 30_000
const JAVHK_MAX_COOLDOWN_MS = 60_000
const JAVHK_RETRY_STATUS_CODES = [408, 425, 429, 500, 502, 503, 504]

const JAVHK_REQUEST_HEADERS = {
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Cookie': 'javhk_age_verified=1',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
}

class JavHkSourceUnavailableError extends Error {
  constructor(
    readonly statusCode: number,
    readonly retryAfterMs: number,
  ) {
    super(`JAV.hk responded with ${statusCode}.`)
    this.name = 'JavHkSourceUnavailableError'
  }
}

function parseRetryAfterMs(value: string | string[] | undefined): number | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (!rawValue)
    return undefined

  const seconds = Number(rawValue)
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(seconds * 1000, JAVHK_MAX_COOLDOWN_MS)

  const retryAt = Date.parse(rawValue)
  if (!Number.isFinite(retryAt))
    return undefined

  return Math.min(Math.max(retryAt - Date.now(), 0), JAVHK_MAX_COOLDOWN_MS)
}

function createSourceUnavailableError(
  statusCode: number,
  headers: Record<string, string | string[] | undefined>,
): JavHkSourceUnavailableError | null {
  if (statusCode !== 429 && statusCode !== 500 && statusCode !== 502 && statusCode !== 503 && statusCode !== 504)
    return null

  return new JavHkSourceUnavailableError(
    statusCode,
    parseRetryAfterMs(headers['retry-after']) ?? JAVHK_DEFAULT_COOLDOWN_MS,
  )
}

function hasImageSignature(payload: unknown): boolean {
  const bytes = Buffer.isBuffer(payload)
    ? payload
    : payload instanceof Uint8Array
      ? Buffer.from(payload)
      : null
  if (!bytes || bytes.length < 12)
    return false

  return bytes.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))
    || bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    || (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
    || bytes.toString('ascii', 0, 4) === 'GIF8'
    || bytes.toString('ascii', 4, 8) === 'ftyp'
}

function hasSearchHits(payload: unknown): boolean {
  return Boolean(
    payload
    && typeof payload === 'object'
    && Array.isArray((payload as { hits?: unknown }).hits),
  )
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
    retry: {
      limit: 1,
      maxRetryAfter: JAVHK_MAX_RETRY_AFTER_MS,
      methods: ['GET'],
      statusCodes: JAVHK_RETRY_STATUS_CODES,
    },
    throwHttpErrors: false,
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const unavailable = createSourceUnavailableError(response.statusCode, response.headers)
    if (unavailable)
      throw unavailable
    return ''
  }

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
    retry: {
      limit: 1,
      maxRetryAfter: JAVHK_MAX_RETRY_AFTER_MS,
      methods: ['GET'],
      statusCodes: JAVHK_RETRY_STATUS_CODES,
    },
    throwHttpErrors: false,
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const unavailable = createSourceUnavailableError(response.statusCode, response.headers)
    if (unavailable)
      throw unavailable
    return null
  }

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
      method: 'GET',
      responseType: 'buffer',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        ...JAVHK_REQUEST_HEADERS,
      },
      timeout: { request: 5000 },
      retry: {
        limit: 1,
        maxRetryAfter: JAVHK_MAX_RETRY_AFTER_MS,
        methods: ['GET'],
        statusCodes: JAVHK_RETRY_STATUS_CODES,
      },
      throwHttpErrors: false,
    })
    const unavailable = createSourceUnavailableError(response.statusCode, response.headers)
    if (unavailable)
      throw unavailable

    const contentType = response.headers['content-type']
    return response.statusCode >= 200
      && response.statusCode < 300
      && typeof contentType === 'string'
      && contentType.toLowerCase().startsWith('image/')
      && hasImageSignature(response.body)
  }
  catch (error) {
    if (error instanceof JavHkSourceUnavailableError)
      throw error
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

  private sourceUnavailableUntil = 0

  private isSourceCoolingDown(): boolean {
    return Date.now() < this.sourceUnavailableUntil
  }

  private markSourceUnavailable(error: unknown, operation: string): boolean {
    if (!(error instanceof JavHkSourceUnavailableError))
      return false

    const nextUnavailableUntil = Date.now() + error.retryAfterMs
    if (nextUnavailableUntil > this.sourceUnavailableUntil) {
      this.sourceUnavailableUntil = nextUnavailableUntil
      console.warn(`[JAV.hk] ${operation} 暂停 ${error.retryAfterMs}ms（HTTP ${error.statusCode}）`)
    }
    return true
  }

  async findMovieImages(movieCode: string): Promise<JavHkMovieImageUrls | null> {
    const normalizedCode = normalizeMovieCode(movieCode)
    if (!normalizedCode || this.isSourceCoolingDown())
      return null

    let apiResult: JavHkMovieSearchResult | null = null
    for (let page = 0; page < JAVHK_MAX_SEARCH_PAGES; page++) {
      const searchUrl = new URL(JAVHK_SEARCH_API_PATH, this.baseUrl)
      searchUrl.searchParams.set('q', movieCode.trim())
      searchUrl.searchParams.set('category', 'video')
      searchUrl.searchParams.set('offset', String(page * JAVHK_SEARCH_PAGE_SIZE))
      searchUrl.searchParams.set('limit', String(JAVHK_SEARCH_PAGE_SIZE))
      searchUrl.searchParams.set('lang', JAVHK_LOCALE)
      searchUrl.searchParams.set('record', '0')

      try {
        const payload = await this.requestJson(searchUrl.toString())
        if (!payload)
          break

        apiResult = parseJavHkMovieSearch(payload, movieCode, this.baseUrl)
        if (apiResult || !hasSearchHits(payload))
          break

        const hits = (payload as { hits: unknown[] }).hits
        if (hits.length < JAVHK_SEARCH_PAGE_SIZE)
          break
      }
      catch (error) {
        if (!this.markSourceUnavailable(error, `影片搜索 ${movieCode}`))
          console.warn(`[JAV.hk] 影片搜索失败 (${movieCode}): ${error instanceof Error ? error.message : String(error)}`)
        break
      }
    }

    if (this.isSourceCoolingDown())
      return null

    const candidates = [
      apiResult
        ? { cover: apiResult.cover, preview: apiResult.preview }
        : null,
      buildJavHkMovieImageUrls(movieCode),
    ].filter((value): value is JavHkMovieImageUrls => Boolean(value))

    for (const candidate of candidates) {
      try {
        const available = await Promise.all([
          this.probeImage(candidate.cover),
          this.probeImage(candidate.preview),
        ])
        if (available.every(Boolean))
          return candidate
      }
      catch (error) {
        if (!this.markSourceUnavailable(error, `影片图片 ${movieCode}`))
          throw error
        return null
      }
    }

    return null
  }

  async findActor(actorName: string): Promise<JavHkActorSearchResult | null> {
    const name = actorName.trim()
    if (!name || this.isSourceCoolingDown())
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
      if (!this.markSourceUnavailable(error, `女优搜索 ${name}`))
        console.warn(`[JAV.hk] 女优搜索失败 (${name}): ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }
}
