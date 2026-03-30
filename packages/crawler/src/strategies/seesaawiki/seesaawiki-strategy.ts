/**
 * SeesaaWiki 爬虫策略
 * 负责爬取 SeesaaWiki 的女优和厂商详情页，以及索引页
 */

import type { Page } from 'puppeteer-core'
import type {
  ActorDetails,
  GojuonLine,
  IndexPageResult,
  ParseResult,
  PublisherDetails,
} from './types'
import * as cheerio from 'cheerio'
import {
  parseActorIndexPage,
  parseActorPage,
  parsePublisherPage,
} from './parser'

export interface SeesaaWikiConfig {
  baseDelay?: number // 基础延迟 (ms)
  randomDelay?: number // 随机延迟范围 (ms)
  maxRetries?: number // 最大重试次数
}

export class SeesaaWikiStrategy {
  name = 'seesaawiki'
  baseUrl = 'https://seesaawiki.jp/w/sougouwiki'

  private config: Required<SeesaaWikiConfig>
  private requestCount = 0
  private lastRequestTime = 0

  constructor(config: SeesaaWikiConfig = {}) {
    this.config = {
      baseDelay: config.baseDelay ?? 8000, // 8 秒
      randomDelay: config.randomDelay ?? 4000, // 0-4 秒随机
      maxRetries: config.maxRetries ?? 2,
    }
  }

  /**
   * 智能延迟：遵守反爬虫策略
   */
  private async _smartDelay() {
    this.requestCount++
    const now = Date.now()

    // 计算距离上次请求的时间
    const timeSinceLastRequest = now - this.lastRequestTime

    // 基础延迟 + 随机延迟
    let delay = this.config.baseDelay + Math.random() * this.config.randomDelay

    // 如果请求过于频繁（小于 5 秒），增加延迟
    if (timeSinceLastRequest < 5000) {
      delay += 5000
      console.warn('[SeesaaWiki] ⚠️  请求过于频繁，增加延迟...')
    }

    // 每 20 个请求后，增加一次长延迟
    if (this.requestCount % 20 === 0) {
      delay += Math.random() * 5000 + 10000
      console.warn('[SeesaaWiki] 💤 已完成 20 个请求，休息一下...')
    }

    console.warn(`[SeesaaWiki] ⏳ 等待 ${(delay / 1000).toFixed(1)}s...`)
    await new Promise(resolve => setTimeout(resolve, delay))

    this.lastRequestTime = Date.now()
  }

  /**
   * 通用页面准备
   */
  private async _preparePage(page: Page, url: string) {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    })

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })
  }

  /**
   * 爬取女优详情页
   */
  async fetchActorDetails(wikiUrl: string, page: Page): Promise<ParseResult<ActorDetails>> {
    await this._smartDelay()

    console.warn(`[SeesaaWiki] 爬取女优详情: ${wikiUrl}`)

    try {
      await this._preparePage(page, wikiUrl)

      // 检查页面是否存在
      const title = await page.title()
      if (title.includes('404') || title.includes('Not Found')) {
        throw new Error('Page not found (404)')
      }

      // 获取页面 HTML
      const html = await page.content()

      // 使用 cheerio 解析
      const $ = cheerio.load(html)

      // 调用解析器
      return parseActorPage($, html, wikiUrl)
    }
    catch (error) {
      console.error(`[SeesaaWiki] 爬取女优详情失败: ${wikiUrl}`, error)
      throw error
    }
  }

  /**
   * 爬取厂商详情页
   */
  async fetchPublisherDetails(wikiUrl: string, page: Page): Promise<ParseResult<PublisherDetails>> {
    await this._smartDelay()

    console.warn(`[SeesaaWiki] 爬取厂商详情: ${wikiUrl}`)

    try {
      await this._preparePage(page, wikiUrl)

      // 检查页面是否存在
      const title = await page.title()
      if (title.includes('404') || title.includes('Not Found')) {
        throw new Error('Page not found (404)')
      }

      // 获取页面 HTML
      const html = await page.content()

      // 使用 cheerio 解析
      const $ = cheerio.load(html)

      // 调用解析器
      return parsePublisherPage($, html, wikiUrl)
    }
    catch (error) {
      console.error(`[SeesaaWiki] 爬取厂商详情失败: ${wikiUrl}`, error)
      throw error
    }
  }

  /**
   * 爬取五十音索引页（女优）
   */
  async fetchActorIndexPage(gojuonLine: GojuonLine, page: Page, pageNumber = 1): Promise<IndexPageResult> {
    await this._smartDelay()

    // 构建索引页 URL
    const suffix = pageNumber > 1 ? `-${pageNumber}` : ''
    const url = `${this.baseUrl}/d/女優ページ一覧(${gojuonLine})${suffix}`

    console.warn(`[SeesaaWiki] 爬取女优索引页: ${url}`)

    try {
      await this._preparePage(page, url)

      // 获取页面 HTML
      const html = await page.content()
      const $ = cheerio.load(html)

      // 解析女优列表
      const actors = parseActorIndexPage($, gojuonLine)

      // 检查是否有下一页
      const nextPageLink = $('#wikibody').find('a:contains("次のページ")').attr('href')
      const hasNextPage = !!nextPageLink

      return {
        actors,
        hasNextPage,
        nextPageNumber: hasNextPage ? pageNumber + 1 : undefined,
      }
    }
    catch (error) {
      console.error(`[SeesaaWiki] 爬取索引页失败: ${url}`, error)
      throw error
    }
  }

  /**
   * 爬取五十音索引页（厂商）
   * 注：厂商索引页格式与女优类似，但路径不同
   */
  async fetchPublisherIndexPage(gojuonLine: GojuonLine, page: Page, pageNumber = 1) {
    await this._smartDelay()

    const suffix = pageNumber > 1 ? `-${pageNumber}` : ''
    const url = `${this.baseUrl}/d/メーカーページ一覧(${gojuonLine})${suffix}`

    console.warn(`[SeesaaWiki] 爬取厂商索引页: ${url}`)

    try {
      await this._preparePage(page, url)

      const html = await page.content()
      const $ = cheerio.load(html)

      // 厂商索引页解析（简化版，类似女优）
      const publishers: Array<{ name: string, wikiUrl: string }> = []

      $('#wikibody li').each((_, el) => {
        const link = $(el).find('a').first()
        const name = link.text().trim()
        const href = link.attr('href')

        if (name && href) {
          publishers.push({
            name,
            wikiUrl: new URL(href, this.baseUrl).href,
          })
        }
      })

      const nextPageLink = $('#wikibody').find('a:contains("次のページ")').attr('href')
      const hasNextPage = !!nextPageLink

      return {
        publishers,
        hasNextPage,
        nextPageNumber: hasNextPage ? pageNumber + 1 : undefined,
      }
    }
    catch (error) {
      console.error(`[SeesaaWiki] 爬取厂商索引页失败: ${url}`, error)
      throw error
    }
  }

  /**
   * 构建女优详情页 URL（用于精确匹配）
   */
  buildActorUrl(actorName: string): string {
    // URL 编码女优名
    const encoded = encodeURIComponent(actorName)
    return `${this.baseUrl}/d/${encoded}`
  }

  /**
   * 构建厂商详情页 URL（用于精确匹配）
   * 注：厂商页面通常以 "名字 wiki" 结尾
   */
  buildPublisherUrl(publisherName: string): string {
    const encoded = encodeURIComponent(`${publisherName} wiki`)
    return `${this.baseUrl}/d/${encoded}`
  }
}
