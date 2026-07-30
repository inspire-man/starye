import type { RunnerCandidate } from '../runner-client'
import { describe, expect, it, vi } from 'vitest'
import { LocalTaskRunner } from '../local-runner'

const candidate: RunnerCandidate = {
  attempt: 1,
  runId: 'run-1',
  sequence: 1,
  snapshot: { entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 },
}

describe('localTaskRunner', () => {
  it('keeps exactly one active run and does not poll again until terminal acknowledgement', async () => {
    const poll = vi.fn().mockResolvedValueOnce(candidate).mockResolvedValue(undefined)
    const client = {
      cancelled: vi.fn(),
      claim: vi.fn().mockResolvedValue({ accepted: true }),
      failed: vi.fn(),
      heartbeat: vi.fn().mockResolvedValue({ accepted: true }),
      poll,
      succeeded: vi.fn(),
    }
    let resolveExecution!: () => void
    const execution = new Promise<void>((resolve) => {
      resolveExecution = resolve
    })
    const runner = new LocalTaskRunner({
      adapters: { select: () => ({
        execute: async () => {
          await execution
          return { contentIds: ['movie-1'] }
        },
        templateKey: 'movie',
      }) },
      client: client as never,
    })
    const running = runner.runOnce()
    await Promise.resolve()
    await runner.runOnce()
    expect(poll).toHaveBeenCalledTimes(1)
    resolveExecution()
    await running
    expect(client.succeeded).toHaveBeenCalledTimes(1)
  })

  it('reports cooperative cancellation without a success receipt', async () => {
    const client = {
      cancelled: vi.fn(),
      claim: vi.fn().mockResolvedValue({ accepted: true }),
      failed: vi.fn(),
      heartbeat: vi.fn().mockResolvedValue({ accepted: true, cancel_requested: true }),
      poll: vi.fn().mockResolvedValue(candidate),
      succeeded: vi.fn(),
    }
    const runner = new LocalTaskRunner({
      adapters: { select: () => ({
        execute: async ({ checkpoint }) => {
          await checkpoint()
          return { contentIds: ['movie-1'] }
        },
        templateKey: 'movie',
      }) },
      client: client as never,
    })
    await runner.runOnce()
    expect(client.cancelled).toHaveBeenCalledTimes(1)
    expect(client.succeeded).not.toHaveBeenCalled()
  })
})
