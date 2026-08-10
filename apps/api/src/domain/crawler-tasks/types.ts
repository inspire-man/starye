import type { Resource } from '../../lib/permissions'
import type { SourceHealthProjection, SourceReadinessProjection } from '../movies/source-contract'

export const CRAWLER_HEARTBEAT_INTERVAL_MS = 60_000
export const CRAWLER_LEASE_DURATION_MS = 10 * 60_000
export const CRAWLER_RUN_LOG_RETENTION_MS = 90 * 24 * 60 * 60_000
export const CRAWLER_MAX_SAFE_LOG_BYTES = 4 * 1024
export const CRAWLER_MAX_NORMAL_LOG_ROWS = 500

export type CrawlerTaskTemplateKey = 'movie' | 'manga'
export const CRAWLER_TASK_OPERATION_VALUES = ['movie', 'manga', 'repair_players'] as const
export type CrawlerTaskOperation = typeof CRAWLER_TASK_OPERATION_VALUES[number]
export type RepairPlayersReason = 'no_source' | 'source_failed'
export type RepairPlayersTargetIntent = 'restore_playable_sources'
export const CRAWLER_RECEIPT_SCHEMA_VERSION = 2 as const
export type CrawlerPermissionResource = Extract<Resource, 'comic' | 'movie'>
export type ProviderName = 'github-actions'
export type ProviderRunStatus = 'completed' | 'in_progress' | 'pending' | 'queued' | 'requested' | 'waiting'
export type ProviderRunConclusion
  = | 'action_required'
    | 'cancelled'
    | 'failure'
    | 'neutral'
    | 'skipped'
    | 'stale'
    | 'startup_failure'
    | 'success'
    | 'timed_out'
export type CrawlerRunStatus
  = | 'queued'
    | 'dispatching'
    | 'running'
    | 'cancel_requested'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
export type CrawlerRunFailureCode
  = | 'runner_lost'
    | 'runner_failed'
    | 'cancelled_by_runner'
    | 'receipt_missing'
    | 'provider_contract_invalid'
    | 'provider_lost'
    | 'provider_failed'

export type CrawlerTaskRetryStatus = 'none' | 'retrying' | 'exhausted'
export const CRAWLER_TASK_LIFECYCLE_VALUES = ['active', 'archived', 'superseded'] as const
export type CrawlerTaskLifecycleStatus = typeof CRAWLER_TASK_LIFECYCLE_VALUES[number]
export const CRAWLER_MAX_RETRY_ATTEMPTS = 2 as const
export type CrawlerLeaseOutcome = 'pending' | 'active' | 'renewed' | 'released' | 'expired' | 'recovered'
export type CrawlerReconciliationWindowStatus = 'pending' | 'open' | 'closed' | 'expired'
export type CrawlerReconciliationOutcome
  = | 'pending'
    | 'observed'
    | 'failed'
    | 'lost'
    | 'late'
    | 'stale'
    | 'ignored'
    | 'duplicate'
    | 'conflict'
export type CrawlerBoundedOutcomeCode
  = | 'accepted'
    | 'contract_failure'
    | 'duplicate'
    | 'stale'
    | 'late'
    | 'ignored'
    | 'conflict'
    | 'receipt_failure'

export interface CrawlerTaskRetryProjection {
  readonly attemptNumber: number
  readonly automatic: boolean
  readonly failureCode?: CrawlerRunFailureCode
  readonly maxAttempts: typeof CRAWLER_MAX_RETRY_ATTEMPTS
  readonly status: CrawlerTaskRetryStatus
}

export interface CrawlerTaskLifecycleProjection {
  readonly changedAt: number
  readonly status: CrawlerTaskLifecycleStatus
  readonly version: number
  readonly supersededByTaskId?: string
}

export interface CrawlerLeaseProjection {
  readonly acquiredAt?: number
  readonly expiresAt?: number
  readonly lastHeartbeatAt?: number
  readonly outcome: CrawlerLeaseOutcome
  readonly recoveredAt?: number
}

export interface CrawlerReconciliationProjection {
  readonly observedAt?: number
  readonly outcome: CrawlerReconciliationOutcome
  readonly processedAt?: number
  readonly windowEndsAt?: number
  readonly windowStatus: CrawlerReconciliationWindowStatus
}

export interface CrawlerReceiptValidationProjection {
  readonly failureCode?: string
  readonly validatedAt?: number
  readonly status: 'pending' | 'validated' | 'failed'
}

export interface CrawlerAttemptOutcomeProjection {
  readonly code?: string
  readonly observedAt?: number
  readonly outcome: CrawlerBoundedOutcomeCode
}

