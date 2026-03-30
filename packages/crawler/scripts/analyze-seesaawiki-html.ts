/**
 * 分析 SeesaaWiki HTML 结构，用于完善 Parser
 */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { BrowserManager } from '../src/utils/browser'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function analyzeHTML() {
  console.log('🔍 分析 SeesaaWiki HTML 结构')
  console.log('='.repeat(60))

  // 直接使用已知的女优URL进行测试
  // 测试几个知名女优，确保能找到包含完整信息的页面
  const testCases = [
    { name: '波多野結衣', url: 'https://seesaawiki.jp/w/sougouwiki/d/%E6%B3%A2%E5%A4%9A%E9%87%8E%E7%B5%90%E8%A1%A3' },
    { name: '橋本ありな', url: 'https://seesaawiki.jp/w/sougouwiki/d/%E6%A9%8B%E6%9C%AC%E3%81%82%E3%82%8A%E3%81%AA' },
    { name: '明日花キララ', url: 'https://seesaawiki.jp/w/sougouwiki/d/%E6%98%8E%E6%97%A5%E8%8A%B1%E3%82%AD%E3%83%A9%E3%83%A9' },
  ]

  const testCase = testCases[0] // 使用第一个测试用例
  const testUrl = testCase.url
  const actorName = testCase.name

  console.log(`\n测试女优: ${actorName}`)
  console.log(`URL: ${testUrl}`)

  const browserManager = new BrowserManager({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  }, undefined)

  await browserManager.launch()
  const browser = await browserManager.getBrowser()
  if (!browser) {
    throw new Error('Failed to launch browser')
  }

  const page = await browser.newPage()

  console.log(`\n访问页面...`)
  await page.goto(testUrl, { waitUntil: 'networkidle2' })

  // 提取整个 wiki 内容区域的 HTML
  const wikiBodyHTML = await page.evaluate(() => {
    const wikiBody = document.querySelector('#wiki-content')
    return wikiBody ? wikiBody.innerHTML : ''
  })

  // 提取纯文本
  const wikiBodyText = await page.evaluate(() => {
    const wikiBody = document.querySelector('#wiki-content')
    return wikiBody ? wikiBody.textContent : ''
  })

  console.log('\n📄 Wiki 内容区域 HTML (前 2000 字符):')
  console.log('-'.repeat(60))
  console.log(wikiBodyHTML.substring(0, 2000))
  console.log('-'.repeat(60))

  console.log('\n📝 Wiki 内容区域纯文本 (前 1000 字符):')
  console.log('-'.repeat(60))
  console.log(wikiBodyText.substring(0, 1000))
  console.log('-'.repeat(60))

  // 查找所有包含关键字的元素
  const keywords = ['プロフィール', '生年月日', '身長', 'サイズ', '血液型', '出身地', 'デビュー', '引退', 'Twitter', 'Instagram', 'ブログ']

  console.log('\n🔎 关键字段位置分析:')
  console.log('-'.repeat(60))

  for (const keyword of keywords) {
    const elements = await page.evaluate((kw) => {
      const results: string[] = []
      const textNodes = document.evaluate(
        `//*[contains(text(), '${kw}')]`,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      )

      for (let i = 0; i < Math.min(textNodes.snapshotLength, 3); i++) {
        const node = textNodes.snapshotItem(i)
        if (node && node.parentElement) {
          results.push(node.parentElement.outerHTML.substring(0, 200))
        }
      }

      return results
    }, keyword)

    if (elements.length > 0) {
      console.log(`\n✓ 找到 "${keyword}":`)
      elements.forEach((el, idx) => {
        console.log(`  [${idx + 1}] ${el.replace(/\n/g, ' ')}...`)
      })
    }
    else {
      console.log(`\n✗ 未找到 "${keyword}"`)
    }
  }

  await browserManager.close()
  console.log('\n✅ 分析完成')
}

analyzeHTML().catch((error) => {
  console.error('❌ 分析失败:', error)
  process.exit(1)
})
