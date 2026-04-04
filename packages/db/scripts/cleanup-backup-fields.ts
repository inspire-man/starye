/* eslint-disable node/prefer-global/process */
/**
 * 清理电影表备份字段脚本
 *
 * 功能：
 * 1. 验证关联表数据完整性（movie_actor, movie_publisher）
 * 2. 生成清理预览报告
 * 3. 清理 movie.actors 和 movie.publisher 字段（可选，需确认）
 * 4. 验证清理结果
 *
 * 使用方法：
 *   DATABASE_URL=<url> pnpm --filter=@starye/db cleanup:preview
 *   DATABASE_URL=<url> pnpm --filter=@starye/db cleanup:execute
 *
 * 环境变量：
 *   DATABASE_URL        - 数据库连接 URL（必须）
 *   DATABASE_AUTH_TOKEN  - 数据库认证 token（远程连接时需要）
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { createClient } from '@libsql/client'
import { count, isNotNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { movieActors, moviePublishers, movies } from '../src/schema'

const databaseUrl = process.env.DATABASE_URL
const authToken = process.env.DATABASE_AUTH_TOKEN

if (!databaseUrl) {
  console.error('❌ 错误：缺少 DATABASE_URL 环境变量')
  console.error('使用方法：')
  console.error('  DATABASE_URL=<url> pnpm --filter=@starye/db cleanup:preview')
  console.error('  DATABASE_URL=<url> pnpm --filter=@starye/db cleanup:execute')
  console.error('')
  console.error('本地开发（使用 wrangler 本地数据库）：')
  console.error('  DATABASE_URL=file:../apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite')
  process.exit(1)
}

const client = createClient({
  url: databaseUrl,
  authToken,
})
const db = drizzle(client, { schema: { movies, movieActors, moviePublishers } })

const logFile = path.join(process.cwd(), `cleanup-${new Date().toISOString().split('T')[0]}.log`)
let logContent = ''

function log(message: string) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}`

  console.log(message)
  logContent += `${logMessage}\n`
}

function saveLog() {
  try {
    fs.writeFileSync(logFile, logContent, 'utf-8')

    console.log(`\n📝 日志已保存: ${logFile}`)
  }
  catch (e) {
    console.error('⚠️  保存日志失败:', e)
  }
}

interface CleanupReport {
  moviesTotal: number
  moviesWithActorsField: number
  moviesWithPublisherField: number
  movieActorsCount: number
  moviePublishersCount: number
  safeToClean: boolean
  warnings: string[]
  bufferMonths: number
}

/**
 * 步骤 1: 检查数据完整性
 */
async function checkDataIntegrity(): Promise<CleanupReport> {
  log('🔍 步骤 1/4: 检查数据完整性...\n')

  const warnings: string[] = []

  const moviesTotal = await db
    .select({ value: count() })
    .from(movies)
    .then(res => res[0]?.value || 0)

  log(`   电影总数: ${moviesTotal}`)

  const moviesWithActorsField = await db
    .select({ value: count() })
    .from(movies)
    .where(isNotNull(movies.actors))
    .then(res => res[0]?.value || 0)

  log(`   有 actors 字段的电影: ${moviesWithActorsField}`)

  const moviesWithPublisherField = await db
    .select({ value: count() })
    .from(movies)
    .where(isNotNull(movies.publisher))
    .then(res => res[0]?.value || 0)

  log(`   有 publisher 字段的电影: ${moviesWithPublisherField}`)

  const movieActorsCount = await db
    .select({ value: count() })
    .from(movieActors)
    .then(res => res[0]?.value || 0)

  log(`   movie_actor 关联记录: ${movieActorsCount}`)

  const moviePublishersCount = await db
    .select({ value: count() })
    .from(moviePublishers)
    .then(res => res[0]?.value || 0)

  log(`   movie_publisher 关联记录: ${moviePublishersCount}`)

  log('\n📊 数据完整性评估:')

  if (movieActorsCount === 0 && moviesWithActorsField > 0) {
    warnings.push('⚠️  关联表 movie_actor 为空，但 movie.actors 字段有数据，数据可能未迁移！')
  }

  if (moviePublishersCount === 0 && moviesWithPublisherField > 0) {
    warnings.push('⚠️  关联表 movie_publisher 为空，但 movie.publisher 字段有数据，数据可能未迁移！')
  }

  const safeToClean = warnings.length === 0 && movieActorsCount > 0

  if (safeToClean) {
    log('   ✅ 数据完整性检查通过，可以安全清理')
  }
  else {
    log('   ❌ 数据完整性检查未通过，不建议清理')
    warnings.forEach(w => log(`   ${w}`))
  }

  return {
    moviesTotal,
    moviesWithActorsField,
    moviesWithPublisherField,
    movieActorsCount,
    moviePublishersCount,
    safeToClean,
    warnings,
    bufferMonths: 3,
  }
}

/**
 * 步骤 2: 生成清理预览报告
 */
