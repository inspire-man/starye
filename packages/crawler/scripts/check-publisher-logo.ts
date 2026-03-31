/* eslint-disable node/prefer-global/process */
/**
 * 检查 SeesaaWiki 厂商页面的 logo
 */

import puppeteer from 'puppeteer'
import 'dotenv/config'

async function checkPublisherLogo() {
  console.log('🔍 检查 SeesaaWiki 厂商页面 logo\n')

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  })

  try {
    const page = await browser.newPage()
    const testCases = [
      {
        name: 'SEX MACHINE',
        url: 'https://seesaawiki.jp/w/sougouwiki/d/%53%45%58%20%4d%41%43%48%49%4e%45%20%77%69%6b%69',
      },
      {
        name: 'ZOOO',
        url: 'https://seesaawiki.jp/w/sougouwiki/d/%5a%4f%4f%4f%20%77%69%6b%69',
      },
      {
        name: 'OLYMPUS',
        url: 'https://seesaawiki.jp/w/sougouwiki/d/%4f%4c%59%4d%50%55%53%20%77%69%6b%69',
      },
    ]

    for (const testCase of testCases) {
      console.log(`\n📄 检查厂商: ${testCase.name}`)
      console.log(`   URL: ${testCase.url}`)

      await page.goto(testCase.url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // 检查页面标题
      const title = await page.title()
      console.log(`   标题: ${title}`)

      // 检查是否是404页面
      const is404 = await page.evaluate(() => {
        return document.body.textContent?.includes('ページが見つかりませんでした')
      })

      if (is404) {
        console.log('   ❌ 页面不存在（404）')
        continue
      }

      // 提取logo
      const logoInfo = await page.evaluate(() => {
        // 查找表格中的logo行
        const tables = document.querySelectorAll('table')
        for (const table of tables) {
          const rows = table.querySelectorAll('tr')
          for (const row of rows) {
            const header = row.querySelector('th')?.textContent?.trim()
            if (header === 'ロゴ') {
              const img = row.querySelector('img')
              if (img) {
                return {
                  src: img.src,
                  alt: img.alt,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                }
              }
            }
          }
        }

        // 检查是否有任何图片
        const allImages = document.querySelectorAll('img')
        return {
          totalImages: allImages.length,
          imageSrcs: Array.from(allImages).slice(0, 5).map(img => ({
            src: img.src,
            alt: img.alt,
          })),
        }
      })

      console.log(`   Logo 信息:`, logoInfo)
    }

    console.log('\n✅ 检查完成')
  }
  finally {
    await browser.close()
  }
}

checkPublisherLogo().catch(console.error)
