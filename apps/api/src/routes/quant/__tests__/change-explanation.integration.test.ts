import type { Database } from '@starye/db'
import type { AppEnv } from '../../../types'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import * as schema from '@starye/db/schema'
import { drizzle } from 'drizzle-orm/libsql'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quantRoutes } from '../index'

const migrationPaths = [
  new URL('../../../../../../packages/db/drizzle/0036_quant_workbench.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0037_quant_sync_lease.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0038_quant_watchlist_seed.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0039_quant_research_marker.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0041_quant_user_scope.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0042_quant_research_run.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0043_quant_research_summary.sql', import.meta.url),
]

async function createDatabase(): Promise<{ client: ReturnType<typeof createClient>, db: Database }> {
  const client = createClient({ url: 'file::memory:' })
  await client.execute('CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL)')
  await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-1\', 1)')
  for (const migrationPath of migrationPaths) {
    const migration = await readFile(fileURLToPath(migrationPath.href), 'utf8')
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

function report(generatedAt: string, value: number, tsCode = '601899.SH', status = 'partial'): string {
  return JSON.stringify({
    reportVersion: 'research-report-v2',
    tsCode,
    name: tsCode === '601899.SH' ? '紫金矿业' : '平安银行',
    generatedAt,
    sourceSnapshotId: null,
    status,
    action: 'wait-confirmation',
    score: value,
    headline: '部分证据需要确认',
    strengths: [],
    risks: [],
    gaps: [],
    nextActions: [],
    evidence: [{
      key: 'quality-roe',
      dimension: 'quality',
      label: 'ROE',
      status: value >= 15 ? 'pass' : 'caution',
      value,
      threshold: '至少 10%',
      source: 'Quant fixture',
      observedAt: generatedAt.slice(0, 10),
      formulaVersion: 'fixture-v1',
      detail: '来自已保存报告的事实。',
    }],
    sources: [],
  })
}

async function insertRun(client: ReturnType<typeof createClient>, id: string, userId: string, generatedAt: string, value: number, tsCode = '601899.SH') {
  await client.execute({
    sql: `INSERT INTO quant_research_run (
      id, user_id, ts_code, name, status, report_version, source_snapshot_id,
      report_json, generated_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, userId, tsCode, tsCode === '601899.SH' ? '紫金矿业' : '平安银行', 'partial', 'research-report-v2', null, report(generatedAt, value, tsCode), new Date(generatedAt).getTime(), new Date(generatedAt).getTime()],
  })
}

describe('quant research change explanation route', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('reads owned same-stock runs, returns the AI explanation, and never persists it', async () => {
    const { client, db } = await createDatabase()
    await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-2\', 2)')
    await insertRun(client, 'current-run', 'user-1', '2026-08-29T00:00:00.000Z', 18)
    await insertRun(client, 'previous-run', 'user-1', '2026-08-28T00:00:00.000Z', 9)
    await insertRun(client, 'foreign-run', 'user-2', '2026-08-27T00:00:00.000Z', 8)
    const app = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const env = { QUANT_AI_ENCRYPTION_KEY: 'change-route-secret' } as AppEnv['Bindings']
    await app.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai_compatible', model: 'gpt-5.4', base_url: 'https://ai.example.test/v1', api_key: 'sk-route-change' }),
    }, env)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      overview: 'ROE 证据从注意变为通过，仍需核对来源口径。',
      changes: [{ evidenceKey: 'quality-roe', explanation: 'ROE 数值上升，状态由注意变为通过；只描述报告观察差异。' }],
      nextChecks: ['复核来源日期和公式版本'],
      citedEvidenceKeys: ['quality-roe'],
    }) } }] }), { status: 200 }))

    const response = await app.request('/api/quant/research/runs/current-run/change-explanation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previous_run_id: 'previous-run' }),
    }, env)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        changeExplanationVersion: 'research-change-explanation-v1',
        currentGeneratedAt: '2026-08-29T00:00:00.000Z',
        previousGeneratedAt: '2026-08-28T00:00:00.000Z',
        changes: [{ evidenceKey: 'quality-roe', kind: 'improved' }],
        citedEvidenceKeys: ['quality-roe'],
      },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(body.messages[1]?.content).not.toContain('sk-route-change')
    await expect(client.execute('SELECT count(*) AS count FROM quant_research_summary')).resolves.toMatchObject({ rows: [{ count: 0 }] })

    const foreign = await app.request('/api/quant/research/runs/current-run/change-explanation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previous_run_id: 'foreign-run' }),
    }, env)
    expect(foreign.status).toBe(404)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects same run, malformed body, and missing previous run before calling AI', async () => {
    const { client, db } = await createDatabase()
    await insertRun(client, 'current-run', 'user-1', '2026-08-29T00:00:00.000Z', 18)
    const app = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const env = { QUANT_AI_ENCRYPTION_KEY: 'change-route-secret' } as AppEnv['Bindings']
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const malformed = await app.request('/api/quant/research/runs/current-run/change-explanation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previous_run_id: 'bad id', extra: true }),
    }, env)
    expect(malformed.status).toBe(400)

    const same = await app.request('/api/quant/research/runs/current-run/change-explanation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previous_run_id: 'current-run' }),
    }, env)
    expect(same.status).toBe(400)

    const missing = await app.request('/api/quant/research/runs/current-run/change-explanation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previous_run_id: 'missing-run' }),
    }, env)
    expect(missing.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects two owned runs for different stocks before calling AI', async () => {
    const { client, db } = await createDatabase()
    await insertRun(client, 'current-run', 'user-1', '2026-08-29T00:00:00.000Z', 18)
    await insertRun(client, 'other-stock-run', 'user-1', '2026-08-28T00:00:00.000Z', 12, '000001.SZ')
    const app = createApp(db, { user: { id: 'user-1', role: 'user' } })
    const env = { QUANT_AI_ENCRYPTION_KEY: 'change-route-secret' } as AppEnv['Bindings']
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await app.request('/api/quant/research/runs/current-run/change-explanation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previous_run_id: 'other-stock-run' }),
    }, env)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'QUANT_INVALID_INPUT',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
