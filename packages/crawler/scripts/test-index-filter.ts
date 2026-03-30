/**
 * 测试索引页过滤效果
 */

import process from 'node:process'
import { BrowserManager } from '../src/utils/browser'
import { SeesaaWikiStrategy } from '../src/strategies/seesaawiki/seesaawiki-strategy'
import 'dotenv/config'

async function testFilter() {
  console.log('🧪 测试索引页过滤效果')
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

  // 测试あ行女优索引
  console.log('\n📋 测试女优索引（あ行）...')
  const actorResult = await strategy.fetchActorIndexPage('あ', page, 1)
  console.log(`  过滤后: ${actorResult.actors.length} 个女优`)
  console.log('\n  前10个条目:')
  actorResult.actors.slice(0, 10).forEach((actor, idx) => {
    console.log(`    ${idx + 1}. ${actor.name}`)
    if (actor.aliases.length > 0) {
      console.log(`       别名: ${actor.aliases.join(', ')}`)
    }
  })

  // 测试あ行厂商索引
  console.log('\n📋 测试厂商索引（あ行）...')
  const publisherResult = await strategy.fetchPublisherIndexPage('あ', page, 1)
  console.log(`  过滤后: ${publisherResult.publishers.length} 个厂商`)
  console.log('\n  前10个条目:')
  publisherResult.publishers.slice(0, 10).forEach((pub, idx) => {
    console.log(`    ${idx + 1}. ${pub.name}`)
  })

  await browserManager.close()
  console.log('\n✅ 测试完成')
}

testFilter().catch((error) => {
  console.error('❌ 测试失败:', error)
  process.exit(1)
})
