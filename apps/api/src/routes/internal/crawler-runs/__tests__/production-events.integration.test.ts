import type { Client, InStatement } from '@libsql/client'
import { readFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import { createDb } from '@starye/db'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createCrawlerTaskRepository } from '../../../../domain/crawler-tasks/repository'
import { base64UrlEncode } from '../../../../domain/crawler-tasks/runner-event-auth'
import { createCrawlerRunsRoutes } from '../index'

interface D1Result<T = unknown> {
  meta: { changes: number }
  results: T[]
}

class LibsqlStatement {
  private values: unknown[] = []

  constructor(private readonly client: Client, private readonly sql: string) {}

  bind(...values: unknown[]) {
    this.values = values
    return this
  }

  async all<T>(): Promise<D1Result<T>> {
    const result = await this.client.execute({ args: this.values, sql: this.sql })
    return { meta: { changes: result.rowsAffected }, results: result.rows as unknown as T[] }
  }

  async run(): Promise<D1Result> {
    const result = await this.client.execute({ args: this.values, sql: this.sql })
    return { meta: { changes: result.rowsAffected }, results: [] }
  }

  toStatement(): InStatement {
    return { args: this.values, sql: this.sql }
  }
}

class LibsqlD1 {
  constructor(private readonly client: Client) {}

  prepare(sql: string) {
    return new LibsqlStatement(this.client, sql)
  }

  async batch(statements: LibsqlStatement[]) {
    const result = await this.client.batch(statements.map(statement => statement.toStatement()), 'write')
    return result.map(item => ({ meta: { changes: item.rowsAffected } }))
  }
}

async function createTestDatabase() {
  const client = createClient({ url: 'file::memory:' })
  await client.execute(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      email_verified INTEGER NOT NULL,
      role TEXT NOT NULL,
      is_adult INTEGER,
      is_r18_verified INTEGER NOT NULL,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  await client.execute({
    args: ['github-actions-schedule', 'GitHub Actions', 'github-actions@example.com', 1, 'admin', 0, 1, 1, 1],
    sql: 'INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',
  })
  await client.execute(`
    CREATE TABLE movie (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      code TEXT NOT NULL,
      total_players INTEGER DEFAULT 0,
      crawled_players INTEGER DEFAULT 0
    )
  `)
  await client.execute({
    args: ['movie-1', 'Fixture movie', 'fixture-movie', 'MOVIE-001', 1, 1],
    sql: 'INSERT INTO movie (id, title, slug, code, total_players, crawled_players) VALUES (?, ?, ?, ?, ?, ?)',
  })
  const foundation = await readFile(new URL('../../../../../../../packages/db/drizzle/0027_crawler_task_domain_foundation.sql', import.meta.url), 'utf8')
  const provider = await readFile(new URL('../../../../../../../packages/db/drizzle/0028_crawler_provider_association.sql', import.meta.url), 'utf8')
  const statements = [foundation, provider]
    .flatMap(migration => migration.split('--> statement-breakpoint'))
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(sql => ({ sql }))
  await client.batch(statements, 'write')
  return { client, db: createDb(new LibsqlD1(client) as never) }
}

async function createHarness() {
  const database = await createTestDatabase()
  let nextId = 0
  let now = new Date('2026-07-30T00:00:00.000Z')
  const repository = createCrawlerTaskRepository(database.db, {
    createId: () => `route-fixture-${++nextId}`,
    now: () => now,
  })
  const app = new Hono<any>()
  app.use('*', async (c, next) => {
    c.env = {
      TASK_RUNNER_CALLBACK_KEY_ID_CURRENT: 'key-current',
      TASK_RUNNER_CALLBACK_SECRET_CURRENT: 'runner-secret',
    }
    c.set('db', database.db)
    await next()
  })
  app.route('/crawler-runs', createCrawlerRunsRoutes({
    createRepository: () => repository as never,
    now: () => now.getTime(),
  }))
  return {
    ...database,
    app,
    now: (value: Date) => {
      now = value
    },
    repository,
  }
}

async function signBody(body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('runner-secret'), { hash: 'SHA-256', name: 'HMAC' }, false, ['sign'])
  return base64UrlEncode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
}

async function postSigned(app: Hono<any>, path: string, event: Record<string, unknown>) {
  const body = JSON.stringify(event)
  return app.request(path, {
    body,
    headers: {
      'content-type': 'application/json',
      'x-runner-key-id': 'key-current',
      'x-runner-signature': await signBody(body),
    },
    method: 'POST',
  })
}

function scheduleEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'schedule-route-1',
    key_id: 'key-current',
    nonce: 'schedule-route-nonce-1',
    scheduled_at: '2026-07-30T00:00:00.000Z',
    schedule_bucket: '2026-07-30T00:00Z',
    target: 'starye-org',
    template: 'movie',
    timestamp: new Date('2026-07-30T00:00:00.000Z').getTime(),
    type: 'schedule_register',
    workflow: '.github/workflows/daily-movie-crawl.yml',
    repository: 'inspire-man/starye',
    ref: 'main',
    environment: 'starye-org',
    ...overrides,
  }
}

