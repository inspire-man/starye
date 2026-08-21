import type { AvailabilityCurrentProjection, AvailabilityObservation } from '../../../domain/crawler-tasks/availability-contract'
import type { CrawlerTaskOperation, CrawlerTaskTemplateKey, ProviderName } from '../../../domain/crawler-tasks/types'
import type { SourceReadinessProjection } from '../../../domain/movies/source-contract'
import type { PlaybackEvidenceSummary } from '../../../domain/playback-evidence/types'
import type { GitHubActionsClient } from '../../../lib/github-app/github-actions-client'
import type { AppEnv, SessionUser } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import { validateAvailabilityObservation } from '../../../domain/crawler-tasks/availability-contract'
import { createProviderAssociationSummary, createProviderDispatchInput, createProviderSnapshot, LOCAL_PROOF_POLICY_REFERENCE, LOCAL_PROOF_POLICY_VERSION } from '../../../domain/crawler-tasks/provider-association'
import { createCrawlerTaskRepository, decodeCrawlerTaskCursor, encodeCrawlerTaskCursor } from '../../../domain/crawler-tasks/repository'
import { getCrawlerTaskTemplate, readCrawlerTaskSnapshot } from '../../../domain/crawler-tasks/template-registry'
import { createServerReadinessProjection } from '../../../domain/movies/source-contract'
import { createPlaybackArtifactReference, createPlaybackEvidenceRepository } from '../../../domain/playback-evidence/repository'
import { VIDEO_PROBE_POLICY_V1 } from '../../../domain/video-availability/probe-policy'
import { createGitHubActionsClient } from '../../../lib/github-app/github-actions-client'
import { canAccessCrawler } from '../../../lib/permissions'
import { createAuditLog } from '../../../middleware/audit-logger'
import {
  ChapterAvailabilityCommandSchema,
  CrawlerTaskAuditQuerySchema,
  CrawlerTaskIdParamsSchema,
  CrawlerTaskLogsQuerySchema,
  CrawlerTaskRunParamsSchema,
  CreateCrawlerTaskSchema,
  ListCrawlerTasksQuerySchema,
  RetryCrawlerTaskSchema,
  SupersedeCrawlerTaskSchema,
  UpdateCrawlerTaskSchema,
  VideoAvailabilityCommandSchema,
} from '../../../schemas/crawler-tasks'
import { PlaybackEvidenceRequestSchema } from '../../../schemas/playback-evidence'

interface D1Statement {
  all: <T>() => Promise<{ results?: T[] }>
  bind: (...values: unknown[]) => D1Statement
}

interface D1Client {
  prepare: (query: string) => D1Statement
}

type CrawlerRepository = ReturnType<typeof createCrawlerTaskRepository>

function createProviderClient(env: AppEnv['Bindings']): GitHubActionsClient | undefined {
  if (!env)
    return undefined
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_INSTALLATION_ID || !env.GITHUB_APP_PRIVATE_KEY
    || !env.GITHUB_ACTIONS_OWNER || !env.GITHUB_ACTIONS_REPOSITORY || !env.GITHUB_ACTIONS_ENVIRONMENT) {
    return undefined
  }
  return createGitHubActionsClient({
    bindings: {
      appId: env.GITHUB_APP_ID,
      environment: env.GITHUB_ACTIONS_ENVIRONMENT,
      installationId: env.GITHUB_APP_INSTALLATION_ID,
      owner: env.GITHUB_ACTIONS_OWNER,
      privateKeyPem: env.GITHUB_APP_PRIVATE_KEY,
      repository: env.GITHUB_ACTIONS_REPOSITORY,
    },
  })
}

function localProofRuntimeReady(env: AppEnv['Bindings']): boolean {
  return env?.CRAWLER_LOCAL_PROOF_ENABLED === 'true'
    && Boolean(env.TASK_RUNNER_CALLBACK_KEY_ID_CURRENT?.trim())
    && Boolean(env.TASK_RUNNER_CALLBACK_SECRET_CURRENT?.trim())
}

function isLocalProofOperation(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false
  const command = value as Record<string, unknown>
  const target = command.target
  const intent = command.intent
  return command.operation === 'movie'
    && command.policyReference === LOCAL_PROOF_POLICY_REFERENCE
    && command.policyVersion === LOCAL_PROOF_POLICY_VERSION
    && Boolean(target && typeof target === 'object' && !Array.isArray(target) && (target as Record<string, unknown>).kind === 'movie')
    && Boolean(intent && typeof intent === 'object' && !Array.isArray(intent) && (intent as Record<string, unknown>).kind === 'crawl')
}

function projectProviderResult(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== 'object' || Array.isArray(result))
    return { kind: 'provider_unavailable' }
  const value = result as Record<string, unknown>
  if (value.ok === true)
    return { accepted: true, kind: value.value && typeof value.value === 'object' ? (value.value as Record<string, unknown>).kind ?? 'provider_accepted' : 'provider_accepted' }
  return {
    ...(typeof value.code === 'string' ? { code: value.code } : {}),
    ...(typeof value.retryable === 'boolean' ? { retryable: value.retryable } : {}),
    ...(typeof value.status === 'number' ? { status: value.status } : {}),
  }
}

async function dispatchCreatedRun(
  c: any,
  repository: CrawlerRepository,
  input: { readonly runId: string, readonly attempt: number, readonly template: CrawlerTaskTemplateKey },
  options: { readonly localProofRequested?: boolean, readonly provider?: ProviderName } = {},
): Promise<Record<string, unknown>> {
  const wantsLocalProof = options.provider === 'local-proof' || options.localProofRequested === true
  if (wantsLocalProof) {
    if (!localProofRuntimeReady(c.env as AppEnv['Bindings'])) {
      return { kind: 'provider_not_configured' }
    }
    const association = await repository.ensureProviderAssociation?.({
      attempt: input.attempt,
      provider: 'local-proof',
      runId: input.runId,
      template: input.template,
    })
    if (!association || association.provider !== 'local-proof')
      return { kind: 'provider_not_configured' }
    return {
      association: {
        applicationAttempt: association.applicationAttempt,
        provider: 'local-proof',
        providerRunId: association.providerRunId,
        runId: association.runId,
      },
      provider: { accepted: true, kind: 'local-proof_queued' },
    }
  }
  const provider = createProviderClient(c.env as AppEnv['Bindings'])
  if (!provider)
    return { kind: 'provider_not_configured' }

  const association = await repository.ensureProviderAssociation?.({
    attempt: input.attempt,
    runId: input.runId,
    template: input.template,
  })
  const decision = await repository.claimDispatch?.(input.runId)
  const snapshot = createProviderSnapshot(input.template)
  const result = await provider.dispatchWorkflow({
    dispatch: createProviderDispatchInput({ attempt: input.attempt, runId: input.runId, templateKey: input.template }),
    snapshot,
  })
  if (!result.ok && !result.retryable)
    await repository.failProviderReconciliation?.(input.runId, input.attempt, result.code)
  return {
    ...(association ? { association: { runId: association.runId, applicationAttempt: association.applicationAttempt } } : {}),
    ...(decision ? { decision } : {}),
    provider: projectProviderResult(result),
  }
}

interface TaskAccessRow {
  operation?: CrawlerTaskOperation
  request_snapshot_json?: string
  template_key: CrawlerTaskTemplateKey
}

interface RepairMovieLookupRow {
  code: string
  id: string
  source_disposition: 'ready' | 'no_source' | 'repairing' | 'source_failed' | null
  source_reason: string | null
  source_revision: number | null
  title: string
}

interface VideoAvailabilityMovieLookupRow {
  id: string
  source_revision: number | null
}

interface RepairTaskRow {
  created_at: number
  id: string
  latest_run_id: string | null
  operation: 'movie' | 'manga' | 'repair_players'
  request_snapshot_json: string
  template_key: CrawlerTaskTemplateKey
  updated_at: number
}

interface RepairRunRow {
  attempt_number: number
  cancel_requested_at: number | null
  created_at: number
  failure_code: string | null
  id: string
  last_heartbeat_at: number | null
  lease_expires_at: number | null
  active_lease_expires_at: number | null
  active_lease_renewed_at: number | null
  provider: string | null
  provider_conclusion: string | null
  provider_run_attempt: number | null
  provider_run_id: string | null
  provider_status: string | null
  provider_updated_at: number | null
  provider_environment: string | null
  provider_ref: string | null
  provider_repository: string | null
  provider_sha: string | null
  provider_workflow: string | null
  provider_reconciliation_window_ends_at: number | null
  state_version: number
  receipt_summary_json: string | null
  receipt_primary_content_id: string | null
  receipt_schema_version: number | null
  receipt_source_revision: number | null
  status: string
  task_id: string
  terminal_at: number | null
  updated_at: number
}

interface RepairTransitionRow {
  created_at: number
  reason_code: string
  run_id: string
  safe_summary: string | null
}

interface RepairRunnerEventRow {
  outcome: string
  received_at: number
  run_id: string
}

interface AvailabilityObservationRow {
  attempt_number: number
  content_id: string
  event_sequence: number
  freshness: string
  next_action: string
  observation_identity: string
  observed_at: number
  policy_version: string
  provider: string
  reason_code: string
  run_id: string
  source_revision: number
  status: string
  summary_json: string
  target_id: string
  target_kind: string
  task_id: string
}

interface AvailabilityCurrentRow extends AvailabilityObservationRow {
  projection_version: number
}

interface AvailabilityRunnerEventRow {
  outcome: string
  received_at: number
  run_id: string
  sequence: number
}

type AvailabilityHistoryKind = 'accepted' | 'conflict' | 'duplicate' | 'late' | 'rejected' | 'stale'

interface AvailabilityHistoryEntry {
  kind: AvailabilityHistoryKind
  observation: AvailabilityObservation | null
  reason?: string
}

const availabilityHistoryKinds = new Set<AvailabilityHistoryKind>([
  'accepted',
  'conflict',
  'duplicate',
  'late',
  'rejected',
  'stale',
])
const MAX_AVAILABILITY_HISTORY = 50
const MAX_AVAILABILITY_JSON_BYTES = 32_768

interface RepairSourceStateRow {
  disposition: 'ready' | 'no_source' | 'repairing' | 'source_failed'
  eligible_count: number
  observed_at: number
  reason_code: string | null
  repairable: number | boolean
  source_revision: number
}

interface RepairSourceObservationRow {
  eligible: number | boolean
  health: string
  observed_at: number
  reason_code: string
  source_type: string
}

const RepairPlayersCommandSchema = v.strictObject({
  confirmed: v.literal(true),
  idempotencyKey: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))),
  movieId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128)),
  reason: v.picklist(['no_source', 'source_failed']),
  targetIntent: v.literal('restore_playable_sources'),
})

interface SafeCrawlerReceipt {
  createdCount: number
  primaryContentId: string
  receiptSchemaVersion?: 2
  source?: SourceReadinessProjection
  templateKey: CrawlerTaskTemplateKey
  updatedCount: number
}

interface PersistedReceiptColumns {
  receipt_schema_version?: unknown
  receipt_primary_content_id?: unknown
  receipt_source_revision?: unknown
}

