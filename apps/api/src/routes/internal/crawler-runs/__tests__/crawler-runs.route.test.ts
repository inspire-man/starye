import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { base64UrlEncode } from '../../../../domain/crawler-tasks/runner-event-auth'
import { createCrawlerRunsRoutes } from '../index'

const NOW = new Date('2026-07-30T00:00:00.000Z').getTime()

async function signedRequest(body: string) {
  const bytes = new TextEncoder().encode(body)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('runner-secret'), { hash: 'SHA-256', name: 'HMAC' }, false, ['sign'])
  return base64UrlEncode(await crypto.subtle.sign('HMAC', key, bytes))
}

function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    attempt: 1,
    event_id: 'event-1',
    key_id: 'key-current',
    nonce: 'nonce-1',
    run_id: 'run-1',
    sequence: 2,
    timestamp: NOW,
    type: 'heartbeat',
    ...overrides,
  }
}

function createProcessor(result: unknown = { kind: 'accepted', outcome: { outcome: 'accepted' } }) {
  return {
    claimDispatch: vi.fn(async () => ({
      currentStatus: 'queued',
      kind: 'transition',
      nextStateVersion: 1,
      nextStatus: 'dispatching',
      reasonCode: 'dispatch_claimed',
      releaseLease: false,
    })),
    getRun: vi.fn(async () => ({ status: 'running' })),
    pollDispatch: vi.fn(async () => ({
      attempt: 1,
      runId: 'run-1',
      sequence: 1,
      snapshot: {
        entrypoint: 'movie-crawler',
        permissionResource: 'movie',
        templateKey: 'movie',
        templateVersion: 1,
      },
    })),
    processRunnerEvent: vi.fn(async () => result),
  }
}

function createApp(processor = createProcessor()) {
  const app = new Hono<any>()
  app.use('*', async (c, next) => {
    c.env = {
      TASK_RUNNER_CALLBACK_KEY_ID_CURRENT: 'key-current',
      TASK_RUNNER_CALLBACK_SECRET_CURRENT: 'runner-secret',
    }
    c.set('db', {})
    await next()
  })
  app.route('/crawler-runs', createCrawlerRunsRoutes({
    createRepository: () => processor as never,
    now: () => NOW,
  }))
  return app
}

async function postEvent(app: Hono<any>, event: Record<string, unknown>, pathRunId = 'run-1') {
  const body = JSON.stringify(event)
  return postSigned(app, `/crawler-runs/${pathRunId}/events`, body)
}

async function postSigned(app: Hono<any>, path: string, body: string) {
  return app.request(path, {
    body,
    headers: {
      'content-type': 'application/json',
      'x-runner-key-id': 'key-current',
      'x-runner-signature': await signedRequest(body),
    },
    method: 'POST',
  })
}

function createControlEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'control-event-1',
    key_id: 'key-current',
    nonce: 'control-nonce-1',
    timestamp: NOW,
    ...overrides,
  }
}

describe('signed crawler runner event route', () => {
  it('rejects an unsigned payload before parsing the event envelope', async () => {
    const processor = createProcessor()
    const response = await createApp(processor).request('/crawler-runs/run-1/events', {
      body: '{not-json',
      headers: { 'x-runner-key-id': 'key-current', 'x-runner-signature': 'invalid' },
      method: 'POST',
    })

    expect(response.status).toBe(401)
    expect(processor.processRunnerEvent).not.toHaveBeenCalled()
  })

  it('accepts a current-key signed, fresh strict heartbeat envelope and delegates its bound transition', async () => {
    const processor = createProcessor()
    const response = await postEvent(createApp(processor), createEvent())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ cancel_requested: false, outcome: 'accepted' })
    expect(processor.processRunnerEvent).toHaveBeenCalledWith(expect.objectContaining({
      attempt: 1,
      event: expect.objectContaining({ sequence: 2, type: 'runner_heartbeat' }),
      eventId: 'event-1',
      nonce: 'nonce-1',
      runId: 'run-1',
      sequence: 2,
    }))
  })

  it('rejects path/body, timestamp, attempt, and receipt-template binding failures before any state mutation', async () => {
    const processor = createProcessor({ kind: 'attempt_mismatch' })
    const app = createApp(processor)

    const pathMismatch = await postEvent(app, createEvent({ run_id: 'run-other' }))
    const stale = await postEvent(app, createEvent({ event_id: 'event-2', nonce: 'nonce-2', timestamp: NOW - 5 * 60_000 - 1 }))
    const attemptMismatch = await postEvent(app, createEvent({ event_id: 'event-3', nonce: 'nonce-3', attempt: 2 }))

    expect(pathMismatch.status).toBe(400)
    expect(stale.status).toBe(400)
    expect(attemptMismatch.status).toBe(400)
    expect(processor.processRunnerEvent).toHaveBeenCalledTimes(1)
  })

  it('returns the stored result for an identical replay and rejects conflicting event or nonce replays', async () => {
    const duplicate = createProcessor({ kind: 'duplicate', outcome: { outcome: 'accepted' } })
    const duplicateResponse = await postEvent(createApp(duplicate), createEvent())
    expect(duplicateResponse.status).toBe(200)
    await expect(duplicateResponse.json()).resolves.toEqual({ cancel_requested: false, outcome: 'accepted' })

    const conflict = createProcessor({ kind: 'conflict' })
    const conflictResponse = await postEvent(createApp(conflict), createEvent())
    expect(conflictResponse.status).toBe(409)
  })

  it('requires a template-compatible terminal receipt without accepting receipts on nonterminal events', async () => {
    const mismatch = createProcessor({ kind: 'receipt_template_mismatch' })
    const success = await postEvent(createApp(mismatch), createEvent({
      event_id: 'event-success',
      nonce: 'nonce-success',
      receipt: { contentIds: ['content-1'], templateKey: 'manga' },
      sequence: 3,
      type: 'succeeded',
    }))
    const heartbeatWithReceipt = await postEvent(createApp(), createEvent({
      event_id: 'event-heartbeat',
      nonce: 'nonce-heartbeat',
      receipt: { contentIds: ['content-1'], templateKey: 'movie' },
    }))

    expect(success.status).toBe(400)
    expect(heartbeatWithReceipt.status).toBe(400)
  })
})

