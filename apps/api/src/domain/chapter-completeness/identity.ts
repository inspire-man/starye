import type { NormalizedSourceChapterRow, SourceChapterRowInput, StoredChapterIdentity } from './types'

const MAX_IDENTITY_LENGTH = 512

function clean(value: string | null | undefined): string {
  return value?.trim().replace(/^\/+|\/+$/gu, '') ?? ''
}

export function normalizeChapterSlug(value: string | null | undefined): string | undefined {
  const slug = clean(value)
  if (!slug || slug.length > 256)
    return undefined
  return slug.toLocaleLowerCase()
}

export function normalizeChapterUrl(value: string | null | undefined): string | undefined {
  if (!value)
    return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return undefined
    url.hash = ''
    url.search = ''
    url.hostname = url.hostname.toLocaleLowerCase()
    url.pathname = url.pathname.replace(/\/{2,}/gu, '/').replace(/\/$/u, '') || '/'
    const normalized = url.toString()
    return normalized.length <= MAX_IDENTITY_LENGTH ? normalized : undefined
  }
  catch {
    return undefined
  }
}

export function normalizeChapterIdentity(input: { readonly slug?: string | null, readonly sourceUrl?: string | null }): string {
  const slug = normalizeChapterSlug(input.slug)
  if (slug)
    return `slug:${slug}`
  const url = normalizeChapterUrl(input.sourceUrl)
  if (url)
    return `url:${url}`
  throw new Error('chapter_identity_missing')
}

export function normalizeSourceChapterRow(input: SourceChapterRowInput): NormalizedSourceChapterRow {
  if (!Number.isSafeInteger(input.sourceOrdinal) || input.sourceOrdinal < 0 || input.sourceOrdinal >= 5_000)
    throw new Error('chapter_source_ordinal_invalid')
  const title = input.title.trim()
  if (!title || title.length > 512)
    throw new Error('chapter_source_title_invalid')
  const chapterNumber = input.chapterNumber === null || input.chapterNumber === undefined
    ? null
    : Number.isSafeInteger(input.chapterNumber) && input.chapterNumber >= 0 && input.chapterNumber <= 1_000_000
      ? input.chapterNumber
      : (() => { throw new Error('chapter_source_number_invalid') })()
  return {
    chapterNumber,
    identity: normalizeChapterIdentity(input),
    sourceOrdinal: input.sourceOrdinal,
    sourceUrl: normalizeChapterUrl(input.sourceUrl) ?? null,
    slug: normalizeChapterSlug(input.slug) ?? null,
    title,
  }
}

export function storedChapterIdentity(chapter: StoredChapterIdentity): string {
  return normalizeChapterIdentity({ slug: chapter.slug, sourceUrl: undefined })
}

export function redactChapterUrl(value: string | null | undefined): string | undefined {
  const url = normalizeChapterUrl(value)
  if (!url)
    return undefined
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  }
  catch {
    return undefined
  }
}
