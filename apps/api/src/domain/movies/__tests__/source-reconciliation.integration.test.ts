import type { Client, InStatement } from '@libsql/client'
import { readFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import { createDb } from '@starye/db'
import { describe, expect, it } from 'vitest'
import { acceptRepairSourceObservation } from '../source-reconciliation'

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
    return {
      meta: { changes: result.rowsAffected },
      results: result.rows as unknown as T[],
    }
  }

  async run(): Promise<D1Result> {
    const result = await this.client.execute({ args: this.values, sql: this.sql })
    return { meta: { changes: result.rowsAffected }, results: [] }
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
  await client.batch([
    {
      sql: `
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
      `,
    },
    {
      sql: 'INSERT INTO user (id, name, email, email_verified, role, is_adult, is_r18_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['admin-1', 'Admin', 'admin@example.com', 1, 'admin', 0, 1, 1, 1],
    },
    {
      sql: 'CREATE TABLE movie (id TEXT PRIMARY KEY NOT NULL)',
    },
    {
      sql: 'INSERT INTO movie (id) VALUES (?)',
      args: ['movie-1'],
    },
    {
      sql: `
        CREATE TABLE player (
          id TEXT PRIMARY KEY NOT NULL,
          movie_id TEXT NOT NULL,
          source_name TEXT NOT NULL,
          source_url TEXT NOT NULL,
          quality TEXT,
          sort_order INTEGER NOT NULL,
          is_active INTEGER DEFAULT 1
        )
      `,
    },
  ], 'write')

  const migrationFiles = ['0027_crawler_task_domain_foundation.sql', '0028_crawler_provider_association.sql', '0029_source_contract_receipt_boundary.sql', '0030_source_health_repair.sql']
  const migrations = await Promise.all(migrationFiles.map(file => readFile(new URL(`../../../../../../packages/db/drizzle/${file}`, import.meta.url), 'utf8')))
  const statements = migrations
    .flatMap(migration => migration.split('--> statement-breakpoint'))
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(sql => ({ sql }))
  await client.batch(statements, 'write')
  await client.batch([
    {
      sql: `
        INSERT INTO crawler_task (
          id, template_key, operation, template_version, requested_by_user_id,
          request_snapshot_json, idempotency_key, latest_run_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: ['task-1', 'movie', 'repair_players', 1, 'admin-1', '{}', null, 'run-1', 1, 1],
    },
    {
      sql: `
        INSERT INTO crawler_run (
          id, task_id, attempt_number, status, state_version, last_event_sequence,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: ['run-1', 'task-1', 1, 'running', 0, 0, 1, 1],
    },
  ], 'write')

  return {
    client,
    db: createDb(new LibsqlD1(client) as never),
  }
}

describe('repair source reconciliation D1 batch integration', () => {
  it('persists CAS state, players, and observations through native D1 batch', async () => {
    const { client, db } = await createTestDatabase()
    const observedAt = new Date('2026-08-06T00:00:00.000Z')
    const input = {
      db,
      movieId: 'movie-1',
      operation: 'repair_players' as const,
      runId: 'run-1',
      attemptNumber: 1,
      sequence: 1,
      expectedRunStateVersion: 0,
      expectedLastEventSequence: 0,
      eventId: 'event-1',
      expectedSourceRevision: 0,
      observedAt,
      sources: [
        { sourceName: 'direct', sourceUrl: 'https://source.example/movie-1', sourceType: 'direct' as const, isActive: true },
        { sourceName: 'magnet', sourceUrl: 'magnet:?xt=urn:btih:fixture-1', sourceType: 'magnet' as const, isActive: true },
        { sourceName: 'inactive', sourceUrl: 'https://inactive.example/movie-1', sourceType: 'TorrServer' as const, isActive: false },
      ],
    }

    const result = await acceptRepairSourceObservation(input)

    expect(result).toMatchObject({
      outcome: 'accepted',
      readback: {
        movieId: 'movie-1',
        sourceRevision: 1,
        summary: { sourceCount: 3, eligibleCount: 2 },
      },
    })
    expect((await client.execute({ sql: 'SELECT source_revision, disposition, eligible_count FROM movie_source_state WHERE movie_id = ?', args: ['movie-1'] })).rows).toEqual([
      { source_revision: 1, disposition: 'ready', eligible_count: 2 },
    ])
    expect((await client.execute({ sql: 'SELECT COUNT(*) AS count FROM player WHERE movie_id = ?', args: ['movie-1'] })).rows).toEqual([{ count: 3 }])
    expect((await client.execute({ sql: 'SELECT COUNT(*) AS count FROM movie_source_observation WHERE movie_id = ? AND source_revision = ?', args: ['movie-1', 1] })).rows).toEqual([{ count: 3 }])
    expect((await client.execute({ sql: 'SELECT COUNT(*) AS count FROM movie_source_observation WHERE run_id = ? AND event_id = ?', args: ['run-1', 'event-1'] })).rows).toEqual([{ count: 3 }])
    expect((await client.execute({ sql: 'SELECT state_version, last_event_sequence FROM crawler_run WHERE id = ?', args: ['run-1'] })).rows).toEqual([
      { state_version: 1, last_event_sequence: 1 },
    ])
    expect((await client.execute({ sql: 'SELECT sequence, reason_code FROM crawler_run_transition WHERE run_id = ?', args: ['run-1'] })).rows).toEqual([
      { sequence: 1, reason_code: 'repair_source_observation' },
    ])
  })
})
