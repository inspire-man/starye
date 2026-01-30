/**
 * 数据库迁移脚本：创建女优和厂商表
 *
 * 运行方式：
 * pnpm tsx scripts/migrate-actors-publishers.ts
 */

import process from 'node:process'
import Database from 'better-sqlite3'

const sqlite = new Database('./data/starye.db')

async function migrate() {
  console.log('🚀 开始迁移：创建女优和厂商表...')

  try {
    // 创建女优表
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS actor (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        avatar TEXT,
        bio TEXT,
        birth_date INTEGER,
        height INTEGER,
        measurements TEXT,
        nationality TEXT,
        social_links TEXT,
        movie_count INTEGER DEFAULT 0 NOT NULL,
        is_r18 INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)
    console.log('✅ 女优表创建成功')

    // 创建厂商表
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS publisher (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        logo TEXT,
        website TEXT,
        description TEXT,
        founded_year INTEGER,
        country TEXT,
        movie_count INTEGER DEFAULT 0 NOT NULL,
        is_r18 INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)
    console.log('✅ 厂商表创建成功')

    // 创建索引
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_actor_name ON actor(name);
      CREATE INDEX IF NOT EXISTS idx_actor_slug ON actor(slug);
      CREATE INDEX IF NOT EXISTS idx_actor_movie_count ON actor(movie_count DESC);
      CREATE INDEX IF NOT EXISTS idx_publisher_name ON publisher(name);
      CREATE INDEX IF NOT EXISTS idx_publisher_slug ON publisher(slug);
      CREATE INDEX IF NOT EXISTS idx_publisher_movie_count ON publisher(movie_count DESC);
    `)
    console.log('✅ 索引创建成功')

    console.log('🎉 迁移完成！')
  }
  catch (error) {
    console.error('❌ 迁移失败:', error)
    process.exit(1)
  }
  finally {
    sqlite.close()
  }
}

migrate()
