#!/usr/bin/env node --import tsx
/**
 * 快速验证 R2 映射文件上传功能
 *
 * 用途：验证 MappingFileManager 是否能正确上传文件到 R2
 */

import process from 'node:process'
import 'dotenv/config'

async function main() {
  console.log('🚀 验证 R2 映射文件上传功能\n')

  // 检查环境变量
  const required = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    console.error('❌ 缺少必需的环境变量:')
    for (const key of missing) {
      console.error(`   - ${key}`)
    }
    console.error('\n请在 packages/crawler/.env 中配置这些变量')
    process.exit(1)
  }

  const r2Config = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucketName: process.env.R2_BUCKET_NAME!,
    publicUrl: process.env.R2_PUBLIC_URL || 'https://cdn.starye.com',
  }

  console.log('📋 R2 配置:')
  console.log(`   Account ID: ${r2Config.accountId.substring(0, 8)}...`)
  console.log(`   Bucket: ${r2Config.bucketName}`)
  console.log(`   Public URL: ${r2Config.publicUrl}`)
  console.log()

  try {
    // 动态导入 MappingFileManager
    const { MappingFileManager } = await import('../src/lib/mapping-file-manager.js')
    const manager = new MappingFileManager(r2Config)

    // 创建测试数据
    const testData = {
      actorNameMap: {
        测试女优1: {
          javbusName: '测试女优1',
          wikiName: '測試女優1',
          wikiUrl: 'https://seesaawiki.jp/w/sougouwiki/d/%E6%B8%AC%E8%A9%A6%E5%A5%B3%E5%84%AA1',
          lastUpdated: Math.floor(Date.now() / 1000),
        },
      },
      unmappedActors: [
        {
          javbusName: '未知女优测试',
          attempts: ['cache', 'exact', 'index'],
          lastAttempt: Math.floor(Date.now() / 1000),
        },
      ],
    }

    console.log('📤 开始上传测试数据...')
    await manager.uploadAllMappings(testData)

    console.log('\n✅ 验证成功！R2 映射文件上传功能正常')
    console.log('\n📝 下一步：')
    console.log('   1. 在 .env 中设置 UPLOAD_MAPPINGS_TO_R2=true')
    console.log('   2. 运行女优爬虫：MAX_ACTORS=10 pnpm crawl:actor')
    console.log('   3. 检查日志确认 "✅ 映射文件已上传到 R2"')
    console.log('   4. 访问 Dashboard 验证数据可见')

    process.exit(0)
  }
  catch (e: any) {
    console.error('\n❌ 验证失败:', e.message)
    console.error('\n请检查：')
    console.error('   1. R2 配置是否正确')
    console.error('   2. R2 访问密钥是否有效')
    console.error('   3. 网络连接是否正常')
    process.exit(1)
  }
}

main()
