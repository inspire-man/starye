/**
 * 基于 JavBus 的播放源补充脚本
 * 对无播放源的影片，通过 JavBus AJAX 磁链接口批量补充。
 * JavDB 被 Cloudflare 拦截时可用此脚本作为替代。
 *
 * 用法：
 *   npx tsx src/scripts/enrich-players-javbus.ts [--limit 50] [--dry-run]
 */

import process from 'node:process'
import { BrowserManager } from '../utils/browser'
import 'dotenv/config'

const JAVBUS_MIRRORS = [
  'https://www.javbus.com',
  'https://www.busdmm.fun',
  'https://www.busfan.ink',
]

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * 4000) + 5000
  console.log(`⏳ 等待 ${(ms / 1000).toFixed(1)}s...`)
  await sleep(ms)
}

async function main() {
  const { limit, dryRun } = parseArgs()

  const apiUrl = process.env.API_URL || 'http://localhost:8787'
  const apiToken = process.env.SERVICE_TOKEN || process.env.CRAWLER_SECRET || ''
  const baseUrl = process.env.JAVBUS_MIRROR || JAVBUS_MIRRORS[0]

  console.log('='.repeat(60))
  console.log('🧲 播放源补充脚本 (JavBus 磁链)')
  console.log(`📌 API: ${apiUrl}`)
  console.log(`📌 镜像: ${baseUrl}`)
  console.log(`📌 限制: ${limit} 部影片`)
  console.log(`📌 模式: ${dryRun ? 'DRY-RUN（不写入）' : '写入数据库'}`)
  console.log('='.repeat(60))

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

    const data = await response.json() as { data?: Array<{ code: string, title: string }>, meta?: { total: number } }
    moviesWithoutPlayers = data.data || []
    console.log(`✅ 找到 ${moviesWithoutPlayers.length} 部无播放源影片 (总计 ${data.meta?.total || '?'})`)
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

  const stats = { success: 0, noResult: 0, failed: 0 }

  try {
    await browserManager.launch()
    const page = await browserManager.createPage()

    // 设置基本请求头和 Cookie
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7',
    })

    for (const movie of moviesWithoutPlayers) {
      console.log(`\n🔍 处理: ${movie.code} — ${movie.title}`)

      try {
        await randomDelay()

        const movieUrl = `${baseUrl}/${movie.code}`
        console.log(`  📄 访问: ${movieUrl}`)

        // 设置 Cookie
        const urlObj = new URL(movieUrl)
        await page.setCookie(
          { name: 'existmag', value: 'all', domain: urlObj.hostname, path: '/' },
          { name: 'age_verified', value: '1', domain: urlObj.hostname, path: '/' },
        )

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

        // 等待页面加载
        try {
          await page.waitForSelector('h3', { timeout: 10000 })
        }
        catch {
          console.log(`  ⚠️ 页面加载超时，跳过`)
          stats.noResult++
          continue
        }

        // 检查是否到达正确页面
        const pageTitle = await page.title()
        if (pageTitle.includes('Just a moment') || pageTitle.includes('DDoS')) {
          console.log(`  ⚠️ Cloudflare 挑战，等待通过...`)
          await sleep(10000)
        }

        // 提取 AJAX 参数
        const ajaxParams = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script')
          let gid = ''
          let uc = '0'
          let img = ''

          for (const script of scripts) {
            const text = script.textContent || ''
            const gidMatch = text.match(/var\s+gid\s*=\s*(\d+)/)
            const ucMatch = text.match(/var\s+uc\s*=\s*(\d+)/)
            const imgMatch = text.match(/var\s+img\s*=\s*'([^']*)'/)
            if (gidMatch)
              gid = gidMatch[1]
            if (ucMatch)
              uc = ucMatch[1]
            if (imgMatch)
              img = imgMatch[1]
          }

          return { gid, uc, img, origin: window.location.origin }
        })

        if (!ajaxParams.gid) {
          console.log(`  ⚠️ 未找到磁链参数 (gid)，可能页面不正确`)
          stats.noResult++
          continue
        }

        // 通过 AJAX 获取磁链
        const ajaxUrl = `${ajaxParams.origin}/ajax/uncledatoolsbyajax.php?gid=${ajaxParams.gid}&lang=zh&img=${ajaxParams.img}&uc=${ajaxParams.uc}&floor=${Date.now()}`

        const players = await page.evaluate(async (fetchUrl: string) => {
          const resp = await fetch(fetchUrl, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
          })
          if (!resp.ok)
            return []

          const html = await resp.text()
          const parser = new DOMParser()
          // AJAX 返回的是 <tr> 片段，需包裹 <table> 才能正确解析
          const doc = parser.parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html')
          const rows = doc.querySelectorAll('tr')

          const seen = new Set<string>()
          const results: Array<{ sourceName: string, sourceUrl: string, quality: string, sortOrder: number }> = []
          let sortIdx = 0

          rows.forEach((row) => {
            const magnetLink = row.querySelector('a[href^="magnet:"]') as HTMLAnchorElement | null
            if (!magnetLink)
              return

            const magnetUrl = magnetLink.href.split('&')[0]
            if (seen.has(magnetUrl))
              return
            seen.add(magnetUrl)

            const tds = row.querySelectorAll('td')
            const nameEl = tds[0]?.querySelector('a')
            const name = nameEl?.textContent?.trim() || ''
            const sizeEl = tds[1]
            const size = sizeEl?.textContent?.trim() || ''
            const hasSubtitle = row.querySelector('.is-warning') !== null
            const label = hasSubtitle ? `磁力(字幕) - ${name}` : `磁力 - ${name}`

            results.push({
              sourceName: label.substring(0, 100),
              sourceUrl: magnetUrl,
              quality: size,
              sortOrder: sortIdx++,
            })
          })

          return results
        }, ajaxUrl)

        if (!players || players.length === 0) {
          console.log(`  ⚠️ 未找到磁力链接`)
          stats.noResult++
          continue
        }

        console.log(`  ✅ 找到 ${players.length} 个磁力链接`)
        players.forEach(p => console.log(`    - [${p.quality || '?'}] ${p.sourceUrl.substring(0, 60)}...`))

        if (dryRun) {
          console.log(`  🚫 DRY-RUN：跳过写入`)
          stats.success++
          continue
        }

        // 写入数据库
        const syncResult = await fetch(`${apiUrl}/api/movies/sync`, {
          method: 'POST',
          headers: {
            'x-service-token': apiToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            movies: [{
              code: movie.code,
              title: movie.title,
              players,
            }],
            mode: 'upsert',
          }),
        })

        if (syncResult.ok) {
          console.log(`  💾 写入成功`)
          stats.success++
        }
        else {
          console.log(`  ❌ 写入失败: ${syncResult.status}`)
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
