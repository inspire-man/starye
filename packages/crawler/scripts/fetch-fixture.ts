/**
 * A simple script to fetch the HTML content of a URL and save it to a file.
 * Uses Puppeteer with Stealth Plugin to bypass some anti-bot measures.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import 'dotenv/config'

// Add stealth plugin and use it
puppeteer.use(StealthPlugin())

const [url, outputFile] = process.argv.slice(2)

if (!url || !outputFile) {
  console.error('Usage: tsx scripts/fetch-fixture.ts <url> <output-file>')
  process.exit(1)
}

async function fetchAndSave() {
  console.log(`🌍 Fetching HTML (with Stealth) from: ${url}`)

  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')

    // Wait for the page to load and potentially handle Cloudflare challenge
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 })

    // Give it a bit more time if it's a "Wait 5 seconds" page
    const title = await page.title()
    if (title.includes('请稍候') || title.includes('Checking your browser')) {
      console.log('⏳ Cloudflare challenge detected, waiting 10s...')
      await new Promise(resolve => setTimeout(resolve, 10000))
    }

    const content = await page.content()

    const outputDir = path.dirname(outputFile)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    fs.writeFileSync(outputFile, content, 'utf-8')
    console.log(`✅ HTML content saved to: ${outputFile}`)
    console.log(`Title: ${await page.title()}`)
  }
  catch (e) {
    console.error(`❌ Error fetching or saving the page:`, e)
    process.exit(1)
  }
  finally {
    await browser?.close()
  }
}

fetchAndSave()