export interface CrawlerTaskSnapshot {
  readonly entrypoint: 'movie-crawler' | 'manga-crawler'
  readonly permissionResource: CrawlerPermissionResource
  readonly templateKey: CrawlerTaskTemplateKey
  readonly templateVersion: 1
}

export interface RepairPlayersTaskSnapshot extends CrawlerTaskSnapshot {
  readonly movieId: string
  readonly operation: 'repair_players'
  readonly reason: RepairPlayersReason
  readonly sourceRevision: number
  readonly targetIntent: RepairPlayersTargetIntent
  readonly templateKey: 'movie'
}

export type CrawlerTaskSnapshotUnion = CrawlerTaskSnapshot | RepairPlayersTaskSnapshot

export interface CrawlerTaskTemplate {
  readonly entrypoint: CrawlerTaskSnapshot['entrypoint']
  readonly permissionResource: CrawlerPermissionResource
  readonly templateKey: CrawlerTaskTemplateKey
  readonly templateVersion: CrawlerTaskSnapshot['templateVersion']
}

/** Immutable, server-owned identity for a GitHub Actions crawler execution. */
export interface ProviderSnapshot {
  readonly crawlerEntrypoint: 'crawler-comic' | 'crawler-optimized'
  readonly environment: 'starye-org'
  readonly provider: ProviderName
  readonly ref: 'main'
  readonly repository: 'inspire-man/starye'
  readonly target: 'starye-org'
  readonly templateKey: CrawlerTaskTemplateKey
  readonly workflow: '.github/workflows/daily-manga-crawl.yml' | '.github/workflows/daily-movie-crawl.yml'
}

/** The only server-to-workflow dispatch envelope; caller-controlled provider fields are excluded. */
export interface ProviderDispatchInput {
  readonly attempt: number
  readonly runId: string
  readonly target: ProviderSnapshot['target']
  readonly template: ProviderSnapshot['templateKey']
}

/** Redacted provider state that is safe to expose in task/run read models and audit facts. */
export interface ProviderAssociationSummary {
  readonly environment?: 'starye-org'
  readonly providerRunUrl?: string
  readonly provider: ProviderName
  readonly providerConclusion?: ProviderRunConclusion
  readonly providerRunAttempt?: number
  readonly providerRunId?: string
  readonly providerStatus?: ProviderRunStatus
  readonly ref?: 'main'
  readonly repository?: 'inspire-man/starye'
  readonly sha?: string
  readonly workflow?: '.github/workflows/daily-manga-crawl.yml' | '.github/workflows/daily-movie-crawl.yml'
}

export interface CrawlerTaskCursor {
  readonly id: string
  readonly updatedAt: number
}

export interface CrawlerTaskListItem {
  readonly createdAt: number
  readonly id: string
  readonly latestRunId: string | null
  readonly templateKey: CrawlerTaskTemplateKey
  readonly updatedAt: number
  readonly lifecycle: CrawlerTaskLifecycleProjection
  readonly retry?: CrawlerTaskRetryProjection
}

export interface CrawlerTaskListPage {
  readonly nextCursor: string | null
  readonly tasks: readonly CrawlerTaskListItem[]
}

export interface CrawlerRunReadModel {
  readonly attemptNumber: number
  readonly cancelRequestedAt: number | null
  readonly createdAt: number
  readonly failureCode: CrawlerRunFailureCode | null
  readonly id: string
  readonly stateVersion: number
  readonly status: CrawlerRunStatus
  readonly taskId: string
  readonly terminalAt: number | null
  readonly updatedAt: number
  readonly provider: ProviderAssociationSummary | null
  readonly receipt: CrawlerReceiptUnion | null
  readonly lease?: CrawlerLeaseProjection | null
  readonly reconciliation?: CrawlerReconciliationProjection | null
  readonly receiptValidation?: CrawlerReceiptValidationProjection | null
  readonly outcome?: CrawlerAttemptOutcomeProjection | null
}

export interface CrawlerTaskDetailReadModel {
  readonly lifecycle: CrawlerTaskLifecycleProjection
  readonly task: CrawlerTaskListItem
  readonly runs: readonly CrawlerRunReadModel[]
  readonly retry?: CrawlerTaskRetryProjection
}

export interface CrawlerTaskAuditReadModel {
  readonly action: string
  readonly actor: { readonly email: string, readonly id: string }
  readonly createdAt: number
  readonly id: string
  readonly outcome: string
  readonly reason: string
  readonly runId?: string
  readonly attemptNumber?: number
  readonly target?: { readonly id: string, readonly kind: string }
  readonly snapshotFingerprint?: string
}

export interface CrawlerTaskAuditPage {
  readonly audits: readonly CrawlerTaskAuditReadModel[]
  readonly nextCursor: string | null
}

