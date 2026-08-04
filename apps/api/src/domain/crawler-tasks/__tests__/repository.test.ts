import type { Client, InStatement } from '@libsql/client'
import { readFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import { createDb } from '@starye/db'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCrawlerTaskRepository, decodeCrawlerTaskCursor } from '../repository'
import {
  CRAWLER_MAX_NORMAL_LOG_ROWS,
  CRAWLER_MAX_SAFE_LOG_BYTES,
  CRAWLER_RUN_LOG_RETENTION_MS,
} from '../types'

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
    return {
      meta: { changes: result.rowsAffected },
      results: result.rows as unknown as T[],
    }
  }

  async run(): Promise<D1Result> {
    const result = await this.client.execute({ args: this.values, sql: this.sql })
    return {
      meta: { changes: result.rowsAffected },
      results: [],
    }
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
  await client.execute(`
    CREATE TABLE comic (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      total_chapters INTEGER DEFAULT 0,
      crawled_chapters INTEGER DEFAULT 0
    )
  `)
  const migration = await readFile(new URL('../../../../../../packages/db/drizzle/0027_crawler_task_domain_foundation.sql', import.meta.url), 'utf8')
  const statements = migration
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(sql => ({ sql }))
  await client.batch(statements, 'write')
  const providerMigration = await readFile(new URL('../../../../../../packages/db/drizzle/0028_crawler_provider_association.sql', import.meta.url), 'utf8')
  const providerStatements = providerMigration
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(sql => ({ sql }))
  await client.batch(providerStatements, 'write')

  return { client, db: createDb(new LibsqlD1(client) as never) }
}

