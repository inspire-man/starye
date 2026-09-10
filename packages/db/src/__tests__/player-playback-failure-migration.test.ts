import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../../drizzle/0050_player_playback_failure.sql', import.meta.url)

describe('player playback failure migration', () => {
  it('adds last playback failure columns and index to player', async () => {
    const client = createClient({ url: 'file::memory:' })
    await client.execute(`
      CREATE TABLE player (
        id TEXT PRIMARY KEY NOT NULL,
        movie_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        sort_order INTEGER NOT NULL
      )
    `)

    const migration = await readFile(fileURLToPath(migrationPath.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(item => item.trim()).filter(Boolean))
      await client.execute(statement)

    const columns = await client.execute('PRAGMA table_info(player)')
    const names = columns.rows.map(row => String(row.name))
    expect(names).toEqual(expect.arrayContaining([
      'last_playback_status',
      'last_playback_reason',
      'last_playback_at',
    ]))
    const indexes = await client.execute('PRAGMA index_list(player)')
    expect(indexes.rows.map(row => String(row.name))).toContain('idx_player_last_playback_status')
  })
})
