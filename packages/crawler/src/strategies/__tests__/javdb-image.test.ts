import fs from 'node:fs'
import path from 'node:path'
import { Window } from 'happy-dom'
import { describe, expect, it } from 'vitest'
import { JavDBImageStrategy } from '../javdb-image'
import { parseJavDBMovieImageSearch } from '../javdb-parser'

const fixturePath = path.join(import.meta.dirname, '../__fixtures__/javdb-search.html')
const searchHtml = fs.readFileSync(fixturePath, 'utf8')

describe('javdb image strategy', () => {
  it('parses only the exact movie code from search results', () => {
    const window = new Window({ url: 'https://javdb.com/search?q=ACZD-253' })
    window.document.write(searchHtml)

    expect(parseJavDBMovieImageSearch(
      window.document as unknown as Document,
      'https://javdb.com/search?q=ACZD-253',
      'ACZD-253',
    )).toEqual({
      code: 'ACZD-253',
      detailUrl: 'https://javdb.com/v/2mDVMq',
      cover: 'https://c0.jdbstatic.com/covers/2m/2mDVMq.jpg',
    })

    window.close()
  })

  it('accepts JavDB catalogue entries that omit the 300 prefix', () => {
    const window = new Window({ url: 'https://javdb.com/search?q=300ACZD-253' })
    window.document.write(searchHtml)

    expect(parseJavDBMovieImageSearch(
      window.document as unknown as Document,
      'https://javdb.com/search?q=300ACZD-253',
      '300ACZD-253',
    )?.detailUrl).toBe('https://javdb.com/v/2mDVMq')

    window.close()
  })

  it('uses detail-page samples and probes the complete image gallery before returning', async () => {
    const requestedUrls: string[] = []
    const strategy = new JavDBImageStrategy(
      async (url) => {
        requestedUrls.push(url)
        if (url.includes('/search?'))
          return searchHtml
        return `
          <h2 class="title"><strong>ACZD-253</strong><span class="current-title">Exact</span></h2>
          <div class="column-video-cover"><a href="https://c0.jdbstatic.com/covers/2m/2mDVMq.jpg"><img src="https://c0.jdbstatic.com/covers/2m/2mDVMq.jpg"></a></div>
          <div class="tile-images preview-images">
            <a class="tile-item" href="https://c0.jdbstatic.com/samples/2m/2mDVMq_l_0.jpg"><img src="https://c0.jdbstatic.com/samples/2m/2mDVMq_s_0.jpg"></a>
            <a class="tile-item" href="https://c0.jdbstatic.com/samples/2m/2mDVMq_l_1.jpg"><img src="https://c0.jdbstatic.com/samples/2m/2mDVMq_s_1.jpg"></a>
          </div>
        `
      },
      async () => true,
    )

    await expect(strategy.findMovieImages('ACZD-253')).resolves.toEqual({
      cover: 'https://c0.jdbstatic.com/covers/2m/2mDVMq.jpg',
      preview: 'https://c0.jdbstatic.com/samples/2m/2mDVMq_l_0.jpg',
      previewImages: [
        'https://c0.jdbstatic.com/samples/2m/2mDVMq_l_0.jpg',
        'https://c0.jdbstatic.com/samples/2m/2mDVMq_l_1.jpg',
      ],
      refererUrl: 'https://javdb.com/v/2mDVMq',
    })
    expect(requestedUrls).toEqual([
      'https://javdb.com/search?q=ACZD-253',
      'https://javdb.com/v/2mDVMq',
    ])
  })
})

