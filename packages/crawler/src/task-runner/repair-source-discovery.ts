import type { RepairSourceCandidate, RepairSourceObservationInput } from './runner-client'
import { Window } from 'happy-dom'
import { parseJavDBMovieDetail, parseJavDBMovieImageSearch } from '../strategies/javdb-parser'

export interface RepairDiscoveryOptions {
  readonly movieCode: string
  readonly javdbUrl?: string
  readonly javbusUrl?: string
  readonly requestHtml: (url: string) => Promise<string>
  readonly observedAt?: number
}

function candidatesFromMagnets(html: string, provider: string): RepairSourceCandidate[] {
  const seen = new Set<string>()
  const result: RepairSourceCandidate[] = []
  for (const match of html.matchAll(/href=["'](magnet:\?[^"']+)["']/giu)) {
    const url = match[1].replaceAll('&amp;', '&')
    if (seen.has(url))
      continue
    seen.add(url)
    result.push({ sourceName: `${provider} magnet ${result.length + 1}`, sourceType: 'magnet', sourceUrl: url, sortOrder: result.length })
  }
  return result
}

export async function discoverRepairSources(options: RepairDiscoveryOptions): Promise<RepairSourceObservationInput> {
  console.info(`[repair-discovery] movieCode=${options.movieCode}`)
  const sources: RepairSourceCandidate[] = []
  if (options.javdbUrl) {
    let html = ''
    try {
      html = await options.requestHtml(options.javdbUrl)
    }
    catch {
      html = ''
    }
    if (html) {
      const window = new Window({ url: options.javdbUrl })
      try {
        window.document.write(html)
        const parsedSearch = parseJavDBMovieImageSearch(window.document as unknown as Document, options.javdbUrl, options.movieCode)
        const search = parsedSearch ?? (() => {
          const target = options.movieCode.replace(/\s+/gu, '').toUpperCase()
          const item = [...window.document.querySelectorAll('.movie-list .item')].find((candidate) => {
            const code = candidate.querySelector('.video-title strong')?.textContent?.replace(/\s+/gu, '').toUpperCase()
            return code === target
          })
          const href = (item?.querySelector('a.box') as HTMLAnchorElement | null)?.getAttribute('href')
          return href ? { detailUrl: new URL(href, options.javdbUrl).toString() } : null
        })()
        let detailHtml = html
        if (search?.detailUrl) {
          try {
            detailHtml = await options.requestHtml(search.detailUrl)
          }
          catch {
            detailHtml = ''
          }
        }
        if (detailHtml !== html) {
          window.document.open()
          window.document.write(detailHtml)
        }
        const movie = parseJavDBMovieDetail(window.document as unknown as Document, search?.detailUrl ?? options.javdbUrl)
        const matchesTarget = movie?.code.replace(/\s+/gu, '').toUpperCase() === options.movieCode.replace(/\s+/gu, '').toUpperCase()
        for (const [index, player] of (matchesTarget ? movie?.players ?? [] : []).entries())
          sources.push({ sourceName: player.sourceName || `JavDB magnet ${index + 1}`, sourceType: 'magnet', sourceUrl: player.sourceUrl, sortOrder: sources.length })
      }
      catch {
        console.info('[repair-discovery] JavDB parsing failed')
      }
      finally { window.close() }
    }
  }
  if (options.javbusUrl) {
    let html = ''
    try {
      html = await options.requestHtml(options.javbusUrl)
    }
    catch {
      html = ''
    }
    sources.push(...candidatesFromMagnets(html, 'JavBus').map((source, i) => ({ ...source, sortOrder: sources.length + i })))
  }
  console.info(`[repair-discovery] movieCode=${options.movieCode} candidates=${sources.length}`)
  return { observedAt: options.observedAt ?? Math.floor(Date.now() / 1000), sources }
}
