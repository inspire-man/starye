import type { QuantDecryptedAiConfig } from '../ai-config'
import type { QuantResearchReport } from '../research-report'
import { describe, expect, it, vi } from 'vitest'
import { buildQuantAiFactorImpact, generateQuantAiSummary, parseQuantAiFactorImpactSnapshot, parseQuantAiSummary } from '../ai-summary'

const report: QuantResearchReport = {
  reportVersion: 'research-report-v2',
  tsCode: '601899.SH',
  name: '紫金矿业',
  generatedAt: '2026-08-26T00:00:00.000Z',
  sourceSnapshotId: 'snapshot-1',
  status: 'partial',
  action: 'wait-confirmation',
  score: 72.5,
  headline: '等待确认：部分证据可用',
  strengths: ['财务质量达到研究门槛'],
  risks: ['估值仍需结合行业位置'],
  gaps: ['部分来源尚未返回'],
  nextActions: ['等待下一期财报并复核'],
  evidence: [{
    key: 'quality-roe',
    dimension: 'quality',
    label: 'ROE',
    status: 'pass',
    value: 18,
    threshold: '至少 10%',
    source: 'Eastmoney 最新财报',
    observedAt: '2026-06-30',
    formulaVersion: 'eastmoney-financial-v1',
    detail: '最近一期 ROE 达到研究门槛。',
  }, {
    key: 'valuation-pe',
    dimension: 'valuation',
    label: 'TTM PE',
    status: 'caution',
    value: 12,
    threshold: '需要行业比较',
    source: 'Eastmoney 估值',
    observedAt: '2026-08-26T00:00:00.000Z',
    formulaVersion: 'eastmoney-valuation-v1',
    detail: '估值数据需要与观察池样本比较。',
  }],
  sources: [{
    id: 'eastmoney-financial',
    name: 'Eastmoney 财务报告',
    observedAt: '2026-08-26T00:00:00.000Z',
    formulaVersion: 'eastmoney-financial-v1',
  }],
  factorModel: {
    modelVersion: 'research-factors-v1',
    totalWeight: 1,
    coveredWeight: 1,
    coverage: 100,
    score: 72.5,
    factors: [],
    configuration: {
      version: 'research-factor-config-v1',
      weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 },
      source: 'user',
      updatedAt: '2026-08-26T00:00:00.000Z',
    },
  },
}

const config: QuantDecryptedAiConfig = {
  id: 'ai-config-1',
  provider: 'openai_compatible',
  model: 'gpt-5.5',
  baseUrl: 'https://ai.example.test/v1',
  apiKey: 'sk-user-secret',
}

function response(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function validContent(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    overview: '当前证据显示基本面有支持，但仍有需要复核的部分。',
    supports: ['ROE 达到报告门槛'],
    concerns: ['TTM PE 需要结合行业比较'],
    nextChecks: ['等待下一期财报并复核'],
    citedEvidenceKeys: ['quality-roe', 'valuation-pe'],
    ...overrides,
  })
}

const factorReport: QuantResearchReport = {
  ...report,
  factorModel: {
    ...report.factorModel!,
    factors: [{
      key: 'quality',
      label: '盈利质量',
      weight: 1,
      sourceId: 'eastmoney-financial',
      source: 'Eastmoney 最新财报',
      status: 'ready',
      score: 90,
      evidenceKeys: ['quality-roe'],
      missingEvidenceKeys: [],
    }],
  },
  decision: {
    decisionVersion: 'research-decision-v1',
    recommendation: 'bullish',
    label: '看多',
    deterministicScore: 90,
    confidence: 90,
    coverage: 100,
    buyPriceRange: null,
    sellPriceRange: null,
    evidenceKeys: ['quality-roe'],
    invalidationConditions: [],
    headline: '看多：因子覆盖充分',
  },
}

