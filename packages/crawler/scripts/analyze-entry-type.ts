/**
 * 分析条目类型（女优 vs 厂商）
 */

import process from 'node:process'
import * as cheerio from 'cheerio'
import { BrowserManager } from '../src/utils/browser'
import 'dotenv/config'

async function analyzeType() {
  console.log('🔍 分析条目类型')
  console.log('='.repeat(60))

  const browserManager = new BrowserManager({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  })

  await browserManager.launch()
  const browser = await browserManager.getBrowser()
  if (!browser) {
    throw new Error('Failed to launch browser')
  }

  const page = await browser.newPage()

  // 测试几个疑似条目
  const testUrls = [
    { name: 'IRON HEAD', url: 'https://seesaawiki.jp/w/sougouwiki/d/IRON%20HEAD' },
    { name: 'ATOM', url: 'https://seesaawiki.jp/w/sougouwiki/d/ATOM' },
    { name: 'アパッチ', url: 'https://seesaawiki.jp/w/sougouwiki/d/%a5%a2%a5%d1%a5%c3%a5%c1' },
  ]

  for (const { name, url } of testUrls) {
    console.log(`\n📄 分析: ${name}`)
    console.log(`   URL: ${url}`)

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })

      const html = await page.content()
      const $ = cheerio.load(html)

      const content = $('#wiki-content').text()

      // 判断类型的关键词
      const actorKeywords = ['身長', '生年月日', 'スリーサイズ', 'カップ', '血液型', '女優', '引退']
      const publisherKeywords = ['メーカー', 'レーベル', 'サイト', '厂商', '制作', '発売']

      const actorScore = actorKeywords.filter(k => content.includes(k)).length
      const publisherScore = publisherKeywords.filter(k => content.includes(k)).length

      console.log(`   女优关键词匹配: ${actorScore}`)
      console.log(`   厂商关键词匹配: ${publisherScore}`)

      // 提取页面开头的内容
      const preview = content.substring(0, 300).replace(/\s+/g, ' ').trim()
      console.log(`   内容预览: ${preview.substring(0, 100)}...`)

      if (actorScore > publisherScore) {
        console.log(`   ✅ 判定: 女优`)
      }
      else if (publisherScore > actorScore) {
        console.log(`   ⚠️  判定: 厂商`)
      }
      else {
        console.log(`   ❓ 判定: 不确定`)
      }
    }
    catch (error: any) {
      console.log(`   ❌ 分析失败: ${error.message}`)
    }

    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  await browserManager.close()
  console.log('\n✅ 分析完成')
}

analyzeType().catch((error) => {
  console.error('❌ 失败:', error)
  process.exit(1)
})
