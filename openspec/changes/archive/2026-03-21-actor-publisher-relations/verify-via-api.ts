/**
 * 任务 13.13：通过 API 验证数据完整性
 * 检查 movieCount 派生字段准确性
 */

interface Actor {
  id: string
  name: string
  movieCount: number
}

interface Publisher {
  id: string
  name: string
  movieCount: number
}

interface Movie {
  id: string
  actors?: Array<{ id: string, name: string }>
  publishers?: Array<{ id: string, name: string }>
}

const API_URL = 'http://localhost:8787'

async function fetchAllPages<T>(endpoint: string, itemsKey: string): Promise<T[]> {
  const allItems: T[] = []
  let page = 1
  const limit = 100

  while (true) {
    const response = await fetch(`${API_URL}${endpoint}?page=${page}&limit=${limit}`)
    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} ${endpoint}`)
    }

    const data = await response.json()
    const items = data[itemsKey] || []

    if (items.length === 0) {
      break
    }

    allItems.push(...items)

    if (items.length < limit) {
      break
    }

    page++
  }

  return allItems
}

async function verifyDataIntegrity() {
  console.log('='.repeat(60))
  console.log('任务 13.13：数据完整性验证（基于 API）')
  console.log('='.repeat(60))
  console.log('验证时间:', new Date().toLocaleString('zh-CN'))
  console.log('API 地址:', API_URL)
  console.log()

  try {
    // 1. 获取所有女优
    console.log('[1/5] 获取所有女优数据...')
    const actors: Actor[] = await fetchAllPages('/api/actors', 'actors')
    console.log(`  ✅ 获取到 ${actors.length} 个女优`)

    // 2. 获取所有厂商
    console.log('\n[2/5] 获取所有厂商数据...')
    const publishers: Publisher[] = await fetchAllPages('/api/publishers', 'publishers')
    console.log(`  ✅ 获取到 ${publishers.length} 个厂商`)

    // 3. 获取所有电影
    console.log('\n[3/5] 获取所有电影数据...')
    const movies: Movie[] = await fetchAllPages('/api/movies', 'movies')
    console.log(`  ✅ 获取到 ${movies.length} 部电影`)

    // 4. 验证女优 movieCount
    console.log('\n[4/5] 验证女优 movieCount...')
    const actorMovieCount = new Map<string, number>()

    for (const movie of movies) {
      if (movie.actors) {
        for (const actor of movie.actors) {
          actorMovieCount.set(actor.id, (actorMovieCount.get(actor.id) || 0) + 1)
        }
      }
    }

    const actorIssues: Array<{ name: string, stored: number, actual: number }> = []
    for (const actor of actors) {
      const actualCount = actorMovieCount.get(actor.id) || 0
      if (actor.movieCount !== actualCount) {
        actorIssues.push({
          name: actor.name,
          stored: actor.movieCount,
          actual: actualCount,
        })
      }
    }

    if (actorIssues.length === 0) {
      console.log('  ✅ 所有女优的 movieCount 准确')
    }
    else {
      console.log(`  ❌ 发现 ${actorIssues.length} 个女优的 movieCount 不准确：`)
      actorIssues.slice(0, 10).forEach((issue) => {
        console.log(`    - ${issue.name}: 存储=${issue.stored}, 实际=${issue.actual}`)
      })
      if (actorIssues.length > 10) {
        console.log(`    ... 还有 ${actorIssues.length - 10} 个女优`)
      }
    }

    // 5. 验证厂商 movieCount
    console.log('\n[5/5] 验证厂商 movieCount...')
    const publisherMovieCount = new Map<string, number>()

    for (const movie of movies) {
      if (movie.publishers) {
        for (const publisher of movie.publishers) {
          publisherMovieCount.set(publisher.id, (publisherMovieCount.get(publisher.id) || 0) + 1)
        }
      }
    }

    const publisherIssues: Array<{ name: string, stored: number, actual: number }> = []
    for (const publisher of publishers) {
      const actualCount = publisherMovieCount.get(publisher.id) || 0
      if (publisher.movieCount !== actualCount) {
        publisherIssues.push({
          name: publisher.name,
          stored: publisher.movieCount,
          actual: actualCount,
        })
      }
    }

    if (publisherIssues.length === 0) {
      console.log('  ✅ 所有厂商的 movieCount 准确')
    }
    else {
      console.log(`  ❌ 发现 ${publisherIssues.length} 个厂商的 movieCount 不准确：`)
      publisherIssues.slice(0, 10).forEach((issue) => {
        console.log(`    - ${issue.name}: 存储=${issue.stored}, 实际=${issue.actual}`)
      })
      if (publisherIssues.length > 10) {
        console.log(`    ... 还有 ${publisherIssues.length - 10} 个厂商`)
      }
    }

    // 6. 生成统计报告
    console.log('\n' + '='.repeat(60))
    console.log('数据统计汇总')
    console.log('='.repeat(60))
    console.log(`  女优总数: ${actors.length}`)
    console.log(`  厂商总数: ${publishers.length}`)
    console.log(`  电影总数: ${movies.length}`)

    let totalActorRelations = 0
    let totalPublisherRelations = 0

    for (const movie of movies) {
      totalActorRelations += movie.actors?.length || 0
      totalPublisherRelations += movie.publishers?.length || 0
    }

    console.log(`  女优关联数: ${totalActorRelations}`)
    console.log(`  厂商关联数: ${totalPublisherRelations}`)

    const avgActorsPerMovie = movies.length > 0
      ? (totalActorRelations / movies.length).toFixed(2)
      : 0
    const avgPublishersPerMovie = movies.length > 0
      ? (totalPublisherRelations / movies.length).toFixed(2)
      : 0

    console.log(`  平均每部电影女优数: ${avgActorsPerMovie}`)
    console.log(`  平均每部电影厂商数: ${avgPublishersPerMovie}`)

    // 7. 生成测试结论
    console.log('\n' + '='.repeat(60))
    console.log('测试结论')
    console.log('='.repeat(60))

    const hasIssues = actorIssues.length > 0 || publisherIssues.length > 0

    if (hasIssues) {
      console.log('❌ 数据完整性验证失败')
      console.log('\n建议修复措施：')
      console.log('  运行数据迁移脚本的 updateMovieCount 函数')
      console.log('  pnpm tsx packages/db/scripts/migrate-relations.ts')
      process.exit(1)
    }
    else {
      console.log('✅ 数据完整性验证通过')
      console.log('  - 所有 movieCount 字段准确')
      console.log('  - 数据关联完整')
      process.exit(0)
    }
  }
  catch (error) {
    console.error('\n验证过程出错:', error)
    if (error instanceof Error && error.message.includes('fetch')) {
      console.error('\n请确保 API 服务器正在运行：')
      console.error('  cd apps/api && pnpm dev')
    }
    process.exit(1)
  }
}

// 运行验证
verifyDataIntegrity()
