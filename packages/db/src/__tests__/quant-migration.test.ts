import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../../drizzle/0036_quant_workbench.sql', import.meta.url)
const leaseMigrationPath = new URL('../../drizzle/0037_quant_sync_lease.sql', import.meta.url)
const seedMigrationPath = new URL('../../drizzle/0038_quant_watchlist_seed.sql', import.meta.url)
const researchMigrationPath = new URL('../../drizzle/0039_quant_research_marker.sql', import.meta.url)
const userScopeMigrationPath = new URL('../../drizzle/0041_quant_user_scope.sql', import.meta.url)
const researchRunMigrationPath = new URL('../../drizzle/0042_quant_research_run.sql', import.meta.url)
const researchSummaryMigrationPath = new URL('../../drizzle/0043_quant_research_summary.sql', import.meta.url)

async function createMigratedClient() {
  const client = createClient({ url: 'file::memory:' })
  await client.execute('PRAGMA foreign_keys = ON')
  await client.execute('CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL)')
  await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-1\', 1)')
  for (const migrationPathname of [migrationPath, leaseMigrationPath, seedMigrationPath, researchMigrationPath, userScopeMigrationPath, researchRunMigrationPath, researchSummaryMigrationPath]) {
    const migration = await readFile(fileURLToPath(migrationPathname.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }

  return client
}

describe('quant workbench migration', () => {
  it('creates the four independent v1 tables and required indexes', async () => {
    const client = await createMigratedClient()
    const tables = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'quant_%'
      ORDER BY name
    `)
    const indexes = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type = 'index' AND name LIKE 'idx_quant_%'
      ORDER BY name
    `)

    expect(tables.rows.map(row => String(row.name))).toEqual([
      'quant_ai_config',
      'quant_daily_bar',
      'quant_research_marker',
      'quant_research_run',
      'quant_research_summary',
      'quant_scan_snapshot',
      'quant_sync_state',
      'quant_watchlist',
    ])
    expect(indexes.rows.map(row => String(row.name))).toEqual(expect.arrayContaining([
      'idx_quant_daily_bar_identity',
      'idx_quant_research_marker_user_ts_code',
      'idx_quant_research_run_user_ts_code_generated_at',
      'idx_quant_research_summary_user_run_generated_at',
      'idx_quant_scan_snapshot_user_generated_at',
      'idx_quant_watchlist_user_ts_code',
    ]))

    const syncColumns = await client.execute('PRAGMA table_info(quant_sync_state)')
    expect(syncColumns.rows.map(row => String(row.name))).toEqual(expect.arrayContaining([
      'status',
      'run_id',
      'lease_expires_at',
    ]))

    const starterRows = await client.execute('SELECT ts_code, name FROM quant_watchlist ORDER BY ts_code')
    expect(starterRows.rows).toEqual([
      { ts_code: '600089.SH', name: '特变电工' },
      { ts_code: '600938.SH', name: '中国海油' },
      { ts_code: '601899.SH', name: '紫金矿业' },
    ])
  })

  it('enforces watchlist and daily-bar identities', async () => {
    const client = await createMigratedClient()

    await client.execute(`
      INSERT INTO quant_watchlist (id, user_id, ts_code, name)
      VALUES ('watch-1', 'user-1', '000001.SZ', '平安银行')
    `)
    await expect(client.execute(`
      INSERT INTO quant_watchlist (id, user_id, ts_code, name)
      VALUES ('watch-2', 'user-1', '000001.SZ', 'duplicate')
    `)).rejects.toThrow(/UNIQUE constraint failed/u)
    await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-2\', 2)')
    await expect(client.execute(`
      INSERT INTO quant_watchlist (id, user_id, ts_code, name)
      VALUES ('watch-3', 'user-2', '000001.SZ', '另一用户')
    `)).resolves.toBeDefined()

    const dailyBar = `
      INSERT INTO quant_daily_bar (
        id, ts_code, trade_date, open, high, low, close, pre_close,
        change, pct_chg, volume, amount
      ) VALUES ('bar-1', '000001.SZ', '20260821', 10, 11, 9.5, 10.5, 10, 0.5, 5, 1000, 10000)
    `
    await client.execute(dailyBar)
    await expect(client.execute(dailyBar.replace('\'bar-1\'', '\'bar-2\''))).rejects.toThrow(/UNIQUE constraint failed/u)

    const columns = await client.execute('PRAGMA table_info(quant_daily_bar)')
    expect(columns.rows.map(row => String(row.name))).not.toEqual(expect.arrayContaining([
      'pe',
      'pb',
      'turnover_rate',
    ]))
  })

  it('enforces one research marker per stock and preserves nullable fields', async () => {
    const client = await createMigratedClient()
    await client.execute(`
      INSERT INTO quant_research_marker (id, user_id, ts_code, status, note, review_date)
      VALUES ('research:user-1:000001.SZ', 'user-1', '000001.SZ', 'priority', '核对现金流', '2026-09-01')
    `)
    await expect(client.execute(`
      INSERT INTO quant_research_marker (id, user_id, ts_code, status)
      VALUES ('research:user-1:000001.SZ-duplicate', 'user-1', '000001.SZ', 'paused')
    `)).rejects.toThrow(/UNIQUE constraint failed/u)

    await expect(client.execute('SELECT status, note, review_date FROM quant_research_marker')).resolves.toMatchObject({
      rows: [{ status: 'priority', note: '核对现金流', review_date: '2026-09-01' }],
    })
  })

  it('keeps the starter seed idempotent and preserves a later name edit', async () => {
    const client = await createMigratedClient()
    const seed = await readFile(fileURLToPath(seedMigrationPath.href), 'utf8')

    await client.execute(`UPDATE quant_watchlist SET name = '自定义名称' WHERE ts_code = '601899.SH'`)
    for (const statement of seed.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)

    await expect(
      client.execute(`SELECT count(*) AS count, name FROM quant_watchlist WHERE ts_code = '601899.SH'`),
    )
      .resolves
      .toMatchObject({ rows: [{ count: 1, name: '自定义名称' }] })
  })

  it('keeps research runs isolated and preserves the versioned report snapshot', async () => {
    const client = await createMigratedClient()
    await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-2\', 2)')
    const report = JSON.stringify({ reportVersion: 'research-report-v1', score: 75, evidence: [{ key: 'trend-sample', status: 'pass' }] })

    await client.execute({
      sql: `INSERT INTO quant_research_run (
        id, user_id, ts_code, name, status, report_version, source_snapshot_id,
        report_json, generated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ['run-1', 'user-1', '601899.SH', '紫金矿业', 'partial', 'research-report-v1', 'snapshot-1', report, 10, 10],
    })
    await client.execute({
      sql: `INSERT INTO quant_research_run (
        id, user_id, ts_code, name, status, report_version, source_snapshot_id,
        report_json, generated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ['run-2', 'user-2', '601899.SH', '紫金矿业', 'ready', 'research-report-v1', null, report, 20, 20],
    })

    await expect(client.execute(`
      SELECT id, ts_code, report_version, report_json
      FROM quant_research_run
      WHERE user_id = 'user-1' AND ts_code = '601899.SH'
      ORDER BY generated_at DESC
    `)).resolves.toMatchObject({
      rows: [{ id: 'run-1', ts_code: '601899.SH', report_version: 'research-report-v1', report_json: report }],
    })
    await expect(client.execute('SELECT count(*) AS count FROM quant_research_run WHERE user_id = \'user-1\'')).resolves.toMatchObject({ rows: [{ count: 1 }] })
    await expect(client.execute('SELECT count(*) AS count FROM quant_research_run WHERE user_id = \'user-2\'')).resolves.toMatchObject({ rows: [{ count: 1 }] })
  })

  it('keeps research summaries isolated by user and research run', async () => {
    const client = await createMigratedClient()
    await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-2\', 2)')
    await client.execute(`
      INSERT INTO quant_research_run (
        id, user_id, ts_code, name, status, report_version, source_snapshot_id,
        report_json, generated_at, created_at
      ) VALUES ('run-1', 'user-1', '601899.SH', '紫金矿业', 'partial', 'research-report-v2', null, '{}', 10, 10)
    `)
    const summary = JSON.stringify({ summaryVersion: 'research-summary-v1', overview: '只解释证据' })
    await client.execute({
      sql: `INSERT INTO quant_research_summary (
        id, user_id, research_run_id, summary_version, report_version, provider, model,
        summary_json, cited_evidence_keys_json, generated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ['summary-1', 'user-1', 'run-1', 'research-summary-v1', 'research-report-v2', 'ollama', 'qwen3', summary, '["trend-sample"]', 20, 20],
    })
    await expect(client.execute(`
      SELECT user_id, research_run_id, summary_json
      FROM quant_research_summary
      WHERE user_id = 'user-1' AND research_run_id = 'run-1'
    `)).resolves.toMatchObject({ rows: [{ user_id: 'user-1', research_run_id: 'run-1', summary_json: summary }] })
    await expect(client.execute('SELECT count(*) AS count FROM quant_research_summary WHERE user_id = \'user-2\'')).resolves.toMatchObject({ rows: [{ count: 0 }] })
  })
})
