import type { Database } from '@starye/db'
import type { QuantResearchReport } from '../../../domain/quant/research-report'
import type { DailyBar } from '../../../domain/quant/types'
import type { AppEnv } from '../../../types'
import { readFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import * as schema from '@starye/db/schema'
import { drizzle } from 'drizzle-orm/libsql'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveQuantAiConfig } from '../../../domain/quant/ai-config'
import { createQuantResearchRun, upsertQuantDailyBars } from '../../../domain/quant/repository'
import { quantRoutes } from '../index'

const migrationNames = [
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
].map(name => new URL(`../../../../../../packages/db/drizzle/${name}`, import.meta.url))

function report(): QuantResearchReport {
  return {
    reportVersion: 'research-report-v2',
    tsCode: '601899.SH',
    name: '紫金矿业',
    generatedAt: '2026-08-29T00:00:00.000Z',
    sourceSnapshotId: null,
    status: 'ready',
    action: 'research-window',
    score: 78,
    headline: '看多',
    strengths: [],
    risks: [],
    gaps: [],
    nextActions: [],
    evidence: [{
      key: 'trend-sample',
      dimension: 'trend',
      label: '趋势样本',
      status: 'pass',
      value: 1,
      threshold: 'fixture',
      source: 'fixture',
      observedAt: '20260829',
      formulaVersion: 'fixture-v1',
      detail: 'fixture',
    }],
    sources: [{ id: 'local-daily-bars', name: '本地 Quant 日线库', observedAt: '20260829', formulaVersion: 'daily-bars-v1' }],
    decision: {
      decisionVersion: 'research-decision-v1',
      recommendation: 'bullish',
      label: '看多',
      deterministicScore: 78,
      confidence: 78,
      coverage: 100,
      buyPriceRange: {
        low: 30,
        high: 35,
        currency: 'CNY',
        formulaVersion: 'reference-price-v1',
        source: '本地 Quant 日线库',
        observedAt: '20260829',
        evidenceKeys: ['trend-sample'],
      },
      sellPriceRange: null,
      evidenceKeys: ['trend-sample'],
      invalidationConditions: ['趋势转弱'],
      headline: '看多',
    },
  }
}

async function createDatabase(): Promise<{ client: ReturnType<typeof createClient>, db: Database }> {
  const client = createClient({ url: 'file::memory:' })
  await client.execute('PRAGMA foreign_keys = ON')
  await client.execute('CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL)')
  await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-1\', 1), (\'user-2\', 2)')
  for (const migrationPath of migrationNames) {
    const migration = await readFile(migrationPath, 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }
  return { client, db: drizzle(client, { schema }) as unknown as Database }
}

function createApp(db: Database, userId: string) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('auth', { api: { getSession: vi.fn().mockResolvedValue({ user: { id: userId, role: 'user' } }) } } as any)
    await next()
  })
  app.route('/api/quant', quantRoutes)
  return app
}

function marketQuoteResponse(price = 28.8, observedAt = Math.floor(Date.now() / 1_000)): Response {
  return new Response(JSON.stringify({
    rc: 0,
    data: { f43: price, f57: '601899', f58: '紫金矿业', f60: 33.2, f169: -4.4, f170: -13.25, f86: observedAt },
  }), { status: 200 })
}

