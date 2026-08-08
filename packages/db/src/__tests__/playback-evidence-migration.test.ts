import type { Client, InValue } from '@libsql/client'
import { readFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import { beforeEach, describe, expect, it } from 'vitest'

async function applyMigration(client: Client): Promise<void> {
  const sql = await readFile('drizzle/0031_playback_evidence.sql', 'utf8')
  for (const statement of sql.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
    await client.execute(statement)
}

async function createBase(client: Client): Promise<void> {
  await client.execute('PRAGMA foreign_keys = ON')
  await client.execute('CREATE TABLE movie (id TEXT PRIMARY KEY NOT NULL)')
  await client.execute('CREATE TABLE crawler_task (id TEXT PRIMARY KEY NOT NULL)')
  await client.execute('CREATE TABLE crawler_run (id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL)')
}

function summaryArgs(summary: Record<string, unknown>): InValue[] {
  return [
    summary.id as InValue,
    summary.task_id as InValue,
    summary.run_id as InValue,
    summary.attempt_number as InValue,
    summary.provider as InValue,
    summary.content_id as InValue,
    summary.source_revision as InValue,
    summary.evidence_identity as InValue,
    summary.evidence_hash as InValue,
    summary.playback_status as InValue,
    summary.summary_json as InValue,
    summary.artifact_reference as InValue,
    summary.artifact_stem as InValue,
    summary.artifact_hash as InValue,
    summary.observed_at as InValue,
    summary.created_at as InValue,
  ]
}

describe('playback evidence migration', () => {
  let client: Client

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:' })
    await createBase(client)
    await applyMigration(client)
  })

  it('creates bounded summary/rejection tables with tuple indexes and foreign keys', async () => {
    const summaryColumns = await client.execute('PRAGMA table_info(playback_evidence_summary)')
    const rejectionColumns = await client.execute('PRAGMA table_info(playback_evidence_rejection)')
    const summaryIndexes = await client.execute('PRAGMA index_list(playback_evidence_summary)')
    const rejectionIndexes = await client.execute('PRAGMA index_list(playback_evidence_rejection)')
    const summaryForeignKeys = await client.execute('PRAGMA foreign_key_list(playback_evidence_summary)')

    expect(summaryColumns.rows.map(row => row.name)).toEqual(expect.arrayContaining([
      'task_id',
      'run_id',
      'attempt_number',
      'provider',
      'content_id',
      'source_revision',
      'evidence_identity',
      'evidence_hash',
      'summary_json',
      'artifact_reference',
      'artifact_stem',
      'artifact_hash',
      'playback_status',
    ]))
    expect(rejectionColumns.rows.map(row => row.name)).toEqual(expect.arrayContaining([
      'task_id',
      'run_id',
      'content_id',
      'source_revision',
      'evidence_identity',
      'evidence_hash',
      'artifact_reference',
      'outcome',
      'reason_code',
    ]))
    expect(summaryIndexes.rows.map(row => row.name)).toEqual(expect.arrayContaining([
      'idx_playback_evidence_summary_tuple',
      'idx_playback_evidence_summary_content_revision',
      'idx_playback_evidence_summary_identity',
      'idx_playback_evidence_summary_run_observed',
    ]))
    expect(rejectionIndexes.rows.map(row => row.name)).toEqual(expect.arrayContaining([
      'idx_playback_evidence_rejection_tuple',
      'idx_playback_evidence_rejection_run_created',
      'idx_playback_evidence_rejection_outcome_created',
    ]))
    expect(summaryForeignKeys.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'crawler_task', from: 'task_id', on_delete: 'CASCADE' }),
      expect.objectContaining({ table: 'crawler_run', from: 'run_id', on_delete: 'CASCADE' }),
      expect.objectContaining({ table: 'crawler_run', from: 'task_id', to: 'task_id', on_delete: 'CASCADE' }),
      expect.objectContaining({ table: 'movie', from: 'content_id', on_delete: 'CASCADE' }),
    ]))
  })

  it('keeps the first current fact immutable and permits bounded rejection history', async () => {
    await client.batch([
      { sql: 'INSERT INTO crawler_task (id) VALUES (?)', args: ['task-1'] },
      { sql: 'INSERT INTO crawler_run (id, task_id) VALUES (?, ?)', args: ['run-1', 'task-1'] },
      { sql: 'INSERT INTO movie (id) VALUES (?)', args: ['movie-1'] },
    ], 'write')

    const summary = {
      id: 'evidence-1',
      task_id: 'task-1',
      run_id: 'run-1',
      attempt_number: 1,
      provider: 'github-actions',
      content_id: 'movie-1',
      source_revision: 7,
      evidence_identity: 'task-1/run-1/1/github-actions/movie-1/7',
      evidence_hash: 'a'.repeat(64),
      playback_status: 'playback_verified',
      summary_json: JSON.stringify({ playback: { status: 'playback_verified' } }),
      artifact_reference: 'phase24/task-1/run-1/attempt-1.json',
      artifact_stem: 'task-1_run-1_attempt-1',
      artifact_hash: 'a'.repeat(64),
      observed_at: 1_700_000_000,
      created_at: 1_700_000_000,
    }
    await client.execute({
      sql: `INSERT INTO playback_evidence_summary (
        id, task_id, run_id, attempt_number, provider, content_id, source_revision,
        evidence_identity, evidence_hash, playback_status, summary_json,
        artifact_reference, artifact_stem, artifact_hash, observed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: summaryArgs(summary),
    })
    await expect(client.execute({
      sql: `INSERT INTO playback_evidence_summary (
        id, task_id, run_id, attempt_number, provider, content_id, source_revision,
        evidence_identity, evidence_hash, playback_status, summary_json,
        artifact_reference, artifact_stem, artifact_hash, observed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: summaryArgs({ ...summary, id: 'evidence-2', evidence_hash: 'b'.repeat(64), artifact_hash: 'b'.repeat(64) }),
    })).rejects.toThrow()

    await client.execute({
      sql: `INSERT INTO playback_evidence_rejection (
        id, task_id, run_id, attempt_number, provider, content_id, source_revision,
        evidence_identity, evidence_hash, artifact_reference, artifact_stem,
        artifact_hash, outcome, reason_code, observed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ['reject-1', 'task-1', 'run-1', 1, 'github-actions', 'movie-1', 7, summary.evidence_identity, 'b'.repeat(64), summary.artifact_reference, summary.artifact_stem, 'b'.repeat(64), 'conflict', 'hash_mismatch', 1_700_000_001, 1_700_000_001],
    })
    const rows = await client.execute('SELECT evidence_hash, playback_status FROM playback_evidence_summary')
    const rejections = await client.execute('SELECT outcome, reason_code FROM playback_evidence_rejection')
    expect(rows.rows).toEqual([{ evidence_hash: 'a'.repeat(64), playback_status: 'playback_verified' }])
    expect(rejections.rows).toEqual([{ outcome: 'conflict', reason_code: 'hash_mismatch' }])
  })
})
