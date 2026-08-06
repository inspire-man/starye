import type { Database } from '@starye/db'
import type { SourceReadinessProjection } from '../movies/source-contract'
import type { CrawlerReceiptUnion, CrawlerRunFailureCode, CrawlerRunLogPage, CrawlerRunLogReadModel, CrawlerRunReadModel, CrawlerRunReceipt, CrawlerRunReceiptCandidate, CrawlerRunState, CrawlerRunStatus, CrawlerRunTransitionDecision, CrawlerRunTransitionEvent, CrawlerTaskCursor, CrawlerTaskDetailReadModel, CrawlerTaskListItem, CrawlerTaskListPage, CrawlerTaskOperation, CrawlerTaskSnapshotUnion, CrawlerTaskTemplateKey, ProviderRunStatus, RepairPlayersReason, RepairPlayersReceipt, RepairPlayersTargetIntent, RepairPlayersTaskSnapshot, ValidatedCrawlerRunReceipt } from './types'
import { SOURCE_REASON_CODES } from '../movies/source-contract'
import { createProviderAssociationSummary, createProviderSnapshot } from './provider-association'
import { validateReceiptCandidate } from './receipt-validation'
import { createManualRetryAttempt, decideCrawlerRunTransition, isTerminalCrawlerRunStatus } from './state-machine'
import { createCrawlerTaskSnapshot, readCrawlerTaskSnapshot } from './template-registry'
import {
  CRAWLER_LEASE_DURATION_MS,
  CRAWLER_MAX_NORMAL_LOG_ROWS,
  CRAWLER_MAX_SAFE_LOG_BYTES,
  CRAWLER_RUN_LOG_RETENTION_MS,

} from './types'

interface D1Statement {
  all: <T>() => Promise<{ results?: T[] }>
  bind: (...values: unknown[]) => D1Statement
  run: () => Promise<{ meta?: { changes?: number } }>
}

interface D1Client {
  batch: (statements: D1Statement[]) => Promise<unknown[]>
  prepare: (query: string) => D1Statement
}

type CrawlerTaskDatabase = Pick<Database, '$client' | 'query'>

interface CrawlerRunRow {
  attempt_number: number
  cancel_requested_at: number | null
  failure_code: string | null
  id: string
  last_event_sequence: number
  last_heartbeat_at: number | null
  lease_expires_at: number | null
  receipt_summary_json: string | null
  receipt_schema_version: number | null
  receipt_primary_content_id: string | null
  receipt_source_revision: number | null
  state_version: number
  status: CrawlerRunStatus
  task_id: string
  terminal_at: number | null
  created_at: number
  updated_at: number
}

interface CrawlerTaskRow {
  created_at: number
  id: string
  latest_run_id: string | null
  operation?: CrawlerTaskOperation
  request_snapshot_json?: string
  requested_by_user_id?: string
  template_key: CrawlerTaskTemplateKey
  updated_at: number
}

interface CrawlerRunLogRow {
  code: string
  counts_json: string | null
  created_at: number
  level: CrawlerRunLogReadModel['level']
  safe_message: string
  sequence: number
}

export interface CrawlerTaskRun {
  readonly attemptNumber: number
  readonly id: string
  readonly stateVersion: number
  readonly status: CrawlerRunStatus
  readonly taskId: string
}

export interface CreateCrawlerTaskRunInput {
  readonly idempotencyKey?: string
  readonly movieId?: string
  readonly operation?: CrawlerTaskOperation
  readonly reason?: RepairPlayersReason
  readonly requestedByUserId: string
  readonly targetIntent?: RepairPlayersTargetIntent
  readonly templateKey: CrawlerTaskTemplateKey
}

export type CrawlerTaskRunResult
  = | { readonly kind: 'created', readonly run: CrawlerTaskRun, readonly snapshot: CrawlerTaskSnapshotUnion }
    | { readonly kind: 'existing_active_run', readonly run: CrawlerTaskRun }

export interface AppendCrawlerRunLogInput {
  readonly code: string
  readonly counts?: Readonly<Record<string, number>>
  readonly level: 'debug' | 'info' | 'warn' | 'error'
  readonly message: string
  readonly runId: string
  readonly sequence: number
}

export interface CrawlerRepositoryOptions {
  readonly createId?: () => string
  readonly now?: () => Date
}

export interface ProcessCrawlerRunnerEventInput {
  readonly attempt: number
  readonly bodySha256: string
  readonly event: CrawlerRunTransitionEvent
  readonly eventId: string
  readonly keyId: string
  readonly log?: AppendCrawlerRunLogInput
  readonly nonce: string
  readonly receipt?: CrawlerRunReceiptCandidate | {
    readonly movieId: string
    readonly observedAt: number
    readonly operation: 'repair_players'
    readonly sourceRevision: number
    readonly sourceSummary: readonly unknown[]
  }
  readonly runId: string
  readonly safeSummary?: string
  readonly sequence: number
}

export interface ScheduleRegisterInput {
  readonly bodySha256: string
  readonly environment: string
  readonly eventId: string
  readonly keyId: string
  readonly nonce: string
  readonly ref: string
  readonly repository: string
  readonly scheduleBucket: string
  readonly scheduledAt: string
  readonly target: string
  readonly template: CrawlerTaskTemplateKey
  readonly workflow: string
}

export interface ScheduleRegisterResult {
  readonly accepted: boolean
  readonly attempt: number
  readonly runId: string
}

export interface ProviderStartedInput {
  readonly attempt: number
  readonly bodySha256: string
  readonly environment: string
  readonly eventId: string
  readonly keyId: string
  readonly nonce: string
  readonly providerRunAttempt: number
  readonly providerRunId: string
  readonly ref: string
  readonly repository: string
  readonly runId: string
  readonly sha: string
  readonly target: string
  readonly template: CrawlerTaskTemplateKey
  readonly workflow: string
}

export interface ProviderStartedResult {
  readonly accepted: boolean
  readonly cancelRequested: boolean
}

export interface ProviderAssociationRecord {
  readonly applicationAttempt: number
  readonly environment: string
  readonly providerConclusion?: string
  readonly providerRunAttempt?: number
  readonly providerRunId?: string
  readonly providerStatus?: ProviderRunStatus
  readonly reconciliationWindowEndsAt?: number
  readonly ref: string
  readonly repository: string
  readonly runId: string
  readonly scheduleBucket?: string
  readonly sha?: string
  readonly target: string
  readonly template: CrawlerTaskTemplateKey
  readonly workflow: string
}

export interface EnsureProviderAssociationInput {
  readonly runId: string
  readonly attempt: number
  readonly template: CrawlerTaskTemplateKey
  readonly scheduleBucket?: string
}

export interface ProviderObservationInput {
  readonly attempt: number
  readonly conclusion?: string
  readonly headSha?: string
  readonly path?: string
  readonly providerRunAttempt?: number
  readonly providerRunId: string
  readonly runId: string
  readonly status: ProviderRunStatus
}

export type ProviderObservationResult
  = | { readonly kind: 'not_found' }
    | { readonly kind: 'attempt_mismatch' }
    | { readonly kind: 'provider_mismatch', readonly reconciliationWindowEndsAt: number }
    | { readonly kind: 'updated', readonly status: ProviderRunStatus, readonly conclusion?: string }
    | { readonly kind: 'provider_lost', readonly reason: 'reconciliation_window_expired' }

export interface ProviderReconciliationCandidate extends ProviderAssociationRecord {
  readonly runStatus: CrawlerRunStatus
}

export interface ValidateDispatchInput {
  readonly attempt: number
  readonly runId: string
  readonly target: string
  readonly template: CrawlerTaskTemplateKey
}

export interface ValidateDispatchResult {
  readonly accepted: boolean
  readonly reason?: string
}

export type ProcessCrawlerRunnerEventResult
  = | { readonly kind: 'accepted', readonly outcome: Readonly<Record<string, unknown>> }
    | { readonly kind: 'attempt_mismatch' }
    | { readonly kind: 'conflict' }
    | { readonly kind: 'duplicate', readonly outcome: Readonly<Record<string, unknown>> }
    | { readonly kind: 'not_found' }
    | { readonly kind: 'rejected', readonly outcome: Readonly<Record<string, unknown>> }
    | { readonly kind: 'receipt_template_mismatch' }

export interface ClaimCrawlerRunInput {
  readonly attempt: number
  readonly bodySha256: string
  readonly eventId: string
  readonly keyId: string
  readonly nonce: string
  readonly runId: string
  readonly sequence: number
}

export interface CrawlerRunDispatchCandidate {
  readonly attempt: number
  readonly runId: string
  readonly sequence: number
  readonly snapshot: CrawlerTaskSnapshotUnion
}

export type ClaimCrawlerRunResult
  = | { readonly kind: 'accepted', readonly outcome: Readonly<Record<string, unknown>> }
    | { readonly kind: 'attempt_mismatch' }
    | { readonly kind: 'conflict' }
    | { readonly kind: 'duplicate', readonly outcome: Readonly<Record<string, unknown>> }
    | { readonly kind: 'not_found' }
    | { readonly kind: 'rejected', readonly outcome: Readonly<Record<string, unknown>> }

interface CrawlerRunnerEventRow {
  body_sha256: string
  event_id: string
  nonce: string
  outcome: string
}

interface RepairTaskStateRow {
  disposition: 'ready' | 'no_source' | 'repairing' | 'source_failed'
  source_revision: number
}