export interface CrawlerRunLogReadModel {
  readonly code: string
  readonly counts?: Readonly<Record<string, number>>
  readonly createdAt: number
  readonly level: 'debug' | 'info' | 'warn' | 'error'
  readonly safeMessage: string
  readonly sequence: number
}

export interface CrawlerRunLogPage {
  readonly logs: readonly CrawlerRunLogReadModel[]
  readonly nextCursor: number | null
}

export interface CrawlerRunState {
  readonly attemptNumber: number
  readonly lastEventSequence: number
  readonly stateVersion: number
  readonly status: CrawlerRunStatus
  readonly templateKey?: CrawlerTaskTemplateKey
}

export interface CrawlerRunReceiptCandidate {
  readonly contentIds: readonly string[]
  readonly createdCount?: number
  readonly templateKey: CrawlerTaskTemplateKey
  readonly updatedCount?: number
}

export interface ValidatedCrawlerRunReceipt {
  readonly createdCount: number
  readonly primaryContentId: string
  /** Optional while legacy receipt rows are read during the schema boundary rollout. */
  readonly receiptSchemaVersion?: typeof CRAWLER_RECEIPT_SCHEMA_VERSION
  readonly source?: SourceReadinessProjection
  readonly templateKey: CrawlerTaskTemplateKey
  readonly updatedCount: number
}

export interface RepairPlayersReceipt {
  readonly movieId: string
  readonly observedAt: number
  readonly operation: 'repair_players'
  readonly sourceRevision: number
  readonly sourceSummary: readonly SourceHealthProjection[]
}

export type CrawlerReceiptUnion = ValidatedCrawlerRunReceipt | RepairPlayersReceipt

/** Runner terminal candidate union; API validation turns it into CrawlerReceiptUnion. */
export type CrawlerRunReceipt = CrawlerRunReceiptCandidate | RepairPlayersReceipt

export type CrawlerRunTransitionEvent
  = | { readonly actor: 'admin', readonly type: 'admin_cancel' }
    | { readonly actor: 'dispatcher', readonly sequence: number, readonly type: 'dispatch_claim' }
    | { readonly actor: 'scheduler', readonly type: 'lease_expired' }
    | { readonly actor: 'scheduler', readonly type: 'provider_cancelled' }
    | { readonly actor: 'scheduler', readonly type: 'provider_failed' }
    | { readonly actor: 'scheduler', readonly type: 'provider_lost' }
    | { readonly actor: 'runner', readonly sequence: number, readonly type: 'runner_cancelled' }
    | { readonly actor: 'runner', readonly sequence: number, readonly type: 'runner_failed' }
    | { readonly actor: 'runner', readonly sequence: number, readonly type: 'runner_heartbeat' }
    | { readonly actor: 'runner', readonly sequence: number, readonly type: 'runner_log' }
    | { readonly actor: 'runner', readonly sequence: number, readonly type: 'runner_progress' }
    | { readonly actor: 'runner', readonly receipt: CrawlerRunReceipt, readonly sequence: number, readonly type: 'runner_succeeded' }

export type CrawlerRunTransitionDecision
  = | {
    readonly currentStatus: CrawlerRunStatus
    readonly failureCode?: CrawlerRunFailureCode
    readonly kind: 'transition'
    readonly nextEventSequence?: number
    readonly nextStateVersion: number
    readonly nextStatus: CrawlerRunStatus
    readonly reasonCode: string
    readonly releaseLease: boolean
  }
  | {
    readonly currentStatus: CrawlerRunStatus
    readonly kind: 'stale'
    readonly reasonCode: 'out_of_sequence_event' | 'stale_event'
    readonly sequence: number
  }
  | {
    readonly currentStatus: CrawlerRunStatus
    readonly kind: 'rejected'
    readonly reasonCode: 'invalid_receipt' | 'invalid_transition' | 'task_inactive' | 'terminal_state'
  }

export interface ActiveCrawlerLeaseOwner {
  readonly runId: string
  readonly status: CrawlerRunStatus
  readonly templateKey: CrawlerTaskTemplateKey
}

export type CrawlerTaskLifecycleEvent
  = | { readonly type: 'archive' }
    | { readonly supersededByTaskId: string, readonly type: 'supersede' }

export type CrawlerTaskLifecycleDecision
  = | {
    readonly current: CrawlerTaskLifecycleProjection
    readonly kind: 'transition'
    readonly next: CrawlerTaskLifecycleProjection
  }
  | {
    readonly current: CrawlerTaskLifecycleProjection
    readonly kind: 'idempotent'
  }
  | {
    readonly current: CrawlerTaskLifecycleProjection
    readonly kind: 'rejected'
    readonly reasonCode: 'already_archived' | 'already_superseded' | 'invalid_transition'
  }
