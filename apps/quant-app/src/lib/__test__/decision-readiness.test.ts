import type { QuantAiDecisionReview, QuantAiFactorImpact, QuantResearchReport } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildQuantDecisionReadiness } from '../decision-readiness'

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
    headline: '看多',
    strengths: [],
    risks: [],
    gaps: [],
    nextActions: [],
    evidence: [{
      key: 'trend-sample',
      dimension: 'trend',
      label: '趋势样本',
      status: 'pass',
      value: 1,
      threshold: 'fixture',
      source: '本地 Quant 日线库',
      observedAt: '20260830',
      formulaVersion: 'fixture-v1',
      detail: 'fixture',
    }],
    sources: [{ id: 'daily', name: '本地 Quant 日线库', observedAt: '20260830', formulaVersion: 'fixture-v1' }],
    factorModel: {
      modelVersion: 'research-factors-v1',
      totalWeight: 1,
      coveredWeight: 1,
      coverage: 100,
      score: 82,
      factors: [{
        key: 'quality',
        label: '盈利质量',
        weight: 0.6,
        sourceId: 'daily',
        source: '本地 Quant 日线库',
        status: 'ready',
        score: 90,
        evidenceKeys: ['trend-sample'],
        missingEvidenceKeys: [],
      }, {
        key: 'valuation',
        label: '估值',
        weight: 0.4,
        sourceId: 'daily',
        source: '本地 Quant 日线库',
        status: 'ready',
        score: 70,
        evidenceKeys: ['trend-sample'],
        missingEvidenceKeys: [],
      }],
    },
    decision: {
      decisionVersion: 'research-decision-v1',
      recommendation: 'bullish',
      label: '看多',
      deterministicScore: 82,
      confidence: 82,
      coverage: 100,
      buyPriceRange: {
        low: 30,
        high: 35,
        currency: 'CNY',
        formulaVersion: 'reference-price-v1',
        source: '本地 Quant 日线库',
        observedAt: '20260830',
        evidenceKeys: ['trend-sample'],
      },
      sellPriceRange: null,
      evidenceKeys: ['trend-sample'],
      invalidationConditions: [],
      headline: '看多',
    },
    ...overrides,
  }
}

function aiReview(overrides: Partial<QuantAiDecisionReview> = {}): QuantAiDecisionReview {
  return {
    decisionVersion: 'ai-decision-v1',
    recommendation: 'bullish',
    confidence: 86,
    accepted: true,
    rejectionReason: null,
    factorReviewCoverage: 100,
    rationale: '证据一致。',
    invalidationConditions: [],
    citedEvidenceKeys: ['trend-sample'],
    ...overrides,
  }
}

function factorImpact(overrides: Partial<QuantAiFactorImpact> = {}): QuantAiFactorImpact {
  return {
    modelVersion: 'research-factors-v1',
    totalWeight: 1,
    deterministicScore: 82,
    scoredWeight: 1,
    reviewedWeight: 1,
    reviewCoverage: 100,
    supportWeight: 0.6,
    cautionWeight: 0.4,
    opposeWeight: 0,
    unacceptedWeight: 0,
    factors: [{
      factor: 'quality',
      label: '盈利质量',
      weight: 0.6,
      deterministicScore: 90,
      deterministicStance: 'support',
      deterministicContribution: 54,
      aiStance: 'support',
      aiConfidence: 88,
      aiAccepted: true,
      aiWeight: 0.6,
    }, {
      factor: 'valuation',
      label: '估值',
      weight: 0.4,
      deterministicScore: 70,
      deterministicStance: 'support',
      deterministicContribution: 28,
      aiStance: 'caution',
      aiConfidence: 82,
      aiAccepted: true,
      aiWeight: 0.4,
    }],
    ...overrides,
  }
}

