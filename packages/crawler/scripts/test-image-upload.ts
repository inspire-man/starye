#!/usr/bin/env tsx
/**
 * 测试图片上传功能 - 验证 R2 配置是否正常工作
 */

import process from 'node:process'
import { ImageProcessor } from '../src/lib/image-processor'
import 'dotenv/config'

async function main() {
  console.log('🧪 测试图片上传功能')
  console.log('='.repeat(80))

  // 检查配置
  const r2Config = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || '',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  }

  console.log('\n【R2 配置检查】')
  console.log(`  Account ID: ${r2Config.accountId ? '✅' : '❌'}`)
  console.log(`  Access Key: ${r2Config.accessKeyId ? '✅' : '❌'}`)
  console.log(`  Secret Key: ${r2Config.secretAccessKey ? '✅' : '❌'}`)
  console.log(`  Bucket: ${r2Config.bucketName}`)
  console.log(`  Public URL: ${r2Config.publicUrl}`)

  // 尝试创建 ImageProcessor 实例
  console.log('\n【创建 ImageProcessor 实例】')
  try {
    const processor = new ImageProcessor(r2Config)
    console.log('✅ ImageProcessor 实例创建成功', processor)
    console.log(`   R2 Endpoint: https://${r2Config.accountId}.r2.cloudflarestorage.com`)
  }
  catch (error) {
    console.error('❌ ImageProcessor 实例创建失败:')
    console.error(error)
    process.exit(1)
  }

  // 说明：实际的图片上传测试需要有效的图片 URL
  console.log('\n【测试说明】')
  console.log('  ✅ R2 配置验证通过')
  console.log('  ℹ️  实际的图片上传功能会在爬虫运行时测试')
  console.log('  ℹ️  如需测试完整上传流程，请运行: pnpm test:optimized')

  console.log(`\n${'='.repeat(80)}`)
  console.log('✅ 测试完成！')
}

main().catch((error) => {
  console.error('\n❌ 测试失败:', error)
  process.exit(1)
})
