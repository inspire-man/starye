/* eslint-disable node/prefer-global/process */
/**
 * 数据迁移脚本：为现有 movies 记录设置默认值并计算 totalPlayers
 *
 * 运行方式：
 * pnpm tsx packages/db/scripts/migrate-movies-metadata.ts
 */

import { createClient } from '@libsql/client'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '../src/schema'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const client = createClient({
    url: databaseUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  })

  const db = drizzle(client, { schema })

  console.log('🔧 开始迁移 movies 表数据...')

  const allMovies = await db.query.movies.findMany({
    with: {
      players: true,
    },
  })

  console.log(`📊 找到 ${allMovies.length} 部电影`)

  let updated = 0

  for (const movie of allMovies) {
    const playerCount = movie.players.length

    await db.update(schema.movies)
      .set({
        totalPlayers: playerCount,
        crawledPlayers: playerCount,
        crawlStatus: 'complete',
        lastCrawledAt: movie.updatedAt || new Date(),
        metadataLocked: false,
        sortOrder: 0,
      })
      .where(eq(schema.movies.id, movie.id))

    updated++

    if (updated % 50 === 0) {
      console.log(`✅ 已处理 ${updated}/${allMovies.length} 部电影`)
    }
  }

  console.log(`✅ 迁移完成！更新了 ${updated} 部电影`)
  console.log(`📊 统计：`)
  console.log(`   - totalPlayers 已计算`)
  console.log(`   - crawlStatus 默认设为 'complete'`)
  console.log(`   - metadataLocked 默认设为 false`)

  client.close()
}

main().catch((error) => {
  console.error('❌ 迁移失败:', error)
  process.exit(1)
})
