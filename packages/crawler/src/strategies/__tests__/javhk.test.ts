import fs from 'node:fs'
import path from 'node:path'
import { Window } from 'happy-dom'
import { describe, expect, it } from 'vitest'
import { buildJavHkMovieImageUrls, JavHkStrategy } from '../javhk'
import { parseJavHkActorSearch, parseJavHkMovieSearch } from '../javhk-parser'

const fixturePath = path.join(import.meta.dirname, '../__fixtures__/javhk-actresses-search.html')

describe('jav.hk strategy', () => {
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
