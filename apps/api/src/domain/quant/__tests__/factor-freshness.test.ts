import type { QuantResearchFactor } from '../decision-recommendation'
import type { QuantResearchEvidence } from '../research-report'
import { describe, expect, it } from 'vitest'
import { buildQuantFactorFreshness, isQuantFactorFreshForAi } from '../factor-freshness'

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

describe('quant factor freshness', () => {
  it('uses the oldest required evidence for short-cycle factors', () => {
    const result = buildQuantFactorFreshness(factor('trend', ['trend-sample', 'trend-ma20']), [
      evidence('trend-sample', '20260831'),
      evidence('trend-ma20', '20260828'),
    ], evaluatedAt)

    expect(result).toMatchObject({
      version: 'quant-factor-freshness-v1',
      status: 'aging',
      observedAt: '20260828',
      ageDays: 4,
      freshWithinDays: 3,
      agingWithinDays: 10,
    })
    expect(isQuantFactorFreshForAi(result)).toBe(false)
  })

  it('uses the factor-specific window so a recent quarterly-quality value is fresh', () => {
    const result = buildQuantFactorFreshness(factor('quality', ['quality-roe']), [evidence('quality-roe', '20260801')], evaluatedAt)

    expect(result).toMatchObject({ status: 'fresh', ageDays: 31, freshWithinDays: 180 })
  })

  it('marks missing and invalid evidence time as unknown without substituting report time', () => {
    const result = buildQuantFactorFreshness(factor('valuation', ['valuation-pe', 'valuation-pb']), [
      evidence('valuation-pe', '20260830'),
      evidence('valuation-pb', null),
    ], evaluatedAt)

    expect(result).toMatchObject({ status: 'unknown', observedAt: '20260830', ageDays: null, unverifiableEvidenceKeys: ['valuation-pb'] })
    expect(result.detail).toContain('暂不纳入 AI 因子复核')

    const missing = buildQuantFactorFreshness(factor('risk', ['risk-volume', 'risk-streak']), [evidence('risk-volume', '20260831')], evaluatedAt)
    expect(missing).toMatchObject({ status: 'unknown', missingEvidenceKeys: ['risk-streak'] })
  })

  it('marks future evidence as unknown', () => {
    const result = buildQuantFactorFreshness(factor('trend', ['trend-sample']), [evidence('trend-sample', '20260902')], evaluatedAt)

    expect(result).toMatchObject({ status: 'unknown', ageDays: null, observedAt: '20260902' })
    expect(result.detail).toContain('晚于评估时间')
  })

  it('keeps the aging and stale boundaries deterministic', () => {
    const aging = buildQuantFactorFreshness(factor('trend', ['trend-sample']), [evidence('trend-sample', '20260822')], evaluatedAt)
    const stale = buildQuantFactorFreshness(factor('trend', ['trend-sample']), [evidence('trend-sample', '20260821')], evaluatedAt)

    expect(aging).toMatchObject({ status: 'aging', ageDays: 10 })
    expect(stale).toMatchObject({ status: 'stale', ageDays: 11 })
  })
})
