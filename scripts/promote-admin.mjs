/* eslint-disable node/prefer-global/process */
// scripts/promote-admin.mjs
const API_URL = process.env.API_URL || 'http://localhost:8787'
const TOKEN = process.env.CRAWLER_SECRET || 'your-secret-token'

const email = process.argv[2]
const role = process.argv[3] || 'admin'

if (!email) {
  console.error('Usage: node scripts/promote-admin.mjs <email> [role]')
  process.exit(1)
}

async function main() {
  console.log(`👑 Promoting ${email} to ${role} on ${API_URL}...`)

  try {
    const res = await fetch(`${API_URL}/api/admin/users/${email}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-service-token': TOKEN,
      },
      body: JSON.stringify({ role }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('❌ Failed:', data)
      process.exit(1)
    }

    console.log('✅ Success:', data)
  }
  catch (e) {
    console.error('🚨 Connection Error:', e.message)
    console.log('Ensure API is running and accessible (Port 8787).')
  }
}

main()
