import type { QuantResearchRun } from './quant-types'

export const MAX_BATCH_RESEARCH_ITEMS = 3
export const MAX_BATCH_RESEARCH_CONCURRENCY = 2

export type BatchResearchItemStatus = 'pending' | 'running' | 'success' | 'error'

export interface BatchResearchProgress {
  tsCode: string
  status: BatchResearchItemStatus
  run?: QuantResearchRun
  error?: unknown
}

export interface BatchResearchResult {
  tsCode: string
  status: 'success' | 'error'
  run?: QuantResearchRun
  error?: unknown
}

export type ResearchBatchRunner = (tsCode: string) => Promise<QuantResearchRun>

export async function runResearchBatch(
  tsCodes: readonly string[],
  runner: ResearchBatchRunner,
  onProgress: (progress: BatchResearchProgress) => void = () => {},
  concurrency = MAX_BATCH_RESEARCH_CONCURRENCY,
): Promise<BatchResearchResult[]> {
  const candidates = [...new Set(tsCodes)].slice(0, MAX_BATCH_RESEARCH_ITEMS)
  if (!candidates.length)
    return []

  for (const tsCode of candidates)
    onProgress({ tsCode, status: 'pending' })

  const results: Array<BatchResearchResult | undefined> = Array.from({ length: candidates.length })
  let nextIndex = 0
  const requestedConcurrency = Number.isFinite(concurrency) ? Math.floor(concurrency) : 1
  const workerCount = Math.min(
    MAX_BATCH_RESEARCH_CONCURRENCY,
    candidates.length,
    Math.max(1, requestedConcurrency),
  )

  async function worker() {
    while (true) {
      const index = nextIndex++
      const tsCode = candidates[index]
      if (!tsCode)
        return

      onProgress({ tsCode, status: 'running' })
      try {
        const run = await runner(tsCode)
        results[index] = { tsCode, status: 'success', run }
        onProgress({ tsCode, status: 'success', run })
      }
      catch (error) {
        results[index] = { tsCode, status: 'error', error }
        onProgress({ tsCode, status: 'error', error })
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results.filter((result): result is BatchResearchResult => Boolean(result))
}
