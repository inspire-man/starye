import type { RunnerCandidate } from '../runner-client'
import { describe, expect, it, vi } from 'vitest'
import { createLocalProofAdapter } from '../local-proof-adapter'
import { LocalTaskRunner } from '../local-runner'

const candidate: RunnerCandidate = {
  attempt: 1,
  runId: 'run-1',
  sequence: 1,
  snapshot: { entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 },
}

const repairCandidate: RunnerCandidate = {
  attempt: 1,
  runId: 'repair-run-1',
  sequence: 2,
  snapshot: {
    entrypoint: 'movie-crawler',
    movieId: 'movie-1',
    operation: 'repair_players',
    permissionResource: 'movie',
    reason: 'no_source',
    sourceRevision: 7,
    targetIntent: 'restore_playable_sources',
    templateKey: 'movie',
    templateVersion: 1,
  },
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

  it('requires a dedicated repair receipt before sending a repair success event', async () => {
    const client = {
      cancelled: vi.fn(),
      claim: vi.fn().mockResolvedValue({ accepted: true }),
      failed: vi.fn(),
      heartbeat: vi.fn().mockResolvedValue({ accepted: true }),
      poll: vi.fn().mockResolvedValue(repairCandidate),
      succeeded: vi.fn(),
      succeededRepair: vi.fn(),
    }
    const receipt = {
      movieId: 'movie-1',
      observedAt: 1_720_000_000,
      operation: 'repair_players' as const,
      sourceRevision: 7,
      sourceSummary: [{
        eligible: true,
        health: 'unverified' as const,
        observedAt: 1_720_000_000,
        reasonCode: 'source_unverified' as const,
        sourceType: 'direct' as const,
      }],
    }
    const runner = new LocalTaskRunner({
      adapters: { select: () => ({
        execute: async () => ({ contentIds: [], repairReceipt: receipt }),
        operation: 'repair_players' as const,
        templateKey: 'movie' as const,
      }) },
      client: client as never,
    })

    await runner.runOnce()

    expect(client.succeededRepair).toHaveBeenCalledWith(repairCandidate, 4, receipt)
    expect(client.succeeded).not.toHaveBeenCalled()
    expect(client.failed).not.toHaveBeenCalled()
  })

  it('fails a repair run with a bounded receipt_missing result when readback is absent', async () => {
    const client = {
      cancelled: vi.fn(),
      claim: vi.fn().mockResolvedValue({ accepted: true }),
      failed: vi.fn(),
      heartbeat: vi.fn().mockResolvedValue({ accepted: true }),
      poll: vi.fn().mockResolvedValue(repairCandidate),
      succeeded: vi.fn(),
      succeededRepair: vi.fn(),
    }
    const runner = new LocalTaskRunner({
      adapters: { select: () => ({
        execute: async () => ({ contentIds: ['raw-runner-content-id'] }),
        operation: 'repair_players' as const,
        templateKey: 'movie' as const,
      }) },
      client: client as never,
    })

    await runner.runOnce()

    expect(client.failed).toHaveBeenCalledWith(repairCandidate, 4, 'receipt_missing')
    expect(client.succeededRepair).not.toHaveBeenCalled()
  })

  it('sends a bounded local-proof availability observation after the ordinary receipt', async () => {
    const localCandidate: RunnerCandidate = {
      attempt: 1,
      contentId: 'movie-1',
      expectedProjectionVersion: 0,
      policyReference: 'dashboard/phase25-gateway-proof',
      policyVersion: 'v1',
      proofProfile: 'phase25-movie-availability-v1',
      provider: 'local-proof',
      runId: 'local-run-1',
      sequence: 1,
      snapshot: { entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 },
      sourceRevision: 0,
      target: { id: 'movie-1', kind: 'movie' },
      taskId: 'task-1',
    }
    const client = {
      claim: vi.fn().mockResolvedValue({ accepted: true }),
      failed: vi.fn(),
      heartbeat: vi.fn().mockResolvedValue({ accepted: true }),
      observeAvailability: vi.fn().mockResolvedValue({ accepted: true }),
      poll: vi.fn().mockResolvedValue(localCandidate),
      succeeded: vi.fn().mockResolvedValue({ accepted: true }),
    }
    const runner = new LocalTaskRunner({
      adapters: { select: () => createLocalProofAdapter({ now: () => 1_720_000_000_000 }) },
      client: client as never,
    })

    await runner.runOnce()

    expect(client.succeeded).toHaveBeenCalledWith(localCandidate, 4, ['movie-1'])
    expect(client.observeAvailability).toHaveBeenCalledTimes(5)
    expect(client.observeAvailability).toHaveBeenNthCalledWith(1, localCandidate, 5, expect.objectContaining({
      observationIdentity: 'local-proof:local-run-1:accepted',
      reasonCode: 'available',
      status: 'available',
    }))
    expect(client.observeAvailability).toHaveBeenNthCalledWith(2, localCandidate, 5, expect.objectContaining({
      observationIdentity: 'local-proof:local-run-1:accepted',
      reasonCode: 'available',
      status: 'available',
    }))
    expect(client.observeAvailability.mock.calls.at(-1)?.[1]).toBe(localCandidate.sequence)
    expect(client.failed).not.toHaveBeenCalled()
  })

  it('uses the pending adapter sequence when a repair observation fails before terminal acknowledgement', async () => {
    const client = {
      cancelled: vi.fn(),
      claim: vi.fn().mockResolvedValue({ accepted: true }),
      failed: vi.fn(),
      heartbeat: vi.fn().mockResolvedValue({ accepted: true }),
      poll: vi.fn().mockResolvedValue(repairCandidate),
      succeeded: vi.fn(),
      succeededRepair: vi.fn(),
    }
    const runner = new LocalTaskRunner({
      adapters: { select: () => ({
        execute: async ({ nextSequence }) => {
          nextSequence?.()
          throw new Error('source observation failed')
        },
        operation: 'repair_players' as const,
        templateKey: 'movie' as const,
      }) },
      client: client as never,
    })

    await runner.runOnce()

    expect(client.failed).toHaveBeenCalledWith(repairCandidate, 3, 'runner_failed')
    expect(client.succeededRepair).not.toHaveBeenCalled()
  })
})
