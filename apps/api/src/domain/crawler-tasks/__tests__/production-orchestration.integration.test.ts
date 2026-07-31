import type { Client, InStatement } from '@libsql/client'
import { readFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import { createDb } from '@starye/db'
import { describe, expect, it } from 'vitest'
import { createCrawlerTaskRepository } from '../repository'

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
    args: ['admin-1', 'Admin', 'admin@example.com', 1, 'admin', 0, 1, 1, 1],
    sql: 'INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',
  })
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
  const foundation = await readFile(new URL('../../../../../../packages/db/drizzle/0027_crawler_task_domain_foundation.sql', import.meta.url), 'utf8')
  const provider = await readFile(new URL('../../../../../../packages/db/drizzle/0028_crawler_provider_association.sql', import.meta.url), 'utf8')
  const statements = [foundation, provider]
    .flatMap(migration => migration.split('--> statement-breakpoint'))
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(sql => ({ sql }))
  await client.batch(statements, 'write')
  return { client, db: createDb(new LibsqlD1(client) as never) }
}

async function createRepositoryFixture() {
  const database = await createTestDatabase()
  let nextId = 0
  let now = new Date('2026-07-30T00:00:00.000Z')
  const repository = createCrawlerTaskRepository(database.db, {
    createId: () => `fixture-${++nextId}`,
    now: () => now,
  })
  return {
    ...database,
    now: (value: Date) => { now = value },
    repository,
  }
}

