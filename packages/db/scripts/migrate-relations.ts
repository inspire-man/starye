/**
 * 数据迁移脚本：将 movies.actors 和 movies.publisher 迁移到关联表
 *
 * 运行方式：
 * pnpm --filter @starye/db tsx scripts/migrate-relations.ts
 */

import process from 'node:process'
import { actors, movieActors, moviePublishers, movies, publishers } from '@starye/db/schema'
import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { nanoid } from 'nanoid'

const sqlite = new Database('./apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/da28a82533a29de0fcf6bc0cfb706404ceb98a33e52401fb0c54e323290d58b7.sqlite')
const db = drizzle(sqlite, { schema: { movies, actors, publishers, movieActors, moviePublishers } })

// 生成 slug
const SPECIAL_CHARS_REGEX = /[^\w\s-]/g
const SPACES_REGEX = /\s+/g
const MULTI_HYPHEN_REGEX = /-+/g

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(SPECIAL_CHARS_REGEX, '') // 移除特殊字符
    .replace(SPACES_REGEX, '-') // 空格转为连字符
    .replace(MULTI_HYPHEN_REGEX, '-') // 多个连字符合并为一个
    .trim()
}

/**
 * 查找或创建女优
 */
async function findOrCreateActor(name: string): Promise<string> {
  const trimmedName = name.trim()
  if (!trimmedName)
    throw new Error('Actor name is empty')

  // 先尝试查找
  const existing = await db.query.actors.findFirst({
    where: eq(actors.name, trimmedName),
  })

  if (existing) {
    return existing.id
  }

  // 不存在则创建
  const actorId = nanoid()
  const slug = generateSlug(trimmedName)
  const finalSlug = `${slug}-${actorId.substring(0, 6)}` // 添加 ID 后缀避免重名

  await db.insert(actors).values({
    id: actorId,
    name: trimmedName,
    slug: finalSlug,
    source: 'javbus',
    sourceId: finalSlug, // 使用 slug 作为 sourceId，避免唯一约束冲突
    hasDetailsCrawled: false,
    crawlFailureCount: 0,
    movieCount: 0,
    isR18: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return actorId
}

/**
 * 查找或创建厂商
 */
async function findOrCreatePublisher(name: string): Promise<string> {
  const trimmedName = name.trim()
  if (!trimmedName)
    throw new Error('Publisher name is empty')

  // 先尝试查找
  const existing = await db.query.publishers.findFirst({
    where: eq(publishers.name, trimmedName),
  })

  if (existing) {
    return existing.id
  }

  // 不存在则创建
  const publisherId = nanoid()
  const slug = generateSlug(trimmedName)
  const finalSlug = `${slug}-${publisherId.substring(0, 6)}`

  await db.insert(publishers).values({
    id: publisherId,
    name: trimmedName,
    slug: finalSlug,
    source: 'javbus',
    sourceId: finalSlug, // 使用 slug 作为 sourceId，避免唯一约束冲突
    hasDetailsCrawled: false,
    crawlFailureCount: 0,
    movieCount: 0,
    isR18: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return publisherId
}

/**
 * 更新女优/厂商的作品数量
 */
async function updateMovieCount(actorId: string) {
  const count = await db.query.movieActors.findMany({
    where: eq(movieActors.actorId, actorId),
  })
  await db.update(actors)
    .set({ movieCount: count.length, updatedAt: new Date() })
    .where(eq(actors.id, actorId))
}

async function updatePublisherMovieCount(publisherId: string) {
  const count = await db.query.moviePublishers.findMany({
    where: eq(moviePublishers.publisherId, publisherId),
  })
  await db.update(publishers)
    .set({ movieCount: count.length, updatedAt: new Date() })
    .where(eq(publishers.id, publisherId))
}

/**
 * 主迁移逻辑
 */
async function migrate() {
  console.log('🚀 开始数据迁移...')

  // 获取所有电影
  const allMovies = await db.query.movies.findMany({
    columns: {
      id: true,
      title: true,
      actors: true,
      publisher: true,
    },
  })

  console.log(`📊 发现 ${allMovies.length} 部电影`)

  let actorRelationsCreated = 0
  let publisherRelationsCreated = 0
  let errors = 0

  const processedActors = new Set<string>()
  const processedPublishers = new Set<string>()

  for (const movie of allMovies) {
    try {
      // 处理女优
      const actorsList = movie.actors as string[] | null
      if (actorsList && Array.isArray(actorsList)) {
        for (let i = 0; i < actorsList.length; i++) {
          const actorName = actorsList[i]
          if (actorName && actorName.trim()) {
            try {
              const actorId = await findOrCreateActor(actorName)

              // 检查关联是否已存在
              const existingRelation = await db.query.movieActors.findFirst({
                where: (movieActors, { and, eq }) => and(
                  eq(movieActors.movieId, movie.id),
                  eq(movieActors.actorId, actorId),
                ),
              })

              if (!existingRelation) {
                await db.insert(movieActors).values({
                  id: nanoid(),
                  movieId: movie.id,
                  actorId,
                  sortOrder: i,
                  createdAt: new Date(),
                })
                actorRelationsCreated++
              }

              processedActors.add(actorId)
            }
            catch (error) {
              console.error(`❌ 处理电影 "${movie.title}" 的女优 "${actorName}" 失败:`, error)
              errors++
            }
          }
        }
      }

      // 处理厂商
      const publisherName = movie.publisher as string | null
      if (publisherName && publisherName.trim()) {
        try {
          const publisherId = await findOrCreatePublisher(publisherName)

          // 检查关联是否已存在
          const existingRelation = await db.query.moviePublishers.findFirst({
            where: (moviePublishers, { and, eq }) => and(
              eq(moviePublishers.movieId, movie.id),
              eq(moviePublishers.publisherId, publisherId),
            ),
          })

          if (!existingRelation) {
            await db.insert(moviePublishers).values({
              id: nanoid(),
              movieId: movie.id,
              publisherId,
              sortOrder: 0,
              createdAt: new Date(),
            })
            publisherRelationsCreated++
          }

          processedPublishers.add(publisherId)
        }
        catch (error) {
          console.error(`❌ 处理电影 "${movie.title}" 的厂商 "${publisherName}" 失败:`, error)
          errors++
        }
      }
    }
    catch (error) {
      console.error(`❌ 处理电影 "${movie.title}" 失败:`, error)
      errors++
    }
  }

  console.log(`\n📊 关联创建统计:`)
  console.log(`  - 女优关联: ${actorRelationsCreated}`)
  console.log(`  - 厂商关联: ${publisherRelationsCreated}`)
  console.log(`  - 错误数: ${errors}`)

  // 更新所有女优/厂商的作品数量
  console.log(`\n🔄 更新女优/厂商作品数量...`)
  for (const actorId of processedActors) {
    await updateMovieCount(actorId)
  }
  for (const publisherId of processedPublishers) {
    await updatePublisherMovieCount(publisherId)
  }

  console.log(`✅ 作品数量更新完成`)
  console.log(`\n🎉 迁移完成！`)
}

/**
 * 验证数据完整性
 */
async function verify() {
  console.log('\n🔍 验证数据完整性...')

  const movieCount = await db.query.movies.findMany()
  const actorCount = await db.query.actors.findMany()
  const publisherCount = await db.query.publishers.findMany()
  const actorRelationCount = await db.query.movieActors.findMany()
  const publisherRelationCount = await db.query.moviePublishers.findMany()

  console.log(`\n📊 数据统计:`)
  console.log(`  - 电影数: ${movieCount.length}`)
  console.log(`  - 女优数: ${actorCount.length}`)
  console.log(`  - 厂商数: ${publisherCount.length}`)
  console.log(`  - 女优关联数: ${actorRelationCount.length}`)
  console.log(`  - 厂商关联数: ${publisherRelationCount.length}`)
}

async function main() {
  try {
    await migrate()
    await verify()
  }
  catch (error) {
    console.error('❌ 迁移失败:', error)
    process.exit(1)
  }
  finally {
    sqlite.close()
  }
}

main()
