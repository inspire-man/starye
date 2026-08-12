import { describe, expect, it, vi } from 'vitest'
import { RunnerClient } from '../runner-client'

describe('runnerClient', () => {
  it('uses one serialized payload for the signed poll request', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ candidate: null }), { status: 200 }))
    const client = new RunnerClient({
      apiBaseUrl: 'http://localhost:8080',
      applicationAttempt: 2,
      applicationRunId: 'run-expected',
      callbackKeyId: 'key-1',
      callbackSecret: 'secret',
      fetch: fetch as never,
      providerRunAttempt: 1,
      providerRunId: '77',
    })
    await expect(client.poll()).resolves.toBeUndefined()
    const init = fetch.mock.calls[0]![1] as RequestInit
    expect(init.headers).toMatchObject({ 'x-runner-key-id': 'key-1' })
    expect(init.body).toEqual(expect.any(String))
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(['event_id', 'key_id', 'nonce', 'timestamp'])
  })

  it('rejects a polled candidate that is not bound to the production run tuple', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      candidate: {
        attempt: 1,
        run_id: 'run-other',
        sequence: 1,
        snapshot: {
          entrypoint: 'movie-crawler',
          permissionResource: 'movie',
          templateKey: 'movie',
          templateVersion: 1,
        },
      },
    }), { status: 200 }))
    const client = new RunnerClient({
      apiBaseUrl: 'http://localhost:8080',
      applicationAttempt: 2,
      applicationRunId: 'run-expected',
      callbackKeyId: 'key-1',
      callbackSecret: 'secret',
      fetch: fetch as never,
    })

    await expect(client.poll()).rejects.toThrow('Runner candidate does not match the configured run binding')
  })

  it('sends a signed repair observation and keeps raw source material out of the terminal receipt', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidate: {
          attempt: 1,
          run_id: 'run-repair-1',
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
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accepted: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accepted: true,
        outcome: 'accepted',
        readback: {
          movieId: 'movie-1',
          observedAt: 1_720_000_000,
          sourceRevision: 8,
          sources: [{ eligible: true, health: 'unverified', observedAt: 1_720_000_000, reasonCode: 'source_unverified', sourceType: 'direct' }],
          summary: { eligibleCount: 1, sourceCount: 1 },
        },
        receipt: {
          movieId: 'movie-1',
          observedAt: 1_720_000_000,
          operation: 'repair_players',
          sourceRevision: 8,
          sourceSummary: [{ eligible: true, health: 'unverified', observedAt: 1_720_000_000, reasonCode: 'source_unverified', sourceType: 'direct' }],
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accepted: true }), { status: 200 }))
    const client = new RunnerClient({
      apiBaseUrl: 'http://localhost:8080',
      applicationAttempt: 1,
      applicationRunId: 'run-repair-1',
      callbackKeyId: 'key-1',
      callbackSecret: 'secret',
      fetch: fetch as never,
      now: () => 1_754_000_000_000,
      providerRunAttempt: 1,
      providerRunId: '77',
    })
    const candidate = await client.poll()
    expect(candidate?.snapshot.operation).toBe('repair_players')
    await expect(client.claim(candidate!)).resolves.toMatchObject({ accepted: true })
    await expect(client.observeRepairSource(candidate!, 3, {
      sources: [{ sourceName: 'line-1', sourceType: 'direct', sourceUrl: 'https://source.example/raw.m3u8' }],
    })).resolves.toMatchObject({ accepted: true })
    await client.succeededRepair(candidate!, 4, {
      movieId: 'movie-1',
      observedAt: 1_720_000_000,
      operation: 'repair_players',
      sourceRevision: 8,
      sourceSummary: [{ eligible: true, health: 'unverified', observedAt: 1_720_000_000, reasonCode: 'source_unverified', sourceType: 'direct' }],
    })

    const claimBody = JSON.parse(String((fetch.mock.calls[1]![1] as RequestInit).body)) as Record<string, unknown>
    const observationBody = JSON.parse(String((fetch.mock.calls[2]![1] as RequestInit).body)) as Record<string, unknown>
    const terminalBody = JSON.parse(String((fetch.mock.calls[3]![1] as RequestInit).body)) as Record<string, unknown>
    expect(Object.keys(claimBody).sort()).toEqual(['attempt', 'event_id', 'key_id', 'nonce', 'run_id', 'sequence', 'timestamp'])
    expect(claimBody).toMatchObject({ attempt: 1, run_id: 'run-repair-1', sequence: 2 })
    expect(observationBody).toMatchObject({
      attempt: 1,
      operation: 'repair_players',
      provider_run_attempt: 1,
      provider_run_id: '77',
      run_id: 'run-repair-1',
      sequence: 3,
      source_revision: 7,
      type: 'source_observation',
    })
    expect(observationBody.observed_at).toBe(1_754_000_000)
    expect(observationBody.event_id).toEqual(expect.any(String))
    expect(observationBody.nonce).toEqual(expect.any(String))
    expect(observationBody.timestamp).toBe(1_754_000_000_000)
    expect(JSON.stringify(observationBody)).toContain('https://source.example/raw.m3u8')
    expect(JSON.stringify(terminalBody)).not.toContain('https://source.example/raw.m3u8')
    expect(JSON.stringify(terminalBody)).not.toContain('secret')
    expect(terminalBody).toMatchObject({
      attempt: 1,
      provider_run_attempt: 1,
      provider_run_id: '77',
      receipt: { movieId: 'movie-1', operation: 'repair_players', sourceRevision: 8 },
      run_id: 'run-repair-1',
      sequence: 4,
      source_revision: 7,
      type: 'succeeded',
    })
  })

  it('returns bounded repair observation failures from a controlled non-2xx response', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      accepted: false,
      errorCode: 'source_write_failed',
      outcome: 'source_failed',
      readback: null,
    }), { status: 409 }))
    const client = new RunnerClient({ apiBaseUrl: 'http://localhost:8080', callbackKeyId: 'key-1', callbackSecret: 'secret', fetch: fetch as never })
    const candidate: Parameters<RunnerClient['observeRepairSource']>[0] = {
      attempt: 1,
      runId: 'run-repair-failed',
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

    await expect(client.observeRepairSource(candidate, 3, { sources: [] })).resolves.toMatchObject({
      accepted: false,
      errorCode: 'source_write_failed',
      outcome: 'source_failed',
    })
  })

  it('serializes availability samples to the API evidence shape', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ accepted: true }), { status: 200 }))
    const client = new RunnerClient({
      apiBaseUrl: 'http://localhost:8080',
      callbackKeyId: 'key-1',
      callbackSecret: 'secret',
      fetch: fetch as never,
      providerMode: 'local-proof',
      now: () => 1_754_000_000_000,
    })
    const candidate: Parameters<RunnerClient['observeAvailability']>[0] = {
      attempt: 1,
      contentId: 'movie-1',
      expectedProjectionVersion: 0,
      policyReference: 'dashboard/phase25-gateway-proof',
      policyVersion: 'v1',
      proofProfile: 'phase25-movie-availability-v1',
      provider: 'local-proof',
      runId: 'run-availability-1',
      sequence: 1,
      snapshot: { entrypoint: 'movie-crawler', permissionResource: 'movie', templateKey: 'movie', templateVersion: 1 },
      sourceRevision: 0,
      target: { id: 'movie-1', kind: 'movie' },
      taskId: 'task-availability-1',
    }

    await expect(client.observeAvailability(candidate, 2, {
      freshness: 'fresh',
      nextAction: 'none',
      reasonCode: 'available',
      status: 'available',
      summary: { counts: { available: 1 }, samples: ['movie-1'] },
    })).resolves.toMatchObject({ accepted: true })

    const body = JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body)) as Record<string, unknown>
    expect(body.summary).toEqual({ counts: { available: 1 }, samples: [{ code: 'movie-1' }] })
  })
})
