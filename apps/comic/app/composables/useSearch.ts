/* eslint-disable no-console */
import type { Orama } from '@orama/orama'
import { create, load, search as oramaSearch } from '@orama/orama'

const searchSchema = {
  title: 'string',
  slug: 'string',
  author: 'string',
  description: 'string',
  cover: 'string',
  region: 'string',
  status: 'string',
  genres: 'string[]',
} as const

type SearchDB = Orama<typeof searchSchema>

// Singleton state
let db: SearchDB | null = null
let isLoading = false
let initPromise: Promise<void> | null = null

export function useSearch() {
  const config = useRuntimeConfig()

  const init = async () => {
    if (db)
      return
    if (initPromise)
      return initPromise

    initPromise = (async () => {
      isLoading = true
      try {
        const indexUrl = `${config.public.r2Url}/system/search-index.json`
        console.log('🔍 Loading search index from:', indexUrl)

        // Use standard fetch to avoid Nuxt/Nitro hook overhead for large static files if needed,
        // but $fetch is fine.
        const data = await $fetch<any>(indexUrl)

        if (data) {
          db = await create({ schema: searchSchema })
          await load(db, data)
          console.log('✅ Search index loaded')
        }
      }
      catch (e) {
        console.error('❌ Failed to load search index:', e)
      }
      finally {
        isLoading = false
        initPromise = null
      }
    })()

    return initPromise
  }

  const search = async (term: string, limit = 10) => {
    if (!db)
      await init()
    if (!db)
      return []

    const results = await oramaSearch(db, {
      term,
      limit,
      properties: ['title', 'author', 'description', 'genres'], // Searchable fields
      boost: { title: 2, author: 1.5 },
    })

    return results.hits.map(hit => hit.document)
  }

  return {
    init,
    search,
    isReady: computed(() => !!db),
    isLoading: computed(() => isLoading),
  }
}
