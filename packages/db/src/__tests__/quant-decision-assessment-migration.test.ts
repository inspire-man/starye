import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'

const migrationPaths = [
  '0036_quant_workbench.sql',
  '0037_quant_sync_lease.sql',
  '0038_quant_watchlist_seed.sql',
  '0039_quant_research_marker.sql',
  '0041_quant_user_scope.sql',
  '0042_quant_research_run.sql',
  '0043_quant_research_summary.sql',
  '0044_quant_candidate_ai_session.sql',
  '0045_quant_factor_config.sql',
  '0046_quant_decision_record.sql',
  '0047_quant_decision_assessment.sql',
  '0048_quant_ai_runtime_reliability.sql',
].map(name => new URL(`../../drizzle/${name}`, import.meta.url))

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

describe('quant decision assessment migration', () => {
  it('creates the scenario snapshot table and query indexes', async () => {
    const client = await createMigratedClient()
    const columns = await client.execute('PRAGMA table_info(quant_decision_assessment)')
    expect(columns.rows.map(row => String(row.name))).toEqual([
      'id',
      'user_id',
      'research_run_id',
      'ts_code',
      'mode',
      'current_price',
      'cost_basis',
      'quantity',
      'snapshot_json',
      'created_at',
    ])
    expect(columns.rows.filter(row => Number(row.notnull) === 1).map(row => String(row.name))).toEqual(expect.arrayContaining([
      'id',
      'user_id',
      'research_run_id',
      'ts_code',
      'mode',
      'current_price',
      'snapshot_json',
      'created_at',
    ]))
    const indexes = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type = 'index' AND name LIKE 'idx_quant_decision_assessment_%'
      ORDER BY name
    `)
    expect(indexes.rows.map(row => String(row.name))).toEqual([
      'idx_quant_decision_assessment_user_run_created_at',
      'idx_quant_decision_assessment_user_ts_code_created_at',
    ])
  })

  it('keeps nullable holding fields and cascades assessment history with its research run', async () => {
    const client = await createMigratedClient()
    await client.execute({
      sql: 'INSERT INTO quant_research_run (id, user_id, ts_code, name, status, report_version, report_json, generated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['run-1', 'user-1', '601899.SH', '紫金矿业', 'ready', 'research-report-v2', '{}', 100, 100],
    })
    await client.execute({
      sql: 'INSERT INTO quant_decision_assessment (id, user_id, research_run_id, ts_code, mode, current_price, cost_basis, quantity, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['assessment-1', 'user-1', 'run-1', '601899.SH', 'buy', 33.4, null, null, '{"snapshotVersion":"decision-assistant-v1"}', 100],
    })
    await expect(client.execute('SELECT mode, current_price, cost_basis, quantity FROM quant_decision_assessment')).resolves.toMatchObject({
      rows: [{ mode: 'buy', current_price: 33.4, cost_basis: null, quantity: null }],
    })
    await client.execute('DELETE FROM quant_research_run WHERE id = \'run-1\'')
    await expect(client.execute('SELECT count(*) AS count FROM quant_decision_assessment')).resolves.toMatchObject({ rows: [{ count: 0 }] })
  })
})
