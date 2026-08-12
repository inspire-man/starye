import { describe, expect, it } from 'vitest'
import { availabilityTuple, createAvailabilityObservation, createAvailabilityTestDatabase } from '../../crawler-tasks/__tests__/availability-fixtures'
import { createAvailabilityRepository } from '../../crawler-tasks/availability-repository'
import { createServerReadinessProjection } from '../../movies/source-contract'

describe('authoritative video availability readback', () => {
  it('returns same-revision current and bounded history while retaining stale facts', async () => {
    const database = await createAvailabilityTestDatabase()
    const repository = createAvailabilityRepository(database.db)
    await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation(),
    })
    await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 1,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation({
        eventSequence: 2,
        freshness: 'stale',
        observationIdentity: 'old-revision',
        sourceRevision: 0,
      }),
    })

    await expect(repository.readAuthoritative({
      contentId: 'movie-1',
      historyLimit: 10,
      policyVersion: 'v1',
      sourceRevision: 0,
      target: { id: 'movie-1', kind: 'movie' },
    })).resolves.toMatchObject({
      current: { observationIdentity: 'observation-1', policyVersion: 'v1', sourceRevision: 0 },
      history: [{ observationIdentity: 'old-revision' }],
    })

    await expect(repository.readAuthoritative({
      contentId: 'movie-1',
      historyLimit: 10,
      policyVersion: 'v1',
      sourceRevision: 1,
      target: { id: 'movie-1', kind: 'movie' },
    })).resolves.toMatchObject({ current: null })
  })

  it('never infers metadata persistence from a timestamp or task success', () => {
    const absent = createServerReadinessProjection({
      contentId: 'movie-1',
      metadata: { observedAt: 10, persisted: false },
    })
    const persisted = createServerReadinessProjection({
      contentId: 'movie-1',
      metadata: { observedAt: 10, persisted: true },
    })

    expect(absent.metadata).toEqual({ contentId: 'movie-1', observedAt: 10, persisted: false })
    expect(persisted.metadata.persisted).toBe(true)
  })
})
