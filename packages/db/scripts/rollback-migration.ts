/**
 * 回滚脚本：删除关联表数据
 *
 * 运行方式：
 * pnpm --filter @starye/db tsx scripts/rollback-migration.ts
 */

import process from 'node:process'
import { movieActors, moviePublishers } from '@starye/db/schema'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const sqlite = new Database('./apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/da28a82533a29de0fcf6bc0cfb706404ceb98a33e52401fb0c54e323290d58b7.sqlite')
const db = drizzle(sqlite, { schema: { movieActors, moviePublishers } })

async function rollback() {
  console.log('🔄 开始回滚迁移...')

  try {
    // 删除所有关联表数据
    console.log('🗑️  删除女优关联数据...')
    await db.delete(movieActors)

    console.log('🗑️  删除厂商关联数据...')
    await db.delete(moviePublishers)

    console.log('✅ 回滚完成！')
  }
  catch (error) {
    console.error('❌ 回滚失败:', error)
    process.exit(1)
  }
  finally {
    sqlite.close()
  }
}

rollback()
