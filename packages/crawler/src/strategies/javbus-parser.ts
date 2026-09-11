import type { MovieInfo } from '../lib/strategy'

export interface JavBusPublisherIdentity {
  name: string
  sourceId: string
  sourceUrl: string
  kind?: 'label' | 'studio' | 'unknown'
  logo?: string
}

export interface JavBusActorIdentity {
  name: string
  sourceId: string
  sourceUrl: string
  avatar?: string
}

function textOf(el: Element | null | undefined): string {
  return el?.textContent?.replace(/\s+/gu, ' ').trim() || ''
}

function resolveUrl(raw: string | null | undefined, pageUrl: string): string {
  const value = raw?.trim()
  if (!value)
    return ''
  try {
    return new URL(value, pageUrl).href
  }
  catch {
    return ''
  }
}

function sourceIdFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/u, '')
    return path.split('/').pop() || ''
  }
  catch {
    return url.split('/').filter(Boolean).pop() || ''
  }
}

export function isJavBusMovieDetailUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/+$/u, '')
    return /^\/[A-Z0-9]{2,12}-\d{2,6}$/iu.test(path)
  }
  catch {
    return false
  }
}

function paragraphForHeader(root: Element, header: string): Element | undefined {
  return [...root.querySelectorAll('p')].find(el => el.textContent?.includes(header))
}

function headerValue(root: Element, header: string): string {
  const paragraph = paragraphForHeader(root, header)
  if (!paragraph)
    return ''
  const headerText = textOf(paragraph.querySelector('.header'))
  const full = textOf(paragraph)
  if (headerText && full.startsWith(headerText))
    return full.slice(headerText.length).replace(/^[:：]\s*/u, '').trim()
  const splitIndex = full.indexOf(':')
  return splitIndex > -1 ? full.slice(splitIndex + 1).trim() : ''
}

function headerLink(root: Element, header: string, pageUrl: string): { name: string, url: string } | null {
  const paragraph = paragraphForHeader(root, header)
  const anchor = paragraph?.querySelector('a') as HTMLAnchorElement | null
  if (!anchor)
    return null
  const name = textOf(anchor)
  const url = resolveUrl(anchor.getAttribute('href') || anchor.href, pageUrl)
  return name && url ? { name, url } : null
}

export function parseJavBusMovieDetail(document: Document, pageUrl: string): MovieInfo {
  const title = textOf(document.querySelector('h3'))
  const infoRoot = document.querySelector('.info') || document.body
  const studio = headerLink(infoRoot, '製作商:', pageUrl)
  const label = headerLink(infoRoot, '發行商:', pageUrl)
  const seriesField = headerValue(infoRoot, '系列:')
  const code = headerValue(infoRoot, '識別碼:') || title.split(' ')[0] || ''
  const dateText = headerValue(infoRoot, '發行日期:')
  const durationText = headerValue(infoRoot, '長度:')
  const bigImage = document.querySelector('.bigImage img') as HTMLImageElement | null
  const bigImageLink = document.querySelector('.bigImage') as HTMLAnchorElement | null
  const coverImage = resolveUrl(
    bigImage?.getAttribute('data-src')
    || bigImage?.getAttribute('data-original')
    || bigImage?.getAttribute('src')
    || bigImageLink?.getAttribute('href')
    || '',
    pageUrl,
  )
  const previewImages = [...document.querySelectorAll('.sample-box')]
    .map((element) => {
      const anchor = element as HTMLAnchorElement
      const image = element.querySelector('img') as HTMLImageElement | null
      return resolveUrl(
        anchor.getAttribute('href')
        || image?.getAttribute('data-src')
        || image?.getAttribute('data-original')
        || image?.getAttribute('src')
        || '',
        pageUrl,
      )
    })
    .filter(Boolean)
    .filter((imageUrl, index, images) => images.indexOf(imageUrl) === index)
    .slice(0, 12)

  const actorDetails = [...document.querySelectorAll('.star-name a')]
    .map((element) => {
      const anchor = element as HTMLAnchorElement
      const name = textOf(anchor)
      const url = resolveUrl(anchor.getAttribute('href') || anchor.href, pageUrl)
      return name && url ? { name, url } : null
    })
    .filter((value): value is { name: string, url: string } => Boolean(value))

  const genres = [...document.querySelectorAll('.genre label a')]
    .map(element => textOf(element))
    .filter(Boolean)

  return {
    title,
    slug: sourceIdFromUrl(pageUrl) || code,
    code,
    description: '',
    coverImage,
    previewImages,
    releaseDate: dateText ? new Date(dateText).getTime() / 1000 : 0,
    duration: Number.parseInt(durationText) || 0,
    sourceUrl: pageUrl,
    actors: actorDetails.map(actor => actor.name),
    actorDetails,
    genres,
    series: label?.name || seriesField || undefined,
    publisher: studio?.name || label?.name || undefined,
    publisherUrl: studio?.url || label?.url || undefined,
    seriesUrl: label?.url || undefined,
    studioUrl: studio?.url || undefined,
    isR18: true,
    players: [],
  }
}

