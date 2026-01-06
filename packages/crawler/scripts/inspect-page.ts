import process from 'node:process'
import puppeteer from 'puppeteer-core'

const TARGET_URL = process.argv[2] || 'https://www.92hm.life/book/1130'

async function inspect() {
  console.log(`馃敟 Inspecting: ${TARGET_URL}`)

  const executablePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox'],
  })

  const page = await browser.newPage()

  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    console.log('鉁 Page Loaded')

    // Simplify evaluate to avoid serialization issues
    const candidates = await page.evaluate(() => {
      const results = []
      // Use standard loop instead of Array.from().map
      const elements = document.querySelectorAll('div, ul, ol')

      for (const el of Array.from(elements)) {
        // Basic heuristic        const links = el.querySelectorAll('a')
        if (links.length > 5) {
          results.push({
            tag: el.tagName.toLowerCase(),
            id: el.id,
            class: el.className,
            linksCount: links.length,
            firstLinkText: links[0]?.textContent?.trim().slice(0, 20) || '',
          })
        }
      }
      return results
    })

    console.log('--- Potential Chapter Containers ---')
    console.table(candidates)
  }
  catch (e) {
    console.error('Error:', e)
  }
  finally {
    // Keep open
  }
}

inspect()
