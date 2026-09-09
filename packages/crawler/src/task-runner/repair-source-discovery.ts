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
  const sources: RepairSourceCandidate[] = []
  if (options.javdbUrl) {
    const html = await options.requestHtml(options.javdbUrl)
    if (html) {
      const window = new Window({ url: options.javdbUrl })
      try {
        window.document.write(html)
        const search = parseJavDBMovieImageSearch(window.document as unknown as Document, options.javdbUrl, options.movieCode)
        const detailHtml = search?.detailUrl ? await options.requestHtml(search.detailUrl) : html
        if (detailHtml !== html) {
          window.document.open()
          window.document.write(detailHtml)
        }
        const movie = parseJavDBMovieDetail(window.document as unknown as Document, search?.detailUrl ?? options.javdbUrl)
        for (const [index, player] of (movie?.players ?? []).entries())
          sources.push({ sourceName: player.sourceName || `JavDB magnet ${index + 1}`, sourceType: 'magnet', sourceUrl: player.sourceUrl, sortOrder: sources.length })
      }
      finally { window.close() }
    }
  }
  if (options.javbusUrl)
    sources.push(...candidatesFromMagnets(await options.requestHtml(options.javbusUrl), 'JavBus').map((source, i) => ({ ...source, sortOrder: sources.length + i })))
  return { observedAt: options.observedAt ?? Math.floor(Date.now() / 1000), sources }
}
