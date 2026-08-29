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
const userScopeMigrationPath = new URL('../../../../../../packages/db/drizzle/0041_quant_user_scope.sql', import.meta.url)
const researchRunMigrationPath = new URL('../../../../../../packages/db/drizzle/0042_quant_research_run.sql', import.meta.url)
const researchSummaryMigrationPath = new URL('../../../../../../packages/db/drizzle/0043_quant_research_summary.sql', import.meta.url)

async function prepareUsers(client: ReturnType<typeof createClient>) {
  await client.execute('CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL)')
  await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-1\', 1)')
}

async function createDatabase(): Promise<{ client: ReturnType<typeof createClient>, db: Database }> {
  const client = createClient({ url: 'file::memory:' })
  await prepareUsers(client)
  for (const migrationPathname of [migrationPath, leaseMigrationPath, seedMigrationPath, researchMigrationPath, userScopeMigrationPath, researchRunMigrationPath, researchSummaryMigrationPath]) {
    const migration = await readFile(fileURLToPath(migrationPathname.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }
  await client.execute('DELETE FROM quant_watchlist')
  return { client, db: drizzle(client, { schema }) as unknown as Database }
}

async function createSeedDatabase(): Promise<{ client: ReturnType<typeof createClient>, db: Database }> {
  const client = createClient({ url: 'file::memory:' })
  await prepareUsers(client)
  for (const migrationPathname of [migrationPath, leaseMigrationPath, seedMigrationPath, researchMigrationPath, knowledgeSeedMigrationPath, userScopeMigrationPath, researchRunMigrationPath]) {
    const migration = await readFile(fileURLToPath(migrationPathname.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }
  return { client, db: drizzle(client, { schema }) as unknown as Database }
}

function createApp(db: Database, session: unknown) {
  const normalizedSession = normalizeSession(session)
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('auth', { api: { getSession: vi.fn().mockResolvedValue(normalizedSession) } } as any)
    await next()
  })
  app.route('/api/quant', quantRoutes)
  return app
}

function normalizeSession(session: unknown): unknown {
  if (!session || typeof session !== 'object')
    return session
  const record = session as Record<string, unknown>
  if (!record.user || typeof record.user !== 'object')
    return session
  return {
    ...record,
    user: {
      id: 'user-1',
      ...record.user,
    },
  }
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
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })

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
          id, user_id, status, factor_version, input_ts_codes_json, from_date, to_date,
          candidate_count, candidates_json, generated_at, created_at
        ) VALUES (?, 'user-1', 'completed', 'momentum-v1', ?, '20260824', '20260825', 1, ?, ?, ?)`,
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

  it('allows an ordinary authenticated user to use their own workspace', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'user' } })

    const response = await app.request('/api/quant/watchlist')

    expect(response.status).toBe(200)
  })

  it('provisions an idempotent starter watchlist for a new user', async () => {
    const { client, db } = await createDatabase()
    const app = createApp(db, { user: { id: 'user-1', role: 'user' } })

    const first = await app.request('/api/quant/watchlist')
    expect(first.status).toBe(200)
    const payload = await first.json() as { data: Array<{ tsCode: string, name: string }> }
    expect(payload.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ tsCode: '601899.SH', name: '紫金矿业' }),
      expect.objectContaining({ tsCode: '600089.SH', name: '特变电工' }),
      expect.objectContaining({ tsCode: '600938.SH', name: '中国海油' }),
    ]))
    await expect(client.execute('SELECT count(*) AS count FROM quant_watchlist WHERE user_id = \'user-1\'')).resolves.toMatchObject({ rows: [{ count: 13 }] })

    const update = await app.request('/api/quant/watchlist/601899.SH', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '紫金矿业（自定义）' }),
    })
    expect(update.status).toBe(200)
    await app.request('/api/quant/watchlist')
    await expect(client.execute('SELECT count(*) AS count, name FROM quant_watchlist WHERE user_id = \'user-1\' AND ts_code = \'601899.SH\'')).resolves.toMatchObject({
      rows: [{ count: 1, name: '紫金矿业（自定义）' }],
    })
  })

  it('isolates watchlists and research markers by authenticated user', async () => {
    const { client, db } = await createDatabase()
    await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-2\', 2)')
    const userA = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const userB = createApp(db, { user: { id: 'user-2', role: 'user' } })

    await userA.request('/api/quant/watchlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '000001.SZ', name: '平安银行' }),
    })
    await userB.request('/api/quant/watchlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '600000.SH', name: '浦发银行' }),
    })

    await expect((await userA.request('/api/quant/watchlist')).json()).resolves.toMatchObject({ data: [{ tsCode: '000001.SZ' }] })
    await expect((await userB.request('/api/quant/watchlist')).json()).resolves.toMatchObject({ data: [{ tsCode: '600000.SH' }] })

    const marker = await userA.request('/api/quant/research/000001.SZ', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'priority', note: '用户 A', review_date: null }),
    })
    expect(marker.status).toBe(200)
    const crossUserMarker = await userB.request('/api/quant/research/000001.SZ', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'priority', note: '用户 B', review_date: null }),
    })
    expect(crossUserMarker.status).toBe(404)
    await expect(client.execute('SELECT user_id, ts_code FROM quant_research_marker')).resolves.toMatchObject({
      rows: [{ user_id: 'user-1', ts_code: '000001.SZ' }],
    })
  })

  it('stores and redacts a user-scoped AI configuration', async () => {
    const { client, db } = await createDatabase()
    const app = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const env = { QUANT_AI_ENCRYPTION_KEY: 'test-encryption-secret' } as AppEnv['Bindings']

    const save = await app.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai_compatible',
        model: 'gpt-5.5',
        base_url: 'https://ai.example.test/v1',
        api_key: 'sk-user-one-1234',
      }),
    }, env)
    expect(save.status).toBe(200)
    const savePayload = await save.json() as { data: Record<string, unknown> }
    expect(savePayload.data).toMatchObject({ provider: 'openai_compatible', model: 'gpt-5.5', hasApiKey: true, apiKeyHint: '1234' })
    expect(JSON.stringify(savePayload)).not.toContain('sk-user-one-1234')

    const read = await app.request('/api/quant/ai-config', {}, env)
    expect(read.status).toBe(200)
    await expect(read.json()).resolves.toMatchObject({ data: { hasApiKey: true, apiKeyHint: '1234' } })
    await expect(client.execute('SELECT user_id, encrypted_api_key FROM quant_ai_config')).resolves.toMatchObject({
      rows: [{ user_id: 'user-1', encrypted_api_key: expect.stringMatching(/^v1:/u) }],
    })
  })

  it('tests the saved AI configuration without persisting a research summary', async () => {
    const { client, db } = await createDatabase()
    const app = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const env = { QUANT_AI_ENCRYPTION_KEY: 'test-encryption-secret' } as AppEnv['Bindings']
    const save = await app.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        base_url: 'https://ai.example.test/v1',
        api_key: 'sk-user-one-1234',
      }),
    }, env)
    expect(save.status).toBe(200)

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const test = await app.request('/api/quant/ai-config/test', { method: 'POST' }, env)
    expect(test.status).toBe(200)
    const payload = await test.json() as { data: Record<string, unknown> }
    expect(payload.data).toMatchObject({ provider: 'openai_compatible', model: 'gpt-5.4', latencyMs: expect.any(Number) })
    expect(JSON.stringify(payload)).not.toContain('sk-user-one-1234')
    expect(fetchMock).toHaveBeenCalledWith('https://ai.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-user-one-1234' }),
    }))
    await expect(client.execute('SELECT count(*) AS count FROM quant_research_summary')).resolves.toMatchObject({ rows: [{ count: 0 }] })
  })

  it('generates a structured research run, reads its history, and isolates it by user', async () => {
    const { client, db } = await createDatabase()
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })
    await upsertQuantDailyBars(db, valueFixtureBars('601899.SH'))
    await client.execute(`
      INSERT INTO quant_scan_snapshot (
        id, user_id, status, factor_version, input_ts_codes_json, from_date, to_date,
        candidate_count, candidates_json, generated_at, created_at
      ) VALUES ('target-snapshot', 'user-1', 'partial', 'momentum-v1', '["601899.SH"]', '20260101', '20260826', 0, '[]', 9, 9)
    `)
    await client.execute(`
      INSERT INTO quant_scan_snapshot (
        id, user_id, status, factor_version, input_ts_codes_json, from_date, to_date,
        candidate_count, candidates_json, generated_at, created_at
      ) VALUES ('unrelated-snapshot', 'user-1', 'partial', 'momentum-v1', '["600089.SH"]', '20260101', '20260826', 0, '[]', 10, 10)
    `)
    await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-2\', 2)')
    const userA = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const userB = createApp(db, { user: { id: 'user-2', role: 'user' } })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const generated = await userA.request('/api/quant/research/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '601899.SH' }),
    }, {
      TUSHARE_TOKEN: 'fixture-token',
      TUSHARE_BASE_URL: 'https://tushare.fixture.test',
    } as AppEnv['Bindings'])
    expect(generated.status).toBe(201)
    const generatedPayload = await generated.json() as { data: { id: string, sourceSnapshotId: string | null, report: { reportVersion: string, evidence: unknown[] } } }
    expect(generatedPayload.data).toMatchObject({
      sourceSnapshotId: null,
      report: {
        reportVersion: 'research-report-v2',
        evidence: expect.arrayContaining([expect.objectContaining({ key: 'trend-sample' })]),
        factorModel: expect.objectContaining({ modelVersion: 'research-factors-v1', totalWeight: 1 }),
        decision: expect.objectContaining({ recommendation: 'watch', buyPriceRange: null, sellPriceRange: null }),
      },
    })
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === 'https://tushare.fixture.test')).toHaveLength(1)

    await client.execute(`
      INSERT INTO quant_scan_snapshot (
        id, user_id, status, factor_version, input_ts_codes_json, from_date, to_date,
        candidate_count, candidates_json, generated_at, created_at
      ) VALUES ('target-input-only-snapshot', 'user-1', 'partial', 'momentum-v1', '["601899.SH"]', '20260101', '20260826', 0, '[]', 11, 11)
    `)
    const generatedWithInputOnlySnapshot = await userA.request('/api/quant/research/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '601899.SH' }),
    }, {
      TUSHARE_TOKEN: 'fixture-token',
      TUSHARE_BASE_URL: 'https://tushare.fixture.test',
    } as AppEnv['Bindings'])
    expect(generatedWithInputOnlySnapshot.status).toBe(201)
    const generatedWithInputOnlySnapshotPayload = await generatedWithInputOnlySnapshot.json() as { data: { id: string, sourceSnapshotId: string | null } }
    expect(generatedWithInputOnlySnapshotPayload.data).toMatchObject({ sourceSnapshotId: 'target-input-only-snapshot' })

    const history = await userA.request('/api/quant/research/runs/601899.SH?limit=2')
    expect(history.status).toBe(200)
    const historyPayload = await history.json() as { data: Array<{ id: string, tsCode: string }> }
    expect(historyPayload.data.map(item => ({ id: item.id, tsCode: item.tsCode }))).toEqual(expect.arrayContaining([
      { id: generatedPayload.data.id, tsCode: '601899.SH' },
      { id: generatedWithInputOnlySnapshotPayload.data.id, tsCode: '601899.SH' },
    ]))
    const persistedRuns = await client.execute('SELECT user_id, ts_code, report_version, report_json FROM quant_research_run')
    expect(persistedRuns.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ user_id: 'user-1', ts_code: '601899.SH', report_version: 'research-report-v2', report_json: expect.stringContaining('trend-sample') }),
    ]))

    await expect((await userB.request('/api/quant/research/runs/601899.SH')).json()).resolves.toMatchObject({ data: [] })
    const outside = await userA.request('/api/quant/research/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '600089.SH' }),
    })
    expect(outside.status).toBe(404)
  })

  it('generates an evidence-grounded AI summary and keeps it isolated by user', async () => {
    const { client, db } = await createDatabase()
    await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-2\', 2)')
    const report = JSON.stringify({
      reportVersion: 'research-report-v2',
      tsCode: '601899.SH',
      name: '紫金矿业',
      generatedAt: '2026-08-26T00:00:00.000Z',
      sourceSnapshotId: null,
      status: 'partial',
      action: 'wait-confirmation',
      score: 72.5,
      headline: '等待确认：部分证据可用',
      strengths: [],
      risks: [],
      gaps: [],
      nextActions: [],
      evidence: [{
        key: 'quality-roe',
        dimension: 'quality',
        label: 'ROE',
        status: 'pass',
        value: 18,
        threshold: '至少 10%',
        source: 'Eastmoney 最新财报',
        observedAt: '2026-06-30',
        formulaVersion: 'eastmoney-financial-v1',
        detail: '最近一期 ROE 达到研究门槛。',
      }],
      sources: [],
      decision: {
        decisionVersion: 'research-decision-v1',
        recommendation: 'bullish',
        label: '看多',
        deterministicScore: 78,
        confidence: 78,
        coverage: 100,
        buyPriceRange: null,
        sellPriceRange: null,
        evidenceKeys: ['quality-roe'],
        invalidationConditions: [],
        headline: '看多：证据覆盖充分',
      },
    })
    await client.execute({
      sql: `INSERT INTO quant_research_run (
        id, user_id, ts_code, name, status, report_version, source_snapshot_id,
        report_json, generated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ['summary-run-1', 'user-1', '601899.SH', '紫金矿业', 'partial', 'research-report-v2', null, report, 10, 10],
    })
    const userA = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const userB = createApp(db, { user: { id: 'user-2', role: 'user' } })
    const env = { QUANT_AI_ENCRYPTION_KEY: 'test-encryption-secret' } as AppEnv['Bindings']

    const config = await userA.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai_compatible',
        model: 'gpt-5.5',
        base_url: 'https://ai.example.test/v1',
        api_key: 'sk-user-one-1234',
      }),
    }, env)
    expect(config.status).toBe(200)

    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        overview: '基本面有一项明确支持，但仍应继续核对。',
        supports: ['ROE 达到报告门槛'],
        concerns: ['当前证据范围仍有限'],
        nextChecks: ['等待下一期财报并复核'],
        citedEvidenceKeys: ['quality-roe'],
        decisionReview: {
          decisionVersion: 'ai-decision-v1',
          recommendation: 'bearish',
          confidence: 82,
          rationale: '估值仍需优先核对。',
          invalidationConditions: ['下一期财报改善后复核'],
          citedEvidenceKeys: ['quality-roe'],
        },
      }) } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        overview: '引用了不存在的证据。',
        supports: [],
        concerns: [],
        nextChecks: [],
        citedEvidenceKeys: ['invented-key'],
      }) } }] }), { status: 200 }))

    const generated = await userA.request('/api/quant/research/runs/summary-run-1/summary', { method: 'POST' }, env)
    expect(generated.status).toBe(201)
    const generatedPayload = await generated.json() as { data: { summary: { citedEvidenceKeys: string[], decisionReview: { recommendation: string, accepted: boolean } }, provider: string } }
    expect(generatedPayload.data).toMatchObject({ provider: 'openai_compatible', summary: { citedEvidenceKeys: ['quality-roe'], decisionReview: { recommendation: 'bearish', accepted: true } } })
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual(expect.objectContaining({ authorization: 'Bearer sk-user-one-1234' }))
    await expect(client.execute('SELECT summary_json, cited_evidence_keys_json FROM quant_research_summary')).resolves.toMatchObject({
      rows: [{ summary_json: expect.not.stringContaining('sk-user-one-1234'), cited_evidence_keys_json: '["quality-roe"]' }],
    })

    const history = await userA.request('/api/quant/research/runs/summary-run-1/summary?limit=1', {}, env)
    expect(history.status).toBe(200)
    await expect(history.json()).resolves.toMatchObject({ data: [{ researchRunId: 'summary-run-1', citedEvidenceKeys: ['quality-roe'] }] })
    expect((await userB.request('/api/quant/research/runs/summary-run-1/summary', {}, env)).status).toBe(404)

    const rejected = await userA.request('/api/quant/research/runs/summary-run-1/summary', { method: 'POST' }, env)
    expect(rejected.status).toBe(502)
    await expect(client.execute('SELECT count(*) AS count FROM quant_research_summary')).resolves.toMatchObject({ rows: [{ count: 1 }] })
  })

  it('generates an in-memory AI comparison from current-user runs without writing research data', async () => {
    const { client, db } = await createDatabase()
    await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-2\', 2)')
    const reportFor = (tsCode: string, evidenceKey: string, status = 'ready') => JSON.stringify({
      reportVersion: 'research-report-v2',
      tsCode,
      name: tsCode === '601899.SH' ? '紫金矿业' : '平安银行',
      generatedAt: '2026-08-28T00:00:00.000Z',
      sourceSnapshotId: null,
      status,
      action: status === 'ready' ? 'research-window' : 'wait-confirmation',
      score: status === 'ready' ? 82 : 62,
      headline: status === 'ready' ? '证据链完整' : '部分证据需要确认',
      strengths: [],
      risks: [],
      gaps: [],
      nextActions: [],
      evidence: [{
        key: evidenceKey,
        dimension: 'quality',
        label: 'ROE',
        status: 'pass',
        value: 18,
        threshold: '至少 10%',
        source: 'Quant fixture',
        observedAt: '2026-08-28',
        formulaVersion: 'fixture-v1',
        detail: '来自已保存报告的事实。',
      }],
      sources: [],
    })
    for (const [id, tsCode, evidenceKey, userId, status] of [
      ['comparison-run-a', '601899.SH', 'comparison-roe-a', 'user-1', 'ready'],
      ['comparison-run-b', '000001.SZ', 'comparison-roe-b', 'user-1', 'ready'],
      ['foreign-comparison-run', '600000.SH', 'comparison-roe-foreign', 'user-2', 'ready'],
      ['foreign-comparison-run-2', '600519.SH', 'comparison-roe-foreign-2', 'user-2', 'ready'],
    ] as const) {
      await client.execute({
        sql: `INSERT INTO quant_research_run (
          id, user_id, ts_code, name, status, report_version, source_snapshot_id,
          report_json, generated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, userId, tsCode, tsCode, status, 'research-report-v2', null, reportFor(tsCode, evidenceKey, status), 10, 10],
      })
    }

    const userA = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const userB = createApp(db, { user: { id: 'user-2', role: 'user' } })
    const env = { QUANT_AI_ENCRYPTION_KEY: 'comparison-test-secret' } as AppEnv['Bindings']
    await userA.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        base_url: 'https://ai.example.test/v1',
        api_key: 'sk-comparison-route-secret',
      }),
    }, env)

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      overview: '两份报告都有可核对证据。',
      commonGround: ['都有一项财务证据'],
      differences: [{ tsCode: '601899.SH', point: 'ROE 证据可用', evidenceKeys: ['comparison-roe-a'] }],
      risks: ['报告期仍需人工核对'],
      nextChecks: ['复核来源日期'],
      citedEvidence: [
        { tsCode: '601899.SH', evidenceKey: 'comparison-roe-a' },
        { tsCode: '000001.SZ', evidenceKey: 'comparison-roe-b' },
      ],
    }) } }] }), { status: 200 }))

    const beforeRuns = await client.execute('SELECT id, report_json FROM quant_research_run ORDER BY id')
    const beforeSummaries = await client.execute('SELECT count(*) AS count FROM quant_research_summary')
    const extraFields = await userA.request('/api/quant/research/comparison', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run_ids: ['comparison-run-a', 'comparison-run-b'], report: 'client forged report', api_key: 'client forged key' }),
    }, env)
    expect(extraFields.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()

    const response = await userA.request('/api/quant/research/comparison', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run_ids: ['comparison-run-a', 'comparison-run-b'] }),
    }, env)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        comparisonVersion: 'research-comparison-v1',
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        differences: [{ tsCode: '601899.SH', evidenceKeys: ['comparison-roe-a'] }],
        citedEvidence: expect.arrayContaining([
          { tsCode: '601899.SH', evidenceKey: 'comparison-roe-a' },
          { tsCode: '000001.SZ', evidenceKey: 'comparison-roe-b' },
        ]),
      },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[1]?.content).toContain('comparison-roe-a')
    expect(requestBody.messages[1]?.content).not.toContain('client forged report')
    expect(requestBody.messages[1]?.content).not.toContain('sk-comparison-route-secret')
    await expect(client.execute('SELECT id, report_json FROM quant_research_run ORDER BY id')).resolves.toEqual(beforeRuns)
    await expect(client.execute('SELECT count(*) AS count FROM quant_research_summary')).resolves.toEqual(beforeSummaries)

    const foreign = await userA.request('/api/quant/research/comparison', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run_ids: ['comparison-run-a', 'foreign-comparison-run'] }),
    }, env)
    expect(foreign.status).toBe(404)
    await expect(foreign.json()).resolves.toMatchObject({ success: false, code: 'QUANT_NOT_FOUND' })
    expect(fetchMock).toHaveBeenCalledOnce()

    const missing = await userA.request('/api/quant/research/comparison', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run_ids: ['comparison-run-a', 'missing-comparison-run'] }),
    }, env)
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toMatchObject({ success: false, code: 'QUANT_NOT_FOUND' })
    expect(fetchMock).toHaveBeenCalledOnce()

    const invalid = await userA.request('/api/quant/research/comparison', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run_ids: ['comparison-run-a', 'comparison-run-a'] }),
    }, env)
    expect(invalid.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledOnce()

    for (const runIds of [
      ['comparison-run-a'],
      ['comparison-run-a', 'comparison-run-b', 'comparison-run-a', 'comparison-run-b'],
    ]) {
      const countInvalid = await userA.request('/api/quant/research/comparison', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ run_ids: runIds }),
      }, env)
      expect(countInvalid.status).toBe(400)
    }
    expect(fetchMock).toHaveBeenCalledOnce()

    const missingConfig = await userB.request('/api/quant/research/comparison', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run_ids: ['foreign-comparison-run', 'foreign-comparison-run-2'] }),
    }, env)
    expect(missingConfig.status).toBe(503)
    await expect(missingConfig.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_COMPARISON_CONFIGURATION' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('answers questions from the owned report without accepting forged input or persisting results', async () => {
    const { client, db } = await createDatabase()
    await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-2\', 2)')
    const reportFor = (tsCode: string, evidenceKey: string) => JSON.stringify({
      reportVersion: 'research-report-v2',
      tsCode,
      name: tsCode === '601899.SH' ? '紫金矿业' : '外部用户股票',
      generatedAt: '2026-08-29T00:00:00.000Z',
      sourceSnapshotId: null,
      status: 'partial',
      action: 'wait-confirmation',
      score: 72.5,
      headline: '等待确认：部分证据可用',
      strengths: [],
      risks: [],
      gaps: [],
      nextActions: [],
      evidence: [{
        key: evidenceKey,
        dimension: 'quality',
        label: 'ROE',
        status: 'pass',
        value: 18,
        threshold: '至少 10%',
        source: 'Quant fixture',
        observedAt: '2026-08-28',
        formulaVersion: 'fixture-v1',
        detail: '来自服务端保存报告的事实。',
      }],
      sources: [],
    })
    for (const [id, userId, tsCode, evidenceKey] of [
      ['question-run-owned', 'user-1', '601899.SH', 'question-roe'],
      ['question-run-foreign', 'user-2', '000001.SZ', 'foreign-roe'],
    ] as const) {
      await client.execute({
        sql: `INSERT INTO quant_research_run (
          id, user_id, ts_code, name, status, report_version, source_snapshot_id,
          report_json, generated_at, created_at
        ) VALUES (?, ?, ?, ?, 'partial', 'research-report-v2', NULL, ?, 10, 10)`,
        args: [id, userId, tsCode, tsCode, reportFor(tsCode, evidenceKey)],
      })
    }

    const userA = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const env = { QUANT_AI_ENCRYPTION_KEY: 'question-route-secret' } as AppEnv['Bindings']
    await userA.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        base_url: 'https://ai.example.test/v1',
        api_key: 'sk-question-route-secret',
      }),
    }, env)

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        answer: '报告显示 ROE 为 18%，达到至少 10% 的报告门槛。',
        citedEvidenceKeys: ['question-roe'],
      }) } }],
    }), { status: 200 }))
    const beforeRuns = await client.execute('SELECT id, report_json FROM quant_research_run ORDER BY id')
    const beforeSummaries = await client.execute('SELECT count(*) AS count FROM quant_research_summary')

    const forged = await userA.request('/api/quant/research/runs/question-run-owned/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'ROE 如何？', report: 'client forged report', model: 'client-forged-model', api_key: 'client-forged-key' }),
    }, env)
    expect(forged.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()

    const response = await userA.request('/api/quant/research/runs/question-run-owned/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: ' ROE 是否达到报告门槛？ ' }),
    }, env)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        questionVersion: 'research-question-v1',
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        question: 'ROE 是否达到报告门槛？',
        answer: expect.stringContaining('18%'),
        citedEvidenceKeys: ['question-roe'],
      },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[1]?.content).toContain('question-roe')
    expect(requestBody.messages[1]?.content).not.toContain('client forged report')
    expect(requestBody.messages[1]?.content).not.toContain('client-forged-key')
    expect(requestBody.messages[1]?.content).not.toContain('sk-question-route-secret')

    await expect(client.execute('SELECT id, report_json FROM quant_research_run ORDER BY id')).resolves.toEqual(beforeRuns)
    await expect(client.execute('SELECT count(*) AS count FROM quant_research_summary')).resolves.toEqual(beforeSummaries)

    for (const runId of ['question-run-foreign', 'question-run-missing']) {
      const missing = await userA.request(`/api/quant/research/runs/${runId}/question`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: '问题' }),
      }, env)
      expect(missing.status).toBe(404)
      await expect(missing.json()).resolves.toMatchObject({ success: false, code: 'QUANT_NOT_FOUND' })
    }
    expect(fetchMock).toHaveBeenCalledOnce()

    for (const question of ['', 'x'.repeat(501)]) {
      const invalid = await userA.request('/api/quant/research/runs/question-run-owned/question', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      }, env)
      expect(invalid.status).toBe(400)
    }
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects invalid AI comparison output without persisting a comparison or changing reports', async () => {
    const { client, db } = await createDatabase()
    const reportFor = (tsCode: string, evidenceKey: string) => JSON.stringify({
      reportVersion: 'research-report-v2',
      tsCode,
      name: null,
      generatedAt: '2026-08-28T00:00:00.000Z',
      sourceSnapshotId: null,
      status: 'ready',
      action: 'research-window',
      score: 80,
      headline: '证据链完整',
      strengths: [],
      risks: [],
      gaps: [],
      nextActions: [],
      evidence: [{
        key: evidenceKey,
        dimension: 'quality',
        label: 'ROE',
        status: 'pass',
        value: 18,
        threshold: '至少 10%',
        source: 'Quant fixture',
        observedAt: '2026-08-28',
        formulaVersion: 'fixture-v1',
        detail: '来自已保存报告的事实。',
      }],
      sources: [],
    })
    for (const [id, tsCode, evidenceKey] of [
      ['invalid-comparison-run-a', '601899.SH', 'comparison-roe-a'],
      ['invalid-comparison-run-b', '000001.SZ', 'comparison-roe-b'],
    ] as const) {
      await client.execute({
        sql: `INSERT INTO quant_research_run (
          id, user_id, ts_code, name, status, report_version, source_snapshot_id,
          report_json, generated_at, created_at
        ) VALUES (?, 'user-1', ?, NULL, 'ready', 'research-report-v2', NULL, ?, 10, 10)`,
        args: [id, tsCode, reportFor(tsCode, evidenceKey)],
      })
    }
    const app = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const env = { QUANT_AI_ENCRYPTION_KEY: 'comparison-invalid-secret' } as AppEnv['Bindings']
    await app.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        base_url: 'https://ai.example.test/v1',
        api_key: 'sk-invalid-comparison',
      }),
    }, env)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      overview: '包含交易结论',
      commonGround: [],
      differences: [],
      risks: [],
      nextChecks: [],
      citedEvidence: [{ tsCode: '601899.SH', evidenceKey: 'unknown-key' }],
    }) } }] }), { status: 200 }))
    const beforeRuns = await client.execute('SELECT id, report_json FROM quant_research_run ORDER BY id')
    const response = await app.request('/api/quant/research/comparison', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run_ids: ['invalid-comparison-run-a', 'invalid-comparison-run-b'] }),
    }, env)
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_COMPARISON_INVALID_RESPONSE' })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expect(client.execute('SELECT id, report_json FROM quant_research_run ORDER BY id')).resolves.toEqual(beforeRuns)
    await expect(client.execute('SELECT count(*) AS count FROM quant_research_summary')).resolves.toMatchObject({ rows: [{ count: 0 }] })
  })

  it('passes three current-user reports to the comparison model and classifies upstream errors', async () => {
    const { client, db } = await createDatabase()
    const reportFor = (tsCode: string, evidenceKey: string) => JSON.stringify({
      reportVersion: 'research-report-v2',
      tsCode,
      name: null,
      generatedAt: '2026-08-28T00:00:00.000Z',
      sourceSnapshotId: null,
      status: 'ready',
      action: 'research-window',
      score: 80,
      headline: '证据链完整',
      strengths: [],
      risks: [],
      gaps: [],
      nextActions: [],
      evidence: [{
        key: evidenceKey,
        dimension: 'quality',
        label: 'ROE',
        status: 'pass',
        value: 18,
        threshold: '至少 10%',
        source: 'fixture',
        observedAt: '2026-08-28',
        formulaVersion: 'fixture-v1',
        detail: '事实',
      }],
      sources: [],
    })
    for (const [id, tsCode, evidenceKey] of [
      ['three-run-a', '601899.SH', 'three-roe-a'],
      ['three-run-b', '000001.SZ', 'three-roe-b'],
      ['three-run-c', '600000.SH', 'three-roe-c'],
    ] as const) {
      await client.execute({
        sql: `INSERT INTO quant_research_run (
          id, user_id, ts_code, name, status, report_version, source_snapshot_id,
          report_json, generated_at, created_at
        ) VALUES (?, 'user-1', ?, NULL, 'ready', 'research-report-v2', NULL, ?, 10, 10)`,
        args: [id, tsCode, reportFor(tsCode, evidenceKey)],
      })
    }
    const app = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const env = { QUANT_AI_ENCRYPTION_KEY: 'three-comparison-secret' } as AppEnv['Bindings']
    await app.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        base_url: 'https://ai.example.test/v1',
        api_key: 'sk-three-comparison',
      }),
    }, env)
    const valid = JSON.stringify({
      overview: '三份报告均有证据。',
      commonGround: [],
      differences: [{
        tsCode: '600000.SH',
        point: '第三份报告',
        evidenceKeys: ['three-roe-c'],
      }],
      risks: [],
      nextChecks: [],
      citedEvidence: [{ tsCode: '600000.SH', evidenceKey: 'three-roe-c' }],
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: valid } }],
    }), { status: 200 }))
    const response = await app.request('/api/quant/research/comparison', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run_ids: ['three-run-a', 'three-run-b', 'three-run-c'] }),
    }, env)
    expect(response.status).toBe(200)
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[1]?.content).toContain('three-roe-c')

    fetchMock.mockResolvedValueOnce(new Response('upstream failed', { status: 500 }))
    const failed = await app.request('/api/quant/research/comparison', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run_ids: ['three-run-a', 'three-run-b'] }),
    }, env)
    expect(failed.status).toBe(502)
    await expect(failed.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_COMPARISON_UPSTREAM' })
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
      await createQuantWatchlistItem(db, { userId: 'user-1', tsCode, name })
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
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })
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

  it('falls back from Tushare quota to Eastmoney and keeps provider metadata out of secrets', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, { user: { role: 'admin' } })
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })
    await upsertQuantDailyBars(db, valueFixtureBars('601899.SH'))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(input.toString())
      if (url.origin === 'https://tushare.fixture.test')
        return new Response(JSON.stringify({ code: 402, msg: 'quota exhausted' }), { status: 200 })
      return new Response(JSON.stringify({
        code: 0,
        success: true,
        result: {
          data: [{
            SECURITY_CODE: '601899',
            REPORT_DATE: '2026-03-31 00:00:00',
            NOTICE_DATE: '2026-08-13 00:00:00',
            EX_DIVIDEND_DATE: '2026-08-21 00:00:00',
            PRETAX_BONUS_RMB: 4.2,
            ASSIGN_PROGRESS: '实施分配',
          }],
        },
      }), { status: 200 })
    })

    const response = await app.request('/api/quant/shareholder-returns', {}, {
      TUSHARE_TOKEN: 'fixture-token',
      TUSHARE_BASE_URL: 'https://tushare.fixture.test',
      EASTMONEY_DIVIDEND_BASE_URL: 'https://eastmoney-dividend.fixture.test',
    } as AppEnv['Bindings'])
    const payload = await response.json() as { data: { provider: string, providerChain: string[], items: Array<Record<string, unknown>> } }

    expect(response.status).toBe(200)
    expect(payload.data).toMatchObject({
      provider: 'tushare',
      providerChain: ['tushare', 'eastmoney'],
      items: [{
        provider: 'eastmoney',
        providerChain: ['tushare', 'eastmoney'],
        fallbackUsed: true,
        fallbackReason: 'QUANT_PROVIDER_QUOTA',
        providerErrorCode: null,
        trailingCashDividendPerShare: 0.42,
      }],
    })
    expect(JSON.stringify(payload)).not.toContain('fixture-token')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
