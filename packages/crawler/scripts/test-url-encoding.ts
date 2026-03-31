/**
 * 测试 SeesaaWiki URL 编码修复
 * 验证 EUC-JP 编码是否正确工作
 */

import puppeteer from 'puppeteer-core'
import { SeesaaWikiStrategy } from '../src/strategies/seesaawiki/seesaawiki-strategy'

async function testUrlEncoding() {
  console.log('🧪 测试 SeesaaWiki URL 编码修复\n')

  const strategy = new SeesaaWikiStrategy()

  // 测试女优名
  const testActors = [
    '音無かおり',
    '朝霧ゆう',
    '中山穂香',
  ]

  // 测试厂商名
  const testPublishers = [
    'MANIAQ',
    'GLORY QUEST',
  ]

  console.log('📝 测试女优 URL 编码:\n')
  for (const actorName of testActors) {
    const url = strategy.buildActorUrl(actorName)
    console.log(`  ${actorName}`)
    console.log(`  → ${url}`)
    console.log()
  }

  console.log('📝 测试厂商 URL 编码:\n')
  for (const publisherName of testPublishers) {
    const url = strategy.buildPublisherUrl(publisherName)
    console.log(`  ${publisherName}`)
    console.log(`  → ${url}`)
    console.log()
  }

  console.log('🌐 验证 URL 可访问性:\n')

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })

  try {
    const page = await browser.newPage()

    // 测试第一个女优 URL
    const testUrl = strategy.buildActorUrl(testActors[0])
    console.log(`  访问: ${testUrl}`)

    await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 15000 })

    const title = await page.title()
    const is404 = title.includes('404') || title.includes('Not Found') || title.includes('ページが見つかりませんでした')

    if (is404) {
      console.log(`  ❌ 失败: 返回 404 页面`)
      console.log(`  页面标题: ${title}`)
    }
    else {
      console.log(`  ✅ 成功: 页面可访问`)
      console.log(`  页面标题: ${title}`)

      // 提取页面内容验证
      const content = await page.evaluate(() => {
        const h2 = document.querySelector('#wiki-content h2')
        return h2 ? h2.textContent : null
      })

      if (content) {
        console.log(`  页面内容: ${content}`)
      }
    }

    await page.close()
  }
  catch (error) {
    console.error('  ❌ 错误:', error instanceof Error ? error.message : String(error))
  }
  finally {
    await browser.close()
  }

  console.log('\n✅ 测试完成')
}

testUrlEncoding().catch(console.error)
