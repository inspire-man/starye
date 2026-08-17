import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { base64UrlEncode } from '../../../../domain/crawler-tasks/runner-event-auth'
import { createCrawlerRunsRoutes } from '../index'

const repairSourceObservation = vi.hoisted(() => vi.fn())

vi.mock('../../../../domain/movies/source-reconciliation', () => ({
  acceptRepairSourceObservation: repairSourceObservation,
}))

beforeEach(() => {
  repairSourceObservation.mockReset()
})

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

function createScheduleEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'schedule-event-1',
    key_id: 'key-current',
    nonce: 'schedule-nonce-1',
    scheduled_at: '2026-07-30T00:00:00.000Z',
    schedule_bucket: '2026-07-30T00:00Z',
    target: 'starye-org',
    template: 'movie',
    timestamp: NOW,
    type: 'schedule_register',
    workflow: '.github/workflows/daily-movie-crawl.yml',
    repository: 'inspire-man/starye',
    ref: 'main',
    environment: 'starye-org',
    ...overrides,
  }
}

function createProviderStartedEvent(overrides: Record<string, unknown> = {}) {
  return {
    attempt: 1,
    environment: 'starye-org',
    event_id: 'provider-event-1',
    key_id: 'key-current',
    nonce: 'provider-nonce-1',
    provider_run_attempt: 1,
    provider_run_id: '12345',
    ref: 'main',
    repository: 'inspire-man/starye',
    run_id: 'run-1',
    sha: 'a'.repeat(40),
    target: 'starye-org',
    template: 'movie',
    timestamp: NOW,
    type: 'provider_started',
    workflow: '.github/workflows/daily-movie-crawl.yml',
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
    providerStarted: vi.fn(async () => ({ accepted: true, cancelRequested: false })),
    scheduleRegister: vi.fn(async () => ({ attempt: 1, runId: 'run-1', accepted: true })),
  }
}

function createSourceObservationEvent(overrides: Record<string, unknown> = {}) {
  return {
    attempt: 1,
    event_id: 'repair-event-1',
    key_id: 'key-current',
    nonce: 'repair-nonce-1',
    observed_at: Math.floor(NOW / 1000),
    operation: 'repair_players',
    run_id: 'run-1',
    sequence: 3,
    source_revision: 7,
    sources: [{
      health: 'unverified',
      isActive: true,
      reasonCode: 'source_unverified',
      sourceName: '线路 1',
      sourceType: 'direct',
      sourceUrl: 'https://media.example/movie-1.m3u8',
    }],
    timestamp: NOW,
    type: 'source_observation',
    ...overrides,
  }
}