function projectReceipt(status: unknown, raw: unknown, persisted: PersistedReceiptColumns = {}): SafeCrawlerReceipt | null {
  if (status !== 'succeeded' || typeof raw !== 'string') {
    return status === 'succeeded' && raw && typeof raw === 'object' && !Array.isArray(raw)
      ? projectReceipt(status, JSON.stringify(raw), persisted)
      : null
  }
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null
    const receipt = value as Record<string, unknown>
    if ((receipt.templateKey !== 'movie' && receipt.templateKey !== 'manga')
      || typeof receipt.primaryContentId !== 'string'
      || !/^\w[\w-]{0,127}$/u.test(receipt.primaryContentId)
      || receipt.primaryContentId.length === 0
      || typeof receipt.createdCount !== 'number'
      || !Number.isInteger(receipt.createdCount)
      || receipt.createdCount < 0
      || typeof receipt.updatedCount !== 'number'
      || !Number.isInteger(receipt.updatedCount)) {
      return null
    }
    if (receipt.updatedCount < 0
      || (receipt.receiptSchemaVersion !== undefined && receipt.receiptSchemaVersion !== 2)
      || (persisted.receipt_schema_version !== undefined
        && persisted.receipt_schema_version !== null
        && persisted.receipt_schema_version !== 2)
      || (typeof persisted.receipt_primary_content_id === 'string'
        && persisted.receipt_primary_content_id.length > 0
        && persisted.receipt_primary_content_id !== receipt.primaryContentId)) {
      return null
    }

    let source: SourceReadinessProjection | undefined
    if (receipt.source !== undefined) {
      if (!receipt.source || typeof receipt.source !== 'object' || Array.isArray(receipt.source))
        return null
      const candidate = receipt.source as Record<string, unknown>
      const reasonCodes = ['no_eligible_source', 'repair_requested', 'source_candidate_invalid', 'source_read_failed', 'source_write_failed']
      const validReason = candidate.reasonCode === null
        || (typeof candidate.reasonCode === 'string' && reasonCodes.includes(candidate.reasonCode))
      if ((candidate.disposition !== 'ready'
        && candidate.disposition !== 'no_source'
        && candidate.disposition !== 'source_failed'
        && candidate.disposition !== 'repairing')
      || typeof candidate.eligibleCount !== 'number'
      || !Number.isSafeInteger(candidate.eligibleCount)
      || candidate.eligibleCount < 0
      || typeof candidate.observedAt !== 'number'
      || !Number.isSafeInteger(candidate.observedAt)
      || candidate.observedAt < 0
      || typeof candidate.repairable !== 'boolean'
      || !validReason
      || typeof candidate.sourceRevision !== 'number'
      || !Number.isSafeInteger(candidate.sourceRevision)
      || candidate.sourceRevision < 0
      || (typeof persisted.receipt_source_revision === 'number'
        && persisted.receipt_source_revision !== candidate.sourceRevision)) {
        return null
      }
      source = {
        disposition: candidate.disposition,
        eligibleCount: candidate.eligibleCount,
        observedAt: candidate.observedAt,
        reasonCode: candidate.reasonCode,
        repairable: candidate.repairable,
        sourceRevision: candidate.sourceRevision,
      } as SourceReadinessProjection
    }

    return {
      createdCount: receipt.createdCount,
      primaryContentId: receipt.primaryContentId,
      ...(receipt.receiptSchemaVersion === 2 || persisted.receipt_schema_version === 2 ? { receiptSchemaVersion: 2 as const } : {}),
      ...(source ? { source } : {}),
      templateKey: receipt.templateKey,
      updatedCount: receipt.updatedCount,
    }
  }
  catch {
    return null
  }
}

function projectReadiness(row: Record<string, unknown>, receipt: SafeCrawlerReceipt | null): ReturnType<typeof createServerReadinessProjection> | null {
  if (!receipt || receipt.templateKey !== 'movie')
    return null
  const observedAt = row.terminal_at ?? row.terminalAt ?? row.updated_at ?? row.updatedAt ?? row.created_at ?? row.createdAt
  const source = receipt.source ?? {
    disposition: 'source_failed' as const,
    eligibleCount: 0,
    observedAt: typeof observedAt === 'number' && Number.isSafeInteger(observedAt) && observedAt >= 0 ? observedAt : 0,
    reasonCode: 'source_read_failed' as const,
    repairable: true,
    sourceRevision: typeof row.receipt_source_revision === 'number' && Number.isSafeInteger(row.receipt_source_revision) && row.receipt_source_revision >= 0
      ? row.receipt_source_revision
      : 0,
  }
  return createServerReadinessProjection({
    contentId: receipt.primaryContentId,
    // Run lifecycle timestamps do not prove that metadata was persisted. The
    // authoritative movie readback only promotes metadata with explicit,
    // revision-bound evidence.
    metadata: { observedAt: null, persisted: false },
    receipt: {
      persisted: true,
      primaryContentId: receipt.primaryContentId,
      schemaVersion: receipt.receiptSchemaVersion ?? null,
    },
    sourceState: source,
  })
}

function projectRun(row: Record<string, unknown>): Record<string, unknown> {
  const {
    receipt: rawReceipt,
    receipt_primary_content_id: _receiptPrimaryContentId,
    receipt_schema_version: _receiptSchemaVersion,
    receipt_source_revision: _receiptSourceRevision,
    receipt_summary_json: receiptSummary,
    ...safeRun
  } = row
  const receipt = projectReceipt(row.status, receiptSummary ?? rawReceipt, {
    receipt_primary_content_id: row.receipt_primary_content_id,
    receipt_schema_version: row.receipt_schema_version,
    receipt_source_revision: row.receipt_source_revision,
  })
  return {
    ...safeRun,
    receipt,
    ...(receipt ? { readiness: projectReadiness(row, receipt) } : {}),
  }
}

interface PlaybackEvidenceTaskReadModel {
  readonly runs: readonly {
    readonly runId: string
    readonly summary: PlaybackEvidenceSummary | null
    readonly rejections: readonly unknown[]
  }[]
}

function projectPlaybackEvidence(
  evidence: PlaybackEvidenceTaskReadModel,
  currentRunId: string | null,
): Record<string, unknown> {
  const current = currentRunId
    ? evidence.runs.find(run => run.runId === currentRunId) ?? null
    : null
  return {
    current,
    history: evidence.runs.filter(run => run.runId !== currentRunId),
  }
}

function projectTaskDetail(detail: { lifecycle?: unknown, task: unknown, runs: readonly unknown[] }): Record<string, unknown> {
  return {
    ...(detail.lifecycle ? { lifecycle: detail.lifecycle } : {}),
    runs: detail.runs.map(run => projectRun(run as Record<string, unknown>)),
    task: detail.task,
  }
}

function availabilityObservationValue(value: unknown): AvailabilityObservation | null {
  try {
    return validateAvailabilityObservation(value)
  }
  catch {
    return null
  }
}

function projectAvailabilityObservationRow(row: AvailabilityObservationRow): AvailabilityObservation | null {
  if (typeof row.summary_json !== 'string' || row.summary_json.length > MAX_AVAILABILITY_JSON_BYTES)
    return null
  try {
    return availabilityObservationValue({
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
      summary: JSON.parse(row.summary_json),
      target: { id: row.target_id, kind: row.target_kind },
      taskId: row.task_id,
    })
  }
  catch {
    return null
  }
}

function projectAvailabilityCurrentRow(row: AvailabilityCurrentRow): AvailabilityCurrentProjection | null {
  const observation = projectAvailabilityObservationRow(row)
  const projectionVersion = boundedNonNegativeInteger(row.projection_version, 1_000_000_000)
  return observation && projectionVersion !== undefined
    ? { ...observation, projectionVersion }
    : null
}

function projectAvailabilityEvent(row: AvailabilityRunnerEventRow): { entry: AvailabilityHistoryEntry, key: string, order: number } | null {
  if (typeof row.outcome !== 'string' || row.outcome.length > MAX_AVAILABILITY_JSON_BYTES)
    return null
  try {
    const parsed: unknown = JSON.parse(row.outcome)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return null
    const value = parsed as Record<string, unknown>
    if (typeof value.kind !== 'string' || !availabilityHistoryKinds.has(value.kind as AvailabilityHistoryKind))
      return null
    const observation = value.observation === null || value.observation === undefined
      ? null
      : availabilityObservationValue(value.observation)
    const reason = typeof value.reason === 'string' && value.reason.length <= 256 ? value.reason : undefined
    return {
      entry: {
        kind: value.kind as AvailabilityHistoryKind,
        observation,
        ...(reason ? { reason } : {}),
      },
      key: `${row.run_id}:${row.sequence}`,
      order: row.received_at,
    }
  }
  catch {
    return null
  }
}

function availabilityFallbackKind(
  observation: AvailabilityObservation,
  current: AvailabilityCurrentProjection | null,
): AvailabilityHistoryKind {
  if (observation.freshness === 'late')
    return 'late'
  if (current && observation.sourceRevision < current.sourceRevision)
    return 'stale'
  if (current && observation.observedAt < current.observedAt)
    return 'late'
  return 'accepted'
}

async function readTaskAvailability(c: any, taskId: string): Promise<{ current: AvailabilityCurrentProjection | null, history: AvailabilityHistoryEntry[] }> {
  const d1 = getD1(c)
  const [currentResult, observationsResult, eventsResult] = await Promise.all([
    d1.prepare(`
      SELECT task_id, run_id, attempt_number, provider, target_kind, target_id,
        content_id, source_revision, policy_version, observation_identity,
        event_sequence, projection_version, freshness, status, reason_code,
        next_action, summary_json, observed_at
      FROM crawler_availability_current
      WHERE task_id = ?
      ORDER BY observed_at DESC, projection_version DESC
      LIMIT 1
    `).bind(taskId).all<AvailabilityCurrentRow>().catch(() => ({ results: [] as AvailabilityCurrentRow[] })),
    d1.prepare(`
      SELECT task_id, run_id, attempt_number, provider, target_kind, target_id,
        content_id, source_revision, policy_version, observation_identity,
        event_sequence, freshness, status, reason_code, next_action,
        summary_json, observed_at
      FROM crawler_availability_observation
      WHERE task_id = ?
      ORDER BY observed_at DESC, event_sequence DESC
      LIMIT ?
    `).bind(taskId, MAX_AVAILABILITY_HISTORY).all<AvailabilityObservationRow>().catch(() => ({ results: [] as AvailabilityObservationRow[] })),
    d1.prepare(`
      SELECT event.run_id, event.sequence, event.outcome, event.received_at
      FROM crawler_runner_event AS event
      INNER JOIN crawler_run AS run ON run.id = event.run_id
      WHERE run.task_id = ?
      ORDER BY event.received_at DESC, event.sequence DESC
      LIMIT ?
    `).bind(taskId, MAX_AVAILABILITY_HISTORY).all<AvailabilityRunnerEventRow>().catch(() => ({ results: [] as AvailabilityRunnerEventRow[] })),
  ])

  const current = (currentResult.results ?? [])
    .map(projectAvailabilityCurrentRow)
    .find((row): row is AvailabilityCurrentProjection => row !== null) ?? null
  const observations = (observationsResult.results ?? [])
    .map(row => ({ key: `${row.run_id}:${row.event_sequence}`, observation: projectAvailabilityObservationRow(row) }))
    .filter((row): row is { key: string, observation: AvailabilityObservation } => row.observation !== null)
  const observationByEvent = new Map(observations.map(row => [row.key, row.observation]))
  const history: Array<{ entry: AvailabilityHistoryEntry, order: number, sequence: number, key: string }> = []
  const seenEventKeys = new Set<string>()

  for (const row of eventsResult.results ?? []) {
    const projected = projectAvailabilityEvent(row)
    if (!projected)
      continue
    const observation = projected.entry.observation ?? observationByEvent.get(projected.key) ?? null
    if (projected.entry.kind === 'accepted' && observation?.observationIdentity === current?.observationIdentity) {
      seenEventKeys.add(projected.key)
      continue
    }
    history.push({
      entry: { ...projected.entry, ...(observation ? { observation } : {}) },
      key: projected.key,
      order: projected.order,
      sequence: Number(row.sequence) || 0,
    })
    seenEventKeys.add(projected.key)
  }

  for (const row of observations) {
    if (seenEventKeys.has(row.key) || row.observation.observationIdentity === current?.observationIdentity)
      continue
    history.push({
      entry: {
        kind: availabilityFallbackKind(row.observation, current),
        observation: row.observation,
      },
      key: row.key,
      order: row.observation.observedAt,
      sequence: row.observation.eventSequence,
    })
  }

  return {
    current,
    history: history
      .sort((left, right) => right.order - left.order || right.sequence - left.sequence || right.key.localeCompare(left.key))
      .slice(0, MAX_AVAILABILITY_HISTORY)
      .map(item => item.entry),
  }
}

