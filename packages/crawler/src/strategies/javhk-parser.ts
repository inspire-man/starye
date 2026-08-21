export interface JavHkActorSearchResult {
  name: string
  sourceId: string
  sourceUrl: string
  avatar: string
}

export interface JavHkMovieSearchResult {
  code: string
  contentId: string
  cover: string
  preview: string
}

function normalizeHttpUrl(rawUrl: string | null | undefined, baseUrl: string): string | null {
  const value = rawUrl?.trim()
  if (!value)
    return null

  try {
    const url = new URL(value, baseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return null
    return url.toString()
  }
  catch {
    return null
  }
}

function normalizeActorName(value: string): string {
  return value.replace(/\s+/gu, '').trim().toLocaleLowerCase()
}

function normalizeMovieCode(value: string): string {
  return value.replace(/[^a-z\d]/giu, '').toLocaleLowerCase()
}

function derivePreviewUrl(coverUrl: string): string | null {
  try {
    const url = new URL(coverUrl)
    const filename = url.pathname.split('/').pop() || ''
    const previewFilename = filename.replace(/pl(?=\.jpe?g$)/iu, 'ps')
    if (!previewFilename || previewFilename === filename)
      return null

    const pathSegments = url.pathname.split('/')
    pathSegments[pathSegments.length - 1] = previewFilename
    url.pathname = pathSegments.join('/')
    return url.toString()
  }
  catch {
    return null
  }
}

export function parseJavHkMovieSearch(
  payload: unknown,
  movieCode: string,
  baseUrl: string,
): JavHkMovieSearchResult | null {
  const targetCode = normalizeMovieCode(movieCode)
  if (!targetCode || !payload || typeof payload !== 'object')
    return null

  const hits = (payload as { hits?: unknown }).hits
  if (!Array.isArray(hits))
    return null

  const hit = hits.find((candidate) => {
    if (!candidate || typeof candidate !== 'object')
      return false
    const dvdId = (candidate as { dvd_id?: unknown }).dvd_id
    return typeof dvdId === 'string' && normalizeMovieCode(dvdId) === targetCode
  }) as {
    dvd_id?: unknown
    content_id?: unknown
    cover_url?: unknown
    cover_full_url?: unknown
  } | undefined

  if (!hit)
    return null

  const cover = normalizeHttpUrl(
    typeof hit.cover_url === 'string' ? hit.cover_url : hit.cover_full_url as string | undefined,
    baseUrl,
  )
  const preview = cover ? derivePreviewUrl(cover) : null
  const contentId = typeof hit.content_id === 'string' ? hit.content_id.trim() : ''
  const code = typeof hit.dvd_id === 'string' ? hit.dvd_id.trim().toUpperCase() : ''

  if (!cover || !preview || !contentId || !code)
    return null

  return { code, contentId, cover, preview }
}

export function parseJavHkActorSearch(
  document: Document,
  pageUrl: string,
  actorName: string,
): JavHkActorSearchResult | null {
  const targetName = normalizeActorName(actorName)
  if (!targetName)
    return null

  const card = [...document.querySelectorAll('a.actress-card')]
    .find((candidate) => {
      const names = [
        candidate.querySelector('.actress-card__name')?.textContent || '',
        candidate.querySelector('.actress-card__name-kanji')?.textContent || '',
        candidate.querySelector('img.actress-card__image')?.getAttribute('alt') || '',
      ]
      return names.some(name => normalizeActorName(name) === targetName)
    })

  if (!card)
    return null

  const image = card.querySelector('img.actress-card__image')
  const sourceUrl = normalizeHttpUrl(card.getAttribute('href'), pageUrl)
  const avatar = normalizeHttpUrl(
    image?.getAttribute('data-src') || image?.getAttribute('src'),
    pageUrl,
  )
  const name = (
    card.querySelector('.actress-card__name-kanji')?.textContent
    || card.querySelector('.actress-card__name')?.textContent
    || actorName
  ).replace(/\s+/gu, ' ').trim()
  const sourceId = sourceUrl?.match(/\/actresses\/([^/?#]+)/u)?.[1] || ''

  if (!sourceUrl || !avatar || !name || !sourceId)
    return null

  return { name, sourceId, sourceUrl, avatar }
}
