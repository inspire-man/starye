import type { QuantResearchSummary } from '../quant-types'
import type { BatchAiSummaryState } from '../research-batch-ai-summary'
import { describe, expect, it } from 'vitest'
import {
  applyBatchAiSummaryProgress,
  idleBatchAiSummaryState,
  markBatchAiSummaryItemPending,
  MAX_BATCH_AI_SUMMARY_CONCURRENCY,
  MAX_BATCH_AI_SUMMARY_ITEMS,
  runResearchAiSummaryBatch,
} from '../research-batch-ai-summary'

function summary(runId: string): QuantResearchSummary {
  return {
    id: `summary-${runId}`,
    researchRunId: runId,
    summaryVersion: 'research-summary-v1',
    reportVersion: 'research-report-v2',
    provider: 'openai_compatible',
    model: 'gpt-test',
    generatedAt: '2026-08-28T08:00:00.000Z',
    createdAt: '2026-08-28T08:00:00.000Z',
    summary: {
      summaryVersion: 'research-summary-v1',
      overview: '摘要',
      supports: [],
      concerns: [],
      nextChecks: [],
      citedEvidenceKeys: [],
      factorReviews: [],
    },
    citedEvidenceKeys: [],
  }
}

function state(status: BatchAiSummaryState['status'], value: QuantResearchSummary | null = null, error: unknown | null = null): BatchAiSummaryState {
  return { status, summary: value, error }
}

describe('runResearchAiSummaryBatch', () => {
  it('keeps stable candidate order and reports each lifecycle state', async () => {
    const progress: string[] = []
    const results = await runResearchAiSummaryBatch(
      [{ tsCode: '600089.SH', runId: 'run-a' }, { tsCode: '601899.SH', runId: 'run-b' }],
      async candidate => summary(candidate.runId),
      ({ tsCode, status }) => progress.push(`${tsCode}:${status}`),
      1,
    )

    expect(results.map(result => result.tsCode)).toEqual(['600089.SH', '601899.SH'])
    expect(progress).toEqual([
      '600089.SH:pending',
      '601899.SH:pending',
      '600089.SH:running',
      '600089.SH:success',
      '601899.SH:running',
      '601899.SH:success',
    ])
  })

  it('continues after one failure and keeps the failed result attached to its run', async () => {
    const results = await runResearchAiSummaryBatch([
      { tsCode: 'A', runId: 'run-a' },
      { tsCode: 'B', runId: 'run-b' },
      { tsCode: 'C', runId: 'run-c' },
    ], async (candidate) => {
      if (candidate.tsCode === 'B')
        throw new Error('B failed')
      return summary(candidate.runId)
    })

    expect(results.map(result => result.status)).toEqual(['success', 'error', 'success'])
    expect(results[1]?.runId).toBe('run-b')
    expect(results[1]?.error).toBeInstanceOf(Error)
    expect(results[2]?.summary?.researchRunId).toBe('run-c')
  })

  it('caps duplicate candidates and concurrent runners', async () => {
    let active = 0
    let maximumActive = 0
    const candidates = Array.from({ length: MAX_BATCH_AI_SUMMARY_ITEMS + 2 }, (_, index) => ({
      tsCode: index === 1 ? 'CODE-0' : `CODE-${index}`,
      runId: `run-${index}`,
    }))
    const results = await runResearchAiSummaryBatch(candidates, async (candidate) => {
      active++
      maximumActive = Math.max(maximumActive, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active--
      return summary(candidate.runId)
    }, () => {}, 99)

    expect(results).toHaveLength(MAX_BATCH_AI_SUMMARY_ITEMS)
    expect(results.map(result => result.tsCode)).toEqual(['CODE-0', 'CODE-2', 'CODE-3'])
    expect(maximumActive).toBeLessThanOrEqual(MAX_BATCH_AI_SUMMARY_CONCURRENCY)
  })
})

describe('batch AI summary state', () => {
  it('updates one item and preserves another item', () => {
    const states = {
      A: state('running'),
      B: state('success', summary('run-b')),
    }

    const next = applyBatchAiSummaryProgress(states, {
      tsCode: 'A',
      runId: 'run-a',
      status: 'success',
      summary: summary('run-a'),
    })

    expect(next.A).toEqual(state('success', summary('run-a')))
    expect(next.B).toEqual(states.B)
  })

  it('resets only an errored item for retry', () => {
    const states = {
      A: state('error', null, new Error('A failed')),
      B: state('success', summary('run-b')),
    }

    const next = markBatchAiSummaryItemPending(states, 'A')

    expect(next.A).toEqual(state('pending'))
    expect(next.B).toEqual(states.B)
    expect(markBatchAiSummaryItemPending(next, 'A')).toEqual(next)
    expect(idleBatchAiSummaryState()).toEqual(state('idle'))
  })
})
