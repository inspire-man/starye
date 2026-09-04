import type { QuantFactorConfigurationKey, QuantFactorFreshness, QuantResearchEvidence, QuantResearchFactor } from './quant-view-models'

export const QUANT_FACTOR_FRESHNESS_VERSION = 'quant-factor-freshness-v1' as const

export const QUANT_FACTOR_FRESHNESS_WINDOWS: Readonly<Record<QuantFactorConfigurationKey, { readonly freshWithinDays: number, readonly agingWithinDays: number }>> = {
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
    const match = compact || dateOnly
    const year = Number(match![1])
    const month = Number(match![2])
    const day = Number(match![3])
    const timestamp = Date.UTC(year, month - 1, day)
    const parsed = new Date(timestamp)
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? timestamp : null
  }
  const timestamp = Date.parse(normalized)
  if (!Number.isFinite(timestamp))
    return null
  const parsed = new Date(timestamp)
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
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
    const invalidEvaluation = evaluationDay === null
      ? expectedKeys.filter(key => !unverifiableEvidenceKeys.includes(key))
      : []
    return {
      version: QUANT_FACTOR_FRESHNESS_VERSION,
      status: 'unknown',
      observedAt,
      ageDays: null,
      ...window,
      detail: unknownDetail(missingEvidenceKeys, [...new Set([...unverifiableEvidenceKeys, ...invalidEvaluation])]),
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
  const status = ageDays <= window.freshWithinDays ? 'fresh' : ageDays <= window.agingWithinDays ? 'aging' : 'stale'
  const elapsed = ageDays === 0 ? '今天观测' : `${ageDays} 天前观测`
  return {
    version: QUANT_FACTOR_FRESHNESS_VERSION,
    status,
    observedAt,
    ageDays,
    ...window,
    detail: status === 'fresh'
      ? `${elapsed}，处于 ${window.freshWithinDays} 天最新窗口`
      : status === 'aging'
        ? `${elapsed}，超过最新窗口，建议复核`
        : `${elapsed}，超过 ${window.agingWithinDays} 天复核窗口，先刷新数据`,
    missingEvidenceKeys,
    unverifiableEvidenceKeys,
  }
}
