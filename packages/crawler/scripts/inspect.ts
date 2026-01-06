import process from 'node:process'
import puppeteer from 'puppeteer-core'
import 'dotenv/config'

const TARGET_URL = process.argv[2] || 'https://www.92hm.life/'

async function inspect() {
  console.log(`馃敟 Inspecting: ${TARGET_URL}`)

  const executablePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

  const browser = await puppeteer.launch({
    executablePath,
    headless: false, // Show browser to see what's happening
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox'],
  })

  const page = await browser.newPage()

  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 })
    console.log('鉁 Page Loaded')

    // Extract Title
    const title = await page.title()
    console.log('Title:', title)

    // Dump body HTML structure (simplified) to console
    const body = await page.evaluate(() => {
      // Simple heuristic to find comic lists or chapter lists
      const links = Array.from(document.querySelectorAll('a')).slice(0, 20).map(a => ({
        text: a.textContent?.trim(),
        href: a.href,
        class: a.className,
      }))

      const images = Array.from(document.querySelectorAll('img')).slice(0, 5).map(img => ({
        src: img.src,
        alt: img.alt,
        class: img.className,
      }))

      return { links, images }
    })

    console.log('--- Sample Links ---')
    console.table(body.links)
    console.log('--- Sample Images ---')
    console.table(body.images)
  }
  catch (e) {
    console.error('Error:', e)
  }
  finally {
    // await browser.close() // Keep open for inspection
    console.log('Browser left open. Close manually.')
  }
}

inspect()
