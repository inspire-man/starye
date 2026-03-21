#!/usr/bin/env tsx
/**
 * 配置检查脚本 - 验证环境变量是否正确加载
 */

import process from 'node:process'
import 'dotenv/config'

console.log('🔍 环境变量配置检查')
console.log('='.repeat(80))

const config = {
  r2: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
  },
  api: {
    url: process.env.API_URL,
    token: process.env.CRAWLER_SECRET,
  },
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  },
}

console.log('\n【R2 配置】')
console.log(`  CLOUDFLARE_ACCOUNT_ID: ${config.r2.accountId ? '✅ 已设置' : '❌ 未设置'}`)
console.log(`  R2_ACCESS_KEY_ID: ${config.r2.accessKeyId ? '✅ 已设置' : '❌ 未设置'}`)
console.log(`  R2_SECRET_ACCESS_KEY: ${config.r2.secretAccessKey ? '✅ 已设置' : '❌ 未设置'}`)
console.log(`  R2_BUCKET_NAME: ${config.r2.bucketName || '❌ 未设置'}`)
console.log(`  R2_PUBLIC_URL: ${config.r2.publicUrl || '❌ 未设置'}`)

console.log('\n【API 配置】')
console.log(`  API_URL: ${config.api.url || '❌ 未设置'}`)
console.log(`  CRAWLER_SECRET: ${config.api.token ? '✅ 已设置' : '❌ 未设置'}`)

console.log('\n【Puppeteer 配置】')
console.log(`  PUPPETEER_EXECUTABLE_PATH: ${config.puppeteer.executablePath || '❌ 未设置'}`)

// 计算 R2 endpoint
if (config.r2.accountId) {
  console.log('\n【R2 Endpoint】')
  console.log(`  https://${config.r2.accountId}.r2.cloudflarestorage.com`)
}
else {
  console.log('\n❌ 错误：CLOUDFLARE_ACCOUNT_ID 未设置，无法构建 R2 endpoint')
  console.log('   这会导致 DNS 解析失败：getaddrinfo ENOTFOUND .r2.cloudflarestorage.com')
}

console.log(`\n${'='.repeat(80)}`)
console.log('💡 提示：')
console.log('  - 确保 packages/crawler/.env 文件存在并包含所有必需的配置')
console.log('  - 如果配置缺失，请从 apps/api/.dev.vars 复制 R2 相关配置')
console.log('='.repeat(80))

// 检查配置完整性
const requiredConfigs = [
  { key: 'CLOUDFLARE_ACCOUNT_ID', value: config.r2.accountId },
  { key: 'R2_ACCESS_KEY_ID', value: config.r2.accessKeyId },
  { key: 'R2_SECRET_ACCESS_KEY', value: config.r2.secretAccessKey },
  { key: 'R2_BUCKET_NAME', value: config.r2.bucketName },
  { key: 'R2_PUBLIC_URL', value: config.r2.publicUrl },
  { key: 'API_URL', value: config.api.url },
  { key: 'CRAWLER_SECRET', value: config.api.token },
]

const missingConfigs = requiredConfigs.filter(c => !c.value)

if (missingConfigs.length > 0) {
  console.log('\n❌ 缺少以下必需的配置项：')
  missingConfigs.forEach(c => console.log(`  - ${c.key}`))
  process.exit(1)
}
else {
  console.log('\n✅ 所有必需的配置项都已设置！')
  process.exit(0)
}
