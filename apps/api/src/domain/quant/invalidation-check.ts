import type { DailyBar } from './types'
import { calculateMomentumFactors } from './factor'

export const QUANT_INVALIDATION_CHANGES = ['triggered', 'recovered', 'unchanged', 'unavailable'] as const
export type QuantInvalidationChange = typeof QUANT_INVALIDATION_CHANGES[number]

export interface QuantInvalidationEvidence {
  readonly key: string
  readonly label: string
  readonly status: 'pass' | 'caution' | 'fail' | 'missing'
}

export interface QuantInvalidationCheck {
  readonly key: string
  readonly label: string
  readonly savedStatus: QuantInvalidationEvidence['status']
  readonly currentStatus: QuantInvalidationEvidence['status']
  readonly change: QuantInvalidationChange
}

export interface QuantInvalidationItem {
  readonly tsCode: string
  readonly name: string | null
  readonly triggeredCount: number
  readonly recoveredCount: number
  readonly unchangedCount: number
  readonly unavailableCount: number
  readonly uncheckedCount: number
  readonly label: string
  readonly checks: readonly QuantInvalidationCheck[]
}

const CHECKABLE_KEYS = ['trend-ma20', 'trend-return20', 'risk-volume', 'risk-streak'] as const
type CheckableKey = typeof CHECKABLE_KEYS[number]

const STATUS_RANK = { pass: 0, caution: 1, fail: 2, missing: 3 } as const

function isStatus(value: string): value is QuantInvalidationEvidence['status'] {
  return value === 'pass' || value === 'caution' || value === 'fail' || value === 'missing'
}

function statusFor(value: number | null, pass: (value: number) => boolean, caution?: (value: number) => boolean): QuantInvalidationEvidence['status'] {
  if (value === null)
    return 'missing'
  if (pass(value))
    return 'pass'
  return caution?.(value) ? 'caution' : 'fail'
}

function currentStatus(key: CheckableKey, bars: readonly DailyBar[]): QuantInvalidationEvidence['status'] {
  const factors = calculateMomentumFactors(bars)
  const latest = [...bars].sort((left, right) => left.tradeDate.localeCompare(right.tradeDate)).at(-1)
  if (key === 'trend-ma20') {
    if (factors.ma20 === null || !latest)
      return 'missing'
    return statusFor((latest.close / factors.ma20) - 1, value => value >= 0)
  }
  if (key === 'trend-return20')
    return statusFor(factors.return20, value => value >= 0)
  if (key === 'risk-volume')
    return statusFor(factors.volumeRatio, value => value < 2, value => value < 3)
  return statusFor(factors.consecutiveUpDays, value => value < 5, value => value < 7)
}

function changeFor(saved: QuantInvalidationEvidence['status'], current: QuantInvalidationEvidence['status']): QuantInvalidationChange {
  if (saved === 'missing' || current === 'missing')
    return 'unavailable'
  if (saved === current)
    return 'unchanged'
  return STATUS_RANK[current] > STATUS_RANK[saved] ? 'triggered' : 'recovered'
}

export function buildQuantInvalidationItem(input: {
  readonly tsCode: string
  readonly name: string | null
  readonly evidence: readonly QuantInvalidationEvidence[]
  readonly bars: readonly DailyBar[]
}): QuantInvalidationItem {
  const checks = input.evidence.flatMap((item): QuantInvalidationCheck[] => {
    if (!CHECKABLE_KEYS.includes(item.key as CheckableKey))
      return []
    const current = currentStatus(item.key as CheckableKey, input.bars)
    return [{
      key: item.key,
      label: item.label,
      savedStatus: item.status,
      currentStatus: current,
      change: changeFor(item.status, current),
    }]
  })
  const triggeredCount = checks.filter(item => item.change === 'triggered').length
  const recoveredCount = checks.filter(item => item.change === 'recovered').length
  const unchangedCount = checks.filter(item => item.change === 'unchanged').length
  const unavailableCount = checks.filter(item => item.change === 'unavailable').length
  const uncheckedCount = input.evidence.filter(item => !CHECKABLE_KEYS.includes(item.key as CheckableKey)).length
  const label = triggeredCount
    ? `${triggeredCount} 条日线证据转弱`
    : checks.length
      ? '可对照的日线证据未转弱'
      : '没有可对照的日线证据'
  return {
    tsCode: input.tsCode,
    name: input.name,
    triggeredCount,
    recoveredCount,
    unchangedCount,
    unavailableCount,
    uncheckedCount,
    label,
    checks,
  }
}

export function buildQuantInvalidationBoard(items: readonly QuantInvalidationItem[]): readonly QuantInvalidationItem[] {
  return [...items].sort((left, right) => right.triggeredCount - left.triggeredCount || left.tsCode.localeCompare(right.tsCode))
}

export function readQuantReportEvidence(reportJson: string): QuantInvalidationEvidence[] {
  try {
    const parsed: unknown = JSON.parse(reportJson)
    if (!parsed || typeof parsed !== 'object' || !('evidence' in parsed) || !Array.isArray(parsed.evidence))
      return []
    return parsed.evidence.flatMap((item): QuantInvalidationEvidence[] => {
      if (!item || typeof item !== 'object' || !('key' in item) || !('status' in item) || !('label' in item))
        return []
      if (typeof item.key !== 'string' || typeof item.label !== 'string' || typeof item.status !== 'string' || !isStatus(item.status))
        return []
      return [{ key: item.key, label: item.label, status: item.status }]
    })
  }
  catch {
    return []
  }
}