interface TaskBindingRow {
  operation: CrawlerTaskOperation
  requested_by_user_id: string
  request_snapshot_json: string
  task_id: string
  template_key: CrawlerTaskTemplateKey
}

const DEFAULT_PROVIDER_RECONCILIATION_WINDOW_MS = 5 * 60_000

function asD1Client(db: CrawlerTaskDatabase): D1Client {
  return db.$client as unknown as D1Client
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

function toCrawlerTaskListItem(row: CrawlerTaskRow): CrawlerTaskListItem {
  return {
    createdAt: row.created_at,
    id: row.id,
    latestRunId: row.latest_run_id,
    templateKey: row.template_key,
    updatedAt: row.updated_at,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseRepairReceipt(
  receipt: Record<string, unknown>,
  persisted?: Pick<CrawlerRunRow, 'receipt_schema_version' | 'receipt_primary_content_id' | 'receipt_source_revision'>,
): RepairPlayersReceipt | null {
  const sourceSummary = receipt.sourceSummary
  if (receipt.operation !== 'repair_players'
    || typeof receipt.movieId !== 'string'
    || !/^\w[\w-]{0,127}$/u.test(receipt.movieId)
    || typeof receipt.observedAt !== 'number'
    || !Number.isSafeInteger(receipt.observedAt)
    || receipt.observedAt < 0
    || receipt.observedAt > 4_000_000_000
    || typeof receipt.sourceRevision !== 'number'
    || !Number.isSafeInteger(receipt.sourceRevision)
    || receipt.sourceRevision < 0
    || receipt.sourceRevision > 1_000_000
    || !Array.isArray(sourceSummary)
    || sourceSummary.length < 1
    || sourceSummary.length > 50
    || (persisted?.receipt_schema_version !== null
      && persisted?.receipt_schema_version !== undefined
      && persisted.receipt_schema_version !== 2)
    || (persisted?.receipt_primary_content_id
      && persisted.receipt_primary_content_id !== receipt.movieId)
    || (persisted?.receipt_source_revision !== null
      && persisted?.receipt_source_revision !== undefined
      && persisted.receipt_source_revision !== receipt.sourceRevision)) {
    return null
  }

  const boundedSummary: RepairPlayersReceipt['sourceSummary'][number][] = []
  for (const source of sourceSummary) {
    if (!isRecord(source)
      || typeof source.eligible !== 'boolean'
      || (source.health !== 'inactive' && source.health !== 'unverified' && source.health !== 'failed')
      || typeof source.observedAt !== 'number'
      || !Number.isSafeInteger(source.observedAt)
      || source.observedAt < 0
      || source.observedAt > 4_000_000_000
      || (source.reasonCode !== 'source_inactive'
        && source.reasonCode !== 'source_unverified'
        && source.reasonCode !== 'source_candidate_invalid'
        && source.reasonCode !== 'source_read_failed'
        && source.reasonCode !== 'source_write_failed')
      || (source.sourceType !== 'direct' && source.sourceType !== 'magnet' && source.sourceType !== 'TorrServer')) {
      return null
    }
    boundedSummary.push({
      eligible: source.eligible,
      health: source.health,
      observedAt: source.observedAt,
      reasonCode: source.reasonCode,
      sourceType: source.sourceType,
    })
  }

  return {
    movieId: receipt.movieId,
    observedAt: receipt.observedAt,
    operation: 'repair_players',
    sourceRevision: receipt.sourceRevision,
    sourceSummary: boundedSummary,
  }
}

function parseValidatedReceipt(
  status: CrawlerRunStatus,
  raw: string | null,
  persisted?: Pick<CrawlerRunRow, 'receipt_schema_version' | 'receipt_primary_content_id' | 'receipt_source_revision'>,
): CrawlerReceiptUnion | null {
  if (status !== 'succeeded' || !raw)
    return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null
    const receipt = value as Record<string, unknown>
    if (receipt.operation === 'repair_players')
      return parseRepairReceipt(receipt, persisted)
    if ((receipt.templateKey !== 'movie' && receipt.templateKey !== 'manga')
      || typeof receipt.primaryContentId !== 'string'
      || !/^\w[\w-]{0,127}$/u.test(receipt.primaryContentId)
      || typeof receipt.createdCount !== 'number'
      || !Number.isSafeInteger(receipt.createdCount)
      || receipt.createdCount < 0
      || typeof receipt.updatedCount !== 'number'
      || !Number.isSafeInteger(receipt.updatedCount)
      || receipt.updatedCount < 0) {
      return null
    }
    if (receipt.receiptSchemaVersion !== undefined && receipt.receiptSchemaVersion !== 2)
      return null
    if (persisted?.receipt_schema_version !== null
      && persisted?.receipt_schema_version !== undefined
      && persisted.receipt_schema_version !== 2) {
      return null
    }
    if (persisted?.receipt_primary_content_id
      && persisted.receipt_primary_content_id !== receipt.primaryContentId) {
      return null
    }

    let source: SourceReadinessProjection | undefined
    if (receipt.source !== undefined) {
      if (!receipt.source || typeof receipt.source !== 'object' || Array.isArray(receipt.source))
        return null
      const candidate = receipt.source as Record<string, unknown>
      const validDisposition = candidate.disposition === 'ready'
        || candidate.disposition === 'no_source'
        || candidate.disposition === 'source_failed'
        || candidate.disposition === 'repairing'
      const validReason = candidate.reasonCode === null
        || (typeof candidate.reasonCode === 'string' && (SOURCE_REASON_CODES as readonly string[]).includes(candidate.reasonCode))
      if (!validDisposition
        || typeof candidate.eligibleCount !== 'number'
        || !Number.isSafeInteger(candidate.eligibleCount)
        || candidate.eligibleCount < 0
        || candidate.eligibleCount > 1_000_000
        || typeof candidate.observedAt !== 'number'
        || !Number.isSafeInteger(candidate.observedAt)
        || candidate.observedAt < 0
        || typeof candidate.repairable !== 'boolean'
        || !validReason
        || typeof candidate.sourceRevision !== 'number'
        || !Number.isSafeInteger(candidate.sourceRevision)
        || candidate.sourceRevision < 0
        || candidate.sourceRevision > 1_000_000) {
        return null
      }
      if (persisted?.receipt_source_revision !== null
        && persisted?.receipt_source_revision !== undefined
        && persisted.receipt_source_revision !== candidate.sourceRevision) {
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
      ...(receipt.receiptSchemaVersion === 2 ? { receiptSchemaVersion: 2 } : {}),
      ...(source ? { source } : {}),
      templateKey: receipt.templateKey,
      updatedCount: receipt.updatedCount,
    }
  }
  catch {
    return null
  }
}

function parseSafeCounts(raw: string | null): Readonly<Record<string, number>> | undefined {
  if (!raw)
    return undefined
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return undefined
    const counts = Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => (
      /^[A-Za-z][\w-]{0,63}$/u.test(entry[0])
      && typeof entry[1] === 'number'
      && Number.isSafeInteger(entry[1])
      && entry[1] >= 0
    )))
    return Object.keys(counts).length > 0 ? Object.freeze(counts) : undefined
  }
  catch {
    return undefined
  }
}

export function encodeCrawlerTaskCursor(cursor: CrawlerTaskCursor): string {
  return btoa(JSON.stringify({ id: cursor.id, updatedAt: cursor.updatedAt }))
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/u, '')
}

export function decodeCrawlerTaskCursor(value: string): CrawlerTaskCursor {
  try {
    const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/')
    const decoded = atob(`${normalized}${'='.repeat((4 - normalized.length % 4) % 4)}`)
    const parsed: unknown = JSON.parse(decoded)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('invalid')
    const cursor = parsed as Record<string, unknown>
    if (Object.keys(cursor).some(key => key !== 'id' && key !== 'updatedAt')
      || typeof cursor.id !== 'string'
      || !/^\w[\w-]{0,127}$/u.test(cursor.id)
      || typeof cursor.updatedAt !== 'number'
      || !Number.isSafeInteger(cursor.updatedAt)
      || cursor.updatedAt < 0) {
      throw new Error('invalid')
    }
    return { id: cursor.id, updatedAt: cursor.updatedAt }
  }
  catch {
    throw new Error('crawler_task_cursor_invalid')
  }
}

function addMillisecondsInSeconds(now: number, milliseconds: number): number {
  return now + Math.ceil(milliseconds / 1000)
}

function toCrawlerTaskRun(row: CrawlerRunRow): CrawlerTaskRun {
  return {
    attemptNumber: row.attempt_number,
    id: row.id,
    stateVersion: row.state_version,
    status: row.status,
    taskId: row.task_id,
  }
}

interface CrawlerProviderRow {
  application_attempt: number
  environment: string
  provider_conclusion: string | null
  provider_run_attempt: number | null
  provider_run_id: string | null
  provider_status: ProviderRunStatus | null
  reconciliation_window_ends_at: number | null
  ref: string
  repository: string
  run_id: string
  schedule_bucket: string | null
  sha: string | null
  target: string
  template_key: CrawlerTaskTemplateKey
  workflow: string
}

