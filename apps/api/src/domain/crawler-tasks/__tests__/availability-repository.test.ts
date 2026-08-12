import { beforeEach, describe, expect, it } from 'vitest'
import { createAvailabilityRepository } from '../availability-repository'
import { availabilityTuple, createAvailabilityObservation, createAvailabilityTestDatabase } from './availability-fixtures'

describe('availability repository', () => {
  let database: Awaited<ReturnType<typeof createAvailabilityTestDatabase>>

  beforeEach(async () => {
    database = await createAvailabilityTestDatabase()
  })

  it('appends and promotes only after tuple-bound CAS, then returns durable readback before cache invalidation', async () => {
    const order: string[] = []
    const repository = createAvailabilityRepository(database.db, {
      createId: () => 'row-1',
      invalidateCache: async (projection) => { order.push(`cache:${projection.projectionVersion}`) },
    })
    const accepted = await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation(),
    })

    expect(accepted).toMatchObject({
      accepted: true,
      authoritativeObservation: { observationIdentity: 'observation-1' },
      authoritativeReadback: { projectionVersion: 1 },
      kind: 'accepted',
    })
    expect(order).toEqual(['cache:1'])
    await expect(database.client.execute('SELECT task_id, run_id, attempt_number, provider, observation_identity, source_revision, policy_version, summary_json FROM crawler_availability_observation')).resolves.toMatchObject({ rows: [expect.objectContaining({
      attempt_number: 1,
      observation_identity: 'observation-1',
      policy_version: 'v1',
      provider: 'github-actions',
      run_id: 'run-1',
      source_revision: 0,
      summary_json: '{"counts":{"ready":1},"samples":[]}',
      task_id: 'task-1',
    })] })
  })

  it('makes exact replay duplicate and changed identity replay conflict without overwriting current', async () => {
    const repository = createAvailabilityRepository(database.db)
    const input = { expectedPolicyVersion: 'v1', expectedProjectionVersion: 0, expectedSourceRevision: 0, expectedTuple: availabilityTuple, observation: createAvailabilityObservation() }
    await expect(repository.persist(input)).resolves.toMatchObject({ kind: 'accepted' })
    await expect(repository.persist(input)).resolves.toMatchObject({ accepted: false, kind: 'duplicate', authoritativeReadback: { projectionVersion: 1 } })
    await expect(repository.persist({ ...input, observation: createAvailabilityObservation({ status: 'degraded', reasonCode: 'transport_failed' }) })).resolves.toMatchObject({ accepted: false, kind: 'conflict' })
    await expect(database.client.execute('SELECT status, projection_version FROM crawler_availability_current')).resolves.toMatchObject({ rows: [{ status: 'available', projection_version: 1 }] })
  })

  it.each([
    ['stale', createAvailabilityObservation({ eventSequence: 2, observationIdentity: 'stale-1', sourceRevision: 0 }), { expectedProjectionVersion: 1, expectedSourceRevision: 1 }],
    ['late', createAvailabilityObservation({ eventSequence: 2, observationIdentity: 'late-1', freshness: 'late' }), { expectedProjectionVersion: 1, expectedSourceRevision: 0 }],
  ] as const)('retains %s history while preserving current', async (_name, observation, expected) => {
    const repository = createAvailabilityRepository(database.db)
    await repository.persist({ expectedPolicyVersion: 'v1', expectedProjectionVersion: 0, expectedSourceRevision: 0, expectedTuple: availabilityTuple, observation: createAvailabilityObservation() })
    await expect(repository.persist({ ...expected, expectedTuple: availabilityTuple, expectedPolicyVersion: 'v1', observation })).resolves.toMatchObject({ accepted: false })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_observation')).resolves.toMatchObject({ rows: [{ count: 2 }] })
    await expect(database.client.execute('SELECT status, projection_version FROM crawler_availability_current')).resolves.toMatchObject({ rows: [{ status: 'available', projection_version: 1 }] })
  })

  it('rejects sensitive and unbounded evidence before any D1 write', async () => {
    const repository = createAvailabilityRepository(database.db)
    const rejected = await repository.persist({ expectedPolicyVersion: 'v1', expectedProjectionVersion: 0, expectedSourceRevision: 0, expectedTuple: availabilityTuple, observation: createAvailabilityObservation({ summary: { counts: { ready: 1 }, samples: [], signed_url: 'https://secret.example' } as never }) })
    expect(rejected).toMatchObject({ accepted: false, kind: 'rejected' })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_observation')).resolves.toMatchObject({ rows: [{ count: 0 }] })
  })

  it('rejects missing receipt binding without changing current', async () => {
    database = await createAvailabilityTestDatabase({ receiptContentId: null, receiptSourceRevision: null })
    const repository = createAvailabilityRepository(database.db)
    const rejected = await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation(),
    })
    expect(rejected).toMatchObject({ accepted: false, kind: 'rejected', reason: 'receipt_binding_missing' })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_observation')).resolves.toMatchObject({ rows: [{ count: 0 }] })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_current')).resolves.toMatchObject({ rows: [{ count: 0 }] })
  })
})
