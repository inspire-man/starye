/**
 * 测试 R2 映射文件存储完整流程
 *
 * 测试步骤：
 * 1. 创建测试映射数据
 * 2. 上传到 R2
 * 3. 从 R2 读取
 * 4. 验证数据完整性
 * 5. 测试添加映射功能
 * 6. 测试版本历史功能
 */

import process from 'node:process'
import { MappingFileManager } from '../src/lib/mapping-file-manager'

const r2Config = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucketName: process.env.R2_BUCKET_NAME || '',
  publicUrl: process.env.R2_PUBLIC_URL || '',
}

async function testUpload() {
  console.log('🧪 测试 1: 上传映射文件到 R2\n')

  const manager = new MappingFileManager(r2Config)

  // 创建测试数据
  const testActorMap = {
    三佳詩: {
      javbusName: '三佳詩',
      wikiName: '三佳詩',
      wikiUrl: 'https://seesaawiki.jp/w/sougouwiki/d/%E4%B8%89%E4%BD%B3%E8%A9%A9',
      lastUpdated: Math.floor(Date.now() / 1000),
    },
    明日花キララ: {
      javbusName: '明日花キララ',
      wikiName: '明日花キララ',
      wikiUrl: 'https://seesaawiki.jp/w/sougouwiki/d/%E6%98%8E%E6%97%A5%E8%8A%B1%E3%82%AD%E3%83%A9%E3%83%A9',
      lastUpdated: Math.floor(Date.now() / 1000),
    },
  }

  const testUnmappedActors = [
    {
      javbusName: '未知女优1',
      attempts: ['cache', 'exact', 'index'],
      lastAttempt: Math.floor(Date.now() / 1000),
      priority: 1,
    },
    {
      javbusName: '未知女优2',
      attempts: ['cache', 'exact'],
      lastAttempt: Math.floor(Date.now() / 1000),
      priority: 2,
    },
  ]

  try {
    await manager.uploadAllMappings({
      actorNameMap: testActorMap,
      unmappedActors: testUnmappedActors,
    })

    console.log('\n✅ 测试 1 通过：映射文件上传成功\n')
    return true
  }
  catch (e: any) {
    console.error('\n❌ 测试 1 失败:', e.message)
    return false
  }
}

async function testApiRead() {
  console.log('🧪 测试 2: 通过 API 读取映射文件\n')

  const API_BASE = process.env.API_URL || 'http://localhost:8787'
  const CRAWLER_SECRET = process.env.CRAWLER_SECRET || ''

  if (!CRAWLER_SECRET) {
    console.error('❌ CRAWLER_SECRET 环境变量未设置')
    return false
  }

  try {
    // 测试未匹配女优清单
    const unmappedResponse = await fetch(`${API_BASE}/api/admin/crawlers/unmapped-actors`, {
      headers: {
        Authorization: `Bearer ${CRAWLER_SECRET}`,
      },
    })

    if (!unmappedResponse.ok) {
      console.error(`❌ API 返回错误: ${unmappedResponse.status}`)
      return false
    }

    const unmappedData = await unmappedResponse.json()
    console.log('📝 未匹配女优清单:')
    console.log(`   数量: ${unmappedData.data?.length || 0}`)

    if (unmappedData.data && unmappedData.data.length > 0) {
      console.log(`   示例: ${unmappedData.data[0].javbusName || unmappedData.data[0].name}`)
    }

    // 测试映射质量
    const qualityResponse = await fetch(`${API_BASE}/api/admin/crawlers/mapping-quality`, {
      headers: {
        Authorization: `Bearer ${CRAWLER_SECRET}`,
      },
    })

    if (!qualityResponse.ok) {
      console.error(`❌ 质量 API 返回错误: ${qualityResponse.status}`)
      return false
    }

    const qualityData = await qualityResponse.json()
    console.log('\n📊 映射质量指标:')
    console.log(`   女优覆盖率: ${((qualityData.data.mappedActors / qualityData.data.totalActors) * 100).toFixed(1)}%`)
    console.log(`   女优映射数: ${qualityData.data.actorMappingCount}`)
    console.log(`   映射冲突: ${qualityData.data.conflictCount}`)

    console.log('\n✅ 测试 2 通过：API 读取成功\n')
    return true
  }
  catch (e: any) {
    console.error('\n❌ 测试 2 失败:', e.message)
    return false
  }
}