describe('crawler task repository', () => {
  let client: Client
  let repository: ReturnType<typeof createCrawlerTaskRepository>
  let nextId: number
  let now: Date

  beforeEach(async () => {
    const testDb = await createTestDatabase()
    client = testDb.client
    nextId = 0
    now = new Date('2026-07-30T00:00:00.000Z')
    repository = createCrawlerTaskRepository(testDb.db, {
      createId: () => `id-${++nextId}`,
      now: () => now,
    })
  })

  it('creates task, queued run, template lease, and audit atomically while duplicate creates return the active run', async () => {
    const first = await repository.createOrGetActiveRun({
      requestedByUserId: 'admin-1',
      templateKey: 'movie',
    })
    const duplicate = await repository.createOrGetActiveRun({
      requestedByUserId: 'admin-1',
      templateKey: 'movie',
    })

    expect(first).toMatchObject({
      kind: 'created',
      run: { attemptNumber: 1, status: 'queued' },
      snapshot: { templateKey: 'movie', templateVersion: 1 },
    })
    expect(duplicate).toEqual({ kind: 'existing_active_run', run: first.run })

    const tasks = await client.execute('SELECT * FROM crawler_task')
    const runs = await client.execute('SELECT * FROM crawler_run')
    const leases = await client.execute('SELECT * FROM crawler_template_lease')
    const transitions = await client.execute('SELECT * FROM crawler_run_transition')
    expect([tasks.rows.length, runs.rows.length, leases.rows.length, transitions.rows.length]).toEqual([1, 1, 1, 1])
  })

  it('uses version-and-sequence CAS, keeps stale events from replacing the current run, and records a stale audit', async () => {
    const created = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (created.kind !== 'created')
      throw new Error('expected created run')
    const runId = created.run.id

    await expect(repository.claimDispatch(runId)).resolves.toMatchObject({ kind: 'transition', nextStatus: 'dispatching' })
    await expect(repository.renewLease(runId, 2)).resolves.toMatchObject({ kind: 'transition', nextStatus: 'running' })
    await expect(repository.renewLease(runId, 2)).resolves.toMatchObject({ kind: 'stale', reasonCode: 'stale_event' })

    await expect(repository.getRun(runId)).resolves.toMatchObject({
      stateVersion: 2,
      status: 'running',
    })
    const staleAudits = await client.execute({
      args: [runId, 'stale_event'],
      sql: 'SELECT * FROM crawler_run_transition WHERE run_id = ? AND reason_code = ?',
    })
    expect(staleAudits.rows).toHaveLength(1)
  })

  it('binds runner events to a run attempt and returns stored outcomes only for identical replays', async () => {
    const created = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (created.kind !== 'created')
      throw new Error('expected created run')
    const runId = created.run.id
    await repository.claimDispatch(runId)

    const input = {
      attempt: 1,
      bodySha256: 'body-one',
      event: { actor: 'runner' as const, sequence: 2, type: 'runner_heartbeat' as const },
      eventId: 'event-1',
      keyId: 'key-current',
      nonce: 'nonce-1',
      runId,
      sequence: 2,
    }
    const actualOutcome = { accepted: true, status: 'running' }
    await expect(repository.processRunnerEvent(input)).resolves.toEqual({ kind: 'accepted', outcome: actualOutcome })
    await expect(repository.processRunnerEvent(input)).resolves.toEqual({ kind: 'duplicate', outcome: actualOutcome })
    await expect(repository.processRunnerEvent({ ...input, bodySha256: 'body-two' })).resolves.toEqual({ kind: 'conflict' })
    await expect(repository.processRunnerEvent({ ...input, eventId: 'event-2' })).resolves.toEqual({ kind: 'conflict' })
    await expect(repository.processRunnerEvent({ ...input, nonce: 'nonce-2' })).resolves.toEqual({ kind: 'conflict' })
    await expect(repository.processRunnerEvent({ ...input, attempt: 2, eventId: 'event-3', nonce: 'nonce-3' })).resolves.toEqual({ kind: 'attempt_mismatch' })
    await expect(repository.processRunnerEvent({
      ...input,
      event: {
        actor: 'runner',
        receipt: { contentIds: ['content-1'], templateKey: 'manga' },
        sequence: 3,
        type: 'runner_succeeded',
      },
      eventId: 'event-4',
      nonce: 'nonce-4',
      receipt: { contentIds: ['content-1'], templateKey: 'manga' },
      sequence: 3,
    })).resolves.toEqual({ kind: 'receipt_template_mismatch' })

    await expect(repository.getRun(runId)).resolves.toMatchObject({ status: 'running' })
    const receipts = await client.execute({ args: [runId], sql: 'SELECT event_id, nonce, body_sha256 FROM crawler_runner_event WHERE run_id = ?' })
    expect(receipts.rows).toEqual([{ body_sha256: 'body-one', event_id: 'event-1', nonce: 'nonce-1' }])
  })

  it('lets receipt success win a cancel race, rejects retry for success, and creates the next immutable attempt after failure', async () => {
    const created = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'manga' })
    if (created.kind !== 'created')
      throw new Error('expected created run')
    const runId = created.run.id

    await repository.claimDispatch(runId)
    await repository.renewLease(runId, 2)
    await repository.applyTransition(runId, { actor: 'admin', type: 'admin_cancel' })
    await repository.applyTransition(runId, {
      actor: 'runner',
      receipt: { contentIds: ['comic-1'], templateKey: 'manga' },
      sequence: 3,
      type: 'runner_succeeded',
    })
    await expect(repository.retryRun(runId)).rejects.toThrow('Only failed or cancelled runs may be retried')

    const failed = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (failed.kind !== 'created')
      throw new Error('expected a separate movie run')
    await repository.claimDispatch(failed.run.id)
    await repository.renewLease(failed.run.id, 2)
    await repository.applyTransition(failed.run.id, { actor: 'runner', sequence: 3, type: 'runner_failed' })
    const retried = await repository.retryRun(failed.run.id)

    expect(retried).toMatchObject({ kind: 'created', run: { attemptNumber: 2, status: 'queued' } })
    const runs = await client.execute({ args: [failed.run.taskId], sql: 'SELECT attempt_number, status FROM crawler_run WHERE task_id = ? ORDER BY attempt_number' })
    expect(runs.rows).toEqual([{ attempt_number: 1, status: 'failed' }, { attempt_number: 2, status: 'queued' }])
  })

  it('only persists D1-validated receipts, maps invalid candidates to receipt_missing, and keeps cancelled runs receipt-free', async () => {
    await client.execute({
      args: ['movie-verified', 'Verified movie', 'verified-movie', 'MOV-VERIFIED', 2, 2],
      sql: 'INSERT INTO movie (id, title, slug, code, total_players, crawled_players) VALUES (?, ?, ?, ?, ?, ?)',
    })
    await client.execute({
      args: ['comic-verified', 'Verified comic', 'verified-comic', 3, 3],
      sql: 'INSERT INTO comic (id, title, slug, total_chapters, crawled_chapters) VALUES (?, ?, ?, ?, ?)',
    })

    const movie = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (movie.kind !== 'created')
      throw new Error('expected movie run')
    await repository.claimDispatch(movie.run.id)
    await repository.renewLease(movie.run.id, 2)

    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'receipt-body',
      event: { actor: 'runner', receipt: { contentIds: ['MOV-VERIFIED'], templateKey: 'movie' }, sequence: 3, type: 'runner_succeeded' },
      eventId: 'receipt-event',
      keyId: 'key-current',
      nonce: 'receipt-nonce',
      receipt: { contentIds: ['MOV-VERIFIED'], createdCount: 2, templateKey: 'movie', updatedCount: 1 },
      runId: movie.run.id,
      sequence: 3,
    })).resolves.toMatchObject({ kind: 'accepted', outcome: { accepted: true, status: 'succeeded' } })

    const movieReceipt = await client.execute({ args: [movie.run.id], sql: 'SELECT status, failure_code, receipt_summary_json FROM crawler_run WHERE id = ?' })
    expect(movieReceipt.rows[0]).toMatchObject({
      failure_code: null,
      receipt_summary_json: JSON.stringify({ createdCount: 2, primaryContentId: 'movie-verified', templateKey: 'movie', updatedCount: 1 }),
      status: 'succeeded',
    })

    const missing = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (missing.kind !== 'created')
      throw new Error('expected missing-receipt run')
    await repository.claimDispatch(missing.run.id)
    await repository.renewLease(missing.run.id, 2)
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'missing-body',
      event: { actor: 'runner', receipt: { contentIds: ['not-in-d1'], templateKey: 'movie' }, sequence: 3, type: 'runner_succeeded' },
      eventId: 'missing-event',
      keyId: 'key-current',
      nonce: 'missing-nonce',
      receipt: { contentIds: ['not-in-d1'], templateKey: 'movie' },
      runId: missing.run.id,
      sequence: 3,
    })).resolves.toMatchObject({ kind: 'accepted', outcome: { accepted: true, status: 'failed' } })
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'missing-body',
      event: { actor: 'runner', receipt: { contentIds: ['not-in-d1'], templateKey: 'movie' }, sequence: 3, type: 'runner_succeeded' },
      eventId: 'missing-event',
      keyId: 'key-current',
      nonce: 'missing-nonce',
      receipt: { contentIds: ['not-in-d1'], templateKey: 'movie' },
      runId: missing.run.id,
      sequence: 3,
    })).resolves.toMatchObject({ kind: 'duplicate', outcome: { accepted: true, status: 'failed' } })
    const missingReceipt = await client.execute({ args: [missing.run.id], sql: 'SELECT status, failure_code, receipt_summary_json FROM crawler_run WHERE id = ?' })
    expect(missingReceipt.rows[0]).toEqual({ failure_code: 'receipt_missing', receipt_summary_json: null, status: 'failed' })

    const cancelled = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'manga' })
    if (cancelled.kind !== 'created')
      throw new Error('expected cancelled run')
    await repository.claimDispatch(cancelled.run.id)
    await repository.renewLease(cancelled.run.id, 2)
    await repository.applyTransition(cancelled.run.id, { actor: 'admin', type: 'admin_cancel' })
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'cancel-body',
      event: { actor: 'runner', receipt: { contentIds: ['verified-comic'], templateKey: 'manga' }, sequence: 3, type: 'runner_succeeded' },
      eventId: 'cancel-event',
      keyId: 'key-current',
      nonce: 'cancel-nonce',
      receipt: { contentIds: ['verified-comic'], templateKey: 'manga' },
      runId: cancelled.run.id,
      sequence: 3,
    })).resolves.toMatchObject({ kind: 'accepted', outcome: { accepted: true, status: 'succeeded' } })
    const cancelledReceipt = await client.execute({ args: [cancelled.run.id], sql: 'SELECT status, receipt_summary_json FROM crawler_run WHERE id = ?' })
    expect(cancelledReceipt.rows[0]).toMatchObject({
      receipt_summary_json: JSON.stringify({ createdCount: 1, primaryContentId: 'comic-verified', templateKey: 'manga', updatedCount: 0 }),
      status: 'succeeded',
    })
  })

  it('renews heartbeat leases, fails lost runs after ten minutes, and preserves terminal failure facts', async () => {
    const created = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (created.kind !== 'created')
      throw new Error('expected created run')
    const runId = created.run.id
    await repository.claimDispatch(runId)
    await repository.renewLease(runId, 2)
    now = new Date(now.getTime() + 10 * 60 * 1000 + 1)

    await expect(repository.sweepExpiredRuns()).resolves.toEqual([runId])
    await expect(repository.getRun(runId)).resolves.toMatchObject({ status: 'failed' })
    const failure = await client.execute({ args: [runId], sql: 'SELECT failure_code, terminal_at FROM crawler_run WHERE id = ?' })
    expect(failure.rows[0]).toMatchObject({ failure_code: 'runner_lost' })
    expect(failure.rows[0]?.terminal_at).not.toBeNull()
  })

  it('binds provider facts with exact snapshots, keeps schedule registration idempotent, and accepts a validated receipt while the provider runs', async () => {
    const created = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (created.kind !== 'created')
      throw new Error('expected provider run')
    const association = await repository.ensureProviderAssociation({ attempt: 1, runId: created.run.id, template: 'movie' })
    expect(association).toMatchObject({
      applicationAttempt: 1,
      repository: 'inspire-man/starye',
      runId: created.run.id,
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })

    await repository.claimDispatch(created.run.id)
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'provider-gate',
      event: { actor: 'runner', receipt: { contentIds: ['movie-1'], templateKey: 'movie' }, sequence: 2, type: 'runner_succeeded' },
      eventId: 'provider-gate-event',
      keyId: 'key-current',
      nonce: 'provider-gate-nonce',
      receipt: { contentIds: ['movie-1'], templateKey: 'movie' },
      runId: created.run.id,
      sequence: 2,
    })).resolves.toMatchObject({ kind: 'rejected', outcome: { reason: 'provider_success_required' } })

    await expect(repository.providerStarted({
      attempt: 1,
      bodySha256: 'provider-start',
      environment: 'starye-org',
      eventId: 'provider-start-event',
      keyId: 'key-current',
      nonce: 'provider-start-nonce',
      providerRunAttempt: 1,
      providerRunId: '123',
      ref: 'main',
      repository: 'inspire-man/starye',
      runId: created.run.id,
      sha: 'a'.repeat(40),
      target: 'starye-org',
      template: 'movie',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })).resolves.toMatchObject({ accepted: true })
    await client.execute({
      args: ['provider-movie', 'Provider movie', 'provider-movie', 'MOVIE-PROVIDER', 1, 1],
      sql: 'INSERT INTO movie (id, title, slug, code, total_players, crawled_players) VALUES (?, ?, ?, ?, ?, ?)',
    })
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'provider-running-success',
      event: { actor: 'runner', receipt: { contentIds: ['MOVIE-PROVIDER'], templateKey: 'movie' }, sequence: 2, type: 'runner_succeeded' },
      eventId: 'provider-running-success-event',
      keyId: 'key-current',
      nonce: 'provider-running-success-nonce',
      receipt: { contentIds: ['MOVIE-PROVIDER'], createdCount: 1, templateKey: 'movie', updatedCount: 0 },
      runId: created.run.id,
      sequence: 2,
    })).resolves.toMatchObject({ kind: 'accepted', outcome: { accepted: true, status: 'succeeded' } })
    await expect(repository.recordProviderObservation({
      attempt: 1,
      conclusion: 'success',
      headSha: 'a'.repeat(40),
      path: '.github/workflows/daily-movie-crawl.yml',
      providerRunAttempt: 1,
      providerRunId: '123',
      runId: created.run.id,
      status: 'completed',
    })).resolves.toMatchObject({ kind: 'updated', status: 'completed' })
  })

  it('caps safe messages at 4 KiB, records one truncation marker after 500 normal logs, and only purges expired detail logs', async () => {
    const created = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (created.kind !== 'created')
      throw new Error('expected created run')
    const runId = created.run.id
    const longMessage = 'a'.repeat(CRAWLER_MAX_SAFE_LOG_BYTES + 100)

    await repository.appendLog({ code: 'first', level: 'info', message: longMessage, runId, sequence: 1 })
    for (let sequence = 2; sequence <= CRAWLER_MAX_NORMAL_LOG_ROWS; sequence += 1) {
      await repository.appendLog({ code: `normal-${sequence}`, level: 'info', message: 'ok', runId, sequence })
    }
    await repository.appendLog({ code: 'overflow', level: 'error', message: 'overflow', runId, sequence: 501 })
    await repository.appendLog({ code: 'overflow-again', level: 'error', message: 'overflow', runId, sequence: 502 })

    const logs = await client.execute({ args: [runId], sql: 'SELECT code, safe_message FROM crawler_run_log WHERE run_id = ? ORDER BY sequence' })
    expect(logs.rows).toHaveLength(CRAWLER_MAX_NORMAL_LOG_ROWS + 1)
    expect(String(logs.rows[0]?.safe_message).length).toBeLessThan(longMessage.length)
    expect(logs.rows.filter(row => row.code === 'log_truncated')).toHaveLength(1)

    now = new Date(now.getTime() + CRAWLER_RUN_LOG_RETENTION_MS + 1)
    await expect(repository.purgeExpiredRunLogs()).resolves.toBe(CRAWLER_MAX_NORMAL_LOG_ROWS + 1)
    await expect(client.execute({ args: [runId], sql: 'SELECT * FROM crawler_run WHERE id = ?' })).resolves.toMatchObject({ rows: [expect.objectContaining({ id: runId })] })
  })

  it('pages task history by the updated-at/id tuple without repeating tied timestamps', async () => {
    await client.batch([
      {
        args: ['task-a', 'movie', 1, 'admin-1', '{}', null, 'run-a', 100, 200],
        sql: 'INSERT INTO crawler_task (id, template_key, template_version, requested_by_user_id, request_snapshot_json, idempotency_key, latest_run_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      },
      {
        args: ['task-b', 'movie', 1, 'admin-1', '{}', null, 'run-b', 101, 200],
        sql: 'INSERT INTO crawler_task (id, template_key, template_version, requested_by_user_id, request_snapshot_json, idempotency_key, latest_run_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      },
      {
        args: ['task-c', 'movie', 1, 'admin-1', '{}', null, 'run-c', 102, 199],
        sql: 'INSERT INTO crawler_task (id, template_key, template_version, requested_by_user_id, request_snapshot_json, idempotency_key, latest_run_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      },
    ], 'write')

    const first = await repository.listTasks({ limit: 2, templateKey: 'movie' })
    expect(first.tasks.map(task => task.id)).toEqual(['task-b', 'task-a'])
    expect(first.nextCursor).toBeTruthy()
    const cursor = decodeCrawlerTaskCursor(first.nextCursor!)
    expect(cursor).toEqual({ id: 'task-a', updatedAt: 200 })

    const second = await repository.listTasks({ cursor, limit: 2, templateKey: 'movie' })
    expect(second.tasks.map(task => task.id)).toEqual(['task-c'])
    expect(second.nextCursor).toBeNull()
  })

  it('returns every attempt with safe receipt/provider projections and tolerates legacy provider schemas', async () => {
    await client.execute({
      args: ['task-detail', 'movie', 1, 'admin-1', '{}', null, 'run-2', 1, 2],
      sql: 'INSERT INTO crawler_task (id, template_key, template_version, requested_by_user_id, request_snapshot_json, idempotency_key, latest_run_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    })
    await client.batch([
      {
        args: ['run-1', 'task-detail', 1, 'failed', 1, 0, null, null, null, 'runner_failed', null, 1, 1, 1],
        sql: 'INSERT INTO crawler_run (id, task_id, attempt_number, status, state_version, last_event_sequence, lease_expires_at, last_heartbeat_at, cancel_requested_at, failure_code, receipt_summary_json, created_at, updated_at, terminal_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      },
      {
        args: ['run-2', 'task-detail', 2, 'succeeded', 2, 1, null, null, null, null, JSON.stringify({ createdCount: 1, primaryContentId: 'movie-1', templateKey: 'movie', updatedCount: 0, token: 'hidden' }), 2, 2, 2],
        sql: 'INSERT INTO crawler_run (id, task_id, attempt_number, status, state_version, last_event_sequence, lease_expires_at, last_heartbeat_at, cancel_requested_at, failure_code, receipt_summary_json, created_at, updated_at, terminal_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      },
      {
        args: ['run-2', 2, 'github-actions', 'movie', 'starye-org', '.github/workflows/daily-movie-crawl.yml', 'inspire-man/starye', 'main', 'starye-org', 'crawler-optimized', '123', 1, 'a'.repeat(40), 'completed', 'success', null, null, null, 3, 3],
        sql: 'INSERT INTO crawler_run_provider_association (run_id, application_attempt, provider, template_key, target, workflow, repository, ref, environment, crawler_entrypoint, provider_run_id, provider_run_attempt, sha, provider_status, provider_conclusion, reconciliation_window_ends_at, safe_facts_json, schedule_bucket, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      },
    ], 'write')

    const detail = await repository.getTaskDetail('task-detail')
    expect(detail?.runs.map(run => run.attemptNumber)).toEqual([2, 1])
    expect(detail?.runs[0]).toMatchObject({
      provider: {
        providerRunUrl: 'https://github.com/inspire-man/starye/actions/runs/123',
      },
      receipt: {
        primaryContentId: 'movie-1',
        templateKey: 'movie',
      },
    })
    expect(JSON.stringify(detail)).not.toContain('token')

    await client.execute('DROP TABLE crawler_run_provider_association')
    const legacy = await repository.getTaskDetail('task-detail')
    expect(legacy?.runs.every(run => run.provider === null)).toBe(true)
  })
})
