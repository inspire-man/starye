import type { QuantResearchEvidence } from './quant-view-models'

export interface ResearchEvidenceGroup {
  readonly dimension: string
  readonly label: string
  readonly items: QuantResearchEvidence[]
}

const TIMING_HISTORY_PREFIX = 'timing-history-'
const TIMING_HISTORY_DIMENSION = 'timing-history'

const DIMENSION_LABELS: Record<string, string> = {
  'trend': '趋势与价格',
  'timing-history': '时机历史',
  'valuation': '估值',
  'quality': '经营质量',
  'shareholder-return': '股东回报',
  'risk': '风险与波动',
}

const DIMENSION_ORDER = ['trend', 'timing-history', 'valuation', 'quality', 'shareholder-return', 'risk']

function evidenceDimension(item: QuantResearchEvidence): string {
  return item.key.startsWith(TIMING_HISTORY_PREFIX) ? TIMING_HISTORY_DIMENSION : item.dimension
}

export function buildResearchEvidenceGroups(evidence: readonly QuantResearchEvidence[]): ResearchEvidenceGroup[] {
  const groups = new Map<string, QuantResearchEvidence[]>()
  for (const item of evidence) {
    const dimension = evidenceDimension(item)
    groups.set(dimension, [...(groups.get(dimension) || []), item])
  }

  const orderedGroups = DIMENSION_ORDER.flatMap(dimension => groups.has(dimension)
    ? [{ dimension, label: DIMENSION_LABELS[dimension] || dimension, items: groups.get(dimension) || [] }]
    : [])
  const additionalGroups = [...groups.entries()]
    .filter(([dimension]) => !DIMENSION_ORDER.includes(dimension))
    .map(([dimension, items]) => ({ dimension, label: `其他证据 · ${dimension}`, items }))
  return [...orderedGroups, ...additionalGroups]
}