function readCurrentRunId(task: unknown, runs: readonly unknown[]): string | null {
  if (task && typeof task === 'object' && !Array.isArray(task)) {
    const value = task as Record<string, unknown>
    if (typeof value.latestRunId === 'string')
      return value.latestRunId
    if (typeof value.latest_run_id === 'string')
      return value.latest_run_id
  }
  const first = runs[0]
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    const value = first as Record<string, unknown>
    if (typeof value.id === 'string')
      return value.id
    if (typeof value.runId === 'string')
      return value.runId
  }
  return null
}

function allowedRepairNextAction(status: unknown, disposition?: RepairSourceProjection['disposition'] | null): 'none' | 'wait_for_observation' | 'create_new_task' {
  switch (status) {
    case 'queued':
    case 'dispatching':
    case 'running':
    case 'cancel_requested':
      return 'wait_for_observation'
    case 'failed':
    case 'cancelled':
      return disposition === undefined || disposition === null || disposition === 'no_source' || disposition === 'source_failed'
        ? 'create_new_task'
        : 'none'
    case 'succeeded':
      return disposition === 'no_source' || disposition === 'source_failed' ? 'create_new_task' : 'none'
    default:
      return 'none'
  }
}

interface RepairSourceProjection {
  disposition: 'ready' | 'no_source' | 'repairing' | 'source_failed'
  eligibleCount: number
  observedAt: number
  reasonCode: string | null
  repairable: boolean
  rows: Array<{
    eligible: boolean
    health: 'inactive' | 'unverified' | 'failed'
    observedAt: number
    reasonCode: 'source_inactive' | 'source_unverified' | 'source_candidate_invalid' | 'source_read_failed' | 'source_write_failed'
    sourceType: 'direct' | 'magnet' | 'TorrServer'
  }>
  sourceRevision: number
}

interface RepairSourceReadback extends RepairSourceProjection {
  movieId: string
  sourceCount: number
}

interface RepairLeaseProjection {
  acquiredAt?: number
  expiresAt?: number
  lastHeartbeatAt?: number
  outcome: 'pending' | 'active' | 'renewed' | 'released' | 'expired' | 'recovered'
  recoveredAt?: number
}

interface RepairReconciliationProjection {
  observedAt?: number
  outcome: 'pending' | 'observed' | 'failed' | 'lost' | 'late' | 'stale' | 'ignored' | 'duplicate' | 'conflict'
  processedAt?: number
  windowEndsAt?: number
  windowStatus: 'pending' | 'open' | 'closed' | 'expired'
}

interface RepairReceiptValidationProjection {
  failureCode?: string
  identityMatch?: boolean
  readbackMatch?: boolean
  status: 'pending' | 'validated' | 'failed'
  validatedAt?: number
}

interface RepairOutcomeProjection {
  code?: string
  observedAt?: number
  outcome: 'pending' | 'accepted' | 'contract_failure' | 'duplicate' | 'stale' | 'late' | 'ignored' | 'conflict' | 'receipt_failure'
}

type RepairReceiptProjection = ReturnType<typeof projectRepairReceipt>

const repairSourceReasonCodes = new Set([
  'no_eligible_source',
  'repair_requested',
  'source_candidate_invalid',
  'source_read_failed',
  'source_write_failed',
  'source_inactive',
  'source_unverified',
])
const repairSourceHealthReasonCodes = new Set([
  'source_inactive',
  'source_unverified',
  'source_candidate_invalid',
  'source_read_failed',
  'source_write_failed',
])
const repairSourceTypes = new Set(['direct', 'magnet', 'TorrServer'])
const repairSourceHealth = new Set(['inactive', 'unverified', 'failed'])
const repairRunStatuses = new Set(['queued', 'dispatching', 'running', 'cancel_requested'])
const repairOutcomeCodes = new Set(['accepted', 'contract_failure', 'duplicate', 'stale', 'late', 'ignored', 'conflict', 'receipt_failure'])

function boundedNonNegativeInteger(value: unknown, max = 4_000_000_000): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : undefined
}

function boundedSafeCode(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][\w.:-]{0,63}$/u.test(value))
    return undefined
  return value
}

function projectRepairReceipt(raw: unknown): {
  movieId: string
  observedAt: number
  operation: 'repair_players'
  sourceRevision: number
  sourceSummary: Array<{
    eligible: boolean
    health: 'inactive' | 'unverified' | 'failed'
    observedAt: number
    reasonCode: 'source_inactive' | 'source_unverified' | 'source_candidate_invalid' | 'source_read_failed' | 'source_write_failed'
    sourceType: 'direct' | 'magnet' | 'TorrServer'
  }>
  summary: { eligibleCount: number, sourceCount: number }
} | null {
  if (!raw)
    return null
  const value = typeof raw === 'string'
    ? (() => {
        try {
          return JSON.parse(raw)
        }
        catch {
          return null
        }
      })()
    : raw
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const receipt = value as Record<string, unknown>
  const movieId = typeof receipt.movieId === 'string' && /^\w[\w-]{0,127}$/u.test(receipt.movieId) ? receipt.movieId : null
  const observedAt = boundedNonNegativeInteger(receipt.observedAt)
  const sourceRevision = boundedNonNegativeInteger(receipt.sourceRevision, 1_000_000)
  if (receipt.operation !== 'repair_players'
    || !movieId
    || observedAt === undefined
    || sourceRevision === undefined
    || !Array.isArray(receipt.sourceSummary)) {
    return null
  }
  const sourceSummary = receipt.sourceSummary
    .filter((source): source is Record<string, unknown> => Boolean(source) && typeof source === 'object' && !Array.isArray(source))
    .map(source => ({
      eligible: source.eligible === true,
      health: source.health,
      observedAt: source.observedAt,
      reasonCode: source.reasonCode,
      sourceType: source.sourceType,
    }))
    .filter(source => (
      boundedNonNegativeInteger(source.observedAt) !== undefined
      && repairSourceHealth.has(source.health as string)
      && repairSourceHealthReasonCodes.has(source.reasonCode as string)
      && repairSourceTypes.has(source.sourceType as string)
    ))
    .slice(0, 50)
    .map(source => ({
      eligible: source.eligible,
      health: source.health as 'inactive' | 'unverified' | 'failed',
      observedAt: source.observedAt as number,
      reasonCode: source.reasonCode as 'source_inactive' | 'source_unverified' | 'source_candidate_invalid' | 'source_read_failed' | 'source_write_failed',
      sourceType: source.sourceType as 'direct' | 'magnet' | 'TorrServer',
    }))
  if (sourceSummary.length !== receipt.sourceSummary.length || receipt.sourceSummary.length > 50)
    return null
  return {
    movieId,
    observedAt,
    operation: 'repair_players' as const,
    sourceRevision,
    sourceSummary,
    summary: {
      eligibleCount: sourceSummary.filter(source => source.eligible).length,
      sourceCount: sourceSummary.length,
    },
  }
}

function projectProviderAssociation(row: RepairRunRow) {
  if (!row.provider && !row.provider_run_id && !row.provider_workflow)
    return null
  try {
    return createProviderAssociationSummary({
      environment: row.provider_environment ?? undefined,
      provider: row.provider ?? undefined,
      providerConclusion: row.provider_conclusion ?? undefined,
      providerRunAttempt: row.provider_run_attempt ?? undefined,
      providerRunId: row.provider_run_id ?? undefined,
      providerStatus: row.provider_status ?? undefined,
      ref: row.provider_ref ?? undefined,
      repository: row.provider_repository ?? undefined,
      sha: row.provider_sha ?? undefined,
      workflow: row.provider_workflow ?? undefined,
    })
  }
  catch {
    return null
  }
}

function projectRepairSourceRow(row: RepairSourceObservationRow) {
  const observedAt = boundedNonNegativeInteger(row.observed_at)
  if (observedAt === undefined
    || !repairSourceHealth.has(row.health)
    || !repairSourceReasonCodes.has(row.reason_code)
    || !repairSourceTypes.has(row.source_type)) {
    return null
  }
  return {
    eligible: row.eligible === true || row.eligible === 1,
    health: row.health as RepairSourceProjection['rows'][number]['health'],
    observedAt,
    reasonCode: row.reason_code as RepairSourceProjection['rows'][number]['reasonCode'],
    sourceType: row.source_type as RepairSourceProjection['rows'][number]['sourceType'],
  }
}

async function readRepairSourceProjection(c: any, movieId: string): Promise<{ readback: RepairSourceReadback | null, source: RepairSourceProjection | null }> {
  const stateResult = await getD1(c).prepare(`
    SELECT disposition, eligible_count, observed_at, reason_code, repairable, source_revision
    FROM movie_source_state
    WHERE movie_id = ?
    LIMIT 1
  `).bind(movieId).all<RepairSourceStateRow>()
  const state = stateResult.results?.[0]
  if (!state || !['ready', 'no_source', 'repairing', 'source_failed'].includes(state.disposition))
    return { readback: null, source: null }

  const sourceRevision = boundedNonNegativeInteger(state.source_revision, 1_000_000) ?? 0
  const observedAt = boundedNonNegativeInteger(state.observed_at) ?? 0
  const observations = await getD1(c).prepare(`
    SELECT eligible, health, observed_at, reason_code, source_type
    FROM movie_source_observation
    WHERE movie_id = ? AND source_revision = ? AND operation = 'repair_players'
    ORDER BY source_ordinal ASC, observed_at ASC
    LIMIT 50
  `).bind(movieId, sourceRevision).all<RepairSourceObservationRow>()
  const rows = (observations.results ?? [])
    .map(projectRepairSourceRow)
    .filter((row): row is NonNullable<ReturnType<typeof projectRepairSourceRow>> => row !== null)
  const reasonCode = typeof state.reason_code === 'string' && repairSourceReasonCodes.has(state.reason_code)
    ? state.reason_code
    : null
  const source: RepairSourceProjection = {
    disposition: state.disposition,
    eligibleCount: boundedNonNegativeInteger(state.eligible_count, 1_000_000) ?? rows.filter(row => row.eligible).length,
    observedAt,
    reasonCode,
    repairable: state.repairable === true || state.repairable === 1,
    rows,
    sourceRevision,
  }
  return {
    readback: {
      ...source,
      movieId,
      sourceCount: rows.length,
    },
    source,
  }
}

