/**
 * 存量影片厂商关联回填脚本
 * 为所有已有 publisher 文本字段但缺少 moviePublishers 关联的影片触发重新同步
 */

import process from 'node:process'
import 'dotenv/config'

const API_URL = process.env.API_URL || 'http://localhost:8787'
const TOKEN = process.env.CRAWLER_SECRET || ''

async function fetchMoviesPage(page: number, limit: number = 100) {
  const res = await fetch(`${API_URL}/api/admin/movies?limit=${limit}&page=${page}`, {
    headers: { 'x-service-token': TOKEN },
  })
  if (!res.ok)
    throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<any>
}

async function syncMovieBatch(movies: Array<{ code: string, publisher: string }>) {
  const body = {
    movies: movies.map(m => ({
      code: m.code,
      title: m.code, // title 在 update 模式下不会被覆盖（已存在）
      publisher: m.publisher,
      isR18: true,
    })),
    mode: 'update', // 只更新已存在的影片
  }

  const res = await fetch(`${API_URL}/api/movies/sync`, {
    method: 'POST',
    headers: {
      'x-service-token': TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sync error: ${res.status} - ${text}`)
  }

  return res.json() as Promise<any>
}

async function main() {
  console.log('🔄 开始回填影片-厂商关联数据')
  console.log(`📡 API: ${API_URL}`)
  console.log()

  if (!TOKEN) {
    console.error('❌ 未设置 CRAWLER_SECRET')
    process.exit(1)
  }

  // 获取总页数
  const firstPage = await fetchMoviesPage(1, 100)
  const totalPages = firstPage.meta.totalPages
  const totalMovies = firstPage.meta.total
  console.log(`📊 总影片数: ${totalMovies}, 共 ${totalPages} 页`)

  let processed = 0
  let synced = 0
  let noPublisher = 0

  for (let page = 1; page <= totalPages; page++) {
    const pageData = page === 1 ? firstPage : await fetchMoviesPage(page, 100)
    const movies: any[] = pageData.data

    // 筛选有 publisher 但无 moviePublishers 关联的影片
    const toSync = movies.filter((m: any) =>
      m.publisher && m.publisher.trim() !== '' && m.moviePublishers.length === 0,
    )

    const noPublisherCount = movies.filter((m: any) => !m.publisher || m.publisher.trim() === '').length
    noPublisher += noPublisherCount

    if (toSync.length === 0) {
      console.log(`  第 ${page}/${totalPages} 页: 无需回填 (${noPublisherCount} 部无厂商信息)`)
      processed += movies.length
      continue
    }

    console.log(`  第 ${page}/${totalPages} 页: 回填 ${toSync.length} 部影片...`)

    // 每次最多 20 部批量同步
    const batchSize = 20
    for (let i = 0; i < toSync.length; i += batchSize) {
      const batch = toSync.slice(i, i + batchSize).map((m: any) => ({
        code: m.code,
        publisher: m.publisher,
      }))

      try {
        const result = await syncMovieBatch(batch)
        synced += result.result?.success || 0
        if (result.result?.failed > 0) {
          console.warn(`    ⚠️ 批次失败 ${result.result.failed} 部`)
        }
      }
      catch (e: any) {
        console.error(`    ❌ 批次同步出错: ${e.message}`)
      }

      // 短暂延迟避免 API 过载
      await new Promise(r => setTimeout(r, 200))
    }

    processed += movies.length
    console.log(`    ✅ 完成 (已处理 ${processed}/${totalMovies})`)
  }

  console.log()
  console.log('✅ 回填完成!')
  console.log(`📊 统计:`)
  console.log(`   已处理: ${processed} 部影片`)
  console.log(`   成功关联: ${synced} 部`)
  console.log(`   无厂商信息: ${noPublisher} 部`)
}

main().catch((e) => {
  console.error('❌ 脚本执行失败:', e)
  process.exit(1)
})
