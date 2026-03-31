#!/usr/bin/env tsx
/**
 * SeesaaWiki 解析器诊断工具
 * 用于诊断为什么数据完整度低
 *
 * 使用方法:
 * pnpm tsx scripts/diagnose-seesaawiki-parser.ts <wiki-url>
 *
 * 示例:
 * pnpm tsx scripts/diagnose-seesaawiki-parser.ts "https://seesaawiki.jp/w/sougouwiki/d/%c9%a2%a4%eb%a4%a4"
 */

import process from 'node:process'
import puppeteer from 'puppeteer-core'
import { SeesaaWikiStrategy } from '../src/strategies/seesaawiki/seesaawiki-strategy'

async function main() {
  const wikiUrl = process.argv[2]

  if (!wikiUrl) {
    console.error('❌ 使用方法: pnpm tsx scripts/diagnose-seesaawiki-parser.ts <wiki-url>')
    console.error('示例: pnpm tsx scripts/diagnose-seesaawiki-parser.ts "https://seesaawiki.jp/w/sougouwiki/d/%c9%a2%a4%eb%a4%a4"')
    process.exit(1)
  }

  console.log('🔍 SeesaaWiki 解析器诊断工具')
  console.log(`📄 Wiki URL: ${wikiUrl}\n`)

  // 查找 Chrome 路径
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH
    || '/usr/bin/google-chrome-stable'
    || '/usr/bin/google-chrome'
    || '/usr/bin/chromium-browser'
    || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

  console.log(`🚀 启动浏览器: ${chromePath}`)

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )

    const strategy = new SeesaaWikiStrategy()

    // 判断是女优还是厂商页面
    const isActor = wikiUrl.includes('sougouwiki')

    if (isActor) {
      console.log('🎭 页面类型: 女优\n')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📡 开始爬取...\n')

      const result = await strategy.fetchActorDetails(wikiUrl, page)

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('✅ 爬取完成\n')

      console.log('📊 解析结果:')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      if (result.data) {
        const data = result.data
        console.log(`  名字: ${data.name || '❌ 缺失'}`)
        console.log(`  读音: ${data.reading || '❌ 缺失'}`)
        console.log(`  别名: ${data.aliases.length > 0 ? data.aliases.join(', ') : '❌ 缺失'}`)
        console.log(`  生日: ${data.birthDate ? new Date(data.birthDate * 1000).toLocaleDateString('zh-CN') : '❌ 缺失'}`)
        console.log(`  出道日期: ${data.debutDate ? new Date(data.debutDate * 1000).toLocaleDateString('zh-CN') : '❌ 缺失'}`)
        console.log(`  退役日期: ${data.retireDate ? new Date(data.retireDate * 1000).toLocaleDateString('zh-CN') : '❌ 缺失'}`)
        console.log(`  身高: ${data.height ? `${data.height}cm` : '❌ 缺失'}`)
        console.log(`  三围: ${data.measurements || '❌ 缺失'}`)
        console.log(`  罩杯: ${data.cupSize || '❌ 缺失'}`)
        console.log(`  血型: ${data.bloodType || '❌ 缺失'}`)
        console.log(`  国籍: ${data.nationality || '❌ 缺失'}`)
        console.log(`  Twitter: ${data.twitter || '❌ 缺失'}`)
        console.log(`  Instagram: ${data.instagram || '❌ 缺失'}`)
        console.log(`  博客: ${data.blog || '❌ 缺失'}`)
        console.log(`  简介: ${data.bio ? `${data.bio.substring(0, 100)}...` : '❌ 缺失'}`)
        console.log(`  活跃状态: ${data.isActive ? '活跃' : '已退役'}`)
        console.log(`  作品数: ${data.works?.length ?? 0}`)
      }
      else {
        console.log('  ❌ 解析失败，没有数据')
      }

      if (result.errors.length > 0) {
        console.log('\n⚠️  错误:')
        result.errors.forEach((error) => {
          console.log(`  - ${error.field}: ${error.reason}`)
          if (error.rawValue) {
            console.log(`    原始值: ${error.rawValue}`)
          }
        })
      }

      if (result.warnings.length > 0) {
        console.log('\n⚠️  警告:')
        result.warnings.forEach((warning) => {
          console.log(`  - ${warning}`)
        })
      }

      // 计算数据完整度
      if (result.data) {
        const data = result.data
        let totalFields = 0
        let filledFields = 0

        const fields = [
          { name: '名字', value: data.name, weight: 1 },
          { name: '别名', value: data.aliases.length > 0, weight: 1 },
          { name: '生日', value: data.birthDate, weight: 1 },
          { name: '出道日期', value: data.debutDate, weight: 1 },
          { name: '身高', value: data.height, weight: 1 },
          { name: '三围', value: data.measurements, weight: 1 },
          { name: '罩杯', value: data.cupSize, weight: 1 },
          { name: '血型', value: data.bloodType, weight: 1 },
          { name: '国籍', value: data.nationality, weight: 1 },
          { name: 'Twitter', value: data.twitter, weight: 1 },
          { name: 'Instagram', value: data.instagram, weight: 1 },
          { name: '博客', value: data.blog, weight: 1 },
          { name: '简介', value: data.bio, weight: 1 },
        ]

        fields.forEach((field) => {
          totalFields += field.weight
          if (field.value)
            filledFields += field.weight
        })

        const completeness = (filledFields / totalFields) * 100
        console.log(`\n📊 数据完整度: ${completeness.toFixed(1)}% (${filledFields}/${totalFields} 字段)`)
      }
    }
    else {
      console.log('🏢 页面类型: 厂商\n')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📡 开始爬取...\n')

      const result = await strategy.fetchPublisherDetails(wikiUrl, page)

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('✅ 爬取完成\n')

      console.log('📊 解析结果:')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      if (result.data) {
        const data = result.data
        console.log(`  名字: ${data.name || '❌ 缺失'}`)
        console.log(`  Logo: ${data.logo || '❌ 缺失'}`)
        console.log(`  官网: ${data.website || '❌ 缺失'}`)
        console.log(`  Twitter: ${data.twitter || '❌ 缺失'}`)
        console.log(`  Instagram: ${data.instagram || '❌ 缺失'}`)
        console.log(`  简介: ${data.description ? `${data.description.substring(0, 100)}...` : '❌ 缺失'}`)
        console.log(`  母公司: ${data.parentPublisher || '❌ 缺失'}`)
        console.log(`  子品牌: ${(data.brandSeries?.length ?? 0) > 0 ? '有' : '❌ 缺失'}`)
      }
      else {
        console.log('  ❌ 解析失败，没有数据')
      }

      if (result.errors.length > 0) {
        console.log('\n⚠️  错误:')
        result.errors.forEach((error) => {
          console.log(`  - ${error.field}: ${error.reason}`)
          if (error.rawValue) {
            console.log(`    原始值: ${error.rawValue}`)
          }
        })
      }

      if (result.warnings.length > 0) {
        console.log('\n⚠️  警告:')
        result.warnings.forEach((warning) => {
          console.log(`  - ${warning}`)
        })
      }

      // 计算数据完整度
      if (result.data) {
        const data = result.data
        let totalFields = 0
        let filledFields = 0

        const fields = [
          { name: '名字', value: data.name, weight: 1 },
          { name: 'Logo', value: data.logo, weight: 1 },
          { name: '官网', value: data.website, weight: 1 },
          { name: 'Twitter', value: data.twitter, weight: 1 },
          { name: 'Instagram', value: data.instagram, weight: 1 },
          { name: '简介', value: data.description, weight: 1 },
          { name: '母公司', value: data.parentPublisher, weight: 1 },
          { name: '子品牌', value: (data.brandSeries?.length ?? 0) > 0, weight: 1 },
        ]

        fields.forEach((field) => {
          totalFields += field.weight
          if (field.value)
            filledFields += field.weight
        })

        const completeness = (filledFields / totalFields) * 100
        console.log(`\n📊 数据完整度: ${completeness.toFixed(1)}% (${filledFields}/${totalFields} 字段)`)
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ 诊断完成')
  }
  finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error('❌ 诊断失败:', error)
  process.exit(1)
})
