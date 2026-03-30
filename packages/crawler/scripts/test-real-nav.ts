/**
 * 从索引页导航到女优详情页并分析
 */

import fs from 'node:fs/promises'
import process from 'node:process'
import { BrowserManager } from '../src/utils/browser'
import 'dotenv/config'

async function testRealNavigation() {
  console.log('🧭 测试实际导航')

  const browserManager = new BrowserManager({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  })

  await browserManager.launch()
  const browser = await browserManager.getBrowser()
  if (!browser) {
    throw new Error('Failed to launch browser')
  }

  const page = await browser.newPage()

  // 访问女优索引页（さ行，可能有更多真实女优）
  const indexUrl = 'https://seesaawiki.jp/w/sougouwiki/d/%E5%A5%B3%E5%84%AA%E3%83%9A%E3%83%BC%E3%82%B8%E4%B8%80%E8%A6%A7%EF%BC%9A%E3%81%95%E8%A1%8C'
  console.log(`\n访问索引页: ${indexUrl}`)
  await page.goto(indexUrl, { waitUntil: 'networkidle2' })

  // 提取前10个女优链接（跳过目录和索引）
  const actressLinks = await page.evaluate(() => {
    const links: Array<{ text: string, href: string }> = []
    const listItems = document.querySelectorAll('#wiki-content .list-1 > li')

    for (const li of listItems) {
      const anchor = li.querySelector('a[href*="/d/"]')
      if (anchor) {
        const text = li.textContent?.trim() || ''
        // 跳过目录、索引页面、wiki页面、タイトル一覧等
        if (!text.includes('一覧') && !text.includes('目次') && !text.includes('行')
          && !text.includes('wiki') && !text.includes('タイトル')
          && !text.includes('検索') && !text.includes('編集')
          && text.length > 0 && text.length < 20) {
          links.push({
            text,
            href: (anchor as HTMLAnchorElement).href,
          })

          if (links.length >= 10)
            break
        }
      }
    }

    return links
  })

  console.log(`\n找到 ${actressLinks.length} 个可能的女优链接:`)
  actressLinks.forEach((link, idx) => {
    console.log(`${idx + 1}. ${link.text}`)
  })

  const firstActressLink = actressLinks[0]

  if (!firstActressLink) {
    console.error('❌ 未找到女优链接')
    await browserManager.close()
    return
  }

  console.log(`\n找到女优: ${firstActressLink.text}`)
  console.log(`链接: ${firstActressLink.href}`)

  // 点击链接进入女优页面
  console.log(`\n访问女优页面...`)
  await page.goto(firstActressLink.href, { waitUntil: 'networkidle2' })

  // 检查页面状态
  const pageTitle = await page.title()
  const pageUrl = page.url()
  const is404 = await page.evaluate(() => {
    return document.body.textContent?.includes('ページが見つかりませんでした') || false
  })

  console.log(`\n页面标题: ${pageTitle}`)
  console.log(`页面URL: ${pageUrl}`)
  console.log(`是否404: ${is404 ? '是' : '否'}`)

  if (!is404) {
    console.log(`\n✅ 页面存在！正在分析内容...`)

    // 提取页面中的一些关键信息
    const pageInfo = await page.evaluate(() => {
      const title = document.querySelector('#wiki-content h1, #wiki-content h2')?.textContent?.trim()
      const hasProfile = document.body.textContent?.includes('プロフィール')
      const hasDebut = document.body.textContent?.includes('デビュー')
      const hasBirthDate = document.body.textContent?.includes('生年月日')
      const hasHeight = document.body.textContent?.includes('身長')

      return { title, hasProfile, hasDebut, hasBirthDate, hasHeight }
    })

    console.log(`\n页面信息:`)
    console.log(`  标题: ${pageInfo.title}`)
    console.log(`  包含プロフィール: ${pageInfo.hasProfile}`)
    console.log(`  包含デビュー: ${pageInfo.hasDebut}`)
    console.log(`  包含生年月日: ${pageInfo.hasBirthDate}`)
    console.log(`  包含身長: ${pageInfo.hasHeight}`)

    // 保存HTML
    const html = await page.content()
    await fs.writeFile('real-actress-page.html', html, 'utf-8')
    console.log(`\n✅ HTML已保存到: real-actress-page.html`)
  }

  await browserManager.close()
}

testRealNavigation().catch((error) => {
  console.error('❌ 失败:', error)
  process.exit(1)
})