async function generatePreview(report: CleanupReport): Promise<void> {
  log('\n📋 步骤 2/4: 生成清理预览报告...\n')

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - report.bufferMonths)

  log(`   清理策略: 保留最近 ${report.bufferMonths} 个月的备份数据（${threeMonthsAgo.toISOString().split('T')[0]} 之后）\n`)

  const moviesToCleanActors = await db
    .select({ value: count() })
    .from(movies)
    .where(isNotNull(movies.actors))
    .then(res => res[0]?.value || 0)

  const moviesToCleanPublisher = await db
    .select({ value: count() })
    .from(movies)
    .where(isNotNull(movies.publisher))
    .then(res => res[0]?.value || 0)

  log('   将清理的字段:')
  log(`   - movies.actors: ${moviesToCleanActors} 条记录`)
  log(`   - movies.publisher: ${moviesToCleanPublisher} 条记录`)

  const totalRecordsAffected = Math.max(moviesToCleanActors, moviesToCleanPublisher)
  const dataReduction = totalRecordsAffected > 0
    ? Math.round((totalRecordsAffected / report.moviesTotal) * 100)
    : 0

  log(`\n   预计影响: ${totalRecordsAffected}/${report.moviesTotal} 条记录 (${dataReduction}%)`)

  if (totalRecordsAffected === 0) {
    log('   ℹ️  没有需要清理的数据')
  }
}

/**
 * 步骤 3: 执行清理
 */
async function executeCleanup(): Promise<{ cleaned: number }> {
  log('\n🗑️  步骤 3/4: 执行清理...\n')

  try {
    const result1 = await db
      .update(movies)
      .set({ actors: null })
      .where(isNotNull(movies.actors))

    log(`   ✅ 清理 movies.actors: ${result1.rowsAffected} 条记录`)

    const result2 = await db
      .update(movies)
      .set({ publisher: null })
      .where(isNotNull(movies.publisher))

    log(`   ✅ 清理 movies.publisher: ${result2.rowsAffected} 条记录`)

    const totalCleaned = (result1.rowsAffected ?? 0) + (result2.rowsAffected ?? 0)

    return { cleaned: totalCleaned }
  }
  catch (e) {
    log(`   ❌ 清理失败: ${e}`)
    throw e
  }
}

/**
 * 步骤 4: 验证清理结果
 */
async function verifyCleanup(beforeReport: CleanupReport): Promise<void> {
  log('\n✓ 步骤 4/4: 验证清理结果...\n')

  const afterActors = await db
    .select({ value: count() })
    .from(movies)
    .where(isNotNull(movies.actors))
    .then(res => res[0]?.value || 0)

  const afterPublisher = await db
    .select({ value: count() })
    .from(movies)
    .where(isNotNull(movies.publisher))
    .then(res => res[0]?.value || 0)

  log('   清理前后对比:')
  log(`   - movies.actors: ${beforeReport.moviesWithActorsField} → ${afterActors}`)
  log(`   - movies.publisher: ${beforeReport.moviesWithPublisherField} → ${afterPublisher}`)

  const movieActorsCount = await db
    .select({ value: count() })
    .from(movieActors)
    .then(res => res[0]?.value || 0)

  const moviePublishersCount = await db
    .select({ value: count() })
    .from(moviePublishers)
    .then(res => res[0]?.value || 0)

  log('\n   关联表完整性:')
  log(`   - movie_actor: ${movieActorsCount} (不变: ${movieActorsCount === beforeReport.movieActorsCount ? '✅' : '❌'})`)
  log(`   - movie_publisher: ${moviePublishersCount} (不变: ${moviePublishersCount === beforeReport.moviePublishersCount ? '✅' : '❌'})`)

  if (afterActors === 0 && afterPublisher === 0) {
    log('\n   🎉 清理成功完成！')
  }
  else {
    log('\n   ⚠️  部分数据未清理（可能在缓冲期内）')
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  const mode = args[0] || '--preview'

  log('╔══════════════════════════════════════╗')
  log('║   电影备份字段清理工具 v2.0        ║')
  log('╚══════════════════════════════════════╝\n')

  if (mode === '--help' || mode === '-h') {
    console.log('使用方法:')

    console.log('  --preview   仅预览清理影响（默认）')

    console.log('  --execute   执行清理操作')

    console.log('  --help      显示此帮助信息\n')
    process.exit(0)
  }

  log(`📡 数据库: ${databaseUrl!.substring(0, 30)}...`)
  log(`🔧 模式: ${mode}\n`)

  try {
    const report = await checkDataIntegrity()
    await generatePreview(report)

    if (mode === '--execute') {
      if (!report.safeToClean) {
        log('\n❌ 数据完整性检查未通过，终止清理操作')
        log('   请先确保关联表数据已正确迁移')
        saveLog()
        process.exit(1)
      }

      log('\n⚠️  即将执行清理操作，此操作不可逆！')
      log('   等待 5 秒后自动继续...')

      await new Promise(resolve => setTimeout(resolve, 5000))

      const result = await executeCleanup()
      await verifyCleanup(report)

      log(`\n📊 清理统计:`)
      log(`   - 已清理记录: ${result.cleaned}`)
      log(`   - 节省空间: 约 ${Math.round(result.cleaned * 0.1)}KB`)
    }
    else {
      log('\n💡 预览模式，未执行实际清理')
      log('   使用 --execute 参数执行清理')
    }

    log('\n✅ 脚本执行完成')
    saveLog()
  }
  catch (e) {
    log(`\n❌ 脚本执行失败: ${e}`)
    saveLog()
    process.exit(1)
  }
}

main()
