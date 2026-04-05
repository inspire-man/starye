/**
 * 播放源补充脚本
 * 对数据库中已入库但无播放源（totalPlayers=0）的影片，
 * 通过 JavDB 策略批量补爬磁力链接，并写入数据库。
 *
 * 用法：
 *   pnpm crawl:enrich-players [--limit 50] [--dry-run]
 *
 * 参数：
 *   --limit N    处理的最大影片数，默认 50
 *   --dry-run    只打印结果，不写入数据库
 */

import process from 'node:process'
import { JavDBStrategy } from '../strategies/javdb'
import { ApiClient } from '../utils/api-client'
import { BrowserManager } from '../utils/browser'
import 'dotenv/config'

// ---- 解析命令行参数 ----
function parseArgs(): { limit: number, dryRun: boolean } {
  const args = process.argv.slice(2)
  let limit = 50
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10) || 50
      i++
    }
    if (args[i] === '--dry-run') {
      dryRun = true
    }
  }

  return { limit, dryRun }
}

// ---- 随机延迟 3-6 秒 ----
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * 3000) + 3000
  console.log(`⏳ 等待 ${(ms / 1000).toFixed(1)}s...`)
  await sleep(ms)
}

// ---- 主函数 ----
async function main() {
  const { limit, dryRun } = parseArgs()

  const apiUrl = process.env.API_URL || 'http://localhost:8787'
  const apiToken = process.env.SERVICE_TOKEN || process.env.CRAWLER_SECRET || ''

  console.log('='.repeat(60))
  console.log('🎬 播放源补充脚本 (JavDB)')
  console.log(`📌 API: ${apiUrl}`)
  console.log(`📌 限制: ${limit} 部影片`)
  console.log(`📌 模式: ${dryRun ? 'DRY-RUN（不写入）' : '写入数据库'}`)
  console.log('='.repeat(60))

  const apiClient = new ApiClient({
    url: apiUrl,
    token: apiToken,
    timeout: 30000,
  })

  // Step 1：获取无播放源的影片列表
  console.log('\n📋 获取无播放源的影片列表...')
  let moviesWithoutPlayers: Array<{ code: string, title: string }> = []
  try {
    const response = await fetch(
      `${apiUrl}/api/admin/movies?hasPlayers=false&limit=${limit}&sortBy=createdAt&sortOrder=desc`,
      {
        headers: {
          'x-service-token': apiToken,
          'Accept': 'application/json',
        },
      },
    )

    if (!response.ok) {
      console.error(`❌ API 请求失败 ${response.status}: ${await response.text()}`)
      process.exit(1)
    }

    const data = await response.json() as { data?: Array<{ code: string, title: string }> }
    moviesWithoutPlayers = data.data || []
    console.log(`✅ 找到 ${moviesWithoutPlayers.length} 部无播放源影片`)
  }
  catch (err) {
    console.error('❌ 获取影片列表失败:', err)
    process.exit(1)
  }

  if (moviesWithoutPlayers.length === 0) {
    console.log('\n🎉 所有影片均已有播放源，无需补充！')
    return
  }

  // Step 2：启动浏览器
  const browserManager = new BrowserManager({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
  })

  const strategy = new JavDBStrategy()
  const stats = { success: 0, noResult: 0, failed: 0 }

  try {
    await browserManager.launch()
    const page = await browserManager.createPage()

    for (const movie of moviesWithoutPlayers) {
      console.log(`\n🔍 处理: ${movie.code} — ${movie.title}`)

      try {
        await randomDelay()

        // 在 JavDB 搜索该影片
        const searchUrl = `${strategy.baseUrl}/?q=${encodeURIComponent(movie.code)}&f=all`

        // 先获取搜索结果页，找到详情页链接
        const listResult = await strategy.getMovieList(searchUrl, page)
        if (!listResult.movies || listResult.movies.length === 0) {
          console.log(`  ⚠️ JavDB 未找到: ${movie.code}`)
          stats.noResult++
          continue
        }

        // 取第一个结果（最相关）
        const detailUrl = listResult.movies[0]
        console.log(`  📄 详情页: ${detailUrl}`)

        await randomDelay()

        // 获取影片详情（包含磁力链接）
        const movieInfo = await strategy.getMovieInfo(detailUrl, page)

        if (!movieInfo.players || movieInfo.players.length === 0) {
          console.log(`  ⚠️ 未找到播放源: ${movie.code}`)
          stats.noResult++
          continue
        }

        console.log(`  ✅ 找到 ${movieInfo.players.length} 个播放源`)
        movieInfo.players.forEach(p => console.log(`    - [${p.quality || '?'}] ${p.sourceUrl.substring(0, 60)}...`))

        if (dryRun) {
          console.log(`  🚫 DRY-RUN：跳过写入`)
          stats.success++
          continue
        }

        // 写入数据库
        const result = await apiClient.syncMovie({
          code: movie.code,
          title: movie.title,
          players: movieInfo.players,
        })

        if (result) {
          console.log(`  💾 写入成功`)
          stats.success++
        }
        else {
          console.log(`  ❌ 写入失败`)
          stats.failed++
        }
      }
      catch (err) {
        console.error(`  ❌ 处理失败 (${movie.code}):`, err instanceof Error ? err.message : String(err))
        stats.failed++
      }
    }

    await page.close()
  }
  finally {
    await browserManager.close()
  }

  // Step 3：输出汇总
  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 处理汇总')
  console.log(`  ✅ 成功: ${stats.success}`)
  console.log(`  ⚠️ 未找到: ${stats.noResult}`)
  console.log(`  ❌ 失败: ${stats.failed}`)
  console.log('='.repeat(60))
}

main().catch((err) => {
  console.error('❌ 脚本运行失败:', err)
  process.exit(1)
})
