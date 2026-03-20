/* eslint-disable node/prefer-global/process */
/**
 * 清理本地测试数据
 * 仅用于本地开发测试，删除所有电影、女优、厂商数据
 */
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { actors, movieActors, moviePublishers, movies, publishers } from '../src/schema'

const sqlite = new Database('./apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/da28a82533a29de0fcf6bc0cfb706404ceb98a33e52401fb0c54e323290d58b7.sqlite')
const db = drizzle(sqlite, { schema: { movies, actors, publishers, movieActors, moviePublishers } })

async function clean() {
  console.log('🗑️  开始清理数据...')

  // 删除关联表（先删除关联，避免外键约束）
  await db.delete(movieActors)
  console.log('✅ 已清空 movie_actors 表')

  await db.delete(moviePublishers)
  console.log('✅ 已清空 movie_publishers 表')

  // 删除主表
  await db.delete(actors)
  console.log('✅ 已清空 actors 表')

  await db.delete(publishers)
  console.log('✅ 已清空 publishers 表')

  await db.delete(movies)
  console.log('✅ 已清空 movies 表')

  console.log('🎉 数据清理完成！')
}

clean()
  .then(() => {
    sqlite.close()
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 清理失败:', err)
    sqlite.close()
    process.exit(1)
  })
