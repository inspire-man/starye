import type { Client } from '@libsql/client'
import type { Database } from '@starye/db'
import type { Auth } from '../../../lib/auth'
import type { AppEnv } from '../../../types'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import * as schema from '@starye/db/schema'
import { drizzle } from 'drizzle-orm/libsql'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { quantRoutes } from '../index'

const migrationPaths = [
  new URL('../../../../../../packages/db/drizzle/0052_quant_operation.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0053_quant_operation_fee.sql', import.meta.url),
  new URL('../../../../../../packages/db/drizzle/0054_quant_operation_research_context.sql', import.meta.url),
]

async function createDatabase(): Promise<{ client: Client, db: Database }> {
  const client = createClient({ url: 'file::memory:' })
  await client.execute('CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL)')
  await client.execute('INSERT INTO user (id, created_at) VALUES (\'user-1\', 1), (\'user-2\', 2)')
  for (const migrationPath of migrationPaths) {
    const migration = await readFile(fileURLToPath(migrationPath.href), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean))
      await client.execute(statement)
  }
  return { client, db: drizzle(client, { schema }) as unknown as Database }
}

function createApp(db: Database, userId: string | null) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('auth', { api: { getSession: vi.fn().mockResolvedValue(userId ? { user: { id: userId, role: 'user' } } : null) } } as unknown as Auth)
    await next()
  })
  app.route('/api/quant', quantRoutes)
  return app
}

describe('quant operations', () => {
  it('keeps recorded fills and closed-trade stats inside the current user', async () => {
    const { client, db } = await createDatabase()
    const userA = createApp(db, 'user-1')
    const userB = createApp(db, 'user-2')
    const anonymous = createApp(db, null)

    expect((await anonymous.request('/api/quant/operations')).status).toBe(401)

    const buy = await userA.request('/api/quant/operations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '601899.sh', name: '紫金矿业', side: 'buy', price: 29.42, quantity: 100, traded_at: '2026-09-28T07:00:00.000Z' }),
    })
    expect(buy.status).toBe(200)
    const created = await buy.json() as { data: { id: string, tsCode: string } }
    expect(created.data.tsCode).toBe('601899.SH')

    await userA.request('/api/quant/operations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts_code: '601899.SH', side: 'sell', price: 30.42, quantity: 100, traded_at: '2026-09-29T07:00:00.000Z' }),
    })

    const listed = await userA.request('/api/quant/operations')
    const board = await listed.json() as { data: { operations: { id: string }[], ledger: { realizedPnl: number, winRate: number | null, winCount: number, closedCount: number, aiBrief: string } } }
    expect(board.data.operations).toHaveLength(2)
    expect(board.data.ledger).toMatchObject({ realizedPnl: 100, winCount: 1, closedCount: 1, winRate: null })
    expect(board.data.ledger.aiBrief).toContain('不足 6 笔')

    const stored = await client.execute({ sql: 'SELECT user_id, ts_code, side, price, quantity FROM quant_operation WHERE id = ?', args: [created.data.id] })
    expect(stored.rows[0]).toMatchObject({ user_id: 'user-1', ts_code: '601899.SH', side: 'buy', price: 29.42, quantity: 100 })

    expect((await userB.request('/api/quant/operations')).status).toBe(200)
    await expect(userB.request('/api/quant/operations').then(response => response.json())).resolves.toMatchObject({ data: { operations: [] } })
    expect((await userB.request(`/api/quant/operations/${created.data.id}`, { method: 'DELETE' })).status).toBe(404)

    expect((await userA.request(`/api/quant/operations/${created.data.id}`, { method: 'DELETE' })).status).toBe(200)
    const afterDelete = await client.execute('SELECT count(*) AS count FROM quant_operation WHERE user_id = \'user-1\'')
    expect(afterDelete.rows[0]).toMatchObject({ count: 1 })
  })
})
