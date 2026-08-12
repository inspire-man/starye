import type { Database } from '@starye/db'
import type {
  AvailabilityCurrentProjection,
  AvailabilityObservation,
  AvailabilityTuple,
} from './availability-contract'
import { classifyAvailabilityCas, validateAvailabilityObservation } from './availability-contract'

interface D1Result<T = unknown> {
  readonly meta?: { readonly changes?: number }
  readonly results?: T[]
}

interface D1Statement {
  all: <T>() => Promise<D1Result<T>>
  bind: (...values: unknown[]) => D1Statement
  run: () => Promise<D1Result>
}

interface D1Client {
  batch: (statements: D1Statement[]) => Promise<readonly D1Result[]>
  prepare: (query: string) => D1Statement
}

interface BindingRow {
  readonly attempt_number: number
  readonly last_event_sequence: number
  readonly latest_run_id: string | null
  readonly provider_name: string | null
  readonly receipt_primary_content_id: string | null
  readonly receipt_source_revision: number | null
  readonly request_snapshot_json: string
  readonly run_id: string
  readonly run_status: string
  readonly task_id: string
}

interface ObservationRow {
  readonly attempt_number: number
  readonly content_id: string
  readonly event_sequence: number
  readonly freshness: AvailabilityObservation['freshness']
  readonly next_action: AvailabilityObservation['nextAction']
  readonly observation_identity: string
  readonly observed_at: number
  readonly policy_version: string
  readonly provider: AvailabilityObservation['provider']
  readonly reason_code: AvailabilityObservation['reasonCode']
  readonly run_id: string
  readonly source_revision: number
  readonly status: AvailabilityObservation['status']
  readonly summary_json: string
  readonly target_id: string
  readonly target_kind: AvailabilityObservation['target']['kind']
  readonly task_id: string
}

interface CurrentRow extends ObservationRow {
  readonly id: string
  readonly projection_version: number
  readonly updated_at: number
}

export interface AvailabilityRepositoryOptions {
  readonly createId?: () => string
  readonly now?: () => number
  readonly invalidateCache?: (projection: AvailabilityCurrentProjection) => Promise<void>
}

export interface PersistAvailabilityObservationInput {
  readonly observation: unknown
  readonly expectedProjectionVersion: number
  readonly expectedSourceRevision: number
  readonly expectedPolicyVersion: string
  readonly expectedPolicyReference?: string
  readonly expectedTuple: unknown
}

export interface ReadAuthoritativeAvailabilityInput {
  readonly contentId: string
  readonly historyLimit?: number
  readonly policyVersion: string
  readonly sourceRevision: number
  readonly target: AvailabilityTuple['target']
}

export type AvailabilityRepositoryResult
  = | {
    readonly accepted: true
    readonly authoritativeObservation: AvailabilityObservation
    readonly authoritativeReadback: AvailabilityCurrentProjection
    readonly kind: 'accepted'
    readonly projection: AvailabilityCurrentProjection
  }
  | {
    readonly accepted: false
    readonly authoritativeObservation?: AvailabilityObservation
    readonly authoritativeReadback: AvailabilityCurrentProjection | null
    readonly kind: 'duplicate' | 'late' | 'stale' | 'conflict' | 'rejected'
    readonly reason?: string
  }

const MAX_IDENTIFIER_LENGTH = 256

function asD1Client(database: Pick<Database, '$client'>): D1Client {
  return database.$client as unknown as D1Client
}

function changes(result: D1Result | undefined): number {
  return typeof result?.meta?.changes === 'number' && Number.isSafeInteger(result.meta.changes)
    ? result.meta.changes
    : 0
}

function observationFromRow(row: ObservationRow): AvailabilityObservation {
  return validateAvailabilityObservation({
    attemptNumber: row.attempt_number,
    contentId: row.content_id,
    eventSequence: row.event_sequence,
    freshness: row.freshness,
    nextAction: row.next_action,
    observationIdentity: row.observation_identity,
    observedAt: row.observed_at,
    policyVersion: row.policy_version,
    provider: row.provider,
    reasonCode: row.reason_code,
    runId: row.run_id,
    sourceRevision: row.source_revision,
    status: row.status,
    summary: JSON.parse(row.summary_json) as unknown,
    target: { id: row.target_id, kind: row.target_kind },
    taskId: row.task_id,
  })
}

function projectionFromRow(row: CurrentRow): AvailabilityCurrentProjection {
  return {
    ...observationFromRow(row),
    projectionVersion: row.projection_version,
  }
}

