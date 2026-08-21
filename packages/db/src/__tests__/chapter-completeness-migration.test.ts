import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../../drizzle/0034_chapter_completeness_and_page_availability.sql', import.meta.url)

describe('chapter completeness migration', () => {
  it('creates revision-bound snapshot, projection and page availability tables', async () => {
    const client = createClient({ url: 'file::memory:' })
    await client.batch([
      { sql: 'PRAGMA foreign_keys = ON' },
      { sql: 'CREATE TABLE comic (id TEXT PRIMARY KEY NOT NULL)' },
      { sql: 'CREATE TABLE chapter (id TEXT PRIMARY KEY NOT NULL, comic_id TEXT NOT NULL)' },
    ], 'write')

    const migration = await readFile(fileURLToPath(migrationPath.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)

    const tables = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'comic_chapter_source_snapshot',
          'comic_chapter_source_row',
          'chapter_completeness_observation',
          'chapter_completeness_current',
          'chapter_page_availability_observation',
          'chapter_page_availability_current'
        )
      ORDER BY name
    `)
    expect(tables.rows.map(row => row.name)).toEqual([
      'chapter_completeness_current',
      'chapter_completeness_observation',
      'chapter_page_availability_current',
      'chapter_page_availability_observation',
      'comic_chapter_source_row',
      'comic_chapter_source_snapshot',
    ])

    const indexes = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type = 'index' AND name LIKE 'idx_chapter_page_availability_%'
      ORDER BY name
    `)
    expect(indexes.rows.length).toBeGreaterThanOrEqual(5)

    await client.execute(`INSERT INTO comic (id) VALUES ('comic-1')`)
    await client.execute(`INSERT INTO chapter (id, comic_id) VALUES ('comic-1-chapter-1', 'comic-1')`)
    await client.execute(`INSERT INTO chapter_page_availability_current (
      chapter_id, source_revision, policy_version, status, expected_page_count,
      stored_page_count, available_page_count, unavailable_page_count, unknown_page_count,
      findings_json, samples_json, observation_identity, observed_at
    ) VALUES ('comic-1-chapter-1', 1, 'chapter-page-probe/v1', 'available', 1, 1, 1, 0, 0, '[]', '[]', 'obs-1', 1700000000)`)
    await expect(client.execute(`SELECT chapter_id, source_revision FROM chapter_page_availability_current`)).resolves.toMatchObject({
      rows: [{ chapter_id: 'comic-1-chapter-1', source_revision: 1 }],
    })
  })
})
