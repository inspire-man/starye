/* eslint-disable no-console */
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

async function test() {
  console.log('Starting local test for JavBus with enhanced stealth...')
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--lang=zh-CN,zh',
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    // Set standard headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    })

    const url = 'https://www.busdmm.bond'
    const urlObj = new URL(url)
    const domain = urlObj.hostname
    const rootDomain = domain.split('.').slice(-2).join('.')

    const domains = [domain, `.${domain}`, rootDomain, `.${rootDomain}`]
    const uniqueDomains = [...new Set(domains)]

    const cookies: any[] = []
    for (const d of uniqueDomains) {
      cookies.push(
        { name: 'existmag', value: 'all', domain: d, path: '/', expires: Date.now() / 1000 + 31536000 },
        { name: 'age_verified', value: '1', domain: d, path: '/', expires: Date.now() / 1000 + 31536000 },
        { name: 'dv', value: '1', domain: d, path: '/', expires: Date.now() / 1000 + 31536000 },
      )
    }

    await page.setCookie(...cookies)
    console.log(`[Test] Navigating to ${url}...`)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    await new Promise(r => setTimeout(r, 2000))

    let title = await page.title()
    let currentUrl = page.url()
    console.log(`[Test] Current Title: ${title}`)
    console.log(`[Test] Current URL: ${currentUrl}`)

    if (currentUrl.includes('driver-verify')) {
      console.log('[Test] 🛑 ALERT: Driver Knowledge Test Detected! Stealth failed or IP is blocked.')
    }

    if (title.includes('Age Verification')) {
      console.log('[Test] Age Verification detected. Attempting click...')
      const clicked = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('a, button, div, span'))
        const keywords = ['成年', 'ENTER', 'YES', '进入', '進入']
        for (const el of elements) {
          const txt = el.textContent?.trim() || ''
          if (keywords.some(k => txt.includes(k)) && txt.length < 20) {
            (el as HTMLElement).click()
            return true
          }
        }
        return false
      })
      if (clicked) {
        console.log('[Test] Clicked. Waiting for navigation...')
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
        title = await page.title()
        currentUrl = page.url()
        console.log(`[Test] Final URL: ${currentUrl}`)
        console.log(`[Test] Final Title: ${title}`)
      }
    }

    const movieBoxes = await page.$$('.movie-box')
    console.log(`[Test] Movie boxes found: ${movieBoxes.length}`)

    if (movieBoxes.length > 0) {
      console.log('[Test] ✅ SUCCESS: Bypassed verification!')
    }
    else {
      console.log('[Test] ❌ FAILURE: Still blocked or verify failed.')
    }
  }
  catch (err: any) {
    console.error('[Test] 💥 Error:', err.message)
  }
  finally {
    await browser.close()
    console.log('[Test] Browser closed.')
  }
}

test()
