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
})
