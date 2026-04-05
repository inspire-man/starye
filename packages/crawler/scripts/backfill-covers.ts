/**
 * 封面图恢复脚本
 * 为 coverImage 为 null 的影片从 JavBus 重新获取封面图，
 * 通过 ImageProcessor 上传至 R2，存入 CDN URL（与正常爬虫流程一致）。
 * 若未配置 R2，则回退存储 JavBus 原始 URL。
 */

import process from 'node:process'
import { ImageProcessor } from '../src/lib/image-processor'
import 'dotenv/config'

const API_URL = process.env.API_URL || 'http://localhost:8787'
const TOKEN = process.env.CRAWLER_SECRET || ''

// JavBus 主站及镜像站列表
const JAVBUS_HOSTS = [
  'https://www.javbus.com',
  'https://www.busdmm.bond',
]

// 尝试初始化 R2 上传器，配置不完整则返回 null（回退到直接存 JavBus URL）
function createImageProcessor(): ImageProcessor | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || ''
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || ''
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || ''
  const bucketName = process.env.R2_BUCKET_NAME || ''
  const publicUrl = process.env.R2_PUBLIC_URL || ''

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    console.warn('⚠️  R2 配置不完整，将直接存储 JavBus 原始 URL（非 CDN URL）')
    return null
  }

  try {
    return new ImageProcessor({ accountId, accessKeyId, secretAccessKey, bucketName, publicUrl })
  }
  catch (e: any) {
    console.warn(`⚠️  R2 初始化失败: ${e.message}，将直接存储 JavBus URL`)
    return null
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8',
        'Referer': 'https://www.javbus.com/',
      },
    })
  }
  finally {
    clearTimeout(timer)
  }
}

// 从 HTML 提取 og:image 或 .bigImage img src，相对路径补全为绝对 URL
function extractCoverImage(html: string, baseHost: string): string | null {
  let rawUrl: string | null = null

  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (ogMatch?.[1])
    rawUrl = ogMatch[1]

  if (!rawUrl) {
    const imgMatch = html.match(/class=["']bigImage["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
    if (imgMatch?.[1])
      rawUrl = imgMatch[1]
  }

  if (!rawUrl)
    return null

  if (rawUrl.startsWith('//'))
    return `https:${rawUrl}`
  if (rawUrl.startsWith('/'))
    return `${baseHost}${rawUrl}`
  return rawUrl
}

async function getJavBusCoverUrl(code: string): Promise<string | null> {
  for (const host of JAVBUS_HOSTS) {
    try {
      const res = await fetchWithTimeout(`${host}/${code}`, 12000)
      if (!res.ok)
        continue
      const html = await res.text()
      const cover = extractCoverImage(html, host)
      if (cover)
        return cover
    }
    catch {
      // 尝试下一个镜像站
    }
  }
  return null
}

// 上传到 R2，返回 CDN preview URL；失败则返回原始 JavBus URL 作为降级
async function uploadToR2(imageProcessor: ImageProcessor, code: string, javbusUrl: string): Promise<string> {
  try {
    const results = await imageProcessor.process(
      javbusUrl,
      `movies/${code}`,
      'cover',
      'https://www.javbus.com/',
    )
    const preview = results.find(r => r.variant === 'preview')
    return preview?.url ?? javbusUrl
  }
  catch (e: any) {
    console.warn(`    ⚠️ R2 上传失败 (${code}): ${e.message}，回退存储原始 URL`)
    return javbusUrl
  }
}

async function syncCoverImage(code: string, coverImage: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/movies/sync`, {
    method: 'POST',
    headers: {
      'x-service-token': TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      movies: [{ code, coverImage }],
      mode: 'update',
    }),
  })
  if (!res.ok)
    return false
  const data: any = await res.json()
  return (data.result?.success ?? 0) > 0
}

async function fetchMoviesPage(page: number, limit = 100) {
  const res = await fetch(`${API_URL}/api/admin/movies?limit=${limit}&page=${page}`, {
    headers: { 'x-service-token': TOKEN },
  })
  if (!res.ok)
    throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<any>
}

async function main() {
  if (!TOKEN) {
    console.error('❌ 未设置 CRAWLER_SECRET')
    process.exit(1)
  }

  const imageProcessor = createImageProcessor()
  const useR2 = imageProcessor !== null

  console.log('🖼️  开始恢复影片封面图')
  console.log(`📡 API: ${API_URL}`)
  console.log(`☁️  上传模式: ${useR2 ? 'R2 CDN（标准流程）' : 'JavBus 原始 URL（降级）'}`)
  console.log()

  const DELAY = Number.parseInt(process.env.COVER_DELAY || '2000')
  const MAX_MOVIES = Number.parseInt(process.env.MAX_MOVIES || '999999')

  let totalProcessed = 0
  let totalRestored = 0
  let totalFailed = 0

  const firstPage = await fetchMoviesPage(1)
  const totalPages = firstPage.meta.totalPages
  console.log(`📊 总影片数: ${firstPage.meta.total}，共 ${totalPages} 页`)
  console.log()

  let done = false
  for (let page = 1; page <= totalPages && !done; page++) {
    const pageData = page === 1 ? firstPage : await fetchMoviesPage(page)
    const movies: any[] = pageData.data
    const noCover = movies.filter((m: any) => !m.coverImage)

    if (noCover.length === 0) {
      console.log(`  第 ${page}/${totalPages} 页: 无需恢复`)
      continue
    }

    console.log(`  第 ${page}/${totalPages} 页: ${noCover.length} 部需要恢复...`)

    for (const movie of noCover) {
      if (totalProcessed >= MAX_MOVIES) {
        done = true
        break
      }

      process.stdout.write(`    [${movie.code}] `)

      try {
        const javbusUrl = await getJavBusCoverUrl(movie.code)
        if (!javbusUrl) {
          console.log('未找到封面')
          totalFailed++
          totalProcessed++
          continue
        }

        // 有 R2 配置则上传，否则直接用 JavBus URL
        const finalUrl = useR2
          ? await uploadToR2(imageProcessor!, movie.code, javbusUrl)
          : javbusUrl

        const ok = await syncCoverImage(movie.code, finalUrl)
        if (ok) {
          const isR2 = finalUrl.includes(process.env.R2_PUBLIC_URL || 'cdn.starye.org')
          console.log(`✅ ${isR2 ? '[CDN]' : '[JavBus]'} ${finalUrl.substring(0, 70)}`)
          totalRestored++
        }
        else {
          console.log('❌ 同步失败')
          totalFailed++
        }
      }
      catch (e: any) {
        console.log(`❌ 错误: ${e.message}`)
        totalFailed++
      }

      totalProcessed++

      if (totalProcessed % 10 === 0)
        await new Promise(r => setTimeout(r, DELAY * 2))
      else
        await new Promise(r => setTimeout(r, DELAY))
    }

    console.log(`    ✅ 第 ${page} 页完成，累计 ${totalProcessed} 部`)
  }

  console.log()
  console.log('✅ 封面图恢复完成!')
  console.log(`📊 成功: ${totalRestored}，失败: ${totalFailed}，共处理: ${totalProcessed}`)
}

main().catch((e) => {
  console.error('❌ 脚本执行失败:', e)
  process.exit(1)
})
