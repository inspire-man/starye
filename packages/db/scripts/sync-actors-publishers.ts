/**
 * 数据同步脚本：从现有影片数据填充女优和厂商表
 *
 * 运行方式：
 * pnpm tsx scripts/sync-actors-publishers.ts
 */

import process from 'node:process'
import { actors, movies, publishers } from '@starye/db/schema'
import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const sqlite = new Database('./data/starye.db')
const db = drizzle(sqlite, { schema: { movies, actors, publishers } })

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // 移除特殊字符
    .replace(/\s+/g, '-') // 空格转为连字符
    .replace(/-+/g, '-') // 多个连字符合并为一个
    .trim()
}

async function syncActors() {
  console.log('🎭 开始同步女优数据...')

  // 获取所有影片
  const allMovies = await db.query.movies.findMany({
    columns: {
      actors: true,
    },
  })

  const actorCountMap = new Map<string, number>()

  // 统计每个女优的作品数量
  allMovies.forEach((movie) => {
    const actorsList = movie.actors as string[] | null
    if (actorsList && Array.isArray(actorsList)) {
      actorsList.forEach((actorName) => {
        if (actorName && actorName.trim()) {
          const count = actorCountMap.get(actorName) || 0
          actorCountMap.set(actorName, count + 1)
        }
      })
    }
  })

  console.log(`📊 发现 ${actorCountMap.size} 位女优`)

  // 插入或更新女优数据
  let inserted = 0
  let updated = 0

  for (const [actorName, movieCount] of actorCountMap.entries()) {
    const slug = generateSlug(actorName)

    try {
      // 检查是否已存在
      const existing = await db.query.actors.findFirst({
        where: eq(actors.name, actorName),
      })

      if (existing) {
        // 更新作品数量
        await db.update(actors)
          .set({
            movieCount,
            updatedAt: new Date(),
          })
          .where(eq(actors.id, existing.id))
        updated++
      }
      else {
        // 插入新记录
        await db.insert(actors).values({
          id: crypto.randomUUID(),
          name: actorName,
          slug,
          movieCount,
          isR18: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        inserted++
      }
    }
    catch (error) {
      console.error(`❌ 处理女优 "${actorName}" 失败:`, error)
    }
  }

  console.log(`✅ 女优同步完成: 新增 ${inserted} 位, 更新 ${updated} 位`)
}

async function syncPublishers() {
  console.log('🏢 开始同步厂商数据...')

  // 获取所有影片
  const allMovies = await db.query.movies.findMany({
    columns: {
      publisher: true,
    },
  })

  const publisherCountMap = new Map<string, number>()

  // 统计每个厂商的作品数量
  allMovies.forEach((movie) => {
    const publisherName = movie.publisher
    if (publisherName && publisherName.trim()) {
      const count = publisherCountMap.get(publisherName) || 0
      publisherCountMap.set(publisherName, count + 1)
    }
  })

  console.log(`📊 发现 ${publisherCountMap.size} 个厂商`)

  // 插入或更新厂商数据
  let inserted = 0
  let updated = 0

  for (const [publisherName, movieCount] of publisherCountMap.entries()) {
    const slug = generateSlug(publisherName)

    try {
      // 检查是否已存在
      const existing = await db.query.publishers.findFirst({
        where: eq(publishers.name, publisherName),
      })

      if (existing) {
        // 更新作品数量
        await db.update(publishers)
          .set({
            movieCount,
            updatedAt: new Date(),
          })
          .where(eq(publishers.id, existing.id))
        updated++
      }
      else {
        // 插入新记录
        await db.insert(publishers).values({
          id: crypto.randomUUID(),
          name: publisherName,
          slug,
          movieCount,
          isR18: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        inserted++
      }
    }
    catch (error) {
      console.error(`❌ 处理厂商 "${publisherName}" 失败:`, error)
    }
  }

  console.log(`✅ 厂商同步完成: 新增 ${inserted} 个, 更新 ${updated} 个`)
}

async function main() {
  try {
    await syncActors()
    await syncPublishers()
    console.log('🎉 所有数据同步完成！')
  }
  catch (error) {
    console.error('❌ 同步失败:', error)
    process.exit(1)
  }
  finally {
    sqlite.close()
  }
}

main()
