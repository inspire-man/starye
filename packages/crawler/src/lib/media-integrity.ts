export const MEDIA_FAILURE_REASON_CODES = [
  'source_unavailable',
  'http_probe_failed',
  'non_image',
  'image_decode_failed',
  'upload_failed',
] as const

export type MediaFailureReasonCode = typeof MEDIA_FAILURE_REASON_CODES[number]
export type CrawlerImageFailureCode = MediaFailureReasonCode

const REASON_SET = new Set<string>(MEDIA_FAILURE_REASON_CODES)

export function sanitizeMediaFailureReasons(value: unknown): MediaFailureReasonCode[] | undefined {
  if (!Array.isArray(value))
    return undefined
  const reasons = [...new Set(value.filter((item): item is MediaFailureReasonCode => typeof item === 'string' && REASON_SET.has(item)))].slice(0, 32)
  return reasons.length > 0 ? reasons : undefined
}

export function retainManagedMediaUrl(
  sourceUrl: string | null | undefined,
  processedUrl: string | null | undefined,
  isManaged: (url: string) => boolean,
): string | null {
  if (processedUrl)
    return processedUrl
  if (sourceUrl && isManaged(sourceUrl))
    return sourceUrl
  return null
}

export function retainManagedMediaList(
  sourceUrls: readonly string[],
  processedUrls: readonly (string | null)[],
  isManaged: (url: string) => boolean,
): string[] {
  return sourceUrls
    .map((source, index) => retainManagedMediaUrl(source, processedUrls[index] ?? null, isManaged))
    .filter((url): url is string => Boolean(url))
}

export function classifyFetchedImage(input: {
  readonly statusCode?: number
  readonly contentType?: string | null
  readonly hasBuffer: boolean
  readonly metadata?: { readonly format?: string, readonly width?: number, readonly height?: number } | null
  readonly decodeError?: boolean
}): CrawlerImageFailureCode | 'ok' {
  if (!input.hasBuffer)
    return input.statusCode && input.statusCode >= 400 ? 'http_probe_failed' : 'source_unavailable'

  const contentType = input.contentType?.toLowerCase() ?? ''
  if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream') && !contentType.includes('binary'))
    return 'non_image'
  if (input.decodeError)
    return 'image_decode_failed'
  if (!input.metadata?.format || !input.metadata.width || !input.metadata.height)
    return 'non_image'
  return 'ok'
}
