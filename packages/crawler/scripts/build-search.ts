import process from 'node:process'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { SearchIndexer } from '../src/lib/search'
import 'dotenv/config'

interface Comic {
  title: string
  slug: string
  author?: string | null
  description?: string | null
  coverImage?: string | null
}

async function main() {
  const API_URL = process.env.API_URL || 'http://localhost:8787'
  const INDEX_FILENAME = 'search-index.json'

  console.log(`🔥 Starting Search Index Build...`)
  console.log(`📡 Fetching data from ${API_URL}/api/comics`)

  // Check if we are in CI but trying to hit localhost
  if (process.env.CI && API_URL.includes('localhost')) {
    console.warn('⚠️  [WARNING] CI environment detected but API_URL is localhost. Skipping index build.')
    console.warn('  Please configure API_URL secret to point to your deployed API.')
    return
  }

  try {
    // 1. Fetch Data
    let response
    try {
      // Set a high limit to fetch all comics (assuming < 10000 for now)
      // Ideally this should support pagination traversal
      response = await fetch(`${API_URL}/api/comics?limit=10000`)
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      if ((e as any).cause?.code === 'ECONNREFUSED' || message.includes('fetch failed')) {
        console.warn(`⚠️  [WARNING] API is not accessible (${message}). Skipping index build.`)
        // Ensure we don't fail the CI job for this auxiliary step
        return
      }
      throw e
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch comics: ${response.statusText}`)
    }

    // API returns { data: Comic[], meta: ... }
    const json = await response.json() as { data: Comic[] }
    const comics = json.data
    console.log(`✅ Fetched ${comics.length} comics`)

    // 2. Build Index
    const indexer = new SearchIndexer()
    const documents = comics.map(c => ({
      id: c.slug,
      title: c.title,
      slug: c.slug,
      author: c.author || '',
      description: c.description || '',
      cover: c.coverImage || '',
    }))

    const db = await indexer.build(documents)
    const serialized = await indexer.serialize(db)
    const sizeKB = (serialized.length / 1024).toFixed(2)

    console.log(`✅ Index built. Size: ${sizeKB} KB`)

    // 3. Upload to R2
    const r2Config = {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucketName: process.env.R2_BUCKET_NAME!,
    }

    if (!r2Config.bucketName || r2Config.bucketName === 'mock') {
      console.warn('⚠️  R2 Config missing or mock, skipping upload.')
      // Write to disk for local check
      // await import('fs/promises').then(fs => fs.writeFile('search-index.json', serialized))
      return
    }

    console.log('📤 Uploading to R2...')
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    })

    const upload = new Upload({
      client: s3,
      params: {
        Bucket: r2Config.bucketName,
        Key: `system/${INDEX_FILENAME}`, // Store in system/ folder
        Body: serialized,
        ContentType: 'application/json',
        CacheControl: 'public, max-age=300', // 5 min cache
      },
    })

    await upload.done()
    console.log(`✅ Index uploaded to R2: system/${INDEX_FILENAME}`)
  }
  catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

main()
