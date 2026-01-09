import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import puppeteer from 'puppeteer-core'

// 从命令行参数获取 URL，如果没有则使用指定的默认值
const TARGET_URL = process.argv[2] || 'https://www.92hm.life/book/826'
const OUTPUT_FILENAME = process.argv[3] || 'page_content.html'

async function dumpHtml() {
  console.log(`🔍 Dumping HTML from: ${TARGET_URL}`)

  // 自动查找本地安装的 Chrome 或 Edge
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  const executablePath = possiblePaths.find(path => existsSync(path))

  if (!executablePath) {
    console.error('❌ Could not find a local installation of Chrome or Edge.')
    process.exit(1)
  }
  console.log(`✅ Found browser: ${executablePath}`)

  const browser = await puppeteer.launch({
    executablePath,
    headless: true, // 使用无头模式可以提高速度
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  try {
    // 增加超时时间并等待网络空闲，确保动态内容加载完成
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 })
    console.log('✅ Page loaded successfully.')

    const htmlContent = await page.content()
    const outputPath = join(process.cwd(), OUTPUT_FILENAME)

    await writeFile(outputPath, htmlContent, 'utf-8')
    console.log(`📄 HTML content has been saved to: ${outputPath}`)
  }
  catch (e) {
    console.error('❌ Error fetching page:', e)
  }
  finally {
    await browser.close()
    console.log('🚪 Browser closed.')
  }
}

dumpHtml()
