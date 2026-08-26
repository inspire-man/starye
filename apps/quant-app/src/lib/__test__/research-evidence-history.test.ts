import type { QuantResearchEvidence, QuantResearchReport } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildResearchEvidenceComparison } from '../research-evidence-history'

function evidence(key: string, status: QuantResearchEvidence['status'], value: number | null, source = 'fixture'): QuantResearchEvidence {
  return {
    key,
    dimension: 'quality',
    label: key,
    status,
    value,
    threshold: 'test',
    source,
    observedAt: '2026-08-26',
    formulaVersion: 'fixture-v1',
    detail: 'fixture',
  }
}

function report(evidenceItems: QuantResearchEvidence[]): QuantResearchReport {
  return {
    reportVersion: 'research-report-v2',
    tsCode: '601899.SH',
    name: '紫金矿业',
    generatedAt: '2026-08-26T00:00:00.000Z',
    sourceSnapshotId: null,
    status: 'partial',
    action: 'wait-confirmation',
    score: 50,
    headline: 'fixture',
    strengths: [],
    risks: [],
    gaps: [],
    nextActions: [],
    evidence: evidenceItems,
    sources: [],
  }
}

describe('research evidence history', () => {
  it('classifies state and numeric changes without treating missing as zero', () => {
    const previous = report([
      evidence('improved', 'fail', 10),
      evidence('weakened', 'pass', 10),
      evidence('restored', 'missing', null),
      evidence('missing', 'pass', 20),
      evidence('persistent', 'missing', 14),
      evidence('numeric', 'pass', 10),
      evidence('same', 'caution', 5),
      evidence('provenance', 'pass', 10),
    ])
    const current = report([
      evidence('improved', 'pass', 11),
      evidence('weakened', 'fail', 9),
      evidence('restored', 'pass', 2),
      evidence('missing', 'missing', 3),
      evidence('persistent', 'missing', 9),
      evidence('numeric', 'pass', 12),
      evidence('same', 'caution', 5),
      evidence('provenance', 'pass', 12, 'other-fixture'),
    ])

    const result = buildResearchEvidenceComparison(current, previous)
    const changes = new Map(result?.items.map(item => [item.key, item]))

    expect(changes.get('improved')).toMatchObject({ kind: 'improved', direction: 'up', valueDelta: 1 })
    expect(changes.get('weakened')).toMatchObject({ kind: 'weakened', direction: 'down', valueDelta: -1 })
    expect(changes.get('restored')).toMatchObject({ kind: 'restored', direction: 'none', valueDelta: null })
    expect(changes.get('missing')).toMatchObject({ kind: 'newly-missing', direction: 'none', valueDelta: null })
    expect(changes.get('persistent')).toMatchObject({ kind: 'persistent-missing', direction: 'none', valueDelta: null })
    expect(changes.get('numeric')).toMatchObject({ kind: 'changed', direction: 'up', valueDelta: 2 })
    expect(changes.get('provenance')).toMatchObject({ kind: 'incomparable', direction: 'none', valueDelta: null })
    expect(changes.has('same')).toBe(false)
    expect(result).toMatchObject({ changedCount: 7, improvedCount: 2, weakenedCount: 2, missingCount: 2 })
  })

  it('labels evidence added or removed between reports and bounds visible changes', () => {
    const previous = report(Array.from({ length: 12 }, (_, index) => evidence(`old-${index}`, 'pass', index)))
    const current = report([evidence('new-factor', 'pass', 1)])

    const result = buildResearchEvidenceComparison(current, previous, 3)

    expect(result?.items).toHaveLength(3)
    expect(result?.items[0]).toMatchObject({ kind: 'removed', key: 'old-0' })
    expect(result?.changedCount).toBe(13)
  })

  it('returns no comparison until two reports exist', () => {
    expect(buildResearchEvidenceComparison(report([]), null)).toBeNull()
  })
})
