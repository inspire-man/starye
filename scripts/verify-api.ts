// verify-api.ts - Node 22+ (Zero Dependency)

const API_URL = 'http://127.0.0.1:8787'
const CRAWLER_SECRET = 'crawler_sk_7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a' // 与 apps/api/.dev.vars 保持一致

async function runTests() {
  console.log('🚀 Starting API Verification...\n')

  // 1. Health Check
  try {
    const res = await fetch(`${API_URL}/`)
    const data = await res.json() as any
    if (res.status === 200 && data.status === 'ok') {
      console.log('✅ Health Check: PASSED')
    }
    else {
      console.error('❌ Health Check: FAILED', data)
    }
  }
  catch (e: any) {
    console.error('❌ Health Check: ERROR. 是服务器没开还是端口错了？', e.message)
    import('node:process').then(process => process.exit(1))
  }

  // 2. Service Auth (Valid Token)
  try {
    const res = await fetch(`${API_URL}/api/admin/sync`, {
      method: 'POST',
      headers: {
        'x-service-token': CRAWLER_SECRET,
      },
    })
    const data = await res.json() as any
    if (res.status === 200 && data.success) {
      console.log('✅ Service Auth (Valid): PASSED')
    }
    else {
      console.error('❌ Service Auth (Valid): FAILED', res.status, data)
    }
  }
  catch (e: any) {
    console.error('❌ Service Auth: ERROR', e.message)
  }

  // 3. Service Auth (Invalid Token)
  try {
    const res = await fetch(`${API_URL}/api/admin/sync`, {
      method: 'POST',
      headers: {
        'x-service-token': 'wrong-token',
      },
    })
    if (res.status === 401) {
      console.log('✅ Service Auth (Invalid): PASSED')
    }
    else {
      console.error('❌ Service Auth (Invalid): FAILED (Expected 401)', res.status)
    }
  }
  catch (e: any) {
    console.error('❌ Service Auth: ERROR', e.message)
  }

  // 4. Upload Presign (Unauthorized)
  try {
    const res = await fetch(`${API_URL}/api/upload/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'test.jpg', contentType: 'image/jpeg' }),
    })
    if (res.status === 401) {
      console.log('✅ Upload Presign (No Auth): PASSED (Protected)')
    }
    else {
      console.error('❌ Upload Presign: FAILED (Expected 401)', res.status)
    }
  }
  catch (e: any) {
    console.error('❌ Upload Presign: ERROR', e.message)
  }

  console.log('\n🎨 Verification Complete.')
}

runTests()