describe('buildQuantDecisionReadiness', () => {
  it('returns ready only when data, price, and accepted AI factor coverage pass', () => {
    const result = buildQuantDecisionReadiness({ report: report(), aiReview: aiReview(), factorImpact: factorImpact(), currentPrice: 32, dataFreshness: 'fresh' })

    expect(result).toMatchObject({ version: 'decision-readiness-v1', status: 'ready', label: '可参考', unresolvedFactors: [] })
    expect(result.checks.map(check => check.status)).toEqual(['pass', 'pass', 'pass', 'pass'])
  })

  it('keeps a readable deterministic result at review status when AI coverage is incomplete', () => {
    const completeImpact = factorImpact()
    const result = buildQuantDecisionReadiness({
      report: report(),
      factorImpact: {
        ...completeImpact,
        reviewedWeight: 0.6,
        reviewCoverage: 60,
        unacceptedWeight: 0.4,
        factors: completeImpact.factors.map(factor => factor.factor === 'valuation' ? { ...factor, aiStance: null, aiAccepted: false, aiWeight: 0 } : factor),
      },
      currentPrice: 32,
      dataFreshness: 'fresh',
    })

    expect(result).toMatchObject({ status: 'review', label: '仅供参考', unresolvedFactors: ['估值'] })
    expect(result.checks[1]).toMatchObject({ status: 'review', detail: expect.stringContaining('60%') })
  })

  it('blocks the status when key data or price is missing', () => {
    const baseReport = report()
    const result = buildQuantDecisionReadiness({
      report: {
        ...baseReport,
        evidence: [{ ...baseReport.evidence[0], status: 'fail' }],
        factorModel: { ...baseReport.factorModel!, coverage: 50, coveredWeight: 0.5, factors: [{ ...baseReport.factorModel!.factors[0]!, status: 'partial' }, baseReport.factorModel!.factors[1]!] },
      },
      currentPrice: null,
      dataFreshness: 'fresh',
    })

    expect(result).toMatchObject({ status: 'blocked', label: '暂不可用' })
    expect(result.checks.map(check => check.status)).toEqual(['blocked', 'review', 'blocked', 'pass'])
    expect(result.unresolvedFactors).toContain('盈利质量')
  })

  it('explains why a rejected AI review remains reference-only', () => {
    const result = buildQuantDecisionReadiness({
      report: report(),
      aiReview: aiReview({ accepted: false, rejectionReason: 'factor-conflict' }),
      factorImpact: factorImpact(),
      currentPrice: 32,
      dataFreshness: 'fresh',
    })

    expect(result).toMatchObject({ status: 'review', label: '仅供参考' })
    expect(result.checks[1].detail).toContain('因子方向存在冲突')
  })

  it('does not claim full readiness for a legacy accepted AI review without factor impact audit', () => {
    const result = buildQuantDecisionReadiness({ report: report(), aiReview: aiReview(), currentPrice: 32, dataFreshness: 'fresh' })

    expect(result).toMatchObject({ status: 'review', label: '仅供参考' })
    expect(result.checks[1].detail).toContain('缺少因子影响审计')
    expect(result.unresolvedFactors).toEqual(['盈利质量', '估值'])
  })

  it('does not let optional missing evidence block an otherwise complete chain', () => {
    const baseReport = report()
    const result = buildQuantDecisionReadiness({
      report: { ...baseReport, evidence: [{ ...baseReport.evidence[0], status: 'missing', optional: true }] },
      aiReview: aiReview(),
      factorImpact: factorImpact(),
      currentPrice: 32,
      dataFreshness: 'fresh',
    })

    expect(result.status).toBe('ready')
  })

  it('gates readiness independently for aging, stale, and unknown data freshness', () => {
    const base = { report: report(), aiReview: aiReview(), factorImpact: factorImpact(), currentPrice: 32 }
    const aging = buildQuantDecisionReadiness({ ...base, dataFreshness: 'aging', dataFreshnessDetail: '1 个数据域已超过 48 小时，建议复核' })
    const stale = buildQuantDecisionReadiness({ ...base, dataFreshness: 'stale', dataFreshnessDetail: '1 个数据域已超过 7 天，先刷新后再判断' })
    const unknown = buildQuantDecisionReadiness({ ...base, dataFreshness: 'unknown' })

    expect(aging).toMatchObject({ status: 'review', label: '仅供参考' })
    expect(aging.checks.find(check => check.key === 'freshness')).toMatchObject({ status: 'review', detail: '1 个数据域已超过 48 小时，建议复核' })
    expect(stale).toMatchObject({ status: 'blocked', label: '暂不可用' })
    expect(stale.checks.find(check => check.key === 'freshness')).toMatchObject({ status: 'blocked', detail: '1 个数据域已超过 7 天，先刷新后再判断' })
    expect(unknown.checks.find(check => check.key === 'freshness')).toMatchObject({ status: 'blocked', detail: '没有可验证的数据观察时间' })
  })

  it('blocks an accepted legacy review when parsed factor freshness is unknown', () => {
    const complete = factorImpact()
    const result = buildQuantDecisionReadiness({
      report: report(),
      aiReview: aiReview(),
      factorImpact: {
        ...complete,
        freshnessVersion: 'unknown',
        freshnessBlockedFactors: ['quality'],
        factors: complete.factors.map(factor => factor.factor === 'quality'
          ? {
              ...factor,
              freshness: {
                version: 'unknown',
                status: 'unknown',
                observedAt: null,
                ageDays: null,
                freshWithinDays: 0,
                agingWithinDays: 0,
                detail: '历史响应未记录因子新鲜度',
                missingEvidenceKeys: [],
                unverifiableEvidenceKeys: [],
              },
              aiFreshnessEligible: false,
            }
          : factor),
      },
      currentPrice: 32,
      dataFreshness: 'fresh',
    })

    expect(result).toMatchObject({ status: 'review', label: '仅供参考' })
    expect(result.checks.find(check => check.key === 'ai')).toMatchObject({ status: 'review', detail: expect.stringContaining('证据时间不足') })
    expect(result.unresolvedFactors).toContain('盈利质量')
  })
})
