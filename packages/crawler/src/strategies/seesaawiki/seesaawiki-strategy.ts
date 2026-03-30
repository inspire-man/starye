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
import * as iconv from 'iconv-lite'
import {
  parseActorIndexPage,
  parseActorPage,
  parsePublisherPage,
} from './parser'

/**
 * 使用 EUC-JP 编码构造 SeesaaWiki URL
 * SeesaaWiki 使用 EUC-JP 编码而不是 UTF-8
 */
function encodeEucJpUrl(pageName: string): string {
  const encoded = iconv.encode(pageName, 'euc-jp')
  return Array.from(encoded)
    .map(byte => `%${byte.toString(16).padStart(2, '0')}`)
    .join('')
}

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
  async fetchActorDetails(wikiUrl: string, page: Page): Promise<ParseResult<ActorDetails | null>> {
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
    // 使用 EUC-JP 编码（SeesaaWiki 的编码格式）
    let pageName: string

    // 特殊处理：
    // - あ行和英数：从总索引页爬取
    // - ら和わ：合并为"ら・わ行"
    // - 其他：独立页面
    if (gojuonLine === 'あ' || gojuonLine === '英数') {
      pageName = '女優ページ一覧'
    }
    else if (gojuonLine === 'ら' || gojuonLine === 'わ') {
      pageName = '女優ページ一覧：ら・わ行'
    }
    else {
      const suffix = pageNumber > 1 ? `-${pageNumber}` : ''
      pageName = `女優ページ一覧：${gojuonLine}行${suffix}`
    }

    const encodedPageName = encodeEucJpUrl(pageName)
    const url = `${this.baseUrl}/d/${encodedPageName}`

    console.warn(`[SeesaaWiki] 爬取女优索引页: ${pageName}`)

    try {
      await this._preparePage(page, url)

      // 获取页面 HTML
      const html = await page.content()
      const $ = cheerio.load(html)

      // 检查是否404
      if ($('.page-404').length > 0) {
        console.warn(`[SeesaaWiki] ⚠️  索引页不存在: ${pageName}`)
        return {
          actors: [],
          hasNextPage: false,
        }
      }

      // 解析女优列表
      const actors = parseActorIndexPage($, gojuonLine)

      // 检查是否有下一页（总索引页不分页）
      const isMainIndex = pageName === '女優ページ一覧'
      const nextPageLink = isMainIndex ? null : $('#wikibody').find('a:contains("次のページ")').attr('href')
      const hasNextPage = !!nextPageLink

      return {
        actors,
        hasNextPage,
        nextPageNumber: hasNextPage ? pageNumber + 1 : undefined,
      }
    }
    catch (error) {
      console.error(`[SeesaaWiki] 爬取索引页失败: ${pageName}`, error)
      throw error
    }
  }

  /**
   * 从首页直接提取所有厂商链接
   * 注：厂商没有独立的五十音行索引页，所有厂商链接都列在首页中
   */
  async fetchAllPublishersFromHomePage(page: Page): Promise<Array<{ name: string, wikiUrl: string }>> {
    await this._smartDelay()

    const homeUrl = `${this.baseUrl}/`
    console.warn('[SeesaaWiki] 从首页提取所有厂商链接...')

    try {
      await this._preparePage(page, homeUrl)

      const html = await page.content()
      const $ = cheerio.load(html)

      const publishers: Array<{ name: string, wikiUrl: string }> = []
      const seenUrls = new Set<string>()

      // 查找所有包含"wiki"的链接（厂商页面的标识）
      $('#wiki-content a').each((_, el) => {
        const text = $(el).text().trim()
        const href = $(el).attr('href')

        if (!text || !href)
          return

        // 必须包含"wiki"且链接指向本站
        if (!text.toLowerCase().includes('wiki') || !href.startsWith(this.baseUrl)) {
          return
        }

        // 排除关键词（论坛、说明页等）
        const excludeKeywords = [
          'bbs',
          '編集',
          'FAQ',
          '一覧',
          '検索',
          '概要',
          'ガイド',
          'メンバー',
          'アナウンス',
          '履歴',
          '女優',
          'AV女優',
          'シリーズ',
          '作成',
          '要望',
        ]

        const hasExcludeKeyword = excludeKeywords.some(keyword => text.includes(keyword) || href.includes(keyword))
        if (hasExcludeKeyword)
          return

        // 检查长度
        if (text.length < 2 || text.length > 50)
          return

        // 提取厂商名（去掉" wiki"后缀）
        const publisherName = text.replace(/\s*wiki\s*$/i, '').trim()

        // 去重
        if (seenUrls.has(href))
          return
        seenUrls.add(href)

        publishers.push({
          name: publisherName,
          wikiUrl: href,
        })
      })

      console.warn(`[SeesaaWiki] 从首页提取到 ${publishers.length} 个厂商`)
      return publishers
    }
    catch (error) {
      console.error('[SeesaaWiki] 从首页提取厂商失败', error)
      throw error
    }
  }

  /**
   * @deprecated 厂商没有五十音行索引页，请使用 fetchAllPublishersFromHomePage
   */
  async fetchPublisherIndexPage(_gojuonLine: GojuonLine, _page: Page, _pageNumber = 1) {
    console.warn('[SeesaaWiki] ⚠️  fetchPublisherIndexPage 已废弃，厂商没有五十音行索引页')
    return {
      publishers: [],
      hasNextPage: false,
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