function repairOutcomeFromReason(reason: unknown): RepairOutcomeProjection['outcome'] | undefined {
  if (typeof reason !== 'string')
    return undefined
  if (reason === 'receipt_missing' || reason === 'repair_source_revision_conflict' || reason === 'provider_success_required')
    return 'receipt_failure'
  if (reason === 'provider_mismatch' || reason === 'conflict' || reason === 'body_conflict')
    return 'conflict'
  if (reason === 'stale_event' || reason === 'out_of_sequence_event' || reason === 'source_stale')
    return 'stale'
  if (reason === 'late')
    return 'late'
  if (reason === 'ignored')
    return 'ignored'
  if (reason === 'duplicate')
    return 'duplicate'
  if (repairOutcomeCodes.has(reason))
    return reason as RepairOutcomeProjection['outcome']
  return undefined
}

function projectRepairLease(row: RepairRunRow, now: number): RepairLeaseProjection {
  const expiresAt = boundedNonNegativeInteger(row.active_lease_expires_at)
  const lastHeartbeatAt = boundedNonNegativeInteger(row.last_heartbeat_at)
  if (expiresAt !== undefined) {
    return {
      acquiredAt: row.created_at,
      expiresAt,
      ...(lastHeartbeatAt !== undefined ? { lastHeartbeatAt } : {}),
      outcome: expiresAt <= now ? 'expired' : (row.active_lease_renewed_at && row.active_lease_renewed_at > row.created_at ? 'renewed' : 'active'),
    }
  }
  if (row.failure_code === 'runner_lost' || row.failure_code === 'provider_lost')
    return { outcome: 'expired', ...(lastHeartbeatAt !== undefined ? { lastHeartbeatAt } : {}) }
  if (repairRunStatuses.has(row.status))
    return { outcome: 'pending', ...(lastHeartbeatAt !== undefined ? { lastHeartbeatAt } : {}) }
  return { outcome: 'released', ...(lastHeartbeatAt !== undefined ? { lastHeartbeatAt } : {}) }
}

function projectRepairReconciliation(row: RepairRunRow, transitions: RepairTransitionRow[], now: number): RepairReconciliationProjection {
  const latest = transitions[0]
  let outcome: RepairReconciliationProjection['outcome'] = 'pending'
  if (latest) {
    const mapped = repairOutcomeFromReason(latest.reason_code)
    if (mapped && ['conflict', 'stale', 'late', 'ignored', 'duplicate'].includes(mapped))
      outcome = mapped as RepairReconciliationProjection['outcome']
    else if (latest.reason_code === 'provider_lost')
      outcome = 'lost'
    else if (latest.reason_code === 'provider_failed')
      outcome = 'failed'
    else if (latest.reason_code === 'provider_success_pending_receipt')
      outcome = 'observed'
  }
  if (outcome === 'pending' && row.provider_status === 'completed')
    outcome = row.provider_conclusion && row.provider_conclusion !== 'success' ? 'failed' : 'observed'
  const windowEndsAt = boundedNonNegativeInteger(row.provider_reconciliation_window_ends_at)
  const windowStatus = !row.provider_run_id
    ? 'pending'
    : row.provider_status === 'completed'
      ? 'closed'
      : windowEndsAt !== undefined && windowEndsAt <= now ? 'expired' : 'open'
  return {
    ...(boundedNonNegativeInteger(row.provider_updated_at) !== undefined ? { observedAt: boundedNonNegativeInteger(row.provider_updated_at) } : {}),
    outcome,
    ...(latest && boundedNonNegativeInteger(latest.created_at) !== undefined ? { processedAt: latest.created_at } : {}),
    ...(windowEndsAt !== undefined ? { windowEndsAt } : {}),
    windowStatus,
  }
}

function parseStoredRepairOutcome(value: string): { reason?: string, accepted?: boolean } | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return null
    const record = parsed as Record<string, unknown>
    return {
      ...(typeof record.accepted === 'boolean' ? { accepted: record.accepted } : {}),
      ...(typeof record.reason === 'string' ? { reason: record.reason } : {}),
    }
  }
  catch {
    return null
  }
}

function projectRepairOutcome(row: RepairRunRow, transitions: RepairTransitionRow[], events: RepairRunnerEventRow[]): RepairOutcomeProjection {
  const transition = transitions.find(item => repairOutcomeFromReason(item.reason_code) !== undefined)
  const event = events.map(item => parseStoredRepairOutcome(item.outcome)).find(item => item?.reason)
  const outcome = repairOutcomeFromReason(transition?.reason_code) ?? repairOutcomeFromReason(event?.reason)
    ?? (row.status === 'succeeded' ? 'accepted' : row.status === 'failed' || row.status === 'cancelled' ? 'contract_failure' : 'pending')
  const code = boundedSafeCode(row.failure_code) ?? boundedSafeCode(transition?.reason_code) ?? boundedSafeCode(event?.reason)
  return {
    ...(code ? { code } : {}),
    ...(boundedNonNegativeInteger(events[0]?.received_at) !== undefined ? { observedAt: boundedNonNegativeInteger(events[0]?.received_at) } : {}),
    outcome,
  }
}

function projectRepairReceiptValidation(
  row: RepairRunRow,
  receipt: RepairReceiptProjection,
  movieId: string,
  source: RepairSourceProjection | null,
  readback: RepairSourceReadback | null,
): RepairReceiptValidationProjection {
  if (row.status !== 'succeeded') {
    if (row.failure_code === 'receipt_missing' || row.failure_code === 'provider_success_required')
      return { failureCode: row.failure_code, status: 'failed' }
    return { status: 'pending' }
  }
  if (!receipt)
    return { failureCode: 'receipt_missing', status: 'failed' }
  const identityMatch = receipt.movieId === movieId
  const sourceRevisionMatch = source !== null && source.sourceRevision === receipt.sourceRevision
  const sourceProjectionMatch = sourceRevisionMatch
    && source.observedAt === receipt.observedAt
    && source.eligibleCount === receipt.summary.eligibleCount
    && source.rows.length === receipt.summary.sourceCount
  const readbackMatch = readback !== null
    && readback.movieId === receipt.movieId
    && readback.sourceRevision === receipt.sourceRevision
    && readback.observedAt === receipt.observedAt
    && readback.sourceCount === receipt.summary.sourceCount
    && readback.eligibleCount === receipt.summary.eligibleCount
    && readback.rows.length === receipt.sourceSummary.length
    && receipt.sourceSummary.every((expected, index) => {
      const actual = readback.rows[index]
      return Boolean(actual)
        && actual.eligible === expected.eligible
        && actual.health === expected.health
        && actual.observedAt === expected.observedAt
        && actual.reasonCode === expected.reasonCode
        && actual.sourceType === expected.sourceType
    })
  if (!identityMatch)
    return { failureCode: 'receipt_identity_mismatch', identityMatch: false, readbackMatch, status: 'failed' }
  if (!source || !readback)
    return { failureCode: 'receipt_readback_missing', identityMatch: true, readbackMatch: false, status: 'failed' }
  if (!sourceRevisionMatch)
    return { failureCode: 'receipt_revision_mismatch', identityMatch: true, readbackMatch, status: 'failed' }
  if (!sourceProjectionMatch || !readbackMatch)
    return { failureCode: 'receipt_readback_mismatch', identityMatch: true, readbackMatch: false, status: 'failed' }
  return {
    identityMatch: true,
    readbackMatch: true,
    status: 'validated',
    validatedAt: receipt.observedAt,
  }
}

function projectRepairResult(validation: RepairReceiptValidationProjection, readback: RepairSourceReadback | null) {
  if (validation.status === 'failed')
    return { failureCode: validation.failureCode, status: 'failed' as const }
  if (validation.status !== 'validated' || !readback)
    return { status: 'pending' as const }
  return { status: 'validated' as const, sourceRevision: readback.sourceRevision }
}

function readRepairSnapshot(task: RepairTaskRow) {
  try {
    const parsed = readCrawlerTaskSnapshot(JSON.parse(task.request_snapshot_json), task.operation)
    if (!parsed.ok || !('operation' in parsed.snapshot) || parsed.snapshot.operation !== 'repair_players')
      return null
    return parsed.snapshot
  }
  catch {
    return null
  }
}

async function readRepairMovieLookup(c: any, movieId: string): Promise<RepairMovieLookupRow | undefined> {
  const row = await getD1(c).prepare(`
    SELECT movie.id, movie.code, movie.title,
      state.disposition AS source_disposition,
      state.reason_code AS source_reason,
      state.source_revision
    FROM movie
    LEFT JOIN movie_source_state AS state ON state.movie_id = movie.id
    WHERE movie.id = ?
    LIMIT 1
  `).bind(movieId).all<RepairMovieLookupRow>()
  return row.results?.[0]
}

async function readVideoAvailabilityMovieLookup(c: any, movieId: string): Promise<{ id: string, sourceRevision: number } | undefined> {
  const row = await getD1(c).prepare(`
    SELECT movie.id, state.source_revision
    FROM movie
    LEFT JOIN movie_source_state AS state ON state.movie_id = movie.id
    WHERE movie.id = ?
    LIMIT 1
  `).bind(movieId).all<VideoAvailabilityMovieLookupRow>()
  const movie = row.results?.[0]
  if (!movie)
    return undefined
  const sourceRevision = movie.source_revision
  return {
    id: movie.id,
    sourceRevision: typeof sourceRevision === 'number' && Number.isSafeInteger(sourceRevision) && sourceRevision >= 0
      ? sourceRevision
      : 0,
  }
}

async function readActiveRepairTask(c: any, movieId: string): Promise<RepairTaskRow | undefined> {
  const result = await getD1(c).prepare(`
    SELECT task.id, task.template_key, task.operation, task.request_snapshot_json,
      task.latest_run_id, task.created_at, task.updated_at
    FROM crawler_task AS task
    INNER JOIN crawler_run AS run ON run.id = task.latest_run_id AND run.task_id = task.id
    WHERE task.operation = 'repair_players'
      AND run.status IN ('queued', 'dispatching', 'running', 'cancel_requested')
    ORDER BY task.updated_at DESC, task.id DESC
  `).bind().all<RepairTaskRow>()
  for (const task of result.results ?? []) {
    const snapshot = readRepairSnapshot(task)
    if (snapshot?.movieId === movieId)
      return task
  }
  return undefined
}

