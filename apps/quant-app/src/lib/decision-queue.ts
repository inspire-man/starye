import type { CandidateItem, QuantDecisionRecord, QuantDecisionRecordAction, QuantRecommendation, WatchlistItem } from './quant-view-models'

export type QuantDecisionQueueObservation = 'newer-price' | 'same-day' | 'missing-price' | 'outside-candidate'

export interface QuantDecisionQueueItem {
  record: QuantDecisionRecord
  tsCode: string
  name: string
  candidate: CandidateItem | null
  currentPrice: number | null
  currentTradeDate: string | null
  changePercent: number | null
  observation: QuantDecisionQueueObservation
  availableInWatchlist: boolean
}

export interface QuantDecisionQueueSummary {
  total: number
  watch: number
  planBuy: number
  holding: number
  sold: number
  active: number
}

export interface QuantDecisionQueue {
  items: QuantDecisionQueueItem[]
  summary: QuantDecisionQueueSummary
  totalRecords: number
}

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value)
    return null
  const digits = value.replace(/\D/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(digits) ? digits : value.slice(0, 10)
}

function timestamp(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function compareRecords(left: QuantDecisionRecord, right: QuantDecisionRecord): number {
  return timestamp(right.updatedAt) - timestamp(left.updatedAt) || right.id.localeCompare(left.id)
}

function actionSummary(records: readonly QuantDecisionRecord[]): QuantDecisionQueueSummary {
  const summary: QuantDecisionQueueSummary = { total: records.length, watch: 0, planBuy: 0, holding: 0, sold: 0, active: 0 }
  for (const record of records) {
    if (record.action === 'watch')
      summary.watch++
    else if (record.action === 'plan-buy')
      summary.planBuy++
    else if (record.action === 'holding')
      summary.holding++
    else
      summary.sold++
  }
  summary.active = summary.planBuy + summary.holding
  return summary
}

function latestByCode(records: readonly QuantDecisionRecord[]): QuantDecisionRecord[] {
  const sorted = [...records].sort(compareRecords)
  const latest = new Map<string, QuantDecisionRecord>()
  for (const record of sorted) {
    if (!latest.has(record.tsCode))
      latest.set(record.tsCode, record)
  }
  return [...latest.values()]
}

function recommendationLabel(value: QuantRecommendation | null): string {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : '观望'
}

export function quantDecisionQueueActionLabel(action: QuantDecisionRecordAction): string {
  return action === 'plan-buy' ? '计划买入' : action === 'holding' ? '已持有' : action === 'sold' ? '已卖出' : '继续观察'
}

export function quantDecisionQueueRecommendationLabel(recommendation: QuantRecommendation | null): string {
  return recommendationLabel(recommendation)
}

export function buildQuantDecisionQueue(input: {
  records: readonly QuantDecisionRecord[]
  candidates: readonly CandidateItem[]
  watchlist: readonly Pick<WatchlistItem, 'tsCode' | 'name' | 'latestClose' | 'latestTradeDate'>[]
  candidateTradeDate: string | null
  limit?: number
}): QuantDecisionQueue {
  const candidateByCode = new Map(input.candidates.map(candidate => [candidate.tsCode, candidate]))
  const watchlistByCode = new Map(input.watchlist.map(item => [item.tsCode, item]))
  const records = latestByCode(input.records)
  const items = records.map((record): QuantDecisionQueueItem => {
    const candidate = candidateByCode.get(record.tsCode) || null
    const watchlistItem = watchlistByCode.get(record.tsCode)
    const currentPrice = finitePositive(candidate?.close ?? watchlistItem?.latestClose)
    const currentTradeDate = candidate
      ? input.candidateTradeDate
      : watchlistItem?.latestTradeDate || null
    const availableInWatchlist = Boolean(watchlistItem || candidate)
    let observation: QuantDecisionQueueObservation = 'outside-candidate'
    let changePercent: number | null = null

    if (candidate) {
      const baselinePrice = finitePositive(record.snapshot.currentPrice)
      const baselineDate = normalizeDate(record.snapshot.currentPriceObservedAt)
      const currentDate = normalizeDate(currentTradeDate)
      if (baselinePrice === null || currentPrice === null || !baselineDate || !currentDate) {
        observation = 'missing-price'
      }
      else if (baselineDate === currentDate) {
        observation = 'same-day'
      }
      else {
        observation = 'newer-price'
        changePercent = ((currentPrice - baselinePrice) / baselinePrice) * 100
      }
    }

    return {
      record,
      tsCode: record.tsCode,
      name: candidate?.name || watchlistItem?.name || record.tsCode,
      candidate,
      currentPrice,
      currentTradeDate,
      changePercent,
      observation,
      availableInWatchlist,
    }
  })
  const boundedLimit = Math.max(1, Math.floor(input.limit ?? 6))
  return {
    items: items.slice(0, boundedLimit),
    summary: actionSummary(records),
    totalRecords: records.length,
  }
}
