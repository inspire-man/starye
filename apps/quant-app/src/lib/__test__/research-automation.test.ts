import type { QuantResearchRun, QuantResearchSummary } from '../quant-types'
import { describe, expect, it, vi } from 'vitest'
import {
  applyAutomatedResearchProgress,
  automatedResearchErrorCode,
  initialAutomatedResearchStates,
  runAutomatedResearch,
} from '../research-automation'

function run(tsCode: string): QuantResearchRun {
  return {
    id: `run-${tsCode}`,
    tsCode,
    name: tsCode,
    status: 'ready',
    reportVersion: 'research-report-v2',
    sourceSnapshotId: null,
    generatedAt: '2026-08-30T00:00:00.000Z',
    createdAt: '2026-08-30T00:00:00.000Z',
    report: {} as QuantResearchRun['report'],
  }
}

function summary(runId: string): QuantResearchSummary {
  return {
    id: `summary-${runId}`,
    researchRunId: runId,
    summaryVersion: 'research-summary-v2',
    reportVersion: 'research-report-v2',
    provider: 'openai_compatible',
    model: 'gpt-5.4',
    generatedAt: '2026-08-30T00:01:00.000Z',
    createdAt: '2026-08-30T00:01:00.000Z',
    summary: {
      summaryVersion: 'research-summary-v2',
      overview: '已复核',
      supports: [],
      concerns: [],
      nextChecks: [],
      citedEvidenceKeys: [],
      factorReviews: [],
    },
    citedEvidenceKeys: [],
  }
}

describe('runAutomatedResearch', () => {
  it('deduplicates and caps targets, preserving stage order and AI persistence', async () => {
    const events: string[] = []
    const ensureWatchlist = vi.fn(async ({ tsCode }: { tsCode: string }) => {
      events.push(`${tsCode}:watchlist`)
    })
    const generateResearch = vi.fn(async ({ tsCode }: { tsCode: string }) => {
      events.push(`${tsCode}:research`)
      return run(tsCode)
    })
    const generateAiSummary = vi.fn(async (researchRun: QuantResearchRun) => {
      events.push(`${researchRun.tsCode}:ai`)
      return summary(researchRun.id)
    })
    const progress: string[] = []

    const results = await runAutomatedResearch([
      { tsCode: '601899.SH', name: '紫金矿业' },
      { tsCode: '601899.SH', name: '重复项' },
      { tsCode: '000001.SZ', name: '平安银行' },
      { tsCode: '600000.SH', name: '超出上限' },
    ], { aiReady: true, ensureWatchlist, generateResearch, generateAiSummary }, (item) => {
      progress.push(`${item.candidate.tsCode}:${item.stage}:${item.aiStatus}`)
    })

    expect(results).toHaveLength(3)
    expect(events).toEqual([
      '601899.SH:watchlist',
      '601899.SH:research',
      '601899.SH:ai',
      '000001.SZ:watchlist',
      '000001.SZ:research',
      '000001.SZ:ai',
      '600000.SH:watchlist',
      '600000.SH:research',
      '600000.SH:ai',
    ])
    expect(results.every(item => item.status === 'completed' && item.summary)).toBe(true)
    expect(progress).toContain('601899.SH:completed:success')
  })

  it('keeps a saved report visible when AI fails and continues with later targets', async () => {
    const states = initialAutomatedResearchStates([
      { tsCode: '601899.SH', name: '紫金矿业' },
      { tsCode: '000001.SZ', name: '平安银行' },
    ])
    const updated: string[] = []
    const results = await runAutomatedResearch([
      { tsCode: '601899.SH', name: '紫金矿业' },
      { tsCode: '000001.SZ', name: '平安银行' },
    ], {
      aiReady: true,
      ensureWatchlist: async () => {},
      generateResearch: async candidate => run(candidate.tsCode),
      generateAiSummary: async (researchRun) => {
        if (researchRun.tsCode === '601899.SH')
          throw new Error('AI upstream')
        return summary(researchRun.id)
      },
    }, (item) => {
      const next = applyAutomatedResearchProgress(states, item)
      states[item.candidate.tsCode] = next[item.candidate.tsCode]!
      updated.push(`${item.candidate.tsCode}:${item.stage}`)
    })

    expect(results[0]).toMatchObject({ status: 'error', errorStage: 'ai', aiStatus: 'error', run: { tsCode: '601899.SH' } })
    expect(results[1]).toMatchObject({ status: 'completed', aiStatus: 'success', summary: { researchRunId: 'run-000001.SZ' } })
    expect(states['601899.SH']).toMatchObject({ stage: 'error', errorStage: 'ai', run: { tsCode: '601899.SH' } })
    expect(updated).toContain('000001.SZ:completed')
  })

  it('marks AI as skipped when no AI configuration is ready', async () => {
    const result = await runAutomatedResearch([{ tsCode: '601899.SH', name: null }], {
      aiReady: false,
      ensureWatchlist: async () => {},
      generateResearch: async candidate => run(candidate.tsCode),
      generateAiSummary: vi.fn(),
    })

    expect(result[0]).toMatchObject({ status: 'completed', aiStatus: 'skipped', run: { tsCode: '601899.SH' } })
  })
})

describe('automatedResearchErrorCode', () => {
  it('returns only bounded structured error codes', () => {
    expect(automatedResearchErrorCode({ code: 'QUANT_AI_SUMMARY_UPSTREAM' })).toBe('QUANT_AI_SUMMARY_UPSTREAM')
    expect(automatedResearchErrorCode({ code: '  QUANT_RESEARCH_TIMEOUT  ' })).toBe('QUANT_RESEARCH_TIMEOUT')
  })

  it('rejects unstructured, oversized and unsafe values', () => {
    expect(automatedResearchErrorCode(null)).toBeNull()
    expect(automatedResearchErrorCode(new Error('raw upstream message'))).toBeNull()
    expect(automatedResearchErrorCode({ code: '' })).toBeNull()
    expect(automatedResearchErrorCode({ code: 'quant_ai_failure' })).toBeNull()
    expect(automatedResearchErrorCode({ code: 'QUANT AI FAILURE' })).toBeNull()
    expect(automatedResearchErrorCode({ code: `QUANT_${'X'.repeat(100)}` })).toBeNull()
  })
})
