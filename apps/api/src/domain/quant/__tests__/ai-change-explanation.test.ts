import type { QuantDecryptedAiConfig } from '../ai-config'
import type { QuantResearchEvidence, QuantResearchReport } from '../research-report'
import { describe, expect, it, vi } from 'vitest'
import { buildQuantAiChangeExplanationPrompt, generateQuantAiChangeExplanation } from '../ai-change-explanation'

const config: QuantDecryptedAiConfig = {
  id: 'ai-config-change-1',
  provider: 'openai_compatible',
  model: 'gpt-5.4',
  baseUrl: 'https://ai.example.test/v1',
  apiKey: 'sk-change-secret',
}

function evidence(key: string, status: QuantResearchEvidence['status'], value: number | null, source = 'Quant fixture', formulaVersion = 'fixture-v1'): QuantResearchEvidence {
  return {
    key,
    dimension: 'quality',
    label: key === 'quality-roe' ? 'ROE' : key,
    status,
    value,
    threshold: '至少 10%',
    source,
    observedAt: '2026-08-29',
    formulaVersion,
    detail: '来自已保存报告的事实。',
  }
}

function report(generatedAt: string, evidenceItems: QuantResearchEvidence[], tsCode = '601899.SH'): QuantResearchReport {
  return {
    reportVersion: 'research-report-v2',
    tsCode,
    name: '紫金矿业',
    generatedAt,
    sourceSnapshotId: null,
    status: 'partial',
    action: 'wait-confirmation',
    score: 72,
    headline: '部分证据需要确认',
    strengths: [],
    risks: [],
    gaps: [],
    nextActions: [],
    evidence: evidenceItems,
    sources: [],
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
    overview: '本次报告中的 ROE 状态由注意变为通过，仍需确认两期数据口径。',
    changes: [{ evidenceKey: 'quality-roe', explanation: 'ROE 从 9 上升到 18，当前状态由注意变为通过；这是报告中的观察差异，不代表因果关系。' }],
    nextChecks: ['人工复核两份报告的来源日期和公式版本'],
    citedEvidenceKeys: ['quality-roe'],
    ...overrides,
  })
}

describe('quant AI change explanation', () => {
  it('generates a bounded same-stock explanation from deterministic evidence changes', async () => {
    const current = report('2026-08-29T00:00:00.000Z', [evidence('quality-roe', 'pass', 18)])
    const previous = report('2026-08-28T00:00:00.000Z', [evidence('quality-roe', 'caution', 9)])
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent()))

    await expect(generateQuantAiChangeExplanation({ currentReport: current, previousReport: previous, config, fetchImpl })).resolves.toMatchObject({
      changeExplanationVersion: 'research-change-explanation-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      currentGeneratedAt: current.generatedAt,
      previousGeneratedAt: previous.generatedAt,
      changes: [{ evidenceKey: 'quality-roe', kind: 'improved', label: 'ROE' }],
      citedEvidenceKeys: ['quality-roe'],
    })

    expect(fetchImpl).toHaveBeenCalledWith('https://ai.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-change-secret' }),
    }))
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(body.messages[1]?.content).toContain('quality-roe')
    expect(body.messages[1]?.content).toContain('状态改善')
    expect(body.messages[1]?.content).not.toContain('sk-change-secret')
    expect(buildQuantAiChangeExplanationPrompt(current, previous).length).toBeLessThanOrEqual(18_000)
  })

  it('preserves provenance changes as an incomparable evidence item', async () => {
    const current = report('2026-08-29T00:00:00.000Z', [evidence('quality-roe', 'pass', 18, 'Source B', 'fixture-v2')])
    const previous = report('2026-08-28T00:00:00.000Z', [evidence('quality-roe', 'pass', 18, 'Source A', 'fixture-v1')])
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent({
      changes: [{ evidenceKey: 'quality-roe', explanation: '来源和公式版本不同，本次变化只能作为口径核对线索。' }],
    })))

    await expect(generateQuantAiChangeExplanation({ currentReport: current, previousReport: previous, config, fetchImpl })).resolves.toMatchObject({
      changes: [{ evidenceKey: 'quality-roe', kind: 'incomparable', kindLabel: '口径变化' }],
    })
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(body.messages[1]?.content).toContain('fixture-v1')
    expect(body.messages[1]?.content).toContain('fixture-v2')
  })

  it('rejects unknown fields, unknown keys, trading conclusions, and unsupported causal claims', async () => {
    const current = report('2026-08-29T00:00:00.000Z', [evidence('quality-roe', 'pass', 18)])
    const previous = report('2026-08-28T00:00:00.000Z', [evidence('quality-roe', 'caution', 9)])
    for (const overrides of [
      { unexpected: true },
      { changes: [{ evidenceKey: 'made-up-key', explanation: '变化说明' }] },
      { overview: '建议买入', changes: [], nextChecks: [], citedEvidenceKeys: [] },
      { overview: '变化导致结论改变', changes: [], nextChecks: [], citedEvidenceKeys: [] },
      { overview: '由于数据变化，因此需要关注', changes: [], nextChecks: [], citedEvidenceKeys: [] },
    ]) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(validContent(overrides)))
      await expect(generateQuantAiChangeExplanation({ currentReport: current, previousReport: previous, config, fetchImpl })).rejects.toMatchObject({
        code: 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE',
        status: 502,
      })
    }
  })

  it('classifies missing configuration, upstream errors, and timeouts', async () => {
    const current = report('2026-08-29T00:00:00.000Z', [evidence('quality-roe', 'pass', 18)])
    const previous = report('2026-08-28T00:00:00.000Z', [evidence('quality-roe', 'caution', 9)])
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response('', 503))
    await expect(generateQuantAiChangeExplanation({ currentReport: current, previousReport: previous, config, fetchImpl })).rejects.toMatchObject({ code: 'QUANT_AI_CHANGE_EXPLANATION_UPSTREAM', status: 502 })
    await expect(generateQuantAiChangeExplanation({ currentReport: current, previousReport: previous, config: { ...config, apiKey: null }, fetchImpl: vi.fn() })).rejects.toMatchObject({ code: 'QUANT_AI_CHANGE_EXPLANATION_CONFIGURATION', status: 503 })
    await expect(generateQuantAiChangeExplanation({ currentReport: current, previousReport: previous, config: { ...config, baseUrl: 'not a url' }, fetchImpl: vi.fn() })).rejects.toMatchObject({ code: 'QUANT_AI_CHANGE_EXPLANATION_CONFIGURATION', status: 503 })

    const timeoutFetch = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    await expect(generateQuantAiChangeExplanation({ currentReport: current, previousReport: previous, config, timeoutMs: 5, fetchImpl: timeoutFetch })).rejects.toMatchObject({ code: 'QUANT_AI_CHANGE_EXPLANATION_TIMEOUT', status: 504 })
  })

  it('rejects reports from different stocks before calling the provider', async () => {
    const current = report('2026-08-29T00:00:00.000Z', [evidence('quality-roe', 'pass', 18)], '601899.SH')
    const previous = report('2026-08-28T00:00:00.000Z', [evidence('quality-roe', 'caution', 9)], '000001.SZ')
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(generateQuantAiChangeExplanation({ currentReport: current, previousReport: previous, config, fetchImpl })).rejects.toMatchObject({ code: 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE', status: 502 })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
