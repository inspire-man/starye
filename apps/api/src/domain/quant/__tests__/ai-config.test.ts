import type { Database } from '@starye/db'
import { createClient } from '@libsql/client'
import * as schema from '@starye/db/schema'
import { drizzle } from 'drizzle-orm/libsql'
import { describe, expect, it } from 'vitest'
import { deleteQuantAiConfig, getDecryptedQuantAiConfig, getQuantAiConfig, saveQuantAiConfig } from '../ai-config'

async function createDatabase(): Promise<{ client: ReturnType<typeof createClient>, db: Database }> {
  const client = createClient({ url: 'file::memory:' })
  await client.execute('PRAGMA foreign_keys = ON')
  await client.execute('CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL)')
  await client.execute('INSERT INTO user (id) VALUES (\'user-1\'), (\'user-2\')')
  await client.execute(`
    CREATE TABLE quant_ai_config (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      base_url TEXT,
      response_mode TEXT NOT NULL DEFAULT 'stream',
      generation_timeout_ms INTEGER NOT NULL DEFAULT 300000,
      encrypted_api_key TEXT,
      api_key_hint TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  return { client, db: drizzle(client, { schema }) as unknown as Database }
}

describe('quant AI config', () => {
  it('stores encrypted keys per user and preserves them on metadata updates', async () => {
    const { client, db } = await createDatabase()
    const first = await saveQuantAiConfig(db, {
      userId: 'user-1',
      provider: 'openai_compatible',
      model: 'gpt-5.5',
      baseUrl: 'https://ai.example.test/v1',
      responseMode: 'json',
      generationTimeoutMs: 600000,
      apiKey: 'sk-user-one-1234',
    }, 'test-encryption-secret')

    expect(first).toMatchObject({
      provider: 'openai_compatible',
      model: 'gpt-5.5',
      baseUrl: 'https://ai.example.test/v1',
      responseMode: 'json',
      generationTimeoutMs: 600000,
      hasApiKey: true,
      apiKeyHint: '1234',
    })
    expect(first).not.toHaveProperty('apiKey')

    const stored = await client.execute('SELECT encrypted_api_key FROM quant_ai_config WHERE user_id = \'user-1\'')
    expect(stored.rows[0]?.encrypted_api_key).toEqual(expect.stringMatching(/^v1:/u))
    expect(stored.rows[0]?.encrypted_api_key).not.toContain('sk-user-one-1234')

    await expect(getQuantAiConfig(db, 'user-2')).resolves.toBeNull()
    await expect(getDecryptedQuantAiConfig(db, 'user-1', 'test-encryption-secret')).resolves.toMatchObject({
      apiKey: 'sk-user-one-1234',
    })

    const updated = await saveQuantAiConfig(db, {
      userId: 'user-1',
      provider: 'deepseek',
      model: 'deepseek-chat',
    }, 'test-encryption-secret')
    expect(updated).toMatchObject({ provider: 'deepseek', model: 'deepseek-chat', responseMode: 'json', generationTimeoutMs: 600000, hasApiKey: true, apiKeyHint: '1234' })
  })

  it('rejects unsupported response modes and out-of-range generation budgets', async () => {
    const { db } = await createDatabase()
    await expect(saveQuantAiConfig(db, { userId: 'user-1', provider: 'ollama', model: 'qwen3', responseMode: 'sse' }, 'test-encryption-secret')).rejects.toMatchObject({ code: 'QUANT_AI_CONFIGURATION', status: 400 })
    await expect(saveQuantAiConfig(db, { userId: 'user-1', provider: 'ollama', model: 'qwen3', generationTimeoutMs: 120000 }, 'test-encryption-secret')).rejects.toMatchObject({ code: 'QUANT_AI_CONFIGURATION', status: 400 })
  })

  it('clears a key explicitly and rejects new keys without the encryption secret', async () => {
    const { client, db } = await createDatabase()
    await expect(saveQuantAiConfig(db, {
      userId: 'user-1',
      provider: 'ollama',
      model: 'qwen3',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'local-key',
    })).rejects.toMatchObject({ code: 'QUANT_AI_CONFIGURATION', status: 503 })
    await expect(client.execute('SELECT count(*) AS count FROM quant_ai_config')).resolves.toMatchObject({ rows: [{ count: 0 }] })

    await saveQuantAiConfig(db, {
      userId: 'user-1',
      provider: 'openai_compatible',
      model: 'gpt-5.5',
      apiKey: 'sk-user-one-1234',
    }, 'test-encryption-secret')
    const cleared = await saveQuantAiConfig(db, {
      userId: 'user-1',
      provider: 'openai_compatible',
      model: 'gpt-5.5',
      clearApiKey: true,
    }, 'test-encryption-secret')
    expect(cleared).toMatchObject({ hasApiKey: false, apiKeyHint: null })
    await expect(deleteQuantAiConfig(db, 'user-1')).resolves.toBe(true)
    await expect(getQuantAiConfig(db, 'user-1')).resolves.toBeNull()
  })
})
