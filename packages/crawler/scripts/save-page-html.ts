/**
 * 保存实际页面HTML用于离线分析
 */

import fs from 'node:fs/promises'
import process from 'node:process'
import { BrowserManager } from '../src/utils/browser'
import 'dotenv/config'

async function saveHTML() {
  console.log('💾 保存页面HTML')

  const browserManager = new BrowserManager({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  }, undefined)

  await browserManager.launch()
  const browser = await browserManager.getBrowser()
  if (!browser) {
    throw new Error('Failed to launch browser')
  }

  const page = await browser.newPage()

  // 从映射表读取实际的URL（使用EUC-JP编码的那个）
  const mapContent = await fs.readFile('.seesaawiki-actor-map.json', 'utf-8')
  const mappings = JSON.parse(mapContent)

  // 找到三上悠亜的映射
  const mikamiMapping = mappings.find((m: any) =>
    m.wikiUrl && m.wikiUrl.includes('%E4%B8%89%E4%B8%8A'),
  )

  if (!mikamiMapping) {
    console.error('❌ 未找到三上悠亜的映射')
    await browserManager.close()
    return
  }

  const testUrl = mikamiMapping.wikiUrl

  console.log(`测试女优: ${mikamiMapping.javbusName}`)
  console.log(`映射的URL: ${testUrl}`)
  console.log(`\n访问页面...`)

  await page.goto(testUrl, { waitUntil: 'networkidle2' })

  // 获取实际访问的URL（可能被重定向）
  const actualUrl = page.url()
  console.log(`实际URL: ${actualUrl}`)

  // 获取完整HTML
  const html = await page.content()

  // 保存到文件
  await fs.writeFile('test-actress-page.html', html, 'utf-8')
  console.log('✅ HTML已保存到: test-actress-page.html')
  console.log(`文件大小: ${(html.length / 1024).toFixed(2)} KB`)

  // 检查页面状态
  const title = await page.title()
  console.log(`页面标题: ${title}`)

  const is404 = html.includes('ページが見つかりませんでした')
  console.log(`是否404: ${is404 ? '是' : '否'}`)

  await browserManager.close()
}

saveHTML().catch((error) => {
  console.error('❌ 失败:', error)
  process.exit(1)
})
