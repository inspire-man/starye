#!/usr/bin/env tsx
/**
 * 完整流程测试
 * 爬取 2-3 部影片，验证图片、女优、厂商都正确保存
 */

import type { JavBusCrawlerConfig } from '../src/crawlers/javbus'
import process from 'node:process'
import { JavBusCrawler } from '../src/crawlers/javbus'
import 'dotenv/config'

async function main() {
  console.log('🧪 完整流程测试')
  console.log('='.repeat(80))
  console.log('目标：爬取 3 部影片，验证图片、女优、厂商都正确保存')
  console.log('='.repeat(80))

  // 检查环境变量
  console.log('\n【环境变量检查】')
  const envCheck = {
    CLOUDFLARE_ACCOUNT_ID: !!process.env.CLOUDFLARE_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME,
    R2_PUBLIC_URL: !!process.env.R2_PUBLIC_URL,
    API_URL: !!process.env.API_URL,
    CRAWLER_SECRET: !!process.env.CRAWLER_SECRET,
  }

  Object.entries(envCheck).forEach(([key, value]) => {
    console.log(`  ${key}: ${value ? '✅' : '❌'}`)
  })

  const missingVars = Object.entries(envCheck).filter(([_, v]) => !v).map(([k]) => k)
  if (missingVars.length > 0) {
    console.error(`\n❌ 缺少必需的环境变量: ${missingVars.join(', ')}`)
    console.error('请检查 .env.local 文件')
    process.exit(1)
  }

  // 配置爬虫
  const config: JavBusCrawlerConfig = {
    r2: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucketName: process.env.R2_BUCKET_NAME!,
      publicUrl: process.env.R2_PUBLIC_URL!,
    },
    api: {
      url: process.env.API_URL || 'http://localhost:8787',
      token: process.env.CRAWLER_SECRET!,
      timeout: 90000, // 增加超时到 90 秒
    },
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    },
    proxy: process.env.PROXY_SERVER
      ? {
          server: process.env.PROXY_SERVER,
          username: process.env.PROXY_USERNAME,
          password: process.env.PROXY_PASSWORD,
        }
      : undefined,

    // 限制为 3 部影片，1 页
    limits: {
      maxMovies: 3,
      maxPages: 1,
    },

    // 并发配置（保守）
    concurrency: {
      listPage: 1,
      detailPage: 1,
      image: 2,
      api: 1,
    },

    // 延迟配置（较长，避免封禁）
    delay: {
      listPage: 5000,
      detailPage: 5000,
      image: 2000,
      api: 2000,
    },

    // 显示详细信息
    options: {
      showProgress: true,
      showStats: true,
      statsInterval: 10000,
    },

    useRandomMirror: false,
    startUrl: 'https://www.javbus.com',
  }

  console.log('\n【爬虫配置】')
  console.log(`  最大影片数: ${config.limits?.maxMovies}`)
  console.log(`  最大页数: ${config.limits?.maxPages}`)
  console.log(`  R2 公共 URL: ${config.r2.publicUrl}`)
  console.log(`  API URL: ${config.api.url}`)
  console.log(`  API 超时: ${config.api.timeout}ms`)

  console.log('\n【开始爬取】')
  console.log('='.repeat(80))

  const crawler = new JavBusCrawler(config)

  // 处理退出信号
  const cleanup = async () => {
    console.log('\n\n⚠️  收到退出信号，正在清理...')
    await crawler.cleanup()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  try {
    await crawler.run()

    const stats = crawler.getStats()

    console.log(`\n${'='.repeat(80)}`)
    console.log('📊 测试结果')
    console.log('='.repeat(80))
    console.log(`  找到影片: ${stats.moviesFound}`)
    console.log(`  处理成功: ${stats.moviesSuccess}`)
    console.log(`  处理失败: ${stats.moviesFailed}`)
    console.log(`  图片下载: ${stats.imagesDownloaded}`)
    console.log(`  API 同步: ${stats.apiSynced}`)
    console.log('='.repeat(80))

    if (stats.moviesSuccess >= 3) {
      console.log('\n✅ 测试通过！')
      console.log('\n请验证:')
      console.log('  1. 访问 http://localhost:8787/api/movies')
      console.log('  2. 检查最新的 3 部影片')
      console.log('  3. 验证 coverImage 是 R2 URL（https://cdn.starye.org/...）')
      console.log('  4. 验证 actors 和 publishers 是对象数组')
    }
    else {
      console.log(`\n⚠️  测试未达到预期（期望 3 部，实际 ${stats.moviesSuccess} 部）`)
    }

    process.exit(0)
  }
  catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

main()
