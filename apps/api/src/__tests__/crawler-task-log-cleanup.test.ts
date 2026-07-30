import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { createCrawlerTaskLogCleanupHandler } from '../index'

describe('crawler task log cleanup schedule', () => {
  it('delegates one detailed-log cleanup through waitUntil without direct task/run mutation', async () => {
    const cleanup = vi.fn(async () => 7)
    const waitUntil = vi.fn()
    const handler = createCrawlerTaskLogCleanupHandler(cleanup)
    const env = { DB: {} }

    handler({}, env as never, { waitUntil })

    expect(cleanup).toHaveBeenCalledOnce()
    expect(cleanup).toHaveBeenCalledWith(env, expect.any(Date))
    expect(waitUntil).toHaveBeenCalledOnce()
    await expect(waitUntil.mock.calls[0]?.[0]).resolves.toBe(7)
  })

  it('configures a daily cron trigger for the repository-scoped cleanup', async () => {
    const wrangler = await readFile(new URL('../../wrangler.toml', import.meta.url), 'utf8')
    const cron = wrangler.match(/^crons\s*=\s*\["([^"]+)"\]/mu)?.[1]?.trim().split(/\s+/u)

    expect(cron).toHaveLength(5)
    expect(cron?.slice(2)).toEqual(['*', '*', '*'])
  })
})
