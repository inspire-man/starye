import type { Client, InStatement } from '@libsql/client'
import { readFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import { createDb } from '@starye/db'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCrawlerTaskRepository } from '../repository'
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
  const migration = await readFile(new URL('../../../../../../packages/db/drizzle/0027_crawler_task_domain_foundation.sql', import.meta.url), 'utf8')
  const statements = migration
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(sql => ({ sql }))
  await client.batch(statements, 'write')

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
})
