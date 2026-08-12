import { describe, expect, it } from 'vitest'
import { createAvailabilityRepository } from '../availability-repository'
import { availabilityTuple, createAvailabilityObservation, createAvailabilityTestDatabase } from './availability-fixtures'

describe('availability repository D1 integration', () => {
  it('commits append/current and reads both authoritative rows from one native batch', async () => {
    const database = await createAvailabilityTestDatabase()
    const repository = createAvailabilityRepository(database.db, { createId: () => 'accepted-row' })
    const result = await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation(),
    })

    expect(result).toMatchObject({
      accepted: true,
      authoritativeObservation: { observationIdentity: 'observation-1' },
      authoritativeReadback: { projectionVersion: 1 },
    })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_observation')).resolves.toMatchObject({ rows: [{ count: 1 }] })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_current')).resolves.toMatchObject({ rows: [{ count: 1 }] })
  })

  it('keeps current unchanged while preserving a bounded stale observation after CAS rejection', async () => {
    const database = await createAvailabilityTestDatabase()
    const repository = createAvailabilityRepository(database.db)
    await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation(),
    })

    const stale = await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation({
        eventSequence: 2,
        observationIdentity: 'stale-replay',
        observedAt: 1_700_000_001,
      }),
    })

    expect(stale).toMatchObject({ accepted: false, kind: 'stale', reason: 'stale' })
    await expect(database.client.execute('SELECT status, projection_version, observation_identity FROM crawler_availability_current')).resolves.toMatchObject({ rows: [{ observation_identity: 'observation-1', projection_version: 1, status: 'available' }] })
    await expect(database.client.execute('SELECT observation_identity FROM crawler_availability_observation ORDER BY event_sequence')).resolves.toMatchObject({ rows: [{ observation_identity: 'observation-1' }, { observation_identity: 'stale-replay' }] })
  })

  it('promotes a newest run over the prior current tuple while preserving both observations', async () => {
    const database = await createAvailabilityTestDatabase()
    const repository = createAvailabilityRepository(database.db)
    await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation(),
    })

    await database.client.batch([
      {
        sql: `INSERT INTO crawler_run (
          id, task_id, attempt_number, status, state_version, last_event_sequence,
          receipt_primary_content_id, receipt_source_revision, receipt_summary_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ['run-2', 'task-1', 2, 'running', 0, 0, 'movie-1', 0, JSON.stringify({ contentIds: ['movie-1'], sourceRevision: 0 }), 2, 2],
      },
      { sql: 'INSERT INTO crawler_run_provider_association VALUES (?, ?, ?)', args: ['run-2', 2, 'local-proof'] },
      { sql: 'UPDATE crawler_task SET latest_run_id = ? WHERE id = ?', args: ['run-2', 'task-1'] },
    ], 'write')

    const nextTuple = {
      ...availabilityTuple,
      attemptNumber: 2,
      provider: 'local-proof' as const,
      runId: 'run-2',
    }
    const next = await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 1,
      expectedSourceRevision: 0,
      expectedTuple: nextTuple,
      observation: createAvailabilityObservation({
        ...nextTuple,
        observationIdentity: 'observation-2',
        observedAt: 1_700_000_001,
      }),
    })

    expect(next).toMatchObject({
      accepted: true,
      authoritativeReadback: {
        attemptNumber: 2,
        projectionVersion: 2,
        provider: 'local-proof',
        runId: 'run-2',
      },
    })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_observation')).resolves.toMatchObject({ rows: [{ count: 2 }] })
    await expect(database.client.execute('SELECT provider, run_id, projection_version FROM crawler_availability_current')).resolves.toMatchObject({ rows: [{ provider: 'local-proof', run_id: 'run-2', projection_version: 2 }] })
  })

  it('keeps the current projection on a late older run while retaining its observation history', async () => {
    const database = await createAvailabilityTestDatabase()
    const repository = createAvailabilityRepository(database.db)
    await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation(),
    })

    await database.client.batch([
      {
        sql: `INSERT INTO crawler_run (
          id, task_id, attempt_number, status, state_version, last_event_sequence,
          receipt_primary_content_id, receipt_source_revision, receipt_summary_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ['run-2', 'task-1', 2, 'running', 0, 0, 'movie-1', 0, JSON.stringify({ contentIds: ['movie-1'], sourceRevision: 0 }), 2, 2],
      },
      { sql: 'INSERT INTO crawler_run_provider_association VALUES (?, ?, ?)', args: ['run-2', 2, 'github-actions'] },
      { sql: 'UPDATE crawler_task SET latest_run_id = ? WHERE id = ?', args: ['run-2', 'task-1'] },
    ], 'write')

    const late = await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 1,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation({
        eventSequence: 2,
        observationIdentity: 'late-old-run',
        runId: 'run-1',
      }),
    })

    expect(late).toMatchObject({ accepted: false, kind: 'late', reason: 'run_is_late_or_cancelled' })
    await expect(database.client.execute('SELECT run_id, attempt_number, projection_version FROM crawler_availability_current')).resolves.toMatchObject({ rows: [{ attempt_number: 1, projection_version: 1, run_id: 'run-1' }] })
    await expect(database.client.execute('SELECT observation_identity FROM crawler_availability_observation ORDER BY event_sequence')).resolves.toMatchObject({ rows: [{ observation_identity: 'observation-1' }, { observation_identity: 'late-old-run' }] })
  })

  it('leaves both projections empty when the D1 append/current batch fails', async () => {
    const database = await createAvailabilityTestDatabase()
    const original = database.db.$client as unknown as { prepare: (sql: string) => unknown }
    const failingDatabase = {
      $client: {
        prepare: original.prepare.bind(database.db.$client),
        batch: async () => { throw new Error('simulated_d1_failure') },
      },
    }
    const repository = createAvailabilityRepository(failingDatabase as never)
    const result = await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation(),
    })

    expect(result).toMatchObject({ accepted: false, kind: 'rejected', reason: 'append_or_projection_write_failed' })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_observation')).resolves.toMatchObject({ rows: [{ count: 0 }] })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_current')).resolves.toMatchObject({ rows: [{ count: 0 }] })
  })

  it('compensates the current row when a committed batch does not return authoritative readback', async () => {
    const database = await createAvailabilityTestDatabase()
    const realClient = database.db.$client as unknown as {
      batch: (statements: unknown[]) => Promise<unknown[]>
      prepare: (sql: string) => unknown
    }
    const brokenReadbackDatabase = {
      $client: {
        prepare: realClient.prepare.bind(database.db.$client),
        batch: async (statements: unknown[]) => {
          const results = await realClient.batch(statements)
          return results.map((item, index) => index >= 2 ? { ...(item as object), results: [] } : item)
        },
      },
    }
    const repository = createAvailabilityRepository(brokenReadbackDatabase as never)
    const result = await repository.persist({
      expectedPolicyVersion: 'v1',
      expectedProjectionVersion: 0,
      expectedSourceRevision: 0,
      expectedTuple: availabilityTuple,
      observation: createAvailabilityObservation(),
    })

    expect(result).toMatchObject({ accepted: false, kind: 'rejected', reason: 'authoritative_readback_missing' })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_current')).resolves.toMatchObject({ rows: [{ count: 0 }] })
    await expect(database.client.execute('SELECT count(*) AS count FROM crawler_availability_observation')).resolves.toMatchObject({ rows: [{ count: 1 }] })
  })
})
