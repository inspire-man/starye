import type { Orama, TypedDocument } from '@orama/orama'
import { create, insert, save } from '@orama/orama'

export const searchSchema = {
  title: 'string',
  slug: 'string',
  author: 'string',
  description: 'string',
  cover: 'string',
  region: 'string',
  status: 'string',
  genres: 'string[]',
} as const

export type SearchSchema = typeof searchSchema

export interface ComicDoc extends TypedDocument<Orama<SearchSchema>> {
  title: string
  slug: string
  author: string
  description: string
  cover: string
  region: string
  status: string
  genres: string[]
}

export class SearchIndexer {
  // private db: Orama<SearchSchema> | undefined // Not really used as class prop in current logic

  constructor() {
    // Initialized async
  }

  async build(documents: ComicDoc[]) {
    const db = await create({
      schema: searchSchema,
    })

    // eslint-disable-next-line no-console
    console.log(`Indexing ${documents.length} documents...`)

    // Batch insert
    await insert(db, documents)

    return db
  }

  async serialize(db: Orama<SearchSchema>) {
    const saved = await save(db)
    return JSON.stringify(saved)
  }
}
