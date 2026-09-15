import type { QuantResearchEvidence } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { buildResearchEvidenceGroups } from '../research-evidence-groups'

function evidence(key: string, dimension: string): QuantResearchEvidence {
  return {
    key,
    dimension,
    label: key,
    status: 'pass',
    value: 1,
    threshold: 'fixture',
    source: 'fixture',
    observedAt: null,
    formulaVersion: 'fixture-v1',
    detail: 'fixture',
  }
}

describe('buildResearchEvidenceGroups', () => {
  it('keeps required trend evidence separate from optional timing-history keys', () => {
    const groups = buildResearchEvidenceGroups([
      evidence('trend-ma20', 'trend'),
      evidence('timing-history-windows', 'trend'),
      evidence('timing-history-edge', 'trend'),
      evidence('timing-history-calibration', 'trend'),
      evidence('timing-history-walkforward', 'trend'),
      evidence('valuation-pe', 'valuation'),
    ])
    expect(groups.map(group => group.dimension)).toEqual(['trend', 'timing-history', 'valuation'])
    expect(groups[0]).toMatchObject({ label: '趋势与价格', items: [expect.objectContaining({ key: 'trend-ma20' })] })
    expect(groups[1]).toMatchObject({
      label: '时机历史',
      items: [
        expect.objectContaining({ key: 'timing-history-windows' }),
        expect.objectContaining({ key: 'timing-history-edge' }),
        expect.objectContaining({ key: 'timing-history-calibration' }),
        expect.objectContaining({ key: 'timing-history-walkforward' }),
      ],
    })
  })
})
