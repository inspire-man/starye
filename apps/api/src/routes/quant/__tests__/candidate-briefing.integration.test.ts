import type { Database } from '@starye/db'
import type { AppEnv } from '../../../types'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import * as schema from '@starye/db/schema'
import { drizzle } from 'drizzle-orm/libsql'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuantCandidateAiSession, createQuantWatchlistItem, upsertQuantResearchMarker } from '../../../domain/quant/repository'
import { quantRoutes } from '../index'

const migrationPaths = [
  new URL('../../../../../../packages/db/drizzle/0036_quant_workbench.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0037_quant_sync_lease.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0038_quant_watchlist_seed.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0039_quant_research_marker.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0041_quant_user_scope.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0042_quant_research_run.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0043_quant_research_summary.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0044_quant_candidate_ai_session.sql', import.meta.url),
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

function validQuestionContent(citedCandidateCodes = ['601899.SH'], overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    answer: '当前候选事实显示，应先核对数据完整性和研究标记，再继续查看已有信号。',
    citedCandidateCodes,
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
    const responseBody = await response.json() as { success: boolean, data: { sessionId: string } }
    expect(responseBody).toMatchObject({
      success: true,
      data: {
        sessionId: expect.any(String),
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
    const historyResponse = await app.request('/api/quant/candidates/ai-sessions?limit=5', {}, env)
    expect(historyResponse.status).toBe(200)
    await expect(historyResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        limit: 5,
        items: [expect.objectContaining({
          id: responseBody.data.sessionId,
          snapshotId: 'snapshot-user-1',
          scopeKey: '601899.SH',
          candidateCodes: ['601899.SH'],
          briefing: expect.objectContaining({ briefingVersion: 'candidate-briefing-v1' }),
          questions: [],
        })],
      },
    })
    const detailResponse = await app.request(`/api/quant/candidates/ai-sessions/${responseBody.data.sessionId}`, {}, env)
    expect(detailResponse.status).toBe(200)
    await expect(detailResponse.json()).resolves.toMatchObject({
      success: true,
      data: { id: responseBody.data.sessionId, briefing: expect.objectContaining({ overview: expect.any(String) }) },
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

  it('answers only from the requested current candidate scope', async () => {
    const { client, db } = await createDatabase()
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '000001.SZ', name: '平安银行' })
    await insertSnapshot(client, 'user-1', 'snapshot-user-1', ['601899.SH', '000001.SZ'])
    const app = createApp(db, 'user-1')
    const env = { QUANT_AI_ENCRYPTION_KEY: 'candidate-question-route-secret' } as AppEnv['Bindings']
    await app.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai_compatible', model: 'gpt-5.4', base_url: 'https://ai.example.test/v1', api_key: 'sk-candidate-question-route' }),
    }, env)

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/chat/completions'))
        return aiResponse(validQuestionContent(['000001.SZ']))
      if (url.includes('/api/qt/stock/get'))
        return new Response(JSON.stringify({ rc: 0, data: { f57: '000001', f162: 12, f163: 12, f164: 10, f165: 2, f166: 1, f168: 1, f116: 1000000000 } }), { status: 200, headers: { 'content-type': 'application/json' } })
      if (url.includes('/PC_HSF10/'))
        return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ data: null }), { status: 200, headers: { 'content-type': 'application/json' } })
    })

    const response = await app.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['000001.sz'], question: '  当前范围内先核对什么？  ' }),
    }, env)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        questionVersion: 'candidate-briefing-question-v1',
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        question: '当前范围内先核对什么？',
        answer: expect.stringContaining('数据完整性'),
        citedCandidateCodes: ['000001.SZ'],
      },
    })
    const aiCall = fetchMock.mock.calls.find(call => String(call[0]).endsWith('/chat/completions'))
    expect(aiCall).toBeDefined()
    const requestBody = JSON.parse(String(aiCall?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[1]?.content).toContain('000001.SZ')
    expect(requestBody.messages[1]?.content).not.toContain('601899.SH')
    expect(requestBody.messages[1]?.content).not.toContain('sk-candidate-question-route')
    expect(aiCall?.[1]?.headers).toMatchObject({ authorization: 'Bearer sk-candidate-question-route' })
  })

  it('rejects invalid question scopes and client-owned facts before calling AI', async () => {
    const { client, db } = await createDatabase()
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })
    await insertSnapshot(client, 'user-1', 'snapshot-user-1')
    await createQuantWatchlistItem(db, { userId: 'user-2', tsCode: '000001.SZ', name: '平安银行' })
    await insertSnapshot(client, 'user-2', 'snapshot-user-2', ['000001.SZ'])
    const app = createApp(db, 'user-1')
    const env = { QUANT_AI_ENCRYPTION_KEY: 'candidate-question-route-secret' } as AppEnv['Bindings']
    await app.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai_compatible', model: 'gpt-5.4', base_url: 'https://ai.example.test/v1', api_key: 'sk-candidate-question-route' }),
    }, env)
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const missing = await app.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['601899.SH'] }),
    }, env)
    const empty = await app.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: [], question: '问题' }),
    }, env)
    const unknown = await app.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['999999.SZ'], question: '问题' }),
    }, env)
    const foreign = await app.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['000001.SZ'], question: '问题' }),
    }, env)
    const oversized = await app.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: Array.from({ length: 51 }, (_, index) => `${String(index).padStart(6, '0')}.SZ`), question: '问题' }),
    }, env)
    const clientOwned = await app.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['601899.SH'], question: '问题', candidates: [{ tsCode: 'FAKE.SZ' }] }),
    }, env)

    expect(missing.status).toBe(400)
    expect(empty.status).toBe(400)
    await expect(unknown.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INPUT' })
    await expect(foreign.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INPUT' })
    expect(oversized.status).toBe(400)
    expect(clientOwned.status).toBe(400)
    expect(fetchMock.mock.calls.filter(call => String(call[0]).endsWith('/chat/completions'))).toHaveLength(0)
  })

  it('requires authentication and configuration for candidate briefing questions', async () => {
    const { db } = await createDatabase()
    const unauthenticated = createApp(db, null)
    const unauthenticatedFetch = vi.spyOn(globalThis, 'fetch')
    const unauthorized = await unauthenticated.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['601899.SH'], question: '问题' }),
    })
    expect(unauthorized.status).toBe(401)
    expect(unauthenticatedFetch).not.toHaveBeenCalled()

    vi.restoreAllMocks()
    const { client: configuredClient, db: configuredDb } = await createDatabase()
    await createQuantWatchlistItem(configuredDb, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })
    await insertSnapshot(configuredClient, 'user-1', 'snapshot-user-1')
    const configured = createApp(configuredDb, 'user-1')
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const response = await configured.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['601899.SH'], question: '问题' }),
    }, { QUANT_AI_ENCRYPTION_KEY: 'candidate-question-route-secret' } as AppEnv['Bindings'])
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_CONFIGURATION' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('appends a question to the owned session and rejects a stale session before calling AI', async () => {
    const { client, db } = await createDatabase()
    await createQuantWatchlistItem(db, { userId: 'user-1', tsCode: '601899.SH', name: '紫金矿业' })
    await insertSnapshot(client, 'user-1', 'snapshot-user-1')
    const app = createApp(db, 'user-1')
    const env = { QUANT_AI_ENCRYPTION_KEY: 'candidate-session-route-secret' } as AppEnv['Bindings']
    await app.request('/api/quant/ai-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai_compatible', model: 'gpt-5.4', base_url: 'https://ai.example.test/v1', api_key: 'session-route-key' }),
    }, env)

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/chat/completions'))
        return aiResponse(validQuestionContent())
      if (url.includes('/api/qt/stock/get'))
        return new Response(JSON.stringify({ rc: 0, data: { f57: '601899', f162: 12, f163: 12, f164: 10, f165: 2, f166: 1, f168: 1, f116: 1000000000 } }), { status: 200, headers: { 'content-type': 'application/json' } })
      if (url.includes('/PC_HSF10/'))
        return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ data: null }), { status: 200, headers: { 'content-type': 'application/json' } })
    })

    const created = await createQuantCandidateAiSession(db, {
      userId: 'user-1',
      snapshotId: 'snapshot-user-1',
      snapshotGeneratedAt: new Date(1_756_435_200_000),
      fromDate: '20260801',
      toDate: '20260829',
      scopeKey: '601899.SH',
      candidateCodesJson: JSON.stringify(['601899.SH']),
      briefingJson: null,
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      createdAt: new Date(1_756_435_201_000),
    })

    const appended = await app.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['601899.SH'], question: '当前范围先核对什么？', session_id: created.id }),
    }, env)
    expect(appended.status).toBe(200)
    await expect(appended.json()).resolves.toMatchObject({ success: true, data: { sessionId: created.id } })
    const detail = await app.request(`/api/quant/candidates/ai-sessions/${created.id}`, {}, env)
    await expect(detail.json()).resolves.toMatchObject({
      success: true,
      data: { questions: [expect.objectContaining({ question: '当前范围先核对什么？' })] },
    })
    for (let index = 0; index < 10; index++) {
      const response = await app.request('/api/quant/candidates/ai-briefing/question', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ts_codes: ['601899.SH'], question: `追加问题 ${index}`, session_id: created.id }),
      }, env)
      expect(response.status).toBe(200)
    }
    const boundedDetail = await app.request(`/api/quant/candidates/ai-sessions/${created.id}`, {}, env)
    const boundedBody = await boundedDetail.json() as { success: boolean, data: { questions: Array<{ question: string }> } }
    expect(boundedBody).toMatchObject({
      success: true,
      data: {
        questions: expect.arrayContaining([expect.objectContaining({ question: '追加问题 0' })]),
      },
    })
    expect(boundedBody.data.questions).toHaveLength(10)

    await insertSnapshot(client, 'user-1', 'snapshot-z', ['601899.SH'])
    const callsBeforeStale = fetchMock.mock.calls.filter(call => String(call[0]).endsWith('/chat/completions')).length
    const stale = await app.request('/api/quant/candidates/ai-briefing/question', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_codes: ['601899.SH'], question: '过期会话问题', session_id: created.id }),
    }, env)
    expect(stale.status).toBe(422)
    await expect(stale.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_CANDIDATE_SESSION_STALE' })
    expect(fetchMock.mock.calls.filter(call => String(call[0]).endsWith('/chat/completions')).length).toBe(callsBeforeStale)
  })

  it('isolates candidate AI session history by user and bounds session retention', async () => {
    const { client, db } = await createDatabase()
    const snapshotGeneratedAt = new Date(1_756_435_200_000)
    for (let index = 0; index < 11; index++) {
      await createQuantCandidateAiSession(db, {
        userId: 'user-1',
        snapshotId: `snapshot-${index}`,
        snapshotGeneratedAt,
        fromDate: '20260801',
        toDate: '20260829',
        scopeKey: '601899.SH',
        candidateCodesJson: JSON.stringify(['601899.SH']),
        briefingJson: null,
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        createdAt: new Date(snapshotGeneratedAt.getTime() + index * 1000),
      })
    }
    const app = createApp(db, 'user-1')
    const history = await app.request('/api/quant/candidates/ai-sessions?limit=10')
    await expect(history.json()).resolves.toMatchObject({
      success: true,
      data: {
        limit: 10,
        items: expect.arrayContaining([expect.objectContaining({ snapshotId: 'snapshot-10' })]),
      },
    })
    await expect(client.execute('SELECT count(*) AS count FROM quant_candidate_ai_session WHERE user_id = \'user-1\'')).resolves.toMatchObject({ rows: [{ count: 10 }] })
  })

  it('does not expose another user session through list or detail', async () => {
    const { client, db } = await createDatabase()
    const other = await createQuantCandidateAiSession(db, {
      userId: 'user-2',
      snapshotId: 'snapshot-user-2',
      snapshotGeneratedAt: new Date(1_756_435_200_000),
      fromDate: '20260801',
      toDate: '20260829',
      scopeKey: '601899.SH',
      candidateCodesJson: JSON.stringify(['601899.SH']),
      briefingJson: null,
      provider: 'ollama',
      model: 'qwen3',
    })
    const app = createApp(db, 'user-1')
    const history = await app.request('/api/quant/candidates/ai-sessions')
    await expect(history.json()).resolves.toMatchObject({ success: true, data: { items: [] } })
    const detail = await app.request(`/api/quant/candidates/ai-sessions/${other.id}`)
    expect(detail.status).toBe(404)
    await expect(client.execute('SELECT count(*) AS count FROM quant_candidate_ai_session WHERE user_id = \'user-2\'')).resolves.toMatchObject({ rows: [{ count: 1 }] })
  })

  it('deletes only the owned candidate AI session and confirms the delete readback', async () => {
    const { client, db } = await createDatabase()
    const owned = await createQuantCandidateAiSession(db, {
      userId: 'user-1',
      snapshotId: 'snapshot-user-1',
      snapshotGeneratedAt: new Date(1_756_435_200_000),
      fromDate: '20260801',
      toDate: '20260829',
      scopeKey: '601899.SH',
      candidateCodesJson: JSON.stringify(['601899.SH']),
      briefingJson: null,
      provider: 'openai_compatible',
      model: 'gpt-5.4',
    })
    const foreign = await createQuantCandidateAiSession(db, {
      userId: 'user-2',
      snapshotId: 'snapshot-user-2',
      snapshotGeneratedAt: new Date(1_756_435_200_000),
      fromDate: '20260801',
      toDate: '20260829',
      scopeKey: '601899.SH',
      candidateCodesJson: JSON.stringify(['601899.SH']),
      briefingJson: null,
      provider: 'ollama',
      model: 'qwen3',
    })
    const app = createApp(db, 'user-1')
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const deleted = await app.request(`/api/quant/candidates/ai-sessions/${owned.id}`, { method: 'DELETE' })
    expect(deleted.status).toBe(200)
    await expect(deleted.json()).resolves.toMatchObject({
      success: true,
      data: { deleted: true, sessionId: owned.id },
    })

    const list = await app.request('/api/quant/candidates/ai-sessions')
    await expect(list.json()).resolves.toMatchObject({ success: true, data: { items: [] } })
    const missingDetail = await app.request(`/api/quant/candidates/ai-sessions/${owned.id}`)
    expect(missingDetail.status).toBe(404)
    const repeatedDelete = await app.request(`/api/quant/candidates/ai-sessions/${owned.id}`, { method: 'DELETE' })
    expect(repeatedDelete.status).toBe(404)

    const foreignDelete = await app.request(`/api/quant/candidates/ai-sessions/${foreign.id}`, { method: 'DELETE' })
    expect(foreignDelete.status).toBe(404)
    const otherUserDetail = await createApp(db, 'user-2').request(`/api/quant/candidates/ai-sessions/${foreign.id}`)
    expect(otherUserDetail.status).toBe(200)
    await expect(client.execute('SELECT count(*) AS count FROM quant_candidate_ai_session WHERE user_id = \'user-1\'')).resolves.toMatchObject({ rows: [{ count: 0 }] })
    await expect(client.execute('SELECT count(*) AS count FROM quant_candidate_ai_session WHERE user_id = \'user-2\'')).resolves.toMatchObject({ rows: [{ count: 1 }] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when persisted candidate AI content is corrupted', async () => {
    const { client, db } = await createDatabase()
    await client.execute(`
      INSERT INTO quant_candidate_ai_session (
        id, user_id, snapshot_id, snapshot_generated_at, from_date, to_date, scope_key,
        candidate_codes_json, briefing_json, questions_json, provider, model, created_at, updated_at
      ) VALUES ('corrupt-session', 'user-1', 'snapshot-1', 1756435200, '20260801', '20260829', '601899.SH', ?, '{bad-json', '[]', 'openai_compatible', 'gpt-5.4', 1756435200, 1756435200)
    `, ['["601899.SH"]'])
    const app = createApp(db, 'user-1')

    const response = await app.request('/api/quant/candidates/ai-sessions/corrupt-session')

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ success: false, code: 'QUANT_AI_CANDIDATE_SESSION_INVALID' })
  })
})
