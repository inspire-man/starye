/**
 * 厂商详情爬虫启动脚本
 */

import type { PublisherCrawlerConfig } from '../src/crawlers/publisher-crawler'
import process from 'node:process'
import { PublisherCrawler } from '../src/crawlers/publisher-crawler'
import 'dotenv/config'

async function main() {
  // 从环境变量读取配置
  const config: PublisherCrawlerConfig = {
    browserConfig: {
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
    },
    apiConfig: {
      url: process.env.API_URL || 'http://localhost:3000',
      token: process.env.CRAWLER_SECRET || '',
      timeout: Number.parseInt(process.env.API_TIMEOUT || '60000'),
    },
    maxPublishers: Number.parseInt(process.env.MAX_PUBLISHERS || '150'),
    concurrency: Number.parseInt(process.env.PUBLISHER_CONCURRENCY || '2'),
    delay: Number.parseInt(process.env.PUBLISHER_DELAY || '8000'),
    recoveryMode: process.env.RECOVERY_MODE === 'true',
  }

  console.log('🏢 启动厂商详情爬虫')
  console.log('📊 配置信息:')
  console.log(`  最大厂商数: ${config.maxPublishers}`)
  console.log(`  并发数: ${config.concurrency}`)
  console.log(`  延迟: ${config.delay}ms`)
  console.log(`  API URL: ${config.apiConfig.url}`)
  console.log(`  恢复模式: ${config.recoveryMode ? '是' : '否'}`)
  console.log(`  使用代理: ${config.browserConfig.proxy ? config.browserConfig.proxy.server : '否'}`)
  console.log()

  // 创建并运行爬虫
  const crawler = new PublisherCrawler(config)

  try {
    await crawler.run()
    console.log('\n✅ 厂商爬虫运行完成')
    process.exit(0)
  }
  catch (error) {
    console.error('\n❌ 厂商爬虫运行失败:', error)
    process.exit(1)
  }
}

main()