async function readRepairTaskResponse(
  c: any,
  input: {
    readonly movie: Pick<RepairMovieLookupRow, 'code' | 'id' | 'title'>
    readonly taskId: string
  },
) {
  const d1 = getD1(c)
  const [taskResult, runResult] = await Promise.all([
    d1.prepare(`
      SELECT id, template_key, operation, request_snapshot_json, latest_run_id, created_at, updated_at
      FROM crawler_task
      WHERE id = ?
      LIMIT 1
    `).bind(input.taskId).all<RepairTaskRow>(),
    d1.prepare(`
      SELECT run.id AS id, run.task_id AS task_id, run.attempt_number AS attempt_number,
        run.status AS status, run.failure_code AS failure_code, run.cancel_requested_at AS cancel_requested_at,
        run.last_heartbeat_at AS last_heartbeat_at, run.lease_expires_at AS lease_expires_at,
        run.state_version AS state_version,
        run.receipt_summary_json AS receipt_summary_json,
        run.receipt_primary_content_id AS receipt_primary_content_id,
        run.receipt_schema_version AS receipt_schema_version,
        run.receipt_source_revision AS receipt_source_revision,
        run.created_at AS created_at, run.updated_at AS updated_at, run.terminal_at AS terminal_at,
        provider.provider AS provider,
        provider.provider_conclusion AS provider_conclusion,
        provider.provider_run_attempt AS provider_run_attempt,
        provider.provider_run_id AS provider_run_id,
        provider.provider_status AS provider_status,
        provider.updated_at AS provider_updated_at,
        provider.environment AS provider_environment,
        provider.ref AS provider_ref,
        provider.repository AS provider_repository,
        provider.sha AS provider_sha,
        provider.workflow AS provider_workflow,
        provider.reconciliation_window_ends_at AS provider_reconciliation_window_ends_at,
        lease.expires_at AS active_lease_expires_at,
        lease.renewed_at AS active_lease_renewed_at
      FROM crawler_run AS run
      LEFT JOIN crawler_run_provider_association AS provider ON provider.run_id = run.id
      LEFT JOIN crawler_template_lease AS lease ON lease.run_id = run.id
      WHERE run.task_id = ?
      ORDER BY CASE WHEN run.id = (SELECT latest_run_id FROM crawler_task WHERE id = ?) THEN 0 ELSE 1 END,
        run.attempt_number DESC, run.id DESC
      LIMIT 50
    `).bind(input.taskId, input.taskId).all<RepairRunRow>(),
  ])
  const task = taskResult.results?.[0]
  const snapshot = task ? readRepairSnapshot(task) : null
  if (!task || !snapshot) {
    throw new HTTPException(500, { message: 'Repair task snapshot unavailable' })
  }
  const orderedRuns = [...(runResult.results ?? [])].sort((left, right) => {
    if (left.id === task.latest_run_id)
      return -1
    if (right.id === task.latest_run_id)
      return 1
    return right.attempt_number - left.attempt_number || right.id.localeCompare(left.id)
  })
  const sourceProjection = await readRepairSourceProjection(c, input.movie.id)
  const runIds = orderedRuns.map(run => run.id)
  const transitionRows = runIds.length
    ? (await d1.prepare(`
        SELECT run_id, reason_code, safe_summary, created_at
        FROM crawler_run_transition
        WHERE run_id IN (${runIds.map(() => '?').join(', ')})
        ORDER BY created_at DESC, id DESC
      `).bind(...runIds).all<RepairTransitionRow>()).results ?? []
    : []
  const runnerEventRows = runIds.length
    ? (await d1.prepare(`
        SELECT run_id, outcome, received_at
        FROM crawler_runner_event
        WHERE run_id IN (${runIds.map(() => '?').join(', ')})
        ORDER BY received_at DESC, id DESC
      `).bind(...runIds).all<RepairRunnerEventRow>()).results ?? []
    : []
  const transitionsByRun = new Map<string, RepairTransitionRow[]>()
  const eventsByRun = new Map<string, RepairRunnerEventRow[]>()
  for (const transition of transitionRows)
    transitionsByRun.set(transition.run_id, [...(transitionsByRun.get(transition.run_id) ?? []), transition])
  for (const event of runnerEventRows)
    eventsByRun.set(event.run_id, [...(eventsByRun.get(event.run_id) ?? []), event])
  const latestRawRun = orderedRuns[0]
  const now = Math.floor(Date.now() / 1000)
  const runs = orderedRuns.map((run) => {
    const receipt = projectRepairReceipt(run.receipt_summary_json)
    const current = run.id === latestRawRun?.id
    const source = current ? sourceProjection.source : null
    const readback = current ? sourceProjection.readback : null
    const receiptValidation = projectRepairReceiptValidation(run, receipt, input.movie.id, source, readback)
    const transitions = transitionsByRun.get(run.id) ?? []
    return {
      attemptNumber: run.attempt_number,
      ...(run.cancel_requested_at !== null ? { cancelRequestedAt: run.cancel_requested_at } : {}),
      createdAt: run.created_at,
      failureCode: run.failure_code,
      id: run.id,
      ...(projectProviderAssociation(run) ? { provider: projectProviderAssociation(run) } : { provider: null }),
      lease: projectRepairLease(run, now),
      reconciliation: projectRepairReconciliation(run, transitions, now),
      receiptValidation,
      repair: projectRepairResult(receiptValidation, readback),
      outcome: projectRepairOutcome(run, transitions, eventsByRun.get(run.id) ?? []),
      safeLogCursor: null,
      ...(receipt ? { observedAt: receipt.observedAt, receipt, sourceRevision: receipt.sourceRevision } : {}),
      ...(current && readback ? { sourceReadback: readback } : {}),
      status: run.status,
      terminalAt: run.terminal_at,
      updatedAt: run.updated_at,
    }
  })
  const latestRun = runs[0] ?? null
  const source = sourceProjection.source
  const readback = sourceProjection.readback
  const currentReceipt = latestRun?.receipt ?? null
  const sameMovieIdentity = currentReceipt && readback
    ? currentReceipt.movieId === input.movie.id && readback.movieId === input.movie.id
    : null
  const automaticRetry = transitionRows.some(transition => transition.reason_code === 'automatic_retry_created')
  const retry = automaticRetry && latestRawRun
    ? {
        attemptNumber: latestRawRun.attempt_number,
        automatic: true,
        ...(latestRawRun.failure_code ? { failureCode: latestRawRun.failure_code } : {}),
        maxAttempts: 2 as const,
        status: repairRunStatuses.has(latestRawRun.status)
          ? 'retrying' as const
          : latestRawRun.status === 'succeeded' ? 'none' as const : 'exhausted' as const,
      }
    : undefined
  const currentIsActive = Boolean(latestRawRun && repairRunStatuses.has(latestRawRun.status))
  return {
    run: latestRun,
    runs,
    currentAttempt: latestRun,
    history: runs.slice(1),
    task: {
      allowedNextAction: allowedRepairNextAction(latestRun?.status, source?.disposition),
      ...(currentIsActive
        ? {
            activeDuplicateLock: {
              locked: true,
              message: '当前电影已有活动修复任务，页面聚焦当前 attempt。',
            },
          }
        : {}),
      createdAt: task.created_at,
      id: task.id,
      latestRunId: task.latest_run_id,
      movie: input.movie,
      operation: 'repair_players' as const,
      reason: snapshot.reason,
      sourceRevision: source?.sourceRevision ?? snapshot.sourceRevision,
      targetIntent: snapshot.targetIntent,
      templateKey: task.template_key,
      updatedAt: task.updated_at,
      ...(retry ? { retry } : {}),
      ...(source ? { source } : {}),
      ...(readback ? { sourceReadback: readback } : {}),
      sameMovieIdentity,
    },
  }
}

function getD1(c: { get: (key: 'db') => unknown }): D1Client {
  return (c.get('db') as { $client: D1Client }).$client
}

type VideoLayerName = 'metadata' | 'direct' | 'magnet' | 'playback'

interface VideoLayerFact {
  readonly freshness: 'fresh' | 'stale' | 'late'
  readonly layer: VideoLayerName
  readonly observedAt: number
  readonly policyVersion: string
  readonly reason: string | null
  readonly sourceRevision: number
  readonly status: 'available' | 'unavailable' | 'degraded' | 'unknown'
  readonly summary: AvailabilityObservation['summary']
}

function videoSnapshot(taskAccess: TaskAccessRow | undefined) {
  if (!taskAccess?.request_snapshot_json
    || (taskAccess.operation !== 'check_video_source'
      && taskAccess.operation !== 'recheck_video_source'
      && taskAccess.operation !== 'repair_video_source')) {
    return null
  }
  try {
    const parsed = readCrawlerTaskSnapshot(JSON.parse(taskAccess.request_snapshot_json), taskAccess.operation)
    return parsed.ok && 'operation' in parsed.snapshot
      && (parsed.snapshot.operation === 'check_video_source'
        || parsed.snapshot.operation === 'recheck_video_source'
        || parsed.snapshot.operation === 'repair_video_source')
      ? parsed.snapshot
      : null
  }
  catch {
    return null
  }
}

function observationFact(layer: 'direct' | 'magnet', observation: AvailabilityObservation, reason: string): VideoLayerFact {
  return {
    freshness: observation.freshness,
    layer,
    observedAt: observation.observedAt,
    policyVersion: observation.policyVersion,
    reason: observation.status === 'available' ? null : reason,
    sourceRevision: observation.sourceRevision,
    status: observation.status,
    summary: observation.summary,
  }
}

function projectVideoAvailabilityLayers(
  detail: Record<string, unknown>,
  availability: { current: AvailabilityCurrentProjection | null, history: AvailabilityHistoryEntry[] },
  evidence: PlaybackEvidenceTaskReadModel,
  currentRunId: string | null,
  taskAccess?: TaskAccessRow,
): Record<VideoLayerName, { current: VideoLayerFact | null, history: readonly VideoLayerFact[] }> {
  const snapshot = videoSnapshot(taskAccess)
  const magnetReasons = new Set(['provider_unconfigured', 'provider_failed', 'metadata_unresolved', 'no_peer', 'stalled', 'stream_missing', 'stream_failed'])
  const sourceLayer = snapshot?.sourceKind === 'magnet'
    ? 'magnet'
    : snapshot?.sourceKind === 'direct'
      ? 'direct'
      : snapshot && magnetReasons.has(snapshot.reason)
        ? 'magnet'
        : snapshot
          ? 'direct'
          : null
  const current = sourceLayer && availability.current && snapshot
    && availability.current.sourceRevision === snapshot.sourceRevision
    && availability.current.policyVersion === snapshot.policyVersion
    ? observationFact(sourceLayer, availability.current, snapshot.reason)
    : null
  const sourceHistory = sourceLayer && snapshot
    ? availability.history.flatMap(entry => entry.observation ? [observationFact(sourceLayer, entry.observation, snapshot.reason)] : [])
    : []
  const runs = Array.isArray(detail.runs) ? detail.runs as readonly Record<string, unknown>[] : []
  const readiness = runs.find(run => run.id === currentRunId)?.readiness
  const metadata = readiness && typeof readiness === 'object' && !Array.isArray(readiness)
    ? (readiness as Record<string, unknown>).metadata
    : null
  const metadataValue = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : null
  const metadataCurrent: VideoLayerFact | null = snapshot
    ? {
        freshness: 'fresh',
        layer: 'metadata',
        observedAt: metadataValue && typeof metadataValue.observedAt === 'number' ? metadataValue.observedAt : 0,
        policyVersion: snapshot.policyVersion,
        reason: metadataValue?.persisted === true ? null : 'metadata_unresolved',
        sourceRevision: snapshot.sourceRevision,
        status: metadataValue?.persisted === true ? 'available' : 'unknown',
        summary: { counts: { persisted: metadataValue?.persisted === true ? 1 : 0 }, samples: [] },
      }
    : null
  const playbackRun = currentRunId ? evidence.runs.find(run => run.runId === currentRunId) : undefined
  const playbackSummary = playbackRun?.summary ?? null
  const playbackVerified = playbackSummary?.playback?.status === 'playback_verified'
    && playbackSummary.sourceRevision === snapshot?.sourceRevision
  const playbackCurrent: VideoLayerFact | null = snapshot && playbackRun
    ? {
        freshness: 'fresh',
        layer: 'playback',
        observedAt: playbackSummary?.observedAt ?? 0,
        policyVersion: snapshot.policyVersion,
        reason: playbackVerified ? null : 'playback_unverified',
        sourceRevision: snapshot.sourceRevision,
        status: playbackVerified ? 'available' : 'unknown',
        summary: { counts: { evidence: 1 }, samples: [] },
      }
    : null
  return {
    direct: { current: sourceLayer === 'direct' ? current : null, history: sourceLayer === 'direct' ? sourceHistory : [] },
    magnet: { current: sourceLayer === 'magnet' ? current : null, history: sourceLayer === 'magnet' ? sourceHistory : [] },
    metadata: { current: metadataCurrent, history: [] },
    playback: { current: playbackCurrent, history: [] },
  }
}

