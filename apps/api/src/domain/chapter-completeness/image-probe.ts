import { normalizePageUrl, redactedPageUrl } from './page-identity'

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

async function readPrefix(response: Response, limit = MAX_BODY_BYTES): Promise<string> {
  if (!response.body)
    return ''
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
  return new TextDecoder().decode(output)
}

function looksLikeChallenge(prefix: string): boolean {
  const normalized = prefix.trim().toLowerCase()
  return normalized.startsWith('<!doctype')
    || normalized.startsWith('<html')
    || normalized.startsWith('<head')
    || normalized.includes('captcha')
    || normalized.includes('challenge')
    || normalized.includes('cloudflare')
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
    url = normalizePageUrl(rawUrl)
  }
  catch {
    return { reason: 'url_invalid', status: 'unavailable', urlIdentity: 'invalid' }
  }
  const urlIdentity = redactedPageUrl(url)
  const fetcher = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  try {
    let response = await fetchWithTimeout(fetcher, url, { method: 'HEAD' }, timeoutMs)
    if (response.status === 405 || response.status === 501) {
      response = await fetchWithTimeout(fetcher, url, {
        headers: { Range: 'bytes=0-63' },
        method: 'GET',
      }, timeoutMs)
    }
    if (response.status >= 300 && response.status < 400)
      return { httpStatus: response.status, reason: 'redirect', status: 'unavailable', urlIdentity }
    if (response.status >= 400)
      return { httpStatus: response.status, reason: 'http_failure', status: 'unavailable', urlIdentity }

    const contentType = contentTypeOf(response)
    const prefix = await readPrefix(response)
    if (looksLikeChallenge(prefix))
      return { contentType, httpStatus: response.status, reason: 'challenge_html', status: 'unavailable', urlIdentity }
    if (!contentType)
      return { httpStatus: response.status, reason: 'content_type_missing', status: 'unknown', urlIdentity }
    if (!contentType.startsWith('image/'))
      return { contentType, httpStatus: response.status, reason: 'content_type_invalid', status: 'unavailable', urlIdentity }
    return { contentType, httpStatus: response.status, reason: 'available', status: 'available', urlIdentity }
  }
  catch (error) {
    return {
      reason: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'probe_failed',
      status: 'unknown',
      urlIdentity,
    }
  }
}
