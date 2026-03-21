/**
 * 清理无效封面图片脚本
 *
 * 功能：
 * - 清除 dmmbus.cyou 域名的封面图片（图片无法访问）
 * - 将 coverImage 设置为 null
 */

import process from 'node:process'
import { createClient } from '@libsql/client'
import { like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '../src/schema'

const { movies } = schema

async function main() {
  // 从环境变量或命令行参数获取数据库配置
  const databaseUrl = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN

  if (!databaseUrl) {
    console.error('❌ 错误：缺少 DATABASE_URL 环境变量')
    console.error('使用方法：')
    console.error('  DATABASE_URL=<url> DATABASE_AUTH_TOKEN=<token> pnpm tsx scripts/cleanup-invalid-covers.ts')
    process.exit(1)
  }

  console.log('🔗 连接到数据库...')
  const client = createClient({
    url: databaseUrl,
    authToken,
  })

  const db = drizzle(client, { schema })

  console.log('\n📊 检查需要清理的影片...')

  // 查找所有包含 dmmbus.cyou 域名的封面
  const invalidMovies = await db
    .select({
      id: movies.id,
      code: movies.code,
      title: movies.title,
      coverImage: movies.coverImage,
    })
    .from(movies)
    .where(
      like(movies.coverImage, '%dmmbus.cyou%'),
    )
    .execute()

  if (invalidMovies.length === 0) {
    console.log('✅ 没有需要清理的影片')
    process.exit(0)
  }

  console.log(`\n⚠️  找到 ${invalidMovies.length} 个包含无效封面的影片：`)
  invalidMovies.slice(0, 10).forEach((movie) => {
    console.log(`  - ${movie.code}: ${movie.title}`)
    console.log(`    封面: ${movie.coverImage}`)
  })

  if (invalidMovies.length > 10) {
    console.log(`  ... 还有 ${invalidMovies.length - 10} 个影片`)
  }

  // 确认操作
  console.log('\n⚠️  即将清除这些影片的封面图片（设置为 NULL）')
  console.log('按 Ctrl+C 取消，或等待 5 秒后自动继续...')

  await new Promise(resolve => setTimeout(resolve, 5000))

  console.log('\n🔧 开始清理...')

  // 批量更新
  await db
    .update(movies)
    .set({ coverImage: null })
    .where(like(movies.coverImage, '%dmmbus.cyou%'))
    .execute()

  console.log(`\n✅ 清理完成！`)
  console.log(`   清除了 ${invalidMovies.length} 个影片的封面图片`)

  // 验证
  const remaining = await db
    .select({ count: movies.id })
    .from(movies)
    .where(like(movies.coverImage, '%dmmbus.cyou%'))
    .execute()

  if (remaining.length === 0) {
    console.log('✅ 验证通过：所有无效封面已清除')
  }
  else {
    console.log(`⚠️  警告：仍有 ${remaining.length} 个影片包含无效封面`)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error('❌ 清理失败:', error)
  process.exit(1)
})