function providerStartedEvent(runId: string, overrides: Record<string, unknown> = {}) {
  return {
    attempt: 1,
    environment: 'starye-org',
    event_id: 'provider-route-1',
    key_id: 'key-current',
    nonce: 'provider-route-nonce-1',
    provider_run_attempt: 1,
    provider_run_id: '12345',
    ref: 'main',
    repository: 'inspire-man/starye',
    run_id: runId,
    sha: 'a'.repeat(40),
    target: 'starye-org',
    template: 'movie',
    timestamp: new Date('2026-07-30T00:00:00.000Z').getTime(),
    type: 'provider_started',
    workflow: '.github/workflows/daily-movie-crawl.yml',
    ...overrides,
  }
}

describe('production crawler-run callback integration', () => {
  it('keeps schedule registration idempotent and stores only redacted provider facts', async () => {
    const { app, client, repository } = await createHarness()
    const first = await postSigned(app, '/crawler-runs/schedule-register', scheduleEvent())
    const duplicate = await postSigned(app, '/crawler-runs/schedule-register', scheduleEvent({
      event_id: 'schedule-route-duplicate',
      nonce: 'schedule-route-nonce-duplicate',
    }))

    expect(first.status).toBe(200)
    expect(duplicate.status).toBe(200)
    const firstPayload = await first.json() as { run_id: string }
    const duplicatePayload = await duplicate.json() as { run_id: string }
    expect(duplicatePayload).toEqual(expect.objectContaining({ run_id: firstPayload.run_id, attempt: 1 }))
    await expect(repository.getProviderAssociation(firstPayload.run_id)).resolves.toMatchObject({
      applicationAttempt: 1,
      scheduleBucket: '2026-07-30T00:00Z',
    })
    const rows = await client.execute({ args: [firstPayload.run_id], sql: 'SELECT safe_facts_json FROM crawler_run_provider_association WHERE run_id = ?' })
    expect(String(rows.rows[0]?.safe_facts_json ?? '')).not.toMatch(/token|secret|private[_-]?key/i)
  })

  it('accepts only the bound provider callback order before a terminal receipt', async () => {
    const { app, repository } = await createHarness()
    const scheduled = await postSigned(app, '/crawler-runs/schedule-register', scheduleEvent())
    const { run_id: runId } = await scheduled.json() as { run_id: string }
    await repository.claimDispatch(runId)

    const started = await postSigned(app, `/crawler-runs/${runId}/provider-started`, providerStartedEvent(runId))
    expect(started.status).toBe(200)
    await expect(started.json()).resolves.toEqual({ accepted: true, cancel_requested: false })

    const heartbeat = await postSigned(app, `/crawler-runs/${runId}/events`, {
      attempt: 1,
      event_id: 'heartbeat-route-1',
      key_id: 'key-current',
      nonce: 'heartbeat-route-nonce-1',
      run_id: runId,
      sequence: 2,
      timestamp: new Date('2026-07-30T00:00:00.000Z').getTime(),
      type: 'heartbeat',
    })
    expect(heartbeat.status).toBe(200)

    await expect(repository.recordProviderObservation({
      attempt: 1,
      conclusion: 'success',
      headSha: 'a'.repeat(40),
      path: '.github/workflows/daily-movie-crawl.yml',
      providerRunAttempt: 1,
      providerRunId: '12345',
      runId,
      status: 'completed',
    })).resolves.toMatchObject({ kind: 'updated', status: 'completed' })

    const terminal = await postSigned(app, `/crawler-runs/${runId}/events`, {
      attempt: 1,
      event_id: 'success-route-1',
      key_id: 'key-current',
      nonce: 'success-route-nonce-1',
      receipt: { contentIds: ['MOVIE-001'], createdCount: 1, templateKey: 'movie', updatedCount: 0 },
      run_id: runId,
      sequence: 3,
      timestamp: new Date('2026-07-30T00:00:00.000Z').getTime(),
      type: 'succeeded',
    })
    expect(terminal.status).toBe(200)
    await expect(terminal.json()).resolves.toEqual({ cancel_requested: false, accepted: true, status: 'succeeded' })
    await expect(repository.getRun(runId)).resolves.toMatchObject({ status: 'succeeded', attemptNumber: 1 })
  })

  it('rejects provider snapshot drift before association mutation', async () => {
    const { app, repository } = await createHarness()
    const scheduled = await postSigned(app, '/crawler-runs/schedule-register', scheduleEvent())
    const { run_id: runId } = await scheduled.json() as { run_id: string }
    await repository.claimDispatch(runId)
    const response = await postSigned(app, `/crawler-runs/${runId}/provider-started`, providerStartedEvent(runId, { target: 'foreign-target' }))

    expect(response.status).toBe(400)
    const association = await repository.getProviderAssociation(runId)
    expect(association?.runId).toBe(runId)
    expect(association?.providerRunId).toBeUndefined()
  })
})
