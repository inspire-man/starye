import type {
  ActiveCrawlerLeaseOwner,
  CrawlerRunReceipt,
  CrawlerRunState,
  CrawlerRunStatus,
  CrawlerRunTransitionDecision,
  CrawlerRunTransitionEvent,
  CrawlerTaskSnapshot,
} from './types'

const terminalStatuses: readonly CrawlerRunStatus[] = ['succeeded', 'failed', 'cancelled']

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
  readonly snapshot: CrawlerTaskSnapshot
  readonly status: CrawlerRunStatus
}): { readonly attemptNumber: number, readonly snapshot: CrawlerTaskSnapshot, readonly status: 'queued' } {
  if (input.status !== 'failed' && input.status !== 'cancelled') {
    throw new Error('Only failed or cancelled runs may be retried')
  }

  return {
    attemptNumber: input.attemptNumber + 1,
    snapshot: input.snapshot,
    status: 'queued',
  }
}

function isRunnerEvent(event: CrawlerRunTransitionEvent): event is Extract<CrawlerRunTransitionEvent, { actor: 'runner' }> {
  return event.actor === 'runner'
}

function hasValidReceipt(state: CrawlerRunState, receipt: CrawlerRunReceipt): boolean {
  return receipt.contentIds.length > 0
    && receipt.contentIds.every(contentId => contentId.length > 0)
    && (!state.templateKey || state.templateKey === receipt.templateKey)
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
    readonly failureCode?: 'runner_lost' | 'runner_failed' | 'cancelled_by_runner'
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
  state: CrawlerRunState,
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
        ? transition(state, 'failed', 'runner_failed', { failureCode: 'runner_failed', sequence: event.sequence })
        : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
    case 'runner_cancelled':
      return state.status === 'dispatching' || state.status === 'running' || state.status === 'cancel_requested'
        ? transition(state, 'cancelled', 'runner_cancelled', { failureCode: 'cancelled_by_runner', sequence: event.sequence })
        : { currentStatus: state.status, kind: 'rejected', reasonCode: 'invalid_transition' }
  }
}