async function withPlaybackEvidence(
  c: any,
  taskId: string,
  detail: Record<string, unknown>,
  currentRunId: string | null,
  taskAccess?: TaskAccessRow,
): Promise<Record<string, unknown>> {
  const [evidence, availability] = await Promise.all([
    createPlaybackEvidenceRepository(c.get('db')).getTaskEvidence(taskId),
    readTaskAvailability(c, taskId),
  ])
  return {
    ...detail,
    availability: {
      ...availability,
      layers: projectVideoAvailabilityLayers(detail, availability, evidence, currentRunId, taskAccess),
    },
    playbackEvidence: projectPlaybackEvidence(evidence, currentRunId),
  }
}

function boundedChapterJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string')
    return value ?? fallback
  if (value.length > 32_768)
    return fallback
  try {
    return JSON.parse(value)
  }
  catch {
    return fallback
  }
}

async function withChapterAvailability(c: any, detail: Record<string, unknown>, taskAccess?: TaskAccessRow): Promise<Record<string, unknown>> {
  if (taskAccess?.template_key !== 'manga'
    || (taskAccess.operation !== 'check_comic_chapters'
      && taskAccess.operation !== 'recheck_comic_chapters'
      && taskAccess.operation !== 'repair_comic_chapters'
      && taskAccess.operation !== 'check_chapter_pages'
      && taskAccess.operation !== 'recheck_chapter_pages'
      && taskAccess.operation !== 'repair_chapter_pages')) {
    return detail
  }
  let parsed: ReturnType<typeof readCrawlerTaskSnapshot>
  try {
    parsed = readCrawlerTaskSnapshot(JSON.parse(taskAccess.request_snapshot_json ?? ''), taskAccess.operation)
  }
  catch {
    return detail
  }
  if (!parsed.ok || !('comicId' in parsed.snapshot))
    return detail
  const d1 = getD1(c)
  if (parsed.snapshot.operation === 'check_comic_chapters'
    || parsed.snapshot.operation === 'recheck_comic_chapters'
    || parsed.snapshot.operation === 'repair_comic_chapters') {
    const [current, history] = await Promise.all([
      d1.prepare(`
        SELECT source_revision, status, reason_code, counts_json, findings_json,
          observation_identity, projection_version, observed_at
        FROM chapter_completeness_current
        WHERE comic_id = ? LIMIT 1
      `).bind(parsed.snapshot.comicId).all<Record<string, unknown>>(),
      d1.prepare(`
        SELECT source_revision, terminal_state, source_count, row_count,
          snapshot_identity, observed_at
        FROM comic_chapter_source_snapshot
        WHERE comic_id = ?
        ORDER BY source_revision DESC
        LIMIT 20
      `).bind(parsed.snapshot.comicId).all<Record<string, unknown>>(),
    ])
    const row = current.results?.[0]
    return {
      ...detail,
      chapterAvailability: {
        comicId: parsed.snapshot.comicId,
        current: row
          ? {
              counts: boundedChapterJson(row.counts_json, {}),
              findings: boundedChapterJson(row.findings_json, []),
              observationIdentity: row.observation_identity,
              projectionVersion: row.projection_version,
              reasonCode: row.reason_code,
              sourceRevision: row.source_revision,
              status: row.status,
              terminalState: row.status,
            }
          : null,
        history: history.results ?? [],
        storedCount: Number((boundedChapterJson(row?.counts_json, {}) as Record<string, unknown>).storedCount ?? 0),
      },
    }
  }

  if (!('chapterId' in parsed.snapshot))
    return detail
  const current = await d1.prepare(`
    SELECT source_revision, policy_version, status, expected_page_count,
      stored_page_count, available_page_count, unavailable_page_count,
      unknown_page_count, findings_json, samples_json, observation_identity,
      projection_version, observed_at
    FROM chapter_page_availability_current
    WHERE chapter_id = ? LIMIT 1
  `).bind(parsed.snapshot.chapterId).all<Record<string, unknown>>()
  const row = current.results?.[0]
  return {
    ...detail,
    chapterAvailability: {
      chapterId: parsed.snapshot.chapterId,
      comicCurrent: null,
      pageCurrent: row
        ? {
            availablePageCount: row.available_page_count,
            expectedPageCount: row.expected_page_count,
            findingsJson: boundedChapterJson(row.findings_json, []),
            observationIdentity: row.observation_identity,
            policyVersion: row.policy_version,
            projectionVersion: row.projection_version,
            samplesJson: boundedChapterJson(row.samples_json, []),
            sourceRevision: row.source_revision,
            status: row.status,
            storedPageCount: row.stored_page_count,
            unknownPageCount: row.unknown_page_count,
            unavailablePageCount: row.unavailable_page_count,
          }
        : null,
    },
  }
}

async function readCurrentAttemptNumber(c: any, taskId: string, runId: string): Promise<number> {
  const result = await getD1(c).prepare(`
    SELECT attempt_number
    FROM crawler_run
    WHERE task_id = ? AND id = ?
    LIMIT 1
  `).bind(taskId, runId).all<{ attempt_number: number }>()
  const attemptNumber = result.results?.[0]?.attempt_number
  if (typeof attemptNumber !== 'number' || !Number.isSafeInteger(attemptNumber) || attemptNumber < 1)
    throw new HTTPException(404, { message: 'Crawler run attempt not found for task' })
  return attemptNumber
}

async function requireSessionUser(c: { get: (key: 'auth') => any, req: { raw: Request } }): Promise<SessionUser> {
  const session = await c.get('auth')?.api?.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: 'Unauthorized: Please login first' })
  }
  return session.user as SessionUser
}

function requireTemplateAccess(user: SessionUser, templateKey: CrawlerTaskTemplateKey): void {
  const template = getCrawlerTaskTemplate(templateKey)
  if (!canAccessCrawler(user, template.permissionResource)) {
    throw new HTTPException(403, { message: 'Forbidden for crawler task template' })
  }
}

async function requireTaskAccess(c: any, user: SessionUser, taskId: string): Promise<TaskAccessRow> {
  const row = await getD1(c).prepare(`
    SELECT template_key, operation, request_snapshot_json FROM crawler_task WHERE id = ?
  `).bind(taskId).all<TaskAccessRow>()
  const task = row.results?.[0]
  if (!task) {
    throw new HTTPException(404, { message: 'Crawler task not found' })
  }
  requireTemplateAccess(user, task.template_key)
  return task
}

async function requireTaskRunAccess(c: any, user: SessionUser, taskId: string, runId: string): Promise<TaskAccessRow> {
  const taskAccess = await requireTaskAccess(c, user, taskId)
  const row = await getD1(c).prepare(`
    SELECT run.id
    FROM crawler_run AS run
    INNER JOIN crawler_task AS task ON task.id = run.task_id
    WHERE task.id = ? AND run.id = ?
  `).bind(taskId, runId).all<{ id: string }>()
  if (!row.results?.[0]) {
    throw new HTTPException(404, { message: 'Crawler run not found for task' })
  }
  return taskAccess
}

function parseTaskCursor(value: string | undefined) {
  if (!value)
    return undefined
  try {
    return decodeCrawlerTaskCursor(value)
  }
  catch {
    throw new HTTPException(400, { message: 'Invalid crawler task cursor' })
  }
}

export const adminCrawlerTasksRoutes = new Hono<AppEnv>()

adminCrawlerTasksRoutes.post('/', validator('json', CreateCrawlerTaskSchema), async (c) => {
  const user = await requireSessionUser(c)
  const input = c.req.valid('json')
  const template = input.template ?? (input.operation === 'manga' ? 'manga' : 'movie')
  requireTemplateAccess(user, template)

  const hasOperationInput = input.operation !== undefined
    || input.target !== undefined
    || input.idempotencyKey !== undefined
    || input.policyReference !== undefined
    || input.policyVersion !== undefined
    || input.intent !== undefined
  if (hasOperationInput && (!input.operation || !input.target || !input.idempotencyKey)) {
    throw new HTTPException(400, { message: 'Operation creation requires target, policy and idempotency fields' })
  }
  const operationCommand = input.operation && input.target && input.idempotencyKey
    ? {
        actor: { id: user.id, kind: 'admin' as const },
        idempotencyKey: input.idempotencyKey,
        intent: input.intent ?? { kind: 'crawl' as const },
        operation: input.operation,
        policyReference: input.policyReference ?? 'crawler/default',
        policyVersion: input.policyVersion ?? 'v1',
        target: input.target,
      }
    : undefined

  const repository = createCrawlerTaskRepository(c.get('db'))
  const result = await repository.createOrGetActiveRun({
    ...(operationCommand ? { operationCommand } : {}),
    requestedByUserId: user.id,
    templateKey: template,
  })
  if (result.kind === 'conflict')
    return c.json({ kind: result.kind, run: result.run, taskId: result.taskId }, 409)
  const dispatch = result.kind === 'created'
    ? await dispatchCreatedRun(c, repository, { attempt: result.run.attemptNumber, runId: result.run.id, template }, {
        localProofRequested: isLocalProofOperation(operationCommand),
      })
    : { kind: 'existing_active_run' }
  await createAuditLog(c, {
    action: result.kind === 'created' ? 'CREATE' : 'UPDATE',
    resourceType: 'crawler_task',
    resourceId: result.run.taskId,
    changes: {
      ...(input.target ? { target: input.target } : {}),
      ...(input.operation ? { intent: input.intent?.kind ?? 'crawl' } : {}),
      ...(result.kind === 'created' ? { attemptNumber: result.run.attemptNumber } : {}),
      outcome: result.kind === 'created' ? 'created' : 'duplicate',
      reason: 'admin_create',
      runId: result.run.id,
    },
  })

  return c.json({ dispatch, kind: result.kind, run: result.run, template })
})

