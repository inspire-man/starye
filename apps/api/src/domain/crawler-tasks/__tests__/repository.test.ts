import type { Client, InStatement } from '@libsql/client'
import { readFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import { createDb } from '@starye/db'
import { beforeEach, describe, expect, it } from 'vitest'
import { readRepairSourceReadback } from '../../movies/source-reconciliation'
import { validateAvailabilityObservation } from '../availability-contract'
import { buildCrawlerOperationSnapshot } from '../operation-registry'
import { validateReceiptCandidate } from '../receipt-validation'
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

  async raw<T>(): Promise<T[]> {
    const result = await this.client.execute({ args: this.values, sql: this.sql })
    const columns = result.columns ?? []
    return result.rows.map(row => columns.map(column => (row as Record<string, unknown>)[column])) as T[]
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
  await client.execute(`
    CREATE TABLE player (
      id TEXT PRIMARY KEY NOT NULL,
      movie_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER NOT NULL
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
  const receiptMigration = await readFile(new URL('../../../../../../packages/db/drizzle/0029_source_contract_receipt_boundary.sql', import.meta.url), 'utf8')
  const receiptStatements = receiptMigration
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(sql => ({ sql }))
  await client.batch(receiptStatements, 'write')
  const repairMigration = await readFile(new URL('../../../../../../packages/db/drizzle/0030_source_health_repair.sql', import.meta.url), 'utf8')
  const repairStatements = repairMigration
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(sql => ({ sql }))
  await client.batch(repairStatements, 'write')

  return { client, db: createDb(new LibsqlD1(client) as never) }
}

describe('crawler task repository', () => {
  let client: Client
  let database: ReturnType<typeof createDb>
  let repository: ReturnType<typeof createCrawlerTaskRepository>
  let nextId: number
  let now: Date

  beforeEach(async () => {
    const testDb = await createTestDatabase()
    client = testDb.client
    database = testDb.db
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

  it('reclaims an expired template lease before creating a fresh run', async () => {
    const first = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    expect(first.kind).toBe('created')

    await client.execute({
      args: [0, 0],
      sql: 'UPDATE crawler_template_lease SET expires_at = ?, renewed_at = ?',
    })

    const fresh = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })

    expect(fresh).toMatchObject({ kind: 'created', run: { attemptNumber: 1, status: 'queued' } })
    const leases = await client.execute('SELECT template_key, run_id FROM crawler_template_lease')
    expect(leases.rows).toEqual([{ template_key: 'movie', run_id: (fresh as { run: { id: string } }).run.id }])
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

  it('creates a repair_players task from the current movie disposition and persists an immutable one-movie snapshot', async () => {
    await client.execute({
      args: ['movie-repair-1', 'Repair movie', 'repair-movie-1', 'MOV-REPAIR-1', 0, 0],
      sql: 'INSERT INTO movie (id, title, slug, code, total_players, crawled_players) VALUES (?, ?, ?, ?, ?, ?)',
    })
    await client.execute({
      args: ['movie-repair-1', 7, 'source_failed', 0, 1, 'source_write_failed', 1_725_000_300],
      sql: 'INSERT INTO movie_source_state (movie_id, source_revision, disposition, eligible_count, repairable, reason_code, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    })

    const created = await repository.createOrGetActiveRun({
      movieId: 'movie-repair-1',
      operation: 'repair_players',
      reason: 'source_failed',
      requestedByUserId: 'admin-1',
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
    } as never)

    expect(created).toMatchObject({
      kind: 'created',
      run: { attemptNumber: 1, status: 'queued' },
      snapshot: {
        movieId: 'movie-repair-1',
        operation: 'repair_players',
        reason: 'source_failed',
        sourceRevision: 7,
        targetIntent: 'restore_playable_sources',
      },
    })

    const taskRow = await client.execute({
      args: [created.run.taskId],
      sql: 'SELECT operation, request_snapshot_json FROM crawler_task WHERE id = ?',
    })
    expect(taskRow.rows[0]?.operation).toBe('repair_players')
    expect(JSON.parse(String(taskRow.rows[0]?.request_snapshot_json))).toMatchObject({
      movieId: 'movie-repair-1',
      operation: 'repair_players',
      reason: 'source_failed',
      sourceRevision: 7,
    })
  })

  it('rejects repair success with a stale source revision and keeps the current run active', async () => {
    await client.execute({
      args: ['movie-repair-2', 'Repair movie 2', 'repair-movie-2', 'MOV-REPAIR-2', 0, 0],
      sql: 'INSERT INTO movie (id, title, slug, code, total_players, crawled_players) VALUES (?, ?, ?, ?, ?, ?)',
    })
    await client.execute({
      args: ['movie-repair-2', 7, 'source_failed', 0, 1, 'source_write_failed', 1_725_000_310],
      sql: 'INSERT INTO movie_source_state (movie_id, source_revision, disposition, eligible_count, repairable, reason_code, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    })
    const created = await repository.createOrGetActiveRun({
      movieId: 'movie-repair-2',
      operation: 'repair_players',
      reason: 'source_failed',
      requestedByUserId: 'admin-1',
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
    } as never)
    if (created.kind !== 'created')
      throw new Error('expected created repair run')

    await repository.claimDispatch(created.run.id)
    await repository.renewLease(created.run.id, 2)
    await client.execute({
      args: [8, 1_725_000_311, 'movie-repair-2'],
      sql: 'UPDATE movie_source_state SET source_revision = ?, observed_at = ? WHERE movie_id = ?',
    })

    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'repair-stale-body',
      event: {
        actor: 'runner',
        receipt: {
          movieId: 'movie-repair-2',
          observedAt: 1_725_000_310,
          operation: 'repair_players',
          sourceRevision: 7,
          sourceSummary: [
            {
              eligible: true,
              health: 'unverified',
              observedAt: 1_725_000_310,
              reasonCode: 'source_unverified',
              sourceType: 'direct',
            },
          ],
        } as never,
        sequence: 3,
        type: 'runner_succeeded',
      } as never,
      eventId: 'repair-stale-event',
      keyId: 'key-current',
      nonce: 'repair-stale-nonce',
      receipt: {
        movieId: 'movie-repair-2',
        observedAt: 1_725_000_310,
        operation: 'repair_players',
        sourceRevision: 7,
        sourceSummary: [
          {
            eligible: true,
            health: 'unverified',
            observedAt: 1_725_000_310,
            reasonCode: 'source_unverified',
            sourceType: 'direct',
          },
        ],
      } as never,
      runId: created.run.id,
      sequence: 3,
    })).resolves.toEqual({
      kind: 'rejected',
      outcome: { accepted: false, reason: 'repair_source_revision_conflict' },
    })

    await expect(repository.getRun(created.run.id)).resolves.toMatchObject({ status: 'running' })
  })

  it('accepts a repair terminal receipt only after the current source revision and authoritative observation readback advance', async () => {
    await client.execute({
      args: ['movie-repair-success', 'Repair movie success', 'repair-movie-success', 'MOV-REPAIR-SUCCESS', 0, 0],
      sql: 'INSERT INTO movie (id, title, slug, code, total_players, crawled_players) VALUES (?, ?, ?, ?, ?, ?)',
    })
    await client.execute({
      args: ['movie-repair-success', 7, 'source_failed', 0, 1, 'source_write_failed', 1_725_000_320],
      sql: 'INSERT INTO movie_source_state (movie_id, source_revision, disposition, eligible_count, repairable, reason_code, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    })
    const created = await repository.createOrGetActiveRun({
      movieId: 'movie-repair-success',
      operation: 'repair_players',
      reason: 'source_failed',
      requestedByUserId: 'admin-1',
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
    } as never)
    if (created.kind !== 'created')
      throw new Error('expected created repair run')

    await repository.claimDispatch(created.run.id)
    await repository.renewLease(created.run.id, 2)
    await client.execute({
      args: [8, 'ready', 1, 0, null, 1_725_000_321, 'movie-repair-success'],
      sql: 'UPDATE movie_source_state SET source_revision = ?, disposition = ?, eligible_count = ?, repairable = ?, reason_code = ?, observed_at = ? WHERE movie_id = ?',
    })
    await client.execute({
      args: ['observation-success', 'movie-repair-success', 'repair_players', created.run.id, 1, 3, 'repair-success-event', 8, 0, 'direct', 'unverified', 1_725_000_321, 'source_unverified', 1],
      sql: `INSERT INTO movie_source_observation (
        id, movie_id, operation, run_id, attempt_number, sequence, event_id,
        source_revision, source_ordinal, source_type, health, observed_at,
        reason_code, eligible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    })

    const receipt = {
      movieId: 'movie-repair-success',
      observedAt: 1_725_000_321,
      operation: 'repair_players' as const,
      sourceRevision: 8,
      sourceSummary: [{
        eligible: true,
        health: 'unverified' as const,
        observedAt: 1_725_000_321,
        reasonCode: 'source_unverified' as const,
        sourceType: 'direct' as const,
      }],
    }
    const readback = await readRepairSourceReadback({ db: database as never, movieId: 'movie-repair-success', sourceRevision: 8 })
    expect(readback).toEqual({
      movieId: 'movie-repair-success',
      observedAt: 1_725_000_321,
      sourceRevision: 8,
      sources: receipt.sourceSummary,
      summary: { eligibleCount: 1, sourceCount: 1 },
    })
    await expect(validateReceiptCandidate({
      candidate: receipt,
      database,
      snapshot: {
        entrypoint: 'movie-crawler',
        movieId: 'movie-repair-success',
        operation: 'repair_players',
        permissionResource: 'movie',
        reason: 'source_failed',
        sourceRevision: 7,
        targetIntent: 'restore_playable_sources',
        templateKey: 'movie',
        templateVersion: 1,
      },
      templateKey: 'movie',
    })).resolves.toEqual({ ok: true, receipt })
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'repair-success-body',
      event: { actor: 'runner', receipt, sequence: 3, type: 'runner_succeeded' },
      eventId: 'repair-success-event',
      keyId: 'key-current',
      nonce: 'repair-success-nonce',
      receipt,
      runId: created.run.id,
      sequence: 3,
    })).resolves.toMatchObject({ kind: 'accepted', outcome: { accepted: true, status: 'succeeded' } })

    await expect(repository.getTaskDetail(created.run.taskId)).resolves.toMatchObject({
      runs: [expect.objectContaining({
        receipt: expect.objectContaining({ movieId: 'movie-repair-success', sourceRevision: 8 }),
        status: 'succeeded',
      })],
    })
  })

  it('keeps source and receipt failures terminal while exposing bounded task retry state', async () => {
    await client.execute({
      args: ['movie-repair-3', 'Repair movie 3', 'repair-movie-3', 'MOV-REPAIR-3', 0, 0],
      sql: 'INSERT INTO movie (id, title, slug, code, total_players, crawled_players) VALUES (?, ?, ?, ?, ?, ?)',
    })
    await client.execute({
      args: ['movie-repair-3', 4, 'source_failed', 0, 1, 'source_read_failed', 1_725_000_320],
      sql: 'INSERT INTO movie_source_state (movie_id, source_revision, disposition, eligible_count, repairable, reason_code, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    })
    const created = await repository.createOrGetActiveRun({
      movieId: 'movie-repair-3',
      operation: 'repair_players',
      reason: 'source_failed',
      requestedByUserId: 'admin-1',
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
    } as never)
    if (created.kind !== 'created')
      throw new Error('expected created repair run')

    await repository.claimDispatch(created.run.id)
    await repository.renewLease(created.run.id, 2)
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'repair-transient-body-1',
      event: { actor: 'runner', sequence: 3, type: 'runner_failed' },
      eventId: 'repair-transient-event-1',
      keyId: 'key-current',
      nonce: 'repair-transient-nonce-1',
      runId: created.run.id,
      safeSummary: 'source_read_failed',
      sequence: 3,
    })).resolves.toMatchObject({ kind: 'accepted', outcome: { accepted: true, status: 'failed' } })

    const firstRetryRows = await client.execute({
      args: [created.run.taskId],
      sql: 'SELECT id, attempt_number, status FROM crawler_run WHERE task_id = ? ORDER BY attempt_number',
    })
    expect(firstRetryRows.rows).toEqual([
      expect.objectContaining({ attempt_number: 1, status: 'failed' }),
    ])
    await expect(repository.getTaskDetail(created.run.taskId)).resolves.toMatchObject({
      retry: {
        attemptNumber: 1,
        automatic: false,
        maxAttempts: 2,
        status: 'none',
      },
    })

    const deterministic = await repository.createOrGetActiveRun({
      movieId: 'movie-repair-3',
      operation: 'repair_players',
      reason: 'source_failed',
      requestedByUserId: 'admin-1',
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
    } as never)
    if (deterministic.kind !== 'created')
      throw new Error('expected created deterministic repair run')
    await repository.claimDispatch(deterministic.run.id)
    await repository.renewLease(deterministic.run.id, 2)
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'repair-deterministic-body',
      event: { actor: 'runner', sequence: 3, type: 'runner_failed' },
      eventId: 'repair-deterministic-event',
      keyId: 'key-current',
      nonce: 'repair-deterministic-nonce',
      runId: deterministic.run.id,
      safeSummary: 'receipt_missing',
      sequence: 3,
    })).resolves.toMatchObject({ kind: 'accepted', outcome: { accepted: true, status: 'failed' } })

    const deterministicFailure = await client.execute({
      args: [deterministic.run.id],
      sql: 'SELECT failure_code FROM crawler_run WHERE id = ?',
    })
    expect(deterministicFailure.rows).toEqual([{ failure_code: 'receipt_missing' }])

    const deterministicRows = await client.execute({
      args: [deterministic.run.taskId],
      sql: 'SELECT attempt_number FROM crawler_run WHERE task_id = ? ORDER BY attempt_number',
    })
    expect(deterministicRows.rows).toEqual([{ attempt_number: 1 }])
  })

  it('creates one immediate retry for transient provider transport and binds a fresh provider association', async () => {
    const created = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (created.kind !== 'created')
      throw new Error('expected created run')
    await repository.ensureProviderAssociation({ attempt: 1, runId: created.run.id, template: 'movie' })

    await expect(repository.failProviderReconciliation(created.run.id, 1, 'github_provider_unavailable'))
      .resolves
      .toMatchObject({ kind: 'updated', status: 'failed', retry: { status: 'retrying' } })

    const runs = await client.execute({
      args: [created.run.taskId],
      sql: 'SELECT id, attempt_number, status FROM crawler_run WHERE task_id = ? ORDER BY attempt_number',
    })
    expect(runs.rows).toEqual([
      { attempt_number: 1, id: created.run.id, status: 'failed' },
      { attempt_number: 2, id: expect.any(String), status: 'queued' },
    ])

    const retryRunId = String((runs.rows[1] as { id: string }).id)
    await expect(repository.getProviderAssociation(retryRunId)).resolves.toMatchObject({
      applicationAttempt: 2,
      runId: retryRunId,
    })
    await expect(repository.getTaskDetail(created.run.taskId)).resolves.toMatchObject({
      retry: {
        attemptNumber: 2,
        automatic: true,
        maxAttempts: 2,
        status: 'retrying',
      },
    })

    await repository.failProviderReconciliation(created.run.id, 1, 'github_provider_unavailable')
    const bounded = await client.execute({
      args: [created.run.taskId],
      sql: 'SELECT COUNT(*) AS count FROM crawler_run WHERE task_id = ?',
    })
    expect(bounded.rows).toEqual([{ count: 2 }])
  })

  it('creates a new repair task for manual retry after rereading the current disposition and revision', async () => {
    await client.execute({
      args: ['movie-repair-4', 'Repair movie 4', 'repair-movie-4', 'MOV-REPAIR-4', 0, 0],
      sql: 'INSERT INTO movie (id, title, slug, code, total_players, crawled_players) VALUES (?, ?, ?, ?, ?, ?)',
    })
    await client.execute({
      args: ['movie-repair-4', 4, 'no_source', 0, 1, 'no_eligible_source', 1_725_000_330],
      sql: 'INSERT INTO movie_source_state (movie_id, source_revision, disposition, eligible_count, repairable, reason_code, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    })
    const created = await repository.createOrGetActiveRun({
      movieId: 'movie-repair-4',
      operation: 'repair_players',
      reason: 'no_source',
      requestedByUserId: 'admin-1',
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
    } as never)
    if (created.kind !== 'created')
      throw new Error('expected created repair run')
    await repository.claimDispatch(created.run.id)
    await repository.renewLease(created.run.id, 2)
    await repository.applyTransition(created.run.id, { actor: 'runner', sequence: 3, type: 'runner_failed' })

    await client.execute({
      args: [5, 'source_failed', 'source_write_failed', 1_725_000_331, 'movie-repair-4'],
      sql: 'UPDATE movie_source_state SET source_revision = ?, disposition = ?, reason_code = ?, observed_at = ? WHERE movie_id = ?',
    })

    const retried = await repository.retryRun(created.run.id)
    expect(retried).toMatchObject({
      kind: 'created',
      run: { attemptNumber: 1, status: 'queued' },
      snapshot: {
        movieId: 'movie-repair-4',
        operation: 'repair_players',
        reason: 'source_failed',
        sourceRevision: 5,
      },
    })
    expect(retried.run.taskId).not.toBe(created.run.taskId)

    const tasks = await client.execute({
      args: ['admin-1'],
      sql: 'SELECT id, operation, request_snapshot_json FROM crawler_task WHERE requested_by_user_id = ? ORDER BY created_at, id',
    })
    expect(tasks.rows).toHaveLength(2)
    expect(JSON.parse(String(tasks.rows[1]?.request_snapshot_json))).toMatchObject({
      movieId: 'movie-repair-4',
      operation: 'repair_players',
      reason: 'source_failed',
      sourceRevision: 5,
    })
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

    const movieReceipt = await client.execute({ args: [movie.run.id], sql: 'SELECT status, failure_code, receipt_summary_json, receipt_schema_version, receipt_primary_content_id, receipt_source_revision FROM crawler_run WHERE id = ?' })
    expect(movieReceipt.rows[0]).toMatchObject({
      failure_code: null,
      receipt_primary_content_id: 'movie-verified',
      receipt_schema_version: 2,
      receipt_source_revision: 0,
      status: 'succeeded',
    })
    expect(JSON.parse(String(movieReceipt.rows[0]?.receipt_summary_json))).toMatchObject({
      createdCount: 2,
      primaryContentId: 'movie-verified',
      receiptSchemaVersion: 2,
      source: {
        disposition: 'no_source',
        eligibleCount: 0,
        repairable: true,
        sourceRevision: 0,
      },
      templateKey: 'movie',
      updatedCount: 1,
    })

    await client.execute({
      args: ['movie-source-failed', 'Source failed movie', 'source-failed-movie', 'MOV-SOURCE-FAILED', 0, 0],
      sql: 'INSERT INTO movie (id, title, slug, code, total_players, crawled_players) VALUES (?, ?, ?, ?, ?, ?)',
    })
    await client.execute({
      args: ['movie-source-failed', 3, 'source_failed', 0, 1, 'source_write_failed', 1_725_000_010],
      sql: 'INSERT INTO movie_source_state (movie_id, source_revision, disposition, eligible_count, repairable, reason_code, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    })
    const sourceFailed = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (sourceFailed.kind !== 'created')
      throw new Error('expected source-failed run')
    await repository.claimDispatch(sourceFailed.run.id)
    await repository.renewLease(sourceFailed.run.id, 2)
    await expect(repository.processRunnerEvent({
      attempt: 1,
      bodySha256: 'source-failed-body',
      event: { actor: 'runner', receipt: { contentIds: ['MOV-SOURCE-FAILED'], templateKey: 'movie' }, sequence: 3, type: 'runner_succeeded' },
      eventId: 'source-failed-event',
      keyId: 'key-current',
      nonce: 'source-failed-nonce',
      receipt: { contentIds: ['MOV-SOURCE-FAILED'], templateKey: 'movie' },
      runId: sourceFailed.run.id,
      sequence: 3,
    })).resolves.toMatchObject({ kind: 'accepted', outcome: { accepted: true, status: 'succeeded' } })
    const sourceFailedReceipt = await client.execute({ args: [sourceFailed.run.id], sql: 'SELECT receipt_summary_json, receipt_schema_version, receipt_primary_content_id, receipt_source_revision FROM crawler_run WHERE id = ?' })
    expect(sourceFailedReceipt.rows[0]).toMatchObject({
      receipt_primary_content_id: 'movie-source-failed',
      receipt_schema_version: 2,
      receipt_source_revision: 3,
    })
    expect(JSON.parse(String(sourceFailedReceipt.rows[0]?.receipt_summary_json))).toMatchObject({
      primaryContentId: 'movie-source-failed',
      source: {
        disposition: 'source_failed',
        reasonCode: 'source_write_failed',
        repairable: true,
        sourceRevision: 3,
      },
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
    await repository.ensureProviderAssociation({ attempt: 1, runId, template: 'movie' })
    await repository.claimDispatch(runId)
    await repository.renewLease(runId, 2)
    now = new Date(now.getTime() + 10 * 60 * 1000 + 1)

    await expect(repository.sweepExpiredRuns()).resolves.toEqual([runId])
    await expect(repository.getRun(runId)).resolves.toMatchObject({ status: 'failed' })
    const failure = await client.execute({ args: [runId], sql: 'SELECT failure_code, terminal_at FROM crawler_run WHERE id = ?' })
    expect(failure.rows[0]).toMatchObject({ failure_code: 'runner_lost' })
    expect(failure.rows[0]?.terminal_at).not.toBeNull()
    const retries = await client.execute({ args: [created.run.taskId], sql: 'SELECT attempt_number, status FROM crawler_run WHERE task_id = ? ORDER BY attempt_number' })
    expect(retries.rows).toEqual([
      { attempt_number: 1, status: 'failed' },
      { attempt_number: 2, status: 'queued' },
    ])
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

  it('binds a registered video availability operation to the local proof provider', async () => {
    await client.execute({
      args: ['movie-video-1', 'Video One', 'video-one', 'VIDEO-001', 0, 0],
      sql: 'INSERT INTO movie (id, title, slug, code, total_players, crawled_players) VALUES (?, ?, ?, ?, ?, ?)',
    })
    const created = await repository.createOrGetActiveRun({
      operationCommand: {
        actor: { id: 'admin-1', kind: 'admin' },
        idempotencyKey: 'video:movie-video-1:4:no_peer',
        intent: {
          kind: 'recheck_video_source',
          movieRevision: 4,
          policyVersion: 'video-source-probe/v1',
          reason: 'no_peer',
          sourceRevision: 4,
        },
        operation: 'recheck_video_source',
        policyReference: 'availability/video-source-probe',
        policyVersion: 'video-source-probe/v1',
        target: { id: 'movie-video-1', kind: 'movie' },
      },
      requestedByUserId: 'admin-1',
      templateKey: 'movie',
    })
    if (created.kind !== 'created')
      throw new Error('expected video availability run')

    await expect(repository.ensureProviderAssociation({
      attempt: 1,
      provider: 'local-proof',
      runId: created.run.id,
      template: 'movie',
    })).resolves.toMatchObject({
      applicationAttempt: 1,
      provider: 'local-proof',
      providerRunId: `local-${created.run.id}`,
      runId: created.run.id,
    })
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

  it('projects safe operation and target identity into the lightweight task list', async () => {
    const snapshot = JSON.stringify({
      entrypoint: 'movie-crawler',
      movieId: 'movie-repair-list',
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: 'no_source',
      sourceRevision: 4,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    })
    await client.execute({
      args: ['repair-list-task', 'movie', 'repair_players', 1, 'admin-1', snapshot, null, 'repair-list-run', 100, 101],
      sql: 'INSERT INTO crawler_task (id, template_key, operation, template_version, requested_by_user_id, request_snapshot_json, idempotency_key, latest_run_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    })
    await client.execute({
      args: ['repair-list-run', 'repair-list-task', 1, 'running', 1, 0, null, null, null, null, null, 100, 101, null],
      sql: 'INSERT INTO crawler_run (id, task_id, attempt_number, status, state_version, last_event_sequence, lease_expires_at, last_heartbeat_at, cancel_requested_at, failure_code, receipt_summary_json, created_at, updated_at, terminal_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    })

    const page = await repository.listTasks({ limit: 10, templateKey: 'movie' })

    expect(page.tasks).toContainEqual(expect.objectContaining({
      id: 'repair-list-task',
      latestRun: expect.objectContaining({ id: 'repair-list-run', status: 'running' }),
      operation: 'repair_players',
      target: { id: 'movie-repair-list', kind: 'movie' },
    }))
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
        args: ['run-3', 'task-detail', 3, 'succeeded', 3, 1, null, null, null, null, JSON.stringify({ createdCount: 1, primaryContentId: 'movie-1', source: { disposition: 'ready', eligibleCount: 'raw-error', error: 'do-not-expose' }, templateKey: 'movie', updatedCount: 0 }), 3, 3, 3],
        sql: 'INSERT INTO crawler_run (id, task_id, attempt_number, status, state_version, last_event_sequence, lease_expires_at, last_heartbeat_at, cancel_requested_at, failure_code, receipt_summary_json, created_at, updated_at, terminal_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      },
      {
        args: ['run-2', 2, 'github-actions', 'movie', 'starye-org', '.github/workflows/daily-movie-crawl.yml', 'inspire-man/starye', 'main', 'starye-org', 'crawler-optimized', '123', 1, 'a'.repeat(40), 'completed', 'success', null, null, null, 3, 3],
        sql: 'INSERT INTO crawler_run_provider_association (run_id, application_attempt, provider, template_key, target, workflow, repository, ref, environment, crawler_entrypoint, provider_run_id, provider_run_attempt, sha, provider_status, provider_conclusion, reconciliation_window_ends_at, safe_facts_json, schedule_bucket, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      },
    ], 'write')

    const detail = await repository.getTaskDetail('task-detail')
    expect(detail?.runs.map(run => run.attemptNumber)).toEqual([3, 2, 1])
    expect(detail?.runs[0]?.receipt).toBeNull()
    expect(detail?.runs[1]).toMatchObject({
      provider: {
        providerRunUrl: 'https://github.com/inspire-man/starye/actions/runs/123',
      },
      receipt: {
        primaryContentId: 'movie-1',
        templateKey: 'movie',
      },
    })
    expect(JSON.stringify(detail)).not.toContain('token')
    expect(JSON.stringify(detail)).not.toContain('do-not-expose')

    await client.execute('DROP TABLE crawler_run_provider_association')
    const legacy = await repository.getTaskDetail('task-detail')
    expect(legacy?.runs.every(run => run.provider === null)).toBe(true)
  })

  it('keeps operation snapshots and availability observations bound to the same task/run tuple', async () => {
    const snapshot = buildCrawlerOperationSnapshot({
      actor: { id: 'admin-1', kind: 'admin' },
      idempotencyKey: 'tuple-1',
      intent: { kind: 'crawl' },
      operation: 'movie',
      policyReference: 'availability/default',
      policyVersion: 'v1',
      target: { id: 'movie-1', kind: 'movie' },
    })
    const storedSnapshot = JSON.parse(snapshot.requestSnapshotJson) as { target: { id: string } }
    expect(storedSnapshot.target.id).toBe('movie-1')

    const created = await repository.createOrGetActiveRun({ requestedByUserId: 'admin-1', templateKey: 'movie' })
    if (created.kind !== 'created')
      throw new Error('expected a created run')
    const observation = validateAvailabilityObservation({
      attemptNumber: created.run.attemptNumber,
      contentId: 'movie-1',
      eventSequence: 1,
      freshness: 'fresh',
      nextAction: 'none',
      observationIdentity: 'tuple-observation-1',
      observedAt: 1_700_000_000,
      policyVersion: 'v1',
      provider: 'github-actions',
      reasonCode: 'available',
      runId: created.run.id,
      sourceRevision: 0,
      status: 'available',
      summary: { counts: { ready: 1 }, samples: [] },
      target: { id: 'movie-1', kind: 'movie' },
      taskId: created.run.taskId,
    })
    expect(observation).toMatchObject({ taskId: created.run.taskId, runId: created.run.id, attemptNumber: 1 })
  })

  it('persists task lifecycle separately from run status and makes operation replay deterministic', async () => {
    const command = {
      actor: { id: 'admin-1', kind: 'admin' as const },
      idempotencyKey: 'lifecycle-1',
      intent: { kind: 'crawl' as const },
      operation: 'movie' as const,
      policyReference: 'crawler/default',
      policyVersion: 'v1',
      target: { id: 'movie-lifecycle', kind: 'movie' as const },
    }
    const created = await repository.createOrGetActiveRun({
      operationCommand: command,
      requestedByUserId: 'admin-1',
      templateKey: 'movie',
    })
    expect(created.kind).toBe('created')
    if (created.kind !== 'created')
      throw new Error('expected created operation task')

    const replay = await repository.createOrGetActiveRun({
      operationCommand: command,
      requestedByUserId: 'admin-1',
      templateKey: 'movie',
    })
    expect(replay).toMatchObject({ kind: 'duplicate', taskId: created.run.taskId, run: { id: created.run.id } })

    await expect(repository.archiveTask(created.run.taskId)).resolves.toMatchObject({
      kind: 'updated',
      lifecycle: { status: 'archived', version: 1 },
    })
    await expect(repository.archiveTask(created.run.taskId)).resolves.toMatchObject({ kind: 'idempotent' })
    await expect(repository.getTaskDetail(created.run.taskId)).resolves.toMatchObject({
      lifecycle: { status: 'archived', version: 1 },
      task: { lifecycle: { status: 'archived' } },
    })
    await expect(repository.applyTransition(created.run.id, {
      actor: 'admin',
      type: 'admin_cancel',
    })).resolves.toMatchObject({ kind: 'rejected', reasonCode: 'task_inactive' })
  })
})
