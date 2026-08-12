import type { AvailabilityRepositoryResult } from '../../../../domain/crawler-tasks/availability-repository'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAvailabilityObservation } from '../../../../domain/crawler-tasks/__tests__/availability-fixtures'
import { base64UrlEncode } from '../../../../domain/crawler-tasks/runner-event-auth'
import { createCrawlerRunsRoutes } from '../index'

const NOW = new Date('2026-08-11T00:00:00.000Z').getTime()

async function signedRequest(body: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('runner-secret'),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  return base64UrlEncode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
}

async function sha256Hex(body: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)))
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    attempt: 1,
    content_id: 'movie-1',
    event_id: 'availability-event-1',
    expected_projection_version: 0,
    freshness: 'fresh',
    key_id: 'key-current',
    next_action: 'none',
    nonce: 'availability-nonce-1',
    observation_identity: 'availability-observation-1',
    observed_at: Math.floor(NOW / 1000),
    policy_version: 'v1',
    provider: 'github-actions',
    reason_code: 'available',
    run_id: 'run-1',
    sequence: 1,
    source_revision: 0,
    status: 'available',
    summary: { counts: { ready: 1 }, samples: [{ code: 'transport_ok' }] },
    target: { id: 'movie-1', kind: 'movie' },
    task_id: 'task-1',
    timestamp: NOW,
    type: 'availability_observation',
    ...overrides,
  }
}

function acceptedResult(): AvailabilityRepositoryResult {
  const observation = createAvailabilityObservation({
    eventSequence: 1,
    observationIdentity: 'availability-observation-1',
    observedAt: Math.floor(NOW / 1000),
    summary: { counts: { ready: 1 }, samples: [{ code: 'transport_ok' }] },
  })
  const projection = { ...observation, projectionVersion: 1 }
  return {
    accepted: true,
    authoritativeObservation: observation,
    authoritativeReadback: projection,
    kind: 'accepted',
    projection,
  }
}

function createApp(input: {
  readonly persist: (value: unknown) => Promise<AvailabilityRepositoryResult>
  readonly recordedEvents?: Array<Readonly<Record<string, string>>>
  readonly onCacheInvalidate?: (projection: unknown) => void
}) {
  const recordedEvents = [...(input.recordedEvents ?? [])]
  const statement = {
    all: vi.fn(async () => {
      const next = recordedEvents.shift()
      return { results: next ? [next] : [] }
    }),
    bind: vi.fn(),
    run: vi.fn(async () => ({ meta: { changes: 1 } })),
  }
  statement.bind.mockReturnValue(statement)
  const prepare = vi.fn(() => statement)
  let invalidateCache: ((projection: unknown) => Promise<void>) | undefined
  const app = new Hono<any>()
  app.use('*', async (c, next) => {
    c.env = {
      CACHE: undefined,
      TASK_RUNNER_CALLBACK_KEY_ID_CURRENT: 'key-current',
      TASK_RUNNER_CALLBACK_SECRET_CURRENT: 'runner-secret',
    }
    c.set('db', { $client: { prepare } })
    await next()
  })
  app.route('/crawler-runs', createCrawlerRunsRoutes({
    createAvailabilityRepository: (_database, options) => {
      invalidateCache = options.invalidateCache
      return { persist: input.persist } as never
    },
    invalidateAvailabilityCache: async (projection) => { input.onCacheInvalidate?.(projection) },
    now: () => NOW,
  }))
  return {
    app,
    prepare,
    recordedEvents,
    get invalidateCache() {
      return invalidateCache
    },
  }
}

async function postObservation(app: Hono<any>, event: Record<string, unknown>) {
  const body = JSON.stringify(event)
  return app.request('/crawler-runs/run-1/availability-observation', {
    body,
    headers: {
      'content-type': 'application/json',
      'x-runner-key-id': 'key-current',
      'x-runner-signature': await signedRequest(body),
    },
    method: 'POST',
  })
}

