import type { QuantDecryptedAiConfig } from '../ai-config'
import type { QuantResearchReport } from '../research-report'
import { describe, expect, it, vi } from 'vitest'
import { buildQuantAiComparisonPrompt, generateQuantAiComparison } from '../ai-comparison'

const config: QuantDecryptedAiConfig = {
  id: 'ai-config-1',
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  baseUrl: 'https://ai.example.test/v1',
  apiKey: 'sk-comparison-secret',
}

function report(tsCode: string, evidenceKeys: readonly string[], status: QuantResearchReport['status'] = 'ready'): QuantResearchReport {
  return {
    reportVersion: 'research-report-v2',
    tsCode,
    name: tsCode === '601899.SH' ? '紫金矿业' : '平安银行',
    generatedAt: '2026-08-28T00:00:00.000Z',
    sourceSnapshotId: 'snapshot-1',
    status,
    action: status === 'ready' ? 'research-window' : 'wait-confirmation',
    score: status === 'ready' ? 82 : 62,
    headline: status === 'ready' ? '证据链完整' : '部分证据需要确认',
    strengths: ['已有可核对的研究证据'],
    risks: ['仍需人工复核报告期'],
    gaps: [],
    nextActions: ['继续核对来源'],
    evidence: evidenceKeys.map((key, index) => ({
      key,
      dimension: index === 0 ? 'quality' : 'valuation',
      label: index === 0 ? 'ROE' : 'TTM PE',
      status: index === 0 ? 'pass' : 'caution',
      value: index === 0 ? 18 : 12,
      threshold: '研究门槛',
      source: 'Quant fixture',
      observedAt: '2026-08-28',
      formulaVersion: 'fixture-v1',
      detail: '来自已保存报告的事实。',
    })),
    sources: [{
      id: 'fixture',
      name: 'Quant fixture',
      observedAt: '2026-08-28',
      formulaVersion: 'fixture-v1',
    }],
  }
}

function response(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function validContent(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    overview: '两份报告都有可核对的证据，但数据覆盖和报告期仍需分别确认。',
    commonGround: ['两只股票都有已保存的财务证据'],
    differences: [{ tsCode: '601899.SH', point: '601899.SH 的 ROE 证据可用', evidenceKeys: ['601899-roe'] }],
    risks: ['报告期不同可能影响横向解释'],
    nextChecks: ['人工复核来源日期和报告期'],
    citedEvidence: [
      { tsCode: '601899.SH', evidenceKey: '601899-roe' },
      { tsCode: '000001.SZ', evidenceKey: '000001-roe' },
    ],
    ...overrides,
  })
}

const reports = [
  { runId: 'run-a', report: report('601899.SH', ['601899-roe', '601899-pe']) },
  { runId: 'run-b', report: report('000001.SZ', ['000001-roe', '000001-pb']) },
] as const

