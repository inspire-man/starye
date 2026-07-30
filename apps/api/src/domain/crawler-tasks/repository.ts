import type { Database } from '@starye/db'
import type { CrawlerRunReceipt, CrawlerRunState, CrawlerRunStatus, CrawlerRunTransitionDecision, CrawlerRunTransitionEvent, CrawlerTaskSnapshot, CrawlerTaskTemplateKey } from './types'
import { createManualRetryAttempt, decideCrawlerRunTransition, isTerminalCrawlerRunStatus } from './state-machine'
import { createCrawlerTaskSnapshot } from './template-registry'
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

type CrawlerTaskDatabase = Pick<Database, '$client'>

interface CrawlerRunRow {
  attempt_number: number
  cancel_requested_at: number | null
  failure_code: string | null
  id: string
  last_event_sequence: number
  last_heartbeat_at: number | null
  lease_expires_at: number | null
  receipt_summary_json: string | null
  state_version: number
  status: CrawlerRunStatus
  task_id: string
  terminal_at: number | null
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
  readonly requestedByUserId: string
  readonly templateKey: CrawlerTaskTemplateKey
}

export type CrawlerTaskRunResult
  = | { readonly kind: 'created', readonly run: CrawlerTaskRun, readonly snapshot: CrawlerTaskSnapshot }
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
  readonly outcome: Readonly<Record<string, unknown>>
  readonly receipt?: CrawlerRunReceipt
  readonly runId: string
  readonly safeSummary?: string
  readonly sequence: number
}

export type ProcessCrawlerRunnerEventResult
  = | { readonly kind: 'accepted', readonly outcome: Readonly<Record<string, unknown>> }
    | { readonly kind: 'attempt_mismatch' }
    | { readonly kind: 'conflict' }
    | { readonly kind: 'duplicate', readonly outcome: Readonly<Record<string, unknown>> }
    | { readonly kind: 'not_found' }
    | { readonly kind: 'receipt_template_mismatch' }

interface CrawlerRunnerEventRow {
  body_sha256: string
  event_id: string
  nonce: string
  outcome: string
}

