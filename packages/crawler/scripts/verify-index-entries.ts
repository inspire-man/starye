/**
 * 验证索引条目的有效性
 */

import process from 'node:process'
import { SeesaaWikiStrategy } from '../src/strategies/seesaawiki/seesaawiki-strategy'
import { BrowserManager } from '../src/utils/browser'
import 'dotenv/config'

async function verifyEntries() {
  console.log('🔍 验证索引条目有效性')
  console.log('='.repeat(60))

  const browserManager = new BrowserManager({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  })

  const strategy = new SeesaaWikiStrategy({
    baseDelay: 3000,
    randomDelay: 2000,
    maxRetries: 2,
  })

  await browserManager.launch()
  const browser = await browserManager.getBrowser()
  if (!browser) {
    throw new Error('Failed to launch browser')
  }

  const page = await browser.newPage()

  // 获取女优索引
  console.log('\n📋 获取女优索引（あ行）...')
  const actorResult = await strategy.fetchActorIndexPage('あ', page, 1)
  console.log(`找到 ${actorResult.actors.length} 个条目`)

  // 验证前5个条目
  console.log('\n🧪 验证前5个条目...')
  for (let i = 0; i < Math.min(5, actorResult.actors.length); i++) {
    const actor = actorResult.actors[i]
    console.log(`\n${i + 1}. ${actor.name}`)
    console.log(`   URL: ${actor.wikiUrl}`)

    try {
      await page.goto(actor.wikiUrl, { waitUntil: 'networkidle2', timeout: 15000 })

      const pageInfo = await page.evaluate(() => {
        const title = document.title
        const is404 = document.body.textContent?.includes('ページが見つかりませんでした') || false
        const content = document.querySelector('#wiki-content')?.textContent?.substring(0, 200) || ''

        return { title, is404, content }
      })

      if (pageInfo.is404) {
        console.log('   ❌ 404页面')
      }
      else {
        console.log(`   ✅ 页面存在`)
        console.log(`   标题: ${pageInfo.title}`)
        console.log(`   内容预览: ${pageInfo.content.substring(0, 50)}...`)
      }
    }
    catch (error: any) {
      console.log(`   ❌ 访问失败: ${error.message}`)
    }

    // 延迟避免触发防爬虫
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  await browserManager.close()
  console.log('\n✅ 验证完成')
}

verifyEntries().catch((error) => {
  console.error('❌ 失败:', error)
  process.exit(1)
})
