import type { QuantResearchRun } from '../quant-types'
import type { BatchResearchFollowUpState } from '../research-batch-follow-up'
import { describe, expect, it } from 'vitest'
import { hydrateResearchBatchState } from '../research-batch-history'

function run(tsCode: string): QuantResearchRun {
  return {
    id: `run-${tsCode}`,
    tsCode,
    name: null,
    status: 'ready',
    reportVersion: 'research-report-v2',
    sourceSnapshotId: null,
    generatedAt: '2026-08-28T08:00:00.000Z',
    createdAt: '2026-08-28T08:00:00.000Z',
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

function state(status: BatchResearchFollowUpState['status'], value: QuantResearchRun | null = null): BatchResearchFollowUpState {
  return { status, run: value, error: null }
}

describe('research batch history hydration', () => {
  it('hydrates an idle candidate from its latest run', () => {
    expect(hydrateResearchBatchState({ existing: undefined, source: undefined, run: run('A') })).toEqual({
      state: state('success', run('A')),
      source: 'history',
      error: null,
    })
  })

  it('keeps an empty history idle', () => {
    expect(hydrateResearchBatchState({ existing: undefined, source: undefined, run: null })).toEqual({
      state: state('idle'),
      source: undefined,
      error: null,
    })
  })

  it('preserves current batch state over a historical response', () => {
    const current = state('running')

    expect(hydrateResearchBatchState({ existing: current, source: 'batch', run: run('A') })).toEqual({
      state: current,
      source: 'batch',
      error: null,
    })
  })

  it('refreshes a previously hydrated historical state', () => {
    const next = run('A')

    expect(hydrateResearchBatchState({ existing: state('success', run('OLD')), source: 'history', run: next })).toEqual({
      state: state('success', next),
      source: 'history',
      error: null,
    })
  })

  it('preserves the current state while exposing a history read error', () => {
    const current = state('success', run('A'))
    const error = new Error('history unavailable')

    expect(hydrateResearchBatchState({ existing: current, source: 'batch', run: null, error })).toEqual({
      state: current,
      source: 'batch',
      error,
    })
  })

  it('keeps an idle state when the first history read fails', () => {
    const error = new Error('network unavailable')

    expect(hydrateResearchBatchState({ existing: undefined, source: undefined, run: null, error })).toEqual({
      state: state('idle'),
      source: undefined,
      error,
    })
  })
})
