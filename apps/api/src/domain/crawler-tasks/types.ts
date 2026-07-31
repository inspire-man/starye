import type { Resource } from '../../lib/permissions'

export const CRAWLER_HEARTBEAT_INTERVAL_MS = 60_000
export const CRAWLER_LEASE_DURATION_MS = 10 * 60_000
export const CRAWLER_RUN_LOG_RETENTION_MS = 90 * 24 * 60 * 60_000
export const CRAWLER_MAX_SAFE_LOG_BYTES = 4 * 1024
export const CRAWLER_MAX_NORMAL_LOG_ROWS = 500

export type CrawlerTaskTemplateKey = 'movie' | 'manga'
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
export type CrawlerRunFailureCode = 'runner_lost' | 'runner_failed' | 'cancelled_by_runner' | 'receipt_missing'

export interface CrawlerTaskSnapshot {
  readonly entrypoint: 'movie-crawler' | 'manga-crawler'
  readonly permissionResource: CrawlerPermissionResource
  readonly templateKey: CrawlerTaskTemplateKey
  readonly templateVersion: 1
}

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
  readonly provider: ProviderName
  readonly providerConclusion?: ProviderRunConclusion
  readonly providerRunAttempt?: number
  readonly providerRunId?: string
  readonly providerStatus?: ProviderRunStatus
  readonly sha?: string
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

/** Backwards-compatible candidate name used by the state machine/event envelope. */
export type CrawlerRunReceipt = CrawlerRunReceiptCandidate

export interface ValidatedCrawlerRunReceipt {
  readonly createdCount: number
  readonly primaryContentId: string
  readonly templateKey: CrawlerTaskTemplateKey
  readonly updatedCount: number
}

export type CrawlerRunTransitionEvent
  = | { readonly actor: 'admin', readonly type: 'admin_cancel' }
    | { readonly actor: 'dispatcher', readonly sequence: number, readonly type: 'dispatch_claim' }
    | { readonly actor: 'scheduler', readonly type: 'lease_expired' }
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
    readonly reasonCode: 'invalid_receipt' | 'invalid_transition' | 'terminal_state'
  }

export interface ActiveCrawlerLeaseOwner {
  readonly runId: string
  readonly status: CrawlerRunStatus
  readonly templateKey: CrawlerTaskTemplateKey
}
