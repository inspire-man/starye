/**
 * 从索引页获取一个真实的女优URL
 */

import process from 'node:process'
import { BrowserManager } from '../src/utils/browser'
import 'dotenv/config'

async function getRealURL() {
  console.log('🔍 从索引页获取真实女优URL')

  const browserManager = new BrowserManager({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  }, undefined)

  await browserManager.launch()
  const browser = await browserManager.getBrowser()
  if (!browser) {
    throw new Error('Failed to launch browser')
  }

  const page = await browser.newPage()

  // 访问女优索引页（あ行）
  const indexUrl = 'https://seesaawiki.jp/w/sougouwiki/d/%E5%A5%B3%E5%84%AA%E3%83%9A%E3%83%BC%E3%82%B8%E4%B8%80%E8%A6%A7'
  console.log(`\n访问索引页: ${indexUrl}`)
  await page.goto(indexUrl, { waitUntil: 'networkidle2' })

  // 提取前10个女优链接
  const actressLinks = await page.evaluate(() => {
    const links: Array<{ name: string, url: string }> = []
    const listItems = document.querySelectorAll('#wiki-content .list-1 > li')

    for (let i = 0; i < Math.min(listItems.length, 20); i++) {
      const li = listItems[i]
      const anchor = li.querySelector('a[href*="/d/"]')
      if (anchor) {
        const href = (anchor as HTMLAnchorElement).href
        const text = anchor.textContent?.trim() || ''

        // 过滤掉索引页和目录
        if (!text.includes('一覧') && !text.includes('目次') && !text.includes('行')) {
          links.push({ name: text, url: href })
        }
      }
    }

    return links
  })

  console.log(`\n找到 ${actressLinks.length} 个女优链接:`)
  actressLinks.forEach((link, idx) => {
    console.log(`${idx + 1}. ${link.name}: ${link.url}`)
  })

  if (actressLinks.length > 0) {
    const testLink = actressLinks[0]
    console.log(`\n测试第一个链接: ${testLink.name}`)
    console.log(`URL: ${testLink.url}`)

    await page.goto(testLink.url, { waitUntil: 'networkidle2' })

    // 检查是否是404
    const isNotFound = await page.evaluate(() => {
      return document.body.textContent?.includes('ページが見つかりませんでした') || false
    })

    if (isNotFound) {
      console.log('❌ 页面不存在')
    }
    else {
      console.log('✅ 页面存在！')

      // 提取页面内容前100个字符
      const content = await page.evaluate(() => {
        const wikiContent = document.querySelector('#wiki-content')
        return wikiContent?.textContent?.trim().substring(0, 200) || ''
      })

      console.log(`\n页面内容预览:\n${content}`)
    }
  }

  await browserManager.close()
}

getRealURL().catch((error) => {
  console.error('❌ 失败:', error)
  process.exit(1)
})
