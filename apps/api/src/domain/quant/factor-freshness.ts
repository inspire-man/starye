import type { QuantResearchFactor, QuantResearchFactorKey } from './decision-recommendation'
import type { QuantResearchEvidence } from './research-report'

export const QUANT_FACTOR_FRESHNESS_VERSION = 'quant-factor-freshness-v1' as const

export type QuantFactorFreshnessStatus = 'fresh' | 'aging' | 'stale' | 'unknown'

export interface QuantFactorFreshnessWindow {
  readonly freshWithinDays: number
  readonly agingWithinDays: number
}

export interface QuantFactorFreshness {
  readonly version: typeof QUANT_FACTOR_FRESHNESS_VERSION
  readonly status: QuantFactorFreshnessStatus
  readonly observedAt: string | null
  readonly ageDays: number | null
  readonly freshWithinDays: number
  readonly agingWithinDays: number
  readonly detail: string
  readonly missingEvidenceKeys: readonly string[]
  readonly unverifiableEvidenceKeys: readonly string[]
}

export const QUANT_FACTOR_FRESHNESS_WINDOWS: Readonly<Record<QuantResearchFactorKey, QuantFactorFreshnessWindow>> = {
  'trend': { freshWithinDays: 3, agingWithinDays: 10 },
  'valuation': { freshWithinDays: 14, agingWithinDays: 60 },
  'quality': { freshWithinDays: 180, agingWithinDays: 365 },
  'shareholder-return': { freshWithinDays: 30, agingWithinDays: 180 },
  'risk': { freshWithinDays: 3, agingWithinDays: 10 },
}

const DAY_MS = 24 * 60 * 60 * 1_000

function utcDay(value: string | Date | null | undefined): number | null {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime()))
      return null
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  }

  const normalized = value?.trim()
  if (!normalized)
    return null

  const compact = /^(\d{4})(\d{2})(\d{2})$/u.exec(normalized)
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/u.exec(normalized)
  if (compact || dateOnly) {
    const year = Number((compact || dateOnly)![1])
    const month = Number((compact || dateOnly)![2])
    const day = Number((compact || dateOnly)![3])
    const timestamp = Date.UTC(year, month - 1, day)
    const parsed = new Date(timestamp)
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
      ? timestamp
      : null
  }

  const timestamp = Date.parse(normalized)
  if (!Number.isFinite(timestamp))
    return null
  const parsed = new Date(timestamp)
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
}

function elapsedDetail(ageDays: number): string {
  return ageDays === 0 ? '今天观测' : `${ageDays} 天前观测`
}

function unknownDetail(missingEvidenceKeys: readonly string[], unverifiableEvidenceKeys: readonly string[]): string {
  const missing = missingEvidenceKeys.length ? `缺少 ${missingEvidenceKeys.join('、')}` : ''
  const unverifiable = unverifiableEvidenceKeys.length ? `时间不可核验：${unverifiableEvidenceKeys.join('、')}` : ''
  const detail = [missing, unverifiable].filter(Boolean).join('；')
  return detail ? `${detail}，暂不纳入 AI 因子复核` : '没有可核验的因子证据时间，暂不纳入 AI 因子复核'
}

export function buildQuantFactorFreshness(
  factor: Pick<QuantResearchFactor, 'key' | 'evidenceKeys'>,
  evidence: readonly QuantResearchEvidence[],
  evaluatedAt: Date = new Date(),
): QuantFactorFreshness {
  const window = QUANT_FACTOR_FRESHNESS_WINDOWS[factor.key]
  const evidenceByKey = new Map(evidence.map(item => [item.key, item] as const))
  const expectedKeys = [...new Set(factor.evidenceKeys)]
  const missingEvidenceKeys = expectedKeys.filter(key => !evidenceByKey.has(key))
  const unverifiableEvidenceKeys = expectedKeys.filter((key) => {
    const item = evidenceByKey.get(key)
    return item !== undefined && utcDay(item.observedAt) === null
  })
  const observations = expectedKeys.flatMap((key) => {
    const item = evidenceByKey.get(key)
    const day = utcDay(item?.observedAt)
    return item && day !== null ? [{ value: item.observedAt, day }] : []
  }).sort((left, right) => left.day - right.day)
  const observedAt = observations[0]?.value ?? null
  const evaluationDay = utcDay(evaluatedAt)

  if (missingEvidenceKeys.length || unverifiableEvidenceKeys.length || !observations.length || evaluationDay === null) {
    return {
      version: QUANT_FACTOR_FRESHNESS_VERSION,
      status: 'unknown',
      observedAt,
      ageDays: null,
      ...window,
      detail: unknownDetail(missingEvidenceKeys, evaluationDay === null
        ? [...new Set([...unverifiableEvidenceKeys, ...expectedKeys.filter(key => !unverifiableEvidenceKeys.includes(key))])]
        : unverifiableEvidenceKeys),
      missingEvidenceKeys,
      unverifiableEvidenceKeys,
    }
  }

  const ageDays = Math.floor((evaluationDay - observations[0]!.day) / DAY_MS)
  if (ageDays < 0) {
    return {
      version: QUANT_FACTOR_FRESHNESS_VERSION,
      status: 'unknown',
      observedAt,
      ageDays: null,
      ...window,
      detail: '证据观察时间晚于评估时间，暂不纳入 AI 因子复核',
      missingEvidenceKeys,
      unverifiableEvidenceKeys,
    }
  }

  const status: QuantFactorFreshnessStatus = ageDays <= window.freshWithinDays
    ? 'fresh'
    : ageDays <= window.agingWithinDays
      ? 'aging'
      : 'stale'
  const detail = status === 'fresh'
    ? `${elapsedDetail(ageDays)}，处于 ${window.freshWithinDays} 天最新窗口`
    : status === 'aging'
      ? `${elapsedDetail(ageDays)}，超过最新窗口，建议复核`
      : `${elapsedDetail(ageDays)}，超过 ${window.agingWithinDays} 天复核窗口，先刷新数据`
  return {
    version: QUANT_FACTOR_FRESHNESS_VERSION,
    status,
    observedAt,
    ageDays,
    ...window,
    detail,
    missingEvidenceKeys,
    unverifiableEvidenceKeys,
  }
}

export function isQuantFactorFreshForAi(freshness: QuantFactorFreshness): boolean {
  return freshness.status === 'fresh'
}