adminCrawlerTasksRoutes.post('/repair-players', validator('json', RepairPlayersCommandSchema), async (c) => {
  const user = await requireSessionUser(c)
  requireTemplateAccess(user, 'movie')
  const command = c.req.valid('json')
  const movie = await readRepairMovieLookup(c, command.movieId)
  if (!movie) {
    throw new HTTPException(404, { message: 'Repair movie not found' })
  }
  if (movie.source_disposition !== command.reason) {
    throw new HTTPException(409, { message: 'Repair movie source disposition is stale' })
  }
  if (command.reason !== 'no_source' && command.reason !== 'source_failed') {
    throw new HTTPException(400, { message: 'Repair reason is invalid' })
  }

  const activeTask = await readActiveRepairTask(c, movie.id)
  if (activeTask) {
    const detail = await readRepairTaskResponse(c, {
      movie: { code: movie.code, id: movie.id, title: movie.title },
      taskId: activeTask.id,
    })
    return c.json({
      currentAttempt: detail.currentAttempt,
      history: detail.history,
      kind: 'existing_active_run' as const,
      run: detail.run,
      task: detail.task,
    })
  }

  // Re-read immediately before task creation so a terminal repair cannot submit an old disposition.
  const currentMovie = await readRepairMovieLookup(c, command.movieId)
  if (!currentMovie) {
    throw new HTTPException(404, { message: 'Repair movie not found' })
  }
  if (currentMovie.source_disposition !== command.reason) {
    throw new HTTPException(409, { message: 'Repair movie source disposition is stale' })
  }

  const repository = createCrawlerTaskRepository(c.get('db'))
  let result: Awaited<ReturnType<CrawlerRepository['createOrGetActiveRun']>>
  try {
    result = await repository.createOrGetActiveRun({
      operationCommand: {
        actor: { id: user.id, kind: 'admin' },
        idempotencyKey: command.idempotencyKey ?? `repair:${currentMovie.id}:${currentMovie.source_revision ?? 0}`,
        intent: {
          kind: 'repair_players',
          reason: command.reason,
          sourceRevision: currentMovie.source_revision ?? 0,
          targetIntent: 'restore_playable_sources',
        },
        operation: 'repair_players',
        policyReference: 'movies/repair_players',
        policyVersion: 'v1',
        target: { id: currentMovie.id, kind: 'movie' },
      },
      movieId: currentMovie.id,
      operation: 'repair_players',
      reason: command.reason,
      requestedByUserId: user.id,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('repair task source disposition is no longer repairable')) {
      throw new HTTPException(409, { message: 'Repair movie source disposition is stale' })
    }
    throw error
  }

  if (result.kind === 'conflict') {
    throw new HTTPException(409, { message: `Repair operation conflicts with task ${result.taskId}` })
  }

  const detail = await readRepairTaskResponse(c, {
    movie: { code: currentMovie.code, id: currentMovie.id, title: currentMovie.title },
    taskId: result.run.taskId,
  })
  await createAuditLog(c, {
    action: result.kind === 'created' ? 'CREATE' : 'UPDATE',
    resourceType: 'crawler_task',
    resourceId: result.run.taskId,
    changes: {
      attemptNumber: result.run.attemptNumber,
      outcome: result.kind === 'created' ? 'created' : 'duplicate',
      reason: 'repair_players',
      runId: result.run.id,
      target: { id: currentMovie.id, kind: 'movie' },
    },
  })
  return c.json({
    currentAttempt: detail.currentAttempt,
    history: detail.history,
    kind: result.kind,
    run: detail.run,
    task: detail.task,
  })
})

adminCrawlerTasksRoutes.post('/video-availability', validator('json', VideoAvailabilityCommandSchema), async (c) => {
  const user = await requireSessionUser(c)
  requireTemplateAccess(user, 'movie')
  const command = c.req.valid('json')
  const movie = await readVideoAvailabilityMovieLookup(c, command.movieId)
  if (!movie)
    throw new HTTPException(404, { message: 'Video availability movie not found' })

  const policyVersion = VIDEO_PROBE_POLICY_V1.version
  const movieRevision = movie.sourceRevision
  const sourceRevision = movie.sourceRevision
  const repairReasons = new Set(['no_source', 'source_failed', 'direct_blocked', 'direct_content_invalid'])
  const operation = repairReasons.has(command.reason) ? 'repair_video_source' as const : 'recheck_video_source' as const
  const repository = createCrawlerTaskRepository(c.get('db'))
  const result = await repository.createOrGetActiveRun({
    operationCommand: {
      actor: { id: user.id, kind: 'admin' },
      idempotencyKey: command.idempotencyKey,
      intent: {
        kind: operation,
        movieRevision,
        policyVersion,
        reason: command.reason,
        ...(command.sourceKind ? { sourceKind: command.sourceKind } : {}),
        sourceRevision,
      },
      operation,
      policyReference: 'availability/video-source-probe',
      policyVersion,
      target: { id: command.movieId, kind: 'movie' },
    },
    requestedByUserId: user.id,
    templateKey: 'movie',
  })
  if (result.kind === 'conflict')
    throw new HTTPException(409, { message: 'Video availability command conflicts with an existing identity' })
  const dispatch = result.kind === 'created'
    ? await dispatchCreatedRun(c, repository, { attempt: result.run.attemptNumber, runId: result.run.id, template: 'movie' }, {
        localProofRequested: true,
      })
    : { kind: 'existing_active_run' }
  return c.json({
    binding: { movieId: movie.id, movieRevision, policyVersion, sourceKind: command.sourceKind ?? null, sourceRevision },
    dispatch,
    kind: result.kind,
    run: result.run,
  })
})

adminCrawlerTasksRoutes.post('/chapter-availability', validator('json', ChapterAvailabilityCommandSchema), async (c) => {
  const user = await requireSessionUser(c)
  requireTemplateAccess(user, 'manga')
  const command = c.req.valid('json')
  const isPageCommand = 'chapterId' in command
  const policyVersion = isPageCommand ? 'chapter-page-probe/v1' : 'chapter-completeness/v1'
  const operation = command.operation
  const comic = await getD1(c).prepare(`
    SELECT id
    FROM comic
    WHERE id = ?
    LIMIT 1
  `).bind(command.comicId).all<{ id: string }>()
  if (!comic.results?.[0])
    throw new HTTPException(404, { message: 'Comic not found' })

  let sourceRevision: number
  if (isPageCommand) {
    const chapter = await getD1(c).prepare(`
      SELECT chapter.id, chapter.comic_id, COALESCE(completeness.source_revision, 0) AS source_revision
      FROM chapter
      LEFT JOIN chapter_completeness_current AS completeness ON completeness.comic_id = chapter.comic_id
      WHERE chapter.id = ? AND chapter.comic_id = ?
      LIMIT 1
    `).bind(command.chapterId, command.comicId).all<{ id: string, comic_id: string, source_revision: number }>()
    if (!chapter.results?.[0])
      throw new HTTPException(404, { message: 'Chapter not found for comic' })
    sourceRevision = Number(chapter.results[0].source_revision ?? 0)
  }
  else {
    const current = await getD1(c).prepare(`
      SELECT source_revision
      FROM chapter_completeness_current
      WHERE comic_id = ?
      LIMIT 1
    `).bind(command.comicId).all<{ source_revision: number | null }>()
    sourceRevision = Number(current.results?.[0]?.source_revision ?? 0)
  }

  const intent = isPageCommand
    ? {
        chapterId: command.chapterId,
        ...(command.chapterUrl ? { chapterUrl: command.chapterUrl } : {}),
        comicId: command.comicId,
        finding: command.finding,
        kind: operation,
        ...(command.pageIdentities ? { pageIdentities: command.pageIdentities } : {}),
        ...(command.pageNumbers ? { pageNumbers: command.pageNumbers } : {}),
        policyVersion,
        sourceRevision,
      }
    : {
        ...(command.chapterIds ? { chapterIds: command.chapterIds } : {}),
        ...(command.chapterUrl ? { chapterUrl: command.chapterUrl } : {}),
        comicId: command.comicId,
        finding: command.finding,
        kind: operation,
        policyVersion,
        sourceRevision,
      }
  const repository = createCrawlerTaskRepository(c.get('db'))
  const result = await repository.createOrGetActiveRun({
    operationCommand: {
      actor: { id: user.id, kind: 'admin' },
      idempotencyKey: command.idempotencyKey,
      intent,
      operation,
      policyReference: policyVersion === 'chapter-page-probe/v1' ? 'availability/chapter-pages' : 'availability/chapter-completeness',
      policyVersion,
      target: { id: command.comicId, kind: 'manga' },
    },
    requestedByUserId: user.id,
    templateKey: 'manga',
  })
  if (result.kind === 'conflict')
    throw new HTTPException(409, { message: 'Chapter availability command conflicts with an existing identity' })
  const dispatch = result.kind === 'created'
    ? await dispatchCreatedRun(c, repository, { attempt: result.run.attemptNumber, runId: result.run.id, template: 'manga' }, {
        localProofRequested: c.env?.CRAWLER_LOCAL_PROOF_ENABLED === 'true',
      })
    : { kind: 'existing_active_run' }
  return c.json({
    binding: {
      comicId: command.comicId,
      ...(isPageCommand ? { chapterId: command.chapterId } : {}),
      operation,
      policyVersion,
      sourceRevision,
    },
    dispatch,
    kind: result.kind,
    run: result.run,
  })
})

adminCrawlerTasksRoutes.get('/', validator('query', ListCrawlerTasksQuerySchema), async (c) => {
  const user = await requireSessionUser(c)
  const { cursor, lifecycle, limit, template } = c.req.valid('query')
  if (template)
    requireTemplateAccess(user, template)
  const repository = createCrawlerTaskRepository(c.get('db'))
  const decodedCursor = parseTaskCursor(cursor)
  if (repository.listTasks) {
    const page = await repository.listTasks({ cursor: decodedCursor, lifecycle, limit, templateKey: template })
    if (page)
      return c.json(page)
  }
  const rows = await getD1(c).prepare(`
    SELECT id, template_key, latest_run_id, created_at, updated_at
    FROM crawler_task
    WHERE (? IS NULL OR template_key = ?)
      AND (? IS NULL OR updated_at < ? OR (updated_at = ? AND id < ?))
    ORDER BY updated_at DESC, id DESC LIMIT ?
  `).bind(
    template ?? null,
    template ?? null,
    decodedCursor ? decodedCursor.updatedAt : null,
    decodedCursor ? decodedCursor.updatedAt : null,
    decodedCursor ? decodedCursor.updatedAt : null,
    decodedCursor?.id ?? null,
    limit + 1,
  ).all<Record<string, unknown>>()
  const pageRows = rows.results ?? []
  const visible = pageRows.slice(0, limit).filter((task) => {
    const key = task.template_key as CrawlerTaskTemplateKey
    return canAccessCrawler(user, getCrawlerTaskTemplate(key).permissionResource)
  })
  const last = visible.at(-1)
  return c.json({
    nextCursor: pageRows.length > limit && last
      ? encodeCrawlerTaskCursor({ id: String(last.id), updatedAt: Number(last.updated_at) })
      : null,
    tasks: visible,
  })
})

adminCrawlerTasksRoutes.patch('/:taskId', validator('param', CrawlerTaskIdParamsSchema), validator('json', UpdateCrawlerTaskSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId } = c.req.valid('param')
  const metadata = c.req.valid('json')
  const taskAccess = await requireTaskAccess(c, user, taskId)
  const repository = createCrawlerTaskRepository(c.get('db'))
  const result = await repository.updateTaskMetadata({
    audit: {
      action: 'UPDATE',
      actorEmail: user.email,
      actorId: user.id,
      outcome: 'updated',
      reason: 'metadata_update',
      taskId,
    },
    metadata,
    taskId,
  })
  if (result.kind !== 'updated')
    throw new HTTPException(result.kind === 'not_found' ? 404 : 409, { message: result.reasonCode ?? 'Task metadata update rejected' })
  await createAuditLog(c, {
    action: 'UPDATE',
    resourceType: 'crawler_task',
    resourceId: taskId,
    changes: { metadata, outcome: 'updated', reason: 'metadata_update' },
  })
  return c.json({ lifecycle: result.lifecycle, metadata, taskId, operation: taskAccess.operation })
})

adminCrawlerTasksRoutes.post('/:taskId/archive', validator('param', CrawlerTaskIdParamsSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId } = c.req.valid('param')
  await requireTaskAccess(c, user, taskId)
  const repository = createCrawlerTaskRepository(c.get('db'))
  const result = await repository.archiveTask(taskId)
  if (result.kind === 'not_found')
    throw new HTTPException(404, { message: 'Crawler task not found' })
  if (result.kind === 'rejected')
    throw new HTTPException(409, { message: result.reasonCode ?? 'Crawler task archive rejected' })
  await createAuditLog(c, {
    action: 'DELETE',
    resourceType: 'crawler_task',
    resourceId: taskId,
    changes: { lifecycle: 'archived', outcome: result.kind, reason: 'archive' },
  })
  return c.json({ lifecycle: result.lifecycle, taskId, kind: result.kind })
})