describe('signed crawler availability observation route', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts a fresh signed observation, invalidates after readback, and returns exact replay', async () => {
    const cacheOrder: string[] = []
    const result = acceptedResult()
    const appState = createApp({
      onCacheInvalidate: () => { cacheOrder.push('cache') },
      persist: async (input) => {
        expect(input).toMatchObject({
          expectedProjectionVersion: 0,
          expectedPolicyVersion: 'v1',
          expectedSourceRevision: 0,
          observation: { taskId: 'task-1', runId: 'run-1', provider: 'github-actions', summary: { counts: { ready: 1 } } },
        })
        cacheOrder.push('readback')
        await appState.invalidateCache?.(result.authoritativeReadback)
        return result
      },
    })
    const event = createEvent()
    const first = await postObservation(appState.app, event)
    expect(first.status).toBe(200)
    await expect(first.json()).resolves.toMatchObject({
      accepted: true,
      current: { observationIdentity: 'availability-observation-1', projectionVersion: 1 },
      kind: 'accepted',
      observation: { observationIdentity: 'availability-observation-1' },
    })
    expect(cacheOrder).toEqual(['readback', 'cache'])

    const body = JSON.stringify(event)
    appState.recordedEvents.push({
      body_sha256: await sha256Hex(body),
      event_id: 'availability-event-1',
      nonce: 'availability-nonce-1',
      outcome: JSON.stringify({ accepted: true, current: result.authoritativeReadback, kind: 'accepted', observation: result.authoritativeObservation }),
    })
    const duplicate = await postObservation(appState.app, event)
    expect(duplicate.status).toBe(200)
    await expect(duplicate.json()).resolves.toMatchObject({ accepted: true, kind: 'accepted' })
  })

  it('rejects forbidden or sensitive input before persistence and maps stale to bounded 409', async () => {
    const persist = vi.fn(async () => ({
      accepted: false,
      authoritativeReadback: null,
      kind: 'stale',
      reason: 'projection_version_mismatch',
    } as const))
    const appState = createApp({ persist })

    const forbidden = await postObservation(appState.app, createEvent({ workflow: 'secret-workflow' }))
    expect(forbidden.status).toBe(400)
    const sensitive = await postObservation(appState.app, createEvent({
      event_id: 'availability-event-2',
      nonce: 'availability-nonce-2',
      observation_identity: 'availability-observation-2',
      summary: { counts: { ready: 1 }, samples: [], signed_url: 'https://secret.example' },
    }))
    expect(sensitive.status).toBe(400)
    expect(persist).not.toHaveBeenCalled()

    const stale = await postObservation(appState.app, createEvent({
      event_id: 'availability-event-3',
      nonce: 'availability-nonce-3',
      observation_identity: 'availability-observation-3',
    }))
    expect(stale.status).toBe(409)
    await expect(stale.json()).resolves.toEqual({ accepted: false, current: null, kind: 'stale', observation: null, reason: 'projection_version_mismatch' })
    expect(persist).toHaveBeenCalledTimes(1)

    const notFoundApp = createApp({
      persist: async () => ({ accepted: false, authoritativeReadback: null, kind: 'rejected', reason: 'run_not_found' }),
    })
    const notFound = await postObservation(notFoundApp.app, createEvent({
      event_id: 'availability-event-4',
      nonce: 'availability-nonce-4',
      observation_identity: 'availability-observation-4',
    }))
    expect(notFound.status).toBe(404)
    await expect(notFound.json()).resolves.toMatchObject({ accepted: false, kind: 'rejected', reason: 'run_not_found' })
  })

  it('returns 409 for changed event replay without calling the availability adapter', async () => {
    const event = createEvent()
    const body = JSON.stringify(event)
    const appState = createApp({
      persist: vi.fn(async () => acceptedResult()),
      recordedEvents: [{
        body_sha256: await sha256Hex(body),
        event_id: 'availability-event-1',
        nonce: 'availability-nonce-1',
        outcome: JSON.stringify({ accepted: true, current: null, kind: 'accepted', observation: null }),
      }],
    })
    const conflict = await postObservation(appState.app, { ...event, status: 'degraded' })
    expect(conflict.status).toBe(409)
    await expect(conflict.text()).resolves.toBe('Conflicting availability observation replay')
  })
})
