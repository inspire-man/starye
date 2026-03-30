/**
 * SeesaaWiki 集成测试脚本
 *
 * 测试内容：
 * 1. NameMapper 名字匹配功能
 * 2. SeesaaWikiStrategy 女优详情爬取
 * 3. 数据完整度验证
 * 4. 新字段填充验证
 */

import process from 'node:process'
import { NameMapper } from '../src/lib/name-mapper'
import { SeesaaWikiStrategy } from '../src/strategies/seesaawiki/seesaawiki-strategy'
import { BrowserManager } from '../src/utils/browser'
import 'dotenv/config'

interface TestResult {
  actorName: string
  matched: boolean
  wikiUrl?: string
  details?: {
    hasAvatar: boolean
    hasTwitter: boolean
    hasInstagram: boolean
    hasBlog: boolean
    hasWikiUrl: boolean
    hasBio: boolean
    hasAliases: boolean
    completeness: number
  }
  error?: string
}

// 测试用女优列表（从 JavBus 中选取一些知名女优）
const TEST_ACTORS = [
  '三上悠亜',
  '橋本ありな',
  '明日花キララ',
  '天使もえ',
  '波多野結衣',
]

async function calculateCompleteness(details: any): Promise<number> {
  // SeesaaWiki 数据完整度权重（不包含 avatar，因为 Wiki 不提供图片）
  const weights = {
    twitter: 0.10,
    instagram: 0.10,
    blog: 0.10,
    bio: 0.15,
    aliases: 0.20,
    birthDate: 0.10,
    height: 0.10,
    measurements: 0.10,
    nationality: 0.05,
  }

  let completeness = 0
  if (details.twitter)
    completeness += weights.twitter
  if (details.instagram)
    completeness += weights.instagram
  if (details.blog)
    completeness += weights.blog
  if (details.bio)
    completeness += weights.bio
  if (details.aliases && details.aliases.length > 0)
    completeness += weights.aliases
  if (details.birthDate)
    completeness += weights.birthDate
  if (details.height)
    completeness += weights.height
  if (details.measurements)
    completeness += weights.measurements
  if (details.nationality)
    completeness += weights.nationality

  return Math.round(completeness * 100)
}