describe('production orchestration lifecycle integration', () => {
  it('replays manual dispatch through provider_started, poll compensation, and a validated receipt', async () => {
    const { client, repository } = await createRepositoryFixture()

    const created = await repository.createOrGetActiveRun({
      requestedByUserId: 'admin-1',
      templateKey: 'movie',
    })
    if (created.kind !== 'created')
      throw new Error('expected a newly created run')

    const runId = created.run.id
    await expect(repository.ensureProviderAssociation({ attempt: 1, runId, template: 'movie' })).resolves.toMatchObject({
      applicationAttempt: 1,
      runId,
      template: 'movie',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })

    await expect(repository.claimDispatch(runId)).resolves.toMatchObject({ kind: 'transition', nextStatus: 'dispatching' })
    await expect(repository.validateDispatch({ attempt: 1, runId, target: 'starye-org', template: 'movie' })).resolves.toEqual({ accepted: true })
    await expect(repository.providerStarted({
      attempt: 1,
      bodySha256: 'provider-start-body',
      environment: 'starye-org',
      eventId: 'provider-start-1',
      keyId: 'key-current',
      nonce: 'provider-start-nonce',
      providerRunAttempt: 1,
      providerRunId: '12345',
      ref: 'main',
      repository: 'inspire-man/starye',
      runId,
      sha: 'a'.repeat(40),
      target: 'starye-org',
      template: 'movie',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })).resolves.toEqual({ accepted: true, cancelRequested: false })

    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'heartbeat-body',
      event: { actor: 'runner', sequence: 2, type: 'runner_heartbeat' },
      eventId: 'heartbeat-1',
      keyId: 'key-current',
      nonce: 'heartbeat-nonce',
      runId,
      sequence: 2,
    })).resolves.toMatchObject({ kind: 'accepted' })
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'progress-body',
      event: { actor: 'runner', sequence: 3, type: 'runner_progress' },
      eventId: 'progress-1',
      keyId: 'key-current',
      nonce: 'progress-nonce',
      runId,
      sequence: 3,
    })).resolves.toMatchObject({ kind: 'accepted' })

    await expect(repository.recordProviderObservation({
      attempt: 1,
      conclusion: 'success',
      headSha: 'a'.repeat(40),
      path: '.github/workflows/daily-movie-crawl.yml',
      providerRunAttempt: 1,
      providerRunId: '12345',
      runId,
      status: 'completed',
    })).resolves.toEqual({ kind: 'updated', status: 'completed', conclusion: 'success' })

    const succeeded = await repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'success-body',
      event: { actor: 'runner', sequence: 4, type: 'runner_succeeded' },
      eventId: 'success-1',
      keyId: 'key-current',
      nonce: 'success-nonce',
      receipt: { contentIds: ['MOVIE-001'], createdCount: 1, templateKey: 'movie', updatedCount: 0 },
      runId,
      sequence: 4,
    })

    expect(succeeded).toMatchObject({ kind: 'accepted', outcome: { accepted: true, status: 'succeeded' } })
    await expect(repository.getRun(runId)).resolves.toMatchObject({ status: 'succeeded', attemptNumber: 1 })
    const providerRows = await client.execute({ args: [runId], sql: 'SELECT provider_run_id, provider_status, provider_conclusion FROM crawler_run_provider_association WHERE run_id = ?' })
    const transitions = await client.execute({ args: [runId], sql: 'SELECT reason_code FROM crawler_run_transition WHERE run_id = ? ORDER BY created_at, sequence' })
    expect(providerRows.rows).toEqual([{ provider_run_id: '12345', provider_status: 'completed', provider_conclusion: 'success' }])
    expect(transitions.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason_code: 'provider_success_pending_receipt' }),
      expect.objectContaining({ reason_code: 'runner_succeeded' }),
    ]))
  })

  it('deduplicates schedule buckets, expires mismatched providers, and rejects a late provider start', async () => {
    const { client, now, repository } = await createRepositoryFixture()
    const schedule = {
      bodySha256: 'schedule-body',
      environment: 'starye-org',
      eventId: 'schedule-event-1',
      keyId: 'key-current',
      nonce: 'schedule-nonce-1',
      ref: 'main',
      repository: 'inspire-man/starye',
      scheduleBucket: '2026-07-30T00:00Z',
      scheduledAt: '2026-07-30T00:00:00.000Z',
      target: 'starye-org',
      template: 'movie' as const,
      workflow: '.github/workflows/daily-movie-crawl.yml',
    }
    const first = await repository.scheduleRegister(schedule)
    const duplicate = await repository.scheduleRegister({ ...schedule, eventId: 'schedule-event-duplicate', nonce: 'schedule-nonce-duplicate' })
    expect(duplicate).toEqual(first)

    await expect(repository.claimDispatch(first.runId)).resolves.toMatchObject({ nextStatus: 'dispatching' })
    await expect(repository.providerStarted({
      attempt: 1,
      bodySha256: 'mismatch-start-body',
      environment: 'starye-org',
      eventId: 'mismatch-start',
      keyId: 'key-current',
      nonce: 'mismatch-start-nonce',
      providerRunAttempt: 1,
      providerRunId: '99999',
      ref: 'main',
      repository: 'inspire-man/starye',
      runId: first.runId,
      sha: 'b'.repeat(40),
      target: 'wrong-target',
      template: 'movie',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })).resolves.toEqual({ accepted: false, cancelRequested: false })

    const current = Math.floor(new Date('2026-07-30T00:00:00.000Z').getTime() / 1000)
    now(new Date((current + 301) * 1000))
    await expect(repository.recordProviderObservation({
      attempt: 1,
      providerRunId: '99999',
      runId: first.runId,
      status: 'in_progress',
    })).resolves.toMatchObject({ kind: 'provider_lost' })
    await expect(repository.getRun(first.runId)).resolves.toMatchObject({ status: 'failed' })

    const late = await repository.providerStarted({
      attempt: 1,
      bodySha256: 'late-start-body',
      environment: 'starye-org',
      eventId: 'late-start',
      keyId: 'key-current',
      nonce: 'late-start-nonce',
      providerRunAttempt: 1,
      providerRunId: '12345',
      ref: 'main',
      repository: 'inspire-man/starye',
      runId: first.runId,
      sha: 'a'.repeat(40),
      target: 'starye-org',
      template: 'movie',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })
    expect(late).toEqual({ accepted: false, cancelRequested: false })
    const facts = await client.execute({ args: [first.runId], sql: 'SELECT safe_facts_json FROM crawler_run_provider_association WHERE run_id = ?' })
    expect(String(facts.rows[0]?.safe_facts_json ?? '')).not.toMatch(/token|secret|private[_-]?key/i)
  })

  it('preserves cancellation facts and creates a new provider attempt only after a cancelled run', async () => {
    const { repository } = await createRepositoryFixture()
    const created = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (created.kind !== 'created')
      throw new Error('expected a newly created run')
    await repository.ensureProviderAssociation({ attempt: 1, runId: created.run.id, template: 'movie' })
    await repository.claimDispatch(created.run.id)
    await expect(repository.applyTransition(created.run.id, { actor: 'admin', type: 'admin_cancel' })).resolves.toMatchObject({ nextStatus: 'cancel_requested' })
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'cancelled-body',
      event: { actor: 'runner', sequence: 2, type: 'runner_cancelled' },
      eventId: 'cancelled-1',
      keyId: 'key-current',
      nonce: 'cancelled-nonce',
      runId: created.run.id,
      sequence: 2,
    })).resolves.toMatchObject({ kind: 'accepted', outcome: { status: 'cancelled' } })

    const retry = await repository.retryRun(created.run.id)
    expect(retry).toMatchObject({ kind: 'created', run: { attemptNumber: 2, status: 'queued' } })
    if (retry.kind !== 'created')
      throw new Error('expected a new retry attempt')
    await expect(repository.getProviderAssociation(retry.run.id)).resolves.toMatchObject({
      applicationAttempt: 2,
      runId: retry.run.id,
      template: 'movie',
    })
    await expect(repository.getProviderAssociation(created.run.id)).resolves.toMatchObject({
      applicationAttempt: 1,
      runId: created.run.id,
    })
  })
})
