import type { QuantResearchRun } from './quant-types'
import type { BatchResearchItemStatus, BatchResearchProgress } from './research-batch'

export interface BatchResearchFollowUpState {
  status: BatchResearchItemStatus | 'idle'
  run: QuantResearchRun | null
  error: unknown | null
}

export type BatchResearchItemAction = 'view' | 'retry'

export function getBatchResearchItemAction(state: BatchResearchFollowUpState): BatchResearchItemAction | null {
  if (state.status === 'success' && state.run)
    return 'view'
  if (state.status === 'error')
    return 'retry'
  return null
}

export function markBatchResearchItemPending(
  states: Readonly<Record<string, BatchResearchFollowUpState>>,
  tsCode: string,
): Record<string, BatchResearchFollowUpState> {
  const current = states[tsCode]
  if (!current || current.status === 'running' || current.status === 'pending')
    return { ...states }

  return {
    ...states,
    [tsCode]: {
      status: 'pending',
      run: null,
      error: null,
    },
  }
}

export function applyBatchResearchProgress(
  states: Readonly<Record<string, BatchResearchFollowUpState>>,
  progress: BatchResearchProgress,
): Record<string, BatchResearchFollowUpState> {
  const previous = states[progress.tsCode]
  if (!previous)
    return { ...states }

  return {
    ...states,
    [progress.tsCode]: {
      status: progress.status,
      run: progress.run || previous.run,
      error: progress.error ?? null,
    },
  }
}
