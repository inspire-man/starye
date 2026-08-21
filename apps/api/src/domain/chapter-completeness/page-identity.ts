import { normalizeChapterUrl } from './identity'

export function normalizePageUrl(value: string): string {
  const normalized = normalizeChapterUrl(value)
  if (!normalized)
    throw new Error('page_url_invalid')
  return normalized
}

export function pageIdentity(pageNumber: number, url: string): string {
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > 10_000)
    throw new Error('page_number_invalid')
  try {
    return `page:${pageNumber}:${normalizePageUrl(url)}`
  }
  catch {
    // Keep malformed source rows auditable without allowing one bad URL to
    // abort the complete chapter observation.
    return `page:${pageNumber}:invalid`
  }
}

export function redactedPageUrl(value: string): string {
  try {
    const normalized = normalizePageUrl(value)
    const url = new URL(normalized)
    return `${url.protocol}//${url.host}${url.pathname}`
  }
  catch {
    return 'invalid'
  }
}