adminCrawlerTasksRoutes.post('/:taskId/supersede', validator('param', CrawlerTaskIdParamsSchema), validator('json', SupersedeCrawlerTaskSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId } = c.req.valid('param')
  const command = c.req.valid('json')
  await requireTaskAccess(c, user, taskId)
  const template = command.target.kind === 'manga' ? 'manga' : 'movie'
  requireTemplateAccess(user, template)
  if (command.operation === 'repair_players' && command.intent.kind !== 'repair_players')
    throw new HTTPException(400, { message: 'Repair supersede requires repair intent' })
  const chapterOperation = command.operation === 'check_comic_chapters'
    || command.operation === 'recheck_comic_chapters'
    || command.operation === 'repair_comic_chapters'
    || command.operation === 'check_chapter_pages'
    || command.operation === 'recheck_chapter_pages'
    || command.operation === 'repair_chapter_pages'
  const videoOperation = command.operation === 'check_video_source'
    || command.operation === 'recheck_video_source'
    || command.operation === 'repair_video_source'
  if (chapterOperation && command.intent.kind !== command.operation)
    throw new HTTPException(400, { message: 'Chapter supersede requires matching chapter intent' })
  if (videoOperation && command.intent.kind !== command.operation)
    throw new HTTPException(400, { message: 'Video supersede requires matching video intent' })
  if (command.operation !== 'repair_players' && !chapterOperation && !videoOperation && command.intent.kind !== 'crawl')
    throw new HTTPException(400, { message: 'Crawler supersede requires crawl intent' })

  const repository = createCrawlerTaskRepository(c.get('db'))
  const result = await repository.supersedeTask({
    operationCommand: {
      actor: { id: user.id, kind: 'admin' },
      ...command,
    },
    requestedByUserId: user.id,
    taskId,
  })
  if (result.kind === 'rejected')
    throw new HTTPException(409, { message: result.reasonCode ?? 'Crawler task supersede rejected' })
  const dispatch = result.task?.kind === 'created'
    ? await dispatchCreatedRun(c, repository, { attempt: result.task.run.attemptNumber, runId: result.task.run.id, template }, {
        localProofRequested: isLocalProofOperation(command),
      })
    : { kind: 'existing_active_run' }
  await createAuditLog(c, {
    action: 'UPDATE',
    resourceType: 'crawler_task',
    resourceId: taskId,
    changes: {
      lifecycle: 'superseded',
      outcome: result.kind,
      reason: 'supersede',
      target: { id: result.task?.run.taskId ?? taskId, kind: command.target.kind },
    },
  })
  return c.json({ dispatch, kind: result.kind, lifecycle: result.lifecycle, taskId, task: result.task })
})

adminCrawlerTasksRoutes.get('/:taskId/audit', validator('param', CrawlerTaskIdParamsSchema), validator('query', CrawlerTaskAuditQuerySchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId } = c.req.valid('param')
  const { cursor, limit } = c.req.valid('query')
  await requireTaskAccess(c, user, taskId)
  const repository = createCrawlerTaskRepository(c.get('db'))
  return c.json(await repository.listTaskAudit({ cursor, limit, taskId }))
})

adminCrawlerTasksRoutes.post('/:taskId/runs/:runId/playback-evidence', validator('param', CrawlerTaskRunParamsSchema), validator('json', PlaybackEvidenceRequestSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId, runId } = c.req.valid('param')
  await requireTaskRunAccess(c, user, taskId, runId)
  const attemptNumber = await readCurrentAttemptNumber(c, taskId, runId)
  const evidence = c.req.valid('json')
  if (evidence.tuple.taskId !== taskId
    || evidence.tuple.runId !== runId
    || evidence.tuple.attemptNumber !== attemptNumber) {
    throw new HTTPException(409, { message: 'Playback evidence tuple does not match the server-owned task run attempt' })
  }
  const artifact = await createPlaybackArtifactReference({
    attemptNumber,
    evidence,
    runId,
    taskId,
  })
  const result = await createPlaybackEvidenceRepository(c.get('db')).accept({
    artifact,
    evidence,
    runId,
    taskId,
  })
  return c.json(result)
})

adminCrawlerTasksRoutes.get('/:taskId', validator('param', CrawlerTaskIdParamsSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId } = c.req.valid('param')
  const taskAccess = await requireTaskAccess(c, user, taskId)
  if (taskAccess.operation === 'repair_players') {
    const snapshot = taskAccess.request_snapshot_json
      ? (() => {
          try {
            const parsed = readCrawlerTaskSnapshot(JSON.parse(taskAccess.request_snapshot_json), taskAccess.operation)
            return parsed.ok && 'operation' in parsed.snapshot && parsed.snapshot.operation === 'repair_players' ? parsed.snapshot : null
          }
          catch {
            return null
          }
        })()
      : null
    if (!snapshot) {
      throw new HTTPException(500, { message: 'Repair task snapshot unavailable' })
    }
    const movie = await readRepairMovieLookup(c, snapshot.movieId)
    if (!movie) {
      throw new HTTPException(404, { message: 'Repair movie not found' })
    }
    const detail = await readRepairTaskResponse(c, {
      movie: { code: movie.code, id: movie.id, title: movie.title },
      taskId,
    })
    const projected = await withPlaybackEvidence(c, taskId, detail, detail.currentAttempt?.id ?? null, taskAccess)
    return c.json(await withChapterAvailability(c, projected, taskAccess))
  }
  const repository = createCrawlerTaskRepository(c.get('db'))
  if (repository.getTaskDetail) {
    const detail = await repository.getTaskDetail(taskId)
    if (detail) {
      const currentRunId = readCurrentRunId(detail.task, detail.runs)
      const projected = await withPlaybackEvidence(c, taskId, projectTaskDetail(detail), currentRunId, taskAccess)
      return c.json(await withChapterAvailability(c, projected, taskAccess))
    }
  }
  const d1 = getD1(c)
  const [task, runs] = await Promise.all([
    d1.prepare('SELECT id, template_key, latest_run_id, created_at, updated_at FROM crawler_task WHERE id = ?').bind(taskId).all<Record<string, unknown>>(),
    d1.prepare('SELECT id, attempt_number, status, state_version, failure_code, receipt_summary_json, receipt_schema_version, receipt_primary_content_id, receipt_source_revision, created_at, terminal_at FROM crawler_run WHERE task_id = ? ORDER BY attempt_number DESC').bind(taskId).all<Record<string, unknown>>(),
  ])
  const currentRunId = typeof task.results?.[0]?.latest_run_id === 'string' ? task.results[0].latest_run_id as string : null
  const projected = await withPlaybackEvidence(c, taskId, {
    runs: (runs.results ?? []).map(projectRun),
    task: task.results?.[0],
  }, currentRunId, taskAccess)
  return c.json(await withChapterAvailability(c, projected, taskAccess))
})

adminCrawlerTasksRoutes.get('/:taskId/runs/:runId/logs', validator('param', CrawlerTaskRunParamsSchema), validator('query', CrawlerTaskLogsQuerySchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId, runId } = c.req.valid('param')
  const { cursor, limit } = c.req.valid('query')
  await requireTaskRunAccess(c, user, taskId, runId)
  const repository = createCrawlerTaskRepository(c.get('db'))
  if (repository.listRunLogs) {
    const page = await repository.listRunLogs({ cursor, limit, runId, taskId })
    if (page)
      return c.json(page)
  }
  const logs = await getD1(c).prepare(`
    SELECT log.sequence, log.level, log.code, log.safe_message, log.counts_json, log.created_at
    FROM crawler_run_log AS log
    INNER JOIN crawler_run AS run ON run.id = log.run_id
    WHERE run.task_id = ? AND log.run_id = ? AND (? IS NULL OR log.sequence < ?)
    ORDER BY log.sequence DESC LIMIT ?
  `).bind(taskId, runId, cursor ?? null, cursor ?? null, limit).all<Record<string, unknown>>()
  const rows = logs.results ?? []
  return c.json({
    logs: rows,
    nextCursor: rows.length === limit ? Number(rows[rows.length - 1]?.sequence) : null,
  })
})

adminCrawlerTasksRoutes.post('/:taskId/runs/:runId/cancel', validator('param', CrawlerTaskRunParamsSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId, runId } = c.req.valid('param')
  await requireTaskRunAccess(c, user, taskId, runId)
  const repository = createCrawlerTaskRepository(c.get('db'))
  const result = await repository.applyTransition(runId, {
    actor: 'admin',
    type: 'admin_cancel',
  })
  let provider: Record<string, unknown> = { kind: 'not_requested' }
  if (result.kind === 'transition' && result.nextStatus === 'cancel_requested') {
    const association = await repository.getProviderAssociation?.(runId)
    const client = createProviderClient(c.env as AppEnv['Bindings'])
    if (association?.provider === 'local-proof') {
      provider = { accepted: true, kind: 'local-proof_cancel_requested' }
    }
    else if (association?.providerRunId && client) {
      provider = projectProviderResult(await client.cancelWorkflowRun({
        providerRunId: association.providerRunId,
        snapshot: createProviderSnapshot(association.template),
      }))
    }
    else if (!association?.providerRunId) {
      provider = { kind: 'provider_binding_pending' }
    }
    else {
      provider = { kind: 'provider_not_configured' }
    }
  }
  await createAuditLog(c, {
    action: 'UPDATE',
    resourceType: 'crawler_task',
    resourceId: taskId,
    changes: {
      attemptNumber: await readCurrentAttemptNumber(c, taskId, runId),
      outcome: result.kind === 'transition' ? result.nextStatus : result.kind,
      reason: 'cancel',
      runId,
    },
  })
  return c.json({ decision: result, provider })
})

adminCrawlerTasksRoutes.post('/:taskId/runs/:runId/retry', validator('param', CrawlerTaskRunParamsSchema), validator('json', RetryCrawlerTaskSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId, runId } = c.req.valid('param')
  const taskAccess = await requireTaskRunAccess(c, user, taskId, runId)
  if (taskAccess.operation === 'repair_players') {
    const snapshot = taskAccess.request_snapshot_json
      ? readRepairSnapshot({
          created_at: 0,
          id: taskId,
          latest_run_id: runId,
          operation: 'repair_players',
          request_snapshot_json: taskAccess.request_snapshot_json,
          template_key: 'movie',
          updated_at: 0,
        })
      : null
    if (!snapshot) {
      throw new HTTPException(500, { message: 'Repair task snapshot unavailable' })
    }
    const movie = await readRepairMovieLookup(c, snapshot.movieId)
    if (!movie || movie.source_disposition !== snapshot.reason) {
      throw new HTTPException(409, { message: 'Repair movie source disposition is stale' })
    }
  }
  const repository = createCrawlerTaskRepository(c.get('db'))
  const previousProvider = await repository.getProviderAssociation?.(runId)
  const result = await repository.retryRun(runId)
  const dispatch = result.kind === 'created'
    ? await dispatchCreatedRun(c, repository, { attempt: result.run.attemptNumber, runId: result.run.id, template: result.snapshot.templateKey }, {
        provider: previousProvider?.provider,
      })
    : { kind: 'existing_active_run' }
  await createAuditLog(c, {
    action: 'UPDATE',
    resourceType: 'crawler_task',
    resourceId: taskId,
    changes: {
      attemptNumber: result.run.attemptNumber,
      outcome: result.kind,
      reason: 'retry',
      runId: result.run.id,
    },
  })
  return c.json({ dispatch, kind: result.kind, run: result.run })
})
