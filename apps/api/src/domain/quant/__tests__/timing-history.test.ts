import type { TimingHistory, TimingHistoryObservation } from '../timing-history'
import { describe, expect, it } from 'vitest'
import { calibrateTimingHistoryEdge, timingHistoryEdgeStatus } from '../timing-history'

function observation(state: TimingHistoryObservation['state'], forwardReturn20: number, index: number): TimingHistoryObservation {
  return {
    anchorDate: `2026-01-${String(index + 1).padStart(2, '0')}`,
    state,
    forwardReturn20,
  }
}

function history(input: {
  readonly currentState: TimingHistory['currentState']
  readonly observations: readonly TimingHistoryObservation[]
}): TimingHistory {
  return {
    availableBars: 200,
    evaluatedWindows: input.observations.length,
    forwardDays: 20,
    samplingInterval: 20,
    minimumReliableSampleSize: 6,
    dataStartDate: '2025-01-01',
    dataEndDate: '2026-01-31',
    evaluationStartDate: input.observations[0]?.anchorDate ?? null,
    evaluationEndDate: input.observations.at(-1)?.anchorDate ?? null,
    currentState: input.currentState,
    currentLabel: input.currentState === 'constructive' ? '结构平稳' : input.currentState,
    observations: input.observations,
    baseline: {
      sampleSize: input.observations.length,
      positiveCount: input.observations.filter(item => item.forwardReturn20 > 0).length,
      positiveRate: null,
      positiveRateLower: null,
      positiveRateUpper: null,
      averageForwardReturn20: null,
      medianForwardReturn20: null,
    },
    buckets: [],
  }
}

describe('calibrateTimingHistoryEdge', () => {
  it('stays insufficient when the current state has fewer than 6 samples', () => {
    const result = calibrateTimingHistoryEdge(history({
      currentState: 'constructive',
      observations: [
        ...Array.from({ length: 5 }, (_, index) => observation('constructive', 0.04, index)),
        ...Array.from({ length: 8 }, (_, index) => observation('weak', -0.03, index + 5)),
      ],
    }))
    expect(result).toMatchObject({ edgeAssessment: 'insufficient', currentSampleSize: 5, complementSampleSize: 8 })
    expect(timingHistoryEdgeStatus(result.edgeAssessment)).toBe('missing')
  })

  it('stays insufficient when the complement has fewer than 6 samples', () => {
    const result = calibrateTimingHistoryEdge(history({
      currentState: 'constructive',
      observations: [
        ...Array.from({ length: 8 }, (_, index) => observation('constructive', 0.04, index)),
        ...Array.from({ length: 5 }, (_, index) => observation('weak', -0.03, index + 8)),
      ],
    }))
    expect(result).toMatchObject({ edgeAssessment: 'insufficient', currentSampleSize: 8, complementSampleSize: 5 })
    expect(timingHistoryEdgeStatus(result.edgeAssessment)).toBe('missing')
  })

  it('maps a fully higher current-state interval to supported', () => {
    const result = calibrateTimingHistoryEdge(history({
      currentState: 'constructive',
      observations: [
        ...Array.from({ length: 12 }, (_, index) => observation('constructive', 0.08, index)),
        ...Array.from({ length: 12 }, (_, index) => observation('weak', -0.06, index + 12)),
      ],
    }))
    expect(result.edgeAssessment).toBe('supported')
    expect(result.positiveRateLift).toBeGreaterThan(0)
    expect(timingHistoryEdgeStatus(result.edgeAssessment)).toBe('pass')
  })

  it('maps overlapping intervals to indeterminate', () => {
    const result = calibrateTimingHistoryEdge(history({
      currentState: 'constructive',
      observations: [
        ...Array.from({ length: 10 }, (_, index) => observation('constructive', index % 2 ? 0.02 : -0.01, index)),
        ...Array.from({ length: 10 }, (_, index) => observation('weak', index % 2 ? 0.02 : -0.01, index + 10)),
      ],
    }))
    expect(result.edgeAssessment).toBe('indeterminate')
    expect(timingHistoryEdgeStatus(result.edgeAssessment)).toBe('caution')
  })
})
