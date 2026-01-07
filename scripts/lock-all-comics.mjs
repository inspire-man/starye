// scripts/lock-all-comics.mjs
const API_URL = 'http://localhost:8080/api/admin/comics'
const TOKEN = process.env.CRAWLER_SECRET || 'your-secret-token' 

async function main() {
  console.log('🔄 Fetching comics list from ' + API_URL)
  
  try {
    const listRes = await fetch(API_URL, {
      headers: { 'x-service-token': TOKEN }
    })
    
    if (!listRes.ok) {
      console.error('❌ Failed to fetch list:', await listRes.text())
      return
    }
    
    const comics = await listRes.json()
    console.log(`Found ${comics.length} comics.`)

    for (const comic of comics) {
      console.log(`🔒 Locking R18 for: ${comic.title}`)
      const updateRes = await fetch(`http://localhost:8080/api/admin/comics/${comic.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-service-token': TOKEN 
        },
        body: JSON.stringify({ isR18: true })
      })
      
      if (updateRes.ok) {
        console.log('  ✅ Updated')
      } else {
        console.error('  ❌ Failed:', await updateRes.text())
      }
    }
    
    console.log('✨ All done. Refresh your page to see the lock.')
  } catch (e) {
    console.error('🚨 Connection Error:', e.message)
    console.log('\n💡 提示: 请确保 "pnpm dev" 正在运行且网关监听在 8080 端口。')
  }
}

main()
