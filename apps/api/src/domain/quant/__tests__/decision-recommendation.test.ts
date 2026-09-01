import type { QuantResearchEvidence } from '../research-report'
import type { DailyBar } from '../types'
import { describe, expect, it } from 'vitest'
import { buildQuantDecisionProjection } from '../decision-recommendation'
import { createQuantFactorConfiguration } from '../factor-configuration'

function bars(count: number): DailyBar[] {
  return Array.from({ length: count }, (_, index) => ({
    tsCode: '601899.SH',
    tradeDate: `2026${String(index + 1).padStart(4, '0')}`,
    open: 10 + index,
    high: 11 + index,
    low: 9 + index,
    close: 10 + index,
    preClose: index ? 9 + index : null,
    change: 1,
    pctChg: 10,
    volume: 1000,
    amount: 10000,
  }))
}

function evidence(key: string, status: QuantResearchEvidence['status'] = 'pass'): QuantResearchEvidence {
  return {
    key,
    dimension: key.startsWith('trend') ? 'trend' : key.startsWith('valuation') ? 'valuation' : key.startsWith('risk') ? 'risk' : key.startsWith('shareholder') ? 'shareholder-return' : 'quality',
    label: key,
    status,
    value: status === 'missing' ? null : 1,
    threshold: 'fixture',
    source: 'fixture',
    observedAt: '20260829',
    formulaVersion: 'fixture-v1',
    detail: status === 'fail' ? 'fixture failure' : status === 'missing' ? 'fixture missing' : 'fixture value',
  }
}

const completeEvidence = [
  'trend-sample',
  'trend-ma20',
  'trend-return20',
  'valuation-pe',
  'valuation-pb',
  'valuation-ps',
  'valuation-peg',
  'quality-revenue-growth',
  'quality-profit',
  'quality-adjusted-profit',
  'quality-roe',
  'quality-gross-margin',
  'quality-net-margin',
  'quality-cashflow',
  'quality-debt-asset',
  'quality-history',
  'shareholder-yield',
  'risk-volume',
  'risk-streak',
].map(key => evidence(key))

describe('quant decision recommendation', () => {
  it('exposes complete factor provenance and a bullish reference projection', () => {
    const result = buildQuantDecisionProjection({ evidence: completeEvidence, dailyBars: bars(80) })

    expect(result.factorModel).toMatchObject({
      modelVersion: 'research-factors-v1',
      totalWeight: 1,
      coverage: 100,
    })
    expect(result.factorModel.factors.reduce((total, factor) => total + factor.weight, 0)).toBe(1)
    expect(result.factorModel.factors.find(factor => factor.key === 'shareholder-return')).toMatchObject({
      weight: 0.15,
      sourceId: 'tushare-dividend',
      status: 'ready',
    })
    expect(result.decision).toMatchObject({
      decisionVersion: 'research-decision-v1',
      recommendation: 'bullish',
      label: '看多',
      coverage: 100,
      confidence: 100,
    })
    expect(result.decision.buyPriceRange).toMatchObject({
      formulaVersion: 'reference-price-v1',
      currency: 'CNY',
      evidenceKeys: ['trend-sample', 'trend-ma20'],
    })
    expect(result.decision.sellPriceRange?.low).toBeLessThanOrEqual(result.decision.sellPriceRange?.high ?? -1)
  })

  it('keeps missing dividend yield as watch with no fabricated prices', () => {
    const result = buildQuantDecisionProjection({
      evidence: completeEvidence.map(item => item.key === 'shareholder-yield' ? evidence(item.key, 'missing') : item),
      dailyBars: bars(80),
    })

    expect(result.factorModel.coverage).toBe(85)
    expect(result.factorModel.factors.find(factor => factor.key === 'shareholder-return')).toMatchObject({ status: 'missing', score: null })
    expect(result.decision).toMatchObject({ recommendation: 'watch', label: '观望', confidence: null })
    expect(result.decision.buyPriceRange).toBeNull()
    expect(result.decision.sellPriceRange).toBeNull()
    expect(result.decision.invalidationConditions).toContain('补齐股东回报因子：shareholder-yield')
  })

  it('lets a covered risk failure drive a bearish projection with traceable ranges', () => {
    const result = buildQuantDecisionProjection({
      evidence: completeEvidence.map(item => item.key === 'risk-volume' || item.key === 'risk-streak' ? evidence(item.key, 'fail') : item),
      dailyBars: bars(80),
    })

    expect(result.decision.recommendation).toBe('bearish')
    expect(result.decision.confidence).not.toBeNull()
    expect(result.decision.buyPriceRange).not.toBeNull()
    expect(result.decision.sellPriceRange).not.toBeNull()
    expect(result.decision.invalidationConditions).toEqual(expect.arrayContaining(['risk-volume：fixture failure', 'risk-streak：fixture failure']))
  })

  it('uses the configured weights for the score and recommendation', () => {
    const defaultResult = buildQuantDecisionProjection({
      evidence: completeEvidence.map(item => item.key.startsWith('valuation-') ? evidence(item.key, 'fail') : item),
      dailyBars: bars(80),
    })
    const valuationHeavy = createQuantFactorConfiguration({
      weights: { 'trend': 0.05, 'valuation': 0.8, 'quality': 0.05, 'shareholder-return': 0.05, 'risk': 0.05 },
      source: 'user',
    })
    const configuredResult = buildQuantDecisionProjection({
      evidence: completeEvidence.map(item => item.key.startsWith('valuation-') ? evidence(item.key, 'fail') : item),
      dailyBars: bars(80),
      factorConfiguration: valuationHeavy,
    })

    expect(defaultResult.factorModel.score).toBe(80)
    expect(configuredResult.factorModel).toMatchObject({ configuration: valuationHeavy, score: 20 })
    expect(defaultResult.decision.recommendation).toBe('bullish')
    expect(configuredResult.decision.recommendation).toBe('bearish')
  })

  it('does not let a zero-weight missing factor block a complete recommendation', () => {
    const configuration = createQuantFactorConfiguration({
      weights: { 'trend': 0.3, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.3, 'risk': 0 },
      source: 'user',
    })
    const result = buildQuantDecisionProjection({
      evidence: completeEvidence.map(item => item.key.startsWith('risk-') ? evidence(item.key, 'missing') : item),
      dailyBars: bars(80),
      factorConfiguration: configuration,
    })

    expect(result.factorModel.coverage).toBe(100)
    expect(result.factorModel.factors.find(factor => factor.key === 'risk')).toMatchObject({ weight: 0, status: 'missing', score: null })
    expect(result.decision).toMatchObject({ recommendation: 'bullish', confidence: 100 })
    expect(result.decision.invalidationConditions).not.toContain('补齐风险因子：risk-volume、risk-streak')
  })
})
