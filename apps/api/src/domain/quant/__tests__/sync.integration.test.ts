import type { Database } from '@starye/db'
import type { TushareProvider } from '../provider'
import type { DailyBar } from '../types'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import * as schema from '@starye/db/schema'
import { drizzle } from 'drizzle-orm/libsql'
import { describe, expect, it, vi } from 'vitest'
import { TushareProviderError } from '../provider'
import { acquireQuantSyncLease, createQuantWatchlistItem, saveQuantSyncState } from '../repository'
import { QUANT_SYNC_PROVIDER_CONCURRENCY, QUANT_SYNC_PROVIDER_TIMEOUT_MS, syncQuantDaily } from '../sync'

const migrationPath = new URL('../../../../../../packages/db/drizzle/0036_quant_workbench.sql', import.meta.url)
const leaseMigrationPath = new URL('../../../../../../packages/db/drizzle/0037_quant_sync_lease.sql', import.meta.url)
const seedMigrationPath = new URL('../../../../../../packages/db/drizzle/0038_quant_watchlist_seed.sql', import.meta.url)

function fixtureBars(tsCode: string, offset = 0): readonly DailyBar[] {
  return Array.from({ length: 20 }, (_, index) => {
    const close = index + 1 + offset
    return {
      tsCode,
      tradeDate: `202608${String(index + 1).padStart(2, '0')}`,
      open: close,
      high: close,
      low: close,
      close,
      preClose: index === 0 ? null : close - 1,
      change: index === 0 ? null : 1,
      pctChg: index === 0 ? null : 100 / index,
      volume: 1000,
      amount: 10_000,
    }
  })
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function deferred<T>(): { promise: Promise<T>, resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function createQuantDatabase(): Promise<{ client: ReturnType<typeof createClient>, db: Database }> {
  const client = createClient({ url: 'file::memory:' })
  for (const migrationPathname of [migrationPath, leaseMigrationPath, seedMigrationPath]) {
    const migration = await readFile(fileURLToPath(migrationPathname.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }
  await client.execute('DELETE FROM quant_watchlist')
  return { client, db: drizzle(client, { schema }) as unknown as Database }
}

describe('quant daily sync integration', () => {
  it('upserts repeated daily responses and persists a completed snapshot', async () => {
    const { client, db } = await createQuantDatabase()
    const tsCode = '000001.SZ'
    await createQuantWatchlistItem(db, { tsCode, name: '平安银行' })
    const provider: TushareProvider = {
      isConfigured: true,
      request: vi.fn(),
      fetchDaily: vi.fn().mockResolvedValue(fixtureBars(tsCode)),
    }

    const first = await syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, {}, {
      provider,
      now: () => new Date('2026-08-21T00:00:00.000Z'),
    })
    const second = await syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, {}, {
      provider,
      now: () => new Date('2026-08-21T00:00:00.000Z'),
    })

    expect(first.status).toBe('completed')
    expect(first.writtenCount).toBe(20)
    expect(second.status).toBe('completed')
    expect(await client.execute('SELECT count(*) AS count FROM quant_daily_bar')).toMatchObject({ rows: [{ count: 20 }] })
    expect(await client.execute('SELECT count(*) AS count FROM quant_scan_snapshot')).toMatchObject({ rows: [{ count: 2 }] })
    expect(await client.execute('SELECT status, written_count FROM quant_sync_state WHERE id = \'daily\'')).toMatchObject({ rows: [{ status: 'completed', written_count: 20 }] })
  })

  it('limits provider concurrency while preserving request order in the snapshot', async () => {
    const { client, db } = await createQuantDatabase()
    const requestedCodes = [
      '000005.SZ',
      '000001.SZ',
      '000004.SZ',
      '000002.SZ',
      '000003.SZ',
      '000006.SZ',
      '000007.SZ',
    ]
    for (const tsCode of requestedCodes)
      await createQuantWatchlistItem(db, { tsCode })

    let activeRequests = 0
    let maxActiveRequests = 0
    const provider: TushareProvider = {
      isConfigured: true,
      request: vi.fn(),
      fetchDaily: vi.fn(async ({ tsCode }) => {
        activeRequests += 1
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
        try {
          await wait(tsCode === '000005.SZ' ? 12 : 2)
          return fixtureBars(tsCode)
        }
        finally {
          activeRequests -= 1
        }
      }),
    }

    const result = await syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, { tsCodes: requestedCodes }, {
      provider,
      now: () => new Date('2026-08-21T00:00:00.000Z'),
    })

    expect(result.status).toBe('completed')
    expect(result.writtenCount).toBe(requestedCodes.length * 20)
    expect(maxActiveRequests).toBe(QUANT_SYNC_PROVIDER_CONCURRENCY)
    expect(maxActiveRequests).toBeLessThanOrEqual(QUANT_SYNC_PROVIDER_CONCURRENCY)
    expect(await client.execute('SELECT input_ts_codes_json FROM quant_scan_snapshot')).toMatchObject({
      rows: [{ input_ts_codes_json: JSON.stringify(requestedCodes) }],
    })
  })

  it('persists a partial result in request order when concurrent provider calls fail selectively', async () => {
    const { client, db } = await createQuantDatabase()
    const requestedCodes = ['000003.SZ', '000001.SZ', '000002.SZ', '000004.SZ']
    for (const tsCode of requestedCodes)
      await createQuantWatchlistItem(db, { tsCode })

    const provider: TushareProvider = {
      isConfigured: true,
      request: vi.fn(),
      fetchDaily: vi.fn(async ({ tsCode }) => {
        if (tsCode === '000002.SZ') {
          await wait(1)
          throw new TushareProviderError('TIMEOUT', 'timeout', 'daily')
        }
        if (tsCode === '000004.SZ') {
          await wait(2)
          throw new TushareProviderError('QUOTA_EXHAUSTED', 'quota', 'daily')
        }
        await wait(tsCode === '000003.SZ' ? 8 : 4)
        return fixtureBars(tsCode)
      }),
    }

    const result = await syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, { tsCodes: requestedCodes }, {
      provider,
      now: () => new Date('2026-08-21T00:00:00.000Z'),
    })

    expect(result).toMatchObject({
      status: 'partial',
      requestedCount: 4,
      writtenCount: 40,
      skippedCount: 2,
      reasonCode: 'QUANT_PROVIDER_PARTIAL',
      reason: 'QUANT_PROVIDER_TIMEOUT,QUANT_PROVIDER_QUOTA',
    })
    expect(await client.execute('SELECT status, input_ts_codes_json, candidate_count FROM quant_scan_snapshot')).toMatchObject({
      rows: [{ status: 'partial', input_ts_codes_json: JSON.stringify(requestedCodes), candidate_count: 4 }],
    })
    expect(await client.execute('SELECT DISTINCT ts_code FROM quant_daily_bar ORDER BY ts_code')).toMatchObject({
      rows: [{ ts_code: '000001.SZ' }, { ts_code: '000003.SZ' }],
    })
  })

  it('persists rejected without a snapshot when every provider call fails', async () => {
    const { client, db } = await createQuantDatabase()
    const requestedCodes = ['000001.SZ', '000002.SZ']
    for (const tsCode of requestedCodes)
      await createQuantWatchlistItem(db, { tsCode })

    const provider: TushareProvider = {
      isConfigured: true,
      request: vi.fn(),
      fetchDaily: vi.fn().mockRejectedValue(new TushareProviderError('TIMEOUT', 'timeout', 'daily')),
    }

    const result = await syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, { tsCodes: requestedCodes }, {
      provider,
      now: () => new Date('2026-08-21T00:00:00.000Z'),
    })

    expect(result).toMatchObject({
      status: 'rejected',
      requestedCount: 2,
      writtenCount: 0,
      skippedCount: 2,
      reasonCode: 'QUANT_PROVIDER_TIMEOUT',
      reason: 'QUANT_PROVIDER_TIMEOUT',
      candidates: [],
    })
    expect(await client.execute('SELECT count(*) AS count FROM quant_scan_snapshot')).toMatchObject({ rows: [{ count: 0 }] })
    expect(await client.execute('SELECT status, skipped_count FROM quant_sync_state WHERE id = \'daily\'')).toMatchObject({
      rows: [{ status: 'rejected', skipped_count: 2 }],
    })
  })

  it('rejects an overlapping sync before calling its provider', async () => {
    const { client, db } = await createQuantDatabase()
    const tsCode = '000001.SZ'
    await createQuantWatchlistItem(db, { tsCode })
    const providerStarted = deferred<void>()
    const providerResult = deferred<readonly DailyBar[]>()
    const provider: TushareProvider = {
      isConfigured: true,
      request: vi.fn(),
      fetchDaily: vi.fn(async () => {
        providerStarted.resolve()
        return providerResult.promise
      }),
    }
    const now = () => new Date('2026-08-21T00:00:00.000Z')
    const first = syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, {}, { provider, now })
    await providerStarted.promise

    await expect(syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, {}, { provider, now })).rejects.toMatchObject({
      code: 'QUANT_SYNC_IN_PROGRESS',
      status: 409,
    })
    expect(provider.fetchDaily).toHaveBeenCalledTimes(1)

    providerResult.resolve(fixtureBars(tsCode))
    await expect(first).resolves.toMatchObject({ status: 'completed' })
    expect(await client.execute('SELECT status, run_id, lease_expires_at FROM quant_sync_state WHERE id = \'daily\'')).toMatchObject({
      rows: [{ status: 'completed', lease_expires_at: null }],
    })
  })

  it('lets a stale lease be taken over without accepting the old run result', async () => {
    const { client, db } = await createQuantDatabase()
    const tsCode = '000001.SZ'
    await createQuantWatchlistItem(db, { tsCode })
    const providerStarted = deferred<void>()
    const oldProviderResult = deferred<readonly DailyBar[]>()
    let calls = 0
    const provider: TushareProvider = {
      isConfigured: true,
      request: vi.fn(),
      fetchDaily: vi.fn(({ tsCode: requestedCode }) => {
        calls += 1
        if (calls === 1) {
          providerStarted.resolve()
          return oldProviderResult.promise
        }
        return Promise.resolve(fixtureBars(requestedCode))
      }),
    }
    const oldNow = () => new Date('2026-08-21T00:00:00.000Z')
    const oldRun = syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, {}, { provider, now: oldNow })
    await providerStarted.promise

    const newResult = await syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, {}, {
      provider,
      now: () => new Date('2026-08-21T00:02:01.000Z'),
    })
    expect(newResult.status).toBe('completed')
    const stateAfterTakeover = await client.execute('SELECT status, run_id, snapshot_id FROM quant_sync_state WHERE id = \'daily\'')

    oldProviderResult.resolve(fixtureBars(tsCode, 100))
    await expect(oldRun).rejects.toMatchObject({ code: 'QUANT_SYNC_REJECTED', status: 409 })

    expect(await client.execute('SELECT status, run_id, snapshot_id FROM quant_sync_state WHERE id = \'daily\'')).toEqual(stateAfterTakeover)
    expect(await client.execute('SELECT count(*) AS count FROM quant_scan_snapshot')).toMatchObject({ rows: [{ count: 1 }] })
    expect(await client.execute('SELECT close FROM quant_daily_bar WHERE ts_code = \'000001.SZ\' AND trade_date = \'20260820\'')).toMatchObject({
      rows: [{ close: 20 }],
    })
    expect(calls).toBe(2)
  })

  it('classifies unfinished and never-resolving provider work at the total deadline', async () => {
    const { client, db } = await createQuantDatabase()
    const requestedCodes = Array.from({ length: 10 }, (_, index) => `0000${String(index + 1).padStart(2, '0')}.SZ`)
    for (const tsCode of requestedCodes)
      await createQuantWatchlistItem(db, { tsCode })

    const provider: TushareProvider = {
      isConfigured: true,
      request: vi.fn(),
      fetchDaily: vi.fn(async ({ tsCode }) => {
        if (tsCode === requestedCodes[0])
          return fixtureBars(tsCode)
        return new Promise<readonly DailyBar[]>(() => {})
      }),
    }

    const result = await syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, { tsCodes: requestedCodes }, {
      provider,
      totalDeadlineMs: 20,
      now: () => new Date('2026-08-21T00:00:00.000Z'),
    })

    expect(QUANT_SYNC_PROVIDER_CONCURRENCY).toBe(4)
    expect(QUANT_SYNC_PROVIDER_TIMEOUT_MS).toBe(10_000)
    expect(result).toMatchObject({
      status: 'partial',
      requestedCount: 10,
      writtenCount: 20,
      skippedCount: 9,
      reasonCode: 'QUANT_PROVIDER_PARTIAL',
      reason: 'QUANT_SYNC_DEADLINE',
    })
    expect(await client.execute('SELECT count(*) AS count FROM quant_daily_bar')).toMatchObject({ rows: [{ count: 20 }] })
    expect(await client.execute('SELECT status, skipped_count FROM quant_sync_state WHERE id = \'daily\'')).toMatchObject({
      rows: [{ status: 'partial', skipped_count: 9 }],
    })
  })

  it('retains only the latest 30 valid snapshots without deleting daily bars', async () => {
    const { client, db } = await createQuantDatabase()
    const tsCode = '000001.SZ'
    await createQuantWatchlistItem(db, { tsCode })
    const provider: TushareProvider = {
      isConfigured: true,
      request: vi.fn(),
      fetchDaily: vi.fn().mockResolvedValue(fixtureBars(tsCode)),
    }

    let lastResult: Awaited<ReturnType<typeof syncQuantDaily>> | undefined
    for (let index = 0; index < 31; index++) {
      const now = new Date(Date.UTC(2026, 7, 21, 0, 0, index))
      lastResult = await syncQuantDaily(db, { TUSHARE_POINTS_TIER: '120' }, {}, { provider, now: () => now })
    }

    expect(lastResult?.status).toBe('completed')
    expect(await client.execute('SELECT count(*) AS count FROM quant_scan_snapshot')).toMatchObject({ rows: [{ count: 30 }] })
    expect(await client.execute('SELECT id FROM quant_scan_snapshot ORDER BY rowid DESC LIMIT 1')).toMatchObject({
      rows: [{ id: lastResult?.snapshotId }],
    })
    expect(await client.execute('SELECT count(*) AS count FROM quant_daily_bar')).toMatchObject({ rows: [{ count: 20 }] })
    expect(await client.execute('SELECT snapshot_id FROM quant_sync_state WHERE id = \'daily\'')).toMatchObject({
      rows: [{ snapshot_id: lastResult?.snapshotId }],
    })
  })

  it('does not finalize a sync after its lease expires', async () => {
    const { client, db } = await createQuantDatabase()
    const startedAt = new Date('2026-08-21T00:00:00.000Z')
    const runId = 'expired-run'

    await expect(acquireQuantSyncLease(db, {
      runId,
      fromDate: '20260801',
      toDate: '20260821',
      requestedCount: 1,
      startedAt,
    })).resolves.toBe(true)

    await expect(saveQuantSyncState(db, {
      status: 'completed',
      runId,
      fromDate: '20260801',
      toDate: '20260821',
      requestedCount: 1,
      writtenCount: 1,
      skippedCount: 0,
      startedAt,
      completedAt: new Date(startedAt.getTime() + 120_001),
    })).resolves.toBe(false)

    await expect(client.execute('SELECT status, run_id FROM quant_sync_state WHERE id = \'daily\'')).resolves.toMatchObject({
      rows: [{ status: 'running', run_id: runId }],
    })
  })
})