async function testActorCrawling(): Promise<void> {
  console.log('🧪 SeesaaWiki 集成测试')
  console.log('='.repeat(60))
  console.log()

  // 初始化组件
  const browserManager = new BrowserManager({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  })

  await browserManager.launch()
  const browser = await browserManager.getBrowser()
  if (!browser) {
    throw new Error('Failed to launch browser')
  }

  const page = await browser.newPage()
  const seesaaWikiStrategy = new SeesaaWikiStrategy({
    baseDelay: 3000,
    randomDelay: 2000,
    maxRetries: 2,
  })

  const nameMapper = new NameMapper(seesaaWikiStrategy)

  const results: TestResult[] = []
  let matchedCount = 0
  let totalCompleteness = 0

  console.log(`📋 测试女优列表 (${TEST_ACTORS.length} 个)`)
  console.log('-'.repeat(60))
  console.log()

  // 逐个测试女优
  for (const actorName of TEST_ACTORS) {
    console.log(`\n🔍 测试: ${actorName}`)

    try {
      // 阶段 1: 名字匹配
      console.log('  ⏳ 阶段 1/2: 名字匹配...')
      const mapping = await nameMapper.matchActorName(actorName, page)

      if (!mapping) {
        console.log('  ❌ 名字匹配失败')
        results.push({
          actorName,
          matched: false,
          error: 'Name mapping failed',
        })
        continue
      }

      console.log(`  ✅ 匹配成功: ${mapping.wikiUrl}`)
      matchedCount++

      // 阶段 2: 爬取详情
      console.log('  ⏳ 阶段 2/2: 爬取详情...')
      const detailsResult = await seesaaWikiStrategy.fetchActorDetails(mapping.wikiUrl, page)

      if (!detailsResult.data) {
        console.log(`  ⚠️  爬取失败: ${detailsResult.errors.join(', ')}`)
        results.push({
          actorName,
          matched: true,
          wikiUrl: mapping.wikiUrl,
          error: detailsResult.errors.join(', '),
        })
        continue
      }

      const details = detailsResult.data

      // 调试：打印实际返回的数据结构
      console.log(`  📋 返回的字段:`, Object.keys(details).join(', '))
      console.log(`  📋 Twitter 值:`, details.twitter)
      console.log(`  📋 Instagram 值:`, details.instagram)
      console.log(`  📋 Blog 值:`, details.blog)
      console.log(`  📋 Bio 值:`, details.bio ? `有 (${details.bio.length} 字)` : '无')
      console.log(`  📋 Aliases 值:`, details.aliases)

      const completeness = await calculateCompleteness(details)
      totalCompleteness += completeness

      console.log(`  ✅ 爬取成功`)
      console.log(`    - Twitter: ${details.twitter ? '✓' : '✗'}`)
      console.log(`    - Instagram: ${details.instagram ? '✓' : '✗'}`)
      console.log(`    - 博客: ${details.blog ? '✓' : '✗'}`)
      console.log(`    - 简介: ${details.bio ? '✓' : '✗'}`)
      console.log(`    - 别名: ${details.aliases && details.aliases.length > 0 ? `✓ (${details.aliases.length} 个)` : '✗'}`)
      console.log(`    - 生日: ${details.birthDate ? '✓' : '✗'}`)
      console.log(`    - 身高: ${details.height ? '✓' : '✗'}`)
      console.log(`    - 三围: ${details.measurements ? '✓' : '✗'}`)
      console.log(`    - 数据完整度: ${completeness}%`)

      results.push({
        actorName,
        matched: true,
        wikiUrl: mapping.wikiUrl,
        details: {
          hasAvatar: false, // SeesaaWiki 不提供头像
          hasTwitter: !!details.twitter,
          hasInstagram: !!details.instagram,
          hasBlog: !!details.blog,
          hasWikiUrl: !!mapping.wikiUrl,
          hasBio: !!details.bio,
          hasAliases: details.aliases && details.aliases.length > 0,
          completeness,
        },
      })
    }
    catch (error) {
      console.log(`  ❌ 测试失败: ${error}`)
      results.push({
        actorName,
        matched: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // 关闭浏览器
  await browserManager.close()

  // 生成测试报告
  console.log()
  console.log()
  console.log('='.repeat(60))
  console.log('📊 测试报告')
  console.log('='.repeat(60))
  console.log()

  const successCount = results.filter(r => r.matched && r.details).length
  const matchRate = Number((matchedCount / TEST_ACTORS.length * 100).toFixed(1))
  const successRate = Number((successCount / TEST_ACTORS.length * 100).toFixed(1))
  const avgCompleteness = successCount > 0 ? Math.round(totalCompleteness / successCount) : 0

  console.log(`总测试数: ${TEST_ACTORS.length}`)
  console.log(`匹配成功: ${matchedCount} (${matchRate}%)`)
  console.log(`爬取成功: ${successCount} (${successRate}%)`)
  console.log(`平均数据完整度: ${avgCompleteness}%`)
  console.log()

  // 详细统计
  const withTwitter = results.filter(r => r.details?.hasTwitter).length
  const withInstagram = results.filter(r => r.details?.hasInstagram).length
  const withBlog = results.filter(r => r.details?.hasBlog).length
  const withBio = results.filter(r => r.details?.hasBio).length
  const withAliases = results.filter(r => r.details?.hasAliases).length

  console.log('新字段填充率:')
  console.log(`  Twitter: ${withTwitter}/${successCount} (${successCount > 0 ? (withTwitter / successCount * 100).toFixed(1) : 0}%)`)
  console.log(`  Instagram: ${withInstagram}/${successCount} (${successCount > 0 ? (withInstagram / successCount * 100).toFixed(1) : 0}%)`)
  console.log(`  博客: ${withBlog}/${successCount} (${successCount > 0 ? (withBlog / successCount * 100).toFixed(1) : 0}%)`)
  console.log(`  简介: ${withBio}/${successCount} (${successCount > 0 ? (withBio / successCount * 100).toFixed(1) : 0}%)`)
  console.log(`  别名: ${withAliases}/${successCount} (${successCount > 0 ? (withAliases / successCount * 100).toFixed(1) : 0}%)`)
  console.log()

  // 验证目标达成情况
  console.log('目标达成情况:')
  console.log(`  ✓ 名字匹配成功率 > 80%: ${matchRate >= 80 ? '✅ 达成' : `❌ 未达成 (${matchRate}%)`}`)
  console.log(`  ✓ 数据完整度 > 60%: ${avgCompleteness >= 60 ? '✅ 达成' : `❌ 未达成 (${avgCompleteness}%)`}`)
  console.log(`  ✓ 新字段正确填充: ${withTwitter > 0 || withInstagram > 0 || withBlog > 0 ? '✅ 达成' : '❌ 未达成'}`)
  console.log()

  // 失败详情
  const failures = results.filter(r => !r.matched || !r.details)
  if (failures.length > 0) {
    console.log('❌ 失败详情:')
    failures.forEach((f) => {
      console.log(`  - ${f.actorName}: ${f.error || '未知错误'}`)
    })
    console.log()
  }

  console.log('='.repeat(60))

  // 保存映射表
  await nameMapper.saveMappings()

  // 根据测试结果退出
  if (matchRate >= 80 && avgCompleteness >= 60) {
    console.log('✅ 测试通过！SeesaaWiki 集成功能正常')
    process.exit(0)
  }
  else {
    console.log('⚠️  测试未完全通过，需要进一步优化')
    process.exit(1)
  }
}

// 运行测试
testActorCrawling().catch((error) => {
  console.error('❌ 测试失败:', error)
  process.exit(1)
})