function toProviderAssociationRecord(row: CrawlerProviderRow): ProviderAssociationRecord {
  return {
    applicationAttempt: row.application_attempt,
    environment: row.environment,
    ...(row.provider_conclusion ? { providerConclusion: row.provider_conclusion } : {}),
    ...(row.provider_run_attempt ? { providerRunAttempt: row.provider_run_attempt } : {}),
    ...(row.provider_run_id ? { providerRunId: row.provider_run_id } : {}),
    ...(row.provider_status ? { providerStatus: row.provider_status } : {}),
    ...(row.reconciliation_window_ends_at === null ? {} : { reconciliationWindowEndsAt: row.reconciliation_window_ends_at }),
    ref: row.ref,
    repository: row.repository,
    runId: row.run_id,
    ...(row.schedule_bucket ? { scheduleBucket: row.schedule_bucket } : {}),
    ...(row.sha ? { sha: row.sha } : {}),
    target: row.target,
    template: row.template_key,
    workflow: row.workflow,
  }
}

function toCrawlerRunState(
  row: CrawlerRunRow,
  task: Pick<TaskBindingRow, 'operation' | 'template_key'>,
): CrawlerRunState & { readonly operation: CrawlerTaskOperation } {
  return {
    attemptNumber: row.attempt_number,
    lastEventSequence: row.last_event_sequence,
    operation: task.operation,
    stateVersion: row.state_version,
    status: row.status,
    templateKey: task.template_key,
  }
}

function transitionSequence(decision: Extract<CrawlerRunTransitionDecision, { kind: 'transition' }>): number {
  return decision.nextStateVersion
}

function staleAuditSequence(event: CrawlerRunTransitionEvent): number {
  return event.actor === 'runner' || event.actor === 'dispatcher' ? -(event.sequence + 1) : -1
}

