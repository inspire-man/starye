import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import got from 'got'
import { Window } from 'happy-dom'
import { parseMovieInfo } from '../src/strategies/javdb-parser'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_URL = process.env.API_URL || 'http://localhost:8787'
const CRAWLER_SECRET = process.env.CRAWLER_SECRET || 'mock'

async function testSync() {
  console.log('🧪 Starting Movie Sync Smoke Test...')

  // 1. 读取并解析本地 HTML
  const fixturePath = path.join(__dirname, '../test/fixtures/javdb-detail.html')
  if (!fs.existsSync(fixturePath)) {
    console.error(`❌ Fixture not found at: ${fixturePath}`)
    return
  }

  const html = fs.readFileSync(fixturePath, 'utf-8')
  const window = new Window()
  const document = window.document
  document.write(html)

  const url = 'https://javdb457.com/v/Ywmd3e'
  const info = parseMovieInfo(document as any, url)
  console.log(`✅ Parsed movie: ${info.title} (${info.code})`)
  console.log(`   Players found: ${info.players.length}`)

  // 2. 发送到 API
  console.log(`📡 Sending to API: ${API_URL}/api/admin/sync ...`)
  try {
    const response: any = await got.post(`${API_URL}/api/admin/sync`, {
      json: {
        type: 'movie',
        data: info,
      },
      headers: {
        'x-service-token': CRAWLER_SECRET,
      },
    }).json()

    console.log('🎉 API Response:', response)

    if (response.success) {
      console.log('🚀 Smoke test PASSED!')
    }
    else {
      console.error('❌ Smoke test FAILED: API returned success=false')
    }
  }
  catch (e: any) {
    console.error('❌ API Error:', e.response?.body || e.message)
    console.log('\n💡 Tip: Make sure your API is running with "pnpm --filter api dev"')
  }
}

testSync().catch(console.error)
