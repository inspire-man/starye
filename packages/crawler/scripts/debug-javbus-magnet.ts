/**
 * 调试脚本：检查 JavBus 详情页磁链参数
 */
import process from 'node:process'
import { BrowserManager } from '../src/utils/browser'
import 'dotenv/config'

const code = process.argv[2] || 'ABF-336'
const baseUrl = 'https://www.javbus.com'

async function main() {
  const bm = new BrowserManager({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
  })

  await bm.launch()
  const page = await bm.createPage()

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7',
  })

  const url = `${baseUrl}/${code}`
  const urlObj = new URL(url)
  await page.setCookie(
    { name: 'existmag', value: 'all', domain: urlObj.hostname, path: '/' },
    { name: 'age_verified', value: '1', domain: urlObj.hostname, path: '/' },
  )

  console.log(`🔍 访问: ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))

  const info = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script')]
    let gid = ''
    let uc = ''
    let img = ''
    const scriptTexts: string[] = []

    for (const s of scripts) {
      const t = s.textContent || ''
      if (t.includes('gid') || t.includes('var uc')) {
        scriptTexts.push(t.substring(0, 200))
      }
      const g = t.match(/var\s+gid\s*=\s*(\d+)/)
      const u = t.match(/var\s+uc\s*=\s*(\d+)/)
      const i = t.match(/var\s+img\s*=\s*'([^']*)'/)
      if (g)
        gid = g[1]
      if (u)
        uc = u[1]
      if (i)
        img = i[1]
    }

    return {
      title: document.title,
      h3: document.querySelector('h3')?.textContent?.trim() || 'N/A',
      gid,
      uc,
      img: img.substring(0, 50),
      scriptCount: scripts.length,
      bodyLen: document.body.textContent?.length || 0,
      hasCloudflare: document.title.includes('Just a moment'),
      matchingScripts: scriptTexts,
    }
  })

  console.log('📊 页面信息:')
  console.log(`  Title: ${info.title}`)
  console.log(`  H3: ${info.h3}`)
  console.log(`  GID: ${info.gid || 'NOT FOUND'}`)
  console.log(`  UC: ${info.uc}`)
  console.log(`  IMG: ${info.img}`)
  console.log(`  Scripts: ${info.scriptCount}`)
  console.log(`  Body length: ${info.bodyLen}`)
  console.log(`  Cloudflare: ${info.hasCloudflare}`)
  console.log(`  Matching scripts: ${info.matchingScripts.length}`)
  info.matchingScripts.forEach((s, i) => console.log(`    [${i}]: ${s}`))

  if (info.gid) {
    const ajaxUrl = `${baseUrl}/ajax/uncledatoolsbyajax.php?gid=${info.gid}&lang=zh&img=${info.img}&uc=${info.uc}&floor=${Date.now()}`
    console.log(`\n🧲 AJAX URL: ${ajaxUrl}`)

    const magnets = await page.evaluate(async (fetchUrl: string) => {
      const resp = await fetch(fetchUrl, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (!resp.ok)
        return { error: `HTTP ${resp.status}`, html: '', allLinks: [] }

      const html = await resp.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const rows = doc.querySelectorAll('tr')
      const allLinks = Array.from(doc.querySelectorAll('a')).map(a => ({
        href: (a as HTMLAnchorElement).href?.substring(0, 80) || '',
        text: a.textContent?.trim().substring(0, 50) || '',
      }))

      const results: string[] = []
      rows.forEach((row) => {
        const a = row.querySelector('a[href^="magnet:"]') as HTMLAnchorElement | null
        if (a)
          results.push(a.href.substring(0, 80))
      })

      return {
        error: null,
        htmlLength: html.length,
        htmlSample: html.substring(0, 500),
        rowCount: rows.length,
        magnetCount: results.length,
        magnets: results,
        allLinks: allLinks.slice(0, 20),
      }
    }, ajaxUrl)

    console.log(`  Row count: ${magnets.rowCount}`)
    console.log(`  Magnet count: ${magnets.magnetCount}`)
    console.log(`  All links: ${magnets.allLinks?.length}`)
    magnets.allLinks?.forEach((l: any) => console.log(`    href=${l.href}  text=${l.text}`))
    console.log(`  HTML sample:`)
    console.log(magnets.htmlSample)
  }

  await bm.close()
  process.exit(0)
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
