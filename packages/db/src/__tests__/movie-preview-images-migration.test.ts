import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../../drizzle/0033_movie_preview_images.sql', import.meta.url)

describe('movie preview images migration', () => {
  it('adds the JSON-backed preview image column to movie records', async () => {
    const client = createClient({ url: 'file::memory:' })
    await client.execute(`
      CREATE TABLE movie (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL
      )
    `)

    const migration = await readFile(fileURLToPath(migrationPath.href), 'utf8')
    await client.execute(migration)
    await client.execute(`INSERT INTO movie (id, title, preview_images) VALUES ('movie-1', 'Preview fixture', '["https://cdn.example/preview.webp"]')`)

    const result = await client.execute(`PRAGMA table_info(movie)`)
    const previewColumn = result.rows.find(row => row.name === 'preview_images')
    expect(previewColumn).toMatchObject({ name: 'preview_images', type: 'TEXT' })

    const row = await client.execute(`SELECT preview_images FROM movie WHERE id = 'movie-1'`)
    expect(row.rows).toEqual([{ preview_images: '["https://cdn.example/preview.webp"]' }])
  })
})
