import type { MovieInfo } from '../lib/strategy'

export interface JavDBMovieListItem {
  code: string
  url: string
}

export interface JavDBMovieListResult {
  items: JavDBMovieListItem[]
  next?: string
}

export interface JavDBMovieImageSearchResult {
  code: string
  detailUrl: string
  cover: string
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

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function isMovieCode(value: string): boolean {
  return /^[a-z\d][\w-]{1,39}$/iu.test(value)
}

function normalizeMovieCode(value: string): string {
  return value.replace(/[^a-z\d]/giu, '').toLocaleLowerCase()
}

function matchesMovieCode(candidateCode: string, targetCode: string): boolean {
  if (candidateCode === targetCode)
    return true

  // JavDB omits the 300 prefix for some 300MIUM catalogue entries.
  return targetCode.startsWith('300') && targetCode.slice(3) === candidateCode
}

function panelForLabel(document: Document, label: string): Element | undefined {
  return [...document.querySelectorAll('.panel-block')]
    .find(block => block.querySelector('strong')?.textContent?.includes(label))
}

function panelValue(panel: Element | undefined): string | undefined {
  return panel?.querySelector('.value')?.textContent?.replace(/\s+/gu, ' ').trim() || undefined
}

function panelLinks(panel: Element | undefined, baseUrl: string): Array<{ name: string, url: string }> {
  return [...(panel?.querySelectorAll('.value a') ?? [])]
    .map((element) => {
      const anchor = element as HTMLAnchorElement
      const name = anchor.textContent?.replace(/\s+/gu, ' ').trim() || ''
      const url = normalizeHttpUrl(anchor.getAttribute('href'), baseUrl)
      return name && url ? { name, url } : null
    })
    .filter((value): value is { name: string, url: string } => Boolean(value))
}

function imageUrlFromElement(element: Element, baseUrl: string): string | null {
  const anchor = element as HTMLAnchorElement
  const image = element.querySelector('img') as HTMLImageElement | null
  return normalizeHttpUrl(
    anchor.getAttribute('href')
    || image?.getAttribute('data-src')
    || image?.getAttribute('data-original')
    || image?.currentSrc
    || image?.getAttribute('src'),
    baseUrl,
  )
}

export function isJavDBChallengePage(document: Document): boolean {
  const title = document.title.trim().toLowerCase()
  const bodyText = document.body?.textContent?.toLowerCase() ?? ''
  return title.includes('just a moment')
    || title.includes('attention required')
    || bodyText.includes('verify you are human')
    || bodyText.includes('performing security verification')
}

export function parseJavDBMovieList(document: Document, pageUrl: string): JavDBMovieListResult {
  const items: JavDBMovieListItem[] = []

  for (const element of [...document.querySelectorAll('.movie-list .item a.box')]) {
    const anchor = element as HTMLAnchorElement
    const url = normalizeHttpUrl(anchor.getAttribute('href'), pageUrl)
    const code = anchor.querySelector('.video-title strong')?.textContent?.replace(/\s+/gu, '').trim() || ''
    if (url && isMovieCode(code))
      items.push({ code: code.toUpperCase(), url })
  }

  const next = normalizeHttpUrl(
    (document.querySelector('a.pagination-next[rel="next"]') as HTMLAnchorElement | null)?.getAttribute('href')
    || (document.querySelector('a.pagination-next') as HTMLAnchorElement | null)?.getAttribute('href'),
    pageUrl,
  ) ?? undefined

  return {
    items: items.filter((item, index, all) => all.findIndex(candidate => candidate.code === item.code) === index),
    next,
  }
}

export function parseJavDBMovieImageSearch(
  document: Document,
  pageUrl: string,
  movieCode: string,
): JavDBMovieImageSearchResult | null {
  const targetCode = normalizeMovieCode(movieCode)
  if (!targetCode)
    return null

  const item = [...document.querySelectorAll('.movie-list .item')]
    .find((candidate) => {
      const code = candidate.querySelector('.video-title strong')?.textContent || ''
      return matchesMovieCode(normalizeMovieCode(code), targetCode)
    })
  const anchor = item?.querySelector('a.box') as HTMLAnchorElement | null
  const image = item?.querySelector('.cover img') as HTMLImageElement | null
  const code = item?.querySelector('.video-title strong')?.textContent?.replace(/\s+/gu, '').trim().toUpperCase() || ''
  const detailUrl = normalizeHttpUrl(anchor?.getAttribute('href'), pageUrl)
  const cover = normalizeHttpUrl(
    image?.getAttribute('data-src')
    || image?.getAttribute('data-original')
    || image?.currentSrc
    || image?.getAttribute('src'),
    pageUrl,
  )

  if (!code || !detailUrl || !cover)
    return null

  return { code, detailUrl, cover }
}

export function parseJavDBMovieDetail(document: Document, pageUrl: string): MovieInfo | null {
  if (isJavDBChallengePage(document))
    throw new Error('javdb_challenge_page')

  const sourceUrl = normalizeHttpUrl(pageUrl, pageUrl)
  const code = document.querySelector('h2.title strong')?.textContent?.replace(/\s+/gu, '').trim().toUpperCase() || ''
  const title = document.querySelector('h2.title .current-title')?.textContent?.replace(/\s+/gu, ' ').trim() || ''
  const coverImage = imageUrlFromElement(document.querySelector('.column-video-cover a') || document.querySelector('.column-video-cover img') as Element, pageUrl)

  if (!sourceUrl || !isMovieCode(code) || !title || !coverImage)
    return null

  const previewImages = unique(
    [...document.querySelectorAll('.tile-images.preview-images a.tile-item')]
      .map(element => imageUrlFromElement(element, pageUrl)),
  ).slice(0, 12)

  const dateText = panelValue(panelForLabel(document, '日期'))
  const releaseDateValue = dateText ? new Date(dateText).getTime() / 1000 : Number.NaN
  const durationText = panelValue(panelForLabel(document, '時長')) || ''
  const durationValue = Number.parseInt(durationText.replace(/\D/gu, ''), 10)

  const publisherPanel = panelForLabel(document, '片商')
  const seriesPanel = panelForLabel(document, '系列')
  const publisherLinks = panelLinks(publisherPanel, pageUrl)
  const seriesLinks = panelLinks(seriesPanel, pageUrl)
  const actorLinks = panelLinks(panelForLabel(document, '演員'), pageUrl)
  const genreNames = panelLinks(panelForLabel(document, '類別'), pageUrl).map(actor => actor.name)

  const players = [...document.querySelectorAll('#magnets-content .item')]
    .map((element, index) => {
      const magnet = (element.querySelector('a[href^="magnet:"]') as HTMLAnchorElement | null)?.getAttribute('href') || ''
      const name = element.querySelector('.name')?.textContent?.replace(/\s+/gu, ' ').trim() || '磁力链接'
      const quality = element.querySelector('.meta')?.textContent?.replace(/\s+/gu, ' ').trim() || undefined
      return magnet
        ? { sourceName: `磁力 - ${name}`.slice(0, 100), sourceUrl: magnet, quality, sortOrder: index }
        : null
    })
    .filter((value): value is { sourceName: string, sourceUrl: string, quality: string | undefined, sortOrder: number } => Boolean(value))

  return {
    title,
    slug: code.toLowerCase(),
    code,
    description: '',
    coverImage,
    previewImages,
    ...(Number.isFinite(releaseDateValue) ? { releaseDate: releaseDateValue } : {}),
    ...(Number.isFinite(durationValue) && durationValue > 0 ? { duration: durationValue } : {}),
    sourceUrl,
    actors: actorLinks.map(actor => actor.name),
    actorDetails: actorLinks,
    genres: genreNames,
    series: seriesLinks[0]?.name || panelValue(seriesPanel),
    publisher: publisherLinks[0]?.name || panelValue(publisherPanel),
    publisherUrl: publisherLinks[0]?.url,
    isR18: true,
    players,
  }
}
