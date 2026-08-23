import type { Database } from '@starye/db'
import type { AddressInfo } from 'node:http'
import type { AppEnv } from '../../../types'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import * as schema from '@starye/db/schema'
import { drizzle } from 'drizzle-orm/libsql'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quantRoutes } from '../index'

const migrationPath = new URL('../../../../../../packages/db/drizzle/0036_quant_workbench.sql', import.meta.url)
const leaseMigrationPath = new URL('../../../../../../packages/db/drizzle/0037_quant_sync_lease.sql', import.meta.url)
const seedMigrationPath = new URL('../../../../../../packages/db/drizzle/0038_quant_watchlist_seed.sql', import.meta.url)

async function createDatabase(): Promise<{ client: ReturnType<typeof createClient>, db: Database }> {
  const client = createClient({ url: 'file::memory:' })
  for (const migrationPathname of [migrationPath, leaseMigrationPath, seedMigrationPath]) {
    const migration = await readFile(fileURLToPath(migrationPathname.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }
  await client.execute('DELETE FROM quant_watchlist')
  return { client, db: drizzle(client, { schema }) as unknown as Database }
}

function createApp(db: Database, session: unknown) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('auth', { api: { getSession: vi.fn().mockResolvedValue(session) } } as any)
    await next()
  })
  app.route('/api/quant', quantRoutes)
  return app
}

async function startTushareFixture(): Promise<{ url: string, close: () => Promise<void> }> {
  const rows = Array.from({ length: 25 }, (_, index) => {
    const close = 100 + index
    return [
      '000001.SZ',
      `202608${String(index + 1).padStart(2, '0')}`,
      close - 0.5,
      close + 1,
      close - 1,
      close,
      close - 1,
      1,
      1,
      1000 + index,
      10000 + index,
    ]
  })
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({
      code: 0,
      data: {
        fields: ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'change', 'pct_chg', 'vol', 'amount'],
        items: rows,
      },
    }))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo | null
  if (!address)
    throw new Error('Tushare fixture did not expose a listening address')

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  }
}

