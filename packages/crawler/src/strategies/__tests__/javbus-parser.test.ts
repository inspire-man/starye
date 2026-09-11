import fs from 'node:fs'
import path from 'node:path'
import { Window } from 'happy-dom'
import { describe, expect, it } from 'vitest'
import { collectJavBusPublisherRecords, isJavBusMovieDetailUrl, parseJavBusActorDetails, parseJavBusMagnetAnchors, parseJavBusMagnetLinks, parseJavBusMovieDetail, parseJavBusPublisherDetails, resolveJavBusSeedMovieUrls } from '../javbus-parser'

function loadDocument(name: string, url: string) {
  const window = new Window({ url })
  window.document.write(fs.readFileSync(path.join(import.meta.dirname, '../__fixtures__', name), 'utf8'))
  return { document: window.document as unknown as Document, close: () => window.close() }
}

describe('javbus parser', () => {
  it('recognizes movie detail URLs', () => {
    expect(isJavBusMovieDetailUrl('https://www.javbus.com/SNOS-313')).toBe(true)
    expect(isJavBusMovieDetailUrl('https://www.javbus.com/SSIS-001')).toBe(true)
    expect(isJavBusMovieDetailUrl('https://www.javbus.com/label/9x')).toBe(false)
    expect(isJavBusMovieDetailUrl('https://www.javbus.com/page/2')).toBe(false)
  })

  it('parses studio and label from a movie detail fixture', () => {
    const { document, close } = loadDocument('javbus-movie-detail.html', 'https://www.javbus.com/SSIS-001')
    const movie = parseJavBusMovieDetail(document, 'https://www.javbus.com/SSIS-001')
    close()

    expect(movie.code).toBe('SSIS-001')
    expect(movie.publisher).toBe('エスワン ナンバーワンスタイル')
    expect(movie.studioUrl).toBe('https://www.javbus.com/studio/7q')
    expect(movie.series).toBe('S1 NO.1 STYLE')
    expect(movie.seriesUrl).toBe('https://www.javbus.com/label/9x')
    expect(movie.actors).toEqual(['葵つかさ', '乙白さやか'])
    expect(movie.coverImage).toContain('/pics/cover/83ie_b.jpg')
    expect(movie.previewImages?.length ?? 0).toBeGreaterThan(0)
    expect(movie.duration).toBe(150)
  })

  it('parses actress identity from a star list page', () => {
    const { document, close } = loadDocument('javbus-actresses-detail.html', 'https://www.javbus.com/star/okq')
    const actor = parseJavBusActorDetails(document, 'https://www.javbus.com/star/okq')
    close()

    expect(actor).toMatchObject({
      name: '三上悠亜',
      sourceId: 'okq',
      sourceUrl: 'https://www.javbus.com/star/okq',
    })
  })

  it('parses label identity without a logo', () => {
    const { document, close } = loadDocument('javbus-label-list.html', 'https://www.javbus.com/label/9x')
    const publisher = parseJavBusPublisherDetails(document, 'https://www.javbus.com/label/9x')
    close()

    expect(publisher).toEqual({
      name: 'S1 NO.1 STYLE',
      sourceId: '9x',
      sourceUrl: 'https://www.javbus.com/label/9x',
      kind: 'label',
    })
  })

  it('resolves seed movie URLs from startUrl and seedMovieUrls', () => {
    expect(resolveJavBusSeedMovieUrls({
      startUrl: 'https://www.javbus.com/SNOS-313',
      seedMovieUrls: ['https://www.javbus.com/SSIS-001'],
    })).toEqual([
      'https://www.javbus.com/SSIS-001',
      'https://www.javbus.com/SNOS-313',
    ])
    expect(resolveJavBusSeedMovieUrls({ startUrl: 'https://www.javbus.com/' })).toEqual([])
  })

  it('collects both studio and label publisher records', () => {
    expect(collectJavBusPublisherRecords({
      publisher: 'エスワン ナンバーワンスタイル',
      studioUrl: 'https://www.javbus.com/studio/7q',
      series: 'S1 NO.1 STYLE',
      seriesUrl: 'https://www.javbus.com/label/9x',
    })).toEqual([
      { name: 'エスワン ナンバーワンスタイル', sourceUrl: 'https://www.javbus.com/studio/7q', sourceId: '7q' },
      { name: 'S1 NO.1 STYLE', sourceUrl: 'https://www.javbus.com/label/9x', sourceId: '9x' },
    ])
  })

  it('keeps full magnet URLs including trackers', () => {
    const html = `
      <tr>
        <td><a href="magnet:?xt=urn:btih:ABCDEF1234567890ABCDEF1234567890ABCDEF12&amp;dn=SNOS-313&amp;tr=http://tracker.example/announce">SNOS-313-C</a></td>
      </tr>
      <tr>
        <td><a href="magnet:?xt=urn:btih:ABCDEF1234567890ABCDEF1234567890ABCDEF12">SNOS-313-short</a></td>
      </tr>
    `
    const magnets = parseJavBusMagnetLinks(html)
    expect(magnets).toHaveLength(1)
    expect(magnets[0].sourceUrl).toContain('dn=SNOS-313')
    expect(magnets[0].sourceUrl).toContain('tr=http://tracker.example/announce')
    expect(magnets[0].sourceName).toBe('SNOS-313-C')
    expect(magnets[0].sourceUrl).not.toContain('tracker.opentrackr.org')
  })

  it('adds public trackers when the source magnet has none', () => {
    const magnets = parseJavBusMagnetLinks('<a href="magnet:?xt=urn:btih:ABCDEF1234567890ABCDEF1234567890ABCDEF12&amp;dn=SNOS-313">SNOS-313</a>')
    expect(magnets).toHaveLength(1)
    expect(magnets[0].sourceUrl).toContain('dn=SNOS-313')
    expect(magnets[0].sourceUrl).toContain('tr=' + encodeURIComponent('udp://tracker.opentrackr.org:1337/announce'))
  })

  it('parses magnet anchors in Node instead of the page sandbox', () => {
    const magnets = parseJavBusMagnetAnchors([
      { href: 'magnet:?xt=urn:btih:ABCDEF1234567890ABCDEF1234567890ABCDEF12&dn=SNOS-313', name: 'SNOS-313 [HD]' },
      { href: 'javascript:void(0)', name: 'ignore' },
    ])
    expect(magnets).toHaveLength(1)
    expect(magnets[0].sourceName).toBe('SNOS-313 [HD]')
    expect(magnets[0].sourceUrl).toContain('dn=SNOS-313')
    expect(magnets[0].sourceUrl).toContain('tr=' + encodeURIComponent('udp://tracker.opentrackr.org:1337/announce'))
  })
})
