import type { Page } from 'puppeteer-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JavBusStrategy } from '../javbus'
import { JavDBStrategy } from '../javdb'

function createMockPage(): Page {
  return {
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn(async (fn: (...args: any[]) => unknown, ...args: any[]) => fn(...args)),
    setViewport: vi.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    title: vi.fn().mockResolvedValue('adult source page'),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page
}

describe('crawler source tagging -> isR18', () => {
  beforeEach(() => {
    document.title = ''
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.title = ''
    document.body.innerHTML = ''
  })

  it('javBusStrategy 应将详情页内容标记为 isR18=true', async () => {
    document.title = 'ABP-123 Test Movie'
    document.body.innerHTML = `
      <h3>ABP-123 Test Movie</h3>
      <div class="bigImage"><img src="https://www.javbus.com/cover.jpg"></div>
      <a class="sample-box" href="https://pics.example/abp-123-1.jpg"><img src="/sample/abp-123-1.jpg"></a>
      <a class="sample-box" href="https://pics.example/abp-123-2.jpg"><img src="/sample/abp-123-2.jpg"></a>
      <a class="sample-box" href="https://pics.example/abp-123-1.jpg"><img src="/sample/abp-123-1.jpg"></a>
      <div class="info">
        <p>識別碼: ABP-123</p>
        <p>發行日期: 2024-01-02</p>
        <p>長度: 120分鐘</p>
        <p>發行商: <a href="https://www.javbus.com/studio/s1">S1</a></p>
        <p>系列: <a href="https://www.javbus.com/series/abc">TEST系列</a></p>
      </div>
      <div class="genre">
        <label><a>字幕</a></label>
        <label><a>巨乳</a></label>
      </div>
      <div class="star-name">
        <a href="https://www.javbus.com/star/actor-a">Actor A</a>
      </div>
    `

    const strategy = new JavBusStrategy()
    vi.spyOn(strategy as any, '_smartDelay').mockResolvedValue(undefined)
    vi.spyOn(strategy as any, '_preparePage').mockResolvedValue(undefined)
    vi.spyOn(strategy as any, '_fetchMagnets').mockResolvedValue([])

    const info = await strategy.getMovieInfo('https://www.javbus.com/ABP-123', createMockPage())

    expect(info.code).toBe('ABP-123')
    expect(info.isR18).toBe(true)
    expect(info.genres).toEqual(expect.arrayContaining(['字幕', '巨乳']))
    expect(info.publisher).toBe('S1')
    expect(info.previewImages).toEqual([
      'https://pics.example/abp-123-1.jpg',
      'https://pics.example/abp-123-2.jpg',
    ])
  })

  it('javDBStrategy 应将详情页内容标记为 isR18=true', async () => {
    document.title = 'JavDB Movie'
    document.body.innerHTML = `
      <h2 class="title">
        <strong>XYZ-789</strong>
        <span class="current-title">JavDB Movie</span>
      </h2>
      <div class="column-video-cover"><img src="https://javdb.com/cover.jpg"></div>
      <div class="tile-images preview-images">
        <a class="preview-video-container" href="/login"><img src="https://javdb.com/video-cover.jpg"></a>
        <a class="tile-item" href="https://c0.jdbstatic.com/samples/xyz-1.jpg"><img src="https://c0.jdbstatic.com/samples/xyz-1-small.jpg"></a>
        <a class="tile-item" href="https://c0.jdbstatic.com/samples/xyz-2.jpg"><img src="https://c0.jdbstatic.com/samples/xyz-2-small.jpg"></a>
      </div>
      <div class="panel-block"><strong>日期</strong><span class="value">2024-01-03</span></div>
      <div class="panel-block"><strong>時長</strong><span class="value">150分鍾</span></div>
      <div class="panel-block"><strong>片商</strong><span class="value">MOODYZ</span></div>
      <div class="panel-block"><strong>系列</strong><span class="value">測試系列</span></div>
      <div class="panel-block"><strong>類別</strong><span class="value"><a>中文字幕</a><a>高清</a></span></div>
      <div class="panel-block"><strong>演員</strong><span class="value"><a>Actor B</a></span></div>
      <div id="magnets-content">
        <div class="item">
          <span class="name">1080p</span>
          <span class="meta">1.2GB</span>
          <a href="magnet:?xt=urn:btih:123&dn=test"></a>
        </div>
      </div>
    `

    const strategy = new JavDBStrategy()
    vi.spyOn(strategy as any, '_preparePage').mockResolvedValue(undefined)
    vi.spyOn(strategy as any, '_handleChallenge').mockResolvedValue(undefined)

    expect(strategy.baseUrl).toBe('https://javdb.com')

    const info = await strategy.getMovieInfo('https://javdb.com/v/xyz-789', createMockPage())

    expect(info.code).toBe('XYZ-789')
    expect(info.isR18).toBe(true)
    expect(info.publisher).toBe('MOODYZ')
    expect(info.genres).toEqual(expect.arrayContaining(['中文字幕', '高清']))
    expect(info.players).toHaveLength(1)
    expect(info.previewImages).toEqual([
      'https://c0.jdbstatic.com/samples/xyz-1.jpg',
      'https://c0.jdbstatic.com/samples/xyz-2.jpg',
    ])
  })
})