describe('quant watchlist CRUD contract', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('supports idempotent admin create, update, list, and delete', async () => {
    const { client, db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })

    const create = await app.request('/api/quant/watchlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '000001.sz', name: '平安银行' }),
    })
    expect(create.status).toBe(201)
    await expect(create.json()).resolves.toMatchObject({ data: { tsCode: '000001.SZ', name: '平安银行' } })

    const duplicate = await app.request('/api/quant/watchlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '000001.SZ', name: '重复提交' }),
    })
    expect(duplicate.status).toBe(201)
    await expect(duplicate.json()).resolves.toMatchObject({ data: { tsCode: '000001.SZ', name: '平安银行' } })

    const update = await app.request('/api/quant/watchlist/000001.SZ', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '平安银行 A' }),
    })
    expect(update.status).toBe(200)
    await expect(update.json()).resolves.toMatchObject({ data: { name: '平安银行 A' } })

    const list = await app.request('/api/quant/watchlist')
    await expect(list.json()).resolves.toMatchObject({ data: [{ tsCode: '000001.SZ', name: '平安银行 A', barCount: 0, latestTradeDate: null }] })

    const remove = await app.request('/api/quant/watchlist/000001.SZ', { method: 'DELETE' })
    expect(remove.status).toBe(200)
    await expect(client.execute('SELECT count(*) AS count FROM quant_watchlist')).resolves.toMatchObject({ rows: [{ count: 0 }] })
  })

  it('rejects a non-admin session before touching the database', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'user' } })

    const response = await app.request('/api/quant/watchlist')

    expect(response.status).toBe(403)
  })

  it('completes a fixture-backed sync and reads the persisted snapshot back', async () => {
    const { client, db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    const fixture = await startTushareFixture()

    try {
      const add = await app.request('/api/quant/watchlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ts_code: '000001.SZ' }),
      })
      expect(add.status).toBe(201)

      const sync = await app.request('/api/quant/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from_date: '20260801', to_date: '20260831' }),
      }, {
        TUSHARE_TOKEN: 'fixture-token',
        TUSHARE_BASE_URL: fixture.url,
        TUSHARE_POINTS_TIER: '120',
      } as AppEnv['Bindings'])
      expect(sync.status).toBe(200)
      const syncPayload = await sync.json() as { data: { status: string, writtenCount: number, snapshotId?: string } }
      expect(syncPayload.data).toMatchObject({ status: 'completed', writtenCount: 25 })
      expect(syncPayload.data.snapshotId).toEqual(expect.any(String))

      await expect(client.execute('SELECT count(*) AS count FROM quant_daily_bar')).resolves.toMatchObject({ rows: [{ count: 25 }] })
      await expect(client.execute('SELECT id, candidate_count FROM quant_scan_snapshot')).resolves.toMatchObject({
        rows: [{ id: syncPayload.data.snapshotId, candidate_count: 1 }],
      })

      const watchlist = await app.request('/api/quant/watchlist')
      await expect(watchlist.json()).resolves.toMatchObject({
        data: [{ tsCode: '000001.SZ', latestClose: 124, latestChangePercent: 1 }],
      })

      const candidates = await app.request('/api/quant/candidates', {}, {
        TUSHARE_TOKEN: 'fixture-token',
        TUSHARE_BASE_URL: fixture.url,
        TUSHARE_POINTS_TIER: '120',
      } as AppEnv['Bindings'])
      expect(candidates.status).toBe(200)
      await expect(candidates.json()).resolves.toMatchObject({
        data: { id: syncPayload.data.snapshotId, candidates: [{ tsCode: '000001.SZ', factorVersion: 'momentum-v1' }] },
      })

      const daily = await app.request('/api/quant/daily/000001.SZ?limit=120')
      expect(daily.status).toBe(200)
      const dailyPayload = await daily.json() as { data: readonly { tradeDate: string }[] }
      expect(dailyPayload.data.some(item => item.tradeDate === '20260825')).toBe(true)
    }
    finally {
      await fixture.close()
    }
  })

  it('compares the selected valuation against available watchlist samples', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    for (const item of [
      ['601899.SH', '紫金矿业'],
      ['600089.SH', '特变电工'],
      ['600938.SH', '中国海油'],
    ] as const) {
      await app.request('/api/quant/watchlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ts_code: item[0], name: item[1] }),
      })
    }

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(input.toString())
      const code = url.searchParams.get('secid')?.split('.')[1]
      const fields = {
        601899: { pe: 20, pb: 3 },
        600089: { pe: 10, pb: 2 },
        600938: { pe: 15, pb: 4 },
      }[code || ''] || { pe: null, pb: null }
      return new Response(JSON.stringify({
        rc: 0,
        data: {
          f57: code,
          f163: fields.pe,
          f165: fields.pb,
        },
      }), { status: 200 })
    })

    const response = await app.request('/api/quant/valuation/compare/601899.SH')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        sampleCount: 3,
        availableSampleCount: 3,
        ttmPeSampleCount: 3,
        pbSampleCount: 3,
        ttmPeHigherThanPercent: 100,
        pbHigherThanPercent: 50,
        peers: [
          { tsCode: '600089.SH', name: '特变电工', valuation: { peTtm: 10, pb: 2 } },
          { tsCode: '600938.SH', name: '中国海油', valuation: { peTtm: 15, pb: 4 } },
        ],
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns a structured not-found error when the target is outside the watchlist', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })

    const response = await app.request('/api/quant/valuation/compare/601899.SH')

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'QUANT_NOT_FOUND',
    })
  })

  it('compares financial quality against available watchlist reports', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    for (const item of [
      ['601899.SH', '紫金矿业'],
      ['600089.SH', '特变电工'],
      ['600938.SH', '中国海油'],
    ] as const) {
      await app.request('/api/quant/watchlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ts_code: item[0], name: item[1] }),
      })
    }

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const code = new URL(input.toString()).searchParams.get('code')?.slice(2)
      const fields = {
        601899: { revenueYoY: 20, netProfitYoY: 40, roe: 18, debtAssetRatio: 45 },
        600089: { revenueYoY: 10, netProfitYoY: 30, roe: 12, debtAssetRatio: 55 },
        600938: { revenueYoY: 15, netProfitYoY: 50, roe: 20, debtAssetRatio: 60 },
      }[code || '']!
      return new Response(JSON.stringify({
        data: [{
          SECURITY_CODE: code,
          REPORT_DATE: '2026-06-30 00:00:00',
          TOTALOPERATEREVETZ: fields.revenueYoY,
          PARENTNETPROFITTZ: fields.netProfitYoY,
          ROEJQ: fields.roe,
          ZCFZL: fields.debtAssetRatio,
        }],
      }), { status: 200 })
    })

    const response = await app.request('/api/quant/financial/compare/601899.SH')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        sampleCount: 3,
        availableSampleCount: 3,
        revenueYoYHigherThanPercent: 100,
        netProfitYoYHigherThanPercent: 50,
        roeHigherThanPercent: 50,
        debtAssetRatioLowerThanPercent: 100,
        peers: [
          { tsCode: '600089.SH', name: '特变电工', quality: { revenueYoY: 10 } },
          { tsCode: '600938.SH', name: '中国海油', quality: { revenueYoY: 15 } },
        ],
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('keeps comparison samples when a non-target valuation source fails', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    for (const item of [
      ['601899.SH', '紫金矿业'],
      ['600089.SH', '特变电工'],
    ] as const) {
      await app.request('/api/quant/watchlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ts_code: item[0], name: item[1] }),
      })
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const code = new URL(input.toString()).searchParams.get('secid')?.split('.')[1]
      if (code === '600089')
        return new Response(JSON.stringify({ rc: 0, data: null }), { status: 200 })
      return new Response(JSON.stringify({ rc: 0, data: { f57: code, f163: 20, f165: 3 } }), { status: 200 })
    })

    const response = await app.request('/api/quant/valuation/compare/601899.SH')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        sampleCount: 2,
        availableSampleCount: 1,
        ttmPeSampleCount: 1,
        pbSampleCount: 1,
        ttmPeHigherThanPercent: null,
        pbHigherThanPercent: null,
        peers: [{ tsCode: '600089.SH', valuation: null }],
      },
    })
  })
})
