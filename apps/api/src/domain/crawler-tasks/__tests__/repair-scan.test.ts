import type { Client, InValue } from '@libsql/client'
import { createClient } from '@libsql/client'
import { crawlerRuns, crawlerTasks, movies, movieSourceStates, players } from '@starye/db'
import { getTableName } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readRepairScanCandidates } from '../repair-scan'

const now = 1_800_000_000
let client: Client

const db = {
  prepare: (sql: string) => ({
    bind: (...values: unknown[]) => ({
      all: async <T>() => ({ results: (await client.execute({ sql, args: values as InValue[] })).rows as unknown as T[] }),
    }),
  }),
}

async function movie(id: string, state?: string, hasPlayer = false, observedAt = now - 100_000) {
  await client.execute({ sql: 'INSERT INTO movie VALUES (?, ?, ?)', args: [id, `CODE-${id}`, id] })
  if (state)
    await client.execute({ sql: 'INSERT INTO movie_source_state VALUES (?, ?, 2, ?)', args: [id, state, observedAt] })
  if (hasPlayer)
    await client.execute({ sql: 'INSERT INTO player VALUES (?)', args: [id] })
}

async function run(movieId: string, status: string, time: number, legacy = false) {
  const id = `${movieId}-${time}`
  const snapshot = legacy ? { movieId } : { target: { id: movieId, kind: 'movie' } }
  await client.execute({ sql: 'INSERT INTO crawler_task VALUES (?, ?, ?)', args: [id, 'repair_players', JSON.stringify(snapshot)] })
  await client.execute({ sql: 'INSERT INTO crawler_run VALUES (?, ?, ?, ?, ?)', args: [id, id, status, time, time] })
}

beforeEach(async () => {
  client = createClient({ url: ':memory:' })
  // Use schema-owned table names so the query is checked against the real D1 naming contract.
  await client.executeMultiple(`
    CREATE TABLE ${getTableName(movies)} (id TEXT PRIMARY KEY, code TEXT, title TEXT);
    CREATE TABLE ${getTableName(players)} (movie_id TEXT);
    CREATE TABLE ${getTableName(movieSourceStates)} (movie_id TEXT PRIMARY KEY, disposition TEXT, source_revision INTEGER, observed_at INTEGER);
    CREATE TABLE ${getTableName(crawlerTasks)} (id TEXT PRIMARY KEY, operation TEXT, request_snapshot_json TEXT);
    CREATE TABLE ${getTableName(crawlerRuns)} (id TEXT PRIMARY KEY, task_id TEXT, status TEXT, terminal_at INTEGER, created_at INTEGER);
  `)
})

afterEach(() => client.close())

describe('player repair candidate scan', () => {
  it('uses persisted players when a source projection is absent', async () => {
    await movie('empty')
    await movie('has-player', undefined, true)
    const rows = await readRepairScanCandidates(db, now, 25)
    expect(rows.map(row => row.id)).toEqual(['empty'])
    expect(rows[0]).toMatchObject({ disposition: 'no_source', source_revision: 0, consecutive_failures: 0 })
  })

  it('selects long-failed sources while excluding fresh failures, ready and repairing sources', async () => {
    await movie('old-failure', 'source_failed', true)
    await movie('new-failure', 'source_failed', true, now - 60)
    await movie('ready', 'ready', true)
    await movie('repairing', 'repairing')
    expect((await readRepairScanCandidates(db, now, 25)).map(row => row.id)).toEqual(['old-failure'])
  })

  it('excludes active attempts for canonical and legacy snapshots', async () => {
    for (const [index, status] of ['queued', 'dispatching', 'running', 'cancel_requested'].entries()) {
      await movie(`${index}`)
      await run(`${index}`, status, now - 100, index % 2 === 0)
    }
    expect(await readRepairScanCandidates(db, now, 25)).toEqual([])
  })

  it('backs off consecutive failures and reconsiders them after the deadline', async () => {
    await movie('failed')
    await run('failed', 'failed', now - 20_000)
    await run('failed', 'failed', now - 10_000)
    expect(await readRepairScanCandidates(db, now, 25)).toEqual([])
    const rows = await readRepairScanCandidates(db, now + 11_600, 25)
    expect(rows[0]).toMatchObject({ consecutive_failures: 2, next_retry_at: now + 11_600 })
  })

  it('resets the failure streak after success and prioritizes never-attempted movies', async () => {
    await movie('attempted')
    await movie('new')
    await run('attempted', 'failed', now - 80_000)
    await run('attempted', 'succeeded', now - 70_000)
    await run('attempted', 'failed', now - 60_000)
    const rows = await readRepairScanCandidates(db, now, 25)
    expect(rows.map(row => row.id)).toEqual(['new', 'attempted'])
    expect(rows[1].consecutive_failures).toBe(1)
    expect((await readRepairScanCandidates(db, now, 1)).map(row => row.id)).toEqual(['new'])
  })
})
