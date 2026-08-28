import type { QuantResearchSummary } from './quant-types'
import { MAX_BATCH_RESEARCH_CONCURRENCY, MAX_BATCH_RESEARCH_ITEMS } from './research-batch'

export const MAX_BATCH_AI_SUMMARY_ITEMS = MAX_BATCH_RESEARCH_ITEMS
export const MAX_BATCH_AI_SUMMARY_CONCURRENCY = MAX_BATCH_RESEARCH_CONCURRENCY

export type BatchAiSummaryItemStatus = 'pending' | 'running' | 'success' | 'error'

export interface BatchAiSummaryCandidate {
  tsCode: string
  runId: string
}

export interface BatchAiSummaryProgress {
  tsCode: string
  runId: string
  status: BatchAiSummaryItemStatus
  summary?: QuantResearchSummary
  error?: unknown
}

export interface BatchAiSummaryResult {
  tsCode: string
  runId: string
  status: 'success' | 'error'
  summary?: QuantResearchSummary
  error?: unknown
}

export interface BatchAiSummaryState {
  status: BatchAiSummaryItemStatus | 'idle'
  summary: QuantResearchSummary | null
  error: unknown | null
}

export type BatchAiSummaryRunner = (candidate: BatchAiSummaryCandidate) => Promise<QuantResearchSummary>

export function idleBatchAiSummaryState(): BatchAiSummaryState {
  return { status: 'idle', summary: null, error: null }
}

function normalizeCandidates(candidates: readonly BatchAiSummaryCandidate[]): BatchAiSummaryCandidate[] {
  const seen = new Set<string>()
  return candidates.flatMap((candidate) => {
    const tsCode = candidate.tsCode.trim()
    const runId = candidate.runId.trim()
    if (!tsCode || !runId || seen.has(tsCode))
      return []
    seen.add(tsCode)
    return [{ tsCode, runId }]
  }).slice(0, MAX_BATCH_AI_SUMMARY_ITEMS)
}

export async function runResearchAiSummaryBatch(
  candidates: readonly BatchAiSummaryCandidate[],
  runner: BatchAiSummaryRunner,
  onProgress: (progress: BatchAiSummaryProgress) => void = () => {},
  concurrency = MAX_BATCH_AI_SUMMARY_CONCURRENCY,
): Promise<BatchAiSummaryResult[]> {
  const items = normalizeCandidates(candidates)
  if (!items.length)
    return []

  for (const candidate of items)
    onProgress({ ...candidate, status: 'pending' })

  const results: Array<BatchAiSummaryResult | undefined> = Array.from({ length: items.length })
  let nextIndex = 0
  const requestedConcurrency = Number.isFinite(concurrency) ? Math.floor(concurrency) : 1
  const workerCount = Math.min(
    MAX_BATCH_AI_SUMMARY_CONCURRENCY,
    items.length,
    Math.max(1, requestedConcurrency),
  )

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++
      const candidate = items[index]
      if (!candidate)
        return

      onProgress({ ...candidate, status: 'running' })
      try {
        const summary = await runner(candidate)
        results[index] = { ...candidate, status: 'success', summary }
        onProgress({ ...candidate, status: 'success', summary })
      }
      catch (error) {
        results[index] = { ...candidate, status: 'error', error }
        onProgress({ ...candidate, status: 'error', error })
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results.filter((result): result is BatchAiSummaryResult => Boolean(result))
}

export function applyBatchAiSummaryProgress(
  states: Readonly<Record<string, BatchAiSummaryState>>,
  progress: BatchAiSummaryProgress,
): Record<string, BatchAiSummaryState> {
  const previous = states[progress.tsCode]
  if (!previous)
    return { ...states }

  return {
    ...states,
    [progress.tsCode]: {
      status: progress.status,
      summary: progress.summary ?? previous.summary,
      error: progress.error ?? null,
    },
  }
}

export function markBatchAiSummaryItemPending(
  states: Readonly<Record<string, BatchAiSummaryState>>,
  tsCode: string,
): Record<string, BatchAiSummaryState> {
  const current = states[tsCode]
  if (!current || current.status === 'pending' || current.status === 'running')
    return { ...states }

  return {
    ...states,
    [tsCode]: {
      status: 'pending',
      summary: null,
      error: null,
    },
  }
}
