import type { QuantDecryptedAiConfig } from '../ai-config'
import type { QuantResearchReport } from '../research-report'
import { describe, expect, it, vi } from 'vitest'
import { generateQuantAiSummary } from '../ai-summary'

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
      decisionReview: null,
    })
    expect(fetchImpl).toHaveBeenCalledWith('https://ai.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-user-secret' }),
    }))
    const requestInit = fetchImpl.mock.calls[0]?.[1]
    expect(String(requestInit?.body)).toContain('quality-roe')
    expect(String(requestInit?.body)).not.toContain('sk-user-secret')
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
