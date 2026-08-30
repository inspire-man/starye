import type { QuantDecisionRecord, QuantDecisionRecordAction } from './quant-types'

export type DecisionOutcomeKind = 'sold' | 'recorded' | 'current'
export type DecisionOutcomeStatus = 'empty' | 'pending' | 'observed' | 'completed'

export interface DecisionOutcomeLatestObservation {
  readonly price: number | null
  readonly observedAt: string | null
}

export interface DecisionOutcomeEntry {
  readonly baselineId: string
  readonly baselineAction: Extract<QuantDecisionRecordAction, 'plan-buy' | 'holding'>
  readonly baselinePrice: number
  readonly baselineObservedAt: string
  readonly observationId: string | null
  readonly observationAction: QuantDecisionRecordAction | null
  readonly observationKind: DecisionOutcomeKind
  readonly observationPrice: number
  readonly observationObservedAt: string
  readonly changePercent: number
}

export interface DecisionOutcome {
  readonly status: DecisionOutcomeStatus
  readonly headline: string
  readonly entries: readonly DecisionOutcomeEntry[]
  readonly trackedCount: number
  readonly completedCount: number
  readonly pendingCount: number
}

interface DecisionEvent {
  readonly record: QuantDecisionRecord
  readonly price: number | null
  readonly observedAt: string
  readonly time: number | null
  readonly index: number
}

function positiveFinite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function comparableTime(value: string): number | null {
  const digits = value.replace(/\D/gu, '')
  if (digits.length >= 8) {
    const year = Number(digits.slice(0, 4))
    const month = Number(digits.slice(4, 6))
    const day = Number(digits.slice(6, 8))
    const hour = digits.length >= 10 ? Number(digits.slice(8, 10)) : 0
    const minute = digits.length >= 12 ? Number(digits.slice(10, 12)) : 0
    const second = digits.length >= 14 ? Number(digits.slice(12, 14)) : 0
    if (year >= 1970 && month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 23 && minute <= 59 && second <= 59)
      return Date.UTC(year, month - 1, day, hour, minute, second)
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function recordObservedAt(record: QuantDecisionRecord): string {
  return record.snapshot.currentPriceObservedAt || record.snapshot.generatedAt || record.updatedAt
}

function isTrackedAction(action: QuantDecisionRecordAction): action is Extract<QuantDecisionRecordAction, 'plan-buy' | 'holding'> {
  return action === 'plan-buy' || action === 'holding'
}

function priceChangePercent(baseline: number, observation: number): number {
  return Number(((observation / baseline - 1) * 100).toFixed(10))
}

function buildEvent(record: QuantDecisionRecord, index: number): DecisionEvent {
  const observedAt = recordObservedAt(record)
  return {
    record,
    price: positiveFinite(record.snapshot.currentPrice),
    observedAt,
    time: comparableTime(observedAt),
    index,
  }
}

function buildEntry(baseline: DecisionEvent, observation: DecisionEvent, kind: Exclude<DecisionOutcomeKind, 'current'>): DecisionOutcomeEntry | null {
  if (!isTrackedAction(baseline.record.action) || baseline.price === null || observation.price === null || baseline.time === null || observation.time === null || observation.time <= baseline.time)
    return null
  const changePercent = priceChangePercent(baseline.price, observation.price)
  if (!Number.isFinite(changePercent))
    return null
  return {
    baselineId: baseline.record.id,
    baselineAction: baseline.record.action,
    baselinePrice: baseline.price,
    baselineObservedAt: baseline.observedAt,
    observationId: observation.record.id,
    observationAction: observation.record.action,
    observationKind: kind,
    observationPrice: observation.price,
    observationObservedAt: observation.observedAt,
    changePercent,
  }
}

function buildCurrentEntry(baseline: DecisionEvent, latest: DecisionEvent): DecisionOutcomeEntry | null {
  if (!isTrackedAction(baseline.record.action) || baseline.price === null || latest.price === null || baseline.time === null || latest.time === null || latest.time <= baseline.time)
    return null
  const changePercent = priceChangePercent(baseline.price, latest.price)
  if (!Number.isFinite(changePercent))
    return null
  return {
    baselineId: baseline.record.id,
    baselineAction: baseline.record.action,
    baselinePrice: baseline.price,
    baselineObservedAt: baseline.observedAt,
    observationId: null,
    observationAction: null,
    observationKind: 'current',
    observationPrice: latest.price,
    observationObservedAt: latest.observedAt,
    changePercent,
  }
}

function outcomeHeadline(status: DecisionOutcomeStatus, entries: readonly DecisionOutcomeEntry[], pendingCount: number): string {
  if (status === 'empty')
    return '记录一次计划买入或已持有，再保存后续价格记录，才会形成可复核的价格观察。'
  if (status === 'pending')
    return `已有 ${pendingCount} 个有效起点，等待更晚的决策价格或日线后再比较。`
  if (status === 'completed')
    return `已形成 ${entries.length} 次价格观察，其中 ${entries.filter(entry => entry.observationKind === 'sold').length} 次与已卖出记录配对。`
  return `已形成 ${entries.length} 次后续价格观察，仍只表示记录之间的价格变化。`
}

export function buildDecisionOutcome(
  history: readonly QuantDecisionRecord[],
  latestObservation: DecisionOutcomeLatestObservation | null = null,
): DecisionOutcome {
  const events = history
    .map(buildEvent)
    .sort((left, right) => {
      if (left.time !== null && right.time !== null && left.time !== right.time)
        return left.time - right.time
      if (left.time !== null && right.time === null)
        return -1
      if (left.time === null && right.time !== null)
        return 1
      return left.index - right.index
    })
  const entries: DecisionOutcomeEntry[] = []
  let pending: DecisionEvent | null = null

  for (const event of events) {
    if (isTrackedAction(event.record.action)) {
      pending = event.price !== null && event.time !== null ? event : null
      continue
    }
    if (!pending)
      continue
    if (event.record.action === 'sold' && event.price === null) {
      pending = null
      continue
    }
    if (event.price === null || event.time === null || pending.time === null || event.time <= pending.time)
      continue
    const entry = buildEntry(pending, event, event.record.action === 'sold' ? 'sold' : 'recorded')
    if (entry)
      entries.push(entry)
    pending = null
  }

  const latestPrice = positiveFinite(latestObservation?.price)
  const latestObservedAt = latestObservation?.observedAt || null
  if (pending && latestPrice !== null && latestObservedAt) {
    const latestEvent: DecisionEvent = {
      record: pending.record,
      price: latestPrice,
      observedAt: latestObservedAt,
      time: comparableTime(latestObservedAt),
      index: Number.MAX_SAFE_INTEGER,
    }
    const currentEntry = buildCurrentEntry(pending, latestEvent)
    if (currentEntry) {
      entries.push(currentEntry)
      pending = null
    }
  }

  const pendingCount = pending ? 1 : 0
  const completedCount = entries.filter(entry => entry.observationKind === 'sold').length
  const status: DecisionOutcomeStatus = completedCount
    ? 'completed'
    : entries.length
      ? 'observed'
      : pendingCount
        ? 'pending'
        : 'empty'
  return {
    status,
    headline: outcomeHeadline(status, entries, pendingCount),
    entries,
    trackedCount: entries.length + pendingCount,
    completedCount,
    pendingCount,
  }
}
