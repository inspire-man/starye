import { Window } from 'happy-dom'
import { describe, expect, it } from 'vitest'
import { parseMangaInfo } from '../src/strategies/site-92hm-parser'

describe('92hm Parser Enhanced', () => {
  it('should extract enhanced metadata (author, region, genres, status)', () => {
    const html = `
      <div class="banner_detail_form">
          <div class="cover">
              <img src="https://example.com/cover.jpg" />
          </div>
          <div class="info">
              <h1>我的漫画标题</h1>
              <p class="subtitle">作者：老王</p>
              <p class="subtitle">状态：连载中</p>
              <p class="subtitle">地区：日本</p>
              <p class="subtitle">题材：<a href="/tag/热血">热血</a> <a href="/tag/冒险">冒险</a></p>
              <p class="content">简介：这是一个非常精彩的故事。</p>
          </div>
      </div>
      <ul id="detail-list-select">
          <li><a href="/chapter/1001">第1话</a></li>
          <li><a href="/chapter/1002">第2话</a></li>
      </ul>
    `
    const window = new Window()
    const document = window.document
    document.write(html)

    const result = parseMangaInfo(document as unknown as Document, 'https://www.92hm.life/book/123')

    expect(result.title).toBe('我的漫画标题')
    expect(result.author).toBe('老王')
    expect(result.status).toBe('serializing')
    expect(result.region).toBe('日本')
    expect(result.genres).toEqual(['热血', '冒险'])
    expect(result.description).toBe('这是一个非常精彩的故事。')
    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0].slug).toBe('1001')

    window.close()
  })

  it('should handle completed status and English labels', () => {
    const html = `
      <div class="info">
          <h1>Completed Manga</h1>
          <p class="subtitle">Author: Jane Doe</p>
          <p class="subtitle">Status: Completed</p>
          <p class="subtitle">Region: CN</p>
          <p class="subtitle">Tags: <a href="/tag/Romance">Romance</a> <a href="/tag/Comedy">Comedy</a></p>
      </div>
    `
    const window = new Window()
    const document = window.document
    document.write(html)

    const result = parseMangaInfo(document as unknown as Document, 'https://www.92hm.life/book/456')

    expect(result.author).toBe('Jane Doe')
    expect(result.status).toBe('completed')
    expect(result.region).toBe('CN')
    expect(result.genres).toEqual(['Romance', 'Comedy'])

    window.close()
  })
})
