import type {
  ActiveCrawlerLeaseOwner,
  CrawlerRunFailureCode,
  CrawlerRunState,
  CrawlerRunStatus,
  CrawlerRunTransitionDecision,
  CrawlerRunTransitionEvent,
  CrawlerTaskLifecycleDecision,
  CrawlerTaskLifecycleEvent,
  CrawlerTaskLifecycleProjection,
  CrawlerTaskOperation,
  CrawlerTaskSnapshotUnion,
} from './types'
import { CRAWLER_MAX_RETRY_ATTEMPTS } from './types'

export type CrawlerAutomaticRetryTiming = 'immediate' | 'windowed'

const lifecycleReasonCodes = {
  archive: 'task_archived',
  supersede: 'task_superseded',
} as const

interface RepairReceiptLike {
  readonly movieId: string
  readonly observedAt: number
  readonly operation: 'repair_players'
  readonly sourceRevision: number
  readonly sourceSummary: readonly unknown[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const terminalStatuses: readonly CrawlerRunStatus[] = ['succeeded', 'failed', 'cancelled']

const immediateRetryReasons = new Set([
  'dispatch_transport_failed',
  'github_provider_network_error',
  'github_provider_request_timeout',
  'github_provider_unavailable',
  'provider_dispatch_timeout',
  'provider_transport_failed',
])

const windowedRetryFailureCodes = new Set<CrawlerRunFailureCode>([
  'provider_lost',
  'runner_lost',
])

export function classifyCrawlerAutomaticRetry(input: {
  readonly failureCode?: CrawlerRunFailureCode
  readonly reason?: string
}): CrawlerAutomaticRetryTiming | undefined {
  if (input.failureCode && windowedRetryFailureCodes.has(input.failureCode))
    return 'windowed'
  if (input.reason && immediateRetryReasons.has(input.reason))
    return 'immediate'
  return undefined
}

export function isTerminalCrawlerRunStatus(status: CrawlerRunStatus): boolean {
  return terminalStatuses.includes(status)
}

export function isActiveCrawlerRunStatus(status: CrawlerRunStatus): boolean {
  return !isTerminalCrawlerRunStatus(status)
}

export function resolveActiveCrawlerCreate(
  leaseOwner: ActiveCrawlerLeaseOwner | undefined,
): { readonly kind: 'create_new_run' } | { readonly kind: 'existing_active_run', readonly runId: string } {
  if (leaseOwner && isActiveCrawlerRunStatus(leaseOwner.status)) {
    return { kind: 'existing_active_run', runId: leaseOwner.runId }
  }

  return { kind: 'create_new_run' }
}

export function createManualRetryAttempt(input: {
  readonly attemptNumber: number
  readonly snapshot: CrawlerTaskSnapshotUnion
  readonly status: CrawlerRunStatus
}): { readonly attemptNumber: number, readonly snapshot: CrawlerTaskSnapshotUnion, readonly status: 'queued' } {
  if (input.status !== 'failed' && input.status !== 'cancelled') {
    throw new Error('Only failed or cancelled runs may be retried')
  }
  if (input.attemptNumber >= CRAWLER_MAX_RETRY_ATTEMPTS) {
    throw new Error('Crawler retry limit exhausted')
  }

  return {
    attemptNumber: input.attemptNumber + 1,
    snapshot: input.snapshot,
    status: 'queued',
  }
}

export function createActiveCrawlerTaskLifecycle(now: number): CrawlerTaskLifecycleProjection {
  return { changedAt: now, status: 'active', version: 0 }
}

export function decideCrawlerTaskLifecycle(
  current: CrawlerTaskLifecycleProjection,
  event: CrawlerTaskLifecycleEvent,
): CrawlerTaskLifecycleDecision {
  if (event.type === 'archive' && current.status === 'archived')
    return { current, kind: 'idempotent' }
  if (event.type === 'supersede' && current.status === 'superseded')
    return { current, kind: 'idempotent' }
  if (current.status !== 'active') {
    return {
      current,
      kind: 'rejected',
      reasonCode: current.status === 'archived' ? 'already_archived' : 'already_superseded',
    }
  }

  return {
    current,
    kind: 'transition',
    next: {
      changedAt: current.changedAt,
      status: event.type === 'archive' ? 'archived' : 'superseded',
      version: current.version + 1,
      ...(event.type === 'supersede' ? { supersededByTaskId: event.supersededByTaskId } : {}),
    },
  }
}

export function crawlerTaskLifecycleReason(event: CrawlerTaskLifecycleEvent): string {
  return lifecycleReasonCodes[event.type]
}

function isRunnerEvent(event: CrawlerRunTransitionEvent): event is Extract<CrawlerRunTransitionEvent, { actor: 'runner' }> {
  return event.actor === 'runner'
}

function isRepairReceipt(receipt: unknown): receipt is RepairReceiptLike {
  return isRecord(receipt)
    && receipt.operation === 'repair_players'
    && typeof receipt.movieId === 'string'
    && Number.isSafeInteger(receipt.observedAt)
    && Number.isSafeInteger(receipt.sourceRevision)
    && Array.isArray(receipt.sourceSummary)
    && receipt.sourceSummary.length > 0
}

function hasValidReceipt(state: CrawlerRunState & { readonly operation?: CrawlerTaskOperation }, receipt: unknown): boolean {
  if (state.operation === 'repair_players') {
    return isRepairReceipt(receipt)
  }

  if (!isRecord(receipt) || !('contentIds' in receipt) || !('templateKey' in receipt))
    return false
  const contentIds = receipt.contentIds
  const templateKey = receipt.templateKey
  return Array.isArray(contentIds)
    && contentIds.length > 0
    && contentIds.every(contentId => typeof contentId === 'string' && contentId.length > 0)
    && (templateKey === 'movie' || templateKey === 'manga')
    && (!state.templateKey || state.templateKey === templateKey)
}

function staleDecision(
  state: CrawlerRunState,
  event: Extract<CrawlerRunTransitionEvent, { actor: 'runner' }>,
): CrawlerRunTransitionDecision {
  return {
    currentStatus: state.status,
    kind: 'stale',
    reasonCode: event.sequence <= state.lastEventSequence ? 'stale_event' : 'out_of_sequence_event',
    sequence: event.sequence,
  }
}

function transition(
  state: CrawlerRunState,
  nextStatus: CrawlerRunStatus,
  reasonCode: string,
  options: {
    readonly failureCode?: CrawlerRunFailureCode
    readonly sequence?: number
  } = {},
): CrawlerRunTransitionDecision {
  return {
    currentStatus: state.status,
    failureCode: options.failureCode,
    kind: 'transition',
    nextEventSequence: options.sequence,
    nextStateVersion: state.stateVersion + 1,
    nextStatus,
    reasonCode,
    releaseLease: isTerminalCrawlerRunStatus(nextStatus),
  }
}

export function decideCrawlerRunTransition(
  state: CrawlerRunState & { readonly operation?: CrawlerTaskOperation },
  event: CrawlerRunTransitionEvent,
): CrawlerRunTransitionDecision {
  if (isTerminalCrawlerRunStatus(state.status)) {
    return { currentStatus: state.status, kind: 'rejected', reasonCode: 'terminal_state' }
  }

  if (isRunnerEvent(event) && event.sequence !== state.lastEventSequence + 1) {
    return staleDecision(state, event)
  }

  switch (event.type) {
    case 'dispatch_claim':
      return state.status === 'queued'
        ? transition(state, 'dispatching', 'dispatch_claimed', { sequence: event.sequence })
        : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
    case 'admin_cancel':
      if (state.status === 'queued') {
        return transition(state, 'cancelled', 'cancelled_before_dispatch')
      }

      return state.status === 'dispatching' || state.status === 'running'
        ? transition(state, 'cancel_requested', 'cancel_requested')
        : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
    case 'lease_expired':
      return transition(state, 'failed', 'runner_lost', { failureCode: 'runner_lost' })
    case 'provider_lost':
      return transition(state, 'failed', 'provider_lost', { failureCode: 'provider_lost' })
    case 'provider_failed':
      return transition(state, 'failed', 'provider_failed', { failureCode: 'provider_failed' })
    case 'provider_cancelled':
      return state.status === 'dispatching' || state.status === 'running' || state.status === 'cancel_requested'
        ? transition(state, 'cancelled', 'provider_cancelled', { failureCode: 'cancelled_by_runner' })
        : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
    case 'runner_heartbeat':
      if (state.status === 'dispatching') {
        return transition(state, 'running', 'runner_heartbeat', { sequence: event.sequence })
      }

      return state.status === 'running' || state.status === 'cancel_requested'
        ? transition(state, state.status, 'runner_heartbeat', { sequence: event.sequence })
        : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
    case 'runner_progress':
    case 'runner_log':
      return state.status === 'running' || state.status === 'cancel_requested'
        ? transition(state, state.status, event.type, { sequence: event.sequence })
        : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
    case 'runner_succeeded':
      if (!hasValidReceipt(state, event.receipt)) {
        return { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_receipt' }
      }

      return state.status === 'dispatching' || state.status === 'running' || state.status === 'cancel_requested'
        ? transition(state, 'succeeded', state.status === 'cancel_requested' ? 'cancel_not_effective' : 'runner_succeeded', { sequence: event.sequence })
        : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
    case 'runner_failed':
      return state.status === 'dispatching' || state.status === 'running' || state.status === 'cancel_requested'
        ? transition(state, 'failed', 'runner_failed', { failureCode: event.failureCode ?? 'runner_failed', sequence: event.sequence })
        : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
    case 'runner_cancelled':
      return state.status === 'dispatching' || state.status === 'running' || state.status === 'cancel_requested'
        ? transition(state, 'cancelled', 'runner_cancelled', { failureCode: 'cancelled_by_runner', sequence: event.sequence })
        : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
  }
}
