import type { Database } from '@starye/db'
import type { AppEnv } from '../../../types'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import * as schema from '@starye/db/schema'
import { drizzle } from 'drizzle-orm/libsql'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuantWatchlistItem, upsertQuantResearchMarker } from '../../../domain/quant/repository'
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
  await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-1\', 1), (\'user-2\', 2)')
  for (const migrationPath of migrationPaths) {
    const migration = await readFile(fileURLToPath(migrationPath.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }
  return { client, db: drizzle(client, { schema }) as unknown as Database }
}

function createApp(db: Database, userId: string | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('auth', { api: { getSession: vi.fn().mockResolvedValue(userId ? { user: { id: userId, role: 'user' } } : null) } } as any)
    await next()
  })
  app.route('/api/quant', quantRoutes)
  return app
}

async function insertSnapshot(client: ReturnType<typeof createClient>, userId: string, id: string, tsCodes: readonly string[] = ['601899.SH']) {
  const generatedAt = 1_756_435_200
  await client.execute({
    sql: `INSERT INTO quant_scan_snapshot (
      id, user_id, status, factor_version, input_ts_codes_json, from_date, to_date,
      candidate_count, candidates_json, generated_at, created_at
    ) VALUES (?, ?, 'completed', 'momentum-v1', ?, '20260801', '20260829', ?, ?, ?, ?)`,
    args: [id, userId, JSON.stringify(tsCodes), tsCodes.length, JSON.stringify(tsCodes.map(tsCode => ({
      tsCode,
      factorVersion: 'momentum-v1',
      factors: {
        ma5: 12,
        ma20: 11,
        isNewHigh20: false,
        consecutiveUpDays: 2,
        volumeRatio: 1.4,
        return20: 0.08,
        relativeStrength: 0.8,
      },
      matchedFactors: ['ma20', 'relative_strength'],
      missingFactors: [],
      dataQuality: 'ready',
      score: 2,
    }))), generatedAt, generatedAt],
  })
}

function aiResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function validBriefingContent(tsCode = '601899.SH', overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    overview: '当前候选先核对研究标记和已有信号，再继续查看数据完整性。',
    focusItems: [{ tsCode, explanation: '先回看该候选已有的信号与研究记录，保持与确定性原因一致。' }],
    nextChecks: ['复核候选数据截至日期', '确认研究标记是否仍然有效'],
    citedCandidateCodes: [tsCode],
    ...overrides,
  })
}