describe('quant AI comparison', () => {
  it('generates a bounded comparison with per-stock evidence citations', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent()))

    await expect(generateQuantAiComparison({ reports, config, fetchImpl })).resolves.toMatchObject({
      comparisonVersion: 'research-comparison-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generatedAt: expect.any(String),
      differences: [{ tsCode: '601899.SH', evidenceKeys: ['601899-roe'] }],
      citedEvidence: [
        { tsCode: '601899.SH', evidenceKey: '601899-roe' },
        { tsCode: '000001.SZ', evidenceKey: '000001-roe' },
      ],
    })

    expect(fetchImpl).toHaveBeenCalledWith('https://ai.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-comparison-secret' }),
    }))
    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[1]?.content).toContain('601899.SH')
    expect(requestBody.messages[1]?.content).toContain('000001-roe')
    expect(requestBody.messages[1]?.content).not.toContain('sk-comparison-secret')
  })

  it('includes a third report and rejects cross-stock or unknown evidence references', async () => {
    const third = { runId: 'run-c', report: report('600000.SH', ['600000-roe']) }
    const threeReports = [...reports, third] as const
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response(validContent({
      differences: [{ tsCode: '600000.SH', point: '第三份报告可用', evidenceKeys: ['600000-roe'] }],
      citedEvidence: [{ tsCode: '600000.SH', evidenceKey: '600000-roe' }],
    })))
    await expect(generateQuantAiComparison({ reports: threeReports, config, fetchImpl })).resolves.toMatchObject({
      citedEvidence: [{ tsCode: '600000.SH', evidenceKey: '600000-roe' }],
    })
    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[1]?.content).toContain('600000-roe')

    const crossStock = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      differences: [{ tsCode: '601899.SH', point: '错误引用', evidenceKeys: ['000001-roe'] }],
    })))
    await expect(generateQuantAiComparison({ reports, config, fetchImpl: crossStock })).rejects.toMatchObject({
      code: 'QUANT_AI_COMPARISON_INVALID_RESPONSE',
      status: 502,
    })

    const unknownCitation = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      citedEvidence: [{ tsCode: '601899.SH', evidenceKey: 'made-up-key' }],
    })))
    await expect(generateQuantAiComparison({ reports, config, fetchImpl: unknownCitation })).rejects.toMatchObject({
      code: 'QUANT_AI_COMPARISON_INVALID_RESPONSE',
    })
  })

  it('fails closed for invalid structure, trading conclusions, and missing configuration', async () => {
    const unknownField = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({ unexpected: true })))
    await expect(generateQuantAiComparison({ reports, config, fetchImpl: unknownField })).rejects.toMatchObject({
      code: 'QUANT_AI_COMPARISON_INVALID_RESPONSE',
    })

    for (const field of ['overview', 'commonGround', 'differences', 'risks', 'nextChecks'] as const) {
      const tradingConclusion = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
        [field]: field === 'differences'
          ? [{ tsCode: '601899.SH', point: 'price-target', evidenceKeys: ['601899-roe'] }]
          : field === 'overview'
            ? '建议买入并设置目标价'
            : field === 'commonGround'
              ? ['sell']
              : field === 'risks'
                ? ['return forecast']
                : ['止损价需要确认'],
      })))
      await expect(generateQuantAiComparison({ reports, config, fetchImpl: tradingConclusion })).rejects.toMatchObject({
        code: 'QUANT_AI_COMPARISON_INVALID_RESPONSE',
      })
    }

    const missingConfigFetch = vi.fn<typeof fetch>()
    await expect(generateQuantAiComparison({ reports, config: { ...config, apiKey: null }, fetchImpl: missingConfigFetch })).rejects.toMatchObject({
      code: 'QUANT_AI_COMPARISON_CONFIGURATION',
      status: 503,
    })
    expect(missingConfigFetch).not.toHaveBeenCalled()

    await expect(generateQuantAiComparison({ reports: [reports[0]], config, fetchImpl: missingConfigFetch })).rejects.toMatchObject({
      code: 'QUANT_AI_COMPARISON_INVALID_RESPONSE',
    })
    expect(missingConfigFetch).not.toHaveBeenCalled()
  })

  it('classifies upstream failures and preserves original report states in the prompt', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response('', 502))
    await expect(generateQuantAiComparison({
      reports: [reports[0], { runId: 'partial-run', report: report('000001.SZ', ['000001-roe'], 'partial') }],
      config,
      fetchImpl,
    })).rejects.toMatchObject({ code: 'QUANT_AI_COMPARISON_UPSTREAM', status: 502 })

    const prompt = buildQuantAiComparisonPrompt([reports[0], { runId: 'partial-run', report: report('000001.SZ', ['000001-roe'], 'partial') }])
    expect(prompt).toContain('"status":"partial"')
    expect(prompt.length).toBeLessThanOrEqual(24_000)
  })

  it('classifies comparison timeouts separately from upstream failures', async () => {
    const timeoutFetch = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>((_resolve, reject) => {
      setTimeout(() => reject(new Error('fixture timeout')), 20)
    }))
    await expect(generateQuantAiComparison({ reports, config, timeoutMs: 5, fetchImpl: timeoutFetch })).rejects.toMatchObject({
      code: 'QUANT_AI_COMPARISON_TIMEOUT',
      status: 504,
    })
  })

  it('rejects duplicate reports when called outside the route', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(generateQuantAiComparison({ reports: [reports[0], reports[0]], config, fetchImpl })).rejects.toMatchObject({
      code: 'QUANT_AI_COMPARISON_INVALID_RESPONSE',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('keeps the bounded prompt valid JSON even when reports contain long evidence text', () => {
    const longReport = report('600000.SH', ['600000-roe'])
    const oversized = {
      ...longReport,
      headline: 'x'.repeat(10_000),
      evidence: longReport.evidence.map(item => ({ ...item, detail: 'x'.repeat(10_000) })),
    }
    const prompt = buildQuantAiComparisonPrompt([
      reports[0],
      { runId: 'long-run', report: oversized },
    ])
    const jsonPayload = prompt.split('研究报告：')[1]
    expect(jsonPayload).toBeTruthy()
    expect(() => JSON.parse(jsonPayload!)).not.toThrow()
    expect(prompt.length).toBeLessThanOrEqual(24_000)
  })

  it('includes each report factor snapshot when comparing research runs', () => {
    const prompt = buildQuantAiComparisonPrompt([{
      runId: 'configured-run',
      report: {
        ...reports[0].report,
        factorModel: {
          modelVersion: 'research-factors-v1',
          totalWeight: 1,
          coveredWeight: 1,
          coverage: 100,
          score: 82,
          factors: [],
          configuration: {
            version: 'research-factor-config-v1',
            weights: { 'trend': 0.4, 'valuation': 0.1, 'quality': 0.2, 'shareholder-return': 0.1, 'risk': 0.2 },
            source: 'user',
            updatedAt: '2026-08-29T00:00:00.000Z',
          },
        },
      },
    }, reports[1]])

    expect(prompt).toContain('research-factor-config-v1')
    expect(prompt).toContain('0.4')
  })
})
