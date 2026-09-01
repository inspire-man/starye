import type { QuantFactorFreshness, QuantResearchEvidence, QuantResearchEvidenceStatus, QuantResearchFactor, QuantResearchReport } from './quant-types'
import { buildQuantFactorFreshness } from './quant-factor-freshness'

export const QUANT_FACTOR_DATA_HEALTH_VERSION = 'quant-factor-data-health-v1' as const

export type QuantFactorDataHealthStatus = 'ready' | 'partial' | 'missing' | 'unavailable'
export type QuantFactorSourceHealth = 'primary' | 'fallback' | 'unavailable' | 'unknown'

export interface QuantFactorDataHealthEvidence {
  readonly key: string
  readonly label: string
  readonly status: QuantResearchEvidenceStatus | 'unavailable'
  readonly source: string
  readonly observedAt: string | null
  readonly detail: string
}

export interface QuantFactorDataHealthItem {
  readonly factor: QuantResearchFactor['key']
  readonly label: string
  readonly weight: number
  readonly score: number | null
  readonly freshness: QuantFactorFreshness
  readonly status: QuantFactorDataHealthStatus
  readonly source: string
  readonly sourceHealth: QuantFactorSourceHealth
  readonly observedAt: string | null
  readonly evidenceCount: number
  readonly usableEvidenceCount: number
  readonly evidence: readonly QuantFactorDataHealthEvidence[]
  readonly missingEvidenceKeys: readonly string[]
  readonly failedEvidenceKeys: readonly string[]
  readonly nextAction: string
}

