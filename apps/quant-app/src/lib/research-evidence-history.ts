import type { QuantResearchEvidence, QuantResearchReport } from './quant-view-models'

export type ResearchEvidenceChangeKind = 'improved' | 'weakened' | 'restored' | 'newly-missing' | 'persistent-missing' | 'changed' | 'incomparable' | 'unchanged' | 'added' | 'removed'
export type ResearchEvidenceValueDirection = 'up' | 'down' | 'flat' | 'none'

export interface ResearchEvidenceChange {
  key: string
  label: string
  kind: ResearchEvidenceChangeKind
  kindLabel: string
  direction: ResearchEvidenceValueDirection
  previous: QuantResearchEvidence | null
  current: QuantResearchEvidence | null
  previousValue: number | null
  currentValue: number | null
  valueDelta: number | null
}

export interface ResearchEvidenceHistoryComparison {
  currentGeneratedAt: string
  previousGeneratedAt: string
  items: ResearchEvidenceChange[]
  totalEvidenceCount: number
  changedCount: number
  improvedCount: number
  weakenedCount: number
  missingCount: number
}

const STATUS_RANK: Record<QuantResearchEvidence['status'], number> = {
  missing: 0,
  fail: 1,
  caution: 2,
  pass: 3,
}

const CHANGE_PRIORITY: Record<ResearchEvidenceChangeKind, number> = {
  'newly-missing': 0,
  'weakened': 1,
  'removed': 2,
  'persistent-missing': 3,
  'restored': 4,
  'improved': 5,
  'added': 6,
  'changed': 7,
  'incomparable': 8,
  'unchanged': 9,
}

function finite(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function changeLabel(kind: ResearchEvidenceChangeKind, direction: ResearchEvidenceValueDirection): string {
  if (kind === 'improved')
    return '状态改善'
  if (kind === 'weakened')
    return '状态转弱'
  if (kind === 'restored')
    return '数据恢复'
  if (kind === 'newly-missing')
    return '转为缺失'
  if (kind === 'persistent-missing')
    return '持续缺失'
  if (kind === 'added')
    return '新增证据'
  if (kind === 'removed')
    return '本次未返回'
  if (kind === 'changed')
    return direction === 'up' ? '数值上升' : direction === 'down' ? '数值下降' : '数值变化'
  if (kind === 'incomparable')
    return '口径变化'
  return '无明显变化'
}

function compareEvidence(previous: QuantResearchEvidence | null, current: QuantResearchEvidence | null): ResearchEvidenceChange {
  const previousValue = previous?.status === 'missing' ? null : finite(previous?.value ?? null)
  const currentValue = current?.status === 'missing' ? null : finite(current?.value ?? null)
  const provenanceChanged = Boolean(previous && current && (previous.source !== current.source || previous.formulaVersion !== current.formulaVersion))
  const valueDelta = !provenanceChanged && previousValue !== null && currentValue !== null ? round(currentValue - previousValue) : null
  const direction: ResearchEvidenceValueDirection = valueDelta === null ? 'none' : valueDelta > 0 ? 'up' : valueDelta < 0 ? 'down' : 'flat'
  let kind: ResearchEvidenceChangeKind

  if (!previous && current)
    kind = 'added'
  else if (previous && !current)
    kind = 'removed'
  else if (previous?.status === 'missing' && current?.status === 'missing')
    kind = 'persistent-missing'
  else if (previous?.status === 'missing' && current?.status !== 'missing')
    kind = 'restored'
  else if (previous?.status !== 'missing' && current?.status === 'missing')
    kind = 'newly-missing'
  else if (previous && current && STATUS_RANK[current.status] > STATUS_RANK[previous.status])
    kind = 'improved'
  else if (previous && current && STATUS_RANK[current.status] < STATUS_RANK[previous.status])
    kind = 'weakened'
  else if (provenanceChanged)
    kind = 'incomparable'
  else if (valueDelta !== null && valueDelta !== 0)
    kind = 'changed'
  else
    kind = 'unchanged'

  return {
    key: current?.key || previous?.key || '',
    label: current?.label || previous?.label || '',
    kind,
    kindLabel: changeLabel(kind, direction),
    direction,
    previous,
    current,
    previousValue,
    currentValue,
    valueDelta,
  }
}

export function buildResearchEvidenceComparison(currentReport: QuantResearchReport | null, previousReport: QuantResearchReport | null, limit = 8): ResearchEvidenceHistoryComparison | null {
  if (!currentReport || !previousReport)
    return null

  const previousByKey = new Map(previousReport.evidence.map(item => [item.key, item]))
  const currentByKey = new Map(currentReport.evidence.map(item => [item.key, item]))
  const keys = [...new Set([...currentReport.evidence.map(item => item.key), ...previousReport.evidence.map(item => item.key)])]
  const changes = keys.map(key => compareEvidence(previousByKey.get(key) || null, currentByKey.get(key) || null))
  const visibleChanges = changes
    .filter(item => item.kind !== 'unchanged')
    .sort((left, right) => CHANGE_PRIORITY[left.kind] - CHANGE_PRIORITY[right.kind] || left.label.localeCompare(right.label))
    .slice(0, Math.max(1, Math.min(limit, 16)))

  return {
    currentGeneratedAt: currentReport.generatedAt,
    previousGeneratedAt: previousReport.generatedAt,
    items: visibleChanges,
    totalEvidenceCount: changes.length,
    changedCount: changes.filter(item => item.kind !== 'unchanged').length,
    improvedCount: changes.filter(item => item.kind === 'improved' || item.kind === 'restored' || item.kind === 'added').length,
    weakenedCount: changes.filter(item => item.kind === 'weakened' || item.kind === 'newly-missing' || item.kind === 'removed').length,
    missingCount: changes.filter(item => item.kind === 'newly-missing' || item.kind === 'persistent-missing').length,
  }
}
