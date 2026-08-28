import type { QuantCandidateBriefingCandidate, QuantCandidateBriefingMarker } from '../ai-candidate-briefing'
import type { QuantDecryptedAiConfig } from '../ai-config'
import { describe, expect, it, vi } from 'vitest'
import { buildQuantAiCandidateBriefingPrompt, buildQuantCandidateBriefingFacts, generateQuantAiCandidateBriefing } from '../ai-candidate-briefing'

const config: QuantDecryptedAiConfig = {
  id: 'ai-config-candidate-1',
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  baseUrl: 'https://ai.example.test/v1',
  apiKey: 'sk-candidate-secret',
}

function candidate(overrides: Partial<QuantCandidateBriefingCandidate> = {}): QuantCandidateBriefingCandidate {
  return {
    tsCode: '601899.SH',
    name: '紫金矿业',
    factorVersion: 'momentum-v1',
    score: 4,
    changePercent: 0.5,
    dataQuality: 'ready',
    matchedFactors: ['ma20', 'relative_strength'],
    missingFactors: [],
    pendingSync: false,
    pendingReason: null,
    factors: { consecutiveUpDays: 2, volumeRatio: 1.4, return20: 0.08 },
    persistence: { sampleSize: 3, appearanceCount: 3, scoreDelta: 1, state: 'confirming' },
    valueQuality: { score: 72, status: 'ready', riskDeduction: 0 },
    ...overrides,
  }
}

function marker(overrides: Partial<QuantCandidateBriefingMarker> = {}): QuantCandidateBriefingMarker {
  return {
    tsCode: '601899.SH',
    status: 'unreviewed',
    reviewDate: null,
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
    overview: '当前候选按优先级先核对数据完整性和风险，再继续查看价值质量。',
    focusItems: [{ tsCode: '601899.SH', explanation: '该候选的确定性原因包括持续信号，建议先回看现有数据和研究记录。' }],
    nextChecks: ['复核候选数据截至日期', '确认研究标记和价值质量口径'],
    citedCandidateCodes: ['601899.SH'],
    ...overrides,
  })
}

describe('quant AI candidate briefing', () => {
  it('builds deterministic server-side priority facts with marker and value quality data', () => {
    const facts = buildQuantCandidateBriefingFacts([
      candidate({ valueQuality: { score: 42, status: 'ready', riskDeduction: 0 } }),
      candidate({ tsCode: '000001.SZ', name: '平安银行', score: 1, valueQuality: null }),
    ], [marker({ status: 'priority', reviewDate: '2099-01-01' })], '2026-08-29')

    expect(facts[0]).toMatchObject({
      tsCode: '601899.SH',
      priorityLevel: 'normal',
      action: 'check-value',
      actionLabel: '补看价值质量',
      valueQuality: { score: 42 },
      markerStatus: 'priority',
    })
    expect(facts[0]?.reasons).toEqual(expect.arrayContaining(['已标记为重点关注', '价值质量 42.0 分，先核对低分维度']))
    expect(buildQuantAiCandidateBriefingPrompt(facts).length).toBeLessThanOrEqual(18_000)
  })

  it('generates a bounded briefing and restores server facts onto AI focus items', async () => {
    const facts = buildQuantCandidateBriefingFacts([candidate()], [marker()], '2026-08-29')
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent()))

    await expect(generateQuantAiCandidateBriefing({ candidates: facts, config, fetchImpl })).resolves.toMatchObject({
      briefingVersion: 'candidate-briefing-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      focusItems: [{
        tsCode: '601899.SH',
        name: '紫金矿业',
        priorityLevel: facts[0]!.priorityLevel,
        priorityScore: facts[0]!.priorityScore,
        actionLabel: facts[0]!.actionLabel,
        reasons: facts[0]!.reasons,
      }],
      citedCandidateCodes: ['601899.SH'],
    })

    expect(fetchImpl).toHaveBeenCalledWith('https://ai.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-candidate-secret' }),
    }))
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(body.messages[1]?.content).toContain('601899.SH')
    expect(body.messages[1]?.content).not.toContain('sk-candidate-secret')
  })

  it('rejects unknown fields, unknown candidate codes, trading conclusions, and causal claims', async () => {
    const facts = buildQuantCandidateBriefingFacts([candidate()], [marker()], '2026-08-29')
    for (const overrides of [
      { unexpected: true },
      { focusItems: [{ tsCode: '000001.SZ', explanation: '候选说明' }] },
      { overview: '建议买入', focusItems: [], nextChecks: [], citedCandidateCodes: [] },
      { overview: '数据导致结论改变', focusItems: [], nextChecks: [], citedCandidateCodes: [] },
    ]) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent(overrides)))
      await expect(generateQuantAiCandidateBriefing({ candidates: facts, config, fetchImpl })).rejects.toMatchObject({
        code: 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE',
        status: 502,
      })
    }
  })

  it('classifies empty input, configuration, upstream, and timeout errors', async () => {
    const emptyFetch = vi.fn<typeof fetch>()
    await expect(generateQuantAiCandidateBriefing({ candidates: [], config, fetchImpl: emptyFetch })).rejects.toMatchObject({
      code: 'QUANT_AI_CANDIDATE_BRIEFING_INPUT',
      status: 422,
    })
    expect(emptyFetch).not.toHaveBeenCalled()

    const facts = buildQuantCandidateBriefingFacts([candidate()], [marker()], '2026-08-29')
    await expect(generateQuantAiCandidateBriefing({ candidates: facts, config: { ...config, apiKey: null }, fetchImpl: emptyFetch })).rejects.toMatchObject({
      code: 'QUANT_AI_CANDIDATE_BRIEFING_CONFIGURATION',
      status: 503,
    })
    await expect(generateQuantAiCandidateBriefing({ candidates: facts, config, fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response('', 503)) })).rejects.toMatchObject({
      code: 'QUANT_AI_CANDIDATE_BRIEFING_UPSTREAM',
      status: 502,
    })

    const timeoutFetch = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    await expect(generateQuantAiCandidateBriefing({ candidates: facts, config, timeoutMs: 5, fetchImpl: timeoutFetch })).rejects.toMatchObject({
      code: 'QUANT_AI_CANDIDATE_BRIEFING_TIMEOUT',
      status: 504,
    })
  })
})