const multiFactorReport: QuantResearchReport = {
  ...factorReport,
  factorModel: {
    ...factorReport.factorModel!,
    factors: [
      { ...factorReport.factorModel!.factors[0]!, weight: 0.5 },
      {
        key: 'valuation',
        label: '估值',
        weight: 0.5,
        sourceId: 'eastmoney-valuation',
        source: 'Eastmoney 估值',
        status: 'ready',
        score: 70,
        evidenceKeys: ['valuation-pe'],
        missingEvidenceKeys: [],
      },
    ],
  },
}

describe('quant AI summary', () => {
  it('generates a bounded evidence-grounded summary without exposing the key in the prompt', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent()))

    await expect(generateQuantAiSummary({ report, config, fetchImpl })).resolves.toEqual({
      summaryVersion: 'research-summary-v2',
      overview: '当前证据显示基本面有支持，但仍有需要复核的部分。',
      supports: ['ROE 达到报告门槛'],
      concerns: ['TTM PE 需要结合行业比较'],
      nextChecks: ['等待下一期财报并复核'],
      citedEvidenceKeys: ['quality-roe', 'valuation-pe'],
      factorReviews: [],
      decisionReview: null,
    })
    expect(fetchImpl).toHaveBeenCalledWith('https://ai.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-user-secret' }),
    }))
    const requestInit = fetchImpl.mock.calls[0]?.[1]
    expect(String(requestInit?.body)).toContain('quality-roe')
    expect(String(requestInit?.body)).toContain('research-factor-config-v1')
    expect(String(requestInit?.body)).not.toContain('sk-user-secret')
  })

  it('normalizes snake_case fields returned by compatible AI gateways', () => {
    const result = parseQuantAiSummary(JSON.stringify({
      overview: '当前证据有一项明确支持。',
      supports: ['ROE 达到报告门槛'],
      concerns: [],
      next_checks: ['继续核对财报'],
      cited_evidence_keys: ['quality-roe'],
      factor_reviews: [{
        factor: 'quality',
        stance: 'support',
        confidence: 88,
        rationale: '盈利质量有可核对证据。',
        cited_evidence_keys: ['quality-roe'],
      }],
      decision_review: {
        decision_version: 'ai-decision-v1',
        recommendation: 'bullish',
        confidence: 84,
        rationale: '因子方向一致。',
        invalidation_conditions: ['ROE 转弱后复核'],
        cited_evidence_keys: ['quality-roe'],
      },
    }), factorReport, new Date('2026-08-26T00:00:00.000Z'))

    expect(result).toMatchObject({
      nextChecks: ['继续核对财报'],
      factorReviews: [{ factor: 'quality', accepted: true }],
      decisionReview: { decisionVersion: 'ai-decision-v1', accepted: true },
    })
  })

  it('rejects invented evidence references', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({ citedEvidenceKeys: ['made-up-key'] })))

    await expect(generateQuantAiSummary({ report, config, fetchImpl })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_INVALID_RESPONSE',
      status: 502,
    })
  })

  it('rejects non-JSON model content and prohibited trading conclusions', async () => {
    const invalidJson = vi.fn<typeof fetch>().mockResolvedValue(response('not-json'))
    await expect(generateQuantAiSummary({ report, config, fetchImpl: invalidJson })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_INVALID_RESPONSE',
    })

    const prohibited = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({ overview: '建议买入并设置目标价。' })))
    await expect(generateQuantAiSummary({ report, config, fetchImpl: prohibited })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_INVALID_RESPONSE',
    })
  })

  it('accepts a cited AI decision review only when the deterministic report has enough data', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      decisionReview: {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bearish',
        confidence: 82,
        rationale: '估值证据需要优先核对，当前风险权重更高。',
        invalidationConditions: ['下一期财报改善后重新复核'],
        citedEvidenceKeys: ['valuation-pe'],
      },
    })))
    const result = await generateQuantAiSummary({
      report: {
        ...report,
        decision: {
          decisionVersion: 'research-decision-v1',
          recommendation: 'bullish',
          label: '看多',
          deterministicScore: 78,
          confidence: 78,
          coverage: 100,
          buyPriceRange: null,
          sellPriceRange: null,
          evidenceKeys: ['quality-roe', 'valuation-pe'],
          invalidationConditions: [],
          headline: '看多：证据覆盖充分',
        },
      },
      config,
      fetchImpl,
    })

    expect(result.decisionReview).toMatchObject({
      decisionVersion: 'ai-decision-v1',
      recommendation: 'bearish',
      confidence: 82,
      accepted: true,
      rejectionReason: null,
      citedEvidenceKeys: ['valuation-pe'],
    })
  })

  it('keeps a low-confidence or data-insufficient AI review from changing the final direction', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      decisionReview: {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bullish',
        confidence: 45,
        rationale: '现有证据不足以形成高置信度复核。',
        invalidationConditions: ['补齐缺失数据'],
        citedEvidenceKeys: ['quality-roe'],
      },
    })))
    const result = await generateQuantAiSummary({ report, config, fetchImpl })

    expect(result.decisionReview).toMatchObject({
      recommendation: 'bullish',
      accepted: false,
      rejectionReason: 'deterministic-watch',
    })
  })

  it('accepts factor reviews only when their evidence belongs to the reviewed factor', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      factorReviews: [{
        factor: 'quality',
        stance: 'support',
        confidence: 88,
        rationale: '盈利质量因子有明确的 ROE 证据支持。',
        citedEvidenceKeys: ['quality-roe'],
      }],
      decisionReview: {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bullish',
        confidence: 84,
        rationale: '因子复核与确定性方向一致。',
        invalidationConditions: ['ROE 转弱后复核'],
        citedEvidenceKeys: ['quality-roe'],
      },
    })))

    const result = await generateQuantAiSummary({ report: factorReport, config, fetchImpl })
    expect(result.factorReviews).toMatchObject([{
      factor: 'quality',
      stance: 'support',
      confidence: 88,
      accepted: true,
      citedEvidenceKeys: ['quality-roe'],
    }])
    expect(result.decisionReview).toMatchObject({ accepted: true, factorReviewCoverage: 100 })
  })

  it('requires every positive-weight factor before accepting an AI decision review', async () => {
    const decisionReview = {
      decisionVersion: 'ai-decision-v1',
      recommendation: 'bullish',
      confidence: 84,
      rationale: '当前因子复核仍需补齐。',
      invalidationConditions: ['估值复核完成后重新评估'],
      citedEvidenceKeys: ['quality-roe'],
    }
    const omittedFactorReviews = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({ decisionReview })))
    await expect(generateQuantAiSummary({ report: factorReport, config, fetchImpl: omittedFactorReviews })).resolves.toMatchObject({
      decisionReview: { accepted: false, rejectionReason: 'factor-review-incomplete', factorReviewCoverage: 0 },
    })

    const partialFactorReviews = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      factorReviews: [{
        factor: 'quality',
        stance: 'support',
        confidence: 88,
        rationale: '盈利质量有可核对证据。',
        citedEvidenceKeys: ['quality-roe'],
      }],
      decisionReview,
    })))
    await expect(generateQuantAiSummary({ report: multiFactorReport, config, fetchImpl: partialFactorReviews })).resolves.toMatchObject({
      factorReviews: [{ factor: 'quality', accepted: true }],
      decisionReview: { accepted: false, rejectionReason: 'factor-review-incomplete', factorReviewCoverage: 50 },
    })
  })

  it('calculates deterministic factor contributions and only accepted AI weights', () => {
    const impact = buildQuantAiFactorImpact(multiFactorReport, [{
      factor: 'quality',
      stance: 'support',
      confidence: 88,
      accepted: true,
      rationale: '盈利质量证据可核对。',
      citedEvidenceKeys: ['quality-roe'],
    }, {
      factor: 'valuation',
      stance: 'oppose',
      confidence: 42,
      accepted: false,
      rationale: '估值复核置信度不足。',
      citedEvidenceKeys: ['valuation-pe'],
    }])

    expect(impact).toMatchObject({
      modelVersion: 'research-factors-v1',
      evaluatedAt: expect.any(String),
      deterministicScore: 72.5,
      aiScore: 100,
      aiScoreDelta: 27.5,
      scoredWeight: 1,
      reviewedWeight: 0.5,
      reviewCoverage: 50,
      supportWeight: 0.5,
      cautionWeight: 0,
      opposeWeight: 0,
      unacceptedWeight: 0.5,
    })
    expect(impact?.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({ factor: 'quality', deterministicContribution: 45, aiAccepted: true, aiWeight: 0.5, aiContribution: 100 }),
      expect.objectContaining({ factor: 'valuation', deterministicContribution: 35, aiAccepted: false, aiWeight: 0, aiContribution: null, aiStance: 'oppose' }),
    ]))
  })

  it('round-trips the server-owned factor impact snapshot and rejects corruption', () => {
    const impact = buildQuantAiFactorImpact(multiFactorReport, [{
      factor: 'quality',
      stance: 'support',
      confidence: 88,
      accepted: true,
      rationale: '盈利质量证据可核对。',
      citedEvidenceKeys: ['quality-roe'],
    }], new Date('2026-08-29T08:00:00.000Z'))!

    expect(parseQuantAiFactorImpactSnapshot(JSON.parse(JSON.stringify(impact)))).toEqual(impact)
    expect(() => parseQuantAiFactorImpactSnapshot({ ...impact, evaluatedAt: 'not-a-date' })).toThrow('Persisted AI factor impact evaluation time is invalid')
    expect(() => parseQuantAiFactorImpactSnapshot({ ...impact, factors: [] })).toThrow('Persisted AI factor impact factors are invalid')
  })

  it('recomputes persisted factor acceptance from evidence and freshness', () => {
    const staleReport: QuantResearchReport = {
      ...multiFactorReport,
      evidence: multiFactorReport.evidence.map(item => item.key === 'valuation-pe' ? { ...item, observedAt: '2026-05-01' } : item),
    }
    const impact = buildQuantAiFactorImpact(staleReport, [{
      factor: 'quality',
      stance: 'support',
      confidence: 88,
      accepted: true,
      rationale: '盈利质量证据可核对。',
      citedEvidenceKeys: ['quality-roe'],
    }, {
      factor: 'valuation',
      stance: 'support',
      confidence: 88,
      accepted: true,
      rationale: '估值证据可核对。',
      citedEvidenceKeys: ['valuation-pe'],
    }], new Date('2026-09-01T00:00:00.000Z'))

    expect(impact).toMatchObject({ freshnessBlockedFactors: ['valuation'], reviewedWeight: 0.5, reviewCoverage: 50 })
    expect(impact?.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({ factor: 'quality', aiAccepted: true, aiFreshnessEligible: true, freshness: expect.objectContaining({ status: 'fresh' }) }),
      expect.objectContaining({ factor: 'valuation', aiAccepted: false, aiFreshnessEligible: false, freshness: expect.objectContaining({ status: 'stale' }) }),
    ]))
  })

  it('includes factor evidence ownership and missing keys in the AI prompt', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      factorReviews: [{
        factor: 'quality',
        stance: 'support',
        confidence: 88,
        rationale: '盈利质量有可核对证据。',
        citedEvidenceKeys: ['quality-roe'],
      }],
    })))
    await generateQuantAiSummary({ report: factorReport, config, fetchImpl })

    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[1]?.content).toContain('"sourceId":"eastmoney-financial"')
    expect(requestBody.messages[1]?.content).toContain('"evidenceKeys":["quality-roe"]')
    expect(requestBody.messages[1]?.content).toContain('"missingEvidenceKeys":[]')
    expect(requestBody.messages[1]?.content).toContain('权重大于 0')
  })

  it('rejects cross-factor citations and records direction conflicts without applying them', async () => {
    const invalidCitation = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      factorReviews: [{
        factor: 'quality',
        stance: 'support',
        confidence: 88,
        rationale: '引用了错误因子。',
        citedEvidenceKeys: ['valuation-pe'],
      }],
    })))
    await expect(generateQuantAiSummary({ report: factorReport, config, fetchImpl: invalidCitation })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_INVALID_RESPONSE',
    })

    const conflict = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      factorReviews: [{
        factor: 'quality',
        stance: 'oppose',
        confidence: 88,
        rationale: '盈利质量因子与看多方向相反。',
        citedEvidenceKeys: ['quality-roe'],
      }],
      decisionReview: {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bullish',
        confidence: 84,
        rationale: '总体结论需要保留。',
        invalidationConditions: ['盈利质量改善后复核'],
        citedEvidenceKeys: ['quality-roe'],
      },
    })))
    await expect(generateQuantAiSummary({ report: factorReport, config, fetchImpl: conflict })).resolves.toMatchObject({
      factorReviews: [{ accepted: true, stance: 'oppose' }],
      decisionReview: { accepted: false, rejectionReason: 'factor-conflict', factorReviewCoverage: 100 },
    })
  })

  it('does not count a missing evidence value toward factor review acceptance', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      factorReviews: [{
        factor: 'quality',
        stance: 'support',
        confidence: 88,
        rationale: '引用的指标仍未返回有效值。',
        citedEvidenceKeys: ['quality-roe'],
      }],
      decisionReview: {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bullish',
        confidence: 84,
        rationale: '因子数据仍需补齐。',
        invalidationConditions: ['ROE 返回有效值后复核'],
        citedEvidenceKeys: ['quality-roe'],
      },
    })))
    const missingReport = {
      ...factorReport,
      evidence: factorReport.evidence.map(item => item.key === 'quality-roe' ? { ...item, status: 'missing' as const, value: null } : item),
    }

    await expect(generateQuantAiSummary({ report: missingReport, config, fetchImpl })).resolves.toMatchObject({
      factorReviews: [{ accepted: false }],
      decisionReview: { accepted: false, rejectionReason: 'factor-review-incomplete' },
    })
  })

  it('keeps an AI explanation but blocks its factor and decision when evidence freshness is insufficient', () => {
    const agingReport: QuantResearchReport = {
      ...factorReport,
      evidence: factorReport.evidence.map(item => ({ ...item, observedAt: '20260101' })),
    }
    const content = validContent({
      factorReviews: [{
        factor: 'quality',
        stance: 'support',
        confidence: 88,
        rationale: '盈利质量有可核对证据，但数据时间需要复核。',
        citedEvidenceKeys: ['quality-roe'],
      }],
      decisionReview: {
        decisionVersion: 'ai-decision-v1',
        recommendation: 'bullish',
        confidence: 84,
        rationale: '仅根据历史证据给出解释。',
        invalidationConditions: ['刷新数据后重新评估'],
        citedEvidenceKeys: ['quality-roe'],
      },
    })

    const result = parseQuantAiSummary(content, agingReport, new Date('2026-09-01T00:00:00.000Z'))
    expect(result.factorReviews).toMatchObject([{ factor: 'quality', stance: 'support', accepted: false }])
    expect(result.decisionReview).toMatchObject({ accepted: false, rejectionReason: 'factor-review-incomplete', factorReviewCoverage: 0 })
  })

  it('classifies missing key and timeout separately', async () => {
    await expect(generateQuantAiSummary({ report, config: { ...config, apiKey: null }, fetchImpl: vi.fn() })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_CONFIGURATION',
      status: 503,
    })

    const timeoutFetch = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>((_resolve, reject) => {
      setTimeout(() => reject(new Error('fixture timeout')), 20)
    }))
    await expect(generateQuantAiSummary({ report, config, timeoutMs: 5, fetchImpl: timeoutFetch })).rejects.toMatchObject({
      code: 'QUANT_AI_SUMMARY_TIMEOUT',
      status: 504,
    })
  })
})
