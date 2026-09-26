import type { TimingHistory, TimingHistoryObservation } from '../timing-history'
import { describe, expect, it } from 'vitest'
import { calibrateTimingHistoryEdge, timingHistoryEdgeStatus, walkForwardTimingCalibration } from '../timing-history'

function observation(state: TimingHistoryObservation['state'], forwardReturn20: number, index: number): TimingHistoryObservation {
  return {
    anchorDate: `2026${String(index + 1).padStart(4, '0')}`,
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

describe('walkForwardTimingCalibration', () => {
  it('stays insufficient when directional out-of-sample calls are fewer than 6', () => {
    const result = walkForwardTimingCalibration(history({
      currentState: 'constructive',
      observations: [
        ...Array.from({ length: 12 }, (_, index) => observation('weak', -0.06, index)),
        ...Array.from({ length: 8 }, (_, index) => observation('constructive', 0.08, index + 12)),
      ],
    }))
    expect(result).toMatchObject({ edgeAssessment: 'insufficient', directionalSampleSize: 2 })
    expect(timingHistoryEdgeStatus(result.edgeAssessment)).toBe('missing')
  })

  it('maps a fully above-chance agreement interval to supported', () => {
    const result = walkForwardTimingCalibration(history({
      currentState: 'constructive',
      observations: [
        ...Array.from({ length: 12 }, (_, index) => observation('weak', -0.06, index)),
        ...Array.from({ length: 12 }, (_, index) => observation('constructive', 0.08, index + 12)),
      ],
    }))
    expect(result.directionalSampleSize).toBe(6)
    expect(result.agreementCount).toBe(6)
    expect(result.edgeAssessment).toBe('supported')
    expect(timingHistoryEdgeStatus(result.edgeAssessment)).toBe('pass')
  })

  it('confirms a down call without requiring other states to have six samples', () => {
    const result = walkForwardTimingCalibration(history({
      currentState: 'constructive',
      observations: [
        ...Array.from({ length: 2 }, (_, index) => observation('weak', -0.04, index)),
        ...Array.from({ length: 42 }, (_, index) => observation('constructive', -0.03, index + 2)),
      ],
    }))
    expect(result.directionalSampleSize).toBe(36)
    expect(result.agreementCount).toBe(36)
    expect(result.edgeAssessment).toBe('supported')
    expect(timingHistoryEdgeStatus(result.edgeAssessment)).toBe('pass')
  })

  it('keeps a long confirmed direction when only the tail reverses', () => {
    const result = walkForwardTimingCalibration(history({
      currentState: 'constructive',
      observations: [
        ...Array.from({ length: 36 }, (_, index) => observation('constructive', -0.03, index)),
        ...Array.from({ length: 6 }, (_, index) => observation('constructive', 0.04, index + 36)),
      ],
    }))
    expect(result).toMatchObject({ directionalSampleSize: 36, agreementCount: 30, edgeAssessment: 'supported' })
  })

  it('maps six unconfirmed down calls to weaker', () => {
    const signs = '------+-+--+--+-+--+'
    const result = walkForwardTimingCalibration(history({
      currentState: 'constructive',
      observations: [...signs].map((sign, index) => observation('constructive', sign === '+' ? 0.02 : -0.02, index)),
    }))
    expect(result).toMatchObject({ directionalSampleSize: 6, agreementCount: 0, edgeAssessment: 'weaker' })
    expect(timingHistoryEdgeStatus(result.edgeAssessment)).toBe('fail')
  })

  it('predicts down when the state beats a weaker complement but stays below 50%', () => {
    function resultFor(lastReturn: number) {
      return walkForwardTimingCalibration(history({
        currentState: 'constructive',
        observations: [
          ...Array.from({ length: 80 }, (_, index) => observation('weak', -0.05, index)),
          ...Array.from({ length: 72 }, (_, index) => observation('constructive', -0.02, index + 80)),
          ...Array.from({ length: 8 }, (_, index) => observation('constructive', 0.01, index + 152)),
          observation('constructive', lastReturn, 160),
        ],
      }))
    }

    const down = resultFor(-0.02)
    const up = resultFor(0.02)
    expect(down.directionalSampleSize).toBe(up.directionalSampleSize)
    expect(down.agreementCount).toBe(up.agreementCount + 1)
  })
})