describe('quant candidate AI briefing route', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('requires authentication and does not call AI for an unauthenticated request', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, null)
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await app.request('/api/quant/candidates/ai-briefing', { method: 'POST' })

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reads owned candidates on the server and restores deterministic fields', async () => {
    const { client, db } = await createDatabase()
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })
    await insertSnapshot(client, 'user-1', 'snapshot-user-1')
    await upsertQuantResearchMarker(db, { userId: 'user-1', tsCode: '601899.SH', status: 'priority', note: null, reviewDate: null })
    const app = createApp(db, 'user-1')
    const env = { QUANT_AI_ENCRYPTION_KEY: 'candidate-route-secret' } as AppEnv['Bindings']
    await app.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai_compatible', model: 'gpt-5.4', base_url: 'https://ai.example.test/v1', api_key: 'sk-candidate-route' }),
    }, env)

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, _init) => {
      const url = String(input)
      if (url.endsWith('/chat/completions'))
        return aiResponse(validBriefingContent())
      if (url.includes('/api/qt/stock/get'))
        return new Response(JSON.stringify({ rc: 0, data: { f57: '601899', f162: 12, f163: 12, f164: 10, f165: 2, f166: 1, f168: 1, f116: 1000000000 } }), { status: 200, headers: { 'content-type': 'application/json' } })
      if (url.includes('/PC_HSF10/'))
        return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ data: null }), { status: 200, headers: { 'content-type': 'application/json' } })
    })

    const response = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['601899.SH'] }),
    }, env)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        briefingVersion: 'candidate-briefing-v1',
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        focusItems: [{
          tsCode: '601899.SH',
          name: '紫金矿业',
          priorityLevel: 'normal',
          actionLabel: '补看价值质量',
          reasons: expect.arrayContaining(['已标记为重点关注']),
        }],
        citedCandidateCodes: ['601899.SH'],
      },
    })
    const aiCall = fetchMock.mock.calls.find(call => String(call[0]).endsWith('/chat/completions'))
    expect(aiCall).toBeDefined()
    const requestBody = JSON.parse(String(aiCall?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[1]?.content).toContain('601899.SH')
    expect(aiCall?.[1]?.headers).toMatchObject({ authorization: 'Bearer sk-candidate-route' })
    expect(requestBody.messages[1]?.content).not.toContain('sk-candidate-route')
  })

  it('limits facts to the requested current snapshot scope and rejects invalid scopes before AI', async () => {
    const { client, db } = await createDatabase()
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '000001.SZ', name: '平安银行' })
    await insertSnapshot(client, 'user-1', 'snapshot-user-1', ['601899.SH', '000001.SZ'])
    const app = createApp(db, 'user-1')
    const env = { QUANT_AI_ENCRYPTION_KEY: 'candidate-route-secret' } as AppEnv['Bindings']
    await app.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai_compatible', model: 'gpt-5.4', base_url: 'https://ai.example.test/v1', api_key: 'sk-candidate-route' }),
    }, env)

    let aiCallCount = 0
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/chat/completions')) {
        aiCallCount++
        return aiResponse(validBriefingContent('000001.SZ'))
      }
      if (url.includes('/api/qt/stock/get'))
        return new Response(JSON.stringify({ rc: 0, data: { f57: '000001', f162: 12, f163: 12, f164: 10, f165: 2, f166: 1, f168: 1, f116: 1000000000 } }), { status: 200, headers: { 'content-type': 'application/json' } })
      if (url.includes('/PC_HSF10/'))
        return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ data: null }), { status: 200, headers: { 'content-type': 'application/json' } })
    })

    const selected = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['000001.sz'] }),
    }, env)

    expect(selected.status).toBe(200)
    const selectedBody = JSON.parse(String((fetchMock.mock.calls.find(call => String(call[0]).endsWith('/chat/completions'))?.[1] as RequestInit | undefined)?.body)) as { messages: Array<{ content: string }> }
    expect(selectedBody.messages[1]?.content).toContain('000001.SZ')
    expect(selectedBody.messages[1]?.content).not.toContain('601899.SH')
    expect(aiCallCount).toBe(1)

    const omitted = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }, env)
    const allCalls = fetchMock.mock.calls.filter(call => String(call[0]).endsWith('/chat/completions'))
    const omittedBody = JSON.parse(String((allCalls[1]?.[1] as RequestInit | undefined)?.body)) as { messages: Array<{ content: string }> }
    expect(omitted.status).toBe(200)
    expect(omittedBody.messages[1]?.content).toContain('000001.SZ')
    expect(omittedBody.messages[1]?.content).toContain('601899.SH')
    expect(aiCallCount).toBe(2)

    const empty = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: [] }),
    }, env)
    const unknown = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['999999.SZ'] }),
    }, env)
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '600000.SH', name: '浦发银行' })
    const pending = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['600000.SH'] }),
    }, env)
    await createQuantWatchlistItem(db, { userId: 'user-2', tsCode: '600000.SH', name: '浦发银行' })
    await insertSnapshot(client, 'user-2', 'snapshot-user-2', ['600000.SH'])
    const isolated = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['600000.SH'] }),
    }, env)
    const oversized = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: Array.from({ length: 51 }, (_, index) => `${String(index).padStart(6, '0')}.SZ`) }),
    }, env)

    expect(empty.status).toBe(422)
    await expect(empty.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_CANDIDATE_BRIEFING_INPUT' })
    expect(unknown.status).toBe(422)
    await expect(unknown.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_CANDIDATE_BRIEFING_INPUT' })
    expect(pending.status).toBe(422)
    await expect(pending.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_CANDIDATE_BRIEFING_INPUT' })
    expect(isolated.status).toBe(422)
    await expect(isolated.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_CANDIDATE_BRIEFING_INPUT' })
    expect(oversized.status).toBe(400)
    await expect(oversized.json()).resolves.toMatchObject({ success: false, error: expect.any(Array), data: { ts_codes: expect.any(Array) } })
    expect(aiCallCount).toBe(2)
  })

  it('rejects client-owned candidate facts at the request boundary', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, 'user-1')
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['601899.SH'], candidates: [{ tsCode: 'FAKE.SZ', priorityScore: 100 }] }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ success: false, error: expect.any(Array), data: expect.objectContaining({ ts_codes: ['601899.SH'] }) })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails with typed input state for a user without a current snapshot and preserves isolation', async () => {
    const { db } = await createDatabase()
    const app = createApp(db, 'user-2')
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'QUANT_AI_CANDIDATE_BRIEFING_INPUT',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a typed configuration error before calling AI when no user configuration exists', async () => {
    const { client, db } = await createDatabase()
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })
    await insertSnapshot(client, 'user-1', 'snapshot-user-1')
    const app = createApp(db, 'user-1')
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await app.request('/api/quant/candidates/ai-briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'QUANT_AI_CANDIDATE_BRIEFING_CONFIGURATION',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
