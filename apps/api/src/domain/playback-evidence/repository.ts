import type { Database } from '@starye/db'
import type {
  PlaybackArtifactReference,
  PlaybackEvidenceRequest,
  PlaybackEvidenceSummary,
  PlaybackEvidenceTuple,
  PlaybackRejectionHistory,
} from './types'
import * as v from 'valibot'
import { PlaybackEvidenceSummarySchema } from '../../schemas/playback-evidence'
import { readCrawlerTaskSnapshot } from '../crawler-tasks/template-registry'
import { derivePlaybackProof } from '../movies/source-contract'
import { buildRedactedPlaybackEvidence, isSafePlaybackEvidence } from './redaction'

interface D1Statement {
  all: <T>() => Promise<{ results?: T[] }>
  bind: (...values: unknown[]) => D1Statement
  run: () => Promise<{ meta?: { changes?: number } }>
}

interface D1Client {
  prepare: (query: string) => D1Statement
}

type PlaybackEvidenceDatabase = Pick<Database, '$client'>

interface BindingRow {
  attempt_number: number
  content_source_revision: number | null
  content_source_status: string | null
  latest_run_id: string | null
  operation: string
  provider_conclusion: string | null
  provider_name: string | null
  provider_reconciliation_window_ends_at: number | null
  provider_run_id: string | null
  provider_status: string | null
  receipt_primary_content_id: string | null
  receipt_source_revision: number | null
  receipt_summary_json: string | null
  run_created_at: number
  run_id: string
  run_status: string
  source_revision: number | null
  task_id: string
  task_snapshot_json: string
}

interface SummaryRow {
  artifact_hash: string
  artifact_reference: string
  artifact_stem: string
  content_id: string
  evidence_hash: string
  evidence_identity: string
  run_id: string
  source_revision: number
  summary_json: string
}

interface RejectionRow {
  artifact_hash: string
  artifact_reference: string
  artifact_stem: string
  content_id: string
  evidence_hash: string
  evidence_identity: string
  observed_at: number
  outcome: PlaybackRejectionHistory['outcome']
  run_id: string
  source_revision: number
  task_id: string
  tuple_attempt_number: number
  tuple_provider: PlaybackEvidenceTuple['provider']
}

export interface PlaybackEvidenceRepositoryOptions {
  readonly createId?: () => string
  readonly now?: () => Date
}

export interface AcceptPlaybackEvidenceInput {
  readonly artifact: PlaybackArtifactReference
  readonly evidence: PlaybackEvidenceRequest
  readonly runId: string
  readonly taskId: string
}

export type PlaybackEvidenceAcceptance
  = | { readonly kind: 'accepted', readonly summary: PlaybackEvidenceSummary }
    | { readonly kind: 'duplicate', readonly summary: PlaybackEvidenceSummary }
    | { readonly artifact: PlaybackArtifactReference, readonly kind: 'conflict', readonly reason: string }
    | { readonly artifact: PlaybackArtifactReference, readonly kind: 'rejected', readonly outcome: PlaybackRejectionHistory['outcome'], readonly rejection: PlaybackRejectionHistory, readonly reason: string }
    | { readonly artifact: PlaybackArtifactReference, readonly kind: 'checkpoint', readonly reason: string }

export interface PlaybackEvidenceRunProjection {
  readonly rejections: readonly PlaybackRejectionHistory[]
  readonly runId: string
  readonly summary: PlaybackEvidenceSummary | null
}

export interface PlaybackEvidenceTaskProjection {
  readonly runs: readonly PlaybackEvidenceRunProjection[]
}

const nowSeconds = (now: Date): number => Math.floor(now.getTime() / 1000)

function asD1Client(db: PlaybackEvidenceDatabase): D1Client {
  return db.$client as unknown as D1Client
}

function tupleIdentity(tuple: PlaybackEvidenceTuple, contentId: string, sourceRevision: number): string {
  return [tuple.taskId, tuple.runId, tuple.attemptNumber, tuple.provider, contentId, sourceRevision].join('/')
}

