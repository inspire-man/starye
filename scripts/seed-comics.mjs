// scripts/seed-comics.mjs
const API_URL = 'http://localhost:8787/api/admin/sync'
const TOKEN = process.env.CRAWLER_SECRET || 'your-secret-token' 

const sampleComics = [
  {
    title: 'Testing R18 Protection',
    slug: 'test-r18-comic',
    cover: 'https://placehold.co/600x800/ff0000/ffffff?text=R18+Cover',
    author: 'Starye Test',
    description: 'This is a test comic to verify R18 protection logic. If you are not logged in, you should NOT see the cover.',
    chapters: [
      { title: 'Chapter 1', slug: 'chapter-1', url: 'http://example.com/1', number: 1 },
      { title: 'Chapter 2', slug: 'chapter-2', url: 'http://example.com/2', number: 2 }
    ]
  },
  {
    title: 'Safe Comic (Non-R18)',
    slug: 'test-safe-comic',
    cover: 'https://placehold.co/600x800/00ff00/000000?text=Safe+Cover',
    author: 'Starye Safe',
    description: 'This comic should be visible to everyone.',
    chapters: [
      { title: 'Chapter 1', slug: 'chapter-1', url: 'http://example.com/1', number: 1 }
    ]
  }
]

async function main() {
  console.log('🌱 Seeding comics to ' + API_URL)
  
  for (const comic of sampleComics) {
    console.log(`📤 Syncing: ${comic.title}`)
    
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': TOKEN
        },
        body: JSON.stringify({
          type: 'manga',
          data: comic
        })
      })

      if (!res.ok) {
        console.error('❌ Failed:', await res.text())
      } else {
        console.log('✅ Synced')
        
        // Post-sync: Lock the R18 one explicitly
        // (Because sync might default to DB default which is true, but let's be sure)
        if (comic.slug === 'test-r18-comic') {
            // By default our schema says isR18 = true, so we are good.
            // But let's verify or force it just in case.
            // Actually, for the Safe one, we might need to UNLOCK it.
        }
        
        if (comic.slug === 'test-safe-comic') {
           console.log('🔓 Unlocking safe comic...')
           await fetch(`http://localhost:8080/api/admin/comics/${comic.slug}`, {
               method: 'PATCH',
               headers: { 'Content-Type': 'application/json', 'x-service-token': TOKEN },
               body: JSON.stringify({ isR18: false })
           })
        }
      }
    } catch (e) {
      console.error('🚨 Connection Error:', e.message)
    }
  }
  
  console.log('✨ Seed completed.')
}

main()
