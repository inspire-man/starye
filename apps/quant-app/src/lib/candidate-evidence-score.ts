import type { CandidateItem, QuantValueQualityDimension, QuantValueQualityItem, ValueQualityDimensionKey } from './quant-view-models'

export const CANDIDATE_EVIDENCE_SCORE_VERSION = 'candidate-evidence-v1' as const

export type CandidateEvidenceReadinessStatus = 'ready' | 'partial' | 'missing' | 'unavailable'

export interface CandidateEvidenceDimension {
  key: ValueQualityDimensionKey
  label: string
  status: CandidateEvidenceReadinessStatus
  coveredMetricCount: number
  totalMetricCount: number
  comparableMetricCount: number
  coveragePercent: number | null
  detail: string
}

export interface CandidateEvidenceScore {
  tsCode: string
  formulaVersion: typeof CANDIDATE_EVIDENCE_SCORE_VERSION
  status: CandidateEvidenceReadinessStatus
  score: number | null
  coveredMetricCount: number
  totalMetricCount: number
  completeDimensionCount: number
  partialDimensionCount: number
  missingDimensionCount: number
  dimensions: readonly CandidateEvidenceDimension[]
  missingReasons: readonly string[]
  summary: string
}

const DIMENSIONS: readonly { key: ValueQualityDimensionKey, label: string }[] = [
  { key: 'valuation', label: '估值' },
  { key: 'quality', label: '盈利质量' },
  { key: 'growth', label: '增长稳定性' },
  { key: 'resilience', label: '资产负债表韧性' },
  { key: 'trend', label: '趋势与风险' },
]

function hasFiniteValue(value: number | null): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

function roundPercent(value: number): number {
  return Math.round(value)
}

function emptyDimension(
  definition: { key: ValueQualityDimensionKey, label: string },
  status: CandidateEvidenceReadinessStatus,
  detail: string,
): CandidateEvidenceDimension {
  return {
    key: definition.key,
    label: definition.label,
    status,
    coveredMetricCount: 0,
    totalMetricCount: 0,
    comparableMetricCount: 0,
    coveragePercent: status === 'unavailable' ? null : 0,
    detail,
  }
}

function sourceDimension(item: QuantValueQualityItem, key: ValueQualityDimensionKey): QuantValueQualityDimension | undefined {
  return item.dimensions.find(dimension => dimension.key === key)
}

function buildDimension(
  candidate: CandidateItem,
  valueQuality: QuantValueQualityItem,
  definition: { key: ValueQualityDimensionKey, label: string },
): CandidateEvidenceDimension {
  const source = sourceDimension(valueQuality, definition.key)
  if (!source)
    return emptyDimension(definition, 'missing', '价值质量结果没有返回该维度')

  const metrics = source.metrics
  const trendPending = definition.key === 'trend' && candidate.pendingSync
  const coveredMetricCount = trendPending ? 0 : metrics.filter(metric => hasFiniteValue(metric.value)).length
  const comparableMetricCount = trendPending
    ? 0
    : metrics.filter(metric => hasFiniteValue(metric.value) && metric.sampleCount >= 2 && metric.favorablePercentile !== null).length
  const totalMetricCount = metrics.length
  const rawCoverageComplete = totalMetricCount > 0 && coveredMetricCount === totalMetricCount
  const status: CandidateEvidenceReadinessStatus = source.status === 'ready' && rawCoverageComplete && !trendPending
    ? 'ready'
    : coveredMetricCount > 0
      ? 'partial'
      : 'missing'

  const coveragePercent = totalMetricCount > 0 ? roundPercent(coveredMetricCount / totalMetricCount * 100) : 0
  let detail = `${coveredMetricCount} / ${totalMetricCount} 个原始字段已返回 · ${comparableMetricCount} 个可比`
  if (trendPending)
    detail = '日线尚未进入当前候选快照'
  else if (status === 'missing')
    detail = totalMetricCount > 0 ? `暂无可用原始字段 · 共 ${totalMetricCount} 个字段` : '该维度暂无可用字段'

  return {
    key: definition.key,
    label: definition.label,
    status,
    coveredMetricCount,
    totalMetricCount,
    comparableMetricCount,
    coveragePercent,
    detail,
  }
}

function unavailableResult(candidate: CandidateItem, status: CandidateEvidenceReadinessStatus, summary: string): CandidateEvidenceScore {
  return {
    tsCode: candidate.tsCode,
    formulaVersion: CANDIDATE_EVIDENCE_SCORE_VERSION,
    status,
    score: null,
    coveredMetricCount: 0,
    totalMetricCount: 0,
    completeDimensionCount: 0,
    partialDimensionCount: 0,
    missingDimensionCount: status === 'missing' ? DIMENSIONS.length : 0,
    dimensions: DIMENSIONS.map(definition => emptyDimension(definition, status, summary)),
    missingReasons: [summary],
    summary,
  }
}

export function buildCandidateEvidenceScore(candidate: CandidateItem, valueQuality: QuantValueQualityItem | null | undefined): CandidateEvidenceScore {
  if (valueQuality === undefined)
    return unavailableResult(candidate, 'unavailable', '价值质量结果尚未加载')
  if (valueQuality === null)
    return unavailableResult(candidate, 'missing', '当前股票没有可用价值质量结果')

  const dimensions = DIMENSIONS.map(definition => buildDimension(candidate, valueQuality, definition))
  const completeDimensionCount = dimensions.filter(dimension => dimension.status === 'ready').length
  const partialDimensionCount = dimensions.filter(dimension => dimension.status === 'partial').length
  const missingDimensionCount = dimensions.filter(dimension => dimension.status === 'missing').length
  const coveredMetricCount = dimensions.reduce((total, dimension) => total + dimension.coveredMetricCount, 0)
  const totalMetricCount = dimensions.reduce((total, dimension) => total + dimension.totalMetricCount, 0)
  const score = dimensions.length > 0
    ? roundPercent(dimensions.reduce((total, dimension) => total + (dimension.coveragePercent ?? 0), 0) / dimensions.length)
    : 0
  const status: CandidateEvidenceReadinessStatus = completeDimensionCount === DIMENSIONS.length
    && valueQuality.status === 'ready'
    && !candidate.pendingSync
    ? 'ready'
    : coveredMetricCount > 0
      ? 'partial'
      : 'missing'
  const missingReasons = [
    ...dimensions.filter(dimension => dimension.status !== 'ready').map(dimension => `${dimension.label}：${dimension.detail}`),
    ...valueQuality.missingFields,
  ].filter((reason, index, reasons) => reasons.indexOf(reason) === index).slice(0, 5)
  const summary = `${completeDimensionCount} / ${DIMENSIONS.length} 个维度完整 · ${partialDimensionCount} 个维度部分覆盖 · ${missingDimensionCount} 个维度待补`

  return {
    tsCode: candidate.tsCode,
    formulaVersion: CANDIDATE_EVIDENCE_SCORE_VERSION,
    status,
    score,
    coveredMetricCount,
    totalMetricCount,
    completeDimensionCount,
    partialDimensionCount,
    missingDimensionCount,
    dimensions,
    missingReasons,
    summary,
  }
}