function sameObservation(left: AvailabilityObservation, right: AvailabilityObservation): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function readSnapshotBinding(row: BindingRow, observation: AvailabilityObservation, expectedPolicyReference?: string): string | undefined {
  try {
    const parsed = JSON.parse(row.request_snapshot_json) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return 'task_snapshot_invalid'

    const snapshot = parsed as Record<string, unknown>
    const target = snapshot.target
    if (!target || typeof target !== 'object' || Array.isArray(target))
      return 'target_binding_missing'
    const targetValue = target as Record<string, unknown>
    if (targetValue.kind !== observation.target.kind || targetValue.id !== observation.target.id)
      return 'target_binding_mismatch'

    if (typeof snapshot.policyVersion !== 'string' || snapshot.policyVersion !== observation.policyVersion)
      return 'policy_binding_mismatch'
    if (expectedPolicyReference !== undefined
      && (typeof snapshot.policyReference !== 'string' || snapshot.policyReference !== expectedPolicyReference)) {
      return 'policy_reference_binding_mismatch'
    }

    const intent = snapshot.intent
    if (intent && typeof intent === 'object' && !Array.isArray(intent)) {
      const sourceRevision = (intent as Record<string, unknown>).sourceRevision
      if (sourceRevision !== undefined && sourceRevision !== observation.sourceRevision)
        return 'source_revision_binding_mismatch'
    }
    return undefined
  }
  catch {
    return 'task_snapshot_invalid'
  }
}

function result(
  kind: Exclude<AvailabilityRepositoryResult['kind'], 'accepted'>,
  authoritativeReadback: AvailabilityCurrentProjection | null,
  reason?: string,
  authoritativeObservation?: AvailabilityObservation,
): AvailabilityRepositoryResult {
  return {
    accepted: false,
    authoritativeReadback,
    kind,
    ...(authoritativeObservation ? { authoritativeObservation } : {}),
    ...(reason ? { reason } : {}),
  }
}

const currentSelect = `
      SELECT id, task_id, run_id, attempt_number, provider, target_kind, target_id,
        content_id, source_revision, policy_version, observation_identity,
        event_sequence, projection_version, freshness, status, reason_code,
        next_action, summary_json, observed_at, updated_at
      FROM crawler_availability_current
`

const observationSelect = `
      SELECT task_id, run_id, attempt_number, provider, target_kind, target_id,
        content_id, source_revision, policy_version, observation_identity,
        event_sequence, freshness, status, reason_code, next_action,
        summary_json, observed_at
      FROM crawler_availability_observation
`

