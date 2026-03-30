/* eslint-disable node/prefer-global/process */
/**
 * SeesaaWiki 索引页全量爬取脚本
 * 用于建立完整的名字映射表
 * 运行频率：每周一次
 */

import type { GojuonLine } from '../strategies/seesaawiki/types'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SeesaaWikiStrategy } from '../strategies/seesaawiki/seesaawiki-strategy'
import { BrowserManager } from '../utils/browser'

interface NameMapping {
  javbusName: string
  wikiName: string
  wikiUrl: string
  lastUpdated: number
}

// 所有五十音行
const GOJUON_LINES: GojuonLine[] = [
  'あ',
  'か',
  'さ',
  'た',
  'な',
  'は',
  'ま',
  'や',
  'ら',
  'わ',
  '英数',
]

async function main() {
  console.warn('='.repeat(60))
  console.warn('SeesaaWiki 索引页全量爬取')
  console.warn('预计耗时: 1-2 小时')
  console.warn('='.repeat(60))

  const browserManager = new BrowserManager()
  const strategy = new SeesaaWikiStrategy()

  const actorMappings: NameMapping[] = []
  const publisherMappings: NameMapping[] = []

  let totalActors = 0
  let totalPublishers = 0
  const startTime = Date.now()

  try {
    await browserManager.launch()
    const browser = browserManager.getBrowser()
    if (!browser) {
      throw new Error('Failed to launch browser')
    }
    const page = await browser.newPage()

    // 爬取女优索引
    console.warn('\n📋 开始爬取女优索引...')
    for (const line of GOJUON_LINES) {
      console.warn(`\n[女优] 爬取五十音行: ${line}`)

      try {
        let pageNumber = 1
        let hasNextPage = true

        while (hasNextPage) {
          const result = await strategy.fetchActorIndexPage(line, page, pageNumber)

          console.warn(`  页 ${pageNumber}: 找到 ${result.actors.length} 个女优`)

          // 为每个女优建立映射
          for (const entry of result.actors) {
            // 主名映射
            actorMappings.push({
              javbusName: entry.name,
              wikiName: entry.name,
              wikiUrl: entry.wikiUrl,
              lastUpdated: Math.floor(Date.now() / 1000),
            })

            // 别名映射（所有别名都映射到主名）
            for (const alias of entry.aliases) {
              actorMappings.push({
                javbusName: alias,
                wikiName: entry.name,
                wikiUrl: entry.wikiUrl,
                lastUpdated: Math.floor(Date.now() / 1000),
              })
            }

            totalActors++
          }

          hasNextPage = result.hasNextPage
          if (hasNextPage) {
            pageNumber = result.nextPageNumber ?? pageNumber + 1
          }
        }

        console.warn(`  ✅ ${line}行完成，共 ${totalActors} 个女优`)
      }
      catch (error) {
        console.error(`  ❌ ${line}行失败`, error)
      }
    }

    // 爬取厂商索引
    console.warn('\n📋 开始爬取厂商索引（从首页）...')
    try {
      const publishers = await strategy.fetchAllPublishersFromHomePage(page)

      console.warn(`  找到 ${publishers.length} 个厂商`)

      for (const entry of publishers) {
        publisherMappings.push({
          javbusName: entry.name,
          wikiName: entry.name,
          wikiUrl: entry.wikiUrl,
          lastUpdated: Math.floor(Date.now() / 1000),
        })

        totalPublishers++
      }

      console.warn(`  ✅ 厂商索引完成，共 ${totalPublishers} 个厂商`)
    }
    catch (error) {
      console.error('  ❌ 厂商索引失败', error)
    }

    await page.close()
  }
  catch (error) {
    console.error('❌ 索引爬取失败', error)
    throw error
  }
  finally {
    await browserManager.close()
  }

  // 保存映射表
  console.warn('\n💾 保存映射表...')

  const actorMapFile = resolve(process.cwd(), '.seesaawiki-actor-map.json')
  writeFileSync(actorMapFile, JSON.stringify(actorMappings, null, 2), 'utf-8')
  console.warn(`  ✅ 女优映射表: ${actorMapFile} (${actorMappings.length} 条)`)

  const publisherMapFile = resolve(process.cwd(), '.seesaawiki-publisher-map.json')
  writeFileSync(publisherMapFile, JSON.stringify(publisherMappings, null, 2), 'utf-8')
  console.warn(`  ✅ 厂商映射表: ${publisherMapFile} (${publisherMappings.length} 条)`)

  // 统计报告
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  console.warn(`\n${'='.repeat(60)}`)
  console.warn('📊 索引爬取完成')
  console.warn('='.repeat(60))
  console.warn(`女优: ${totalActors} 个（含别名: ${actorMappings.length} 条映射）`)
  console.warn(`厂商: ${totalPublishers} 个（${publisherMappings.length} 条映射）`)
  console.warn(`耗时: ${duration} 分钟`)
  console.warn('='.repeat(60))
}

// 运行脚本
main().catch((error) => {
  console.error('脚本执行失败:', error)
  process.exit(1)
})
