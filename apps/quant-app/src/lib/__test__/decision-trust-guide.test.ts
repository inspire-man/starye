import type { QuantResearchReport } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { buildQuantDecisionGuide } from '../decision-trust-guide'

function report(overrides: Partial<QuantResearchReport> = {}): QuantResearchReport {
  return {
    reportVersion: 'research-report-v2',
    tsCode: '601899.SH',
    name: '紫金矿业',
    generatedAt: '2026-08-30T00:00:00.000Z',
    sourceSnapshotId: 'snapshot-1',
    status: 'ready',
    action: 'research-window',
    score: 100,
    headline: '看多：因子覆盖度 100%',
    strengths: [],
    risks: [],
    gaps: [],
    nextActions: [],
    evidence: [{
      key: 'trend-sample',
      dimension: 'trend',
      label: '日线样本',
      status: 'pass',
      value: 125,
      threshold: '至少 60 根',
      source: '本地 Quant 日线库',
      observedAt: '20260828',
      formulaVersion: 'momentum-v1',
      detail: '样本完整',
    }],
    sources: [{
      id: 'local-daily-bars',
      name: '本地 Quant 日线库',
      observedAt: '20260828',
      formulaVersion: 'momentum-v1',
    }],
    factorModel: {
      modelVersion: 'research-factors-v1',
      totalWeight: 1,
      coveredWeight: 1,
      coverage: 100,
      score: 100,
      factors: [{
        key: 'trend',
        label: '趋势',
        weight: 1,
        sourceId: 'local-daily-bars',
        source: '本地 Quant 日线库',
        status: 'ready',
        score: 100,
        evidenceKeys: ['trend-sample'],
        missingEvidenceKeys: [],
      }],
    },
    decision: {
      decisionVersion: 'research-decision-v1',
      recommendation: 'bullish',
      label: '看多',
      deterministicScore: 100,
      confidence: 100,
      coverage: 100,
      buyPriceRange: {
        low: 33.12,
        high: 34.47,
        currency: 'CNY',
        formulaVersion: 'reference-price-v1',
        source: '本地 Quant 日线库',
        observedAt: '20260828',
        evidenceKeys: ['trend-sample'],
      },
      sellPriceRange: null,
      evidenceKeys: ['trend-sample'],
      invalidationConditions: ['趋势转弱时重新评估'],
      headline: '看多：因子覆盖度 100%',
    },
    ...overrides,
  }
}

describe('buildQuantDecisionGuide', () => {
  it('flags a bullish report above its reference range and exposes trust checks', () => {
    const result = buildQuantDecisionGuide({
      report: report({ sources: [{ id: 'dividend', name: 'Eastmoney 实施分红，回退链：tushare -> eastmoney', observedAt: '20260830', formulaVersion: 'shareholder-return-v1' }] }),
      recommendation: 'bullish',
      aiReview: null,
      currentPrice: 34.65,
      currentPriceObservedAt: '20260828',
    })

    expect(result.priceStatus).toBe('above')
    expect(result.priceLabel).toContain('高于参考买入区间')
    expect(result.trustStatus).toBe('review')
    expect(result.trustLabel).toBe('可参考，但需核对')
    expect(result.checks).toEqual(expect.arrayContaining([
      '数据时效：最近交易日 2026-08-28，使用收盘价而非实时行情',
      expect.stringContaining('含回退链'),
      expect.stringContaining('AI：AI 尚未复核'),
    ]))
  })

  it('marks an accepted AI review and in-range price as a complete chain', () => {
    const result = buildQuantDecisionGuide({
      report: report(),
      recommendation: 'bullish',
      aiReview: {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bullish',
        confidence: 86,
        accepted: true,
        rejectionReason: null,
        factorReviewCoverage: 100,
        rationale: '证据一致。',
        invalidationConditions: [],
        citedEvidenceKeys: ['trend-sample'],
      },
      currentPrice: 34,
      currentPriceObservedAt: '20260828',
    })

    expect(result.priceStatus).toBe('within')
    expect(result.trustStatus).toBe('complete')
    expect(result.steps[1]).toContain('价格条件落在参考区间内')
  })

  it('does not turn a bearish or incomplete report into a buy condition', () => {
    const bearish = buildQuantDecisionGuide({
      report: report(),
      recommendation: 'bearish',
      aiReview: null,
      currentPrice: 34,
      currentPriceObservedAt: '20260828',
    })
    const incomplete = buildQuantDecisionGuide({
      report: report({
        factorModel: { ...report().factorModel!, coverage: 50, coveredWeight: 0.5, factors: [{ ...report().factorModel!.factors[0], status: 'partial' }] },
        evidence: [{ ...report().evidence[0], status: 'fail' }],
      }),
      recommendation: 'bullish',
      aiReview: null,
      currentPrice: null,
      currentPriceObservedAt: null,
    })

    expect(bearish.priceStatus).toBe('not-buying')
    expect(bearish.priceLabel).toContain('不是买入方向')
    expect(incomplete.priceStatus).toBe('unavailable')
    expect(incomplete.trustStatus).toBe('insufficient')
    expect(incomplete.trustLabel).toContain('数据不足')
  })
})
