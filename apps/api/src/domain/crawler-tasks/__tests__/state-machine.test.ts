import { describe, expect, it } from 'vitest'
import {
  createManualRetryAttempt,
  decideCrawlerRunTransition,
  resolveActiveCrawlerCreate,
} from '../state-machine'
import {
  crawlerTaskTemplates,
  createCrawlerTaskSnapshot,
} from '../template-registry'

const queuedRun = {
  attemptNumber: 1,
  lastEventSequence: 0,
  stateVersion: 0,
  status: 'queued' as const,
}

describe('crawler task state machine', () => {
  it('owns exactly the movie and manga templates and creates a closed server snapshot', () => {
    expect(Object.keys(crawlerTaskTemplates).sort()).toEqual(['manga', 'movie'])
    expect(crawlerTaskTemplates.manga.permissionResource).toBe('comic')
    expect(createCrawlerTaskSnapshot('movie')).toEqual({
      entrypoint: 'movie-crawler',
      permissionResource: 'movie',
      templateKey: 'movie',
      templateVersion: 1,
    })

    expect(Object.keys(createCrawlerTaskSnapshot('manga'))).not.toEqual(expect.arrayContaining([
      'command',
      'environment',
      'secret',
      'sourceAddress',
      'targetProfile',
      'workflow',
    ]))
  })

  it('returns an existing active lease owner and creates a new immutable attempt only after failure or cancellation', () => {
    expect(resolveActiveCrawlerCreate({
      runId: 'run-active',
      status: 'running',
      templateKey: 'movie',
    })).toEqual({
      kind: 'existing_active_run',
      runId: 'run-active',
    })

    const snapshot = createCrawlerTaskSnapshot('movie')
    expect(createManualRetryAttempt({
      attemptNumber: 1,
      snapshot,
      status: 'failed',
    })).toEqual({
      attemptNumber: 2,
      snapshot,
      status: 'queued',
    })

    expect(() => createManualRetryAttempt({
      attemptNumber: 1,
      snapshot,
      status: 'succeeded',
    })).toThrow('Only failed or cancelled runs may be retried')
  })

  it('permits only the closed lifecycle matrix, including heartbeat entry and receipt success over cancellation', () => {
    const dispatching = decideCrawlerRunTransition(queuedRun, {
      actor: 'dispatcher',
      sequence: 1,
      type: 'dispatch_claim',
    })
    expect(dispatching).toMatchObject({
      kind: 'transition',
      nextStatus: 'dispatching',
      reasonCode: 'dispatch_claimed',
    })

    expect(decideCrawlerRunTransition({
      ...queuedRun,
      status: 'dispatching',
    }, {
      actor: 'runner',
      sequence: 1,
      type: 'runner_heartbeat',
    })).toMatchObject({
      kind: 'transition',
      nextStatus: 'running',
      reasonCode: 'runner_heartbeat',
    })

    expect(decideCrawlerRunTransition({
      ...queuedRun,
      status: 'dispatching',
    }, {
      actor: 'runner',
      sequence: 1,
      type: 'runner_progress',
    })).toMatchObject({ kind: 'rejected', reasonCode: 'invalid_transition' })

    expect(decideCrawlerRunTransition(queuedRun, {
      actor: 'admin',
      type: 'admin_cancel',
    })).toMatchObject({
      kind: 'transition',
      nextStatus: 'cancelled',
      reasonCode: 'cancelled_before_dispatch',
    })
    expect(decideCrawlerRunTransition({
      ...queuedRun,
      status: 'running',
    }, {
      actor: 'admin',
      type: 'admin_cancel',
    })).toMatchObject({
      kind: 'transition',
      nextStatus: 'cancel_requested',
      reasonCode: 'cancel_requested',
    })

    expect(decideCrawlerRunTransition({
      ...queuedRun,
      status: 'cancel_requested',
    }, {
      actor: 'runner',
      receipt: { contentIds: ['movie-1'], templateKey: 'movie' },
      sequence: 1,
      type: 'runner_succeeded',
    })).toMatchObject({
      kind: 'transition',
      nextStatus: 'succeeded',
      reasonCode: 'cancel_not_effective',
    })

    expect(decideCrawlerRunTransition({
      ...queuedRun,
      status: 'running',
    }, {
      actor: 'scheduler',
      type: 'lease_expired',
    })).toMatchObject({
      failureCode: 'runner_lost',
      kind: 'transition',
      nextStatus: 'failed',
    })

    expect(decideCrawlerRunTransition({
      ...queuedRun,
      status: 'succeeded',
    }, {
      actor: 'runner',
      sequence: 1,
      type: 'runner_heartbeat',
    })).toMatchObject({ kind: 'rejected', reasonCode: 'terminal_state' })
  })

  it('records stale or out-of-sequence nonterminal events without replacing current status', () => {
    const current = {
      ...queuedRun,
      lastEventSequence: 3,
      stateVersion: 2,
      status: 'running' as const,
    }

    expect(decideCrawlerRunTransition(current, {
      actor: 'runner',
      sequence: 3,
      type: 'runner_progress',
    })).toEqual({
      currentStatus: 'running',
      kind: 'stale',
      reasonCode: 'stale_event',
      sequence: 3,
    })

    expect(decideCrawlerRunTransition(current, {
      actor: 'runner',
      sequence: 5,
      type: 'runner_log',
    })).toEqual({
      currentStatus: 'running',
      kind: 'stale',
      reasonCode: 'out_of_sequence_event',
      sequence: 5,
    })
  })
})
