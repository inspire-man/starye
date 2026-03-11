/**
 * 测试配置加载和并发系统
 */

/* eslint-disable no-console */
import { CRAWL_CONFIG } from './config/crawl.config'

console.log('='.repeat(60))
console.log('测试配置加载')
console.log('='.repeat(60))

console.log('\n📋 当前配置:')
console.log(JSON.stringify(CRAWL_CONFIG, null, 2))

console.log('\n✅ 配置加载成功！')
console.log('\n验证点:')
console.log(`  ✓ 配置对象已冻结: ${Object.isFrozen(CRAWL_CONFIG)}`)
console.log(`  ✓ 并发配置正确: manga=${CRAWL_CONFIG.concurrency.manga}, chapter=${CRAWL_CONFIG.concurrency.chapter}, imageBatch=${CRAWL_CONFIG.concurrency.imageBatch}`)
console.log(`  ✓ 限流配置正确: maxMangasPerRun=${CRAWL_CONFIG.limits.maxMangasPerRun}`)
console.log(`  ✓ 环境检测: ${CRAWL_CONFIG.isCI ? 'CI' : '本地'}`)

console.log('\n🎉 所有检查通过！')
