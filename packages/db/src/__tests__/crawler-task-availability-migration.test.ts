import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'
import { createDb } from '../index'

const migrationPath = new URL('../../drizzle/20260810153608_crawler_task_availability.sql', import.meta.url)

async function createMigratedDatabase() {
  const client = createClient({ url: ':memory:' })
  const base = [
    'CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, email_verified INTEGER NOT NULL, role TEXT NOT NULL, is_adult INTEGER, is_r18_verified INTEGER NOT NULL, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
    'CREATE TABLE crawler_task (id TEXT PRIMARY KEY NOT NULL, template_key TEXT NOT NULL, operation TEXT NOT NULL, template_version INTEGER NOT NULL, requested_by_user_id TEXT NOT NULL, request_snapshot_json TEXT NOT NULL, idempotency_key TEXT, latest_run_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY (requested_by_user_id) REFERENCES user(id))',
    'CREATE TABLE crawler_run (id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL, attempt_number INTEGER NOT NULL, status TEXT NOT NULL, state_version INTEGER NOT NULL, last_event_sequence INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY (task_id) REFERENCES crawler_task(id))',
    'CREATE UNIQUE INDEX idx_crawler_run_task_pair ON crawler_run(task_id, id)',
    'CREATE UNIQUE INDEX user_email_unique ON user(email)',
  ]
  for (const statement of base)
    await client.execute(statement)
  const migration = await readFile(fileURLToPath(migrationPath.href), 'utf8')
  for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
    await client.execute(statement)
  return { client, db: createDb(client as never) }
}

describe('crawler availability migration', () => {
  it('creates bounded append/current tables with tuple foreign keys and identity indexes', async () => {
    const { client } = await createMigratedDatabase()
    const tables = await client.execute('SELECT name, sql FROM sqlite_master WHERE type = \'table\' AND name LIKE \'crawler_availability_%\' ORDER BY name')
    expect(tables.rows.map(row => row.name)).toEqual(['crawler_availability_current', 'crawler_availability_observation'])
    expect(String(tables.rows[0]?.sql)).toContain('FOREIGN KEY (`task_id`,`run_id`) REFERENCES `crawler_run`(`task_id`,`id`)')
    expect(String(tables.rows[1]?.sql)).not.toMatch(/signed_url|cookie|secret|raw_response|media|results/iu)

    const indexes = await client.execute('SELECT name FROM sqlite_master WHERE type = \'index\' AND name LIKE \'idx_crawler_availability_%\' ORDER BY name')
    expect(indexes.rows.map(row => row.name)).toEqual(expect.arrayContaining([
      'idx_crawler_availability_current_target',
      'idx_crawler_availability_observation_identity',
      'idx_crawler_availability_observation_event',
    ]))
  })

  it('retains observation history while current has one target row and duplicate identities are rejected', async () => {
    const { client, db } = await createMigratedDatabase()
    void db
    await client.execute('INSERT INTO user VALUES (\'u1\',\'Admin\',\'admin@example.test\',1,\'admin\',0,1,NULL,1,1)')
    await client.execute('INSERT INTO crawler_task VALUES (\'task-1\',\'movie\',\'movie\',1,\'u1\',\'{}\',\'key-1\',NULL,1,1)')
    await client.execute('INSERT INTO crawler_run VALUES (\'run-1\',\'task-1\',1,\'running\',0,0,1,1)')
    const observation = 'INSERT INTO crawler_availability_observation (id,task_id,run_id,attempt_number,provider,target_kind,target_id,content_id,source_revision,policy_version,observation_identity,event_sequence,freshness,status,reason_code,next_action,summary_json,observed_at,created_at) VALUES (\'obs-1\',\'task-1\',\'run-1\',1,\'github-actions\',\'movie\',\'movie-1\',\'content-1\',3,\'v1\',\'identity-1\',1,\'fresh\',\'available\',\'available\',\'none\',\'{"counts":{"ok":1},"samples":[]}\',1700000000,1700000000)'
    await client.execute(observation)
    await expect(client.execute(observation)).rejects.toThrow()
    await client.execute('INSERT INTO crawler_availability_current (id,task_id,run_id,attempt_number,provider,target_kind,target_id,content_id,source_revision,policy_version,observation_identity,event_sequence,projection_version,freshness,status,reason_code,next_action,summary_json,observed_at,updated_at) VALUES (\'current-1\',\'task-1\',\'run-1\',1,\'github-actions\',\'movie\',\'movie-1\',\'content-1\',3,\'v1\',\'identity-1\',1,1,\'fresh\',\'available\',\'available\',\'none\',\'{"counts":{"ok":1},"samples":[]}\',1700000000,1700000000)')
    const readback = await client.execute('SELECT observation_identity, source_revision, policy_version FROM crawler_availability_current WHERE target_kind = \'movie\' AND target_id = \'movie-1\'')
    expect(readback.rows).toEqual([{ observation_identity: 'identity-1', source_revision: 3, policy_version: 'v1' }])
    const history = await client.execute('SELECT count(*) AS count FROM crawler_availability_observation WHERE task_id = \'task-1\'')
    expect(history.rows[0]?.count).toBe(1)
  })
})
