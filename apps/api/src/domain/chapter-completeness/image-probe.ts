import { normalizePageFetchUrl, redactedPageUrl } from './page-identity'

export type ImageProbeStatus = 'available' | 'unavailable' | 'unknown' | 'degraded'
export type ImageProbeReason
  = | 'available'
    | 'http_failure'
    | 'redirect'
    | 'challenge_html'
    | 'content_type_invalid'
    | 'content_type_missing'
    | 'timeout'
    | 'probe_failed'
    | 'url_invalid'

export interface ImageProbeResult {
  readonly contentType?: string
  readonly httpStatus?: number
  readonly reason: ImageProbeReason
  readonly status: ImageProbeStatus
  readonly urlIdentity: string
}

const MAX_BODY_BYTES = 64
const DEFAULT_TIMEOUT_MS = 3_000

function contentTypeOf(response: Response): string | undefined {
  const value = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  return value || undefined
}

async function readPrefix(response: Response, limit = MAX_BODY_BYTES): Promise<Uint8Array> {
  if (!response.body)
    return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (size < limit) {
      const next = await reader.read()
      if (next.done)
        break
      const chunk = next.value instanceof Uint8Array ? next.value : new Uint8Array(next.value)
      const remaining = limit - size
      chunks.push(chunk.slice(0, remaining))
      size += Math.min(chunk.byteLength, remaining)
      if (chunk.byteLength >= remaining)
        break
    }
  }
  finally {
    await reader.cancel().catch(() => undefined)
  }
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

function looksLikeChallenge(prefix: Uint8Array): boolean {
  const normalized = new TextDecoder().decode(prefix).trim().toLowerCase()
  return normalized.startsWith('<!doctype')
    || normalized.startsWith('<html')
    || normalized.startsWith('<head')
    || normalized.includes('captcha')
    || normalized.includes('challenge')
    || normalized.includes('cloudflare')
}

function hasImageSignature(contentType: string, bytes: Uint8Array): boolean {
  if (bytes.length === 0)
    return false
  const text = new TextDecoder().decode(bytes)
  const ascii = (offset: number, length: number) => new TextDecoder().decode(bytes.slice(offset, offset + length))
  if (contentType === 'image/jpeg')
    return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
  if (contentType === 'image/png')
    return [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A].every((value, index) => bytes[index] === value)
  if (contentType === 'image/gif')
    return ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a'
  if (contentType === 'image/webp')
    return ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
  if (contentType === 'image/bmp')
    return ascii(0, 2) === 'BM'
  if (contentType === 'image/tiff') {
    return (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00)
      || (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A)
  }
  if (contentType === 'image/avif')
    return ascii(4, 4) === 'ftyp' && (text.includes('avif') || text.includes('avis'))
  return true
}

async function fetchWithTimeout(fetcher: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetcher(url, { ...init, redirect: 'manual', signal: controller.signal })
  }
  finally {
    clearTimeout(timeout)
  }
}

export async function probeChapterImage(
  rawUrl: string,
  options: { readonly fetch?: typeof fetch, readonly timeoutMs?: number } = {},
): Promise<ImageProbeResult> {
  let url: string
  try {
    url = normalizePageFetchUrl(rawUrl)
  }
  catch {
    return { reason: 'url_invalid', status: 'unavailable', urlIdentity: 'invalid' }
  }
  const urlIdentity = redactedPageUrl(url)
  const fetcher = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  try {
    const response = await fetchWithTimeout(fetcher, url, { method: 'HEAD' }, timeoutMs)
    if (response.status === 405 || response.status === 501) {
      const bodyResponse = await fetchWithTimeout(fetcher, url, {
        headers: { Range: 'bytes=0-63' },
        method: 'GET',
      }, timeoutMs)
      if (bodyResponse.status >= 300 && bodyResponse.status < 400)
        return { httpStatus: bodyResponse.status, reason: 'redirect', status: 'unavailable', urlIdentity }
      if (bodyResponse.status >= 400)
        return { httpStatus: bodyResponse.status, reason: 'http_failure', status: 'unavailable', urlIdentity }
      const contentType = contentTypeOf(bodyResponse)
      const prefix = await readPrefix(bodyResponse)
      if (looksLikeChallenge(prefix))
        return { contentType, httpStatus: bodyResponse.status, reason: 'challenge_html', status: 'unavailable', urlIdentity }
      if (!contentType)
        return { httpStatus: bodyResponse.status, reason: 'content_type_missing', status: 'unknown', urlIdentity }
      if (!contentType.startsWith('image/'))
        return { contentType, httpStatus: bodyResponse.status, reason: 'content_type_invalid', status: 'unavailable', urlIdentity }
      if (!hasImageSignature(contentType, prefix))
        return { contentType, httpStatus: bodyResponse.status, reason: 'probe_failed', status: 'unknown', urlIdentity }
      return { contentType, httpStatus: bodyResponse.status, reason: 'available', status: 'available', urlIdentity }
    }
    if (response.status >= 300 && response.status < 400)
      return { httpStatus: response.status, reason: 'redirect', status: 'unavailable', urlIdentity }
    if (response.status >= 400)
      return { httpStatus: response.status, reason: 'http_failure', status: 'unavailable', urlIdentity }

    const headContentType = contentTypeOf(response)
    if (!headContentType)
      return { httpStatus: response.status, reason: 'content_type_missing', status: 'unknown', urlIdentity }
    if (!headContentType.startsWith('image/'))
      return { contentType: headContentType, httpStatus: response.status, reason: 'content_type_invalid', status: 'unavailable', urlIdentity }

    const bodyResponse = await fetchWithTimeout(fetcher, url, {
      headers: { Range: 'bytes=0-63' },
      method: 'GET',
    }, timeoutMs)
    if (bodyResponse.status >= 300 && bodyResponse.status < 400)
      return { contentType: headContentType, httpStatus: bodyResponse.status, reason: 'redirect', status: 'unavailable', urlIdentity }
    if (bodyResponse.status >= 400)
      return { contentType: headContentType, httpStatus: bodyResponse.status, reason: 'http_failure', status: 'unavailable', urlIdentity }

    const contentType = contentTypeOf(bodyResponse) ?? headContentType
    const prefix = await readPrefix(bodyResponse)
    if (looksLikeChallenge(prefix))
      return { contentType, httpStatus: bodyResponse.status, reason: 'challenge_html', status: 'unavailable', urlIdentity }
    if (!contentType.startsWith('image/'))
      return { contentType, httpStatus: bodyResponse.status, reason: 'content_type_invalid', status: 'unavailable', urlIdentity }
    if (!hasImageSignature(contentType, prefix))
      return { contentType, httpStatus: bodyResponse.status, reason: 'probe_failed', status: 'unknown', urlIdentity }
    return { contentType, httpStatus: bodyResponse.status, reason: 'available', status: 'available', urlIdentity }
  }
  catch (error) {
    return {
      reason: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'probe_failed',
      status: 'unknown',
      urlIdentity,
    }
  }
}
