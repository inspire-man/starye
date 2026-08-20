import type { Client, InStatement } from '@libsql/client'
import type { PlaybackArtifactReference, PlaybackEvidenceRequest } from '../types'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@libsql/client'
import { createDb } from '@starye/db'
import { describe, expect, it } from 'vitest'
import { createPlaybackEvidenceRepository } from '../repository'

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
    const result = await this.client.execute({ args: this.values as never, sql: this.sql })
    return { meta: { changes: result.rowsAffected }, results: result.rows as unknown as T[] }
  }

  async run(): Promise<D1Result> {
    const result = await this.client.execute({ args: this.values as never, sql: this.sql })
    return { meta: { changes: result.rowsAffected }, results: [] }
  }

  toStatement(): InStatement {
    return { args: this.values as never, sql: this.sql }
  }
}

class LibsqlD1 {
  constructor(private readonly client: Client) {}

  prepare(sql: string) {
    return new LibsqlStatement(this.client, sql)
  }
}

const now = new Date('2023-11-14T22:15:30.000Z')
const nowSeconds = Math.floor(now.getTime() / 1000)

async function applyMigrations(client: Client): Promise<void> {
  for (const file of [
    '0027_crawler_task_domain_foundation.sql',
    '0028_crawler_provider_association.sql',
    '0029_source_contract_receipt_boundary.sql',
    '0030_source_health_repair.sql',
    '0031_playback_evidence.sql',
  ]) {
    const sql = await readFile(resolve(process.cwd(), '../../packages/db/drizzle', file), 'utf8')
    await client.batch(
      sql.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean).map(statement => ({ sql: statement })),
      'write',
    )
  }
}

type TestOperation = 'check_video_source' | 'recheck_video_source' | 'repair_players' | 'repair_video_source'

async function createTestDatabase(input: { readonly operation?: TestOperation } = {}) {
  const operation = input.operation ?? 'repair_players'
  const snapshot = operation === 'repair_players'
    ? {
        entrypoint: 'movie-crawler',
        movieId: 'movie-1',
        operation,
        permissionResource: 'movie',
        reason: 'source_failed',
        sourceRevision: 7,
        targetIntent: 'restore_playable_sources',
        templateKey: 'movie',
        templateVersion: 1,
      }
    : {
        entrypoint: 'movie-crawler',
        movieId: 'movie-1',
        movieRevision: 3,
        operation,
        permissionResource: 'movie',
        policyVersion: 'video-source-probe/v1',
        reason: 'stale',
        sourceKind: 'direct',
        sourceRevision: 7,
        templateKey: 'movie',
        templateVersion: 1,
      }
  const receipt = operation === 'repair_players'
    ? {
        movieId: 'movie-1',
        observedAt: nowSeconds,
        operation,
        sourceRevision: 7,
        sourceSummary: [{ eligible: true, health: 'unverified', observedAt: nowSeconds, reasonCode: 'source_unverified', sourceType: 'direct' }],
      }
    : {
        createdCount: 1,
        primaryContentId: 'movie-1',
        receiptSchemaVersion: 2,
        source: { disposition: 'ready', eligibleCount: 1, observedAt: nowSeconds, reasonCode: null, repairable: false, sourceRevision: 7 },
        templateKey: 'movie',
        updatedCount: 0,
      }
  const client = createClient({ url: 'file::memory:' })
  await client.execute('PRAGMA foreign_keys = ON')
  await client.execute(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      email_verified INTEGER NOT NULL,
      role TEXT NOT NULL,
      is_r18_verified INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  await client.execute('INSERT INTO user (id, name, email, email_verified, role, is_r18_verified, created_at, updated_at) VALUES (\'admin-1\', \'Admin\', \'admin@example.com\', 1, \'movie_admin\', 1, ?, ?)', [nowSeconds, nowSeconds])
  await client.execute('CREATE TABLE movie (id TEXT PRIMARY KEY NOT NULL)')
  await applyMigrations(client)
  await client.batch([
    { sql: 'INSERT INTO movie (id) VALUES (?)', args: ['movie-1'] },
    { sql: `INSERT INTO crawler_task (id, template_key, operation, template_version,
      requested_by_user_id, request_snapshot_json, latest_run_id, created_at, updated_at)
      VALUES (?, 'movie', ?, 1, ?, ?, ?, ?, ?)`, args: [
      'task-1',
      operation,
      'admin-1',
      JSON.stringify(snapshot),
      'run-1',
      nowSeconds,
      nowSeconds,
    ] },
    { sql: `INSERT INTO crawler_run (id, task_id, attempt_number, status,
      state_version, last_event_sequence, receipt_summary_json,
      receipt_primary_content_id, receipt_source_revision, created_at, updated_at, terminal_at)
      VALUES (?, ?, 1, 'succeeded', 2, 3, ?, ?, ?, ?, ?, ?)`, args: [
      'run-1',
      'task-1',
      JSON.stringify(receipt),
      'movie-1',
      7,
      nowSeconds,
      nowSeconds,
      nowSeconds,
    ] },
    { sql: `INSERT INTO crawler_run_provider_association (
      run_id, application_attempt, provider, template_key, target, workflow,
      repository, ref, environment, crawler_entrypoint, provider_run_id,
      provider_status, provider_conclusion, reconciliation_window_ends_at, created_at, updated_at)
      VALUES (?, 1, 'github-actions', 'movie', 'starye-org',
      '.github/workflows/daily-movie-crawl.yml', 'inspire-man/starye', 'main',
      'starye-org', 'crawler-optimized', ?, 'completed', 'success', ?, ?, ?)`, args: [
      'run-1',
      'provider-run-1',
      nowSeconds + 300,
      nowSeconds,
      nowSeconds,
    ] },
    { sql: `INSERT INTO movie_source_state (
      movie_id, source_revision, disposition, eligible_count, repairable, reason_code, observed_at)
      VALUES (?, 7, 'ready', 1, 0, NULL, ?)`, args: ['movie-1', nowSeconds] },
  ], 'write')
  return { client, db: createDb(new LibsqlD1(client) as never) }
}

function createEvidence(overrides: Partial<PlaybackEvidenceRequest> = {}): PlaybackEvidenceRequest {
  return {
    contentId: 'movie-1',
    events: [
      { event: 'canplay', observed: true, observedAt: nowSeconds + 1 },
      { event: 'playing', observed: true, observedAt: nowSeconds + 2 },
      { event: 'waiting', observed: false, observedAt: null },
      { event: 'stalled', observed: false, observedAt: null },
      { event: 'error', observed: false, observedAt: null },
    ],
    observedAt: nowSeconds + 10,
    playback: {
      canplay: true,
      error: false,
      playing: true,
      progress: { currentTimeAfter: 3.2, currentTimeBefore: 1.9, currentTimeDelta: 1.3 },
      status: 'playback_verified',
    },
    provider: { provider: 'github-actions', status: 'succeeded' },
    repair: { sourceRevision: 7, status: 'succeeded' },
    schemaVersion: 1,
    source: { revision: 7, sourceType: 'direct', status: 'ready' },
    sourceRevision: 7,
    tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'run-1', taskId: 'task-1' },
    viewer: { path: '/movie/movie-1', targetLabel: 'selected-production-target' },
    ...overrides,
  }
}

