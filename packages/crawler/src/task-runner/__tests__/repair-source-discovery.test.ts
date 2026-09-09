import { describe, expect, it, vi } from 'vitest'
import { discoverRepairSources } from '../repair-source-discovery'

const searchUrl = 'https://www.javbus.com/search/TEST-001'
const detailUrl = 'https://www.javbus.com/TEST-001'
const magnet = `magnet:?xt=urn:btih:${'a'.repeat(40)}`
const search = '<a class="movie-box" href="/TEST-002"><date>TEST-002</date></a><a class="movie-box" href="/TEST-001"><date>TEST-001</date></a>'
const detail = '<div class="info"><p>識別碼: TEST-001</p></div><script>var gid = 123; var uc = 0; var img = \'cover.jpg\';</script>'

describe('repair source discovery', () => {
  it('follows the exact JavBus result and fetches the detail AJAX magnets', async () => {
    const requestHtml = vi.fn(async (url: string) => {
      if (url === searchUrl)
        return search
      if (url === detailUrl)
        return detail
      const ajax = new URL(url)
      expect(ajax.pathname).toBe('/ajax/uncledatoolsbyajax.php')
      expect(ajax.searchParams.get('gid')).toBe('123')
      expect(ajax.searchParams.get('img')).toBe('cover.jpg')
      return `<tr><td><a href="${magnet}">source</a><a href="${magnet}">duplicate</a></td></tr>`
    })
    const result = await discoverRepairSources({ movieCode: 'TEST-001', javbusUrl: searchUrl, requestHtml, observedAt: 123 })
    expect(requestHtml).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({ observedAt: 123, sources: [{ sourceType: 'magnet', sourceUrl: magnet, sortOrder: 0 }] })
    expect(result.sources).toHaveLength(1)
  })

  it('rejects a detail whose identity differs from the selected search result', async () => {
    const requestHtml = vi.fn(async (url: string) => url === searchUrl ? search : detail.replace('TEST-001', 'TEST-002'))
    const result = await discoverRepairSources({ movieCode: 'TEST-001', javbusUrl: searchUrl, requestHtml })
    expect(result.sources).toEqual([])
    expect(requestHtml).toHaveBeenCalledTimes(2)
  })

  it('continues to JavBus after a JavDB transport failure', async () => {
    const requestHtml = vi.fn(async (url: string) => {
      if (url.startsWith('https://javdb.com'))
        throw new Error('network')
      return `<div class="info"><p>識別碼: TEST-001</p></div><a href="${magnet}">magnet</a>`
    })
    const result = await discoverRepairSources({ movieCode: 'TEST-001', javdbUrl: 'https://javdb.com/search?q=TEST-001', javbusUrl: detailUrl, requestHtml })
    expect(result.sources).toHaveLength(1)
  })

  it('does not follow a cross-origin detail link', async () => {
    const requestHtml = vi.fn(async () => search.replace('href="/TEST-001"', 'href="https://unrelated.example/TEST-001"'))
    const result = await discoverRepairSources({ movieCode: 'TEST-001', javbusUrl: searchUrl, requestHtml })
    expect(result.sources).toEqual([])
    expect(requestHtml).toHaveBeenCalledTimes(1)
  })
})
