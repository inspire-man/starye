import type { QuantResearchEvidence, QuantResearchFactor } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { buildQuantFactorFreshness } from '../quant-factor-freshness'

function factor(key: QuantResearchFactor['key'], evidenceKeys: string[]): Pick<QuantResearchFactor, 'key' | 'evidenceKeys'> {
  return { key, evidenceKeys }
}

function evidence(key: string, observedAt: string | null): QuantResearchEvidence {
  return {
    key,
    dimension: 'trend',
    label: key,
    status: 'pass',
    value: 1,
    threshold: 'fixture',
    source: 'fixture source',
    observedAt,
    formulaVersion: 'fixture-v1',
    detail: 'fixture evidence',
  }
}

const evaluatedAt = new Date('2026-09-01T12:00:00.000Z')

describe('quant factor freshness client projection', () => {
  it('keeps the server freshness boundaries and factor-specific windows', () => {
    expect(buildQuantFactorFreshness(factor('trend', ['trend-sample']), [evidence('trend-sample', '20260828')], evaluatedAt)).toMatchObject({ status: 'aging', ageDays: 4, freshWithinDays: 3 })
    expect(buildQuantFactorFreshness(factor('quality', ['quality-roe']), [evidence('quality-roe', '20260801')], evaluatedAt)).toMatchObject({ status: 'fresh', ageDays: 31, freshWithinDays: 180 })
  })

  it('shows unknown when an evidence timestamp is missing or in the future', () => {
    expect(buildQuantFactorFreshness(factor('valuation', ['valuation-pe']), [evidence('valuation-pe', null)], evaluatedAt)).toMatchObject({ status: 'unknown', ageDays: null })
    expect(buildQuantFactorFreshness(factor('risk', ['risk-volume']), [evidence('risk-volume', '20260902')], evaluatedAt)).toMatchObject({ status: 'unknown', ageDays: null })
  })
})