export interface QuantFactorDataHealth {
  readonly version: typeof QUANT_FACTOR_DATA_HEALTH_VERSION
  readonly status: QuantFactorDataHealthStatus
  readonly label: '字段完整' | '部分可用' | '待补数据' | '来源不可用'
  readonly sourceHealth: QuantFactorSourceHealth
  readonly totalWeight: number
  readonly readyWeight: number
  readonly coverage: number
  readonly items: readonly QuantFactorDataHealthItem[]
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function sourceHealth(value: string): QuantFactorSourceHealth {
  if (!value.trim())
    return 'unknown'
  if (/不可用|失败|error|unavailable/iu.test(value))
    return 'unavailable'
  if (/回退|fallback|quota|配额/iu.test(value))
    return 'fallback'
  return 'primary'
}

function evidenceSourceHealth(evidence: readonly QuantFactorDataHealthEvidence[]): QuantFactorSourceHealth {
  if (!evidence.length)
    return 'unknown'
  if (evidence.some(item => item.status === 'unavailable' || sourceHealth(item.source) === 'unavailable'))
    return 'unavailable'
  if (evidence.some(item => sourceHealth(item.source) === 'fallback'))
    return 'fallback'
  return 'primary'
}

function mergeSourceHealth(factorSourceHealth: QuantFactorSourceHealth, evidenceHealth: QuantFactorSourceHealth): QuantFactorSourceHealth {
  if (factorSourceHealth === 'unavailable' || evidenceHealth === 'unavailable')
    return 'unavailable'
  if (factorSourceHealth === 'fallback' || evidenceHealth === 'fallback')
    return 'fallback'
  if (factorSourceHealth === 'primary' || evidenceHealth === 'primary')
    return 'primary'
  return 'unknown'
}

function latestObservedAt(values: readonly (string | null | undefined)[]): string | null {
  const dates = values.filter((value): value is string => Boolean(value?.trim())).sort((left, right) => left.localeCompare(right))
  return dates.at(-1) ?? null
}

function statusLabel(status: QuantFactorDataHealthStatus): QuantFactorDataHealth['label'] {
  return status === 'ready' ? '字段完整' : status === 'partial' ? '部分可用' : status === 'missing' ? '待补数据' : '来源不可用'
}

function nextAction(
  status: QuantFactorDataHealthStatus,
  sourceHealthValue: QuantFactorSourceHealth,
  source: string,
  missingEvidenceKeys: readonly string[],
  failedEvidenceKeys: readonly string[],
): string {
  if (status === 'unavailable' || sourceHealthValue === 'unavailable')
    return `检查 ${source || '该来源'} 配置后重试`
  if (missingEvidenceKeys.length)
    return `补齐证据：${missingEvidenceKeys.join('、')}`
  if (failedEvidenceKeys.length)
    return `重试来源：${failedEvidenceKeys.join('、')}`
  if (sourceHealthValue === 'fallback')
    return '字段已读取，复核回退来源与观察时间'
  return '已具备原始证据，可进入因子复核'
}

function itemForFactor(factor: QuantResearchFactor, evidenceByKey: ReadonlyMap<string, QuantResearchEvidence>, evaluatedAt: Date): QuantFactorDataHealthItem {
  const evidence = factor.evidenceKeys.flatMap((key): QuantFactorDataHealthEvidence[] => {
    const item = evidenceByKey.get(key)
    if (!item)
      return []
    return [{
      key: item.key,
      label: item.label,
      status: item.status,
      source: item.source,
      observedAt: item.observedAt,
      detail: item.detail,
    }]
  })
  const evidenceKeys = new Set(factor.evidenceKeys)
  const missingEvidenceKeys = [...new Set([
    ...factor.missingEvidenceKeys,
    ...factor.evidenceKeys.filter(key => !evidenceByKey.has(key)),
    ...evidence.filter(item => item.status === 'missing').map(item => item.key),
  ])]
  const failedEvidenceKeys = [...new Set(evidence.filter(item => item.status === 'fail').map(item => item.key))]
  const freshness = buildQuantFactorFreshness(factor, [...evidenceByKey.values()], evaluatedAt)
  const usableEvidenceCount = evidence.filter(item => item.status === 'pass' || item.status === 'caution').length
  const factorSourceHealth = sourceHealth(factor.source)
  const sourceHealthValue = mergeSourceHealth(factorSourceHealth, evidenceSourceHealth(evidence))
  const status: QuantFactorDataHealthStatus = factor.status === 'unavailable' || sourceHealthValue === 'unavailable'
    ? 'unavailable'
    : !evidenceKeys.size || usableEvidenceCount === 0
        ? 'missing'
        : factor.status === 'ready' && missingEvidenceKeys.length === 0 && failedEvidenceKeys.length === 0
          ? 'ready'
          : 'partial'

  return {
    factor: factor.key,
    label: factor.label,
    weight: round(factor.weight),
    score: finite(factor.score),
    freshness,
    status,
    source: factor.source,
    sourceHealth: sourceHealthValue,
    observedAt: latestObservedAt(evidence.map(item => item.observedAt)),
    evidenceCount: evidence.length,
    usableEvidenceCount,
    evidence,
    missingEvidenceKeys,
    failedEvidenceKeys,
    nextAction: nextAction(status, sourceHealthValue, factor.source, missingEvidenceKeys, failedEvidenceKeys),
  }
}

function aggregateSourceHealth(items: readonly QuantFactorDataHealthItem[]): QuantFactorSourceHealth {
  const values = new Set(items.map(item => item.sourceHealth))
  if (values.has('unavailable'))
    return 'unavailable'
  if (values.has('fallback'))
    return 'fallback'
  if (values.has('primary'))
    return 'primary'
  return 'unknown'
}

export function buildQuantFactorDataHealth(report: QuantResearchReport, evaluatedAt: Date = new Date()): QuantFactorDataHealth {
  const factors = (report.factorModel?.factors ?? []).filter(factor => factor.weight > 0 && Number.isFinite(factor.weight))
  const evidenceByKey = new Map(report.evidence.map(item => [item.key, item]))
  const items = factors.map(factor => itemForFactor(factor, evidenceByKey, evaluatedAt))
  const totalWeight = items.reduce((total, item) => total + item.weight, 0)
  const readyWeight = items.reduce((total, item) => total + (item.status === 'ready' ? item.weight : 0), 0)
  const hasUnavailable = items.some(item => item.status === 'unavailable')
  const hasPartial = items.some(item => item.status === 'partial')
  const status: QuantFactorDataHealthStatus = !items.length
    ? 'missing'
    : hasUnavailable && readyWeight === 0 && !hasPartial
      ? 'unavailable'
      : readyWeight >= totalWeight
        ? 'ready'
        : readyWeight > 0 || items.some(item => item.status === 'partial')
          ? 'partial'
          : 'missing'
  return {
    version: QUANT_FACTOR_DATA_HEALTH_VERSION,
    status,
    label: statusLabel(status),
    sourceHealth: aggregateSourceHealth(items),
    totalWeight: round(totalWeight),
    readyWeight: round(readyWeight),
    coverage: totalWeight > 0 ? round(readyWeight / totalWeight * 100, 2) : 0,
    items,
  }
}
