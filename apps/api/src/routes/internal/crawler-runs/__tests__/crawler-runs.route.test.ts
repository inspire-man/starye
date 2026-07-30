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
  return { processRunnerEvent: vi.fn(async () => result) }
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
  return app.request(`/crawler-runs/${pathRunId}/events`, {
    body,
    headers: {
      'content-type': 'application/json',
      'x-runner-key-id': 'key-current',
      'x-runner-signature': await signedRequest(body),
    },
    method: 'POST',
  })
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
    await expect(response.json()).resolves.toEqual({ outcome: 'accepted' })
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
    await expect(duplicateResponse.json()).resolves.toEqual({ outcome: 'accepted' })

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
