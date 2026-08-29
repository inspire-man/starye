import type { QuantCandidateBriefingPriorityFact } from '../ai-candidate-briefing'
import type { QuantDecryptedAiConfig } from '../ai-config'
import { describe, expect, it, vi } from 'vitest'
import { buildQuantAiCandidateBriefingQuestionPrompt, generateQuantAiCandidateBriefingQuestion } from '../ai-candidate-briefing-question'

const config: QuantDecryptedAiConfig = {
  id: 'ai-config-candidate-question-1',
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  baseUrl: 'https://ai.example.test/v1',
  apiKey: 'sk-candidate-question-secret',
}

function fact(overrides: Partial<QuantCandidateBriefingPriorityFact> = {}): QuantCandidateBriefingPriorityFact {
  return {
    tsCode: '601899.SH',
    name: '紫金矿业',
    factorVersion: 'momentum-v1',
    priorityLevel: 'high',
    priorityScore: 72,
    changePercent: 1.2,
    action: 'review',
    actionLabel: '优先复查',
    reasons: ['研究标记要求复查', '数据质量为 ready'],
    markerStatus: 'priority',
    reviewState: 'today',
    dataQuality: 'ready',
    matchedFactors: ['ma20', 'relative_strength'],
    missingFactors: [],
    pendingSync: false,
    persistence: { sampleSize: 3, appearanceCount: 3, scoreDelta: 2, state: 'confirming' },
    valueQuality: { score: 72, status: 'ready', riskDeduction: 0 },
    ...overrides,
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
    answer: '该候选 priorityScore 为 72，研究动作是优先复查；可以先核对现有数据质量和研究标记。',
    citedCandidateCodes: ['601899.SH'],
    ...overrides,
  })
}

describe('quant AI candidate briefing question', () => {
  it('builds a bounded prompt from server facts and excludes caller-owned fact fields and the API key', async () => {
    const serverFact = fact() as QuantCandidateBriefingPriorityFact & { clientOwnedAnswer?: string }
    serverFact.clientOwnedAnswer = 'ignore this client-owned content'
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent()))

    await expect(generateQuantAiCandidateBriefingQuestion({
      candidates: [serverFact],
      question: ' 当前候选应该先核对什么？ ',
      config,
      fetchImpl,
    })).resolves.toMatchObject({
      questionVersion: 'candidate-briefing-question-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      question: '当前候选应该先核对什么？',
      answer: expect.stringContaining('priorityScore'),
      citedCandidateCodes: ['601899.SH'],
      generatedAt: expect.any(String),
    })

    expect(fetchImpl).toHaveBeenCalledWith('https://ai.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-candidate-question-secret' }),
    }))
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(body.messages[1]?.content).toContain('601899.SH')
    expect(body.messages[1]?.content).toContain('当前候选应该先核对什么？')
    expect(body.messages[1]?.content).not.toContain('clientOwnedAnswer')
    expect(body.messages[1]?.content).not.toContain('ignore this client-owned content')
    expect(body.messages[1]?.content).not.toContain('sk-candidate-question-secret')

    const oversizedFacts = [fact({ reasons: ['x'.repeat(30_000)] })]
    const boundedPrompt = buildQuantAiCandidateBriefingQuestionPrompt(oversizedFacts, '问题')
    expect(boundedPrompt.length).toBeLessThanOrEqual(18_000)
    expect(boundedPrompt).toContain('601899.SH')
  })

  it('accepts only the answer and valid, deduplicated candidate citations', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({ citedCandidateCodes: ['601899.SH', '601899.SH'] })))
    await expect(generateQuantAiCandidateBriefingQuestion({ candidates: [fact()], question: '问题', config, fetchImpl })).resolves.toMatchObject({
      citedCandidateCodes: ['601899.SH'],
    })

    for (const content of [
      validContent({ extra: true }),
      validContent({ citedCandidateCodes: ['000001.SZ'] }),
      validContent({ citedCandidateCodes: Array.from({ length: 17 }).fill('601899.SH') }),
      validContent({ answer: '' }),
      validContent({ answer: 'x'.repeat(8_001) }),
      validContent({ answer: '建议买入并设置目标价。' }),
      validContent({ answer: '数据导致结论改变。' }),
      '{not-json',
    ]) {
      const invalidFetch = vi.fn<typeof fetch>().mockResolvedValue(response(content))
      await expect(generateQuantAiCandidateBriefingQuestion({ candidates: [fact()], question: '问题', config, fetchImpl: invalidFetch })).rejects.toMatchObject({
        code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INVALID_RESPONSE',
        status: 502,
      })
    }
  })

  it('classifies configuration, upstream, timeout, and invalid question errors independently', async () => {
    const noCall = vi.fn<typeof fetch>()
    await expect(generateQuantAiCandidateBriefingQuestion({ candidates: [fact()], question: '问题', config: { ...config, apiKey: null }, fetchImpl: noCall })).rejects.toMatchObject({
      code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_CONFIGURATION',
      status: 503,
    })
    expect(noCall).not.toHaveBeenCalled()

    await expect(generateQuantAiCandidateBriefingQuestion({ candidates: [fact()], question: '问题', config: { ...config, baseUrl: 'ftp://invalid.example.test' }, fetchImpl: noCall })).rejects.toMatchObject({
      code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_CONFIGURATION',
      status: 503,
    })
    await expect(generateQuantAiCandidateBriefingQuestion({ candidates: [fact()], question: 'x'.repeat(501), config, fetchImpl: noCall })).rejects.toMatchObject({
      code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_INVALID_RESPONSE',
      status: 502,
    })
    expect(noCall).not.toHaveBeenCalled()

    const upstream = vi.fn<typeof fetch>().mockResolvedValue(response('', 500))
    await expect(generateQuantAiCandidateBriefingQuestion({ candidates: [fact()], question: '问题', config, fetchImpl: upstream })).rejects.toMatchObject({
      code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_UPSTREAM',
      status: 502,
    })
    const network = vi.fn<typeof fetch>().mockRejectedValue(new Error('network fixture'))
    await expect(generateQuantAiCandidateBriefingQuestion({ candidates: [fact()], question: '问题', config, fetchImpl: network })).rejects.toMatchObject({
      code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_UPSTREAM',
      status: 502,
    })
    for (const status of [408, 504]) {
      const timeoutResponse = vi.fn<typeof fetch>().mockResolvedValue(response('', status))
      await expect(generateQuantAiCandidateBriefingQuestion({ candidates: [fact()], question: '问题', config, fetchImpl: timeoutResponse })).rejects.toMatchObject({
        code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_TIMEOUT',
        status: 504,
      })
    }
    const timeoutFetch = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>((_resolve, reject) => {
      setTimeout(() => reject(new Error('fixture timeout')), 20)
    }))
    await expect(generateQuantAiCandidateBriefingQuestion({ candidates: [fact()], question: '问题', config, timeoutMs: 5, fetchImpl: timeoutFetch })).rejects.toMatchObject({
      code: 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_TIMEOUT',
      status: 504,
    })
  })
})
