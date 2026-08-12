import type { BrowserVideoProbe } from './browser-probe'
import { classifyBrowserEvidence } from './browser-probe'

const MAX_REDIRECTS = 3
const MAX_BYTES = 64 * 1024
const ALLOWED_MEDIA_TYPES = new Set([
  'application/dash+xml',
  'application/ogg',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'audio/ogg',
  'video/mp2t',
  'video/mp4',
  'video/ogg',
  'video/webm',
  'video/x-flv',
])

export interface DirectProbeResult {
  readonly bytesRead: number
  readonly contentType: string | null
  readonly reason: 'direct_blocked' | 'direct_content_invalid' | 'direct_transport_failed' | 'browser_inconclusive' | null
  readonly redirects: number
  readonly status: 'available' | 'degraded' | 'unknown'
}

type ResolveAddress = (hostname: string) => Promise<readonly string[]>
type ProbeFetch = (url: string | URL, init?: RequestInit) => Promise<Response>

function isBlockedAddress(address: string): boolean {
  const normalized = address.toLowerCase()
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:'))
    return true
  const parts = normalized.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255))
    return false
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
}

async function validateUrl(value: string, resolve: ResolveAddress): Promise<URL> {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('direct_url_scheme_invalid')
  const addresses = await resolve(url.hostname)
  if (addresses.length === 0 || addresses.some(isBlockedAddress))
    throw new Error('direct_url_private_address')
  return url
}

function safeHeaders(input: HeadersInit | undefined, crossOrigin: boolean): Headers {
  const headers = new Headers(input)
  headers.set('range', `bytes=0-${MAX_BYTES - 1}`)
  if (crossOrigin) {
    for (const name of ['authorization', 'cookie', 'proxy-authorization', 'x-api-key'])
      headers.delete(name)
  }
  return headers
}

async function readBounded(response: Response): Promise<Uint8Array> {
  if (!response.body)
    return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done)
        break
      const remaining = MAX_BYTES - total
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value
      chunks.push(chunk)
      total += chunk.byteLength
    }
  }
  finally {
    await reader.cancel().catch(() => {})
  }
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

function mediaSignature(bytes: Uint8Array): boolean {
  const text = new TextDecoder().decode(bytes.slice(0, 32))
  return text.startsWith('#EXTM3U')
    || text.includes('<MPD')
    || text.startsWith('OggS')
    || (bytes.length >= 8 && text.slice(4, 8) === 'ftyp')
    || bytes[0] === 0x47
    || (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3)
    || (text.startsWith('FLV'))
}

export async function probeDirectVideo(input: {
  readonly browser?: BrowserVideoProbe
  readonly fetch: ProbeFetch
  readonly headers?: HeadersInit
  readonly resolve: ResolveAddress
  readonly url: string
}): Promise<DirectProbeResult> {
  let current = await validateUrl(input.url, input.resolve)
  let previousOrigin = current.origin
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    try {
      const response = await input.fetch(current, {
        headers: safeHeaders(input.headers, current.origin !== previousOrigin),
        redirect: 'manual',
        signal: AbortSignal.timeout(12_000),
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location || redirects === MAX_REDIRECTS)
          return { bytesRead: 0, contentType: null, reason: 'direct_content_invalid', redirects, status: 'degraded' }
        previousOrigin = current.origin
        current = await validateUrl(new URL(location, current).toString(), input.resolve)
        continue
      }
      const bytes = await readBounded(response)
      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? null
      const validRange = response.status !== 206 || /^bytes 0-\d+\/\d+$/u.test(response.headers.get('content-range') ?? '')
      const credibleMedia = (contentType !== null && ALLOWED_MEDIA_TYPES.has(contentType)) || mediaSignature(bytes)
      if ((response.status === 200 || response.status === 206) && validRange && credibleMedia)
        return { bytesRead: bytes.length, contentType, reason: null, redirects, status: 'available' }
      if (response.status === 416)
        return { bytesRead: bytes.length, contentType, reason: 'direct_content_invalid', redirects, status: 'degraded' }
      if (input.browser) {
        const browser = classifyBrowserEvidence(await input.browser(current.toString()))
        return { bytesRead: bytes.length, contentType, reason: browser.reason, redirects, status: browser.status }
      }
      return { bytesRead: bytes.length, contentType, reason: 'browser_inconclusive', redirects, status: 'unknown' }
    }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('direct_url_'))
        throw error
      return { bytesRead: 0, contentType: null, reason: 'direct_transport_failed', redirects, status: 'unknown' }
    }
  }
  return { bytesRead: 0, contentType: null, reason: 'direct_content_invalid', redirects: MAX_REDIRECTS, status: 'degraded' }
}
