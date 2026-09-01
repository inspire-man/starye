import type { QuantDecisionAssistantMarketInput } from '../decision-assistant'
import type { QuantResearchEvidence, QuantResearchReport } from '../research-report'
import { describe, expect, it, vi } from 'vitest'
import { buildQuantDecisionAssistant, buildQuantDecisionAssistantAiReview, generateQuantAiDecisionAssistant, parseQuantAiDecisionAssistant, parseQuantDecisionAssistantSnapshot } from '../decision-assistant'

const factorKeys = ['trend', 'valuation', 'quality', 'shareholder-return', 'risk'] as const

function evidence(key: string, dimension: QuantResearchEvidence['dimension']): QuantResearchEvidence {
  return {
    key,
    dimension,
    label: key,
    status: 'pass',
    value: 1,
    threshold: 'fixture',
    source: 'fixture source',
    observedAt: '20260829',
    formulaVersion: 'fixture-v1',
    detail: 'fixture evidence',
  }
}

function report(): QuantResearchReport {
  const evidenceItems = [
    evidence('trend-sample', 'trend'),
    evidence('trend-ma20', 'trend'),
    evidence('trend-return20', 'trend'),
    evidence('valuation-pe', 'valuation'),
    evidence('valuation-pb', 'valuation'),
    evidence('quality-profit', 'quality'),
    evidence('quality-roe', 'quality'),
    evidence('quality-cashflow', 'quality'),
    evidence('quality-history', 'quality'),
    evidence('shareholder-yield', 'shareholder-return'),
    evidence('risk-volume', 'risk'),
    evidence('risk-streak', 'risk'),
  ]
  const evidenceByFactor = new Map<string, string[]>([
    ['trend', ['trend-sample', 'trend-ma20', 'trend-return20']],
    ['valuation', ['valuation-pe', 'valuation-pb']],
    ['quality', ['quality-profit', 'quality-roe', 'quality-cashflow', 'quality-history']],
    ['shareholder-return', ['shareholder-yield']],
    ['risk', ['risk-volume', 'risk-streak']],
  ])
  return {
    reportVersion: 'research-report-v2',
    tsCode: '601899.SH',
    name: '紫金矿业',
    generatedAt: '2026-08-29T01:00:00.000Z',
    sourceSnapshotId: 'snapshot-1',
    status: 'ready',
    action: 'research-window',
    score: 78,
    headline: '看多：正向证据占优',
    strengths: ['因子覆盖完整'],
    risks: ['商品价格波动'],
    gaps: [],
    nextActions: ['关注下一期财报'],
    evidence: evidenceItems,
    sources: [
      { id: 'local-daily-bars', name: '本地 Quant 日线库', observedAt: '20260829', formulaVersion: 'daily-bars-v1' },
      { id: 'eastmoney-valuation', name: 'Eastmoney 估值', observedAt: '20260829', formulaVersion: 'valuation-v1' },
      { id: 'eastmoney-financial', name: 'Eastmoney 财务报告', observedAt: '20260829', formulaVersion: 'financial-v1' },
    ],
    factorModel: {
      modelVersion: 'research-factors-v1',
      totalWeight: 1,
      coveredWeight: 1,
      coverage: 100,
      score: 78,
      factors: factorKeys.map(key => ({
        key,
        label: key,
        weight: key === 'trend' ? 0.25 : key === 'shareholder-return' ? 0.15 : 0.2,
        sourceId: 'fixture',
        source: 'fixture source',
        status: 'ready' as const,
        score: 78,
        evidenceKeys: evidenceByFactor.get(key)!,
        missingEvidenceKeys: [],
      })),
    },
    decision: {
      decisionVersion: 'research-decision-v1',
      recommendation: 'bullish',
      label: '看多',
      deterministicScore: 78,
      confidence: 78,
      coverage: 100,
      buyPriceRange: {
        low: 30,
        high: 35,
        currency: 'CNY',
        formulaVersion: 'reference-price-v1',
        source: '本地 Quant 日线库',
        observedAt: '20260829',
        evidenceKeys: ['trend-sample', 'trend-ma20'],
      },
      sellPriceRange: {
        low: 38,
        high: 42,
        currency: 'CNY',
        formulaVersion: 'reference-price-v1',
        source: '本地 Quant 日线库',
        observedAt: '20260829',
        evidenceKeys: ['trend-sample'],
      },
      evidenceKeys: evidenceItems.map(item => item.key),
      invalidationConditions: ['风险因子转弱后重新评估'],
      headline: '看多：正向证据占优',
    },
  }
}