function createApp(processor = createProcessor(), results: Array<unknown[]> = [], runChanges: number[] = []) {
  const app = new Hono<any>()
  const prepare = vi.fn()
  const statement = {
    all: vi.fn().mockImplementation(async () => ({ results: results.shift() ?? [] })),
    bind: vi.fn(),
    run: vi.fn().mockImplementation(async () => ({ meta: { changes: runChanges.shift() ?? 1 } })),
  }
  statement.bind.mockReturnValue(statement)
  prepare.mockReturnValue(statement)
  app.use('*', async (c, next) => {
    c.env = {
      TASK_RUNNER_CALLBACK_KEY_ID_CURRENT: 'key-current',
      TASK_RUNNER_CALLBACK_SECRET_CURRENT: 'runner-secret',
    }
    c.set('db', { $client: { prepare } })
    await next()
  })
  app.route('/crawler-runs', createCrawlerRunsRoutes({
    createRepository: () => processor as never,
    now: () => NOW,
  }))
  return Object.assign(app, { app, prepare, statement })
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

async function postSourceObservation(app: Hono<any>, event: Record<string, unknown>, pathRunId = 'run-1') {
  return postSigned(app, `/crawler-runs/${pathRunId}/source-observation`, JSON.stringify(event))
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
  it('accepts a signed strict schedule registration and returns an idempotent control-plane run', async () => {
    const processor = createProcessor()
    const response = await postSigned(createApp(processor), '/crawler-runs/schedule-register', JSON.stringify(createScheduleEvent()))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ accepted: true, attempt: 1, run_id: 'run-1' })
    expect(processor.scheduleRegister).toHaveBeenCalledWith(expect.objectContaining({
      scheduleBucket: '2026-07-30T00:00Z',
      template: 'movie',
      target: 'starye-org',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    }))
  })

  it('binds provider_started to the exact provider snapshot before any crawler state mutation', async () => {
    const processor = createProcessor()
    const response = await postSigned(createApp(processor), '/crawler-runs/run-1/provider-started', JSON.stringify(createProviderStartedEvent()))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ accepted: true, cancel_requested: false })
    expect(processor.providerStarted).toHaveBeenCalledWith(expect.objectContaining({
      attempt: 1,
      providerRunId: '12345',
      runId: 'run-1',
      sha: 'a'.repeat(40),
    }))
  })

  it('rejects provider snapshot drift before the provider association callback', async () => {
    const processor = createProcessor()
    const response = await postSigned(createApp(processor), '/crawler-runs/run-1/provider-started', JSON.stringify(createProviderStartedEvent({ target: 'other-target' })))

    expect(response.status).toBe(400)
    expect(processor.providerStarted).not.toHaveBeenCalled()
  })

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

  it('accepts a bounded repair_players terminal receipt and forwards its discriminator', async () => {
    const processor = createProcessor()
    const response = await postEvent(createApp(processor), createEvent({
      event_id: 'repair-terminal-event',
      nonce: 'repair-terminal-nonce',
      receipt: {
        movieId: 'movie-1',
        observedAt: 1_720_000_000,
        operation: 'repair_players',
        sourceRevision: 8,
        sourceSummary: [{
          eligible: true,
          health: 'unverified',
          observedAt: 1_720_000_000,
          reasonCode: 'source_unverified',
          sourceType: 'direct',
        }],
      },
      sequence: 4,
      type: 'succeeded',
    }))

    expect(response.status).toBe(200)
    expect(processor.processRunnerEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ type: 'runner_succeeded' }),
      receipt: expect.objectContaining({ operation: 'repair_players', sourceRevision: 8 }),
    }))
  })

  it('accepts a signed repair source observation only for the bound repair run and returns bounded readback plus receipt candidate', async () => {
    repairSourceObservation.mockResolvedValueOnce({
      outcome: 'accepted',
      readback: {
        movieId: 'movie-1',
        observedAt: 1_720_000_000,
        sourceRevision: 8,
        sources: [{
          eligible: true,
          health: 'unverified',
          observedAt: 1_720_000_000,
          reasonCode: 'source_unverified',
          sourceType: 'direct',
        }],
        summary: { eligibleCount: 1, sourceCount: 1 },
      },
      repairable: true,
      source: {
        disposition: 'ready',
        eligibleCount: 1,
        observedAt: 1_720_000_000,
        reasonCode: null,
        repairable: false,
        sourceRevision: 8,
      },
    })
    const processor = createProcessor()
    const { app } = createApp(processor, [
      [],
      [{
        attempt_number: 1,
        last_event_sequence: 2,
        state_version: 2,
        movie_id: 'movie-1',
        operation: 'repair_players',
        request_snapshot_json: JSON.stringify({
          entrypoint: 'movie-crawler',
          movieId: 'movie-1',
          operation: 'repair_players',
          permissionResource: 'movie',
          reason: 'no_source',
          sourceRevision: 7,
          targetIntent: 'restore_playable_sources',
          templateKey: 'movie',
          templateVersion: 1,
        }),
        status: 'running',
        task_id: 'task-repair',
        template_key: 'movie',
      }],
    ])

    const response = await postSourceObservation(app, createSourceObservationEvent())

    expect(response.status).toBe(200)
    const responseBody = await response.json()
    expect(responseBody).toMatchObject({
      accepted: true,
      outcome: 'accepted',
      readback: {
        movieId: 'movie-1',
        sourceRevision: 8,
        summary: { eligibleCount: 1, sourceCount: 1 },
      },
      receipt: {
        movieId: 'movie-1',
        observedAt: 1_720_000_000,
        operation: 'repair_players',
        sourceRevision: 8,
      },
    })
    expect(repairSourceObservation).toHaveBeenCalledWith(expect.objectContaining({
      attemptNumber: 1,
      eventId: 'repair-event-1',
      expectedSourceRevision: 7,
      movieId: 'movie-1',
      operation: 'repair_players',
      runId: 'run-1',
      sequence: 3,
    }))
    const body = JSON.stringify(responseBody)
    expect(body).not.toContain('sourceUrl')
    expect(body).not.toContain('signature')
    expect(body).not.toContain('page')

    const heartbeat = await postEvent(app, createEvent({
      event_id: 'heartbeat-after-repair',
      nonce: 'heartbeat-after-repair',
      sequence: 4,
      type: 'heartbeat',
    }))
    const terminal = await postEvent(app, createEvent({
      event_id: 'terminal-after-repair',
      nonce: 'terminal-after-repair',
      receipt: { contentIds: ['movie-1'], templateKey: 'movie' },
      sequence: 5,
      type: 'succeeded',
    }))

    expect(heartbeat.status).toBe(200)
    expect(terminal.status).toBe(200)
    expect(processor.processRunnerEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ sequence: 4 }))
    expect(processor.processRunnerEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({ sequence: 5 }))
  })

  it('keeps exact replay idempotent and rejects conflicting or stale repair observation callbacks', async () => {
    const duplicateOutcome = JSON.stringify({
      accepted: true,
      outcome: 'accepted',
      readback: { movieId: 'movie-1', sourceRevision: 8 },
      receipt: { movieId: 'movie-1', observedAt: 1_720_000_000, operation: 'repair_players', sourceRevision: 8, sourceSummary: [] },
    })
    const duplicate = createApp(createProcessor(), [[{
      body_sha256: await (async () => {
        const body = JSON.stringify(createSourceObservationEvent())
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
        return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
      })(),
      event_id: 'repair-event-1',
      nonce: 'repair-nonce-1',
      outcome: duplicateOutcome,
    }]])
    const duplicateResponse = await postSourceObservation(duplicate.app, createSourceObservationEvent())
    expect(duplicateResponse.status).toBe(200)
    await expect(duplicateResponse.json()).resolves.toMatchObject({ accepted: true, outcome: 'accepted' })
    expect(repairSourceObservation).not.toHaveBeenCalled()

    const conflict = createApp(createProcessor(), [[{
      body_sha256: 'different-body',
      event_id: 'repair-event-1',
      nonce: 'repair-nonce-1',
      outcome: duplicateOutcome,
    }]])
    const conflictResponse = await postSourceObservation(conflict.app, createSourceObservationEvent())
    expect(conflictResponse.status).toBe(409)

    const stale = createApp(createProcessor(), [
      [],
      [{
        attempt_number: 1,
        last_event_sequence: 3,
        state_version: 3,
        movie_id: 'movie-1',
        operation: 'repair_players',
        request_snapshot_json: JSON.stringify({
          entrypoint: 'movie-crawler',
          movieId: 'movie-1',
          operation: 'repair_players',
          permissionResource: 'movie',
          reason: 'no_source',
          sourceRevision: 7,
          targetIntent: 'restore_playable_sources',
          templateKey: 'movie',
          templateVersion: 1,
        }),
        status: 'running',
        task_id: 'task-repair',
        template_key: 'movie',
      }],
    ])
    const staleResponse = await postSourceObservation(stale.app, createSourceObservationEvent())
    expect(staleResponse.status).toBe(409)
    expect(repairSourceObservation).not.toHaveBeenCalled()
  })

  it('rejects signed repair observation envelopes with operation, revision, or attempt mismatches before persistence', async () => {
    const mismatch = createApp(createProcessor(), [
      [],
      [{
        attempt_number: 2,
        last_event_sequence: 1,
        state_version: 1,
        movie_id: 'movie-1',
        operation: 'movie',
        request_snapshot_json: JSON.stringify({
          entrypoint: 'movie-crawler',
          permissionResource: 'movie',
          templateKey: 'movie',
          templateVersion: 1,
        }),
        status: 'running',
        task_id: 'task-repair',
        template_key: 'movie',
      }],
    ])

    const response = await postSourceObservation(mismatch.app, createSourceObservationEvent())

    expect(response.status).toBe(409)
    expect(repairSourceObservation).not.toHaveBeenCalled()
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

  it('passes a production application binding to the repository poll', async () => {
    const processor = createProcessor()
    const response = await postSigned(createApp(processor), '/crawler-runs/poll', JSON.stringify(createControlEnvelope({
      attempt: 2,
      event_id: 'control-event-bound',
      nonce: 'control-nonce-bound',
      run_id: 'run-bound',
    })))

    expect(response.status).toBe(200)
    expect(processor.pollDispatch).toHaveBeenCalledWith({ attempt: 2, runId: 'run-bound' })
  })

  it('rejects a poll request with only half of the application binding', async () => {
    const processor = createProcessor()
    const response = await postSigned(createApp(processor), '/crawler-runs/poll', JSON.stringify(createControlEnvelope({
      attempt: 2,
      event_id: 'control-event-partial',
      nonce: 'control-nonce-partial',
    })))

    expect(response.status).toBe(400)
    expect(processor.pollDispatch).not.toHaveBeenCalled()
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
