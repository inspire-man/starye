#!/usr/bin/env tsx
/**
 * 测试单个影片爬取
 * 用于诊断为什么数据没有图片/女优/厂商
 */

import process from 'node:process'
import { ImageProcessor } from '../src/lib/image-processor'
import { JavBusStrategy } from '../src/strategies/javbus'
import { ApiClient } from '../src/utils/api-client'
import { BrowserManager } from '../src/utils/browser'
import 'dotenv/config'

async function main() {
  const testUrl = process.argv[2] || 'https://www.javbus.com/SONE-001'

  console.log('🔍 测试单个影片爬取')
  console.log('='.repeat(80))
  console.log(`测试 URL: ${testUrl}`)
  console.log('='.repeat(80))

  // 检查环境变量
  console.log('\n【环境变量检查】')
  console.log(`CLOUDFLARE_ACCOUNT_ID: ${process.env.CLOUDFLARE_ACCOUNT_ID ? '✅ 已设置' : '❌ 未设置'}`)
  console.log(`R2_ACCESS_KEY_ID: ${process.env.R2_ACCESS_KEY_ID ? '✅ 已设置' : '❌ 未设置'}`)
  console.log(`R2_SECRET_ACCESS_KEY: ${process.env.R2_SECRET_ACCESS_KEY ? '✅ 已设置' : '❌ 未设置'}`)
  console.log(`R2_BUCKET_NAME: ${process.env.R2_BUCKET_NAME || '❌ 未设置'}`)
  console.log(`R2_PUBLIC_URL: ${process.env.R2_PUBLIC_URL || '❌ 未设置'}`)
  console.log(`API_URL: ${process.env.API_URL || 'http://localhost:3000'}`)
  console.log(`CRAWLER_SECRET: ${process.env.CRAWLER_SECRET ? '✅ 已设置' : '❌ 未设置'}`)

  // 初始化工具
  const browserManager = new BrowserManager({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  }, undefined)
  const strategy = new JavBusStrategy()

  const r2Config = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || '',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  }

  const imageProcessor = new ImageProcessor(r2Config)

  const apiClient = new ApiClient({
    url: process.env.API_URL || 'http://localhost:3000',
    token: process.env.CRAWLER_SECRET || '',
  })

  await browserManager.launch()

  try {
    const page = await browserManager.createPage()

    // 步骤 1: 爬取影片信息
    console.log('\n【步骤 1: 爬取影片信息】')
    const movieInfo = await strategy.getMovieInfo(testUrl, page)

    if (!movieInfo) {
      console.error('❌ 爬取失败')
      return
    }

    console.log('✅ 爬取成功')
    console.log(`  标题: ${movieInfo.title}`)
    console.log(`  代码: ${movieInfo.code}`)
    console.log(`  封面: ${movieInfo.coverImage?.substring(0, 80)}...`)
    console.log(`  厂商: ${movieInfo.publisher}`)

    // 检查 actors 和 actorDetails
    console.log('\n【女优数据】')
    if (movieInfo.actors && movieInfo.actors.length > 0) {
      console.log(`✅ actors 数组 (${movieInfo.actors.length}):`)
      movieInfo.actors.slice(0, 3).forEach(a => console.log(`    - ${a}`))
    }
    else {
      console.log('❌ actors 数组为空')
    }

    if (movieInfo.actorDetails && movieInfo.actorDetails.length > 0) {
      console.log(`✅ actorDetails 数组 (${movieInfo.actorDetails.length}):`)
      movieInfo.actorDetails.slice(0, 3).forEach(a => console.log(`    - ${a.name} (${a.url})`))
    }
    else {
      console.log('❌ actorDetails 数组为空')
    }

    // 检查 publisher 和 publisherUrl
    console.log('\n【厂商数据】')
    console.log(`publisher: ${movieInfo.publisher || '❌ 空'}`)
    console.log(`publisherUrl: ${movieInfo.publisherUrl || '❌ 空'}`)

    await page.close()

    // 步骤 2: 测试图片上传 (如果 R2 配置齐全)
    if (r2Config.accountId && r2Config.accessKeyId && r2Config.secretAccessKey) {
      console.log('\n【步骤 2: 测试图片上传】')
      try {
        const keyPrefix = `movies/${movieInfo.code}`
        const results = await imageProcessor.process(
          movieInfo.coverImage!,
          keyPrefix,
          'cover',
        )

        console.log('✅ 图片上传成功:')
        results.forEach((r) => {
          console.log(`  ${r.variant}: ${r.url}`)
        })

        // 更新 coverImage 为 R2 URL
        const previewImage = results.find(r => r.variant === 'preview')
        if (previewImage) {
          movieInfo.coverImage = previewImage.url
          console.log(`  使用 preview 图片: ${previewImage.url}`)
        }
      }
      catch (error) {
        console.error('❌ 图片上传失败:', error instanceof Error ? error.message : String(error))
      }
    }
    else {
      console.log('\n【步骤 2: 跳过图片上传】')
      console.log('⚠️  R2 配置不完整，跳过图片上传测试')
    }

    // 步骤 3: 测试 API 同步
    console.log('\n【步骤 3: 测试 API 同步】')
    try {
      const result = await apiClient.syncMovie(movieInfo)
      if (result) {
        console.log('✅ API 同步成功')
        console.log(`  返回: ${JSON.stringify(result, null, 2)}`)
      }
      else {
        console.log('❌ API 同步失败：返回 null')
      }
    }
    catch (error) {
      console.error('❌ API 同步失败:', error instanceof Error ? error.message : String(error))
    }

    // 步骤 4: 验证数据库
    console.log('\n【步骤 4: 验证数据库】')
    console.log('请手动检查:')
    console.log(`  1. 访问 API: http://localhost:3000/api/movies?search=${movieInfo.code}`)
    console.log(`  2. 检查 actors 字段是否有对象数组（不是 string[]）`)
    console.log(`  3. 检查 publishers 字段是否有对象数组`)
    console.log(`  4. 检查 coverImage 是否是 R2 URL`)

    console.log(`\n${'='.repeat(80)}`)
    console.log('✅ 测试完成')
    console.log('='.repeat(80))
  }
  finally {
    await browserManager.close()
  }
}

main().catch((error) => {
  console.error('❌ 测试失败:', error)
  process.exit(1)
})
