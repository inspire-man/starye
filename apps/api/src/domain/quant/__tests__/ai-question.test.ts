import type { QuantDecryptedAiConfig } from '../ai-config'
import type { QuantResearchReport } from '../research-report'
import { describe, expect, it, vi } from 'vitest'
import { buildQuantAiQuestionPrompt, generateQuantAiQuestion } from '../ai-question'

const config: QuantDecryptedAiConfig = {
  id: 'ai-config-question-1',
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  baseUrl: 'https://ai.example.test/v1',
  apiKey: 'sk-question-secret',
}

const report: QuantResearchReport = {
  reportVersion: 'research-report-v2',
  tsCode: '601899.SH',
  name: '紫金矿业',
  generatedAt: '2026-08-29T00:00:00.000Z',
  sourceSnapshotId: 'snapshot-question-1',
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
    source: 'Quant fixture',
    observedAt: '2026-08-28',
    formulaVersion: 'fixture-v1',
    detail: '最近一期 ROE 达到研究门槛。',
  }],
  sources: [{
    id: 'fixture',
    name: 'Quant fixture',
    observedAt: '2026-08-28',
    formulaVersion: 'fixture-v1',
  }],
}

function response(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function validContent(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    answer: '报告显示 ROE 为 18%，达到当前报告列出的至少 10% 门槛；仍需结合报告中的其他限制继续核对。',
    citedEvidenceKeys: ['quality-roe'],
    ...overrides,
  })
}

describe('quant AI question', () => {
  it('answers a bounded report question and keeps the API key out of the prompt', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent()))

    await expect(generateQuantAiQuestion({
      report,
      question: ' ROE 是否达到报告门槛？ ',
      config,
      fetchImpl,
    })).resolves.toMatchObject({
      questionVersion: 'research-question-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generatedAt: expect.any(String),
      question: 'ROE 是否达到报告门槛？',
      answer: expect.stringContaining('18%'),
      citedEvidenceKeys: ['quality-roe'],
    })

    expect(fetchImpl).toHaveBeenCalledWith('https://ai.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-question-secret' }),
    }))
    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[1]?.content).toContain('quality-roe')
    expect(requestBody.messages[1]?.content).toContain('ROE 是否达到报告门槛')
    expect(requestBody.messages[1]?.content).not.toContain('sk-question-secret')
  })

  it('classifies configuration, timeout, upstream and invalid responses independently', async () => {
    const missingConfigFetch = vi.fn<typeof fetch>()
    await expect(generateQuantAiQuestion({ report, question: '问题', config: { ...config, apiKey: null }, fetchImpl: missingConfigFetch })).rejects.toMatchObject({
      code: 'QUANT_AI_QUESTION_CONFIGURATION',
      status: 503,
    })
    expect(missingConfigFetch).not.toHaveBeenCalled()

    for (const status of [408, 504]) {
      const timeoutResponse = vi.fn<typeof fetch>().mockResolvedValue(response('', status))
      await expect(generateQuantAiQuestion({ report, question: '问题', config, fetchImpl: timeoutResponse })).rejects.toMatchObject({
        code: 'QUANT_AI_QUESTION_TIMEOUT',
        status: 504,
      })
    }

    const upstream = vi.fn<typeof fetch>().mockResolvedValue(response('', 500))
    await expect(generateQuantAiQuestion({ report, question: '问题', config, fetchImpl: upstream })).rejects.toMatchObject({
      code: 'QUANT_AI_QUESTION_UPSTREAM',
      status: 502,
    })

    const network = vi.fn<typeof fetch>().mockRejectedValue(new Error('network fixture'))
    await expect(generateQuantAiQuestion({ report, question: '问题', config, fetchImpl: network })).rejects.toMatchObject({
      code: 'QUANT_AI_QUESTION_UPSTREAM',
      status: 502,
    })
  })

  it('rejects unknown fields, unknown citations, empty or long answers and trading language', async () => {
    const cases: Record<string, unknown>[] = [
      { ...JSON.parse(validContent()), extra: true },
      JSON.parse(validContent({ citedEvidenceKeys: ['made-up-key'] })),
      JSON.parse(validContent({ answer: '' })),
      JSON.parse(validContent({ answer: 'x'.repeat(8_001) })),
      JSON.parse(validContent({ answer: '建议买入并设置目标价。' })),
      JSON.parse(validContent({ answer: 'The report supports a buy recommendation.' })),
    ]
    for (const value of cases) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(JSON.stringify(value)))
      await expect(generateQuantAiQuestion({ report, question: '问题', config, fetchImpl })).rejects.toMatchObject({
        code: 'QUANT_AI_QUESTION_INVALID_RESPONSE',
        status: 502,
      })
    }
  })

  it('classifies an aborted request as a timeout and keeps the prompt bounded', async () => {
    const timeoutFetch = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>((_resolve, reject) => {
      setTimeout(() => reject(new Error('fixture timeout')), 20)
    }))
    await expect(generateQuantAiQuestion({ report, question: '问题', config, timeoutMs: 5, fetchImpl: timeoutFetch })).rejects.toMatchObject({
      code: 'QUANT_AI_QUESTION_TIMEOUT',
      status: 504,
    })

    const oversized = {
      ...report,
      headline: 'x'.repeat(20_000),
      evidence: report.evidence.map(item => ({ ...item, detail: 'x'.repeat(20_000) })),
    }
    const prompt = buildQuantAiQuestionPrompt(oversized, '解释这份报告')
    expect(prompt.length).toBeLessThanOrEqual(16_000)
    expect(prompt).toContain('quality-roe')
  })
})