function artifact(hash: string): PlaybackArtifactReference {
  return {
    hash: hash.repeat(64 / hash.length),
    reference: 'phase24/task-1/run-1/attempt-1.json',
    stem: 'task-1_run-1_attempt-1',
  }
}

describe('playback evidence repository', () => {
  it('accepts once, returns duplicate for identical replay, and records conflict without overwriting', async () => {
    const testDb = await createTestDatabase()
    let nextId = 0
    const repository = createPlaybackEvidenceRepository(testDb.db, {
      createId: () => `evidence-${++nextId}`,
      now: () => new Date(now.getTime() + 30_000),
    })
    const input = { artifact: artifact('a'), evidence: createEvidence(), runId: 'run-1', taskId: 'task-1' }

    const first = await repository.accept(input)
    expect(first).toMatchObject({ kind: 'accepted', summary: { outcome: 'accepted' } })
    const duplicate = await repository.accept(input)
    expect(duplicate).toMatchObject({ kind: 'duplicate', summary: { outcome: 'duplicate' } })
    await expect(repository.accept({ ...input, artifact: artifact('b') })).resolves.toMatchObject({ kind: 'conflict' })

    const stored = await testDb.client.execute('SELECT evidence_hash, playback_status FROM playback_evidence_summary')
    const history = await testDb.client.execute('SELECT outcome, reason_code FROM playback_evidence_rejection ORDER BY created_at, id')
    expect(stored.rows).toEqual([{ evidence_hash: 'a'.repeat(64), playback_status: 'playback_verified' }])
    expect(history.rows).toEqual([
      { outcome: 'duplicate', reason_code: 'identical_evidence_replay' },
      { outcome: 'conflict', reason_code: 'same_evidence_identity_hash_conflict' },
    ])
  })

  it('accepts playback evidence from the configured local-proof provider', async () => {
    const testDb = await createTestDatabase()
    await testDb.client.execute(`
      UPDATE crawler_run_provider_association
      SET provider = 'local-proof', provider_run_id = 'local-run-1', provider_status = 'completed'
      WHERE run_id = 'run-1'
    `)
    const repository = createPlaybackEvidenceRepository(testDb.db, {
      createId: () => 'local-evidence-1',
      now: () => new Date(now.getTime() + 30_000),
    })

    const evidence = createEvidence({
      provider: { provider: 'local-proof', status: 'succeeded' },
      tuple: { attemptNumber: 1, provider: 'local-proof', runId: 'run-1', taskId: 'task-1' },
    })
    const result = await repository.accept({
      artifact: artifact('c'),
      evidence,
      runId: 'run-1',
      taskId: 'task-1',
    })

    expect(result).toMatchObject({
      kind: 'accepted',
      summary: { outcome: 'accepted', tuple: { provider: 'local-proof' } },
    })
    await expect(testDb.client.execute('SELECT provider FROM playback_evidence_summary')).resolves.toMatchObject({
      rows: [{ provider: 'local-proof' }],
    })
  })

  it.each(['check_video_source', 'recheck_video_source', 'repair_video_source'] as const)(
    'accepts playback evidence from the %s operation with a generic movie receipt',
    async (operation) => {
      const testDb = await createTestDatabase({ operation })
      const repository = createPlaybackEvidenceRepository(testDb.db, {
        createId: () => `video-${operation}`,
        now: () => new Date(now.getTime() + 30_000),
      })

      const result = await repository.accept({
        artifact: artifact('d'),
        evidence: createEvidence(),
        runId: 'run-1',
        taskId: 'task-1',
      })

      expect(result).toMatchObject({
        kind: 'accepted',
        summary: { outcome: 'accepted', sourceRevision: 7 },
      })
    },
  )

  it('rejects video evidence when the generic receipt disagrees with the authoritative source state', async () => {
    const testDb = await createTestDatabase({ operation: 'recheck_video_source' })
    await testDb.client.execute(`
      UPDATE crawler_run
      SET receipt_summary_json = ?
      WHERE id = 'run-1'
    `, [JSON.stringify({
      createdCount: 1,
      primaryContentId: 'movie-1',
      receiptSchemaVersion: 2,
      source: { disposition: 'ready', eligibleCount: 1, observedAt: nowSeconds, reasonCode: 'source_read_failed', repairable: false, sourceRevision: 7 },
      templateKey: 'movie',
      updatedCount: 0,
    })])
    const repository = createPlaybackEvidenceRepository(testDb.db, {
      createId: () => 'video-mismatch',
      now: () => new Date(now.getTime() + 30_000),
    })

    await expect(repository.accept({
      artifact: artifact('e'),
      evidence: createEvidence(),
      runId: 'run-1',
      taskId: 'task-1',
    })).resolves.toMatchObject({
      kind: 'rejected',
      outcome: 'ignored',
      reason: 'receipt_readback_mismatch',
    })
  })

  it('keeps video evidence stale when the server-owned source revision advances', async () => {
    const testDb = await createTestDatabase({ operation: 'recheck_video_source' })
    await testDb.client.execute('UPDATE movie_source_state SET source_revision = 8 WHERE movie_id = \'movie-1\'')
    const repository = createPlaybackEvidenceRepository(testDb.db, {
      createId: () => 'video-stale',
      now: () => new Date(now.getTime() + 30_000),
    })

    await expect(repository.accept({
      artifact: artifact('f'),
      evidence: createEvidence(),
      runId: 'run-1',
      taskId: 'task-1',
    })).resolves.toMatchObject({
      kind: 'rejected',
      outcome: 'stale',
      reason: 'source_revision_changed',
    })
  })

  it('keeps the current fact unchanged for tuple mismatch, stale revision, and late attempts', async () => {
    const testDb = await createTestDatabase()
    let nextId = 0
    const repository = createPlaybackEvidenceRepository(testDb.db, {
      createId: () => `evidence-${++nextId}`,
      now: () => new Date(now.getTime() + 30_000),
    })
    const input = { artifact: artifact('a'), evidence: createEvidence(), runId: 'run-1', taskId: 'task-1' }
    const first = await repository.accept(input)
    expect(first).toMatchObject({ kind: 'accepted' })

    await expect(repository.accept({
      ...input,
      artifact: artifact('b'),
      evidence: { ...input.evidence, tuple: { ...input.evidence.tuple, runId: 'run-other' } },
    })).resolves.toMatchObject({ kind: 'rejected', outcome: 'ignored' })

    await testDb.client.execute('UPDATE movie_source_state SET source_revision = 8 WHERE movie_id = \'movie-1\'')
    await expect(repository.accept({ ...input, artifact: artifact('c') })).resolves.toMatchObject({ kind: 'rejected', outcome: 'stale' })

    await testDb.client.execute('UPDATE crawler_task SET latest_run_id = \'run-2\' WHERE id = \'task-1\'')
    await expect(repository.accept({ ...input, artifact: artifact('d') })).resolves.toMatchObject({ kind: 'rejected', outcome: 'late' })

    const stored = await testDb.client.execute('SELECT COUNT(*) AS count, MAX(playback_status) AS status FROM playback_evidence_summary')
    expect(stored.rows).toEqual([{ count: 1, status: 'playback_verified' }])
    await expect(repository.getTaskEvidence('task-1')).resolves.toMatchObject({
      runs: [{ runId: 'run-1', summary: { outcome: 'accepted' }, rejections: expect.arrayContaining([
        expect.objectContaining({ outcome: 'ignored' }),
        expect.objectContaining({ outcome: 'stale' }),
        expect.objectContaining({ outcome: 'late' }),
      ]) }],
    })
  })
})
