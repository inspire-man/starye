import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'

const migrationPaths = [
  new URL('../../drizzle/0036_quant_workbench.sql', import.meta.url),
  new URL('../../drizzle/0037_quant_sync_lease.sql', import.meta.url),
  new URL('../../drizzle/0038_quant_watchlist_seed.sql', import.meta.url),
  new URL('../../drizzle/0039_quant_research_marker.sql', import.meta.url),
  new URL('../../drizzle/0041_quant_user_scope.sql', import.meta.url),
  new URL('../../drizzle/0042_quant_research_run.sql', import.meta.url),
  new URL('../../drizzle/0043_quant_research_summary.sql', import.meta.url),
  new URL('../../drizzle/0044_quant_candidate_ai_session.sql', import.meta.url),
  new URL('../../drizzle/0045_quant_factor_config.sql', import.meta.url),
]

async function createMigratedClient() {
  const client = createClient({ url: 'file::memory:' })
  await client.execute('PRAGMA foreign_keys = ON')
  await client.execute('CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL)')
  await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-1\', 1)')
  for (const migrationPath of migrationPaths) {
    const migration = await readFile(fileURLToPath(migrationPath.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }
  return client
}

describe('quant candidate AI session migration', () => {
  it('creates the session shape, provider field and required user indexes', async () => {
    const client = await createMigratedClient()

    const columns = await client.execute('PRAGMA table_info(quant_candidate_ai_session)')
    expect(columns.rows.map(row => String(row.name))).toEqual([
      'id',
      'user_id',
      'snapshot_id',
      'snapshot_generated_at',
      'from_date',
      'to_date',
      'scope_key',
      'candidate_codes_json',
      'briefing_json',
      'questions_json',
      'provider',
      'model',
      'created_at',
      'updated_at',
    ])
    expect(columns.rows.filter(row => Number(row.notnull) === 1).map(row => String(row.name))).toEqual(expect.arrayContaining([
      'id',
      'user_id',
      'snapshot_id',
      'snapshot_generated_at',
      'from_date',
      'to_date',
      'scope_key',
      'candidate_codes_json',
      'briefing_json',
      'questions_json',
      'provider',
      'model',
      'created_at',
      'updated_at',
    ]))

    const indexes = await client.execute(`
      SELECT name, sql FROM sqlite_master
      WHERE type = 'index' AND name LIKE 'idx_quant_candidate_ai_session_%'
      ORDER BY name
    `)
    expect(indexes.rows.map(row => String(row.name))).toEqual([
      'idx_quant_candidate_ai_session_user_created_at',
      'idx_quant_candidate_ai_session_user_snapshot_generated_at',
    ])
    expect(String(indexes.rows[0]?.sql) + String(indexes.rows[1]?.sql)).toContain('user_id')
    expect(String(indexes.rows[0]?.sql) + String(indexes.rows[1]?.sql)).toContain('created_at')
    expect(String(indexes.rows[0]?.sql) + String(indexes.rows[1]?.sql)).toContain('snapshot_generated_at')
  })

  it('stores a bounded-history payload without database-side pruning and cascades with the user', async () => {
    const client = await createMigratedClient()
    const questions = Array.from({ length: 10 }, (_, index) => ({
      question: `问题 ${index + 1}`,
      answer: `回答 ${index + 1}`,
      citedEvidenceKeys: [`candidate-${index + 1}`],
    }))

    await client.execute({
      sql: `INSERT INTO quant_candidate_ai_session (
        id, user_id, snapshot_id, snapshot_generated_at, from_date, to_date, scope_key,
        candidate_codes_json, briefing_json, questions_json, provider, model, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'candidate-session-1',
        'user-1',
        'snapshot-1',
        100,
        '2026-08-01',
        '2026-08-29',
        'all',
        JSON.stringify(['601899.SH', '000001.SZ']),
        JSON.stringify({ overview: '当前候选简报' }),
        JSON.stringify(questions),
        'openai_compatible',
        'gpt-5.4',
        100,
        100,
      ],
    })

    await expect(client.execute('SELECT provider, model, snapshot_id, json_array_length(questions_json) AS question_count FROM quant_candidate_ai_session')).resolves.toMatchObject({
      rows: [{ provider: 'openai_compatible', model: 'gpt-5.4', snapshot_id: 'snapshot-1', question_count: 10 }],
    })

    await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-2\', 2)')
    await client.execute({
      sql: `INSERT INTO quant_candidate_ai_session (
        id, user_id, snapshot_id, snapshot_generated_at, from_date, to_date, scope_key,
        candidate_codes_json, briefing_json, questions_json, provider, model, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'candidate-session-2',
        'user-2',
        'snapshot-2',
        200,
        '2026-08-01',
        '2026-08-29',
        'all',
        '[]',
        '{}',
        '[]',
        'ollama',
        'qwen3',
        200,
        200,
      ],
    })
    await client.execute('DELETE FROM user WHERE id = \'user-1\'')
    await expect(client.execute('SELECT id FROM quant_candidate_ai_session ORDER BY id')).resolves.toMatchObject({ rows: [{ id: 'candidate-session-2' }] })
  })
})
