import type { QuantResearchRun } from '../quant-types'
import type { BatchResearchFollowUpState } from '../research-batch-follow-up'
import { describe, expect, it } from 'vitest'
import { applyBatchResearchProgress, getBatchResearchItemAction, markBatchResearchItemPending } from '../research-batch-follow-up'

function researchRun(tsCode: string): QuantResearchRun {
  return {
    id: `run-${tsCode}`,
    tsCode,
    name: null,
    reportVersion: 'research-report-v2',
    sourceSnapshotId: null,
    generatedAt: '2026-08-28T08:00:00.000Z',
    createdAt: '2026-08-28T08:00:00.000Z',
    status: 'ready',
    report: {
      reportVersion: 'research-report-v2',
      tsCode,
      name: null,
      generatedAt: '2026-08-28T08:00:00.000Z',
      sourceSnapshotId: null,
      status: 'ready',
      action: 'research-window',
      score: 80,
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

function state(status: BatchResearchFollowUpState['status'], run: QuantResearchRun | null = null, error: unknown | null = null): BatchResearchFollowUpState {
  return { status, run, error }
}

describe('research batch follow-up state', () => {
  it('only exposes view for a successful result with a run and retry for an error', () => {
    expect(getBatchResearchItemAction(state('success', researchRun('A')))).toBe('view')
    expect(getBatchResearchItemAction(state('success'))).toBeNull()
    expect(getBatchResearchItemAction(state('error', null, new Error('failed')))).toBe('retry')
    expect(getBatchResearchItemAction(state('pending'))).toBeNull()
    expect(getBatchResearchItemAction(state('running'))).toBeNull()
  })

  it('marks only the failed candidate pending and clears stale error data', () => {
    const states = {
      A: state('error', null, new Error('A failed')),
      B: state('success', researchRun('B')),
    }

    const next = markBatchResearchItemPending(states, 'A')

    expect(next.A).toEqual({ status: 'pending', run: null, error: null })
    expect(next.B).toEqual(states.B)
    expect(markBatchResearchItemPending(next, 'A')).toEqual(next)
  })

  it('applies progress to one candidate while retaining the previous run payload', () => {
    const states = {
      A: state('running', researchRun('A')),
      B: state('error', null, new Error('B failed')),
    }

    const next = applyBatchResearchProgress(states, { tsCode: 'A', status: 'success' })

    expect(next.A).toEqual({ status: 'success', run: states.A.run, error: null })
    expect(next.B).toEqual(states.B)
  })
})
