/**
 * 优化爬虫测试脚本 - 重构版
 */

import type { JavBusCrawlerConfig } from '../src/crawlers/javbus'
import process from 'node:process'
import { JavBusCrawler } from '../src/crawlers/javbus'

async function main() {
  // 从环境变量读取配置
  const config: JavBusCrawlerConfig = {
    r2: {
      accountId: process.env.R2_ACCOUNT_ID || '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucketName: process.env.R2_BUCKET_NAME || '',
      publicUrl: process.env.R2_PUBLIC_DOMAIN || '',
    },
    api: {
      url: process.env.API_URL || 'http://localhost:3000',
      token: process.env.CRAWLER_SECRET || '',
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

    // 爬虫配置
    limits: {
      maxMovies: Number.parseInt(process.env.MAX_MOVIES || '50'),
      maxPages: Number.parseInt(process.env.MAX_PAGES || '5'),
    },

    // 并发配置
    concurrency: {
      listPage: Number.parseInt(process.env.LIST_CONCURRENCY || '1'),
      detailPage: Number.parseInt(process.env.DETAIL_CONCURRENCY || '2'),
      image: Number.parseInt(process.env.IMAGE_CONCURRENCY || '3'),
      api: Number.parseInt(process.env.API_CONCURRENCY || '2'),
    },

    // 延迟配置（毫秒）
    delay: {
      listPage: Number.parseInt(process.env.LIST_DELAY || '8000'),
      detailPage: Number.parseInt(process.env.DETAIL_DELAY || '5000'),
      image: Number.parseInt(process.env.IMAGE_DELAY || '2000'),
      api: Number.parseInt(process.env.API_DELAY || '1000'),
    },

    // 显示配置
    options: {
      showProgress: process.env.SHOW_PROGRESS !== 'false',
      showStats: process.env.SHOW_STATS !== 'false',
      statsInterval: Number.parseInt(process.env.STATS_INTERVAL || '30000'),
    },

    // 镜像配置
    useRandomMirror: process.env.USE_RANDOM_MIRROR === 'true',
    startUrl: process.env.START_URL,
  }

  console.log('🚀 启动优化爬虫测试')
  console.log('📊 配置信息:')
  console.log(`  最大影片数: ${config.limits?.maxMovies}`)
  console.log(`  最大页数: ${config.limits?.maxPages}`)
  console.log(`  列表页并发: ${config.concurrency?.listPage}`)
  console.log(`  详情页并发: ${config.concurrency?.detailPage}`)
  console.log(`  图片并发: ${config.concurrency?.image}`)
  console.log(`  API 并发: ${config.concurrency?.api}`)
  console.log(`  列表页延迟: ${config.delay?.listPage}ms`)
  console.log(`  详情页延迟: ${config.delay?.detailPage}ms`)
  console.log(`  使用代理: ${config.proxy ? config.proxy.server : '否'}`)
  console.log(`  随机镜像: ${config.useRandomMirror ? '是' : '否'}`)

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
    console.log('\n✅ 爬虫运行完成')
    process.exit(0)
  }
  catch (error) {
    console.error('\n❌ 爬虫运行失败:', error)
    process.exit(1)
  }
}

main()