function assistantPayload() {
  return {
    recommendation: 'bullish',
    action: 'consider-buy',
    confidence: 84,
    rationale: '方向与已保存的因子证据一致。',
    risks: ['商品价格变化可能削弱趋势'],
    invalidationConditions: ['下一期财报显著恶化时复核'],
    citedEvidenceKeys: ['trend-sample', 'quality-roe'],
    factorReviews: factorKeys.map(factor => ({
      factor,
      stance: 'support',
      confidence: 80,
      rationale: `${factor} 有可核对证据。`,
      citedEvidenceKeys: factor === 'trend' ? ['trend-sample'] : factor === 'valuation' ? ['valuation-pe'] : factor === 'quality' ? ['quality-roe'] : factor === 'shareholder-return' ? ['shareholder-yield'] : ['risk-volume'],
    })),
  }
}

function marketInput(currentPrice: number): QuantDecisionAssistantMarketInput {
  return {
    currentPrice,
    currentPriceSource: 'eastmoney-realtime',
    currentPriceStatus: 'realtime',
    currentPriceObservedAt: '2026-08-30T01:00:00.000Z',
    currentPriceChangePercent: null,
    quoteErrorCode: null,
  }
}

describe('quant decision assistant', () => {
  it('keeps the buy scenario actionable while preserving source dates', () => {
    const result = buildQuantDecisionAssistant({
      report: report(),
      researchRunId: 'run-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      scenario: { mode: 'buy', costBasis: null, quantity: null },
      market: marketInput(33.4),
      latestDailyBar: { close: 33.2, tradeDate: '20260829' },
      assessedAt: new Date('2026-08-30T01:00:00.000Z'),
    })

    expect(result.deterministic).toMatchObject({
      recommendation: 'bullish',
      action: 'consider-buy',
      priceStatus: 'within',
      coverage: 100,
    })
    expect(result.deterministic.trust).toMatchObject({ level: 'high', freshnessDays: 1, sourceCount: 3 })
    expect(result.market).toMatchObject({ currentPrice: 33.4, currentPriceSource: 'eastmoney-realtime', currentPriceStatus: 'realtime', latestClose: 33.2 })
  })

  it('calculates the holding loss and recovery requirement for 28.8 versus 33.4', () => {
    const result = buildQuantDecisionAssistant({
      report: report(),
      researchRunId: 'run-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      scenario: { mode: 'holding', costBasis: 33.4, quantity: null },
      market: marketInput(28.8),
      latestDailyBar: { close: 33.2, tradeDate: '20260829' },
      assessedAt: new Date('2026-08-30T01:00:00.000Z'),
    })

    expect(result.deterministic).toMatchObject({ action: 'hold', unrealizedPnlPercent: -13.77, recoveryPercent: 15.97 })
    expect(result.deterministic.rationale).toContain('不因下跌本身加仓')
    expect(result.deterministic.rationale).toContain('服务端现价')
    expect(result.scenario).toMatchObject({ mode: 'holding', currentPrice: 28.8, costBasis: 33.4 })
  })

  it('only accepts an AI review when direction, factor coverage and citations agree', () => {
    const base = buildQuantDecisionAssistant({
      report: report(),
      researchRunId: 'run-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      scenario: { mode: 'buy', costBasis: null, quantity: null },
      market: marketInput(33.4),
      latestDailyBar: { close: 33.2, tradeDate: '20260829' },
      assessedAt: new Date('2026-08-30T01:00:00.000Z'),
    })
    const generated = parseQuantAiDecisionAssistant(assistantPayload(), report())
    const accepted = buildQuantDecisionAssistantAiReview({
      generated,
      config: { provider: 'openai_compatible', model: 'gpt-5.4' },
      report: report(),
      deterministic: base.deterministic,
      scenario: base.scenario,
    })
    const merged = { ...base, ai: accepted } as typeof base

    expect(accepted).toMatchObject({ status: 'accepted', accepted: true, factorReviewCoverage: 100 })
    expect(merged.ai.provider).toBe('openai_compatible')

    const lowConfidence = buildQuantDecisionAssistantAiReview({
      generated: parseQuantAiDecisionAssistant({ ...assistantPayload(), confidence: 40 }, report()),
      config: { provider: 'openai_compatible', model: 'gpt-5.4' },
      report: report(),
      deterministic: base.deterministic,
      scenario: base.scenario,
    })
    expect(lowConfidence).toMatchObject({ status: 'rejected', accepted: false, rejectionReason: 'low-confidence' })

    const incomplete = buildQuantDecisionAssistantAiReview({
      generated: parseQuantAiDecisionAssistant({
        ...assistantPayload(),
        factorReviews: assistantPayload().factorReviews.filter(review => review.factor !== 'risk'),
      }, report()),
      config: { provider: 'openai_compatible', model: 'gpt-5.4' },
      report: report(),
      deterministic: base.deterministic,
      scenario: base.scenario,
    })
    expect(incomplete).toMatchObject({ status: 'rejected', accepted: false, rejectionReason: 'factor-review-incomplete', factorReviewCoverage: 80 })
  })

  it('normalizes snake_case AI response fields without weakening validation', () => {
    const { invalidationConditions, citedEvidenceKeys, factorReviews, ...rest } = assistantPayload()
    const parsed = parseQuantAiDecisionAssistant({
      ...rest,
      invalidation_conditions: invalidationConditions,
      cited_evidence_keys: citedEvidenceKeys,
      factor_reviews: factorReviews.map(({ citedEvidenceKeys: reviewEvidence, ...review }) => ({
        ...review,
        cited_evidence_keys: reviewEvidence,
      })),
    }, report())

    expect(parsed).toMatchObject({ recommendation: 'bullish', action: 'consider-buy' })
    expect(parsed.factorReviews[0]).toMatchObject({ factor: 'trend' })
  })

  it('rejects cross-factor evidence and round-trips the persisted snapshot', () => {
    expect(() => parseQuantAiDecisionAssistant({
      ...assistantPayload(),
      factorReviews: assistantPayload().factorReviews.map(review => review.factor === 'trend' ? { ...review, citedEvidenceKeys: ['valuation-pe'] } : review),
    }, report())).toThrow('another factor')

    const snapshot = buildQuantDecisionAssistant({
      report: report(),
      researchRunId: 'run-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      scenario: { mode: 'holding', costBasis: 33.4, quantity: 100 },
      market: marketInput(28.8),
      latestDailyBar: { close: 33.2, tradeDate: '20260829' },
      assessedAt: new Date('2026-08-30T01:00:00.000Z'),
    })
    expect(parseQuantDecisionAssistantSnapshot(JSON.stringify(snapshot))).toMatchObject({
      snapshotVersion: 'decision-assistant-v1',
      scenario: { mode: 'holding', currentPrice: 28.8, costBasis: 33.4, quantity: 100 },
      final: { source: 'deterministic' },
    })

    const legacySnapshot = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>
    legacySnapshot.market = {
      currentPrice: 28.8,
      currentPriceSource: 'user-input',
      latestClose: 33.2,
      latestTradeDate: '20260829',
      latestCloseSource: 'local-daily-bars',
      priceDeltaPercent: -13.25,
    }
    expect(parseQuantDecisionAssistantSnapshot(JSON.stringify(legacySnapshot))).toMatchObject({
      market: { currentPriceSource: 'user-input', currentPriceStatus: 'user-input', currentPriceObservedAt: snapshot.assessedAt },
    })
  })

  it('does not let an aging factor enter the final AI action', () => {
    const base = buildQuantDecisionAssistant({
      report: report(),
      researchRunId: 'run-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      scenario: { mode: 'buy', costBasis: null, quantity: null },
      market: marketInput(33.4),
      latestDailyBar: { close: 33.2, tradeDate: '20260829' },
      assessedAt: new Date('2026-09-15T01:00:00.000Z'),
    })
    const generated = parseQuantAiDecisionAssistant(assistantPayload(), report())
    const review = buildQuantDecisionAssistantAiReview({
      generated,
      config: { provider: 'openai_compatible', model: 'gpt-5.4' },
      report: report(),
      deterministic: base.deterministic,
      scenario: base.scenario,
      evaluatedAt: new Date('2026-09-15T01:00:00.000Z'),
    })

    expect(review).toMatchObject({ status: 'rejected', accepted: false, rejectionReason: 'factor-review-incomplete' })
    expect(review.factorReviewCoverage).toBeLessThan(100)
    expect(review.factorReviews.find(item => item.factor === 'trend')).toMatchObject({ accepted: false })
  })

  it('calls the configured OpenAI-compatible chat endpoint with a JSON response contract', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(assistantPayload()) } }],
    }), { status: 200 }))
    const base = buildQuantDecisionAssistant({
      report: report(),
      researchRunId: 'run-1',
      tsCode: '601899.SH',
      name: '紫金矿业',
      scenario: { mode: 'buy', costBasis: null, quantity: null },
      market: marketInput(33.4),
      latestDailyBar: { close: 33.2, tradeDate: '20260829' },
      assessedAt: new Date('2026-08-30T01:00:00.000Z'),
    })
    const generated = await generateQuantAiDecisionAssistant({
      report: report(),
      deterministic: base.deterministic,
      scenario: base.scenario,
      market: base.market,
      config: { id: 'ai-1', provider: 'openai_compatible', model: 'gpt-5.4', baseUrl: 'https://ai.fixture.test/v1', apiKey: 'fixture-key' },
      fetchImpl,
    })

    expect(generated.confidence).toBe(84)
    expect(fetchImpl).toHaveBeenCalledWith('https://ai.fixture.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"response_format":{"type":"json_object"}'),
    }))
  })
})
