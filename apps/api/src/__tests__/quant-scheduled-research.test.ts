import { describe, expect, it, vi } from 'vitest'
import { createQuantScheduledResearchHandler } from '../routes/quant/handlers/scheduled-research-runtime'

describe('quant scheduled research handler', () => {
  it('runs the Quant tick through waitUntil without blocking crawler cleanup', async () => {
    const run = vi.fn(async () => ({ processedCount: 1 }))
    const waitUntil = vi.fn()
    const handler = createQuantScheduledResearchHandler(run)

    handler({}, { DB: {} } as never, { waitUntil })

    expect(waitUntil).toHaveBeenCalledOnce()
    await expect(waitUntil.mock.calls[0]?.[0]).resolves.toEqual({ processedCount: 1 })
    expect(run).toHaveBeenCalledOnce()
  })
})