async function testAddMapping() {
  console.log('🧪 测试 3: 通过 API 添加映射\n')

  const API_BASE = process.env.API_URL || 'http://localhost:8787'
  const CRAWLER_SECRET = process.env.CRAWLER_SECRET || ''

  try {
    const response = await fetch(`${API_BASE}/api/admin/crawlers/add-mapping`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRAWLER_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'actor',
        javbusName: '测试女优',
        wikiUrl: 'https://seesaawiki.jp/w/sougouwiki/d/%E6%B5%8B%E8%AF%95%E5%A5%B3%E4%BC%98',
      }),
    })

    if (!response.ok) {
      console.error(`❌ API 返回错误: ${response.status}`)
      const error = await response.json()
      console.error(`   错误信息: ${error.error}`)
      return false
    }

    const result = await response.json()
    console.log('✅ 映射添加成功:')
    console.log(`   JavBus 名: ${result.mapping?.javbusName}`)
    console.log(`   Wiki 名: ${result.mapping?.wikiName}`)
    console.log(`   Wiki URL: ${result.mapping?.wikiUrl}`)

    console.log('\n✅ 测试 3 通过：添加映射成功\n')
    return true
  }
  catch (e: any) {
    console.error('\n❌ 测试 3 失败:', e.message)
    return false
  }
}

async function testVersionHistory() {
  console.log('🧪 测试 4: 查看版本历史\n')

  const API_BASE = process.env.API_URL || 'http://localhost:8787'
  const CRAWLER_SECRET = process.env.CRAWLER_SECRET || ''

  try {
    const response = await fetch(`${API_BASE}/api/admin/crawlers/mapping-versions?type=actor`, {
      headers: {
        Authorization: `Bearer ${CRAWLER_SECRET}`,
      },
    })

    if (!response.ok) {
      console.error(`❌ API 返回错误: ${response.status}`)
      return false
    }

    const result = await response.json()
    console.log('📜 版本历史:')
    console.log(`   版本数量: ${result.data?.length || 0}`)

    if (result.data && result.data.length > 0) {
      const latest = result.data[0]
      console.log(`   最新版本: ${latest.version}`)
      console.log(`   条目数: ${latest.totalEntries}`)
      console.log(`   来源: ${latest.source}`)
      console.log(`   大小: ${(latest.size / 1024).toFixed(2)} KB`)
    }

    console.log('\n✅ 测试 4 通过：版本历史查询成功\n')
    return true
  }
  catch (e: any) {
    console.error('\n❌ 测试 4 失败:', e.message)
    return false
  }
}

async function main() {
  console.log('🚀 开始测试 R2 映射文件存储完整流程\n')
  console.log('📋 测试环境:')
  console.log(`   R2 Bucket: ${r2Config.bucketName}`)
  console.log(`   Account ID: ${r2Config.accountId}`)
  console.log(`   API URL: ${process.env.API_URL || 'http://localhost:8787'}`)
  console.log()

  // 验证配置
  if (!r2Config.accountId || !r2Config.accessKeyId || !r2Config.secretAccessKey) {
    console.error('❌ R2 配置不完整，请检查环境变量')
    process.exit(1)
  }

  const results = {
    upload: await testUpload(),
    apiRead: await testApiRead(),
    addMapping: await testAddMapping(),
    versionHistory: await testVersionHistory(),
  }

  console.log('━'.repeat(60))
  console.log('📊 测试结果总结:\n')
  console.log(`   1. 上传映射文件: ${results.upload ? '✅' : '❌'}`)
  console.log(`   2. API 读取: ${results.apiRead ? '✅' : '❌'}`)
  console.log(`   3. 添加映射: ${results.addMapping ? '✅' : '❌'}`)
  console.log(`   4. 版本历史: ${results.versionHistory ? '✅' : '❌'}`)

  const allPassed = Object.values(results).every(r => r)

  if (allPassed) {
    console.log('\n🎉 所有测试通过！R2 映射存储配置成功！')
    console.log('\n📝 下一步：')
    console.log('   1. 在 GitHub Actions 中配置 UPLOAD_MAPPINGS_TO_R2=true')
    console.log('   2. 运行生产环境爬虫，自动上传映射文件')
    console.log('   3. 访问 Dashboard 查看映射管理功能')
    process.exit(0)
  }
  else {
    console.log('\n❌ 部分测试失败，请检查配置和实现')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('❌ 测试运行失败:', e)
  process.exit(1)
})
