import { describe, expect, it, vi } from 'vitest'
import { RunnerClient } from '../runner-client'

describe('runnerClient', () => {
  it('uses one serialized payload for the signed poll request', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ candidate: null }), { status: 200 }))
    const client = new RunnerClient({ apiBaseUrl: 'http://localhost:8080', callbackKeyId: 'key-1', callbackSecret: 'secret', fetch: fetch as never })
    await expect(client.poll()).resolves.toBeUndefined()
    const init = fetch.mock.calls[0]![1] as RequestInit
    expect(init.headers).toMatchObject({ 'x-runner-key-id': 'key-1' })
    expect(init.body).toEqual(expect.any(String))
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
    const client = new RunnerClient({ apiBaseUrl: 'http://localhost:8080', callbackKeyId: 'key-1', callbackSecret: 'secret', fetch: fetch as never })
    const candidate = await client.poll()
    expect(candidate?.snapshot.operation).toBe('repair_players')
    await expect(client.observeRepairSource(candidate!, 3, {
      observedAt: 1_720_000_000,
      sources: [{ sourceName: 'line-1', sourceType: 'direct', sourceUrl: 'https://source.example/raw.m3u8' }],
    })).resolves.toMatchObject({ accepted: true })
    await client.succeededRepair(candidate!, 4, {
      movieId: 'movie-1',
      observedAt: 1_720_000_000,
      operation: 'repair_players',
      sourceRevision: 8,
      sourceSummary: [{ eligible: true, health: 'unverified', observedAt: 1_720_000_000, reasonCode: 'source_unverified', sourceType: 'direct' }],
    })

    const observationBody = JSON.parse(String((fetch.mock.calls[1]![1] as RequestInit).body)) as Record<string, unknown>
    const terminalBody = JSON.parse(String((fetch.mock.calls[2]![1] as RequestInit).body)) as Record<string, unknown>
    expect(observationBody).toMatchObject({ operation: 'repair_players', source_revision: 7, type: 'source_observation' })
    expect(JSON.stringify(observationBody)).toContain('https://source.example/raw.m3u8')
    expect(JSON.stringify(terminalBody)).not.toContain('https://source.example/raw.m3u8')
    expect(JSON.stringify(terminalBody)).not.toContain('secret')
    expect(terminalBody).toMatchObject({ receipt: { movieId: 'movie-1', operation: 'repair_players', sourceRevision: 8 } })
  })
})
