/**
 * 手动执行本地数据库迁移
 */
import Database from 'better-sqlite3'

const sqlite = new Database('./apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/da28a82533a29de0fcf6bc0cfb706404ceb98a33e52401fb0c54e323290d58b7.sqlite')

console.log('🔧 执行索引迁移...')

// 删除旧的唯一索引
try {
  sqlite.exec('DROP INDEX IF EXISTS `idx_movie_actor_actor_id`;')
  console.log('✅ 删除旧的 actor 索引')
}
catch {
  console.log('⚠️  actor 索引已不存在')
}

// 创建新的普通索引
sqlite.exec('CREATE INDEX `idx_movie_actor_actor_id` ON `movie_actor` (`actor_id`);')
console.log('✅ 创建新的 actor 索引（普通索引）')

// 删除旧的唯一索引
try {
  sqlite.exec('DROP INDEX IF EXISTS `idx_movie_pub_publisher_id`;')
  console.log('✅ 删除旧的 publisher 索引')
}
catch {
  console.log('⚠️  publisher 索引已不存在')
}

// 创建新的普通索引
sqlite.exec('CREATE INDEX `idx_movie_pub_publisher_id` ON `movie_publisher` (`publisher_id`);')
console.log('✅ 创建新的 publisher 索引（普通索引）')

console.log('🎉 索引迁移完成！')

sqlite.close()