export function createAvailabilityRepository(
  database: Pick<Database, '$client'>,
  options: AvailabilityRepositoryOptions = {},
) {
  const d1 = asD1Client(database)
  const createId = options.createId ?? (() => crypto.randomUUID())
  const now = options.now ?? (() => Math.floor(Date.now() / 1000))

  async function readBinding(runId: string): Promise<BindingRow | undefined> {
    const rows = await d1.prepare(`
      SELECT run.attempt_number, run.last_event_sequence, run.id AS run_id, run.status AS run_status, run.task_id,
        run.receipt_primary_content_id, run.receipt_source_revision,
        task.latest_run_id, task.request_snapshot_json,
        provider.provider AS provider_name
      FROM crawler_run AS run
      INNER JOIN crawler_task AS task ON task.id = run.task_id
      LEFT JOIN crawler_run_provider_association AS provider
        ON provider.run_id = run.id AND provider.application_attempt = run.attempt_number
      WHERE run.id = ?
      LIMIT 1
    `).bind(runId).all<BindingRow>()
    return rows.results?.[0]
  }

  async function readCurrent(observation: AvailabilityObservation): Promise<AvailabilityCurrentProjection | null> {
    const rows = await d1.prepare(`${currentSelect}
      WHERE target_kind = ? AND target_id = ? AND content_id = ?
      LIMIT 1
    `).bind(observation.target.kind, observation.target.id, observation.contentId).all<CurrentRow>()
    const row = rows.results?.[0]
    return row ? projectionFromRow(row) : null
  }

  async function readExisting(observation: AvailabilityObservation): Promise<ObservationRow | undefined> {
    const rows = await d1.prepare(`${observationSelect}
      WHERE observation_identity = ?
         OR (run_id = ? AND attempt_number = ? AND event_sequence = ?)
      LIMIT 1
    `).bind(
      observation.observationIdentity,
      observation.runId,
      observation.attemptNumber,
      observation.eventSequence,
    ).all<ObservationRow>()
    return rows.results?.[0]
  }

  async function readAuthoritative(input: ReadAuthoritativeAvailabilityInput): Promise<{
    readonly current: AvailabilityCurrentProjection | null
    readonly history: readonly AvailabilityObservation[]
  }> {
    const historyLimit = Math.min(Math.max(input.historyLimit ?? 20, 1), 50)
    const [currentRows, historyRows] = await Promise.all([
      d1.prepare(`${currentSelect}
        WHERE target_kind = ? AND target_id = ? AND content_id = ?
          AND source_revision = ? AND policy_version = ?
        LIMIT 1
      `).bind(
        input.target.kind,
        input.target.id,
        input.contentId,
        input.sourceRevision,
        input.policyVersion,
      ).all<CurrentRow>(),
      d1.prepare(`${observationSelect}
        WHERE target_kind = ? AND target_id = ? AND content_id = ?
        ORDER BY observed_at DESC, event_sequence DESC
        LIMIT ?
      `).bind(input.target.kind, input.target.id, input.contentId, historyLimit + 1).all<ObservationRow>(),
    ])
    const currentRow = currentRows.results?.[0]
    const current = currentRow ? projectionFromRow(currentRow) : null
    const history = (historyRows.results ?? [])
      .map(observationFromRow)
      .filter(observation => observation.observationIdentity !== current?.observationIdentity)
      .slice(0, historyLimit)
    return { current, history }
  }

  function appendStatement(observation: AvailabilityObservation, binding: BindingRow): D1Statement {
    return d1.prepare(`
      INSERT INTO crawler_availability_observation (
        id, task_id, run_id, attempt_number, provider, target_kind, target_id,
        content_id, source_revision, policy_version, observation_identity,
        event_sequence, freshness, status, reason_code, next_action,
        summary_json, observed_at, created_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1
        FROM crawler_run AS run
        INNER JOIN crawler_task AS task ON task.id = run.task_id
        INNER JOIN crawler_run_provider_association AS provider
          ON provider.run_id = run.id AND provider.application_attempt = run.attempt_number
        WHERE run.id = ? AND run.task_id = ? AND run.attempt_number = ?
          AND provider.provider = ?
          AND run.receipt_primary_content_id = ?
          AND run.receipt_source_revision = ?
      )
    `).bind(
      createId(),
      observation.taskId,
      observation.runId,
      observation.attemptNumber,
      observation.provider,
      observation.target.kind,
      observation.target.id,
      observation.contentId,
      observation.sourceRevision,
      observation.policyVersion,
      observation.observationIdentity,
      observation.eventSequence,
      observation.freshness,
      observation.status,
      observation.reasonCode,
      observation.nextAction,
      JSON.stringify(observation.summary),
      observation.observedAt,
      now(),
      observation.runId,
      observation.taskId,
      observation.attemptNumber,
      observation.provider,
      binding.receipt_primary_content_id,
      binding.receipt_source_revision,
    )
  }

  function currentStatement(
    observation: AvailabilityObservation,
    expectedProjectionVersion: number,
  ): D1Statement {
    return d1.prepare(`
      INSERT INTO crawler_availability_current (
        id, task_id, run_id, attempt_number, provider, target_kind, target_id,
        content_id, source_revision, policy_version, observation_identity,
        event_sequence, projection_version, freshness, status, reason_code,
        next_action, summary_json, observed_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE changes() = 1
      ON CONFLICT(target_kind, target_id, content_id) DO UPDATE SET
        task_id = excluded.task_id,
        run_id = excluded.run_id,
        attempt_number = excluded.attempt_number,
        provider = excluded.provider,
        source_revision = excluded.source_revision,
        policy_version = excluded.policy_version,
        observation_identity = excluded.observation_identity,
        event_sequence = excluded.event_sequence,
        projection_version = excluded.projection_version,
        freshness = excluded.freshness,
        status = excluded.status,
        reason_code = excluded.reason_code,
        next_action = excluded.next_action,
        summary_json = excluded.summary_json,
        observed_at = excluded.observed_at,
        updated_at = excluded.updated_at
      WHERE crawler_availability_current.projection_version = ?
        AND crawler_availability_current.source_revision <= ?
        AND crawler_availability_current.policy_version = ?
        AND excluded.observed_at >= crawler_availability_current.observed_at
    `).bind(
      createId(),
      observation.taskId,
      observation.runId,
      observation.attemptNumber,
      observation.provider,
      observation.target.kind,
      observation.target.id,
      observation.contentId,
      observation.sourceRevision,
      observation.policyVersion,
      observation.observationIdentity,
      observation.eventSequence,
      expectedProjectionVersion + 1,
      observation.freshness,
      observation.status,
      observation.reasonCode,
      observation.nextAction,
      JSON.stringify(observation.summary),
      observation.observedAt,
      now(),
      expectedProjectionVersion,
      observation.sourceRevision,
      observation.policyVersion,
    )
  }

  function currentReadStatement(observation: AvailabilityObservation): D1Statement {
    return d1.prepare(`${currentSelect}
      WHERE target_kind = ? AND target_id = ? AND content_id = ?
      LIMIT 1
    `).bind(observation.target.kind, observation.target.id, observation.contentId)
  }

  function observationReadStatement(observation: AvailabilityObservation): D1Statement {
    return d1.prepare(`${observationSelect}
      WHERE observation_identity = ?
      LIMIT 1
    `).bind(observation.observationIdentity)
  }

  function readBatchCurrent(result: D1Result | undefined): AvailabilityCurrentProjection | null {
    const row = result?.results?.[0] as CurrentRow | undefined
    return row ? projectionFromRow(row) : null
  }

  function readBatchObservation(result: D1Result | undefined): AvailabilityObservation | null {
    const row = result?.results?.[0] as ObservationRow | undefined
    return row ? observationFromRow(row) : null
  }

  async function restoreCurrent(
    observation: AvailabilityObservation,
    previous: AvailabilityCurrentProjection | null,
    expectedProjectionVersion: number,
  ): Promise<void> {
    if (!previous) {
      await d1.prepare(`
        DELETE FROM crawler_availability_current
        WHERE target_kind = ? AND target_id = ? AND content_id = ?
          AND observation_identity = ? AND projection_version = ?
      `).bind(
        observation.target.kind,
        observation.target.id,
        observation.contentId,
        observation.observationIdentity,
        expectedProjectionVersion + 1,
      ).run()
      return
    }

    await d1.prepare(`
      UPDATE crawler_availability_current
      SET task_id = ?, run_id = ?, attempt_number = ?, provider = ?,
        source_revision = ?, policy_version = ?, observation_identity = ?,
        event_sequence = ?, projection_version = ?, freshness = ?, status = ?,
        reason_code = ?, next_action = ?, summary_json = ?, observed_at = ?, updated_at = ?
      WHERE target_kind = ? AND target_id = ? AND content_id = ?
        AND observation_identity = ? AND projection_version = ?
    `).bind(
      previous.taskId,
      previous.runId,
      previous.attemptNumber,
      previous.provider,
      previous.sourceRevision,
      previous.policyVersion,
      previous.observationIdentity,
      previous.eventSequence,
      previous.projectionVersion,
      previous.freshness,
      previous.status,
      previous.reasonCode,
      previous.nextAction,
      JSON.stringify(previous.summary),
      previous.observedAt,
      now(),
      observation.target.kind,
      observation.target.id,
      observation.contentId,
      observation.observationIdentity,
      expectedProjectionVersion + 1,
    ).run()
  }

  async function appendRejected(
    observation: AvailabilityObservation,
    binding: BindingRow,
    current: AvailabilityCurrentProjection | null,
    kind: Extract<AvailabilityRepositoryResult, { accepted: false }>['kind'],
    reason?: string,
  ): Promise<AvailabilityRepositoryResult> {
    try {
      const appended = await d1.batch([appendStatement(observation, binding)])
      if (changes(appended[0]) !== 1)
        return result('rejected', current, 'append_not_bound')
    }
    catch {
      return result('rejected', current, 'append_failed')
    }

    try {
      const authoritativeReadback = await readCurrent(observation)
      return result(kind, authoritativeReadback, reason)
    }
    catch {
      return result('rejected', current, 'authoritative_readback_failed')
    }
  }

  async function persist(input: PersistAvailabilityObservationInput): Promise<AvailabilityRepositoryResult> {
    let observation: AvailabilityObservation
    try {
      observation = validateAvailabilityObservation(input.observation)
    }
    catch {
      return result('rejected', null, 'observation_contract_invalid')
    }

    if (observation.observationIdentity.length > MAX_IDENTIFIER_LENGTH)
      return result('rejected', null, 'observation_identity_invalid')

    let binding: BindingRow | undefined
    let current: AvailabilityCurrentProjection | null
    let existing: ObservationRow | undefined
    try {
      binding = await readBinding(observation.runId)
      if (!binding)
        return result('rejected', null, 'run_not_found')
      current = await readCurrent(observation)
      existing = await readExisting(observation)
    }
    catch {
      return result('rejected', null, 'binding_read_failed')
    }

    if (binding.task_id !== observation.taskId
      || binding.run_id !== observation.runId
      || binding.attempt_number !== observation.attemptNumber
      || binding.provider_name !== observation.provider) {
      return result('rejected', current, 'tuple_binding_mismatch')
    }

    const snapshotReason = readSnapshotBinding(binding, observation, input.expectedPolicyReference)
    if (snapshotReason)
      return result('rejected', current, snapshotReason)

    if (binding.receipt_primary_content_id === null || binding.receipt_source_revision === null)
      return result('rejected', current, 'receipt_binding_missing')
    if (binding.receipt_primary_content_id !== observation.contentId)
      return result('stale', current, 'receipt_content_mismatch')
    if (binding.receipt_source_revision !== observation.sourceRevision)
      return result('stale', current, 'receipt_revision_mismatch')

    if (existing) {
      let persisted: AvailabilityObservation
      try {
        persisted = observationFromRow(existing)
      }
      catch {
        return result('rejected', current, 'persisted_observation_invalid')
      }
      return sameObservation(persisted, observation)
        ? result('duplicate', current, undefined, persisted)
        : result('conflict', current, 'observation_identity_replay_conflict', persisted)
    }

    if (observation.eventSequence <= binding.last_event_sequence)
      return appendRejected(observation, binding, current, 'late', 'event_sequence_not_fresh')

    let expectedTuple: AvailabilityTuple
    let classified: ReturnType<typeof classifyAvailabilityCas> | undefined
    try {
      expectedTuple = input.expectedTuple as AvailabilityTuple
      if (observation.sourceRevision !== input.expectedSourceRevision)
        return appendRejected(observation, binding, current, 'stale', 'expected_source_revision_mismatch')
      classified = classifyAvailabilityCas({
        current,
        expectedPolicyVersion: input.expectedPolicyVersion,
        expectedProjectionVersion: input.expectedProjectionVersion,
        expectedSourceRevision: input.expectedSourceRevision,
        expectedTuple,
        observation,
      })
    }
    catch {
      return result('rejected', current, 'cas_contract_invalid')
    }

    const bindingLate = binding.latest_run_id !== observation.runId
      || binding.run_status === 'cancelled'
      || binding.run_status === 'cancel_requested'
    if (bindingLate)
      return appendRejected(observation, binding, current, 'late', 'run_is_late_or_cancelled')
    if (!classified.accepted)
      return appendRejected(observation, binding, current, classified.code, classified.code)

    try {
      const batchResult = await d1.batch([
        appendStatement(observation, binding),
        currentStatement(observation, input.expectedProjectionVersion),
        currentReadStatement(observation),
        observationReadStatement(observation),
      ])
      if (changes(batchResult[0]) !== 1 || changes(batchResult[1]) !== 1)
        return result('stale', await readCurrent(observation), 'projection_cas_failed')

      const authoritativeReadback = readBatchCurrent(batchResult[2])
      const authoritativeObservation = readBatchObservation(batchResult[3])
      if (!authoritativeReadback || !authoritativeObservation) {
        await restoreCurrent(observation, current, input.expectedProjectionVersion)
        return result('rejected', authoritativeReadback, 'authoritative_readback_missing')
      }
      if (authoritativeReadback.observationIdentity !== observation.observationIdentity) {
        await restoreCurrent(observation, current, input.expectedProjectionVersion)
        return result('rejected', authoritativeReadback, 'authoritative_projection_mismatch', authoritativeObservation)
      }

      if (options.invalidateCache) {
        try {
          await options.invalidateCache(authoritativeReadback)
        }
        catch {
          return result('rejected', authoritativeReadback, 'cache_invalidation_failed', authoritativeObservation)
        }
      }

      return {
        accepted: true,
        authoritativeObservation,
        authoritativeReadback,
        kind: 'accepted',
        projection: authoritativeReadback,
      }
    }
    catch {
      return result('rejected', current, 'append_or_projection_write_failed')
    }
  }

  return { persist, readAuthoritative }
}