export function parseJavBusActorDetails(document: Document, pageUrl: string): JavBusActorIdentity | null {
  const avatarBox = document.querySelector('.avatar-box')
  const name = textOf(avatarBox?.querySelector('.photo-info span, span.pb10'))
    || document.title.split(' - ')[0]?.trim()
    || ''
  const avatar = resolveUrl(
    avatarBox?.querySelector('img')?.getAttribute('src') || '',
    pageUrl,
  )
  const sourceId = sourceIdFromUrl(pageUrl)
  if (!name || !sourceId)
    return null
  return {
    name,
    sourceId,
    sourceUrl: pageUrl,
    avatar: avatar || undefined,
  }
}

export function parseJavBusPublisherDetails(document: Document, pageUrl: string): JavBusPublisherIdentity | null {
  const titleParts = document.title.split(' - ').map(part => part.trim()).filter(Boolean)
  const name = titleParts[0] || textOf(document.querySelector('h3, .alert-common'))
  const kindText = titleParts[1] || ''
  const kind = kindText.includes('發行') ? 'label' : kindText.includes('製作') ? 'studio' : 'unknown'
  const logo = resolveUrl(
    document.querySelector('.logo img')?.getAttribute('src') || '',
    pageUrl,
  )
  const sourceId = sourceIdFromUrl(pageUrl)
  if (!name || !sourceId)
    return null
  return {
    name,
    sourceId,
    sourceUrl: pageUrl,
    kind,
    logo: logo || undefined,
  }
}

export function resolveJavBusSeedMovieUrls(config: { startUrl?: string, seedMovieUrls?: readonly string[] }): string[] {
  const urls = [...(config.seedMovieUrls ?? [])]
  if (config.startUrl && isJavBusMovieDetailUrl(config.startUrl))
    urls.push(config.startUrl)
  return [...new Set(urls)]
}

export function collectJavBusPublisherRecords(movieInfo: Pick<MovieInfo, 'publisher' | 'publisherUrl' | 'series' | 'seriesUrl' | 'studioUrl'>): Array<{ name: string, sourceUrl: string, sourceId: string }> {
  const records = new Map<string, { name: string, sourceUrl: string, sourceId: string }>()
  const add = (name?: string, url?: string) => {
    const trimmed = name?.trim()
    if (!trimmed || !url)
      return
    records.set(trimmed, {
      name: trimmed,
      sourceUrl: url,
      sourceId: sourceIdFromUrl(url) || trimmed,
    })
  }
  add(movieInfo.publisher ?? undefined, movieInfo.studioUrl || movieInfo.publisherUrl || undefined)
  add(movieInfo.series ?? undefined, movieInfo.seriesUrl || undefined)
  return [...records.values()]
}

export interface JavBusMagnetLink {
  sourceName: string
  sourceUrl: string
  quality: string | null
  sortOrder: number
}

function decodeMagnetHref(raw: string): string {
  return raw
    .replace(/&amp;/gi, '&')
    .replace(/&#38;/g, '&')
    .replace(/&quot;/gi, '"')
    .trim()
}

function magnetHash(url: string): string {
  return url.match(/urn:btih:([a-zA-Z0-9]+)/i)?.[1]?.toLowerCase() || url
}

export function parseJavBusMagnetAnchors(anchors: ReadonlyArray<{ href?: string | null, name?: string | null }>): JavBusMagnetLink[] {
  return parseJavBusMagnetLinks(
    anchors
      .map((anchor) => {
        const href = keepCompleteMagnetUrl(anchor.href)
        if (!href.startsWith('magnet:'))
          return ''
        const name = (anchor.name || '').replace(/[<>]/gu, '')
        return `<a href="${href.replace(/"/gu, '&quot;')}">${name}</a>`
      })
      .filter(Boolean)
      .join('\n'),
  )
}

export function parseJavBusMagnetLinks(html: string): JavBusMagnetLink[] {
  const decoded = decodeMagnetHref(html)
  const selected = new Map<string, JavBusMagnetLink>()
  const magnetRe = /href\s*=\s*["'](magnet:[^"']+)["'][^>]*>([^<]*)/gi
  let match: RegExpExecArray | null
  let sortIdx = 0
  while ((match = magnetRe.exec(decoded))) {
    const sourceUrl = decodeMagnetHref(match[1] || '')
    if (!sourceUrl.startsWith('magnet:'))
      continue
    const key = magnetHash(sourceUrl)
    const sourceName = (match[2] || '').replace(/\s+/gu, ' ').trim() || `磁力 ${sortIdx + 1}`
    const current = selected.get(key)
    if (!current || sourceUrl.length > current.sourceUrl.length) {
      selected.set(key, {
        sourceName: sourceName.slice(0, 100),
        sourceUrl: enrichMagnetTrackers(sourceUrl),
        quality: null,
        sortOrder: current?.sortOrder ?? sortIdx++,
      })
    }
  }
  return [...selected.values()].sort((left, right) => left.sortOrder - right.sortOrder)
}

export function keepCompleteMagnetUrl(raw: string | null | undefined): string {
  return decodeMagnetHref(raw || '')
}

const DEFAULT_MAGNET_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'http://tracker.gbitt.info/announce',
]

export function enrichMagnetTrackers(magnet: string): string {
  const sourceUrl = keepCompleteMagnetUrl(magnet)
  if (!sourceUrl.startsWith('magnet:') || /(?:^|[?&])tr=/i.test(sourceUrl))
    return sourceUrl
  return sourceUrl + DEFAULT_MAGNET_TRACKERS.map(tracker => `&tr=${encodeURIComponent(tracker)}`).join('')
}