function parseSummary(row: SummaryRow): PlaybackEvidenceSummary | null {
  try {
    const value = JSON.parse(row.summary_json) as unknown
    const parsed = v.safeParse(PlaybackEvidenceSummarySchema, value)
    if (!parsed.success || !isSafePlaybackEvidence(parsed.output))
      return null
    return buildRedactedPlaybackEvidence(parsed.output)
  }
  catch {
    return null
  }
}

function toRejection(row: RejectionRow): PlaybackRejectionHistory {
  return {
    contentId: row.content_id,
    observedAt: row.observed_at,
    outcome: row.outcome,
    sourceRevision: row.source_revision,
    tuple: {
      attemptNumber: row.tuple_attempt_number,
      provider: row.tuple_provider,
      runId: row.run_id,
      taskId: row.task_id,
    },
  }
}

function safeReceipt(value: string | null): Record<string, unknown> | null {
  if (!value)
    return null
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  }
  catch {
    return null
  }
}

function hasTerminalRepairReadback(row: BindingRow, contentId: string, sourceRevision: number): boolean {
  const receipt = safeReceipt(row.receipt_summary_json)
  if (!receipt || receipt.operation !== 'repair_players'
    || receipt.movieId !== contentId
    || receipt.sourceRevision !== sourceRevision
    || !Array.isArray(receipt.sourceSummary)
    || receipt.sourceSummary.length > 50) {
    return false
  }
  return receipt.sourceSummary.every((source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source))
      return false
    const value = source as Record<string, unknown>
    return typeof value.eligible === 'boolean'
      && (value.health === 'inactive' || value.health === 'unverified' || value.health === 'failed')
      && typeof value.observedAt === 'number'
      && Number.isSafeInteger(value.observedAt)
      && typeof value.reasonCode === 'string'
      && (value.sourceType === 'direct' || value.sourceType === 'magnet' || value.sourceType === 'TorrServer')
  })
}

function sourceRevisionChanged(row: BindingRow, evidence: PlaybackEvidenceRequest): boolean {
  return row.source_revision !== evidence.sourceRevision
    || row.receipt_source_revision !== evidence.sourceRevision
    || row.content_source_revision !== evidence.sourceRevision
}

function asSummary(input: AcceptPlaybackEvidenceInput): PlaybackEvidenceSummary {
  return {
    ...input.evidence,
    artifact: input.artifact,
    outcome: 'accepted',
  }
}

export async function createPlaybackArtifactReference(input: {
  readonly attemptNumber: number
  readonly evidence: PlaybackEvidenceRequest
  readonly runId: string
  readonly taskId: string
}): Promise<PlaybackArtifactReference> {
  const bytes = new TextEncoder().encode(JSON.stringify(input.evidence))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return {
    hash,
    reference: `phase24/${input.taskId}/${input.runId}/attempt-${input.attemptNumber}.json`,
    stem: `${input.taskId}_${input.runId}_attempt-${input.attemptNumber}`.slice(0, 192),
  }
}

