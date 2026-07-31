import { readFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'

async function createMigratedClient() {
  const client = createClient({ url: 'file::memory:' })
  await client.execute('CREATE TABLE crawler_run (id TEXT PRIMARY KEY NOT NULL)')

  const migration = await readFile(
    fileURLToPath(new URL('../../drizzle/0028_crawler_provider_association.sql', import.meta.url)),
    'utf8',
  )
  const statements = migration
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(sql => ({ sql }))
  await client.batch(statements, 'write')

  return { client, migration }
}

async function insertRun(client: Awaited<ReturnType<typeof createMigratedClient>>['client'], options: {
  readonly providerRunId?: string
  readonly providerRunAttempt?: number
  readonly runId: string
  readonly scheduleBucket?: string
}) {
  await client.execute({
    args: [options.runId],
    sql: `
      INSERT INTO crawler_run (id) VALUES (?)
    `,
  })
  await client.execute({
    args: [
      options.runId,
      1,
      'github-actions',
      'movie',
      'starye-org',
      '.github/workflows/daily-movie-crawl.yml',
      'inspire-man/starye',
      'main',
      'starye-org',
      'crawler-optimized',
      options.providerRunId ?? null,
      options.providerRunAttempt ?? null,
      options.scheduleBucket ?? null,
      JSON.stringify({ provider: 'github-actions', status: 'queued' }),
    ],
    sql: `
      INSERT INTO crawler_run_provider_association (
        run_id, application_attempt, provider, template_key, target, workflow,
        repository, ref, environment, crawler_entrypoint, provider_run_id,
        provider_run_attempt, schedule_bucket, safe_facts_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  })
}

describe('crawler provider association migration', () => {
  it('creates the typed provider lookup, snapshot, reconciliation, and safe-facts columns', async () => {
    const { client, migration } = await createMigratedClient()
    const columns = await client.execute('PRAGMA table_info(crawler_run_provider_association)')
    const indexes = await client.execute('PRAGMA index_list(crawler_run_provider_association)')
    const names = columns.rows.map(column => String(column.name))
    const indexNames = indexes.rows.map(index => String(index.name))

    expect(names).toEqual(expect.arrayContaining([
      'provider_run_id',
      'provider_run_attempt',
      'workflow',
      'repository',
      'ref',
      'environment',
      'sha',
      'provider_status',
      'provider_conclusion',
      'reconciliation_window_ends_at',
      'safe_facts_json',
      'schedule_bucket',
    ]))
    expect(indexNames).toEqual(expect.arrayContaining([
      'idx_crawler_provider_run_attempt',
      'idx_crawler_provider_application_run_attempt',
      'idx_crawler_provider_schedule_bucket',
    ]))
    expect(migration).not.toMatch(/\b(token|jwt|private[_ ]?key)\b/iu)
  })

  it('rejects duplicate provider bindings and duplicate schedule buckets', async () => {
    const { client } = await createMigratedClient()
    await insertRun(client, {
      providerRunAttempt: 1,
      providerRunId: '101',
      runId: 'run-1',
      scheduleBucket: '2026-08-01T00:00',
    })

    await expect(insertRun(client, {
      providerRunAttempt: 1,
      providerRunId: '101',
      runId: 'run-2',
      scheduleBucket: '2026-08-01T00:01',
    })).rejects.toThrow(/UNIQUE constraint failed/u)

    await expect(insertRun(client, {
      providerRunAttempt: 1,
      providerRunId: '102',
      runId: 'run-3',
      scheduleBucket: '2026-08-01T00:00',
    })).rejects.toThrow(/UNIQUE constraint failed/u)
  })
})
