interface PublicTorrServerSettingsResponse {
  success: boolean
  data?: {
    defaultUrl?: string | null
  }
}

export const UNTRUSTED_STREAM_URL_MESSAGE = '当前播放链接不受信任，请返回详情页重新发起 TorrServer 播放。'

function normalizeTrustedOrigin(candidate?: string | null): string | null {
  if (!candidate)
    return null

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.origin
  }
  catch {
    return null
  }
}

export function getTrustedTorrServerOrigins(...candidates: Array<string | null | undefined>): string[] {
  return [...new Set(candidates.map(normalizeTrustedOrigin).filter(Boolean))] as string[]
}

export function isTrustedTorrServerStreamUrl(streamUrl: string, trustedOrigins: string[]): boolean {
  try {
    const parsed = new URL(streamUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    if (!trustedOrigins.includes(parsed.origin)) {
      return false
    }

    if (parsed.pathname !== '/stream/video') {
      return false
    }

    return parsed.searchParams.has('link') && parsed.searchParams.has('index')
  }
  catch {
    return false
  }
}

export function readStoredTorrServerUrl(storage?: Pick<Storage, 'getItem'>): string | null {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem('torrserver-config')
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as { serverUrl?: unknown }
    return typeof parsed.serverUrl === 'string' ? parsed.serverUrl : null
  }
  catch {
    return null
  }
}

export async function fetchDefaultTorrServerUrl(
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl('/api/public/settings/torrserver')
    if (!response.ok) {
      return null
    }

    const result = await response.json() as PublicTorrServerSettingsResponse
    return typeof result.data?.defaultUrl === 'string' ? result.data.defaultUrl : null
  }
  catch {
    return null
  }
}

export async function resolveTrustedTorrServerOrigins(options?: {
  storage?: Pick<Storage, 'getItem'>
  fetchImpl?: typeof fetch
}): Promise<string[]> {
  const localStorageRef = options?.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
  const localUrl = readStoredTorrServerUrl(localStorageRef)
  const defaultUrl = await fetchDefaultTorrServerUrl(options?.fetchImpl ?? fetch)
  return getTrustedTorrServerOrigins(localUrl, defaultUrl)
}