describe('signed crawler runner poll and claim routes', () => {
  it('keeps poll read-only and returns only an API-owned candidate snapshot', async () => {
    const processor = createProcessor()
    const app = createApp(processor)
    const accepted = await postSigned(app, '/crawler-runs/poll', JSON.stringify(createControlEnvelope()))
    const surplus = await postSigned(app, '/crawler-runs/poll', JSON.stringify(createControlEnvelope({
      command: 'node arbitrary.js',
      event_id: 'control-event-2',
      nonce: 'control-nonce-2',
      source_url: 'https://untrusted.example',
      workflow: 'dispatch-anything',
    })))

    expect(accepted.status).toBe(200)
    await expect(accepted.json()).resolves.toEqual({
      candidate: {
        attempt: 1,
        run_id: 'run-1',
        sequence: 1,
        snapshot: {
          entrypoint: 'movie-crawler',
          permissionResource: 'movie',
          templateKey: 'movie',
          templateVersion: 1,
        },
      },
    })
    expect(surplus.status).toBe(400)
    expect(processor.pollDispatch).toHaveBeenCalledTimes(1)
  })

  it('binds a signed claim to API run/attempt/sequence and returns the actual CAS decision', async () => {
    const processor = createProcessor()
    processor.claimDispatch.mockResolvedValueOnce({
      currentStatus: 'dispatching',
      kind: 'stale',
      reasonCode: 'stale_event',
      sequence: 1,
    })
    const response = await postSigned(processor && createApp(processor), '/crawler-runs/run-1/claim', JSON.stringify(createControlEnvelope({
      attempt: 1,
      run_id: 'run-1',
      sequence: 1,
    })))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ accepted: false, reason: 'stale_event' })
    expect(processor.claimDispatch).toHaveBeenCalledWith(expect.objectContaining({
      attempt: 1,
      eventId: 'control-event-1',
      nonce: 'control-nonce-1',
      runId: 'run-1',
      sequence: 1,
    }))
  })

  it('rejects tampered, expired, unknown-key, foreign-attempt, and conflicting claim envelopes without a lifecycle callback', async () => {
    const processor = createProcessor()
    processor.claimDispatch.mockResolvedValueOnce({
      currentStatus: 'dispatching',
      kind: 'rejected',
      reasonCode: 'invalid_transition',
    })
    processor.claimDispatch.mockResolvedValueOnce({ kind: 'conflict' })
    const app = createApp(processor)
    const tamperedBody = JSON.stringify(createControlEnvelope({ attempt: 1, run_id: 'run-1', sequence: 1 }))
    const tampered = await app.request('/crawler-runs/run-1/claim', {
      body: tamperedBody.replace('run-1', 'run-2'),
      headers: {
        'content-type': 'application/json',
        'x-runner-key-id': 'key-current',
        'x-runner-signature': await signedRequest(tamperedBody),
      },
      method: 'POST',
    })
    const expired = await postSigned(app, '/crawler-runs/run-1/claim', JSON.stringify(createControlEnvelope({
      attempt: 1,
      event_id: 'claim-expired',
      nonce: 'claim-expired',
      run_id: 'run-1',
      sequence: 1,
      timestamp: NOW - 5 * 60_000 - 1,
    })))
    const unknownKey = await app.request('/crawler-runs/run-1/claim', {
      body: JSON.stringify(createControlEnvelope({ attempt: 1, run_id: 'run-1', sequence: 1 })),
      headers: {
        'content-type': 'application/json',
        'x-runner-key-id': 'unknown-key',
        'x-runner-signature': 'invalid',
      },
      method: 'POST',
    })
    const foreignAttempt = await postSigned(app, '/crawler-runs/run-1/claim', JSON.stringify(createControlEnvelope({
      attempt: 2,
      event_id: 'claim-foreign-attempt',
      nonce: 'claim-foreign-attempt',
      run_id: 'run-1',
      sequence: 1,
    })))
    const conflict = await postSigned(app, '/crawler-runs/run-1/claim', JSON.stringify(createControlEnvelope({
      attempt: 1,
      event_id: 'control-event-1',
      nonce: 'different-nonce',
      run_id: 'run-1',
      sequence: 1,
    })))

    expect([tampered.status, expired.status, unknownKey.status, foreignAttempt.status, conflict.status]).toEqual([401, 400, 401, 409, 409])
    expect(processor.processRunnerEvent).not.toHaveBeenCalled()
    expect(processor.claimDispatch).toHaveBeenCalledTimes(2)
  })
})
