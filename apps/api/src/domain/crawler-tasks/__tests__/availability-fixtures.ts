import type { Client, InStatement } from '@libsql/client'
import type { AvailabilityObservation, AvailabilityTuple } from '../availability-contract'
import { readFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import { createDb } from '@starye/db'

interface D1Result<T = unknown> {
  readonly meta: { readonly changes: number }
  readonly results: T[]
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
    return result.map(item => ({
      meta: { changes: item.rowsAffected },
      results: item.rows as unknown as unknown[],
    }))
  }
}

export interface AvailabilityTestDatabase {
  readonly client: Client
  readonly db: ReturnType<typeof createDb>
}

export const availabilityTuple: AvailabilityTuple = {
  attemptNumber: 1,
  contentId: 'movie-1',
  provider: 'github-actions',
  runId: 'run-1',
  target: { id: 'movie-1', kind: 'movie' },
  taskId: 'task-1',
}

export function createAvailabilityObservation(overrides: Partial<AvailabilityObservation> = {}): AvailabilityObservation {
  return {
    ...availabilityTuple,
    eventSequence: 1,
    freshness: 'fresh',
    nextAction: 'none',
    observationIdentity: 'observation-1',
    observedAt: 1_700_000_000,
    policyVersion: 'v1',
    reasonCode: 'available',
    sourceRevision: 0,
    status: 'available',
    summary: { counts: { ready: 1 }, samples: [] },
    ...overrides,
  }
}

export function createAvailabilityBindingSnapshot(): string {
  return JSON.stringify({
    actor: { id: 'admin', kind: 'admin' },
    idempotencyKey: 'availability-fixture',
    intent: { kind: 'crawl' },
    operation: 'movie',
    policyReference: 'movies/availability',
    policyVersion: 'v1',
    provider: { provider: 'github-actions' },
    target: { id: 'movie-1', kind: 'movie' },
  })
}

export async function createAvailabilityTestDatabase(input: {
  readonly receiptContentId?: string | null
  readonly receiptSourceRevision?: number | null
  readonly runStatus?: string
} = {}): Promise<AvailabilityTestDatabase> {
  const client = createClient({ url: 'file::memory:' })
  await client.batch([
    { sql: 'PRAGMA foreign_keys = ON' },
    { sql: 'CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, email_verified INTEGER NOT NULL, role TEXT NOT NULL, is_adult INTEGER, is_r18_verified INTEGER NOT NULL, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)' },
    { sql: 'INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', args: ['admin', 'Admin', 'admin@example.com', 1, 'admin', 0, 1, null, 1, 1] },
    { sql: 'CREATE TABLE crawler_task (id TEXT PRIMARY KEY NOT NULL, template_key TEXT NOT NULL, operation TEXT NOT NULL, template_version INTEGER NOT NULL, requested_by_user_id TEXT NOT NULL, request_snapshot_json TEXT NOT NULL, idempotency_key TEXT, latest_run_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY (requested_by_user_id) REFERENCES user(id))' },
    { sql: 'CREATE TABLE crawler_run (id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL, attempt_number INTEGER NOT NULL, status TEXT NOT NULL, state_version INTEGER NOT NULL, last_event_sequence INTEGER NOT NULL, receipt_primary_content_id TEXT, receipt_source_revision INTEGER, receipt_summary_json TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (task_id, id), FOREIGN KEY (task_id) REFERENCES crawler_task(id))' },
    { sql: 'CREATE TABLE crawler_run_provider_association (run_id TEXT NOT NULL, application_attempt INTEGER NOT NULL, provider TEXT NOT NULL, PRIMARY KEY (run_id, application_attempt), FOREIGN KEY (run_id) REFERENCES crawler_run(id))' },
  ], 'write')

  const migration = await readFile(new URL('../../../../../../packages/db/drizzle/20260810153608_crawler_task_availability.sql', import.meta.url), 'utf8')
  await client.batch(migration.split('--> statement-breakpoint').map(sql => ({ sql: sql.trim() })).filter(statement => statement.sql), 'write')
  await client.batch([
    {
      sql: 'INSERT INTO crawler_task VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['task-1', 'movie', 'movie', 1, 'admin', createAvailabilityBindingSnapshot(), null, 'run-1', 1, 1],
    },
    {
      sql: `INSERT INTO crawler_run (
        id, task_id, attempt_number, status, state_version, last_event_sequence,
        receipt_primary_content_id, receipt_source_revision, receipt_summary_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'run-1',
        'task-1',
        1,
        input.runStatus ?? 'running',
        0,
        0,
        input.receiptContentId === undefined ? 'movie-1' : input.receiptContentId,
        input.receiptSourceRevision === undefined ? 0 : input.receiptSourceRevision,
        JSON.stringify({ contentIds: ['movie-1'], sourceRevision: 0 }),
        1,
        1,
      ],
    },
    { sql: 'INSERT INTO crawler_run_provider_association VALUES (?, ?, ?)', args: ['run-1', 1, 'github-actions'] },
  ], 'write')

  return { client, db: createDb(new LibsqlD1(client) as never) }
}
