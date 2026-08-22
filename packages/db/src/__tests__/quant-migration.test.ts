import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../../drizzle/0036_quant_workbench.sql', import.meta.url)
const leaseMigrationPath = new URL('../../drizzle/0037_quant_sync_lease.sql', import.meta.url)

async function createMigratedClient() {
  const client = createClient({ url: 'file::memory:' })
  await client.execute('PRAGMA foreign_keys = ON')
  for (const migrationPathname of [migrationPath, leaseMigrationPath]) {
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
      'quant_daily_bar',
      'quant_scan_snapshot',
      'quant_sync_state',
      'quant_watchlist',
    ])
    expect(indexes.rows.map(row => String(row.name))).toEqual(expect.arrayContaining([
      'idx_quant_daily_bar_identity',
      'idx_quant_scan_snapshot_generated_at',
      'idx_quant_watchlist_ts_code',
    ]))

    const syncColumns = await client.execute('PRAGMA table_info(quant_sync_state)')
    expect(syncColumns.rows.map(row => String(row.name))).toEqual(expect.arrayContaining([
      'status',
      'run_id',
      'lease_expires_at',
    ]))
  })

  it('enforces watchlist and daily-bar identities', async () => {
    const client = await createMigratedClient()

    await client.execute(`
      INSERT INTO quant_watchlist (id, ts_code, name)
      VALUES ('watch-1', '000001.SZ', '平安银行')
    `)
    await expect(client.execute(`
      INSERT INTO quant_watchlist (id, ts_code, name)
      VALUES ('watch-2', '000001.SZ', 'duplicate')
    `)).rejects.toThrow(/UNIQUE constraint failed/u)

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
})