function truncateUtf8(value: string, maxBytes: number): string {
  const encoder = new TextEncoder()
  if (encoder.encode(value).byteLength <= maxBytes) {
    return value
  }

  const suffix = ' [truncated]'
  let end = value.length
  while (end > 0 && encoder.encode(`${value.slice(0, end)}${suffix}`).byteLength > maxBytes) {
    end -= 1
  }

  return `${value.slice(0, end)}${suffix}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseRunnerEventOutcome(value: string): Readonly<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Stored runner event outcome is invalid')
  }
  return parsed as Readonly<Record<string, unknown>>
}

function transitionOutcome(decision: CrawlerRunTransitionDecision): Readonly<Record<string, unknown>> {
  return decision.kind === 'transition'
    ? { accepted: true, status: decision.nextStatus }
    : { accepted: false, reason: decision.reasonCode }
}

function isRepairSnapshot(snapshot: CrawlerTaskSnapshotUnion): snapshot is RepairPlayersTaskSnapshot {
  return 'operation' in snapshot && snapshot.operation === 'repair_players'
}

function isRepairReceiptCandidate(
  value: ProcessCrawlerRunnerEventInput['receipt'],
): value is Extract<ProcessCrawlerRunnerEventInput['receipt'], { readonly operation: 'repair_players' }> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'operation' in value
    && value.operation === 'repair_players'
}

function isOrdinaryReceiptCandidate(value: ProcessCrawlerRunnerEventInput['receipt']): value is CrawlerRunReceiptCandidate {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'templateKey' in value
}

function shouldAutoRetryRepairFailure(input: {
  readonly attemptNumber: number
  readonly operation: CrawlerTaskOperation
  readonly safeSummary?: string
  readonly status: CrawlerRunStatus
}): boolean {
  return input.operation === 'repair_players'
    && input.status === 'failed'
    && input.attemptNumber === 1
    && (input.safeSummary === 'source_read_failed' || input.safeSummary === 'source_write_failed')
}

export function createCrawlerTaskRepository(db: CrawlerTaskDatabase, options: CrawlerRepositoryOptions = {}) {
  const d1 = asD1Client(db)
  const now = options.now ?? (() => new Date())
  const createId = options.createId ?? (() => crypto.randomUUID())

  async function getRunRow(runId: string): Promise<CrawlerRunRow | undefined> {
    const result = await d1.prepare(`
      SELECT id, task_id, attempt_number, status, state_version, last_event_sequence,
        lease_expires_at, last_heartbeat_at, cancel_requested_at, failure_code,
        receipt_summary_json, receipt_schema_version, receipt_primary_content_id,
        receipt_source_revision, terminal_at
      FROM crawler_run
      WHERE id = ?
    `).bind(runId).all<CrawlerRunRow>()
    return result.results?.[0]
  }

  async function getTaskBinding(runId: string): Promise<TaskBindingRow | undefined> {
    const result = await d1.prepare(`
      SELECT task.template_key, task.operation, task.requested_by_user_id, task.request_snapshot_json, run.task_id
      FROM crawler_run AS run
      INNER JOIN crawler_task AS task ON task.id = run.task_id
      WHERE run.id = ?
    `).bind(runId).all<TaskBindingRow>()
    return result.results?.[0]
  }

  async function readRepairTaskState(movieId: string): Promise<{ readonly reason: RepairPlayersReason, readonly sourceRevision: number } | undefined> {
    const result = await d1.prepare(`
      SELECT disposition, source_revision
      FROM movie_source_state
      WHERE movie_id = ?
      LIMIT 1
    `).bind(movieId).all<RepairTaskStateRow>()
    const row = result.results?.[0]
    if (!row || (row.disposition !== 'no_source' && row.disposition !== 'source_failed'))
      return undefined
    return {
      reason: row.disposition,
      sourceRevision: row.source_revision,
    }
  }

  async function readCurrentSourceRevision(movieId: string): Promise<number | undefined> {
    const result = await d1.prepare(`
      SELECT source_revision
      FROM movie_source_state
      WHERE movie_id = ?
      LIMIT 1
    `).bind(movieId).all<{ readonly source_revision: number | null }>()
    const revision = result.results?.[0]?.source_revision
    return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined
  }

  function parseTaskSnapshot(raw: string, operation: CrawlerTaskOperation): CrawlerTaskSnapshotUnion {
    const parsed = readCrawlerTaskSnapshot(JSON.parse(raw), operation)
    if (!parsed.ok)
      throw new Error(`task snapshot ${parsed.reason}`)
    return parsed.snapshot
  }

  async function getProviderAssociation(runId: string): Promise<ProviderAssociationRecord | undefined> {
    try {
      const result = await d1.prepare(`
        SELECT run_id, application_attempt, template_key, target, workflow, repository, ref,
          environment, provider_run_id, provider_run_attempt, sha, provider_status,
          provider_conclusion, reconciliation_window_ends_at, schedule_bucket
        FROM crawler_run_provider_association
        WHERE run_id = ?
        LIMIT 1
      `).bind(runId).all<CrawlerProviderRow>()
      const row = result.results?.[0]
      return row ? toProviderAssociationRecord(row) : undefined
    }
    catch {
      // Phase 16/17 local runner fixtures use the pre-provider schema.
      return undefined
    }
  }

  async function listTasks(input: {
    readonly cursor?: CrawlerTaskCursor
    readonly limit: number
    readonly templateKey?: CrawlerTaskTemplateKey
  }): Promise<CrawlerTaskListPage> {
    const requestedLimit = Math.max(1, Math.min(50, input.limit))
    const result = await d1.prepare(`
      SELECT id, template_key, latest_run_id, created_at, updated_at
      FROM crawler_task
      WHERE (? IS NULL OR template_key = ?)
        AND (? IS NULL OR updated_at < ? OR (updated_at = ? AND id < ?))
      ORDER BY updated_at DESC, id DESC
      LIMIT ?
    `).bind(
      input.templateKey ?? null,
      input.templateKey ?? null,
      input.cursor?.updatedAt ?? null,
      input.cursor?.updatedAt ?? null,
      input.cursor?.updatedAt ?? null,
      input.cursor?.id ?? null,
      requestedLimit + 1,
    ).all<CrawlerTaskRow>()
    const rows = result.results ?? []
    const hasMore = rows.length > requestedLimit
    const pageRows = rows.slice(0, requestedLimit)
    const last = pageRows.at(-1)
    return {
      nextCursor: hasMore && last
        ? encodeCrawlerTaskCursor({ id: last.id, updatedAt: last.updated_at })
        : null,
      tasks: pageRows.map(toCrawlerTaskListItem),
    }
  }

  async function getTaskDetail(taskId: string): Promise<CrawlerTaskDetailReadModel | undefined> {
    const taskResult = await d1.prepare(`
      SELECT id, template_key, latest_run_id, created_at, updated_at
      FROM crawler_task
      WHERE id = ?
      LIMIT 1
    `).bind(taskId).all<CrawlerTaskRow>()
    const taskRow = taskResult.results?.[0]
    if (!taskRow)
      return undefined

    const runsResult = await d1.prepare(`
      SELECT id, task_id, attempt_number, status, state_version, last_event_sequence,
        lease_expires_at, last_heartbeat_at, cancel_requested_at, failure_code,
        receipt_summary_json, receipt_schema_version, receipt_primary_content_id,
        receipt_source_revision, created_at, updated_at, terminal_at
      FROM crawler_run
      WHERE task_id = ?
      ORDER BY attempt_number DESC, id DESC
    `).bind(taskId).all<CrawlerRunRow>()

    const runs: CrawlerRunReadModel[] = []
    for (const row of runsResult.results ?? []) {
      const association = await getProviderAssociation(row.id)
      let provider = null
      if (association) {
        try {
          provider = createProviderAssociationSummary({
            environment: association.environment,
            providerConclusion: association.providerConclusion,
            providerRunAttempt: association.providerRunAttempt,
            providerRunId: association.providerRunId,
            providerStatus: association.providerStatus,
            ref: association.ref,
            repository: association.repository,
            sha: association.sha,
            workflow: association.workflow,
          })
        }
        catch {
          // Legacy or malformed provider rows remain unavailable at the API boundary.
          provider = null
        }
      }
      runs.push({
        attemptNumber: row.attempt_number,
        cancelRequestedAt: row.cancel_requested_at,
        createdAt: row.created_at,
        failureCode: row.failure_code as CrawlerRunFailureCode | null,
        id: row.id,
        provider,
        receipt: parseValidatedReceipt(row.status, row.receipt_summary_json, row),
        stateVersion: row.state_version,
        status: row.status,
        taskId: row.task_id,
        terminalAt: row.terminal_at,
        updatedAt: row.updated_at,
      })
    }
    return { runs, task: toCrawlerTaskListItem(taskRow) }
  }

  async function listRunLogs(input: {
    readonly cursor?: number
    readonly limit: number
    readonly runId: string
    readonly taskId: string
  }): Promise<CrawlerRunLogPage> {
    const requestedLimit = Math.max(1, Math.min(50, input.limit))
    const result = await d1.prepare(`
      SELECT log.sequence, log.level, log.code, log.safe_message, log.counts_json, log.created_at
      FROM crawler_run_log AS log
      INNER JOIN crawler_run AS run ON run.id = log.run_id
      WHERE run.task_id = ? AND log.run_id = ? AND (? IS NULL OR log.sequence < ?)
      ORDER BY log.sequence DESC
      LIMIT ?
    `).bind(input.taskId, input.runId, input.cursor ?? null, input.cursor ?? null, requestedLimit + 1).all<CrawlerRunLogRow>()
    const rows = result.results ?? []
    const hasMore = rows.length > requestedLimit
    const pageRows = rows.slice(0, requestedLimit)
    return {
      logs: pageRows.map(row => ({
        code: row.code,
        ...(parseSafeCounts(row.counts_json) ? { counts: parseSafeCounts(row.counts_json) } : {}),
        createdAt: row.created_at,
        level: row.level,
        safeMessage: row.safe_message,
        sequence: row.sequence,
      })),
      nextCursor: hasMore ? pageRows.at(-1)?.sequence ?? null : null,
    }
  }

  async function listProviderReconciliationCandidates(): Promise<readonly ProviderReconciliationCandidate[]> {
    try {
      const result = await d1.prepare(`
        SELECT association.run_id, association.application_attempt, association.template_key,
          association.target, association.workflow, association.repository, association.ref,
          association.environment, association.provider_run_id, association.provider_run_attempt,
          association.sha, association.provider_status, association.provider_conclusion,
          association.reconciliation_window_ends_at, association.schedule_bucket,
          run.status AS run_status
        FROM crawler_run_provider_association AS association
        INNER JOIN crawler_run AS run ON run.id = association.run_id
        WHERE association.provider_run_id IS NOT NULL
          AND (
            run.status IN ('dispatching', 'running', 'cancel_requested')
            OR (run.status = 'succeeded' AND (association.provider_status IS NULL OR association.provider_status <> 'completed'))
          )
        ORDER BY association.updated_at ASC, association.run_id ASC
      `).all<CrawlerProviderRow & { run_status: CrawlerRunStatus }>()
      return (result.results ?? []).map(row => ({ ...toProviderAssociationRecord(row), runStatus: row.run_status }))
    }
    catch {
      return []
    }
  }

  async function pollDispatch(): Promise<CrawlerRunDispatchCandidate | undefined> {
    const result = await d1.prepare(`
      SELECT run.id, run.attempt_number, run.last_event_sequence, task.operation, task.request_snapshot_json
      FROM crawler_run AS run
      INNER JOIN crawler_task AS task ON task.id = run.task_id
      WHERE run.status = 'queued'
      ORDER BY run.created_at ASC, run.id ASC
      LIMIT 1
    `).all<{
      attempt_number: number
      id: string
      last_event_sequence: number
      operation: CrawlerTaskOperation
      request_snapshot_json: string
    }>()
    const row = result.results?.[0]
    if (!row) {
      return undefined
    }

    const snapshot = parseTaskSnapshot(row.request_snapshot_json, row.operation)
    return {
      attempt: row.attempt_number,
      runId: row.id,
      sequence: row.last_event_sequence + 1,
      snapshot,
    }
  }

  async function findActiveLease(templateKey: CrawlerTaskTemplateKey, nowSeconds: number): Promise<CrawlerTaskRun | undefined> {
    const result = await d1.prepare(`
      SELECT run.id, run.task_id, run.attempt_number, run.status, run.state_version,
        run.last_event_sequence, run.lease_expires_at, run.last_heartbeat_at,
        run.cancel_requested_at, run.failure_code, run.receipt_summary_json, run.terminal_at
      FROM crawler_template_lease AS lease
      INNER JOIN crawler_run AS run ON run.id = lease.run_id
      WHERE lease.template_key = ?
        AND lease.expires_at > ?
        AND run.status IN ('queued', 'dispatching', 'running', 'cancel_requested')
    `).bind(templateKey, nowSeconds).all<CrawlerRunRow>()
    const row = result.results?.[0]
    return row ? toCrawlerTaskRun(row) : undefined
  }

  async function createOrGetActiveRun(input: CreateCrawlerTaskRunInput): Promise<CrawlerTaskRunResult> {
    const currentNow = toUnixSeconds(now())
    const existing = await findActiveLease(input.templateKey, currentNow)
    if (existing) {
      return { kind: 'existing_active_run', run: existing }
    }

    const operation = input.operation ?? input.templateKey
    const taskId = createId()
    const runId = createId()
    let snapshot: CrawlerTaskSnapshotUnion
    if (operation === 'repair_players') {
      if (input.templateKey !== 'movie'
        || !input.movieId
        || input.targetIntent !== 'restore_playable_sources'
        || (input.reason !== 'no_source' && input.reason !== 'source_failed')) {
        throw new Error('repair task input is invalid')
      }
      const currentState = await readRepairTaskState(input.movieId)
      if (!currentState || currentState.reason !== input.reason) {
        throw new Error('repair task source disposition is no longer repairable')
      }
      snapshot = createCrawlerTaskSnapshot({
        movieId: input.movieId,
        operation: 'repair_players',
        reason: currentState.reason,
        sourceRevision: currentState.sourceRevision,
        targetIntent: 'restore_playable_sources',
      })
    }
    else {
      snapshot = createCrawlerTaskSnapshot(input.templateKey)
    }
    const leaseExpiresAt = addMillisecondsInSeconds(currentNow, CRAWLER_LEASE_DURATION_MS)

    try {
      await d1.batch([
        d1.prepare(`
          INSERT INTO crawler_task (
            id, template_key, operation, template_version, requested_by_user_id,
            request_snapshot_json, idempotency_key, latest_run_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          taskId,
          snapshot.templateKey,
          operation,
          snapshot.templateVersion,
          input.requestedByUserId,
          JSON.stringify(snapshot),
          input.idempotencyKey ?? null,
          runId,
          currentNow,
          currentNow,
        ),
        d1.prepare(`
          INSERT INTO crawler_run (
            id, task_id, attempt_number, status, state_version, last_event_sequence,
            lease_expires_at, created_at, updated_at
          ) VALUES (?, ?, 1, 'queued', 0, 0, ?, ?, ?)
        `).bind(runId, taskId, leaseExpiresAt, currentNow, currentNow),
        d1.prepare(`
          INSERT INTO crawler_template_lease (template_key, run_id, expires_at, renewed_at)
          VALUES (?, ?, ?, ?)
        `).bind(snapshot.templateKey, runId, leaseExpiresAt, currentNow),
        d1.prepare(`
          INSERT INTO crawler_run_transition (
            id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
          ) VALUES (?, ?, 0, 'queued', 'queued', 'created', 'queued run created', ?)
        `).bind(createId(), runId, currentNow),
      ])
    }
    catch (error) {
      const leaseOwner = await findActiveLease(input.templateKey, currentNow)
      if (leaseOwner) {
        return { kind: 'existing_active_run', run: leaseOwner }
      }
      throw new Error(`Could not create crawler task run: ${errorMessage(error)}`)
    }

    return {
      kind: 'created',
      run: {
        attemptNumber: 1,
        id: runId,
        stateVersion: 0,
        status: 'queued',
        taskId,
      },
      snapshot,
    }
  }

  async function ensureProviderAssociation(input: EnsureProviderAssociationInput): Promise<ProviderAssociationRecord | undefined> {
    const snapshot = createProviderSnapshot(input.template)
    const currentNow = toUnixSeconds(now())
    const windowEndsAt = addMillisecondsInSeconds(currentNow, DEFAULT_PROVIDER_RECONCILIATION_WINDOW_MS)
    try {
      await d1.prepare(`
        INSERT INTO crawler_run_provider_association (
          run_id, application_attempt, provider, template_key, target, workflow,
          repository, ref, environment, crawler_entrypoint, reconciliation_window_ends_at,
          schedule_bucket, created_at, updated_at
        ) VALUES (?, ?, 'github-actions', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(run_id) DO UPDATE SET
          application_attempt = excluded.application_attempt,
          updated_at = excluded.updated_at
      `).bind(
        input.runId,
        input.attempt,
        snapshot.templateKey,
        snapshot.target,
        snapshot.workflow,
        snapshot.repository,
        snapshot.ref,
        snapshot.environment,
        snapshot.crawlerEntrypoint,
        windowEndsAt,
        input.scheduleBucket ?? null,
        currentNow,
        currentNow,
      ).run()
      return getProviderAssociation(input.runId)
    }
    catch {
      return undefined
    }
  }

  async function applyTransition(
    runId: string,
    event: CrawlerRunTransitionEvent,
    options: { readonly failureCode?: CrawlerRunFailureCode, readonly receipt?: CrawlerRunReceipt | ValidatedCrawlerRunReceipt | RepairPlayersReceipt, readonly safeSummary?: string } = {},
  ): Promise<CrawlerRunTransitionDecision> {
    const run = await getRunRow(runId)
    const task = await getTaskBinding(runId)
    if (!run || !task) {
      throw new Error(`Crawler run ${runId} was not found`)
    }

    const decision = decideCrawlerRunTransition(toCrawlerRunState(run, task), event)
    const currentNow = toUnixSeconds(now())
    const safeSummary = options.safeSummary ? truncateUtf8(options.safeSummary, CRAWLER_MAX_SAFE_LOG_BYTES) : null

    if (decision.kind !== 'transition') {
      await d1.prepare(`
        INSERT OR IGNORE INTO crawler_run_transition (
          id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        createId(),
        runId,
        staleAuditSequence(event),
        run.status,
        run.status,
        decision.reasonCode,
        safeSummary,
        currentNow,
      ).run()
      return decision
    }

    const isHeartbeat = event.type === 'runner_heartbeat'
    const isTerminal = isTerminalCrawlerRunStatus(decision.nextStatus)
    const nextEventSequence = decision.nextEventSequence ?? run.last_event_sequence
    const leaseExpiresAt = isHeartbeat
      ? addMillisecondsInSeconds(currentNow, CRAWLER_LEASE_DURATION_MS)
      : run.lease_expires_at
    const terminalAt = isTerminal ? currentNow : null
    const receipt = options.receipt ?? (event.type === 'runner_succeeded' ? event.receipt : undefined)
    const failureCode = options.failureCode ?? decision.failureCode
    const validatedReceipt = receipt && 'primaryContentId' in receipt
      ? receipt as ValidatedCrawlerRunReceipt
      : undefined
    const repairReceipt = receipt && 'operation' in receipt && receipt.operation === 'repair_players'
      ? receipt as RepairPlayersReceipt
      : undefined
    const receiptSummary = validatedReceipt || repairReceipt
      ? JSON.stringify(validatedReceipt ?? repairReceipt)
      : isTerminal
        ? null
        : run.receipt_summary_json
    const receiptSchemaVersion = validatedReceipt?.receiptSchemaVersion
      ?? (repairReceipt ? 2 : (isTerminal ? null : run.receipt_schema_version))
    const receiptPrimaryContentId = validatedReceipt?.primaryContentId
      ?? (repairReceipt?.movieId ?? (isTerminal ? null : run.receipt_primary_content_id))
    const receiptSourceRevision = validatedReceipt?.source?.sourceRevision
      ?? (repairReceipt?.sourceRevision ?? (isTerminal ? null : run.receipt_source_revision))

    const batchResults = await d1.batch([
      d1.prepare(`
        INSERT INTO crawler_run_transition (
          id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM crawler_run
          WHERE id = ? AND status = ? AND state_version = ? AND last_event_sequence = ?
        )
      `).bind(
        createId(),
        runId,
        transitionSequence(decision),
        run.status,
        decision.nextStatus,
        decision.reasonCode,
        safeSummary,
        currentNow,
        runId,
        run.status,
        run.state_version,
        run.last_event_sequence,
      ),
      d1.prepare(`
        UPDATE crawler_run
        SET status = ?,
          state_version = ?,
          last_event_sequence = ?,
          lease_expires_at = ?,
          last_heartbeat_at = CASE WHEN ? THEN ? ELSE last_heartbeat_at END,
          cancel_requested_at = CASE WHEN ? THEN ? ELSE cancel_requested_at END,
          failure_code = ?,
          receipt_summary_json = ?,
          receipt_schema_version = ?,
          receipt_primary_content_id = ?,
          receipt_source_revision = ?,
          terminal_at = ?,
          updated_at = ?
        WHERE id = ? AND status = ? AND state_version = ? AND last_event_sequence = ?
      `).bind(
        decision.nextStatus,
        decision.nextStateVersion,
        nextEventSequence,
        isTerminal ? null : leaseExpiresAt,
        isHeartbeat ? 1 : 0,
        currentNow,
        decision.nextStatus === 'cancel_requested' ? 1 : 0,
        currentNow,
        failureCode ?? null,
        receiptSummary,
        receiptSchemaVersion,
        receiptPrimaryContentId,
        receiptSourceRevision,
        terminalAt,
        currentNow,
        runId,
        run.status,
        run.state_version,
        run.last_event_sequence,
      ),
      ...(isTerminal
        ? [d1.prepare('DELETE FROM crawler_template_lease WHERE template_key = ? AND run_id = ?').bind(task.template_key, runId)]
        : []),
    ])

    const updateResult = batchResults[1] as { meta?: { changes?: number } } | undefined
    if ((updateResult?.meta?.changes ?? 0) === 0) {
      const current = await getRunRow(runId)
      if (!current) {
        throw new Error(`Crawler run ${runId} disappeared during transition`)
      }
      return {
        currentStatus: current.status,
        kind: 'stale',
        reasonCode: 'stale_event',
        sequence: event.actor === 'runner' ? event.sequence : current.last_event_sequence,
      }
    }

    return decision
  }

  async function claimDispatch(runId: string): Promise<CrawlerRunTransitionDecision>
  async function claimDispatch(input: ClaimCrawlerRunInput): Promise<ClaimCrawlerRunResult>
  async function claimDispatch(input: string | ClaimCrawlerRunInput): Promise<ClaimCrawlerRunResult | CrawlerRunTransitionDecision> {
    if (typeof input === 'string') {
      const run = await getRunRow(input)
      if (!run) {
        throw new Error(`Crawler run ${input} was not found`)
      }
      return applyTransition(input, {
        actor: 'dispatcher',
        sequence: run.last_event_sequence + 1,
        type: 'dispatch_claim',
      })
    }

    const run = await getRunRow(input.runId)
    if (!run) {
      return { kind: 'not_found' }
    }
    if (run.attempt_number !== input.attempt) {
      return { kind: 'attempt_mismatch' }
    }

    const existing = await findRunnerEvent(input.runId, input.eventId, input.nonce)
    if (existing) {
      return classifyExistingRunnerEvent(existing, input)
    }

    const decision = input.sequence === run.last_event_sequence + 1
      ? await applyTransition(input.runId, {
          actor: 'dispatcher',
          sequence: input.sequence,
          type: 'dispatch_claim',
        })
      : {
          currentStatus: run.status,
          kind: 'stale' as const,
          reasonCode: 'stale_event' as const,
          sequence: input.sequence,
        }
    const outcome = transitionOutcome(decision)
    const recorded = await recordRunnerEvent({
      bodySha256: input.bodySha256,
      eventId: input.eventId,
      keyId: input.keyId,
      nonce: input.nonce,
      outcome,
      runId: input.runId,
      sequence: input.sequence,
    })
    if (!recorded) {
      const concurrent = await findRunnerEvent(input.runId, input.eventId, input.nonce)
      if (!concurrent) {
        throw new Error('Runner claim outcome was not persisted')
      }
      return classifyExistingRunnerEvent(concurrent, input)
    }

    return decision.kind === 'transition'
      ? { kind: 'accepted', outcome }
      : { kind: 'rejected', outcome }
  }

  async function renewLease(runId: string, sequence: number): Promise<CrawlerRunTransitionDecision> {
    return applyTransition(runId, { actor: 'runner', sequence, type: 'runner_heartbeat' })
  }

  async function createAutomaticRetryRun(run: CrawlerRunRow, snapshot: CrawlerTaskSnapshotUnion): Promise<void> {
    const currentNow = toUnixSeconds(now())
    const nextRunId = createId()
    const expiresAt = addMillisecondsInSeconds(currentNow, CRAWLER_LEASE_DURATION_MS)
    const retry = createManualRetryAttempt({
      attemptNumber: run.attempt_number,
      snapshot,
      status: 'failed',
    })

    await d1.batch([
      d1.prepare(`
        INSERT INTO crawler_run (
          id, task_id, attempt_number, status, state_version, last_event_sequence,
          lease_expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'queued', 0, 0, ?, ?, ?)
      `).bind(nextRunId, run.task_id, retry.attemptNumber, expiresAt, currentNow, currentNow),
      d1.prepare(`
        INSERT INTO crawler_template_lease (template_key, run_id, expires_at, renewed_at)
        VALUES (?, ?, ?, ?)
      `).bind(snapshot.templateKey, nextRunId, expiresAt, currentNow),
      d1.prepare(`
        INSERT INTO crawler_run_transition (
          id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
        ) VALUES (?, ?, 0, 'queued', 'queued', 'automatic_retry_created', 'automatic retry from immutable task snapshot', ?)
      `).bind(createId(), nextRunId, currentNow),
      d1.prepare('UPDATE crawler_task SET latest_run_id = ?, updated_at = ? WHERE id = ?')
        .bind(nextRunId, currentNow, run.task_id),
    ])
  }

  async function retryRun(runId: string): Promise<CrawlerTaskRunResult> {
    const run = await getRunRow(runId)
    const task = await getTaskBinding(runId)
    if (!run || !task) {
      throw new Error(`Crawler run ${runId} was not found`)
    }

    const snapshot = parseTaskSnapshot(task.request_snapshot_json, task.operation)
    if (isRepairSnapshot(snapshot)) {
      const currentState = await readRepairTaskState(snapshot.movieId)
      if (!currentState) {
        throw new Error('repair task source disposition is no longer repairable')
      }
      return createOrGetActiveRun({
        movieId: snapshot.movieId,
        operation: 'repair_players',
        reason: currentState.reason,
        requestedByUserId: task.requested_by_user_id,
        targetIntent: snapshot.targetIntent,
        templateKey: 'movie',
      })
    }

    const retry = createManualRetryAttempt({
      attemptNumber: run.attempt_number,
      snapshot,
      status: run.status,
    })
    const existing = await findActiveLease(task.template_key, toUnixSeconds(now()))
    if (existing) {
      return { kind: 'existing_active_run', run: existing }
    }

    const currentNow = toUnixSeconds(now())
    const nextRunId = createId()
    const expiresAt = addMillisecondsInSeconds(currentNow, CRAWLER_LEASE_DURATION_MS)
    try {
      await d1.batch([
        d1.prepare(`
          INSERT INTO crawler_run (
            id, task_id, attempt_number, status, state_version, last_event_sequence,
            lease_expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, 'queued', 0, 0, ?, ?, ?)
        `).bind(nextRunId, run.task_id, retry.attemptNumber, expiresAt, currentNow, currentNow),
        d1.prepare(`
          INSERT INTO crawler_template_lease (template_key, run_id, expires_at, renewed_at)
          VALUES (?, ?, ?, ?)
        `).bind(task.template_key, nextRunId, expiresAt, currentNow),
        d1.prepare(`
          INSERT INTO crawler_run_transition (
            id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
          ) VALUES (?, ?, 0, 'queued', 'queued', 'manual_retry_created', 'retry from immutable task snapshot', ?)
        `).bind(createId(), nextRunId, currentNow),
        d1.prepare('UPDATE crawler_task SET latest_run_id = ?, updated_at = ? WHERE id = ?')
          .bind(nextRunId, currentNow, run.task_id),
      ])
    }
    catch (error) {
      const leaseOwner = await findActiveLease(task.template_key, currentNow)
      if (leaseOwner) {
        return { kind: 'existing_active_run', run: leaseOwner }
      }
      throw new Error(`Could not retry crawler run: ${errorMessage(error)}`)
    }

    await ensureProviderAssociation({
      attempt: retry.attemptNumber,
      runId: nextRunId,
      template: task.template_key,
    })

    return {
      kind: 'created',
      run: {
        attemptNumber: retry.attemptNumber,
        id: nextRunId,
        stateVersion: 0,
        status: 'queued',
        taskId: run.task_id,
      },
      snapshot: retry.snapshot,
    }
  }

  async function appendLog(input: AppendCrawlerRunLogInput): Promise<{ readonly inserted: boolean, readonly truncated: boolean }> {
    const currentNow = toUnixSeconds(now())
    const normalCount = await d1.prepare(`
      SELECT COUNT(*) AS count
      FROM crawler_run_log
      WHERE run_id = ? AND code != 'log_truncated'
    `).bind(input.runId).all<{ count: number }>()
    const count = Number(normalCount.results?.[0]?.count ?? 0)
    const safeMessage = truncateUtf8(input.message, CRAWLER_MAX_SAFE_LOG_BYTES)
    const expiresAt = addMillisecondsInSeconds(currentNow, CRAWLER_RUN_LOG_RETENTION_MS)

    if (count >= CRAWLER_MAX_NORMAL_LOG_ROWS) {
      const marker = await d1.prepare(`
        SELECT id FROM crawler_run_log
        WHERE run_id = ? AND code = 'log_truncated'
      `).bind(input.runId).all<{ id: string }>()
      if (marker.results?.[0]) {
        return { inserted: false, truncated: true }
      }

      await d1.prepare(`
        INSERT OR IGNORE INTO crawler_run_log (
          id, run_id, sequence, level, code, safe_message, expires_at, created_at
        ) VALUES (?, ?, ?, 'warn', 'log_truncated', ?, ?, ?)
      `).bind(
        createId(),
        input.runId,
        input.sequence,
        'Detailed run log limit reached',
        expiresAt,
        currentNow,
      ).run()
      return { inserted: false, truncated: true }
    }

    await d1.prepare(`
      INSERT OR IGNORE INTO crawler_run_log (
        id, run_id, sequence, level, code, safe_message, counts_json, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      createId(),
      input.runId,
      input.sequence,
      input.level,
      input.code,
      safeMessage,
      input.counts ? JSON.stringify(input.counts) : null,
      expiresAt,
      currentNow,
    ).run()
    return { inserted: true, truncated: safeMessage !== input.message }
  }

  async function recordRunnerEvent(input: {
    readonly bodySha256: string
    readonly eventId: string
    readonly keyId: string
    readonly nonce: string
    readonly outcome: Readonly<Record<string, unknown>>
    readonly runId: string
    readonly sequence: number
  }): Promise<boolean> {
    const currentNow = toUnixSeconds(now())
    const result = await d1.prepare(`
      INSERT OR IGNORE INTO crawler_runner_event (
        id, run_id, event_id, nonce, sequence, body_sha256, key_id, outcome, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      createId(),
      input.runId,
      input.eventId,
      input.nonce,
      input.sequence,
      input.bodySha256,
      input.keyId,
      JSON.stringify(input.outcome),
      currentNow,
    ).run()
    return (result.meta?.changes ?? 0) === 1
  }

  async function findRunnerEvent(runId: string, eventId: string, nonce: string): Promise<CrawlerRunnerEventRow | undefined> {
    const result = await d1.prepare(`
      SELECT event_id, nonce, body_sha256, outcome
      FROM crawler_runner_event
      WHERE run_id = ? AND (event_id = ? OR nonce = ?)
      LIMIT 1
    `).bind(runId, eventId, nonce).all<CrawlerRunnerEventRow>()
    return result.results?.[0]
  }

  function classifyExistingRunnerEvent(
    existing: CrawlerRunnerEventRow,
    input: Pick<ClaimCrawlerRunInput, 'bodySha256' | 'eventId' | 'nonce'>,
  ): Extract<ProcessCrawlerRunnerEventResult, { kind: 'conflict' | 'duplicate' }> {
    if (existing.event_id !== input.eventId || existing.nonce !== input.nonce || existing.body_sha256 !== input.bodySha256) {
      return { kind: 'conflict' }
    }
    return { kind: 'duplicate', outcome: parseRunnerEventOutcome(existing.outcome) }
  }

  async function processRunnerEvent(input: ProcessCrawlerRunnerEventInput): Promise<ProcessCrawlerRunnerEventResult> {
    const run = await getRunRow(input.runId)
    const task = await getTaskBinding(input.runId)
    if (!run || !task) {
      return { kind: 'not_found' }
    }
    if (run.attempt_number !== input.attempt) {
      return { kind: 'attempt_mismatch' }
    }
    const snapshot = parseTaskSnapshot(task.request_snapshot_json, task.operation)
    if (isOrdinaryReceiptCandidate(input.receipt) && input.receipt.templateKey !== task.template_key) {
      return { kind: 'receipt_template_mismatch' }
    }

    const existing = await findRunnerEvent(input.runId, input.eventId, input.nonce)
    if (existing) {
      return classifyExistingRunnerEvent(existing, input)
    }

    if (input.event.type === 'runner_succeeded') {
      const provider = await getProviderAssociation(input.runId)
      const providerIsBoundToAttempt = provider
        && provider.applicationAttempt === input.attempt
        && Boolean(provider.providerRunId)
      const providerAllowsRunnerSuccess = providerIsBoundToAttempt
        && (provider.providerStatus === 'in_progress'
          || (provider.providerStatus === 'completed' && provider.providerConclusion === 'success'))
      if (provider && !providerAllowsRunnerSuccess) {
        const outcome = { accepted: false, reason: 'provider_success_required' }
        await recordRunnerEvent({
          bodySha256: input.bodySha256,
          eventId: input.eventId,
          keyId: input.keyId,
          nonce: input.nonce,
          outcome,
          runId: input.runId,
          sequence: input.sequence,
        })
        return { kind: 'rejected', outcome }
      }
    }

    if (isRepairSnapshot(snapshot) && input.event.type === 'runner_succeeded') {
      const repairReceipt = isRepairReceiptCandidate(input.receipt) ? input.receipt : undefined
      const currentRevision = repairReceipt ? await readCurrentSourceRevision(snapshot.movieId) : undefined
      const repairMatchesTask = repairReceipt
        && repairReceipt.movieId === snapshot.movieId
        && repairReceipt.sourceRevision > snapshot.sourceRevision
        && currentRevision === repairReceipt.sourceRevision
      if (!repairMatchesTask) {
        const outcome = { accepted: false, reason: 'repair_source_revision_conflict' }
        await recordRunnerEvent({
          bodySha256: input.bodySha256,
          eventId: input.eventId,
          keyId: input.keyId,
          nonce: input.nonce,
          outcome,
          runId: input.runId,
          sequence: input.sequence,
        })
        return { kind: 'rejected', outcome }
      }
    }

    let event = input.event
    let receipt: CrawlerRunReceipt | ValidatedCrawlerRunReceipt | RepairPlayersReceipt | undefined
    let safeSummary = input.safeSummary
    let failureCode: 'receipt_missing' | undefined

    if (input.event.type === 'runner_succeeded') {
      const validation = await validateReceiptCandidate({
        candidate: input.receipt as Parameters<typeof validateReceiptCandidate>[0]['candidate'],
        database: db,
        snapshot,
        templateKey: task.template_key,
      })
      if (!validation.ok) {
        event = { actor: 'runner', sequence: input.sequence, type: 'runner_failed' }
        safeSummary = 'receipt_missing'
        failureCode = 'receipt_missing'
      }
      else {
        receipt = validation.receipt
        event = { ...input.event, receipt: input.receipt as CrawlerRunReceipt } as CrawlerRunTransitionEvent
      }
    }

    const decision = await applyTransition(input.runId, event, {
      failureCode,
      receipt,
      safeSummary,
    })
    const outcome = transitionOutcome(decision)
    const recorded = await recordRunnerEvent({
      bodySha256: input.bodySha256,
      eventId: input.eventId,
      keyId: input.keyId,
      nonce: input.nonce,
      outcome,
      runId: input.runId,
      sequence: input.sequence,
    })
    if (!recorded) {
      const concurrent = await findRunnerEvent(input.runId, input.eventId, input.nonce)
      if (!concurrent) {
        throw new Error('Runner event receipt was not persisted')
      }
      return classifyExistingRunnerEvent(concurrent, input)
    }

    if (decision.kind === 'transition'
      && shouldAutoRetryRepairFailure({
        attemptNumber: run.attempt_number,
        operation: task.operation,
        safeSummary,
        status: decision.nextStatus,
      })) {
      await createAutomaticRetryRun(run, snapshot)
    }

    if (decision.kind === 'transition' && input.log) {
      await appendLog(input.log)
    }
    return decision.kind === 'transition'
      ? { kind: 'accepted', outcome }
      : { kind: 'rejected', outcome }
  }

  async function scheduleRegister(input: ScheduleRegisterInput): Promise<ScheduleRegisterResult> {
    const snapshot = createProviderSnapshot(input.template)
    if (snapshot.workflow !== input.workflow || snapshot.repository !== input.repository || snapshot.ref !== input.ref
      || snapshot.environment !== input.environment || snapshot.target !== input.target) {
      return { accepted: false, attempt: 0, runId: '' }
    }

    const existing = await d1.prepare(`
      SELECT run_id, application_attempt, safe_facts_json
      FROM crawler_run_provider_association
      WHERE template_key = ? AND target = ? AND workflow = ? AND schedule_bucket = ?
      LIMIT 1
    `).bind(input.template, input.target, input.workflow, input.scheduleBucket).all<{
      application_attempt: number
      run_id: string
      safe_facts_json: string | null
    }>()
    const existingRow = existing.results?.[0]
    if (existingRow) {
      return { accepted: true, attempt: existingRow.application_attempt, runId: existingRow.run_id }
    }

    const created = await createOrGetActiveRun({
      idempotencyKey: `github-actions:schedule:${input.template}:${input.scheduleBucket}`,
      requestedByUserId: 'github-actions-schedule',
      templateKey: input.template,
    })
    const run = created.run
    const currentNow = toUnixSeconds(now())
    const safeFacts = JSON.stringify({ scheduledAt: input.scheduledAt })
    try {
      await d1.prepare(`
        INSERT INTO crawler_run_provider_association (
          run_id, application_attempt, provider, template_key, target, workflow,
          repository, ref, environment, crawler_entrypoint, safe_facts_json,
          reconciliation_window_ends_at, schedule_bucket, created_at, updated_at
        ) VALUES (?, ?, 'github-actions', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        run.id,
        run.attemptNumber,
        snapshot.templateKey,
        snapshot.target,
        snapshot.workflow,
        snapshot.repository,
        snapshot.ref,
        snapshot.environment,
        snapshot.crawlerEntrypoint,
        safeFacts,
        addMillisecondsInSeconds(currentNow, DEFAULT_PROVIDER_RECONCILIATION_WINDOW_MS),
        input.scheduleBucket,
        currentNow,
        currentNow,
      ).run()
    }
    catch {
      const concurrent = await d1.prepare(`
        SELECT run_id, application_attempt
        FROM crawler_run_provider_association
        WHERE template_key = ? AND target = ? AND workflow = ? AND schedule_bucket = ?
        LIMIT 1
      `).bind(input.template, input.target, input.workflow, input.scheduleBucket).all<{
        application_attempt: number
        run_id: string
      }>()
      const row = concurrent.results?.[0]
      if (row)
        return { accepted: true, attempt: row.application_attempt, runId: row.run_id }
      throw new Error('schedule_registration_persistence_failed')
    }

    return { accepted: true, attempt: run.attemptNumber, runId: run.id }
  }

  async function providerStarted(input: ProviderStartedInput): Promise<ProviderStartedResult> {
    const existingEvent = await findRunnerEvent(input.runId, input.eventId, input.nonce)
    if (existingEvent) {
      if (existingEvent.event_id !== input.eventId || existingEvent.nonce !== input.nonce || existingEvent.body_sha256 !== input.bodySha256)
        return { accepted: false, cancelRequested: false }
      const outcome = parseRunnerEventOutcome(existingEvent.outcome)
      return {
        accepted: outcome.accepted === true,
        cancelRequested: outcome.cancel_requested === true,
      }
    }

    const association = await d1.prepare(`
      SELECT application_attempt, environment, provider_run_attempt, provider_run_id,
        ref, repository, run_id, sha, target, template_key, workflow
      FROM crawler_run_provider_association
      WHERE run_id = ?
      LIMIT 1
    `).bind(input.runId).all<{
      application_attempt: number
      environment: string
      provider_run_attempt: number | null
      provider_run_id: string | null
      ref: string
      repository: string
      run_id: string
      sha: string | null
      target: string
      template_key: CrawlerTaskTemplateKey
      workflow: string
    }>()
    const row = association.results?.[0]
    const run = await getRunRow(input.runId)
    const cancelRequested = run?.status === 'cancel_requested'
    if (run && isTerminalCrawlerRunStatus(run.status)) {
      const outcome = { accepted: false, cancel_requested: false, reason: 'terminal_run' }
      await recordRunnerEvent({
        bodySha256: input.bodySha256,
        eventId: input.eventId,
        keyId: input.keyId,
        nonce: input.nonce,
        outcome,
        runId: input.runId,
        sequence: 1,
      })
      return { accepted: false, cancelRequested: false }
    }
    if (!row || !run || row.application_attempt !== input.attempt || row.template_key !== input.template
      || row.target !== input.target || row.workflow !== input.workflow || row.repository !== input.repository
      || row.ref !== input.ref || row.environment !== input.environment) {
      const outcome = { accepted: false, cancel_requested: cancelRequested, reason: 'provider_mismatch' }
      await recordRunnerEvent({
        bodySha256: input.bodySha256,
        eventId: input.eventId,
        keyId: input.keyId,
        nonce: input.nonce,
        outcome,
        runId: input.runId,
        sequence: 1,
      })
      if (run) {
        await d1.prepare(`
          INSERT OR IGNORE INTO crawler_run_transition (
            id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
          ) VALUES (?, ?, ?, ?, ?, 'provider_mismatch', 'provider snapshot mismatch', ?)
        `).bind(createId(), input.runId, -2, run.status, run.status, toUnixSeconds(now())).run()
      }
      return { accepted: false, cancelRequested }
    }

    if ((row.provider_run_id && row.provider_run_id !== input.providerRunId)
      || (row.provider_run_attempt && row.provider_run_attempt !== input.providerRunAttempt)
      || (row.sha && row.sha !== input.sha)) {
      await d1.prepare(`
        INSERT OR IGNORE INTO crawler_run_transition (
          id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
        ) VALUES (?, ?, -3, ?, ?, 'provider_mismatch', 'provider binding already claimed', ?)
      `).bind(createId(), input.runId, run.status, run.status, toUnixSeconds(now())).run()
      return { accepted: false, cancelRequested }
    }

    const update = await d1.prepare(`
      UPDATE crawler_run_provider_association
      SET provider_run_id = ?, provider_run_attempt = ?, sha = ?, provider_status = ?,
        reconciliation_window_ends_at = COALESCE(reconciliation_window_ends_at, ?),
        safe_facts_json = ?, updated_at = ?
      WHERE run_id = ? AND application_attempt = ?
        AND (provider_run_id IS NULL OR provider_run_id = ?)
        AND (provider_run_attempt IS NULL OR provider_run_attempt = ?)
        AND (sha IS NULL OR sha = ?)
    `).bind(
      input.providerRunId,
      input.providerRunAttempt,
      input.sha,
      'in_progress' satisfies ProviderRunStatus,
      addMillisecondsInSeconds(toUnixSeconds(now()), DEFAULT_PROVIDER_RECONCILIATION_WINDOW_MS),
      JSON.stringify({ providerStarted: true }),
      toUnixSeconds(now()),
      input.runId,
      input.attempt,
      input.providerRunId,
      input.providerRunAttempt,
      input.sha,
    ).run()
    if ((update.meta?.changes ?? 0) === 0) {
      return { accepted: false, cancelRequested }
    }

    const outcome = { accepted: true, cancel_requested: cancelRequested }
    const recorded = await recordRunnerEvent({
      bodySha256: input.bodySha256,
      eventId: input.eventId,
      keyId: input.keyId,
      nonce: input.nonce,
      outcome,
      runId: input.runId,
      sequence: 1,
    })
    if (!recorded) {
      const concurrent = await findRunnerEvent(input.runId, input.eventId, input.nonce)
      if (concurrent) {
        const concurrentOutcome = parseRunnerEventOutcome(concurrent.outcome)
        return { accepted: concurrentOutcome.accepted === true, cancelRequested: concurrentOutcome.cancel_requested === true }
      }
    }
    return { accepted: true, cancelRequested }
  }

  async function recordProviderObservation(input: ProviderObservationInput): Promise<ProviderObservationResult> {
    const association = await getProviderAssociation(input.runId)
    const run = await getRunRow(input.runId)
    if (!association || !run)
      return { kind: 'not_found' }
    if (association.applicationAttempt !== input.attempt)
      return { kind: 'attempt_mismatch' }

    const snapshot = createProviderSnapshot(association.template)
    const snapshotMatches = snapshot.workflow === association.workflow
      && snapshot.repository === association.repository
      && snapshot.ref === association.ref
      && snapshot.environment === association.environment
      && snapshot.target === association.target
      && (!input.path || input.path === snapshot.workflow)
    const providerMatches = association.providerRunId === input.providerRunId
      && (association.providerRunAttempt === undefined || association.providerRunAttempt === input.providerRunAttempt)
    const currentNow = toUnixSeconds(now())
    if (!snapshotMatches || !providerMatches) {
      const windowEndsAt = association.reconciliationWindowEndsAt ?? addMillisecondsInSeconds(currentNow, DEFAULT_PROVIDER_RECONCILIATION_WINDOW_MS)
      await d1.prepare(`
        UPDATE crawler_run_provider_association
        SET reconciliation_window_ends_at = ?, safe_facts_json = ?, updated_at = ?
        WHERE run_id = ? AND application_attempt = ?
      `).bind(
        windowEndsAt,
        JSON.stringify({ providerMismatch: true, providerRunId: input.providerRunId }),
        currentNow,
        input.runId,
        input.attempt,
      ).run()
      await d1.prepare(`
        INSERT OR IGNORE INTO crawler_run_transition (
          id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
        ) VALUES (?, ?, -4, ?, ?, 'provider_mismatch', 'provider observation mismatch', ?)
      `).bind(createId(), input.runId, run.status, run.status, currentNow).run()
      return currentNow >= windowEndsAt
        ? await expireProviderReconciliation(input.runId, input.attempt)
        : { kind: 'provider_mismatch', reconciliationWindowEndsAt: windowEndsAt }
    }

    const updated = await d1.prepare(`
      UPDATE crawler_run_provider_association
      SET provider_status = ?, provider_conclusion = ?, sha = COALESCE(?, sha),
        safe_facts_json = ?, updated_at = ?
      WHERE run_id = ? AND application_attempt = ? AND provider_run_id = ?
    `).bind(
      input.status,
      input.conclusion ?? null,
      input.headSha ?? null,
      JSON.stringify({ providerPoll: true, status: input.status, conclusion: input.conclusion ?? null }),
      currentNow,
      input.runId,
      input.attempt,
      input.providerRunId,
    ).run()
    if ((updated.meta?.changes ?? 0) === 0)
      return { kind: 'provider_mismatch', reconciliationWindowEndsAt: association.reconciliationWindowEndsAt ?? addMillisecondsInSeconds(currentNow, DEFAULT_PROVIDER_RECONCILIATION_WINDOW_MS) }

    if (input.status === 'completed' && input.conclusion === 'cancelled') {
      await applyTransition(input.runId, { actor: 'scheduler', type: 'provider_cancelled' })
    }
    else if (input.status === 'completed' && input.conclusion && input.conclusion !== 'success') {
      await applyTransition(input.runId, { actor: 'scheduler', type: 'provider_failed' })
    }
    else if (input.status === 'completed' && input.conclusion === 'success') {
      await d1.prepare(`
        INSERT OR IGNORE INTO crawler_run_transition (
          id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
        ) VALUES (?, ?, -5, ?, ?, 'provider_success_pending_receipt', 'provider success requires signed validated receipt', ?)
      `).bind(createId(), input.runId, run.status, run.status, currentNow).run()
    }

    return { kind: 'updated', status: input.status, ...(input.conclusion ? { conclusion: input.conclusion } : {}) }
  }

  async function expireProviderReconciliation(runId: string, attempt: number): Promise<ProviderObservationResult> {
    const association = await getProviderAssociation(runId)
    const run = await getRunRow(runId)
    if (!association || !run)
      return { kind: 'not_found' }
    if (association.applicationAttempt !== attempt)
      return { kind: 'attempt_mismatch' }
    if (isTerminalCrawlerRunStatus(run.status))
      return { kind: 'updated', status: association.providerStatus ?? 'completed', ...(association.providerConclusion ? { conclusion: association.providerConclusion } : {}) }
    const decision = await applyTransition(runId, { actor: 'scheduler', type: 'provider_lost' })
    if (decision.kind === 'transition') {
      await d1.prepare(`
        INSERT OR IGNORE INTO crawler_run_transition (
          id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
        ) VALUES (?, ?, -6, ?, ?, 'provider_lost', 'provider reconciliation window expired', ?)
      `).bind(createId(), runId, run.status, decision.nextStatus, toUnixSeconds(now())).run()
    }
    return { kind: 'provider_lost', reason: 'reconciliation_window_expired' }
  }

  async function failProviderReconciliation(runId: string, attempt: number, reason: string): Promise<ProviderObservationResult> {
    const association = await getProviderAssociation(runId)
    const run = await getRunRow(runId)
    if (!association || !run)
      return { kind: 'not_found' }
    if (association.applicationAttempt !== attempt)
      return { kind: 'attempt_mismatch' }
    if (!isTerminalCrawlerRunStatus(run.status)) {
      await d1.prepare(`
        INSERT OR IGNORE INTO crawler_run_transition (
          id, run_id, sequence, from_status, to_status, reason_code, safe_summary, created_at
        ) VALUES (?, ?, -7, ?, ?, 'provider_failed', ?, ?)
      `).bind(createId(), runId, run.status, run.status, truncateUtf8(reason, CRAWLER_MAX_SAFE_LOG_BYTES), toUnixSeconds(now())).run()
      await applyTransition(runId, { actor: 'scheduler', type: 'provider_failed' })
    }
    return { kind: 'updated', status: 'completed', conclusion: 'failure' }
  }

  async function validateDispatch(input: ValidateDispatchInput): Promise<ValidateDispatchResult> {
    const run = await getRunRow(input.runId)
    const task = await getTaskBinding(input.runId)
    if (!run || !task)
      return { accepted: false, reason: 'run_not_found' }
    const snapshot = parseTaskSnapshot(task.request_snapshot_json, task.operation)
    if (run.attempt_number !== input.attempt || task.template_key !== input.template || snapshot.templateKey !== input.template)
      return { accepted: false, reason: 'dispatch_binding_mismatch' }
    if (createProviderSnapshot(input.template).target !== input.target)
      return { accepted: false, reason: 'target_mismatch' }
    return { accepted: true }
  }

  async function sweepExpiredRuns(): Promise<readonly string[]> {
    const currentNow = toUnixSeconds(now())
    const expired = await d1.prepare(`
      SELECT id
      FROM crawler_run
      WHERE status IN ('dispatching', 'running', 'cancel_requested')
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at <= ?
    `).bind(currentNow).all<{ id: string }>()

    const failed: string[] = []
    for (const run of expired.results ?? []) {
      const decision = await applyTransition(run.id, { actor: 'scheduler', type: 'lease_expired' })
      if (decision.kind === 'transition' && decision.nextStatus === 'failed') {
        failed.push(run.id)
      }
    }
    return failed
  }

  async function purgeExpiredRunLogs(at = now()): Promise<number> {
    const result = await d1.prepare('DELETE FROM crawler_run_log WHERE expires_at <= ?')
      .bind(toUnixSeconds(at))
      .run()
    return result.meta?.changes ?? 0
  }

  return {
    appendLog,
    applyTransition,
    claimDispatch,
    createOrGetActiveRun,
    ensureProviderAssociation,
    expireProviderReconciliation,
    failProviderReconciliation,
    getRun: async (runId: string) => {
      const run = await getRunRow(runId)
      return run ? toCrawlerTaskRun(run) : undefined
    },
    getProviderAssociation,
    getTaskDetail,
    listRunLogs,
    listTasks,
    listProviderReconciliationCandidates,
    purgeExpiredRunLogs,
    processRunnerEvent,
    providerStarted,
    recordProviderObservation,
    pollDispatch,
    recordRunnerEvent,
    renewLease,
    retryRun,
    sweepExpiredRuns,
    scheduleRegister,
    validateDispatch,
  }
}
