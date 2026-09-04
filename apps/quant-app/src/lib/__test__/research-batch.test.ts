import type { QuantResearchRun } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { MAX_BATCH_RESEARCH_CONCURRENCY, MAX_BATCH_RESEARCH_ITEMS, runResearchBatch } from '../research-batch'

function researchRun(tsCode: string, status: QuantResearchRun['status'] = 'ready'): QuantResearchRun {
  return {
    id: `run-${tsCode}`,
    tsCode,
    name: null,
    reportVersion: 'research-report-v2',
    sourceSnapshotId: null,
    generatedAt: '2026-08-27T08:00:00.000Z',
    createdAt: '2026-08-27T08:00:00.000Z',
    status,
    report: {
      reportVersion: 'research-report-v2',
      tsCode,
      name: null,
      generatedAt: '2026-08-27T08:00:00.000Z',
      sourceSnapshotId: null,
      status,
      action: status === 'ready' ? 'research-window' : 'complete-data',
      score: status === 'ready' ? 78 : null,
      headline: '研究报告',
      strengths: [],
      risks: [],
      gaps: [],
      nextActions: [],
      evidence: [],
      sources: [],
    },
  }
}

describe('runResearchBatch', () => {
  it('keeps stable input order and reports each lifecycle state', async () => {
    const progress: string[] = []
    const results = await runResearchBatch(
      ['600089.SH', '601899.SH'],
      async tsCode => researchRun(tsCode),
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

  it('continues other candidates after an individual failure', async () => {
    const results = await runResearchBatch(['A', 'B', 'C'], async (tsCode) => {
      if (tsCode === 'B')
        throw new Error('B failed')
      return researchRun(tsCode)
    })

    expect(results).toHaveLength(3)
    expect(results.map(result => result.status)).toEqual(['success', 'error', 'success'])
    expect(results[1]?.error).toBeInstanceOf(Error)
    expect(results[2]?.run?.tsCode).toBe('C')
  })

  it('caps items and concurrent runners even when a larger value is requested', async () => {
    let active = 0
    let maximumActive = 0
    const requested = Array.from({ length: MAX_BATCH_RESEARCH_ITEMS + 2 }, (_, index) => `CODE-${index}`)
    const results = await runResearchBatch(requested, async (tsCode) => {
      active++
      maximumActive = Math.max(maximumActive, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active--
      return researchRun(tsCode)
    }, () => {}, 99)

    expect(results).toHaveLength(MAX_BATCH_RESEARCH_ITEMS)
    expect(maximumActive).toBeLessThanOrEqual(MAX_BATCH_RESEARCH_CONCURRENCY)
  })
})
