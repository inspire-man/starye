import type { QuantResearchRun } from './quant-view-models'
import type { BatchResearchFollowUpState } from './research-batch-follow-up'

export type ResearchBatchStateSource = 'batch' | 'history'

export interface ResearchBatchHistoryHydrationInput {
  existing: BatchResearchFollowUpState | undefined
  source: ResearchBatchStateSource | undefined
  run: QuantResearchRun | null
  error?: unknown | null
}

export interface ResearchBatchHistoryHydrationResult {
  state: BatchResearchFollowUpState
  source: ResearchBatchStateSource | undefined
  error: unknown | null
}

const idleState: BatchResearchFollowUpState = {
  status: 'idle',
  run: null,
  error: null,
}

export function hydrateResearchBatchState(input: ResearchBatchHistoryHydrationInput): ResearchBatchHistoryHydrationResult {
  const existing = input.existing || idleState
  const historyError = input.error ?? null

  if (historyError)
    return { state: existing, source: input.source, error: historyError }

  if (input.source === 'batch' && existing.status !== 'idle')
    return { state: existing, source: input.source, error: null }

  if (input.run) {
    return {
      state: {
        status: 'success',
        run: input.run,
        error: null,
      },
      source: 'history',
      error: null,
    }
  }

  return {
    state: idleState,
    source: undefined,
    error: null,
  }
}
