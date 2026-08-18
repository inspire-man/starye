import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../../drizzle/0032_crawler_schedule_service_user.sql', import.meta.url)

async function applyMigration(client: ReturnType<typeof createClient>): Promise<string> {
  const migration = await readFile(fileURLToPath(migrationPath.href), 'utf8')
  await client.execute(migration)
  return migration
}

describe('crawler schedule service user migration', () => {
  it('creates the stable task owner and remains idempotent', async () => {
    const client = createClient({ url: 'file::memory:' })
    await client.execute(`
      CREATE TABLE user (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        email_verified INTEGER NOT NULL,
        role TEXT DEFAULT 'user' NOT NULL,
        is_adult INTEGER DEFAULT 0,
        is_r18_verified INTEGER DEFAULT 0 NOT NULL,
        image TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    const migration = await applyMigration(client)
    await applyMigration(client)

    const result = await client.execute(`
      SELECT id, name, email, email_verified, role, is_adult, is_r18_verified
      FROM user
      WHERE id = 'github-actions-schedule'
    `)
    expect(result.rows).toEqual([{
      id: 'github-actions-schedule',
      name: 'GitHub Actions',
      email: 'github-actions@starye.invalid',
      email_verified: 1,
      role: 'user',
      is_adult: 0,
      is_r18_verified: 0,
    }])
    expect(migration).not.toMatch(/secret|token|password/iu)
  })
})

