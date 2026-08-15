import { describe, expect, it, vi } from 'vitest'
import {
  ActionsEventClient,
  createActionsEventClientFromEnvironment,
  createScheduleRegisterActionsEventClientFromEnvironment,
} from '../actions-event-client'

const baseConfig = {
  apiBaseUrl: 'https://gateway.example.test',
  callbackKeyId: 'actions-key',
  callbackSecret: 'actions-secret',
  environment: 'starye-org' as const,
  ref: 'main' as const,
  repository: 'inspire-man/starye' as const,
  target: 'starye-org' as const,
  template: 'movie' as const,
  workflow: '.github/workflows/daily-movie-crawl.yml' as const,
  now: () => 1_754_000_000_000,
}

function response(status: number, body: unknown = { accepted: true }) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const scheduleEnvironment: NodeJS.ProcessEnv = {
  ACTIONS_CALLBACK_API_BASE_URL: 'https://gateway.example.test',
  ACTIONS_PROVIDER_ENVIRONMENT: 'starye-org',
  ACTIONS_PROVIDER_REF: 'main',
  ACTIONS_PROVIDER_REPOSITORY: 'inspire-man/starye',
  ACTIONS_PROVIDER_TARGET: 'starye-org',
  ACTIONS_PROVIDER_TEMPLATE: 'movie',
  ACTIONS_PROVIDER_WORKFLOW: '.github/workflows/daily-movie-crawl.yml',
  TASK_RUNNER_CALLBACK_KEY_ID_CURRENT: 'actions-key',
  TASK_RUNNER_CALLBACK_SECRET_CURRENT: 'actions-secret',
}

describe('actionsEventClient', () => {
  it('loads schedule registration credentials before the control plane allocates an application binding', () => {
    expect(() => createScheduleRegisterActionsEventClientFromEnvironment(scheduleEnvironment)).not.toThrow()
    expect(() => createActionsEventClientFromEnvironment(scheduleEnvironment)).toThrow('Missing Actions callback environment: ACTIONS_APPLICATION_ATTEMPT')
  })

  it('serializes a deterministic signed schedule envelope with fixed provider identity', async () => {
    const fetch = vi.fn(async () => response(200, { accepted: true, run_id: 'run-1', attempt: 1 }))
    const client = new ActionsEventClient({ ...baseConfig, fetch })

    await client.scheduleRegister({ scheduledAt: '2026-07-30T00:00:00.000Z', scheduleBucket: '2026-07-30T00:00Z' })

    const request = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]
    const payload = JSON.parse(String(request.body)) as Record<string, unknown>
    expect(payload).toMatchObject({
      event_id: expect.any(String),
      environment: 'starye-org',
      key_id: 'actions-key',
      nonce: expect.any(String),
      ref: 'main',
      repository: 'inspire-man/starye',
      schedule_bucket: '2026-07-30T00:00Z',
      timestamp: 1_754_000_000_000,
      target: 'starye-org',
      template: 'movie',
      type: 'schedule_register',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })
    expect(Object.keys(payload).sort()).toEqual([
      'environment',
      'event_id',
      'key_id',
      'nonce',
      'ref',
      'repository',
      'schedule_bucket',
      'scheduled_at',
      'target',
      'template',
      'timestamp',
      'type',
      'workflow',
    ].sort())
    expect(request.headers).toMatchObject({
      'x-runner-key-id': 'actions-key',
    })
    expect(String(request.headers && (request.headers as Record<string, string>)['x-runner-signature'])).not.toContain('actions-secret')
  })

  it('retries schedule registration on timeout and 5xx, but stops on identity errors', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new DOMException('timed out', 'AbortError'))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(400, { reason: 'provider_mismatch' }))
    const client = new ActionsEventClient({ ...baseConfig, fetch, retryDelaysMs: [0, 0] })

    await expect(client.scheduleRegister({ scheduledAt: '2026-07-30T00:00:00.000Z', scheduleBucket: '2026-07-30T00:00Z' })).rejects.toThrow('Actions callback request failed: 400')
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('propagates cancel_requested from heartbeat/progress and signs terminal receipt events', async () => {
    const fetch = vi.fn(async () => response(200, { accepted: true, cancel_requested: true }))
    const client = new ActionsEventClient({ ...baseConfig, fetch, runId: 'run-1', attempt: 2, providerRunId: '77', providerRunAttempt: 1, sha: 'a'.repeat(40) })

    await expect(client.progress(4, { fetched: 2 })).resolves.toEqual({ accepted: true, cancel_requested: true })
    await client.succeeded(5, ['MOV-1'])

    const progress = JSON.parse(String(((fetch.mock.calls[0] as unknown as [string, RequestInit])[1]).body)) as Record<string, unknown>
    const terminal = JSON.parse(String(((fetch.mock.calls[1] as unknown as [string, RequestInit])[1]).body)) as Record<string, unknown>
    expect(progress).toMatchObject({
      attempt: 2,
      provider_run_attempt: 1,
      provider_run_id: '77',
      run_id: 'run-1',
      sequence: 4,
      type: 'progress',
    })
    expect(terminal).toMatchObject({
      provider_run_attempt: 1,
      provider_run_id: '77',
      receipt: { contentIds: ['MOV-1'], templateKey: 'movie' },
      run_id: 'run-1',
      type: 'succeeded',
    })
  })
})
