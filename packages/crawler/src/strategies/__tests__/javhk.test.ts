import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { gotScraping } from 'got-scraping'
import { Window } from 'happy-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildJavHkMovieImageUrls, JavHkStrategy, probeJavHkImage } from '../javhk'
import { parseJavHkActorSearch, parseJavHkMovieSearch } from '../javhk-parser'

vi.mock('got-scraping', () => ({ gotScraping: vi.fn() }))

const fixturePath = path.join(import.meta.dirname, '../__fixtures__/javhk-actresses-search.html')

describe('jav.hk strategy', () => {
  beforeEach(() => {
    vi.mocked(gotScraping).mockReset()
  })

  it('builds stable image URLs from a movie code', () => {
    expect(buildJavHkMovieImageUrls('MUDR-392')).toEqual({
      cover: 'https://i.jav.hk/movie/mudr392/small/mudr392pl.jpg',
      preview: 'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg',
    })
    expect(buildJavHkMovieImageUrls('invalid code!')).toBeNull()
  })

  it('parses the exact actress card from a search page', () => {
    const window = new Window()
    window.document.write(fs.readFileSync(fixturePath, 'utf8'))

    expect(parseJavHkActorSearch(
      window.document as unknown as Document,
      'https://jav.hk/actresses/1069702',
      '天馬ゆい',
    )).toEqual({
      name: '天馬ゆい',
      sourceId: '1069702',
      sourceUrl: 'https://jav.hk/actresses/1069702',
      avatar: 'https://i.jav.hk/actress/small/tenma_yui.jpg',
    })

    window.close()
  })

  it('parses only the exact movie code from the JAV.hk search response', () => {
    expect(parseJavHkMovieSearch({
      hits: [
        {
          content_id: 'mudr00039',
          cover_url: 'https://i.jav.hk/video/mudr00039/small/mudr00039pl.jpg',
          dvd_id: 'MUDR-039',
        },
        {
          content_id: 'mudr392',
          cover_url: 'https://i.jav.hk/movie/mudr392/small/mudr392pl.jpg',
          dvd_id: 'MUDR-392',
        },
      ],
    }, 'MUDR-392', 'https://jav.hk')).toEqual({
      code: 'MUDR-392',
      contentId: 'mudr392',
      cover: 'https://i.jav.hk/movie/mudr392/small/mudr392pl.jpg',
      preview: 'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg',
    })
  })

  it('falls back to a verified conventional image URL when search has no exact hit', async () => {
    const probedUrls: string[] = []
    const strategy = new JavHkStrategy(
      async () => '',
      async () => ({
        hits: [{
          content_id: 'mudr00039',
          cover_url: 'https://i.jav.hk/video/mudr00039/small/mudr00039pl.jpg',
          dvd_id: 'MUDR-039',
        }],
      }),
      async (url) => {
        probedUrls.push(url)
        return url.includes('/mudr392')
      },
    )

    await expect(strategy.findMovieImages('MUDR-392')).resolves.toEqual({
      cover: 'https://i.jav.hk/movie/mudr392/small/mudr392pl.jpg',
      preview: 'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg',
    })
    expect(probedUrls).toEqual([
      'https://i.jav.hk/movie/mudr392/small/mudr392pl.jpg',
      'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg',
    ])
  })

  it('paginates the search API until it finds the exact movie code', async () => {
    const requestedOffsets: string[] = []
    const strategy = new JavHkStrategy(
      async () => '',
      async (url) => {
        const offset = new URL(url).searchParams.get('offset') || ''
        requestedOffsets.push(offset)
        if (offset === '40') {
          return {
            hits: [{
              content_id: 'mudr392',
              cover_url: 'https://i.jav.hk/movie/mudr392/small/mudr392pl.jpg',
              dvd_id: 'MUDR-392',
            }],
          }
        }
        return { hits: Array.from({ length: 20 }, (_, index) => ({ dvd_id: `OTHER-${index}` })) }
      },
      async () => true,
    )

    await expect(strategy.findMovieImages('MUDR-392')).resolves.toEqual({
      cover: 'https://i.jav.hk/movie/mudr392/small/mudr392pl.jpg',
      preview: 'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg',
    })
    expect(requestedOffsets).toEqual(['0', '20', '40'])
  })

  it('surfaces source unavailability from a real GET probe', async () => {
    vi.mocked(gotScraping).mockResolvedValue({
      body: Buffer.from('<html>maintenance</html>'),
      headers: { 'content-type': 'text/html', 'retry-after': '60' },
      statusCode: 503,
    } as never)

    await expect(probeJavHkImage('https://i.jav.hk/movie/mudr392/small/mudr392pl.jpg')).rejects.toMatchObject({
      retryAfterMs: 60_000,
      statusCode: 503,
    })
    expect(gotScraping).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      responseType: 'buffer',
    }))
  })

  it('cools down the strategy after the image host becomes unavailable', async () => {
    const requestText = vi.fn(async () => '')
    const requestJson = vi.fn(async () => ({ hits: [] }))
    const strategy = new JavHkStrategy(requestText, requestJson)
    vi.mocked(gotScraping).mockResolvedValue({
      body: Buffer.from('<html>maintenance</html>'),
      headers: { 'content-type': 'text/html', 'retry-after': '60' },
      statusCode: 503,
    } as never)

    await expect(strategy.findMovieImages('MUDR-392')).resolves.toBeNull()
    await expect(strategy.findActor('天馬ゆい')).resolves.toBeNull()

    expect(requestJson).toHaveBeenCalledOnce()
    expect(requestText).not.toHaveBeenCalled()
    expect(gotScraping).toHaveBeenCalledTimes(2)
  })

  it('uses an injected fetcher for actor lookup', async () => {
    const html = `
      <link rel="preload" href="/static/i18n/fixture.json" as="fetch">
      ${fs.readFileSync(fixturePath, 'utf8')}
    `
    const requestedUrls: string[] = []
    const strategy = new JavHkStrategy(async (url) => {
      requestedUrls.push(url)
      return html
    })

    await expect(strategy.findActor('天馬ゆい')).resolves.toMatchObject({
      avatar: 'https://i.jav.hk/actress/small/tenma_yui.jpg',
      sourceId: '1069702',
    })
    expect(requestedUrls).toEqual(['https://jav.hk/en/actresses?q=%E5%A4%A9%E9%A6%AC%E3%82%86%E3%81%84'])
  })
})
