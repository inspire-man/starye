import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'

const limitKeys = ['CRAWLER_MAX_MANGAS', 'CRAWLER_MAX_CHAPTERS_NEW', 'CRAWLER_MAX_CHAPTERS_UPDATE'] as const
const originalValues = new Map<string, string | undefined>()

afterEach(() => {
  for (const key of limitKeys) {
    const value = originalValues.get(key)
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
  }
  originalValues.clear()
})

describe('manga crawler batch limits', () => {
  it('defaults mangas and chapter batches to ten', async () => {
    for (const key of limitKeys) {
      originalValues.set(key, process.env[key])
      delete process.env[key]
    }

    vi.resetModules()
    const { loadCrawlConfig } = await import('../crawl.config')
    const config = loadCrawlConfig()

    expect(config.limits).toMatchObject({
      maxMangasPerRun: 10,
      maxChaptersPerNew: 10,
      maxChaptersPerUpdate: 10,
    })
  })
})
