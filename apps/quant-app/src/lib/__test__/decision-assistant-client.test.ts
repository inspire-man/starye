import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QUANT_API_PREFIX, quantApi } from '../api-client'

function assessmentPayload() {
  return {
    id: 'assessment-1',
    snapshotVersion: 'decision-assistant-v1',
    tsCode: '601899.SH',
    name: '紫金矿业',
    researchRunId: 'run-1',
    assessedAt: '2026-08-30T01:00:00.000Z',
    createdAt: '2026-08-30T01:00:00.000Z',
    reportGeneratedAt: '2026-08-29T01:00:00.000Z',
    scenario: { mode: 'holding', currentPrice: 28.8, costBasis: 33.4, quantity: null },
    market: { currentPrice: 28.8, currentPriceSource: 'eastmoney-realtime', currentPriceStatus: 'realtime', currentPriceObservedAt: '2026-08-30T00:00:00.000Z', currentPriceChangePercent: -13.25, quoteErrorCode: null, latestClose: 33.2, latestTradeDate: '20260829', latestCloseSource: 'local-daily-bars', priceDeltaPercent: -13.25 },
    evidence: { total: 12, usable: 12, missing: 0, failed: 0 },
    sources: [{ id: 'daily', name: '本地 Quant 日线库', observedAt: '20260829', formulaVersion: 'daily-v1' }],
    deterministic: {
      recommendation: 'bullish',
      label: '看多',
      action: 'add-review',
      actionLabel: '加仓复核',
      rationale: '低价本身不是加仓理由。',
      priceStatus: 'below',
      priceLabel: '当前价低于参考买入区间',
      priceDetail: 'Eastmoney 实时行情 28.80 元。',
      score: 78,
      coverage: 100,
      buyPriceRange: { low: 30, high: 35, currency: 'CNY', formulaVersion: 'reference-price-v1', source: '本地 Quant 日线库', observedAt: '20260829', evidenceKeys: ['trend-sample'] },
      sellPriceRange: null,
      unrealizedPnlPercent: -13.77,
      recoveryPercent: 15.97,
      trust: { level: 'high', score: 92, coverage: 100, evidenceCoverage: 100, sourceCount: 3, latestObservedAt: '20260829', freshnessDays: 1, missingEvidenceCount: 0, failedEvidenceCount: 0, crossSourceAlertCount: 0, reasons: ['覆盖充分'] },
      evidence: { total: 12, usable: 12, missing: 0, failed: 0 },
      evidenceKeys: ['trend-sample'],
      sources: [{ id: 'daily', name: '本地 Quant 日线库', observedAt: '20260829', formulaVersion: 'daily-v1' }],
      checks: ['覆盖充分'],
      invalidationConditions: ['趋势转弱'],
    },
    ai: {
      aiVersion: 'decision-assistant-ai-v1',
      status: 'rejected',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      recommendation: 'bullish',
      action: 'hold',
      confidence: 58,
      accepted: false,
      rejectionReason: 'low-confidence',
      factorReviewCoverage: 80,
      rationale: '复核结果保留在证据层。',
      risks: ['风险因子需要更新'],
      invalidationConditions: ['趋势转弱'],
      citedEvidenceKeys: ['trend-sample'],
      factorReviews: [],
      errorCode: null,
    },
    final: { recommendation: 'bullish', label: '看多', action: 'add-review', actionLabel: '加仓复核', confidence: 92, source: 'deterministic', rationale: '低价本身不是加仓理由。' },
  }
}

describe('decision assistant API client', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('sends scenario numbers and parses the persisted assessment', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: assessmentPayload() }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.createDecisionAssistant({
      researchRunId: 'run-1',
      mode: 'holding',
      costBasis: 33.4,
      includeAi: true,
    })).resolves.toMatchObject({
      tsCode: '601899.SH',
      scenario: { mode: 'holding', currentPrice: 28.8, costBasis: 33.4 },
      final: { source: 'deterministic' },
    })

    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/decision-assistant`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ research_run_id: 'run-1', mode: 'holding', cost_basis: 33.4, include_ai: true }),
    }))
  })

  it('parses the user-scoped assessment history envelope', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { items: [assessmentPayload()], limit: 10 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    await expect(quantApi.getDecisionAssistants('601899.SH', 10)).resolves.toMatchObject([{ id: 'assessment-1', ai: { status: 'rejected' } }])
  })

  it('parses the optional factor impact and keeps legacy assessments valid', async () => {
    const payload = assessmentPayload() as Record<string, unknown>
    payload.factorImpact = {
      modelVersion: 'research-factors-v1',
      totalWeight: 1,
      deterministicScore: 78,
      scoredWeight: 1,
      reviewedWeight: 0.5,
      reviewCoverage: 50,
      supportWeight: 0.5,
      cautionWeight: 0,
      opposeWeight: 0,
      unacceptedWeight: 0.5,
      factors: [{
        factor: 'quality',
        label: '盈利质量',
        weight: 0.5,
        deterministicScore: 90,
        deterministicStance: 'support',
        deterministicContribution: 45,
        aiStance: 'support',
        aiConfidence: 88,
        aiAccepted: true,
        aiWeight: 0.5,
      }, {
        factor: 'valuation',
        label: '估值',
        weight: 0.5,
        deterministicScore: 66,
        deterministicStance: 'support',
        deterministicContribution: 33,
        aiStance: null,
        aiConfidence: null,
        aiAccepted: false,
        aiWeight: 0,
      }],
    }
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: payload }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })))

    await expect(quantApi.createDecisionAssistant({ researchRunId: 'run-1', mode: 'holding', costBasis: 33.4, includeAi: true })).resolves.toMatchObject({
      factorImpact: { reviewCoverage: 50, factors: [{ factor: 'quality', aiAccepted: true }, { factor: 'valuation', aiAccepted: false }] },
    })

    const legacy = assessmentPayload()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { items: [legacy], limit: 10 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))
    await expect(quantApi.getDecisionAssistants('601899.SH', 10)).resolves.toMatchObject([{ id: 'assessment-1', factorImpact: null }])
  })
})
