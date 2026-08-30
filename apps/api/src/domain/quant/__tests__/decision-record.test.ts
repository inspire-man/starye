import type { QuantResearchReport } from '../research-report'
import { describe, expect, it } from 'vitest'
import { buildQuantDecisionRecordSnapshot, parseQuantDecisionRecordSnapshot } from '../decision-record'

function report(overrides: Partial<QuantResearchReport> = {}): QuantResearchReport {
  return {
    reportVersion: 'research-report-v2',
    tsCode: '601899.SH',
    name: '紫金矿业',
    generatedAt: '2026-08-30T00:00:00.000Z',
    sourceSnapshotId: 'snapshot-1',
    status: 'ready',
    action: 'research-window',
    score: 82,
    headline: '证据完整',
    strengths: [],
    risks: [],
    gaps: [],
    nextActions: [],
    evidence: [],
    sources: [],
    factorModel: {
      modelVersion: 'research-factors-v1',
      totalWeight: 1,
      coveredWeight: 1,
      coverage: 100,
      score: 82,
      factors: [],
      configuration: {
        version: 'research-factor-config-v1',
        weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 },
        source: 'user',
        updatedAt: '2026-08-29T00:00:00.000Z',
      },
    },
    decision: {
      decisionVersion: 'research-decision-v1',
      recommendation: 'bullish',
      label: '看多',
      deterministicScore: 82,
      confidence: 82,
      coverage: 100,
      buyPriceRange: {
        low: 15,
        high: 16,
        currency: 'CNY',
        formulaVersion: 'reference-price-v1',
        source: 'Quant 日线',
        observedAt: '20260829',
        evidenceKeys: ['trend-sample'],
      },
      sellPriceRange: null,
      evidenceKeys: ['trend-sample'],
      invalidationConditions: ['趋势转弱'],
      headline: '看多：证据完整',
    },
    ...overrides,
  }
}

describe('quant decision record snapshot', () => {
  it('captures server-owned report, price, AI, and factor configuration facts', () => {
    const snapshot = buildQuantDecisionRecordSnapshot({
      report: report(),
      latestDailyBar: { close: 15.5, tradeDate: '20260830' },
      aiDecisionReview: {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bullish',
        confidence: 84,
        accepted: true,
        rejectionReason: null,
        rationale: '证据相互支持。',
        invalidationConditions: ['趋势转弱'],
        citedEvidenceKeys: ['trend-sample'],
      },
    })

    expect(parseQuantDecisionRecordSnapshot(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(snapshot).toMatchObject({
      snapshotVersion: 'decision-record-v1',
      recommendation: 'bullish',
      currentPrice: 15.5,
      currentPriceObservedAt: '20260830',
      factorConfiguration: { source: 'user' },
      aiDecisionReview: { accepted: true, confidence: 84 },
    })
  })

  it('keeps unavailable report facts null and rejects corrupted snapshots', () => {
    const snapshot = buildQuantDecisionRecordSnapshot({ report: report({ decision: undefined, factorModel: undefined }) })

    expect(snapshot).toMatchObject({ recommendation: null, confidence: null, coverage: null, currentPrice: null, factorConfiguration: null })
    expect(() => parseQuantDecisionRecordSnapshot(JSON.stringify({ ...snapshot, snapshotVersion: 'unknown' }))).toThrow('Persisted decision record snapshot is invalid')
  })
})