describe('quant decision assistant API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('persists a holding assessment and reads it back for the same user', async () => {
    const { client, db } = await createDatabase()
    const research = await createQuantResearchRun(db, {
      userId: 'user-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      status: 'ready',
      reportVersion: 'research-report-v2',
      sourceSnapshotId: null,
      reportJson: JSON.stringify(report()),
      generatedAt: new Date('2026-08-29T00:00:00.000Z'),
    })
    const bar: DailyBar = {
      tsCode: '601899.SH',
      tradeDate: '20260829',
      open: 33,
      high: 34,
      low: 32,
      close: 33.2,
      preClose: 32.8,
      change: 0.4,
      pctChg: 1.2,
      volume: 1_000,
      amount: 10_000,
    }
    await upsertQuantDailyBars(db, [bar])
    const app = createApp(db, 'user-1')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(marketQuoteResponse())

    const create = await app.request('/api/quant/decision-assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        research_run_id: research.id,
        mode: 'holding',
        cost_basis: 33.4,
        include_ai: false,
      }),
    })
    expect(create.status).toBe(201)
    await expect(create.json()).resolves.toMatchObject({
      success: true,
      data: {
        tsCode: '601899.SH',
        scenario: { mode: 'holding', currentPrice: 28.8, costBasis: 33.4 },
        market: { currentPrice: 28.8, currentPriceSource: 'eastmoney-realtime', currentPriceStatus: 'realtime' },
        deterministic: { unrealizedPnlPercent: -13.77, recoveryPercent: 15.97 },
        ai: { status: 'not-requested', accepted: false },
        final: { source: 'deterministic' },
      },
    })
    expect(globalThis.fetch).toHaveBeenCalledOnce()

    const history = await app.request('/api/quant/decision-assistant/601899.SH?limit=10')
    expect(history.status).toBe(200)
    await expect(history.json()).resolves.toMatchObject({ data: { items: [{ researchRunId: research.id, scenario: { currentPrice: 28.8 } }], limit: 10 } })
    await expect(client.execute('SELECT count(*) AS count FROM quant_decision_assessment WHERE user_id = \'user-1\'')).resolves.toMatchObject({ rows: [{ count: 1 }] })
  })

  it('uses the latest local close when the automatic market quote is unavailable', async () => {
    const { db } = await createDatabase()
    const research = await createQuantResearchRun(db, {
      userId: 'user-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      status: 'ready',
      reportVersion: 'research-report-v2',
      sourceSnapshotId: null,
      reportJson: JSON.stringify(report()),
      generatedAt: new Date('2026-08-29T00:00:00.000Z'),
    })
    await upsertQuantDailyBars(db, [{
      tsCode: '601899.SH',
      tradeDate: '20260829',
      open: 33,
      high: 34,
      low: 32,
      close: 33.2,
      preClose: 32.8,
      change: 0.4,
      pctChg: 1.2,
      volume: 1_000,
      amount: 10_000,
    }])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }))

    const response = await createApp(db, 'user-1').request('/api/quant/decision-assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ research_run_id: research.id, mode: 'buy', include_ai: false }),
    })
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        scenario: { currentPrice: 33.2 },
        market: { currentPriceSource: 'local-daily-bars', currentPriceStatus: 'latest-close', quoteErrorCode: 'QUANT_PROVIDER_UPSTREAM' },
        deterministic: { priceDetail: expect.stringContaining('本地最新收盘回退') },
      },
    })
  })

  it('does not label an old upstream quote as realtime', async () => {
    const { db } = await createDatabase()
    const research = await createQuantResearchRun(db, {
      userId: 'user-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      status: 'ready',
      reportVersion: 'research-report-v2',
      sourceSnapshotId: null,
      reportJson: JSON.stringify(report()),
      generatedAt: new Date('2026-08-29T00:00:00.000Z'),
    })
    await upsertQuantDailyBars(db, [{
      tsCode: '601899.SH',
      tradeDate: '20260829',
      open: 33,
      high: 34,
      low: 32,
      close: 33.2,
      preClose: 32.8,
      change: 0.4,
      pctChg: 1.2,
      volume: 1_000,
      amount: 10_000,
    }])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(marketQuoteResponse(34.65, 1_787_904_693))

    const response = await createApp(db, 'user-1').request('/api/quant/decision-assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ research_run_id: research.id, mode: 'buy', include_ai: false }),
    })
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        scenario: { currentPrice: 33.2 },
        market: { currentPriceSource: 'local-daily-bars', currentPriceStatus: 'latest-close', quoteErrorCode: 'QUANT_MARKET_QUOTE_STALE' },
      },
    })
  })

  it('rejects missing holding cost and keeps research assessments user-scoped', async () => {
    const { db } = await createDatabase()
    const research = await createQuantResearchRun(db, {
      userId: 'user-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      status: 'ready',
      reportVersion: 'research-report-v2',
      sourceSnapshotId: null,
      reportJson: JSON.stringify(report()),
      generatedAt: new Date('2026-08-29T00:00:00.000Z'),
    })
    const userA = createApp(db, 'user-1')
    const userB = createApp(db, 'user-2')

    const missingCost = await userA.request('/api/quant/decision-assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ research_run_id: research.id, mode: 'holding', include_ai: false }),
    })
    expect(missingCost.status).toBe(422)

    const foreignRun = await userB.request('/api/quant/decision-assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ research_run_id: research.id, mode: 'buy', include_ai: false }),
    })
    expect(foreignRun.status).toBe(422)
    await expect(foreignRun.json()).resolves.toMatchObject({ code: 'QUANT_DECISION_ASSISTANT_RESEARCH_REQUIRED' })
  })

  it('persists a deterministic assessment when the configured AI upstream fails', async () => {
    const { db } = await createDatabase()
    const research = await createQuantResearchRun(db, {
      userId: 'user-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      status: 'ready',
      reportVersion: 'research-report-v2',
      sourceSnapshotId: null,
      reportJson: JSON.stringify(report()),
      generatedAt: new Date('2026-08-29T00:00:00.000Z'),
    })
    await saveQuantAiConfig(db, {
      userId: 'user-1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      baseUrl: 'https://ai.fixture.test/v1',
      apiKey: 'fixture-key',
    }, 'fixture-encryption-secret')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      return String(input).includes('/api/qt/stock/get')
        ? marketQuoteResponse(34.65)
        : new Response('{}', { status: 502 })
    })

    const response = await createApp(db, 'user-1').request('/api/quant/decision-assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ research_run_id: research.id, mode: 'buy' }),
    })
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        ai: { status: 'failed', accepted: false, errorCode: 'QUANT_DECISION_ASSISTANT_UPSTREAM' },
        final: { source: 'deterministic' },
      },
    })
  })
})
