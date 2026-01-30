/**
 * 反爬虫检测测试脚本
 * 用于诊断 JavBus 爬虫是否被反爬虫机制拦截
 */

import process from 'node:process'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

const TEST_URLS = [
  'https://www.javbus.com',
  'https://busdmm.bond',
  'https://www.javbus.com/SSIS-001', // 示例详情页
]

async function testAntiDetection() {
  console.log('🔍 开始反爬虫检测测试...\n')

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH

  const browser = await puppeteer.launch({
    executablePath,
    headless: false, // 使用有头模式，方便观察
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--lang=zh-CN,zh',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  })

  for (const url of TEST_URLS) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`📄 测试 URL: ${url}`)
    console.log('='.repeat(80))

    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    // 设置 User-Agent
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    await page.setUserAgent(UA)

    // 设置请求头
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    })

    // 注入反检测脚本
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      })
      // @ts-expect-error - Type 'Window' has no properties named 'chrome'
      window.chrome = {
        runtime: {},
      }

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })

      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en'],
      })
    })

    // 设置 Cookie
    const urlObj = new URL(url)
    const domain = urlObj.hostname
    await page.setCookie(
      { name: 'existmag', value: 'all', domain, path: '/' },
      { name: 'age_verified', value: '1', domain, path: '/' },
      { name: 'dv', value: '1', domain, path: '/' },
    )

    try {
      console.log('⏳ 正在访问页面...')
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })

      console.log(`📊 HTTP 状态码: ${response?.status()}`)

      // 等待一下，让页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 检测页面状态
      const pageInfo = await page.evaluate(() => {
        const title = document.title
        const bodyText = document.body.textContent || ''
        const bodyLength = bodyText.length

        // 检测各种拦截标志
        const indicators = {
          cloudflare: title.includes('Just a moment') || title.includes('DDoS protection'),
          driverVerify: title.includes('driver-verify') || bodyText.includes('Driver Knowledge Test'),
          ageVerification: bodyText.includes('Age Verification') || bodyText.includes('年龄认证'),
          hasMovieBox: document.querySelectorAll('.movie-box').length > 0,
          hasContent: document.querySelector('h3') !== null,
        }

        return {
          title,
          bodyLength,
          indicators,
          url: location.href,
        }
      })

      console.log('\n📋 页面信息:')
      console.log(`  标题: ${pageInfo.title}`)
      console.log(`  内容长度: ${pageInfo.bodyLength} 字符`)
      console.log(`  当前 URL: ${pageInfo.url}`)

      console.log('\n🔍 检测结果:')
      if (pageInfo.indicators.driverVerify) {
        console.log('  ❌ 检测到 Driver Verify 挑战 - IP 已被封禁！')
        console.log('  建议: 更换 IP 或使用代理')
      }
      else if (pageInfo.indicators.cloudflare) {
        console.log('  ⚠️  检测到 Cloudflare 挑战')
        console.log('  建议: 等待挑战完成或降低访问频率')
      }
      else if (pageInfo.indicators.ageVerification) {
        console.log('  ℹ️  检测到年龄验证页面')
        console.log('  建议: Cookie 可能未生效，需要手动点击')
      }
      else if (pageInfo.indicators.hasMovieBox || pageInfo.indicators.hasContent) {
        console.log('  ✅ 页面加载成功！')
        console.log(`  找到 ${pageInfo.indicators.hasMovieBox ? '电影列表' : '详情内容'}`)
      }
      else if (pageInfo.bodyLength < 100) {
        console.log('  ⚠️  页面内容异常短，可能被拦截')
      }
      else {
        console.log('  ⚠️  页面状态未知，请手动检查浏览器窗口')
      }

      // 截图保存
      const filename = `test-${domain}-${Date.now()}.png`
      await page.screenshot({ path: filename, fullPage: true })
      console.log(`\n📸 截图已保存: ${filename}`)

      // 保持页面打开 10 秒，方便观察
      console.log('\n⏳ 页面将保持打开 10 秒，请观察浏览器窗口...')
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
    catch (e: unknown) {
      if (e instanceof Error) {
        console.error(`\n❌ 错误: ${e.message}`)
      }
      else {
        console.error(`\n❌ 错误: ${String(e)}`)
      }
    }
    finally {
      await page.close()
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('✅ 测试完成！')
  console.log('='.repeat(80))

  await browser.close()
}

// 运行测试
testAntiDetection().catch(console.error)
