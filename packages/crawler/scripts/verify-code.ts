/* eslint-disable node/prefer-global/process */
/**
 * 代码验证脚本 - 验证所有新增代码的完整性
 * 运行: pnpm tsx scripts/verify-code.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

interface TestResult {
  name: string
  passed: boolean
  message: string
}

const results: TestResult[] = []

function test(name: string, fn: () => boolean, message: string = ''): void {
  try {
    const passed = fn()
    results.push({ name, passed, message: passed ? '✅ 通过' : `❌ 失败: ${message}` })
  }
  catch (error) {
    results.push({ name, passed: false, message: `❌ 错误: ${error instanceof Error ? error.message : String(error)}` })
  }
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), '../..', filePath))
}

function fileContains(filePath: string, content: string): boolean {
  if (!fileExists(filePath)) {
    return false
  }
  const fullPath = path.join(process.cwd(), '../..', filePath)
  const fileContent = fs.readFileSync(fullPath, 'utf-8')
  return fileContent.includes(content)
}

console.log('========================================')
console.log('🔍 Actor/Publisher Crawler 代码验证')
console.log('========================================\n')

// 测试 1: 文件存在性检查
console.log('📁 测试 1: 文件存在性检查')
console.log('----------------------------------------')

test('ActorCrawler 文件存在', () =>
  fileExists('packages/crawler/src/crawlers/actor-crawler.ts'))

test('PublisherCrawler 文件存在', () =>
  fileExists('packages/crawler/src/crawlers/publisher-crawler.ts'))

test('run-actor 脚本存在', () =>
  fileExists('packages/crawler/scripts/run-actor.ts'))

test('run-publisher 脚本存在', () =>
  fileExists('packages/crawler/scripts/run-publisher.ts'))

// 测试 2: API Client 方法检查
console.log('\n📡 测试 2: ApiClient 方法检查')
console.log('----------------------------------------')

test('ApiClient.fetchPendingActors 存在', () =>
  fileContains('packages/crawler/src/utils/api-client.ts', 'fetchPendingActors'))

test('ApiClient.batchQueryActorStatus 存在', () =>
  fileContains('packages/crawler/src/utils/api-client.ts', 'batchQueryActorStatus'))

test('ApiClient.syncActorDetails 存在', () =>
  fileContains('packages/crawler/src/utils/api-client.ts', 'syncActorDetails'))

test('ApiClient.fetchPendingPublishers 存在', () =>
  fileContains('packages/crawler/src/utils/api-client.ts', 'fetchPendingPublishers'))

test('ApiClient.batchSyncActors 存在', () =>
  fileContains('packages/crawler/src/utils/api-client.ts', 'batchSyncActors'))

test('ApiClient.batchSyncPublishers 存在', () =>
  fileContains('packages/crawler/src/utils/api-client.ts', 'batchSyncPublishers'))

// 测试 3: API Schema 检查
console.log('\n📝 测试 3: API Schema 检查')
console.log('----------------------------------------')

test('BatchQueryActorStatusSchema 存在', () =>
  fileContains('apps/api/src/schemas/admin.ts', 'BatchQueryActorStatusSchema'))

test('GetPendingActorsQuerySchema 存在', () =>
  fileContains('apps/api/src/schemas/admin.ts', 'GetPendingActorsQuerySchema'))

test('SyncActorDetailsSchema 存在', () =>
  fileContains('apps/api/src/schemas/admin.ts', 'SyncActorDetailsSchema'))

test('BatchSyncActorsSchema 存在', () =>
  fileContains('apps/api/src/schemas/admin.ts', 'BatchSyncActorsSchema'))

test('BatchSyncPublishersSchema 存在', () =>
  fileContains('apps/api/src/schemas/admin.ts', 'BatchSyncPublishersSchema'))

// 测试 4: API 路由检查
console.log('\n🛣️  测试 4: API 路由检查')
console.log('----------------------------------------')

test('Actors /batch-status 端点存在', () =>
  fileContains('apps/api/src/routes/admin/actors/index.ts', '/batch-status'))

test('Actors /pending 端点存在', () =>
  fileContains('apps/api/src/routes/admin/actors/index.ts', '/pending'))

test('Actors /:id/details 端点存在', () =>
  fileContains('apps/api/src/routes/admin/actors/index.ts', '/:id/details'))

test('Actors /batch-sync 端点存在', () =>
  fileContains('apps/api/src/routes/admin/actors/index.ts', '/batch-sync'))

test('Publishers /batch-status 端点存在', () =>
  fileContains('apps/api/src/routes/admin/publishers/index.ts', '/batch-status'))

test('Publishers /batch-sync 端点存在', () =>
  fileContains('apps/api/src/routes/admin/publishers/index.ts', '/batch-sync'))

// 测试 5: 爬虫核心功能检查
console.log('\n🕷️  测试 5: 爬虫核心功能检查')
console.log('----------------------------------------')

test('ActorCrawler.processActor 方法存在', () =>
  fileContains('packages/crawler/src/crawlers/actor-crawler.ts', 'processActor'))

test('ActorCrawler.calculateCompleteness 方法存在', () =>
  fileContains('packages/crawler/src/crawlers/actor-crawler.ts', 'calculateCompleteness'))

test('ActorCrawler.sortByPriority 方法存在', () =>
  fileContains('packages/crawler/src/crawlers/actor-crawler.ts', 'sortByPriority'))

test('PublisherCrawler.processPublisher 方法存在', () =>
  fileContains('packages/crawler/src/crawlers/publisher-crawler.ts', 'processPublisher'))

test('PublisherCrawler.calculateCompleteness 方法存在', () =>
  fileContains('packages/crawler/src/crawlers/publisher-crawler.ts', 'calculateCompleteness'))

// 测试 6: 电影爬虫改造检查
console.log('\n🎬 测试 6: 电影爬虫改造检查')
console.log('----------------------------------------')

test('JavBusCrawler.collectedActorDetails 属性存在', () =>
  fileContains('packages/crawler/src/crawlers/javbus.ts', 'collectedActorDetails'))

test('JavBusCrawler.collectedPublisherUrls 属性存在', () =>
  fileContains('packages/crawler/src/crawlers/javbus.ts', 'collectedPublisherUrls'))

test('JavBusCrawler.syncActorsAndPublishers 方法存在', () =>
  fileContains('packages/crawler/src/crawlers/javbus.ts', 'syncActorsAndPublishers'))

// 测试 7: npm scripts 检查
console.log('\n📦 测试 7: npm scripts 检查')
console.log('----------------------------------------')

test('crawl:actor script 存在', () =>
  fileContains('packages/crawler/package.json', 'crawl:actor'))

test('crawl:publisher script 存在', () =>
  fileContains('packages/crawler/package.json', 'crawl:publisher'))

// 输出结果
console.log('\n========================================')
console.log('📊 测试结果汇总')
console.log('========================================\n')

const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length
const total = results.length

console.log(`总计: ${total} 个测试`)
console.log(`通过: ${passed} ✅`)
console.log(`失败: ${failed} ❌`)
console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%\n`)

if (failed > 0) {
  console.log('失败的测试:')
  results.filter(r => !r.passed).forEach((r) => {
    console.log(`  ${r.name}: ${r.message}`)
  })
  console.log()
  process.exit(1)
}
else {
  console.log('🎉 所有测试通过！')
  console.log('\n下一步:')
  console.log('  1. 启动 API 服务: cd apps/api && pnpm dev')
  console.log('  2. 运行女优爬虫: cd packages/crawler && pnpm crawl:actor')
  console.log('  3. 运行厂商爬虫: cd packages/crawler && pnpm crawl:publisher')
  console.log()
  process.exit(0)
}