function asD1Client(db: CrawlerTaskDatabase): D1Client {
  return db.$client as unknown as D1Client
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
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

function toCrawlerRunState(row: CrawlerRunRow, templateKey: CrawlerTaskTemplateKey): CrawlerRunState {
  return {
    attemptNumber: row.attempt_number,
    lastEventSequence: row.last_event_sequence,
    stateVersion: row.state_version,
    status: row.status,
    templateKey,
  }
}

function transitionSequence(decision: Extract<CrawlerRunTransitionDecision, { kind: 'transition' }>): number {
  return decision.nextStateVersion
}

function staleAuditSequence(event: CrawlerRunTransitionEvent): number {
  return event.actor === 'runner' ? -(event.sequence + 1) : -1
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

export function createCrawlerTaskRepository(db: CrawlerTaskDatabase, options: CrawlerRepositoryOptions = {}) {
  const d1 = asD1Client(db)
  const now = options.now ?? (() => new Date())
  const createId = options.createId ?? (() => crypto.randomUUID())

  async function getRunRow(runId: string): Promise<CrawlerRunRow | undefined> {
    const result = await d1.prepare(`
      SELECT id, task_id, attempt_number, status, state_version, last_event_sequence,
        lease_expires_at, last_heartbeat_at, cancel_requested_at, failure_code,
        receipt_summary_json, terminal_at
      FROM crawler_run
      WHERE id = ?
    `).bind(runId).all<CrawlerRunRow>()
    return result.results?.[0]
  }

  async function getTemplateKey(runId: string): Promise<CrawlerTaskTemplateKey | undefined> {
    const result = await d1.prepare(`
      SELECT task.template_key
      FROM crawler_run AS run
      INNER JOIN crawler_task AS task ON task.id = run.task_id
      WHERE run.id = ?
    `).bind(runId).all<{ template_key: CrawlerTaskTemplateKey }>()
    return result.results?.[0]?.template_key
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

    const taskId = createId()
    const runId = createId()
    const snapshot = createCrawlerTaskSnapshot(input.templateKey)
    const leaseExpiresAt = addMillisecondsInSeconds(currentNow, CRAWLER_LEASE_DURATION_MS)

    try {
      await d1.batch([
        d1.prepare(`
          INSERT INTO crawler_task (
            id, template_key, template_version, requested_by_user_id, request_snapshot_json,
            idempotency_key, latest_run_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          taskId,
          snapshot.templateKey,
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

  async function applyTransition(
    runId: string,
    event: CrawlerRunTransitionEvent,
    options: { readonly receipt?: CrawlerRunReceipt, readonly safeSummary?: string } = {},
  ): Promise<CrawlerRunTransitionDecision> {
    const run = await getRunRow(runId)
    const templateKey = await getTemplateKey(runId)
    if (!run || !templateKey) {
      throw new Error(`Crawler run ${runId} was not found`)
    }

    const decision = decideCrawlerRunTransition(toCrawlerRunState(run, templateKey), event)
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
    const receipt = event.type === 'runner_succeeded' ? event.receipt : options.receipt

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
        decision.failureCode ?? null,
        receipt ? JSON.stringify({ contentIds: receipt.contentIds, templateKey: receipt.templateKey }) : run.receipt_summary_json,
        terminalAt,
        currentNow,
        runId,
        run.status,
        run.state_version,
        run.last_event_sequence,
      ),
      ...(isTerminal
        ? [d1.prepare('DELETE FROM crawler_template_lease WHERE template_key = ? AND run_id = ?').bind(templateKey, runId)]
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

  async function claimDispatch(runId: string): Promise<CrawlerRunTransitionDecision> {
    const run = await getRunRow(runId)
    if (!run) {
      throw new Error(`Crawler run ${runId} was not found`)
    }
    return applyTransition(runId, {
      actor: 'dispatcher',
      sequence: run.last_event_sequence + 1,
      type: 'dispatch_claim',
    })
  }

  async function renewLease(runId: string, sequence: number): Promise<CrawlerRunTransitionDecision> {
    return applyTransition(runId, { actor: 'runner', sequence, type: 'runner_heartbeat' })
  }

  async function retryRun(runId: string): Promise<CrawlerTaskRunResult> {
    const run = await getRunRow(runId)
    const templateKey = await getTemplateKey(runId)
    if (!run || !templateKey) {
      throw new Error(`Crawler run ${runId} was not found`)
    }

    const retry = createManualRetryAttempt({
      attemptNumber: run.attempt_number,
      snapshot: createCrawlerTaskSnapshot(templateKey),
      status: run.status,
    })
    const existing = await findActiveLease(templateKey, toUnixSeconds(now()))
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
        `).bind(templateKey, nextRunId, expiresAt, currentNow),
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
      const leaseOwner = await findActiveLease(templateKey, currentNow)
      if (leaseOwner) {
        return { kind: 'existing_active_run', run: leaseOwner }
      }
      throw new Error(`Could not retry crawler run: ${errorMessage(error)}`)
    }

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
    input: Pick<ProcessCrawlerRunnerEventInput, 'bodySha256' | 'eventId' | 'nonce'>,
  ): Extract<ProcessCrawlerRunnerEventResult, { kind: 'conflict' | 'duplicate' }> {
    if (existing.event_id !== input.eventId || existing.nonce !== input.nonce || existing.body_sha256 !== input.bodySha256) {
      return { kind: 'conflict' }
    }
    return { kind: 'duplicate', outcome: parseRunnerEventOutcome(existing.outcome) }
  }

  async function processRunnerEvent(input: ProcessCrawlerRunnerEventInput): Promise<ProcessCrawlerRunnerEventResult> {
    const run = await getRunRow(input.runId)
    const templateKey = await getTemplateKey(input.runId)
    if (!run || !templateKey) {
      return { kind: 'not_found' }
    }
    if (run.attempt_number !== input.attempt) {
      return { kind: 'attempt_mismatch' }
    }
    if (input.receipt && input.receipt.templateKey !== templateKey) {
      return { kind: 'receipt_template_mismatch' }
    }

    const existing = await findRunnerEvent(input.runId, input.eventId, input.nonce)
    if (existing) {
      return classifyExistingRunnerEvent(existing, input)
    }

    const recorded = await recordRunnerEvent({
      bodySha256: input.bodySha256,
      eventId: input.eventId,
      keyId: input.keyId,
      nonce: input.nonce,
      outcome: input.outcome,
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

    await applyTransition(input.runId, input.event, {
      receipt: input.receipt,
      safeSummary: input.safeSummary,
    })
    if (input.log) {
      await appendLog(input.log)
    }
    return { kind: 'accepted', outcome: input.outcome }
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
    getRun: async (runId: string) => {
      const run = await getRunRow(runId)
      return run ? toCrawlerTaskRun(run) : undefined
    },
    purgeExpiredRunLogs,
    processRunnerEvent,
    recordRunnerEvent,
    renewLease,
    retryRun,
    sweepExpiredRuns,
  }
}
