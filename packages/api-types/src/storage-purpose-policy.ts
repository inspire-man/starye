export const manualUploadPurposeValues = [
  'cover',
  'avatar',
  'logo',
  'blog_inline',
  'manual_asset',
  'fallback',
  'temp',
] as const

export type ManualUploadPurpose = (typeof manualUploadPurposeValues)[number]

export const manualUploadPrefixMap = {
  cover: 'covers/manual/',
  avatar: 'avatars/manual/',
  logo: 'logos/manual/',
  blog_inline: 'manual-assets/blog-inline/',
  manual_asset: 'manual-assets/uploads/',
  fallback: 'fallback/manual/',
  temp: 'tmp/manual/',
} as const satisfies Record<ManualUploadPurpose, string>

const manualUploadPurposeSet = new Set<ManualUploadPurpose>(manualUploadPurposeValues)

export function isManualUploadPurpose(value: string): value is ManualUploadPurpose {
  return manualUploadPurposeSet.has(value as ManualUploadPurpose)
}

export const crawlerImagePurposeValues = ['cover', 'avatar', 'logo'] as const

export type CrawlerImagePurpose = (typeof crawlerImagePurposeValues)[number]

export type StorageUrlKind = 'missing' | 'managed' | 'external' | 'invalid'

const crawlerManagedAssetRules = {
  cover: {
    allowedNamespaces: [/^movies\/[^/]+$/, /^comics\/[^/]+$/],
    errorMessage: 'Allowed namespaces: movies/<code>, comics/<slug>',
  },
  avatar: {
    allowedNamespaces: [/^actors\/[^/]+$/],
    errorMessage: 'Allowed namespace: actors/<id>',
  },
  logo: {
    allowedNamespaces: [/^publishers\/[^/]+$/],
    errorMessage: 'Allowed namespace: publishers/<id>',
  },
} as const satisfies Record<CrawlerImagePurpose, {
  allowedNamespaces: readonly RegExp[]
  errorMessage: string
}>

const supportedStorageProtocols = new Set(['http:', 'https:'])

function normalizeStorageNamespace(value: string): string {
  return value.trim().replace(/^\/+/, '').replace(/\/+$/, '')
}

function normalizePublicStorageBaseUrl(value?: string | null): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  try {
    return new URL(value.trim()).toString().replace(/\/+$/, '')
  }
  catch {
    return null
  }
}

export function buildManualUploadObjectKey(
  purpose: ManualUploadPurpose,
  ext: string,
  timestamp: number,
  uniqueId: string,
): string {
  return `${manualUploadPrefixMap[purpose]}${timestamp}-${uniqueId}${ext}`
}

export function resolveCrawlerManagedAssetPrefix(
  purpose: CrawlerImagePurpose,
  keyNamespace: string,
): string {
  const normalizedKeyNamespace = normalizeStorageNamespace(keyNamespace)
  const rule = crawlerManagedAssetRules[purpose]

  if (rule.allowedNamespaces.some(pattern => pattern.test(normalizedKeyNamespace))) {
    return normalizedKeyNamespace
  }

  throw new Error(`Unsupported ${purpose} namespace: ${normalizedKeyNamespace}. ${rule.errorMessage}`)
}

export function classifyStorageUrlKind(
  value: string | null | undefined,
  publicBaseUrl?: string | null,
): StorageUrlKind {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'missing'
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(value.trim())
  }
  catch {
    return 'invalid'
  }

  if (!supportedStorageProtocols.has(parsedUrl.protocol)) {
    return 'invalid'
  }

  const normalizedUrl = parsedUrl.toString().replace(/\/+$/, '')
  const normalizedPublicBaseUrl = normalizePublicStorageBaseUrl(publicBaseUrl)

  if (
    normalizedPublicBaseUrl
    && (
      normalizedUrl === normalizedPublicBaseUrl
      || normalizedUrl.startsWith(`${normalizedPublicBaseUrl}/`)
      || normalizedUrl.startsWith(`${normalizedPublicBaseUrl}?`)
      || normalizedUrl.startsWith(`${normalizedPublicBaseUrl}#`)
    )
  ) {
    return 'managed'
  }

  return 'external'
}
