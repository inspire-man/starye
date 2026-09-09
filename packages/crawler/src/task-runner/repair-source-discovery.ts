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

async function discoverJavBusSources(options: RepairDiscoveryOptions): Promise<RepairSourceCandidate[]> {
  const startUrl = options.javbusUrl!
  const window = new Window({ url: startUrl, settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } })
  const targetCode = options.movieCode.trim().toUpperCase()
  try {
    let html = await options.requestHtml(startUrl)
    window.document.write(html)
    const match = [...window.document.querySelectorAll('a.movie-box')].find(item =>
      [...item.querySelectorAll('date')].some(date => date.textContent?.trim().toUpperCase() === targetCode))
    if (match) {
      const detail = new URL(match.getAttribute('href') || '', startUrl)
      if (detail.origin !== new URL(startUrl).origin)
        throw new Error('repair_source_origin_mismatch')
      html = await options.requestHtml(detail.href)
      window.document.open()
      window.document.write(html)
    }
    const code = [...window.document.querySelectorAll('.info p')]
      .map(item => item.textContent ?? '')
      .find(text => /識別碼|识别码/u.test(text))
      ?.split(/[:：]/u)
      .slice(1)
      .join(':')
      .trim()
      .toUpperCase()
    if (code !== targetCode)
      return []
    const scripts = [...window.document.querySelectorAll('script')].map(item => item.textContent || '').join('\n')
    const gid = scripts.match(/var\s+gid\s*=\s*(\d+)/u)?.[1]
    if (gid) {
      const ajax = new URL('/ajax/uncledatoolsbyajax.php', startUrl)
      ajax.search = new URLSearchParams({
        gid,
        lang: 'zh',
        uc: scripts.match(/var\s+uc\s*=\s*(\d+)/u)?.[1] ?? '0',
        img: scripts.match(/var\s+img\s*=\s*['"]([^'"]*)/u)?.[1] ?? '',
      }).toString()
      html = await options.requestHtml(ajax.href)
    }
    return candidatesFromMagnets(html, 'JavBus')
  }
  finally {
    window.close()
  }
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
  console.warn(`[repair-discovery] start code=${options.movieCode}`)
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
        if (!matchesTarget && detailHtml.includes(options.movieCode)) {
          for (const candidate of candidatesFromMagnets(detailHtml, 'JavDB'))
            sources.push({ ...candidate, sortOrder: sources.length })
        }
      }
      catch {
      }
      finally { window.close() }
    }
  }
  if (options.javbusUrl) {
    try {
      const candidates = await discoverJavBusSources(options)
      sources.push(...candidates.map((source, i) => ({ ...source, sortOrder: sources.length + i })))
    }
    catch {
      console.warn('[repair-discovery] JavBus discovery failed')
    }
  }
  console.warn(`[repair-discovery] complete code=${options.movieCode} candidates=${sources.length}`)
  return { observedAt: options.observedAt ?? Math.floor(Date.now() / 1000), sources }
}
