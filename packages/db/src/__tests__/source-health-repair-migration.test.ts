import { readFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'

async function createMigratedClient() {
  const client = createClient({ url: 'file::memory:' })
  await client.batch([
    { sql: 'PRAGMA foreign_keys = ON' },
    { sql: 'CREATE TABLE movie (id TEXT PRIMARY KEY NOT NULL)' },
    { sql: 'CREATE TABLE crawler_task (id TEXT PRIMARY KEY NOT NULL)' },
    { sql: 'CREATE TABLE crawler_run (id TEXT PRIMARY KEY NOT NULL)' },
  ], 'write')

  const migration = await readFile(
    fileURLToPath(new URL('../../drizzle/0030_source_health_repair.sql', import.meta.url)),
    'utf8',
  )
  const statements = migration
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(sql => ({ sql }))
  await client.batch(statements, 'write')

  return { client, migration }
}

async function insertObservation(
  client: Awaited<ReturnType<typeof createMigratedClient>>['client'],
  id: string,
  options: { readonly eventId?: string, readonly sourceRevision?: number } = {},
) {
  await client.execute({
    args: [id, 'movie-1', 'repair_players', 'run-1', 1, 1, options.eventId ?? 'event-1', options.sourceRevision ?? 1, 0, 'direct', 'failed', 1710000000, 'source_read_failed', 0],
    sql: `
      INSERT INTO movie_source_observation (
        id, movie_id, operation, run_id, attempt_number, sequence, event_id,
        source_revision, source_ordinal, source_type, health, observed_at,
        reason_code, eligible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  })
}

describe('source health repair migration', () => {
  it('creates operation, bounded observation fields, foreign keys, and replay indexes', async () => {
    const { client, migration } = await createMigratedClient()
    const taskColumns = await client.execute('PRAGMA table_info(crawler_task)')
    const observationColumns = await client.execute('PRAGMA table_info(movie_source_observation)')
    const foreignKeys = await client.execute('PRAGMA foreign_key_list(movie_source_observation)')
    const indexes = await client.execute('PRAGMA index_list(movie_source_observation)')

    expect(taskColumns.rows.map(column => String(column.name))).toContain('operation')
    expect(observationColumns.rows.map(column => String(column.name))).toEqual(expect.arrayContaining([
      'movie_id',
      'operation',
      'run_id',
      'attempt_number',
      'sequence',
      'event_id',
      'source_revision',
      'source_ordinal',
      'source_type',
      'health',
      'observed_at',
      'reason_code',
      'eligible',
    ]))
    expect(foreignKeys.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'movie', from: 'movie_id', to: 'id', on_delete: 'CASCADE' }),
      expect.objectContaining({ table: 'crawler_run', from: 'run_id', to: 'id', on_delete: 'CASCADE' }),
    ]))
    expect(indexes.rows.map(index => String(index.name))).toEqual(expect.arrayContaining([
      'idx_movie_source_observation_identity',
      'idx_movie_source_observation_run_event_source',
      'idx_movie_source_observation_movie_revision',
    ]))
    expect(migration).not.toMatch(/\b(raw[_ ]?url|page|exception|token|private[_ ]?key|signature)\b/iu)
  })

  it('rejects duplicate observation identity and duplicate run event source', async () => {
    const { client } = await createMigratedClient()
    await client.batch([
      { sql: 'INSERT INTO movie (id) VALUES (\'movie-1\')' },
      { sql: 'INSERT INTO crawler_run (id) VALUES (\'run-1\')' },
    ], 'write')
    await insertObservation(client, 'observation-1')

    await expect(insertObservation(client, 'observation-2')).rejects.toThrow(/UNIQUE constraint failed/u)
    await expect(insertObservation(client, 'observation-3', { sourceRevision: 2 })).rejects.toThrow(/UNIQUE constraint failed/u)
  })
})
