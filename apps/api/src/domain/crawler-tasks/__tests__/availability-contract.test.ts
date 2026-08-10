import { describe, expect, it } from 'vitest'
import { classifyAvailabilityCas, validateAvailabilityObservation } from '../availability-contract'
import { validateBoundedAvailabilityEvidence } from '../evidence-contract'

function observation(overrides: Record<string, unknown> = {}) {
  return {
    attemptNumber: 1,
    contentId: 'content-1',
    eventSequence: 1,
    freshness: 'fresh',
    nextAction: 'none',
    observationIdentity: 'observation-1',
    observedAt: 1_700_000_000,
    policyVersion: 'v1',
    provider: 'github-actions',
    reasonCode: 'available',
    runId: 'run-1',
    sourceRevision: 3,
    status: 'available',
    summary: validateBoundedAvailabilityEvidence({ counts: { ok: 1 }, samples: [{ code: 'transport_ok' }] }),
    target: { id: 'movie-1', kind: 'movie' },
    taskId: 'task-1',
    ...overrides,
  } as const
}

function cas(overrides: Record<string, unknown> = {}) {
  const item = observation()
  return {
    current: null,
    expectedPolicyVersion: 'v1',
    expectedProjectionVersion: 0,
    expectedSourceRevision: 3,
    expectedTuple: {
      attemptNumber: item.attemptNumber,
      contentId: item.contentId,
      provider: item.provider,
      runId: item.runId,
      target: item.target,
      taskId: item.taskId,
    },
    observation: item,
    ...overrides,
  }
}

describe('availability contract', () => {
  it('rejects unknown observation fields and accepts a bounded tuple', () => {
    expect(() => validateAvailabilityObservation({ ...observation(), workflow: 'forbidden' })).toThrow()
    expect(validateAvailabilityObservation(observation()).sourceRevision).toBe(3)
  })

  it('accepts a new projection and rejects replay, stale, late and conflict writes', () => {
    const accepted = classifyAvailabilityCas(cas())
    expect(accepted.accepted).toBe(true)
    if (!accepted.accepted)
      throw new Error('expected accepted result')

    expect(classifyAvailabilityCas(cas({ current: accepted.projection })).code).toBe('duplicate')
    expect(classifyAvailabilityCas(cas({
      current: accepted.projection,
      expectedProjectionVersion: accepted.projection.projectionVersion,
      observation: observation({ observationIdentity: 'observation-2', sourceRevision: 2 }),
    })).code).toBe('stale')
    expect(classifyAvailabilityCas(cas({
      current: accepted.projection,
      expectedProjectionVersion: accepted.projection.projectionVersion,
      observation: observation({ observationIdentity: 'observation-3', freshness: 'late' }),
    })).code).toBe('late')
    expect(classifyAvailabilityCas(cas({
      current: accepted.projection,
      expectedProjectionVersion: accepted.projection.projectionVersion,
      observation: observation({ observationIdentity: 'observation-4', policyVersion: 'v2' }),
    })).code).toBe('conflict')
  })

  it('does not mutate the accepted projection when a CAS is rejected', () => {
    const current = classifyAvailabilityCas(cas())
    if (!current.accepted)
      throw new Error('expected accepted result')
    const rejected = classifyAvailabilityCas(cas({
      current: current.projection,
      expectedProjectionVersion: current.projection.projectionVersion - 1,
      observation: observation({ observationIdentity: 'observation-5' }),
    }))
    expect(rejected.accepted).toBe(false)
    expect(rejected.authoritativeReadback).toEqual(current.projection)
  })
})
