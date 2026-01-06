import { create, insert, save } from '@orama/orama'

export const searchSchema = {
  title: 'string',
  slug: 'string',
  author: 'string',
  description: 'string',
  cover: 'string',
} as const

export interface ComicDoc {
  title: string
  slug: string
  author?: string
  description?: string
  cover?: string
}

export class SearchIndexer {
  private db: any

  constructor() {
    // Initialized async
  }

  async build(documents: ComicDoc[]) {
    const db = await create({
      schema: searchSchema,
    })

    // eslint-disable-next-line no-console
    console.log(`Indexing ${documents.length} documents...`)

    // Batch insert is faster but simple loop is fine for < 10k items
    await insert(db, documents as any) // Type cast if needed depending on strictness

    return db
  }

  async serialize(db: any) {
    const saved = await save(db)
    return JSON.stringify(saved)
  }
}
