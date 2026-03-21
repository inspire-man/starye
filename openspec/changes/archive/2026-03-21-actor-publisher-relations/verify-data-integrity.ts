/**
 * 任务 13.13：验证数据完整性
 * 检查 movieCount 派生字段准确性
 */

import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '@starye/db/schema'

async function verifyDataIntegrity() {
  console.log('='.repeat(60))
  console.log('任务 13.13：数据完整性验证')
  console.log('='.repeat(60))
  console.log('验证时间:', new Date().toLocaleString('zh-CN'))
  console.log()

  // 连接本地 D1 SQLite 数据库
  const dbPath = 'D:/my-workspace/starye/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/da28a82533a29de0fcf6bc0cfb706404ceb98a33e52401fb0c54e323290d58b7.sqlite'
  const sqlite = new Database(dbPath)
  const db = drizzle(sqlite, { schema })

  // 1. 验证女优的 movieCount
  console.log('[1/4] 验证女优 movieCount...')
  const actorsIntegrity = await db.execute(`
    SELECT 
      a.id,
      a.name,
      a.movieCount as stored_count,
      COUNT(DISTINCT ma.movieId) as actual_count
    FROM actors a
    LEFT JOIN movie_actors ma ON a.id = ma.actorId
    GROUP BY a.id
    HAVING stored_count != actual_count
  `)

  if (actorsIntegrity.rows.length === 0) {
    console.log('  ✅ 所有女优的 movieCount 准确')
  }
  else {
    console.log(`  ❌ 发现 ${actorsIntegrity.rows.length} 个女优的 movieCount 不准确：`)
    actorsIntegrity.rows.forEach((row: any) => {
      console.log(`    - ${row.name}: 存储=${row.stored_count}, 实际=${row.actual_count}`)
    })
  }

  // 2. 验证厂商的 movieCount
  console.log('\n[2/4] 验证厂商 movieCount...')
  const publishersIntegrity = await db.execute(`
    SELECT 
      p.id,
      p.name,
      p.movieCount as stored_count,
      COUNT(DISTINCT mp.movieId) as actual_count
    FROM publishers p
    LEFT JOIN movie_publishers mp ON p.id = mp.publisherId
    GROUP BY p.id
    HAVING stored_count != actual_count
  `)

  if (publishersIntegrity.rows.length === 0) {
    console.log('  ✅ 所有厂商的 movieCount 准确')
  }
  else {
    console.log(`  ❌ 发现 ${publishersIntegrity.rows.length} 个厂商的 movieCount 不准确：`)
    publishersIntegrity.rows.forEach((row: any) => {
      console.log(`    - ${row.name}: 存储=${row.stored_count}, 实际=${row.actual_count}`)
    })
  }

  // 3. 验证关联表的数据一致性
  console.log('\n[3/4] 验证关联表完整性...')

  // 检查孤立的女优关联（电影不存在）
  const orphanActorRelations = await db.execute(`
    SELECT COUNT(*) as count
    FROM movie_actors ma
    LEFT JOIN movies m ON ma.movieId = m.id
    WHERE m.id IS NULL
  `)

  const orphanActorCount = (orphanActorRelations.rows[0] as any).count
  if (orphanActorCount === 0) {
    console.log('  ✅ 无孤立的女优关联记录')
  }
  else {
    console.log(`  ❌ 发现 ${orphanActorCount} 条孤立的女优关联记录（电影已删除）`)
  }

  // 检查孤立的厂商关联（电影不存在）
  const orphanPublisherRelations = await db.execute(`
    SELECT COUNT(*) as count
    FROM movie_publishers mp
    LEFT JOIN movies m ON mp.movieId = m.id
    WHERE m.id IS NULL
  `)

  const orphanPublisherCount = (orphanPublisherRelations.rows[0] as any).count
  if (orphanPublisherCount === 0) {
    console.log('  ✅ 无孤立的厂商关联记录')
  }
  else {
    console.log(`  ❌ 发现 ${orphanPublisherCount} 条孤立的厂商关联记录（电影已删除）`)
  }

  // 4. 生成统计报告
  console.log('\n[4/4] 数据统计汇总...')

  const stats = await db.execute(`
    SELECT 
      (SELECT COUNT(*) FROM actors) as total_actors,
      (SELECT COUNT(*) FROM publishers) as total_publishers,
      (SELECT COUNT(*) FROM movies) as total_movies,
      (SELECT COUNT(*) FROM movie_actors) as total_actor_relations,
      (SELECT COUNT(*) FROM movie_publishers) as total_publisher_relations
  `)

  const statsRow = stats.rows[0] as any
  console.log(`  女优总数: ${statsRow.total_actors}`)
  console.log(`  厂商总数: ${statsRow.total_publishers}`)
  console.log(`  电影总数: ${statsRow.total_movies}`)
  console.log(`  女优关联数: ${statsRow.total_actor_relations}`)
  console.log(`  厂商关联数: ${statsRow.total_publisher_relations}`)

  const avgActorsPerMovie = statsRow.total_movies > 0
    ? (statsRow.total_actor_relations / statsRow.total_movies).toFixed(2)
    : 0
  const avgPublishersPerMovie = statsRow.total_movies > 0
    ? (statsRow.total_publisher_relations / statsRow.total_movies).toFixed(2)
    : 0

  console.log(`  平均每部电影女优数: ${avgActorsPerMovie}`)
  console.log(`  平均每部电影厂商数: ${avgPublishersPerMovie}`)

  // 5. 生成测试结论
  console.log('\n' + '='.repeat(60))
  console.log('测试结论')
  console.log('='.repeat(60))

  const hasIssues
    = actorsIntegrity.rows.length > 0
    || publishersIntegrity.rows.length > 0
    || orphanActorCount > 0
    || orphanPublisherCount > 0

  if (hasIssues) {
    console.log('❌ 数据完整性验证失败')
    console.log('\n建议修复措施：')
    if (actorsIntegrity.rows.length > 0 || publishersIntegrity.rows.length > 0) {
      console.log('  1. 运行数据迁移脚本的 updateMovieCount 函数')
      console.log('     pnpm tsx packages/db/scripts/migrate-relations.ts')
    }
    if (orphanActorCount > 0 || orphanPublisherCount > 0) {
      console.log('  2. 清理孤立的关联记录')
      console.log('     DELETE FROM movie_actors WHERE movieId NOT IN (SELECT id FROM movies)')
      console.log('     DELETE FROM movie_publishers WHERE movieId NOT IN (SELECT id FROM movies)')
    }
    process.exit(1)
  }
  else {
    console.log('✅ 数据完整性验证通过')
    console.log('  - 所有 movieCount 字段准确')
    console.log('  - 无孤立的关联记录')
    console.log('  - 数据结构完整')
    process.exit(0)
  }
}

// 运行验证
verifyDataIntegrity().catch((e) => {
  console.error('验证过程出错:', e)
  process.exit(1)
})
