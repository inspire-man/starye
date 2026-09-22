import type { QuantDecisionRecord, WatchlistItem } from './quant-view-models'
import { buildDecisionOutcome } from './decision-outcome'

export interface QuantDecisionCalibrationSummary {
  readonly recordCount: number
  readonly trackedCount: number
  readonly observedCount: number
  readonly pendingCount: number
  readonly completedCount: number
  readonly unavailableCount: number
  readonly acceptedAiCount: number
  readonly unacceptedAiCount: number
  readonly alignedCount: number
  readonly opposedCount: number
  readonly flatCount: number
  readonly directionalSampleCount: number
  readonly averageChangePercent: number | null
}

export interface QuantDecisionCalibration {
  readonly summary: QuantDecisionCalibrationSummary
  readonly status: 'empty' | 'observed' | 'pending'
}

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

export function buildQuantDecisionCalibration(
  records: readonly QuantDecisionRecord[],
  watchlist: readonly Pick<WatchlistItem, 'tsCode' | 'latestClose' | 'latestTradeDate'>[],
): QuantDecisionCalibration {
  const byCode = new Map<string, QuantDecisionRecord[]>()
  for (const record of records)
    byCode.set(record.tsCode, [...(byCode.get(record.tsCode) || []), record])

  let trackedCount = 0
  let observedCount = 0
  let pendingCount = 0
  let completedCount = 0
  let unavailableCount = 0
  let alignedCount = 0
  let opposedCount = 0
  let flatCount = 0
  let totalChange = 0
  let changeCount = 0
  let acceptedAiCount = 0
  let unacceptedAiCount = 0

  for (const [tsCode, history] of byCode) {
    for (const record of history) {
      if (record.snapshot.aiDecisionReview?.accepted)
        acceptedAiCount++
      else if (record.snapshot.aiDecisionReview)
        unacceptedAiCount++
    }
    const latest = watchlist.find(item => item.tsCode === tsCode)
    const outcome = buildDecisionOutcome(history, latest
      ? {
          price: finitePositive(latest.latestClose),
          observedAt: latest.latestTradeDate,
        }
      : null)
    trackedCount += outcome.trackedCount
    observedCount += outcome.entries.length
    pendingCount += outcome.pendingCount
    completedCount += outcome.completedCount
    if (outcome.status === 'empty' && history.some(record => record.action === 'plan-buy' || record.action === 'holding'))
      unavailableCount++
    for (const entry of outcome.entries) {
      totalChange += entry.changePercent
      changeCount++
      if (entry.direction === 'up')
        alignedCount++
      else if (entry.direction === 'down')
        opposedCount++
      else
        flatCount++
    }
  }

  const directionalSampleCount = alignedCount + opposedCount
  return {
    status: observedCount ? 'observed' : pendingCount ? 'pending' : 'empty',
    summary: {
      recordCount: records.length,
      trackedCount,
      observedCount,
      pendingCount,
      completedCount,
      unavailableCount,
      acceptedAiCount,
      unacceptedAiCount,
      alignedCount,
      opposedCount,
      flatCount,
      directionalSampleCount,
      averageChangePercent: changeCount ? round(totalChange / changeCount) : null,
    },
  }
}