export function createPlaybackEvidenceRepository(
  db: PlaybackEvidenceDatabase,
  options: PlaybackEvidenceRepositoryOptions = {},
) {
  const d1 = asD1Client(db)
  const now = options.now ?? (() => new Date())
  const createId = options.createId ?? (() => crypto.randomUUID())

  async function readBinding(taskId: string, runId: string, contentId: string): Promise<BindingRow | undefined> {
    const result = await d1.prepare(`
      SELECT task.id AS task_id, task.latest_run_id, task.operation,
        task.request_snapshot_json AS task_snapshot_json,
        run.id AS run_id, run.attempt_number, run.status AS run_status,
        run.created_at AS run_created_at,
        run.receipt_summary_json, run.receipt_primary_content_id,
        run.receipt_source_revision,
        provider.provider AS provider_name, provider.provider_status,
        provider.provider_conclusion, provider.provider_run_id,
        provider.reconciliation_window_ends_at AS provider_reconciliation_window_ends_at,
        state.source_revision, state.disposition AS content_source_status,
        state.source_revision AS content_source_revision
      FROM crawler_task AS task
      INNER JOIN crawler_run AS run ON run.task_id = task.id AND run.id = ?
      LEFT JOIN crawler_run_provider_association AS provider ON provider.run_id = run.id
      LEFT JOIN movie_source_state AS state ON state.movie_id = ?
      WHERE task.id = ?
      LIMIT 1
    `).bind(runId, contentId, taskId).all<BindingRow>()
    return result.results?.[0]
  }

  async function writeRejection(input: {
    readonly artifact: PlaybackArtifactReference
    readonly evidence: PlaybackEvidenceRequest
    readonly outcome: PlaybackRejectionHistory['outcome']
    readonly reason: string
    readonly taskId: string
    readonly runId: string
  }): Promise<PlaybackRejectionHistory> {
    const identity = tupleIdentity(input.evidence.tuple, input.evidence.contentId, input.evidence.sourceRevision)
    await d1.prepare(`
      INSERT INTO playback_evidence_rejection (
        id, task_id, run_id, attempt_number, provider, content_id, source_revision,
        evidence_identity, evidence_hash, artifact_reference, artifact_stem,
        artifact_hash, outcome, reason_code, observed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      createId(),
      input.taskId,
      input.runId,
      input.evidence.tuple.attemptNumber,
      input.evidence.tuple.provider,
      input.evidence.contentId,
      input.evidence.sourceRevision,
      identity,
      input.artifact.hash,
      input.artifact.reference,
      input.artifact.stem,
      input.artifact.hash,
      input.outcome,
      input.reason,
      input.evidence.observedAt,
      nowSeconds(now()),
    ).run()
    return {
      contentId: input.evidence.contentId,
      observedAt: input.evidence.observedAt,
      outcome: input.outcome,
      sourceRevision: input.evidence.sourceRevision,
      tuple: input.evidence.tuple,
    }
  }

  async function reject(input: {
    readonly artifact: PlaybackArtifactReference
    readonly evidence: PlaybackEvidenceRequest
    readonly outcome: PlaybackRejectionHistory['outcome']
    readonly reason: string
    readonly taskId: string
    readonly runId: string
  }): Promise<PlaybackEvidenceAcceptance> {
    try {
      const rejection = await writeRejection(input)
      return { kind: 'rejected', outcome: input.outcome, reason: input.reason, rejection, artifact: input.artifact }
    }
    catch {
      return { kind: 'checkpoint', reason: 'playback evidence rejection history write failed', artifact: input.artifact }
    }
  }

  async function readCurrent(taskId: string, runId: string, contentId: string, sourceRevision: number): Promise<PlaybackEvidenceSummary | null> {
    const result = await d1.prepare(`
      SELECT content_id, evidence_hash, evidence_identity, run_id, source_revision,
        summary_json, artifact_reference, artifact_stem, artifact_hash
      FROM playback_evidence_summary
      WHERE task_id = ? AND run_id = ? AND content_id = ? AND source_revision = ?
      LIMIT 1
    `).bind(taskId, runId, contentId, sourceRevision).all<SummaryRow>()
    const row = result.results?.[0]
    return row ? parseSummary(row) : null
  }

  async function readContentCurrent(contentId: string, sourceRevision: number): Promise<{ readonly hash: string, readonly summary: PlaybackEvidenceSummary | null } | null> {
    const result = await d1.prepare(`
      SELECT content_id, evidence_hash, evidence_identity, run_id, source_revision,
        summary_json, artifact_reference, artifact_stem, artifact_hash
      FROM playback_evidence_summary
      WHERE content_id = ? AND source_revision = ?
      LIMIT 1
    `).bind(contentId, sourceRevision).all<SummaryRow>()
    const row = result.results?.[0]
    return row ? { hash: row.evidence_hash, summary: parseSummary(row) } : null
  }

  async function accept(input: AcceptPlaybackEvidenceInput): Promise<PlaybackEvidenceAcceptance> {
    const candidate = asSummary(input)
    const identity = tupleIdentity(candidate.tuple, candidate.contentId, candidate.sourceRevision)
    const binding = await readBinding(input.taskId, input.runId, candidate.contentId)
    if (!binding) {
      return reject({ ...input, outcome: 'ignored', reason: 'task_run_binding_not_found' })
    }

    if (candidate.tuple.taskId !== input.taskId || candidate.tuple.runId !== input.runId
      || candidate.tuple.attemptNumber !== binding.attempt_number
      || binding.provider_name !== candidate.tuple.provider) {
      return reject({ ...input, outcome: 'ignored', reason: 'tuple_mismatch' })
    }
    if (binding.latest_run_id !== input.runId) {
      return reject({ ...input, outcome: 'late', reason: 'current_run_changed' })
    }
    if (sourceRevisionChanged(binding, candidate)) {
      return reject({ ...input, outcome: 'stale', reason: 'source_revision_changed' })
    }

    let snapshotOk = false
    try {
      const parsed = readCrawlerTaskSnapshot(JSON.parse(binding.task_snapshot_json), binding.operation as 'movie' | 'manga' | 'repair_players')
      snapshotOk = parsed.ok && parsed.operation === 'repair_players'
        && 'movieId' in parsed.snapshot
        && parsed.snapshot.movieId === candidate.contentId
        && parsed.snapshot.sourceRevision === candidate.sourceRevision
    }
    catch {
      snapshotOk = false
    }
    if (binding.operation !== 'repair_players' || !snapshotOk || binding.run_status !== 'succeeded') {
      return reject({ ...input, outcome: 'ignored', reason: 'terminal_repair_readback_invalid' })
    }
    if (binding.receipt_primary_content_id !== candidate.contentId
      || binding.receipt_source_revision !== candidate.sourceRevision
      || !hasTerminalRepairReadback(binding, candidate.contentId, candidate.sourceRevision)) {
      return reject({ ...input, outcome: 'ignored', reason: 'receipt_readback_mismatch' })
    }
    if (binding.provider_name !== 'github-actions'
      || binding.provider_conclusion !== 'success'
      || !binding.provider_run_id) {
      return reject({ ...input, outcome: 'ignored', reason: 'provider_terminal_not_successful' })
    }
    const windowEndsAt = binding.provider_reconciliation_window_ends_at
    if (candidate.observedAt < binding.run_created_at
      || (windowEndsAt !== null && candidate.observedAt > windowEndsAt)
      || candidate.observedAt > nowSeconds(now())) {
      return reject({ ...input, outcome: 'late', reason: 'evidence_window_closed' })
    }

    const parsed = v.safeParse(PlaybackEvidenceSummarySchema, candidate)
    if (!parsed.success || !isSafePlaybackEvidence(parsed.output)) {
      return reject({ ...input, outcome: 'ignored', reason: 'contract_rejected' })
    }
    const redacted = buildRedactedPlaybackEvidence(parsed.output)
    const proof = derivePlaybackProof(redacted, {
      attemptNumber: binding.attempt_number,
      contentId: candidate.contentId,
      provider: 'github-actions',
      runId: input.runId,
      sourceRevision: candidate.sourceRevision,
      taskId: input.taskId,
      windowEndsAt: windowEndsAt ?? undefined,
      windowStartedAt: binding.run_created_at,
    })
    if (proof.status !== 'playback_verified') {
      return reject({ ...input, outcome: 'ignored', reason: 'terminal playback gate did not pass' })
    }

    try {
      const result = await d1.prepare(`
        INSERT INTO playback_evidence_summary (
          id, task_id, run_id, attempt_number, provider, content_id, source_revision,
          evidence_identity, evidence_hash, playback_status, summary_json,
          artifact_reference, artifact_stem, artifact_hash, observed_at, created_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1
          FROM crawler_task AS task
          INNER JOIN crawler_run AS run ON run.id = ? AND run.task_id = task.id
          INNER JOIN crawler_run_provider_association AS provider ON provider.run_id = run.id
          INNER JOIN movie_source_state AS state ON state.movie_id = ?
          WHERE task.id = ? AND task.latest_run_id = run.id
            AND run.attempt_number = ? AND run.status = 'succeeded'
            AND provider.provider = 'github-actions'
            AND provider.provider_conclusion = 'success'
            AND run.receipt_primary_content_id = ?
            AND run.receipt_source_revision = ?
            AND state.source_revision = ? AND state.disposition = 'ready'
        )
      `).bind(
        createId(),
        input.taskId,
        input.runId,
        candidate.tuple.attemptNumber,
        candidate.tuple.provider,
        candidate.contentId,
        candidate.sourceRevision,
        identity,
        input.artifact.hash,
        'playback_verified',
        JSON.stringify(redacted),
        input.artifact.reference,
        input.artifact.stem,
        input.artifact.hash,
        candidate.observedAt,
        nowSeconds(now()),
        input.runId,
        candidate.contentId,
        input.taskId,
        candidate.tuple.attemptNumber,
        candidate.contentId,
        candidate.sourceRevision,
        candidate.sourceRevision,
      ).run()
      if ((result.meta?.changes ?? 0) === 1)
        return { kind: 'accepted', summary: redacted }
    }
    catch (error) {
      if (!/unique constraint failed.*playback_evidence_summary/iu.test(error instanceof Error ? error.message : String(error)))
        return { kind: 'checkpoint', reason: 'playback evidence summary write failed', artifact: input.artifact }
    }

    const exact = await readCurrent(input.taskId, input.runId, candidate.contentId, candidate.sourceRevision)
    if (exact) {
      if (exact.artifact.hash === input.artifact.hash) {
        const duplicate = await reject({ ...input, outcome: 'duplicate', reason: 'identical_evidence_replay' })
        return duplicate.kind === 'rejected'
          ? { kind: 'duplicate', summary: { ...exact, outcome: 'duplicate' } }
          : duplicate
      }
      const conflict = await reject({ ...input, outcome: 'conflict', reason: 'same_evidence_identity_hash_conflict' })
      return conflict.kind === 'rejected'
        ? { artifact: input.artifact, kind: 'conflict', reason: conflict.reason }
        : conflict
    }
    const current = await readContentCurrent(candidate.contentId, candidate.sourceRevision)
    if (current) {
      const conflict = await reject({ ...input, outcome: 'conflict', reason: 'content_revision_first_fact_exists' })
      return conflict.kind === 'rejected'
        ? { artifact: input.artifact, kind: 'conflict', reason: conflict.reason }
        : conflict
    }
    return reject({ ...input, outcome: 'stale', reason: 'server_cas_rejected' })
  }

  async function getTaskEvidence(taskId: string): Promise<PlaybackEvidenceTaskProjection> {
    const summaries = await d1.prepare(`
      SELECT content_id, evidence_hash, evidence_identity, run_id, source_revision,
        summary_json, artifact_reference, artifact_stem, artifact_hash
      FROM playback_evidence_summary
      WHERE task_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(taskId).all<SummaryRow>()
    const rejections = await d1.prepare(`
      SELECT task_id, run_id, attempt_number AS tuple_attempt_number,
        provider AS tuple_provider, content_id, source_revision,
        evidence_identity, evidence_hash, artifact_reference, artifact_stem,
        artifact_hash, outcome, observed_at
      FROM playback_evidence_rejection
      WHERE task_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(taskId).all<RejectionRow>()
    const byRun = new Map<string, { rejections: PlaybackRejectionHistory[], summary: PlaybackEvidenceSummary | null }>()
    for (const row of summaries.results ?? []) {
      const entry = byRun.get(row.run_id) ?? { rejections: [], summary: null }
      entry.summary ??= parseSummary(row)
      byRun.set(row.run_id, entry)
    }
    for (const row of rejections.results ?? []) {
      const entry = byRun.get(row.run_id) ?? { rejections: [], summary: null }
      entry.rejections.push(toRejection(row))
      byRun.set(row.run_id, entry)
    }
    return {
      runs: [...byRun.entries()].map(([runId, value]) => ({
        rejections: value.rejections,
        runId,
        summary: value.summary,
      })),
    }
  }

  return { accept, getTaskEvidence }
}
