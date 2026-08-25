import type { Database } from '@starye/db'
import type { AddressInfo } from 'node:http'
import type { DailyBar } from '../../../domain/quant/types'
import type { AppEnv } from '../../../types'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import * as schema from '@starye/db/schema'
import { drizzle } from 'drizzle-orm/libsql'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuantWatchlistItem, upsertQuantDailyBars } from '../../../domain/quant/repository'
import { quantRoutes } from '../index'

const migrationPath = new URL('../../../../../../packages/db/drizzle/0036_quant_workbench.sql', import.meta.url)
const leaseMigrationPath = new URL('../../../../../../packages/db/drizzle/0037_quant_sync_lease.sql', import.meta.url)
const seedMigrationPath = new URL('../../../../../../packages/db/drizzle/0038_quant_watchlist_seed.sql', import.meta.url)
const researchMigrationPath = new URL('../../../../../../packages/db/drizzle/0039_quant_research_marker.sql', import.meta.url)
const knowledgeSeedMigrationPath = new URL('../../../../../../packages/db/drizzle/0040_quant_investment_knowledge_seed.sql', import.meta.url)

async function createDatabase(): Promise<{ client: ReturnType<typeof createClient>, db: Database }> {
  const client = createClient({ url: 'file::memory:' })
  for (const migrationPathname of [migrationPath, leaseMigrationPath, seedMigrationPath, researchMigrationPath]) {
    const migration = await readFile(fileURLToPath(migrationPathname.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }
  await client.execute('DELETE FROM quant_watchlist')
  return { client, db: drizzle(client, { schema }) as unknown as Database }
}

async function createSeedDatabase(): Promise<{ client: ReturnType<typeof createClient>, db: Database }> {
  const client = createClient({ url: 'file::memory:' })
  for (const migrationPathname of [migrationPath, leaseMigrationPath, seedMigrationPath, researchMigrationPath, knowledgeSeedMigrationPath]) {
    const migration = await readFile(fileURLToPath(migrationPathname.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }
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

function valueFixtureBars(tsCode: string, offset = 0): DailyBar[] {
  return Array.from({ length: 80 }, (_, index) => {
    const close = 100 + offset + index
    return {
      tsCode,
      tradeDate: `2026${String(Math.floor(index / 30) + 1).padStart(2, '0')}${String(index % 30 + 1).padStart(2, '0')}`,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      preClose: index === 0 ? null : close - 1,
      change: index === 0 ? null : 1,
      pctChg: index === 0 ? null : 1,
      volume: 1000,
      amount: 10000,
    }
  })
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

  it('backfills a code-only watchlist name from the public stock identity provider', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      rc: 0,
      data: { f57: '600000', f58: '浦发银行' },
    }), { status: 200 }))

    const add = await app.request('/api/quant/watchlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '600000.SH' }),
    }, { EASTMONEY_BASE_URL: 'https://eastmoney.fixture.test' } as AppEnv['Bindings'])

    expect(add.status).toBe(201)
    await expect(add.json()).resolves.toMatchObject({ data: { tsCode: '600000.SH', name: '浦发银行' } })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('keeps a code-only watchlist create successful when name lookup is unavailable', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ rc: 0, data: null }), { status: 200 }))

    const add = await app.request('/api/quant/watchlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '600000.SH' }),
    }, { EASTMONEY_BASE_URL: 'https://eastmoney.fixture.test' } as AppEnv['Bindings'])

    expect(add.status).toBe(201)
    await expect(add.json()).resolves.toMatchObject({ data: { tsCode: '600000.SH', name: null } })
  })

  it('returns current watchlist codes as pending candidates before the first scan', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    for (const item of [
      { ts_code: '601899.SH', name: '紫金矿业' },
      { ts_code: '600000.SH', name: '浦发银行' },
    ]) {
      await app.request('/api/quant/watchlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(item),
      })
    }

    const beforeScan = await app.request('/api/quant/candidates')
    await expect(beforeScan.json()).resolves.toMatchObject({
      data: {
        generatedAt: null,
        candidates: [
          { tsCode: '601899.SH', name: '紫金矿业', pendingSync: true, dataQuality: 'insufficient_data' },
          { tsCode: '600000.SH', name: '浦发银行', pendingSync: true, dataQuality: 'insufficient_data' },
        ],
      },
    })

    await app.request('/api/quant/watchlist/600000.SH', { method: 'DELETE' })
    const afterDelete = await app.request('/api/quant/candidates')
    await expect(afterDelete.json()).resolves.toMatchObject({
      data: { candidates: [{ tsCode: '601899.SH' }] },
    })
  })

  it('returns persisted signal history for candidates', async () => {
    const { client, db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    await createQuantWatchlistItem(db, { tsCode: '601899.SH', name: '紫金矿业' })

    const candidateJson = (score: number, matchedFactors: string[]) => JSON.stringify([{
      tsCode: '601899.SH',
      score,
      matchedFactors,
      factorVersion: 'momentum-v1',
      dataQuality: 'ready',
      factors: {},
    }])
    for (const [id, generatedAt, score, matchedFactors] of [
      ['snapshot-new', 1_700_000_200, 4, ['ma20', 'relative_strength']],
      ['snapshot-old', 1_700_000_100, 3, ['ma20']],
    ] as const) {
      await client.execute({
        sql: `INSERT INTO quant_scan_snapshot (
          id, status, factor_version, input_ts_codes_json, from_date, to_date,
          candidate_count, candidates_json, generated_at, created_at
        ) VALUES (?, 'completed', 'momentum-v1', ?, '20260824', '20260825', 1, ?, ?, ?)`,
        args: [id, JSON.stringify(['601899.SH']), candidateJson(score, matchedFactors), generatedAt, generatedAt],
      })
    }

    const response = await app.request('/api/quant/candidates')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: 'snapshot-new',
        candidates: [{
          tsCode: '601899.SH',
          name: '紫金矿业',
          persistence: {
            sampleSize: 2,
            appearanceCount: 2,
            persistenceRate: 1,
            state: 'confirming',
            previousScore: 3,
            scoreDelta: 1,
            scoreChange: 1,
            factorPersistence: expect.arrayContaining([
              { factor: 'ma20', appearances: 2, rate: 1 },
              { factor: 'relative_strength', appearances: 1, rate: 0.5 },
            ]),
            evidence: expect.arrayContaining([
              expect.objectContaining({ snapshotId: 'snapshot-new', present: true, score: 4 }),
              expect.objectContaining({ snapshotId: 'snapshot-old', present: true, score: 3 }),
            ]),
          },
        }],
      },
    })
  })

  it('reads and idempotently updates research markers for watchlist stocks', async () => {
    const { client, db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })

    await app.request('/api/quant/watchlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '601899.SH', name: '紫金矿业' }),
    })

    const initial = await app.request('/api/quant/research')
    await expect(initial.json()).resolves.toMatchObject({
      data: [{ tsCode: '601899.SH', status: 'unreviewed', note: null, reviewDate: null }],
    })

    const update = await app.request('/api/quant/research/601899.SH', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'priority', note: '重点核对现金流', review_date: '2026-09-01' }),
    })
    expect(update.status).toBe(200)
    await expect(update.json()).resolves.toMatchObject({
      data: { tsCode: '601899.SH', status: 'priority', note: '重点核对现金流', reviewDate: '2026-09-01' },
    })

    const repeat = await app.request('/api/quant/research/601899.SH', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'paused', note: null, review_date: null }),
    })
    expect(repeat.status).toBe(200)
    await expect(client.execute('SELECT count(*) AS count, status FROM quant_research_marker')).resolves.toMatchObject({
      rows: [{ count: 1, status: 'paused' }],
    })
  })

  it('rejects invalid research status and non-watchlist targets without writing', async () => {
    const { client, db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })

    const invalidStatus = await app.request('/api/quant/research/601899.SH', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'buy', note: null, review_date: null }),
    })
    expect(invalidStatus.status).toBe(400)

    const missingTarget = await app.request('/api/quant/research/601899.SH', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'priority', note: null, review_date: null }),
    })
    expect(missingTarget.status).toBe(404)
    await expect(client.execute('SELECT count(*) AS count FROM quant_research_marker')).resolves.toMatchObject({ rows: [{ count: 0 }] })
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
        body: JSON.stringify({ ts_code: '000001.SZ', name: '平安银行' }),
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

  it('applies the article-derived watchlist seed idempotently and preserves a user name edit', async () => {
    const { client } = await createSeedDatabase()
    const seededCodes = ['601318.SH', '000001.SZ', '600028.SH', '601857.SH', '601919.SH', '600011.SH', '600900.SH', '600312.SH', '603993.SH', '603986.SH']
    const seededCodeList = seededCodes.map(code => `'${code}'`).join(',')

    await expect(client.execute(`SELECT count(*) AS count FROM quant_watchlist WHERE ts_code IN (${seededCodeList})`)).resolves.toMatchObject({
      rows: [{ count: 10 }],
    })

    await client.execute('UPDATE quant_watchlist SET name = \'自定义名称\' WHERE ts_code = \'601318.SH\'')
    const migration = await readFile(fileURLToPath(knowledgeSeedMigrationPath.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)

    await expect(client.execute('SELECT name FROM quant_watchlist WHERE ts_code = \'601318.SH\'')).resolves.toMatchObject({
      rows: [{ name: '自定义名称' }],
    })
    await client.execute('DELETE FROM quant_watchlist WHERE ts_code = \'601318.SH\'')
    await expect(client.execute('SELECT count(*) AS count FROM quant_watchlist WHERE ts_code = \'601318.SH\'')).resolves.toMatchObject({
      rows: [{ count: 0 }],
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

  it('returns value-quality scores for an expanded watchlist with independent valuation and financial sources', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    const stocks = [
      ['601899.SH', '紫金矿业'],
      ['600089.SH', '特变电工'],
      ['600938.SH', '中国海油'],
      ['000001.SZ', '平安银行'],
    ] as const
    for (const [tsCode, name] of stocks)
      await createQuantWatchlistItem(db, { tsCode, name })
    await upsertQuantDailyBars(db, stocks.map(([tsCode], index) => valueFixtureBars(tsCode, index * 10)).flat())

    const values: Record<string, { pe: number, pb: number, roe: number }> = {
      '601899': { pe: 12, pb: 1.4, roe: 18 },
      '600089': { pe: 18, pb: 2.1, roe: 12 },
      '600938': { pe: 9, pb: 1.1, roe: 20 },
      '000001': { pe: 22, pb: 1.8, roe: 10 },
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(input.toString())
      if (url.pathname.includes('/api/qt/stock/get')) {
        const code = url.searchParams.get('secid')?.split('.')[1] || ''
        const value = values[code] || { pe: 20, pb: 2, roe: 10 }
        return new Response(JSON.stringify({
          rc: 0,
          data: { f57: code, f163: value.pe, f165: value.pb, f166: 2, f168: 1 },
        }), { status: 200 })
      }
      const code = (url.searchParams.get('code') || '').slice(2)
      const value = values[code] || { pe: 20, pb: 2, roe: 10 }
      return new Response(JSON.stringify({
        data: [
          {
            SECURITY_CODE: code,
            REPORT_DATE: '2026-06-30 00:00:00',
            REPORT_TYPE: '中报',
            NOTICE_DATE: '2026-08-30 00:00:00',
            TOTALOPERATEREVETZ: 10,
            PARENTNETPROFITTZ: 12,
            KCFJCXSYJLRTZ: 11,
            ROEJQ: value.roe,
            XSMLL: 30,
            XSJLL: 12,
            ZCFZL: 45,
            JYXJLYYSR: 0.08,
            INTEREST_COVERAGE_RATIO: 12,
            INTEREST_DEBT_RATIO: 28,
            CASH_RATIO: 1.1,
            ROIC: 10,
          },
          {
            SECURITY_CODE: code,
            REPORT_DATE: '2025-12-31 00:00:00',
            REPORT_TYPE: '年报',
            NOTICE_DATE: '2026-04-01 00:00:00',
            TOTALOPERATEREVETZ: 8,
            PARENTNETPROFITTZ: 9,
            KCFJCXSYJLRTZ: 8,
            ROEJQ: value.roe - 1,
            XSMLL: 29,
            XSJLL: 11,
            ZCFZL: 46,
            JYXJLYYSR: 0.07,
            INTEREST_COVERAGE_RATIO: 10,
            INTEREST_DEBT_RATIO: 30,
            CASH_RATIO: 1.05,
            ROIC: 9,
          },
        ],
      }), { status: 200 })
    })

    const response = await app.request('/api/quant/value-selection')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        formulaVersion: 'value-quality-v2',
        sampleCount: 4,
        readyCount: 4,
        items: [
          { tsCode: '601899.SH', name: '紫金矿业', status: 'ready', score: expect.any(Number), financialReportDate: '2026-06-30' },
          { tsCode: '600089.SH', name: '特变电工', status: 'ready' },
          { tsCode: '600938.SH', name: '中国海油', status: 'ready' },
          { tsCode: '000001.SZ', name: '平安银行', status: 'ready' },
        ],
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(stocks.length * 2)
  })

  it('returns shareholder returns from implemented Tushare dividends and local prices', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    await createQuantWatchlistItem(db, { tsCode: '601899.SH', name: '紫金矿业' })
    await upsertQuantDailyBars(db, valueFixtureBars('601899.SH'))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      data: {
        fields: ['ts_code', 'end_date', 'ann_date', 'div_proc', 'cash_div', 'ex_date', 'pay_date'],
        items: [
          ['601899.SH', '20260331', '20260711', '实施', 0.42, '20260821', '20260821'],
          ['601899.SH', '20260331', '20260711', '预案', 0, null, null],
        ],
      },
    }), { status: 200 }))

    const response = await app.request('/api/quant/shareholder-returns', {}, {
      TUSHARE_TOKEN: 'fixture-token',
      TUSHARE_BASE_URL: 'https://tushare.fixture.test',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        formulaVersion: 'shareholder-return-v1',
        provider: 'tushare',
        sampleCount: 1,
        readyCount: 1,
        items: [{
          tsCode: '601899.SH',
          status: 'ready',
          trailingCashDividendPerShare: 0.42,
          trailingDividendYield: expect.any(Number),
        }],
      },
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      api_name: 'dividend',
      token: 'fixture-token',
      params: { ts_code: '601899.SH' },
    })
  })
})
