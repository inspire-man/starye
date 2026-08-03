import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { createCrawlerTaskLogCleanupHandler, createCrawlerTaskScheduledHandler } from '../index'

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

  it('runs cleanup, expired-run sweep, and provider reconciliation in one scheduled batch', async () => {
    const cleanup = vi.fn(async () => 7)
    const sweep = vi.fn(async () => ['run-expired'])
    const reconcile = vi.fn(async () => ({ observed: 1 }))
    const waitUntil = vi.fn()
    const handler = createCrawlerTaskScheduledHandler(cleanup, sweep, reconcile)
    const env = { DB: {} }

    handler({}, env as never, { waitUntil })

    expect(cleanup).toHaveBeenCalledWith(env, expect.any(Date))
    expect(sweep).toHaveBeenCalledWith(env, expect.any(Date))
    expect(reconcile).toHaveBeenCalledWith(env, expect.any(Date))
    expect(waitUntil).toHaveBeenCalledOnce()
    await expect(waitUntil.mock.calls[0]?.[0]).resolves.toEqual([
      { status: 'fulfilled', value: 7 },
      { status: 'fulfilled', value: ['run-expired'] },
      { status: 'fulfilled', value: { observed: 1 } },
    ])
  })

  it('configures a daily cron trigger for the repository-scoped cleanup', async () => {
    const wrangler = await readFile(new URL('../../wrangler.toml', import.meta.url), 'utf8')
    const cron = wrangler.match(/^crons\s*=\s*\["([^"]+)"\]/mu)?.[1]?.trim().split(/\s+/u)

    expect(cron).toHaveLength(5)
    expect(cron?.slice(2)).toEqual(['*', '*', '*'])
  })
})
