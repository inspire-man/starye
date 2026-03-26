/* eslint-disable node/prefer-global/process */
/**
 * 女优合作关系分析脚本
 *
 * 功能：
 * - 统计女优之间的合作频率
 * - 生成关系图谱数据
 * - 识别高频合作对
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'

interface ActorRelation {
  actor1Id: string
  actor1Name: string
  actor2Id: string
  actor2Name: string
  collaborationCount: number
  sharedMovies: string[]
}

interface ActorNetwork {
  actorId: string
  actorName: string
  totalCollaborations: number
  topPartners: Array<{
    partnerId: string
    partnerName: string
    count: number
  }>
}

/**
 * 分析单个女优的合作关系
 */
export async function analyzeActorRelations(actorId: string): Promise<ActorRelation[]> {
  const sqlite = new Database(process.env.DATABASE_PATH || './data.db')
  const db = drizzle(sqlite, { schema })

  // 查询该女优参与的所有电影
  const actorMovies = await db.query.movieActors.findMany({
    where: (movieActors, { eq }) => eq(movieActors.actorId, actorId),
    with: {
      movie: {
        with: {
          movieActors: {
            with: {
              actor: true,
            },
          },
        },
      },
    },
  })

  // 统计合作关系
  const collaborationMap = new Map<string, {
    partner: { id: string, name: string }
    count: number
    movies: string[]
  }>()

  for (const ma of actorMovies) {
    if (!ma.movie?.movieActors)
      continue

    for (const otherMa of ma.movie.movieActors) {
      // 跳过自己
      if (otherMa.actorId === actorId)
        continue
      if (!otherMa.actor)
        continue

      const partnerId = otherMa.actorId
      const existing = collaborationMap.get(partnerId)

      if (existing) {
        existing.count++
        existing.movies.push(ma.movie.id)
      }
      else {
        collaborationMap.set(partnerId, {
          partner: {
            id: otherMa.actor.id,
            name: otherMa.actor.name,
          },
          count: 1,
          movies: [ma.movie.id],
        })
      }
    }
  }

  // 转换为结果数组
  const actor = await db.query.actors.findFirst({
    where: (actors, { eq }) => eq(actors.id, actorId),
  })

  const relations: ActorRelation[] = []

  for (const [partnerId, data] of collaborationMap.entries()) {
    relations.push({
      actor1Id: actorId,
      actor1Name: actor?.name || '',
      actor2Id: partnerId,
      actor2Name: data.partner.name,
      collaborationCount: data.count,
      sharedMovies: data.movies,
    })
  }

  // 按合作次数降序排序
  relations.sort((a, b) => b.collaborationCount - a.collaborationCount)

  sqlite.close()
  return relations
}

/**
 * 获取女优网络摘要（用于图谱可视化）
 */
export async function getActorNetwork(actorId: string, minCollaborations = 3): Promise<ActorNetwork> {
  const relations = await analyzeActorRelations(actorId)

  // 过滤低频合作
  const significantRelations = relations.filter(r => r.collaborationCount >= minCollaborations)

  const sqlite = new Database(process.env.DATABASE_PATH || './data.db')
  const db = drizzle(sqlite, { schema })

  const actor = await db.query.actors.findFirst({
    where: (actors, { eq }) => eq(actors.id, actorId),
  })

  sqlite.close()

  return {
    actorId,
    actorName: actor?.name || '',
    totalCollaborations: relations.length,
    topPartners: significantRelations.slice(0, 10).map(r => ({
      partnerId: r.actor2Id,
      partnerName: r.actor2Name,
      count: r.collaborationCount,
    })),
  }
}

/**
 * 获取全局高频合作对（用于发现趋势）
 */
export async function getTopCollaborationPairs(limit = 50): Promise<ActorRelation[]> {
  const sqlite = new Database(process.env.DATABASE_PATH || './data.db')
  const db = drizzle(sqlite, { schema })

  // 获取所有电影的女优列表
  const movies = await db.query.movies.findMany({
    with: {
      movieActors: {
        with: {
          actor: true,
        },
      },
    },
  })

  const pairMap = new Map<string, {
    actor1: { id: string, name: string }
    actor2: { id: string, name: string }
    count: number
    movies: string[]
  }>()

  // 遍历每部电影，生成女优对
  for (const movie of movies) {
    if (!movie.movieActors || movie.movieActors.length < 2)
      continue

    const actors = movie.movieActors
      .filter(ma => ma.actor)
      .map(ma => ({ id: ma.actorId, name: ma.actor!.name }))

    // 生成所有可能的女优对
    for (let i = 0; i < actors.length; i++) {
      for (let j = i + 1; j < actors.length; j++) {
        const actor1 = actors[i]
        const actor2 = actors[j]

        // 确保 actor1.id < actor2.id 以避免重复
        const [a1, a2] = actor1.id < actor2.id ? [actor1, actor2] : [actor2, actor1]
        const pairKey = `${a1.id}:${a2.id}`

        const existing = pairMap.get(pairKey)
        if (existing) {
          existing.count++
          existing.movies.push(movie.id)
        }
        else {
          pairMap.set(pairKey, {
            actor1: a1,
            actor2: a2,
            count: 1,
            movies: [movie.id],
          })
        }
      }
    }
  }

  // 转换为结果数组并排序
  const relations: ActorRelation[] = Array.from(pairMap.values())
    .filter(pair => pair.count >= 3) // 至少合作 3 次
    .map(pair => ({
      actor1Id: pair.actor1.id,
      actor1Name: pair.actor1.name,
      actor2Id: pair.actor2.id,
      actor2Name: pair.actor2.name,
      collaborationCount: pair.count,
      sharedMovies: pair.movies,
    }))
    .sort((a, b) => b.collaborationCount - a.collaborationCount)
    .slice(0, limit)

  sqlite.close()
  return relations
}

// CLI 执行
if (require.main === module) {
  const actorId = process.argv[2]

  if (!actorId) {
    console.log('用法: tsx analyze-actor-relations.ts <actorId>')
    console.log('\n示例:')
    console.log('  tsx analyze-actor-relations.ts actor-123')
    console.log('  tsx analyze-actor-relations.ts --top-pairs')
    process.exit(1)
  }

  if (actorId === '--top-pairs') {
    getTopCollaborationPairs(50).then((pairs) => {
      console.log('\n=== 全局高频合作对 TOP 50 ===\n')
      pairs.forEach((pair, index) => {
        console.log(`${index + 1}. ${pair.actor1Name} × ${pair.actor2Name}`)
        console.log(`   合作次数: ${pair.collaborationCount}`)
        console.log(`   共同作品: ${pair.sharedMovies.length} 部`)
        console.log('')
      })
    }).catch(console.error)
  }
  else {
    Promise.all([
      analyzeActorRelations(actorId),
      getActorNetwork(actorId),
    ]).then(([relations, network]) => {
      console.log(`\n=== ${network.actorName} 的合作关系 ===\n`)
      console.log(`总合作伙伴数: ${network.totalCollaborations}`)
      console.log(`高频合作伙伴 (≥3次): ${network.topPartners.length}\n`)

      console.log('TOP 10 合作伙伴:')
      network.topPartners.forEach((partner, index) => {
        console.log(`  ${index + 1}. ${partner.partnerName} - ${partner.count} 次`)
      })

      console.log('\n完整合作列表:')
      relations.slice(0, 20).forEach((rel) => {
        console.log(`  ${rel.actor2Name}: ${rel.collaborationCount} 次合作`)
      })
    }).catch(console.error)
  }
}
