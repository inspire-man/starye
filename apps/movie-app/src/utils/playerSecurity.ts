interface PublicTorrServerSettingsResponse {
  success: boolean
  data?: {
    defaultUrl?: string | null
  }
}

export const UNTRUSTED_STREAM_URL_MESSAGE = '当前播放链接不受信任，请返回详情页重新发起 TorrServer 播放。'

export type TrustedTorrServerStreamBase = string

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

function normalizeTrustedStreamBase(candidate?: string | null): string | null {
  if (!candidate)
    return null

  try {
    const parsed = new URL(candidate)
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) {
      return null
    }

    const pathname = parsed.pathname.replace(/\/+$/u, '')
    if (pathname !== '' && pathname !== '/torrserver') {
      return null
    }

    return `${parsed.origin}${pathname}`
  }
  catch {
    return null
  }
}

export function getTrustedTorrServerStreamBases(
  ...candidates: Array<string | null | undefined>
): TrustedTorrServerStreamBase[] {
  return [...new Set(candidates.map(normalizeTrustedStreamBase).filter(Boolean))] as string[]
}

export function isTrustedTorrServerStreamUrl(streamUrl: string, trustedBases: string[]): boolean {
  try {
    const parsed = new URL(streamUrl)
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) {
      return false
    }

    const matchesTrustedBase = trustedBases.some((base) => {
      const normalizedBase = normalizeTrustedStreamBase(base)
      if (!normalizedBase) {
        return false
      }

      const trustedBaseUrl = new URL(normalizedBase)
      const basePath = trustedBaseUrl.pathname.replace(/\/+$/u, '')
      const expectedPath = `${basePath}/stream/video` || '/stream/video'
      return trustedBaseUrl.origin === parsed.origin && parsed.pathname === expectedPath
    })
    if (!matchesTrustedBase) {
      return false
    }

    return parsed.searchParams.has('link') && parsed.searchParams.has('index')
  }
  catch {
    return false
  }
}

function normalizeGatewayStreamBase(gatewayBaseUrl?: string | null): string | null {
  if (!gatewayBaseUrl)
    return null

  try {
    const parsed = new URL(gatewayBaseUrl)
    const pathname = parsed.pathname.replace(/\/+$/u, '')
    return `${parsed.origin}${pathname.endsWith('/torrserver') ? pathname : `${pathname}/torrserver`}`
  }
  catch {
    return null
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

export function resolveTrustedTorrServerStreamBases(options?: {
  gatewayBaseUrl?: string | null
  storage?: Pick<Storage, 'getItem'>
}): TrustedTorrServerStreamBase[] {
  const localStorageRef = options?.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
  const localUrl = readStoredTorrServerUrl(localStorageRef)
  return getTrustedTorrServerStreamBases(normalizeGatewayStreamBase(options?.gatewayBaseUrl), localUrl)
}
